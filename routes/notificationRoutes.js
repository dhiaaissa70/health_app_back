// Notification routes

const express = require('express');
const router = express.Router();
const {
    registerFCMToken,
    removeFCMToken,
    getNotificationPreferences,
    updateNotificationPreferences,
    getUpcomingReminders,
    getNotificationHistory,
    markNotificationAsRead,
    markAllAsRead,
    sendTestNotification,
    deleteNotification
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

// All routes are protected (require authentication)
router.use(protect);

// FCM Token management
router.route('/register-token')
    .post(registerFCMToken)
    .delete(removeFCMToken);

// Notification preferences
router.route('/preferences')
    .get(getNotificationPreferences)
    .put(updateNotificationPreferences);

// Upcoming reminders
router.get('/upcoming', getUpcomingReminders);

// Notification history
router.get('/history', getNotificationHistory);

// Mark as read
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markNotificationAsRead);

// Test notification
router.post('/test', sendTestNotification);

// Delete notification
router.delete('/:id', deleteNotification);

module.exports = router;
