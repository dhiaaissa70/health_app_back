const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    // User who receives the notification
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User reference is required']
    },

    // Type of notification
    type: {
        type: String,
        enum: ['medication', 'fasting', 'appointment', 'general'],
        required: [true, 'Notification type is required']
    },

    // Reference to related entity
    relatedEntity: {
        entityType: {
            type: String,
            enum: ['Medication', 'FastingInstruction', 'Appointment', 'None'],
            default: 'None'
        },
        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'relatedEntity.entityType'
        }
    },

    // Notification content
    title: {
        type: String,
        required: [true, 'Notification title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },

    body: {
        type: String,
        required: [true, 'Notification body is required'],
        trim: true,
        maxlength: [500, 'Body cannot exceed 500 characters']
    },

    // Additional data payload
    data: {
        type: Map,
        of: String,
        default: {}
    },

    // Delivery information
    fcmMessageId: {
        type: String
    },

    deliveryStatus: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'failed'],
        default: 'pending'
    },

    sentAt: {
        type: Date
    },

    deliveredAt: {
        type: Date
    },

    failureReason: {
        type: String
    },

    // Read status
    isRead: {
        type: Boolean,
        default: false
    },

    readAt: {
        type: Date
    },

    // Scheduled time (for future notifications)
    scheduledFor: {
        type: Date
    },

    // Priority
    priority: {
        type: String,
        enum: ['low', 'normal', 'high'],
        default: 'normal'
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, isRead: 1 });
NotificationSchema.index({ deliveryStatus: 1, scheduledFor: 1 });
NotificationSchema.index({ 'relatedEntity.entityId': 1 });

// Method to mark as read
NotificationSchema.methods.markAsRead = async function () {
    if (!this.isRead) {
        this.isRead = true;
        this.readAt = new Date();
        await this.save();
    }
    return this;
};

// Method to mark as delivered
NotificationSchema.methods.markAsDelivered = async function (messageId) {
    this.deliveryStatus = 'delivered';
    this.deliveredAt = new Date();
    if (messageId) {
        this.fcmMessageId = messageId;
    }
    await this.save();
    return this;
};

// Method to mark as failed
NotificationSchema.methods.markAsFailed = async function (reason) {
    this.deliveryStatus = 'failed';
    this.failureReason = reason;
    await this.save();
    return this;
};

// Static method to get unread count for user
NotificationSchema.statics.getUnreadCount = async function (userId) {
    return this.countDocuments({
        user: userId,
        isRead: false
    });
};

// Static method to get recent notifications
NotificationSchema.statics.getRecent = async function (userId, limit = 20) {
    return this.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('relatedEntity.entityId');
};

module.exports = mongoose.model('Notification', NotificationSchema);
