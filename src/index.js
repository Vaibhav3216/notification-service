// notification-service/src/index.js
const express = require('express');
const { createServer } = require('http');
const mongoose = require('mongoose');
const amqp = require('amqplib');
const cors = require('cors');
const config = require('./utils/config');
const logger = require('./utils/logger');
const notificationRoutes = require('./api/routes/notification.routes');
const errorMiddleware = require('./api/middleware/error.middleware');
const NotificationService = require('./services/notification.service');

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(config.MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((error) => {
    logger.error('Error connecting to MongoDB:', error.message);
  });

// Set up RabbitMQ connection and consumer
async function setupMessageQueue() {
  try {
    const connection = await amqp.connect(config.RABBITMQ_URI);
    const channel = await connection.createChannel();
    
    // Setup message queue for order notifications
    await channel.assertExchange(config.ORDER_NOTIFICATION_EXCHANGE, 'topic', { durable: true });
    const q = await channel.assertQueue(config.ORDER_NOTIFICATION_QUEUE, { durable: true });
    
    await channel.bindQueue(q.queue, config.ORDER_NOTIFICATION_EXCHANGE, 'order.completed');
    
    // Initialize notification service
    const notificationService = new NotificationService();
    
    // Consume messages
    channel.consume(q.queue, async (msg) => {
      if (msg !== null) {
        try {
          const orderData = JSON.parse(msg.content.toString());
          await notificationService.processOrderNotification(orderData);
          channel.ack(msg);
        } catch (error) {
          logger.error('Error processing message:', error);
          channel.nack(msg);
        }
      }
    });
    
    logger.info('Message queue setup completed');
  } catch (error) {
    logger.error('Error setting up message queue:', error);
    // Retry connection after delay
    setTimeout(setupMessageQueue, 5000);
  }
}

// Set up API routes
app.use('/api/notifications', notificationRoutes);

// Error middleware
app.use(errorMiddleware);

// Start server
const PORT = config.PORT || 3003;
const server = createServer(app);

server.listen(PORT, () => {
  logger.info(`Notification service running on port ${PORT}`);
  setupMessageQueue();
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = app;