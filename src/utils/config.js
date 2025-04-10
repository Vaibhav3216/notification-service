require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3003,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/trading-platform',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  RABBITMQ_URI: process.env.RABBITMQ_URI || 'amqp://localhost',
  ORDER_NOTIFICATION_EXCHANGE: 'order_events',
  ORDER_NOTIFICATION_QUEUE: 'notification_service_queue',
  EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'smtp.example.com',
  EMAIL_USER: process.env.EMAIL_USER || 'notifications@example.com',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || 'password',
  SMS_API_KEY: process.env.SMS_API_KEY || 'your-sms-api-key',
  SMS_API_SECRET: process.env.SMS_API_SECRET || 'your-sms-api-secret',
  PUSH_API_KEY: process.env.PUSH_API_KEY || 'your-push-api-key',
};