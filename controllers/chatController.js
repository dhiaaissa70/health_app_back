// Chat controller - handles conversation and message management

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get all conversations for logged-in user
// @route   GET /api/chat/conversations
// @access  Private
const getConversations = asyncHandler(async (req, res) => {
    const conversations = await Conversation.find({
        participants: req.user.id,
        isActive: true
    })
        .populate('participants', 'name email role profileImage')
        .populate({
            path: 'lastMessage',
            select: 'content sender createdAt messageType'
        })
        .sort({ lastMessageAt: -1 });

    // Format conversations to include other participant info
    const formattedConversations = conversations.map(conv => {
        const otherParticipant = conv.participants.find(
            p => p._id.toString() !== req.user.id
        );

        return {
            _id: conv._id,
            participant: otherParticipant,
            lastMessage: conv.lastMessage,
            lastMessageAt: conv.lastMessageAt,
            unreadCount: conv.unreadCount.get(req.user.id) || 0,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt
        };
    });

    res.status(200).json({
        success: true,
        count: formattedConversations.length,
        data: formattedConversations
    });
});

// @desc    Get single conversation
// @route   GET /api/chat/conversations/:id
// @access  Private
const getConversation = asyncHandler(async (req, res) => {
    const conversation = await Conversation.findById(req.params.id)
        .populate('participants', 'name email role profileImage doctorInfo.specialization');

    if (!conversation) {
        return res.status(404).json({
            success: false,
            error: 'Conversation not found'
        });
    }

    // Check if user is a participant
    const isParticipant = conversation.participants.some(
        p => p._id.toString() === req.user.id
    );

    if (!isParticipant) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to access this conversation'
        });
    }

    res.status(200).json({
        success: true,
        data: conversation
    });
});

// @desc    Create or get conversation with another user
// @route   POST /api/chat/conversations
// @access  Private
const createConversation = asyncHandler(async (req, res) => {
    const { participantId } = req.body;

    if (!participantId) {
        return res.status(400).json({
            success: false,
            error: 'Please provide participantId'
        });
    }

    // Check if participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    // Validate doctor-patient relationship
    // Doctors can chat with patients, patients can chat with doctors
    const currentUser = await User.findById(req.user.id);

    if (currentUser.role === 'patient' && participant.role === 'patient') {
        return res.status(403).json({
            success: false,
            error: 'Patients can only chat with doctors'
        });
    }

    if (currentUser.role === 'doctor' && participant.role === 'doctor') {
        return res.status(403).json({
            success: false,
            error: 'Doctors can only chat with patients'
        });
    }

    // Find or create conversation
    const conversation = await Conversation.findOrCreate(req.user.id, participantId);

    await conversation.populate('participants', 'name email role profileImage doctorInfo.specialization');

    res.status(201).json({
        success: true,
        data: conversation
    });
});

// @desc    Get messages for a conversation
// @route   GET /api/chat/conversations/:id/messages
// @access  Private
const getMessages = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit = 50, before } = req.query;

    // Check if conversation exists and user is participant
    const conversation = await Conversation.findById(id);

    if (!conversation) {
        return res.status(404).json({
            success: false,
            error: 'Conversation not found'
        });
    }

    const isParticipant = conversation.participants.some(
        p => p.toString() === req.user.id
    );

    if (!isParticipant) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to access this conversation'
        });
    }

    // Build query
    const query = {
        conversation: id,
        isDeleted: false
    };

    // Pagination: get messages before a certain message ID
    if (before) {
        const beforeMessage = await Message.findById(before);
        if (beforeMessage) {
            query.createdAt = { $lt: beforeMessage.createdAt };
        }
    }

    // Get messages
    const messages = await Message.find(query)
        .populate('sender', 'name email role profileImage')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

    // Reverse to show oldest first
    messages.reverse();

    res.status(200).json({
        success: true,
        count: messages.length,
        data: messages
    });
});

// @desc    Mark messages as read
// @route   PATCH /api/chat/conversations/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if conversation exists and user is participant
    const conversation = await Conversation.findById(id);

    if (!conversation) {
        return res.status(404).json({
            success: false,
            error: 'Conversation not found'
        });
    }

    const isParticipant = conversation.participants.some(
        p => p.toString() === req.user.id
    );

    if (!isParticipant) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to access this conversation'
        });
    }

    // Get all unread messages in this conversation
    const unreadMessages = await Message.find({
        conversation: id,
        sender: { $ne: req.user.id },
        'readBy.user': { $ne: req.user.id }
    });

    // Mark each message as read
    for (const message of unreadMessages) {
        await message.markAsRead(req.user.id);
    }

    // Reset unread count for this user
    await conversation.resetUnread(req.user.id);

    res.status(200).json({
        success: true,
        message: `Marked ${unreadMessages.length} messages as read`
    });
});

// @desc    Search conversations
// @route   GET /api/chat/search
// @access  Private
const searchConversations = asyncHandler(async (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({
            success: false,
            error: 'Please provide a search query'
        });
    }

    // Find users matching the search query
    const users = await User.find({
        $or: [
            { name: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } }
        ],
        _id: { $ne: req.user.id }
    }).select('name email role profileImage');

    // Get conversations with these users
    const conversations = await Conversation.find({
        participants: { $all: [req.user.id] }
    }).populate('participants', 'name email role profileImage');

    // Filter conversations where other participant matches search
    const matchingConversations = conversations.filter(conv => {
        const otherParticipant = conv.participants.find(
            p => p._id.toString() !== req.user.id
        );
        return users.some(u => u._id.toString() === otherParticipant._id.toString());
    });

    res.status(200).json({
        success: true,
        count: matchingConversations.length,
        data: matchingConversations
    });
});

module.exports = {
    getConversations,
    getConversation,
    createConversation,
    getMessages,
    markAsRead,
    searchConversations
};
