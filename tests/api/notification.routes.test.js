// notification-service/tests/api/notification.routes.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const app = require('../../src/index');
const Notification = require('../../src/models/notification.model');
const UserPreference = require('../../src/models/user-preference.model');
const config = require('../../src/utils/config');

// Mock RabbitMQ
jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      assertExchange: jest.fn().mockResolvedValue({}),
      assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue' }),
      bindQueue: jest.fn().mockResolvedValue({}),
      consume: jest.fn().mockResolvedValue({})
    })
  })
}));

let mongoServer;
let token;
let serviceToken;

beforeAll(async () => {
  // Set up MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  await mongoose.connect(uri);
  
  // Create authentication tokens
  token = jwt.sign({ id: 'testUserId', email: 'test@example.com' }, config.JWT_SECRET, { expiresIn: '1h' });
  serviceToken = process.env.INTERNAL_SERVICE_TOKEN || 'test-service-token';
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear collections before each test
  await Notification.deleteMany({});
  await UserPreference.deleteMany({});
});

describe('Notification API Routes', () => {
  
  describe('GET /api/notifications', () => {
    it('should retrieve user notifications', async () => {
      // Create test notifications
      await Notification.create([
        {
          userId: 'testUserId',
          strategyId: '5f7d1e3b9d31162e78d5b1f5',
          type: 'ORDER_EXECUTED',
          message: 'Test notification 1',
          status: 'SENT'
        },
        {
          userId: 'testUserId',
          strategyId: '5f7d1e3b9d31162e78d5b1f5',
          type: 'STOP_LOSS',
          message: 'Test notification 2',
          status: 'SENT'
        }
      ]);
      
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.notifications.length).toBe(2);
    });
    
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/notifications');
      
      expect(response.status).toBe(401);
    });
    
    it('should apply pagination', async () => {
      // Create 10 test notifications
      const notifications = Array.from({ length: 10 }, (_, i) => ({
        userId: 'testUserId',
        strategyId: '5f7d1e3b9d31162e78d5b1f5',
        type: 'ORDER_EXECUTED',
        message: `Test notification ${i + 1}`,
        status: 'SENT'
      }));
      
      await Notification.create(notifications);
      
      // Request with pagination
      const response = await request(app)
        .get('/api/notifications?page=2&limit=3')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.notifications.length).toBe(3);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(3);
      expect(response.body.pagination.total).toBe(10);
    });
  });
  
  describe('PATCH /api/notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      // Create test notification
      const notification = await Notification.create({
        userId: 'testUserId',
        strategyId: '5f7d1e3b9d31162e78d5b1f5',
        type: 'ORDER_EXECUTED',
        message: 'Test notification',
        status: 'SENT',
        isRead: false
      });
      
      const response = await request(app)
        .patch(`/api/notifications/${notification._id}/read`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      
      // Verify notification was updated
      const updatedNotification = await Notification.findById(notification._id);
      expect(updatedNotification.isRead).toBe(true);
    });
    
    it('should return 404 for non-existent notification', async () => {
      const response = await request(app)
        .patch('/api/notifications/5f7d1e3b9d31162e78d5b1f5/read')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(404);
    });
  });
  
  describe('POST /api/notifications/send', () => {
    it('should require service token', async () => {
      const response = await request(app)
        .post('/api/notifications/send')
        .send({
          userId: 'testUserId',
          strategyId: '5f7d1e3b9d31162e78d5b1f5',
          type: 'ORDER_EXECUTED',
          message: 'Test notification'
        });
      
      expect(response.status).toBe(401);
    });
    
    it('should send a notification', async () => {
      process.env.INTERNAL_SERVICE_TOKEN = serviceToken;
      
      const response = await request(app)
        .post('/api/notifications/send')
        .set('x-service-token', serviceToken)
        .send({
          userId: 'testUserId',
          strategyId: '5f7d1e3b9d31162e78d5b1f5',
          type: 'ORDER_EXECUTED',
          message: 'Test notification',
          details: {
            symbol: 'AAPL',
            price: 150.25
          }
        });
      
      expect(response.status).toBe(200);
      
      // Verify notification was created
      const notifications = await Notification.find({ userId: 'testUserId' });
      expect(notifications.length).toBe(1);
    });
  });
  
  describe('GET /api/notifications/preferences', () => {
    it('should retrieve user preferences', async () => {
      // Create test preferences
      await UserPreference.create({
        userId: 'testUserId',
        email: {
          enabled: true,
          address: 'test@example.com'
        }
      });
      
      const response = await request(app)
        .get('/api/notifications/preferences')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.userId).toBe('testUserId');
      expect(response.body.data.email.enabled).toBe(true);
    });
    
    it('should create default preferences if none exist', async () => {
      const response = await request(app)
        .get('/api/notifications/preferences')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.userId).toBe('testUserId');
      expect(response.body.data.email.enabled).toBe(true);
      
      // Verify preferences were created in database
      const preferences = await UserPreference.findOne({ userId: 'testUserId' });
      expect(preferences).toBeTruthy();
    });
  });
  
  describe('PUT /api/notifications/preferences', () => {
    it('should update user preferences', async () => {
      const response = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: {
            enabled: true,
            address: 'updated@example.com'
          },
          sms: {
            enabled: true,
            phoneNumber: '+15551234567'
          },
          notificationTypes: {
            ORDER_EXECUTED: true,
            STOP_LOSS: false
          }
        });
      
      expect(response.status).toBe(200);
      
      // Verify preferences were updated
      const preferences = await UserPreference.findOne({ userId: 'testUserId' });
      expect(preferences.email.address).toBe('updated@example.com');
      expect(preferences.sms.enabled).toBe(true);
      expect(preferences.sms.phoneNumber).toBe('+15551234567');
      expect(preferences.notificationTypes.ORDER_EXECUTED).toBe(true);
      expect(preferences.notificationTypes.STOP_LOSS).toBe(false);
    });
  });
});

// notification-service/tests/jest.config.js
module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testTimeout: 10000
};