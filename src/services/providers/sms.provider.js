// notification-service/src/services/providers/sms.provider.js
const twilio = require('twilio');
const config = require('../../utils/config');
const logger = require('../../utils/logger');

class SmsProvider {
  constructor() {
    this.client = twilio(config.SMS_API_KEY, config.SMS_API_SECRET);
  }
  
  async send({ to, message }) {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: '+15105550000', // replace with your Twilio phone number
        to
      });
      
      logger.info(`SMS sent: ${result.sid}`);
      return result;
    } catch (error) {
      logger.error('Error sending SMS:', error);
      throw error;
    }
  }
}

module.exports = SmsProvider;
