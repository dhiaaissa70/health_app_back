const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
    // Participants in the conversation (doctor and patient)
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],

    // Reference to the last message for quick access
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },

    // Timestamp of last activity
    lastMessageAt: {
        type: Date,
        default: Date.now
    },

    // Unread message count per user
    unreadCount: {
        type: Map,
        of: Number,
        default: {}
    },

    // Conversation status
    isActive: {
        type: Boolean,
        default: true
    },

    // Conversation type (for future expansion)
    conversationType: {
        type: String,
        enum: ['direct', 'group'],
        default: 'direct'
    }
}, {
    timestamps: true
});

// Compound index for fast participant lookup
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessageAt: -1 });

// Virtual to check if conversation has unread messages for a user
ConversationSchema.methods.hasUnreadMessages = function (userId) {
    const count = this.unreadCount.get(userId.toString());
    return count && count > 0;
};

// Method to increment unread count for a user
ConversationSchema.methods.incrementUnread = async function (userId) {
    const userIdStr = userId.toString();
    const currentCount = this.unreadCount.get(userIdStr) || 0;
    this.unreadCount.set(userIdStr, currentCount + 1);
    await this.save();
};

// Method to reset unread count for a user
ConversationSchema.methods.resetUnread = async function (userId) {
    const userIdStr = userId.toString();
    this.unreadCount.set(userIdStr, 0);
    await this.save();
};

// Method to get the other participant in a direct conversation
ConversationSchema.methods.getOtherParticipant = function (userId) {
    return this.participants.find(p => p._id.toString() !== userId.toString());
};

// Static method to find conversation between two users
ConversationSchema.statics.findBetweenUsers = async function (userId1, userId2) {
    return this.findOne({
        participants: { $all: [userId1, userId2] },
        conversationType: 'direct'
    });
};

// Static method to find or create conversation
ConversationSchema.statics.findOrCreate = async function (userId1, userId2) {
    let conversation = await this.findBetweenUsers(userId1, userId2);

    if (!conversation) {
        conversation = await this.create({
            participants: [userId1, userId2],
            unreadCount: {
                [userId1.toString()]: 0,
                [userId2.toString()]: 0
            }
        });
    }

    return conversation;
};

module.exports = mongoose.model('Conversation', ConversationSchema);
