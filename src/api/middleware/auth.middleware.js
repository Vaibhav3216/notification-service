// notification-service/src/api/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const config = require('../../utils/config');
const logger = require('../../utils/logger');

exports.verifyToken = (req, res, next) => {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: 'No authorization token provided' });
    }
    
    // Extract the token (remove "Bearer " prefix)
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Invalid token format' });
    }
    
    // Verify the token
    jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
      if (err) {
        logger.error(`Token verification failed: ${err.message}`);
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
      
      // Add decoded user to request object
      req.user = decoded;
      next();
    });
  } catch (error) {
    logger.error(`Authentication middleware error: ${error.message}`);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

exports.verifyServiceToken = (req, res, next) => {
  try {
    const serviceToken = req.headers['x-service-token'];
    
    if (!serviceToken) {
      return res.status(401).json({ message: 'No service token provided' });
    }
    
    // For internal service communication
    if (serviceToken !== process.env.INTERNAL_SERVICE_TOKEN) {
      return res.status(401).json({ message: 'Invalid service token' });
    }
    
    next();
  } catch (error) {
    logger.error(`Service authentication error: ${error.message}`);
    return res.status(500).json({ message: 'Service authentication error' });
  }
};