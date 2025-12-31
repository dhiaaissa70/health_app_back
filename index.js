// Health App Backend - Entry Point
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const connectDB = require('./config/database');
const { initializeFirebase } = require('./config/firebaseAdmin');
const socketAuth = require('./middleware/socketAuth');
const { setupSocketHandlers } = require('./utils/socketHandlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;

// Connect to database
connectDB();

// Initialize Firebase Admin SDK for push notifications
initializeFirebase();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// Basic route
app.get('/', (req, res) => {
    res.json({
        message: 'Health App Backend API',
        status: 'running',
        version: '1.0.0',
        features: ['REST API', 'Real-time Chat']
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/medications', require('./routes/medicationRoutes'));
app.use('/api/fasting-instructions', require('./routes/fastingInstructionRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
// app.use('/api/example', require('./routes/exampleRoutes')); // Uncomment to use example routes

// Error handler middleware (must be last)
app.use(errorHandler);

// Socket.IO authentication middleware
io.use(socketAuth);

// Setup Socket.IO event handlers
setupSocketHandlers(io);

// Make io accessible to routes
app.set('io', io);

// Start server
server.listen(PORT, () => {
    logger.success(`Health App Backend running on port ${PORT}`);
    logger.info(`REST API available at http://localhost:${PORT}`);
    logger.info(`WebSocket server ready for real-time chat`);
});
