// notification-service/tests/services/notification.service.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const NotificationService = require('../../src/services/notification.service');
const Notification = require('../../src/models/notification.model');
const UserPreference = require('../../src/models/user-preference.model');
const EmailProvider = require('../../src/services/providers/email.provider');
const SmsProvider = require('../../src/services/providers/sms.provider');
const PushProvider = require('../../src/services/providers/push.provider');

// Mock the providers
jest.mock('../../src/services/providers/email.provider');
jest.mock('../../src/services/providers/sms.provider');
jest.mock('../../src/services/providers/push.provider');

let mongoServer;
let notificationService;

beforeAll(async () => {
  // Set up MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  await mongoose.connect(uri);
  
  // Set up mocks
  EmailProvider.mockImplementation(() => ({
    send: jest.fn().mockResolvedValue(true)
  }));
  
  SmsProvider.mockImplementation(() => ({
    send: jest.fn().mockResolvedValue(true)
  }));
  
  PushProvider.mockImplementation(() => ({
    send: jest.fn().mockResolvedValue(true)
  }));
  
  notificationService = new NotificationService();
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

describe('NotificationService', () => {
  
  describe('processOrderNotification', () => {
    it('should create a notification record in the database', async () => {
      // Test data
      const orderData = {
        userId: 'user123',
        strategyId: '5f7d1e3b9d31162e78d5b1f5',
        notificationType: 'ORDER_EXECUTED',
        symbol: 'AAPL',
        orderType: 'MARKET',
        side: 'BUY',
        price: 150.25,
        quantity: 10,
        userEmail: 'user@example.com'
      };
      
      // Process notification
      await notificationService.processOrderNotification(orderData);
      
      // Check if notification was created
      const notifications = await Notification.find({ userId: 'user123' });
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe('ORDER_EXECUTED');
      expect(notifications[0].userId).toBe('user123');
      expect(notifications[0].strategyId.toString()).toBe('5f7d1e3b9d31162e78d5b1f5');
    });
    
    it('should create default user preferences if none exist', async () => {
      const orderData = {
        userId: 'user456',
        strategyId: '5f7d1e3b9d31162e78d5b1f5',
        notificationType: 'ORDER_EXECUTED',
        symbol: 'AAPL',
        userEmail: 'user456@example.com'
      };
      
      await notificationService.processOrderNotification(orderData);
      
      const preferences = await UserPreference.findOne({ userId: 'user456' });
      expect(preferences).toBeTruthy();
      expect(preferences.email.enabled).toBe(true);
      expect(preferences.email.address).toBe('user456@example.com');
    });
    
    it('should respect user preferences for notification channels', async () => {
      // Create user preferences
      await UserPreference.create({
        userId: 'user789',
        email: {
          enabled: false,
          address: 'user789@example.com'
        },
        sms: {
          enabled: true,
          phoneNumber: '+15551234567'
        },
        push: {
          enabled: false,
          deviceTokens: []
        }
      });
      
      // Create order data
      const orderData = {
        userId: 'user789',
        strategyId: '5f7d1e3b9d31162e78d5b1f5',
        notificationType: 'ORDER_EXECUTED',
        symbol: 'AAPL'
      };
      
      // Process notification
      await notificationService.processOrderNotification(orderData);
      
      // Check that notification was sent only through SMS
      expect(notificationService.emailProvider.send).not.toHaveBeenCalled();
      expect(notificationService.smsProvider.send).toHaveBeenCalled();
      expect(notificationService.pushProvider.send).not.toHaveBeenCalled();
    });
  });
  
  describe('getUserNotifications', () => {
    it('should retrieve notifications for a specific user', async () => {
      // Create test notifications
      await Notification.create([
        {
          userId: 'testUser',
          strategyId: '5f7d1e3b9d31162e78d5b1f5',
          type: 'ORDER_EXECUTED',
          message: 'Test notification 1',
          status: 'SENT'
        },
        {
          userId: 'testUser',
          strategyId: '5f7d1e3b9d31162e78d5b1f5',
          type: 'STOP_LOSS',
          message: 'Test notification 2',
          status: 'SENT'
        },
        {
          userId: 'anotherUser',
          strategyId: '5f7d1e3b9d31162e78d5b1f5',
          type: 'ORDER_EXECUTED',
          message: 'Test notification 3',
          status: 'SENT'
        }
      ]);
      
      // Get notifications
      const result = await notificationService.getUserNotifications('testUser');
      
      // Check results
      expect(result.notifications.length).toBe(2);
      expect(result.pagination.total).toBe(2);
      expect(result.notifications[0].userId).toBe('testUser');
    });
    
    it('should apply filters correctly', async () => {
      // Create test notifications
      await Notification.create([
        {
          userId: 'filterUser',
          strategyId: '5f7d1e3b9d31162e78d5b1f5',
          type: 'ORDER_EXECUTED',
          message: 'Test notification 1',
          status: 'SENT',
          isRead: true
        },
        {
          userId: 'filterUser',
          strategyId: '5f7d1e3b9d31162e78d5b1f5',
          type: 'STOP_LOSS',
          message: 'Test notification 2',
          status: 'SENT',
          isRead: false
        },
        {
          userId: 'filterUser',
          strategyId: '5f7d1e3b9d31162e78d5b1f5',
          type: 'ORDER_EXECUTED',
          message: 'Test notification 3',
          status: 'FAILED',
          isRead: false
        }
      ]);
      
      // Get notifications with filters
      const result = await notificationService.getUserNotifications('filterUser', { 
        type: 'ORDER_EXECUTED',
        isRead: false
      });
      
      // Check results
      expect(result.notifications.length).toBe(1);
      expect(result.notifications[0].type).toBe('ORDER_EXECUTED');
      expect(result.notifications[0].isRead).toBe(false);
      expect(result.unreadCount).toBe(2); // Total unread count for user
    });
  });
  
  describe('updateUserPreferences', () => {
    it('should update existing user preferences', async () => {
      // Create initial preferences
      await UserPreference.create({
        userId: 'prefUser',
        email: {
          enabled: true,
          address: 'user@example.com'
        },
        sms: {
          enabled: false,
          phoneNumber: ''
        }
      });
      
      // Update preferences
      const updatedPreferences = await notificationService.updateUserPreferences('prefUser', {
        email: {
          enabled: false
        },
        sms: {
          enabled: true,
          phoneNumber: '+15551234567'
        }
      });
      
      // Check results
      expect(updatedPreferences.email.enabled).toBe(false);
      expect(updatedPreferences.sms.enabled).toBe(true);
      expect(updatedPreferences.sms.phoneNumber).toBe('+15551234567');
      
      // Verify in database
      const dbPreferences = await UserPreference.findOne({ userId: 'prefUser' });
      expect(dbPreferences.email.enabled).toBe(false);
      expect(dbPreferences.sms.enabled).toBe(true);
    });
    
    it('should create new preferences if none exist', async () => {
      // Update preferences for new user
      const newPreferences = await notificationService.updateUserPreferences('newUser', {
        email: {
          enabled: true,
          address: 'newuser@example.com'
        },
        notificationTypes: {
          ORDER_EXECUTED: true,
          STOP_LOSS: false
        }
      });
      
      // Check results
      expect(newPreferences.email.enabled).toBe(true);
      expect(newPreferences.email.address).toBe('newuser@example.com');
      expect(newPreferences.notificationTypes.ORDER_EXECUTED).toBe(true);
      expect(newPreferences.notificationTypes.STOP_LOSS).toBe(false);
      
      // Verify in database
      const dbPreferences = await UserPreference.findOne({ userId: 'newUser' });
      expect(dbPreferences).toBeTruthy();
      expect(dbPreferences.email.address).toBe('newuser@example.com');
    });
  });
});