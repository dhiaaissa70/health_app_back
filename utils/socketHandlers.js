// Socket.IO event handlers for real-time chat

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// Store online users
const onlineUsers = new Map();

const setupSocketHandlers = (io) => {
    io.on('connection', (socket) => {
        const userId = socket.user.id;
        console.log(`✅ User connected: ${socket.user.name} (${userId})`);

        // Add user to online users
        onlineUsers.set(userId, socket.id);

        // Notify others that user is online
        socket.broadcast.emit('user_online', {
            userId,
            name: socket.user.name
        });

        // Join user's personal room
        socket.join(`user:${userId}`);

        // Join user's conversation rooms
        joinUserConversations(socket, userId);

        // Handle joining a specific conversation
        socket.on('join_conversation', async (data) => {
            try {
                const { conversationId } = data;

                // Verify user is participant
                const conversation = await Conversation.findById(conversationId);
                if (!conversation) {
                    socket.emit('error', { message: 'Conversation not found' });
                    return;
                }

                const isParticipant = conversation.participants.some(
                    p => p.toString() === userId
                );

                if (!isParticipant) {
                    socket.emit('error', { message: 'Not authorized' });
                    return;
                }

                socket.join(`conversation:${conversationId}`);
                console.log(`User ${userId} joined conversation ${conversationId}`);
            } catch (error) {
                console.error('Error joining conversation:', error);
                socket.emit('error', { message: 'Failed to join conversation' });
            }
        });

        // Handle sending a message
        socket.on('send_message', async (data) => {
            try {
                const { conversationId, content, messageType = 'text' } = data;

                // Verify conversation exists and user is participant
                const conversation = await Conversation.findById(conversationId);
                if (!conversation) {
                    socket.emit('error', { message: 'Conversation not found' });
                    return;
                }

                const isParticipant = conversation.participants.some(
                    p => p.toString() === userId
                );

                if (!isParticipant) {
                    socket.emit('error', { message: 'Not authorized' });
                    return;
                }

                // Create message
                const message = await Message.create({
                    conversation: conversationId,
                    sender: userId,
                    content,
                    messageType
                });

                // Populate sender info
                await message.populate('sender', 'name email role profileImage');

                // Increment unread count for other participants
                const otherParticipants = conversation.participants.filter(
                    p => p.toString() !== userId
                );

                for (const participantId of otherParticipants) {
                    await conversation.incrementUnread(participantId);
                }

                // Emit message to conversation room
                io.to(`conversation:${conversationId}`).emit('new_message', {
                    message,
                    conversationId
                });

                // Send delivery confirmation to sender
                socket.emit('message_sent', {
                    tempId: data.tempId, // Client-side temporary ID
                    message
                });

                // Mark as delivered to online recipients
                for (const participantId of otherParticipants) {
                    const participantSocketId = onlineUsers.get(participantId.toString());
                    if (participantSocketId) {
                        await message.markAsDelivered(participantId);
                        io.to(participantSocketId).emit('message_delivered', {
                            messageId: message._id,
                            conversationId
                        });
                    }
                }

            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Handle message read event
        socket.on('message_read', async (data) => {
            try {
                const { messageId, conversationId } = data;

                const message = await Message.findById(messageId);
                if (!message) {
                    return;
                }

                // Mark message as read
                await message.markAsRead(userId);

                // Notify sender
                const senderSocketId = onlineUsers.get(message.sender.toString());
                if (senderSocketId) {
                    io.to(senderSocketId).emit('message_read_receipt', {
                        messageId,
                        conversationId,
                        readBy: userId,
                        readAt: new Date()
                    });
                }

            } catch (error) {
                console.error('Error marking message as read:', error);
            }
        });

        // Handle typing indicator
        socket.on('typing_start', async (data) => {
            try {
                const { conversationId } = data;

                // Verify user is participant
                const conversation = await Conversation.findById(conversationId);
                if (!conversation) return;

                const isParticipant = conversation.participants.some(
                    p => p.toString() === userId
                );

                if (!isParticipant) return;

                // Notify other participants
                socket.to(`conversation:${conversationId}`).emit('user_typing', {
                    conversationId,
                    userId,
                    name: socket.user.name
                });

            } catch (error) {
                console.error('Error handling typing start:', error);
            }
        });

        // Handle stop typing
        socket.on('typing_stop', async (data) => {
            try {
                const { conversationId } = data;

                socket.to(`conversation:${conversationId}`).emit('user_stop_typing', {
                    conversationId,
                    userId
                });

            } catch (error) {
                console.error('Error handling typing stop:', error);
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`❌ User disconnected: ${socket.user.name} (${userId})`);

            // Remove from online users
            onlineUsers.delete(userId);

            // Notify others that user is offline
            socket.broadcast.emit('user_offline', {
                userId,
                name: socket.user.name
            });
        });
    });
};

// Helper function to join user's conversation rooms
async function joinUserConversations(socket, userId) {
    try {
        const conversations = await Conversation.find({
            participants: userId,
            isActive: true
        });

        conversations.forEach(conversation => {
            socket.join(`conversation:${conversation._id}`);
        });

        console.log(`User ${userId} joined ${conversations.length} conversation rooms`);
    } catch (error) {
        console.error('Error joining user conversations:', error);
    }
}

// Get online status
const getOnlineUsers = () => {
    return Array.from(onlineUsers.keys());
};

// Check if user is online
const isUserOnline = (userId) => {
    return onlineUsers.has(userId);
};

module.exports = {
    setupSocketHandlers,
    getOnlineUsers,
    isUserOnline
};
