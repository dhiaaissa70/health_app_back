// Notification Controller
// Handles notification registration, preferences, and delivery

const User = require('../models/User');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { sendNotification, sendMulticastNotification, isFirebaseInitialized } = require('../config/firebaseAdmin');
const { getAllUpcomingReminders } = require('../utils/notificationScheduler');

// @desc    Register FCM token for push notifications
// @route   POST /api/notifications/register-token
// @access  Private
const registerFCMToken = asyncHandler(async (req, res) => {
    const { token, deviceId, platform } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            error: 'Please provide FCM token'
        });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    // Check if token already exists
    const existingTokenIndex = user.fcmTokens.findIndex(t => t.token === token);

    if (existingTokenIndex !== -1) {
        // Update existing token
        user.fcmTokens[existingTokenIndex].deviceId = deviceId;
        user.fcmTokens[existingTokenIndex].platform = platform;
        user.fcmTokens[existingTokenIndex].addedAt = new Date();
    } else {
        // Add new token
        user.fcmTokens.push({
            token,
            deviceId,
            platform,
            addedAt: new Date()
        });
    }

    await user.save();

    res.status(200).json({
        success: true,
        message: 'FCM token registered successfully',
        tokenCount: user.fcmTokens.length
    });
});

// @desc    Remove FCM token
// @route   DELETE /api/notifications/register-token
// @access  Private
const removeFCMToken = asyncHandler(async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            error: 'Please provide FCM token'
        });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    // Remove token
    user.fcmTokens = user.fcmTokens.filter(t => t.token !== token);
    await user.save();

    res.status(200).json({
        success: true,
        message: 'FCM token removed successfully'
    });
});

// @desc    Get notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
const getNotificationPreferences = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('notificationPreferences');

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    res.status(200).json({
        success: true,
        data: user.notificationPreferences || {}
    });
});

// @desc    Update notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
const updateNotificationPreferences = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    // Update preferences
    const allowedFields = [
        'medicationReminders',
        'fastingReminders',
        'appointmentReminders',
        'chatMessages',
        'reminderMinutesBefore',
        'quietHoursEnabled',
        'quietHoursStart',
        'quietHoursEnd'
    ];

    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            user.notificationPreferences[field] = req.body[field];
        }
    });

    await user.save();

    res.status(200).json({
        success: true,
        message: 'Notification preferences updated successfully',
        data: user.notificationPreferences
    });
});

// @desc    Get upcoming reminders
// @route   GET /api/notifications/upcoming
// @access  Private
const getUpcomingReminders = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    // Calculate all upcoming reminders
    const reminders = await getAllUpcomingReminders(req.user.id, user.notificationPreferences);

    res.status(200).json({
        success: true,
        count: reminders.length,
        data: reminders
    });
});

// @desc    Get notification history
// @route   GET /api/notifications/history
// @access  Private
const getNotificationHistory = asyncHandler(async (req, res) => {
    const { limit = 50, page = 1, unreadOnly = false } = req.query;

    const query = { user: req.user.id };

    if (unreadOnly === 'true') {
        query.isRead = false;
    }

    const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .populate('relatedEntity.entityId');

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.getUnreadCount(req.user.id);

    res.status(200).json({
        success: true,
        count: notifications.length,
        total,
        unreadCount,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        data: notifications
    });
});

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markNotificationAsRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
        return res.status(404).json({
            success: false,
            error: 'Notification not found'
        });
    }

    // Check if user owns this notification
    if (notification.user.toString() !== req.user.id) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to access this notification'
        });
    }

    await notification.markAsRead();

    res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: notification
    });
});

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
    const result = await Notification.updateMany(
        { user: req.user.id, isRead: false },
        { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
        success: true,
        message: `Marked ${result.modifiedCount} notifications as read`
    });
});

// @desc    Send test notification
// @route   POST /api/notifications/test
// @access  Private
const sendTestNotification = asyncHandler(async (req, res) => {
    if (!isFirebaseInitialized()) {
        return res.status(503).json({
            success: false,
            error: 'Firebase Admin SDK is not initialized. Push notifications are disabled.'
        });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    if (!user.fcmTokens || user.fcmTokens.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'No FCM tokens registered for this user'
        });
    }

    const title = req.body.title || '🔔 Test Notification';
    const body = req.body.body || 'This is a test notification from Health App';

    try {
        // Send to all user's devices
        const tokens = user.fcmTokens.map(t => t.token);
        const result = await sendMulticastNotification(tokens, title, body, {
            type: 'test',
            timestamp: new Date().toISOString()
        });

        // Create notification record
        const notification = await Notification.create({
            user: req.user.id,
            type: 'general',
            title,
            body,
            data: { type: 'test' },
            deliveryStatus: 'sent',
            sentAt: new Date()
        });

        res.status(200).json({
            success: true,
            message: 'Test notification sent successfully',
            result: {
                successCount: result.successCount,
                failureCount: result.failureCount,
                totalTokens: tokens.length
            },
            notification
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to send test notification',
            details: error.message
        });
    }
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
        return res.status(404).json({
            success: false,
            error: 'Notification not found'
        });
    }

    // Check if user owns this notification
    if (notification.user.toString() !== req.user.id) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to delete this notification'
        });
    }

    await notification.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Notification deleted successfully'
    });
});

module.exports = {
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
};
