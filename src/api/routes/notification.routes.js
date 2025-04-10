// notification-service/src/api/routes/notification.routes.js
const express = require('express');
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes
router.get('/health', notificationController.healthCheck);

// Protected user routes
router.get('/', authMiddleware.verifyToken, notificationController.getUserNotifications);
router.get('/:id', authMiddleware.verifyToken, notificationController.getNotificationById);
router.patch('/:id/read', authMiddleware.verifyToken, notificationController.markAsRead);
router.delete('/:id', authMiddleware.verifyToken, notificationController.deleteNotification);
router.get('/preferences', authMiddleware.verifyToken, notificationController.getUserPreferences);
router.put('/preferences', authMiddleware.verifyToken, notificationController.updateUserPreferences);
router.post('/test', authMiddleware.verifyToken, notificationController.sendTestNotification);

// Internal service routes
router.post('/send', authMiddleware.verifyServiceToken, notificationController.sendNotification);
router.post('/batch', authMiddleware.verifyServiceToken, notificationController.sendBatchNotifications);

module.exports = router;