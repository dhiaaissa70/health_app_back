const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    // Reference to the conversation
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: [true, 'Conversation reference is required']
    },

    // Sender of the message
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Sender is required']
    },

    // Message content
    content: {
        type: String,
        required: [true, 'Message content is required'],
        trim: true,
        maxlength: [5000, 'Message cannot exceed 5000 characters']
    },

    // Message type
    messageType: {
        type: String,
        enum: ['text', 'image', 'file', 'system'],
        default: 'text'
    },

    // File attachment (for future use)
    attachment: {
        url: String,
        filename: String,
        fileType: String,
        fileSize: Number
    },

    // Read status - array of user IDs who have read this message
    readBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Delivery status - array of user IDs who received this message
    deliveredTo: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        deliveredAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Edit and delete flags
    isEdited: {
        type: Boolean,
        default: false
    },

    editedAt: {
        type: Date
    },

    isDeleted: {
        type: Boolean,
        default: false
    },

    deletedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
MessageSchema.index({ conversation: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, createdAt: -1 });
MessageSchema.index({ conversation: 1, isDeleted: 1, createdAt: -1 });

// Virtual to check if message is read by a specific user
MessageSchema.methods.isReadBy = function (userId) {
    return this.readBy.some(read => read.user.toString() === userId.toString());
};

// Virtual to check if message is delivered to a specific user
MessageSchema.methods.isDeliveredTo = function (userId) {
    return this.deliveredTo.some(delivery => delivery.user.toString() === userId.toString());
};

// Method to mark message as read by a user
MessageSchema.methods.markAsRead = async function (userId) {
    if (!this.isReadBy(userId)) {
        this.readBy.push({
            user: userId,
            readAt: new Date()
        });
        await this.save();
    }
    return this;
};

// Method to mark message as delivered to a user
MessageSchema.methods.markAsDelivered = async function (userId) {
    if (!this.isDeliveredTo(userId)) {
        this.deliveredTo.push({
            user: userId,
            deliveredAt: new Date()
        });
        await this.save();
    }
    return this;
};

// Pre-save middleware to update conversation's lastMessage
MessageSchema.post('save', async function (doc) {
    try {
        const Conversation = mongoose.model('Conversation');
        await Conversation.findByIdAndUpdate(doc.conversation, {
            lastMessage: doc._id,
            lastMessageAt: doc.createdAt
        });
    } catch (error) {
        console.error('Error updating conversation lastMessage:', error);
    }
});

module.exports = mongoose.model('Message', MessageSchema);
