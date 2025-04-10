// notification-service/src/services/providers/email.provider.js
const nodemailer = require('nodemailer');
const config = require('../../utils/config');
const logger = require('../../utils/logger');

class EmailProvider {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.EMAIL_SERVICE,
      port: 587,
      secure: false,
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASSWORD
      }
    });
    
    // Verify connection
    this.transporter.verify((error) => {
      if (error) {
        logger.error('Email service error:', error);
      } else {
        logger.info('Email service ready');
      }
    });
  }
  
  async send({ to, subject, text, html }) {
    try {
      const mailOptions = {
        from: `"Trading Platform" <${config.EMAIL_USER}>`,
        to,
        subject,
        text,
        html
      };
      
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }
}

module.exports = EmailProvider;

