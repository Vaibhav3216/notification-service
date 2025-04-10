
// notification-service/src/services/providers/push.provider.js
const admin = require('firebase-admin');
const config = require('../../utils/config');
const logger = require('../../utils/logger');

class PushProvider {
  constructor() {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
          })
        });
        logger.info('Firebase Admin SDK initialized');
      } catch (error) {
        logger.error('Error initializing Firebase Admin SDK:', error);
      }
    }
  }
  
  async send({ token, title, body, data }) {
    try {
      const message = {
        notification: {
          title,
          body
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        token
      };
      
      const response = await admin.messaging().send(message);
      logger.info(`Push notification sent: ${response}`);
      return response;
    } catch (error) {
      logger.error('Error sending push notification:', error);
      throw error;
    }
  }
}

module.exports = PushProvider;