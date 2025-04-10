// notification-service/src/services/notification.service.js
const logger = require('../utils/logger');
const Notification = require('../models/notification.model');
const UserPreference = require('../models/user-preference.model');
const EmailProvider = require('./providers/email.provider');
const SmsProvider = require('./providers/sms.provider');
const PushProvider = require('./providers/push.provider');

class NotificationService {
  constructor() {
    this.emailProvider = new EmailProvider();
    this.smsProvider = new SmsProvider();
    this.pushProvider = new PushProvider();
  }

  async processOrderNotification(orderData) {
    try {
      logger.info(`Processing order notification for strategy: ${orderData.strategyId}`);
      
      // Create notification record
      const notification = new Notification({
        userId: orderData.userId,
        strategyId: orderData.strategyId,
        type: orderData.notificationType || 'ORDER_EXECUTED',
        message: this._generateNotificationMessage(orderData),
        details: orderData,
        status: 'PENDING'
      });
      
      await notification.save();
      
      // Get user preferences
      const userPreference = await UserPreference.findOne({ userId: orderData.userId });
      
      if (!userPreference) {
        logger.warn(`No notification preferences found for user: ${orderData.userId}`);
        // Create default preferences
        const defaultPreferences = new UserPreference({
          userId: orderData.userId,
          email: { 
            enabled: true,
            address: orderData.userEmail || ''
          }
        });
        await defaultPreferences.save();
        
        // Send notification via email only (default)
        if (orderData.userEmail) {
          await this._sendEmailNotification(notification, orderData.userEmail);
        } else {
          logger.warn(`No email address available for user: ${orderData.userId}`);
          notification.status = 'FAILED';
          await notification.save();
        }
        return;
      }
      
      // Check if user wants this type of notification
      if (!userPreference.notificationTypes[notification.type]) {
        logger.info(`User ${orderData.userId} has disabled ${notification.type} notifications`);
        notification.status = 'SENT'; // Mark as sent since user doesn't want it
        await notification.save();
        return;
      }
      
      // Send notifications based on user preferences
      let notificationSent = false;
      
      // Try email
      if (userPreference.email.enabled && userPreference.email.address) {
        const emailSuccess = await this._sendEmailNotification(notification, userPreference.email.address);
        notificationSent = notificationSent || emailSuccess;
      }
      
      // Try SMS
      if (userPreference.sms.enabled && userPreference.sms.phoneNumber) {
        const smsSuccess = await this._sendSmsNotification(notification, userPreference.sms.phoneNumber);
        notificationSent = notificationSent || smsSuccess;
      }
      
      // Try push
      if (userPreference.push.enabled && userPreference.push.deviceTokens.length > 0) {
        const pushSuccess = await this._sendPushNotification(notification, userPreference.push.deviceTokens);
        notificationSent = notificationSent || pushSuccess;
      }
      
      // Update notification status
      notification.status = notificationSent ? 'SENT' : 'FAILED';
      await notification.save();
      
    } catch (error) {
      logger.error('Error processing notification:', error);
      throw error;
    }
  }
  
  async getUserNotifications(userId, filters = {}, pagination = { page: 1, limit: 20 }) {
    try {
      const query = { userId };
      
      // Apply optional filters
      if (filters.type) query.type = filters.type;
      if (filters.status) query.status = filters.status;
      if (filters.isRead !== undefined) query.isRead = filters.isRead;
      if (filters.startDate && filters.endDate) {
        query.createdAt = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }
      
      const skip = (pagination.page - 1) * pagination.limit;
      
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit);
        
      const total = await Notification.countDocuments(query);
      const unreadCount = await Notification.countDocuments({ userId, isRead: false });
      
      return {
        notifications,
        unreadCount,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          pages: Math.ceil(total / pagination.limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching user notifications:', error);
      throw error;
    }
  }
  
  async getUserPreferences(userId) {
    try {
      let preferences = await UserPreference.findOne({ userId });
      
      if (!preferences) {
        // Create default preferences
        preferences = new UserPreference({
          userId,
          email: { enabled: true }
        });
        await preferences.save();
      }
      
      return preferences;
    } catch (error) {
      logger.error('Error fetching user preferences:', error);
      throw error;
    }
  }
  
  async updateUserPreferences(userId, preferences) {
    try {
      const userPreferences = await UserPreference.findOne({ userId });
      
      if (!userPreferences) {
        // Create new preferences
        const newPreferences = new UserPreference({
          userId,
          ...preferences
        });
        await newPreferences.save();
        return newPreferences;
      }
      
      // Update existing preferences
      Object.assign(userPreferences, preferences);
      await userPreferences.save();
      
      return userPreferences;
    } catch (error) {
      logger.error('Error updating user preferences:', error);
      throw error;
    }
  }
  
  _generateNotificationMessage(orderData) {
    const { notificationType, symbol, orderType, side, price, quantity } = orderData;
    
    switch (notificationType) {
      case 'ORDER_EXECUTED':
        return `Order executed: ${side} ${quantity} ${symbol} at ${price}`;
      case 'STOP_LOSS':
        return `Stop loss triggered for ${symbol} at ${price}`;
      case 'TAKE_PROFIT':
        return `Take profit reached for ${symbol} at ${price}`;
      case 'STRATEGY_STARTED':
        return `Strategy has been started`;
      case 'STRATEGY_STOPPED':
        return `Strategy has been stopped`;
      case 'ERROR':
        return `Error in strategy execution: ${orderData.errorMessage || 'Unknown error'}`;
      default:
        return `Notification for ${symbol}: ${orderData.message || ''}`;
    }
  }
  
  async _sendEmailNotification(notification, emailAddress) {
    try {
      await this.emailProvider.send({
        to: emailAddress,
        subject: `Trading Notification: ${notification.type}`,
        text: notification.message,
        html: this._generateEmailHtml(notification)
      });
      logger.info(`Email notification sent to ${emailAddress}`);
      return true;
    } catch (error) {
      logger.error(`Error sending email notification: ${error.message}`);
      return false;
    }
  }
  
  async _sendSmsNotification(notification, phoneNumber) {
    try {
      await this.smsProvider.send({
        to: phoneNumber,
        message: notification.message
      });
      logger.info(`SMS notification sent to ${phoneNumber}`);
      return true;
    } catch (error) {
      logger.error(`Error sending SMS notification: ${error.message}`);
      return false;
    }
  }
  
  async _sendPushNotification(notification, deviceTokens) {
    try {
      const promises = deviceTokens.map(token => {
        return this.pushProvider.send({
          token,
          title: `Trading Alert: ${notification.type}`,
          body: notification.message,
          data: {
            notificationId: notification._id.toString(),
            type: notification.type,
            strategyId: notification.strategyId.toString()
          }
        });
      });
      
      await Promise.all(promises);
      logger.info(`Push notifications sent to ${deviceTokens.length} devices`);
      return true;
    } catch (error) {
      logger.error(`Error sending push notification: ${error.message}`);
      return false;
    }
  }
  
  _generateEmailHtml(notification) {
    const { type, message, details, createdAt } = notification;
    
    // Generate a styled HTML email
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #333; }
          .container { width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2a2a72; color: white; padding: 15px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
          .details { background-color: #fff; padding: 15px; margin-top: 20px; border-radius: 4px; border: 1px solid #ddd; }
          .button { display: inline-block; background-color: #2a2a72; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Trading Platform Notification</h2>
          </div>
          <div class="content">
            <h3>${type.replace(/_/g, ' ')}</h3>
            <p>${message}</p>
            
            <div class="details">
              <h4>Details:</h4>
              <p><strong>Strategy ID:</strong> ${notification.strategyId}</p>
              <p><strong>Time:</strong> ${new Date(createdAt).toLocaleString()}</p>
              ${details && details.symbol ? `<p><strong>Symbol:</strong> ${details.symbol}</p>` : ''}
              ${details && details.price ? `<p><strong>Price:</strong> ${details.price}</p>` : ''}
              ${details && details.quantity ? `<p><strong>Quantity:</strong> ${details.quantity}</p>` : ''}
              ${details && details.side ? `<p><strong>Side:</strong> ${details.side}</p>` : ''}
            </div>
            
            <p style="margin-top: 30px; text-align: center;">
              <a href="https://trading-platform.example.com/strategies/${notification.strategyId}" class="button">View Strategy</a>
            </p>
          </div>
          <div class="footer">
            <p>This is an automated message from your Trading Platform. Please do not reply to this email.</p>
            <p>To manage your notification preferences, visit your account settings.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = NotificationService;