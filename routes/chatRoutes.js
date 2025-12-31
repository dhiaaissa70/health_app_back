// Chat routes

const express = require('express');
const router = express.Router();
const {
    getConversations,
    getConversation,
    createConversation,
    getMessages,
    markAsRead,
    searchConversations
} = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

// All routes are protected (require authentication)
router.use(protect);

// Conversation routes
router.route('/conversations')
    .get(getConversations)
    .post(createConversation);

router.route('/conversations/:id')
    .get(getConversation);

router.route('/conversations/:id/messages')
    .get(getMessages);

router.patch('/conversations/:id/read', markAsRead);

// Search route
router.get('/search', searchConversations);

module.exports = router;
