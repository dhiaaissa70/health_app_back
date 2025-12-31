// Firebase Admin SDK Configuration
// This file initializes Firebase Admin for sending push notifications

const admin = require('firebase-admin');
const path = require('path');
const logger = require('../utils/logger');

let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK
 * Requires FIREBASE_SERVICE_ACCOUNT_PATH environment variable
 */
const initializeFirebase = () => {
    if (firebaseInitialized) {
        return;
    }

    try {
        let serviceAccount;

        // 1. Check for JSON string in environment variables (Recommended for Render/Cloud)
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            try {
                serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
                logger.info('Initializing Firebase using FIREBASE_SERVICE_ACCOUNT_JSON environment variable');
            } catch (parseError) {
                logger.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT_JSON:', parseError.message);
            }
        }

        // 2. Fallback to file path if JSON string is not available or failed to parse
        if (!serviceAccount) {
            const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

            if (!envPath) {
                logger.warn('⚠️  Firebase credentials not found. Push notifications will be disabled.');
                logger.info('To fix this on Render:');
                logger.info('1. Copy the contents of your firebase-service-account.json');
                logger.info('2. Add an environment variable named FIREBASE_SERVICE_ACCOUNT_JSON');
                logger.info('3. Paste the file content as the value');
                return;
            }

            // Resolve path relative to project root (CWD)
            const serviceAccountPath = path.isAbsolute(envPath)
                ? envPath
                : path.resolve(process.cwd(), envPath);

            serviceAccount = require(serviceAccountPath);
        }

        // Initialize Firebase Admin with the credentials found
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        firebaseInitialized = true;
        logger.success('✅ Firebase Admin SDK initialized successfully');
    } catch (error) {
        logger.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
        logger.warn('Push notifications will be disabled');
    }
};

/**
 * Check if Firebase is initialized
 */
const isFirebaseInitialized = () => {
    return firebaseInitialized;
};

/**
 * Send notification to a single device
 * @param {string} token - FCM device token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload
 * @returns {Promise<string>} - Message ID if successful
 */
const sendNotification = async (token, title, body, data = {}) => {
    if (!firebaseInitialized) {
        throw new Error('Firebase Admin SDK is not initialized');
    }

    try {
        const message = {
            notification: {
                title,
                body
            },
            data: {
                ...data,
                // Convert all data values to strings (FCM requirement)
                clickAction: 'FLUTTER_NOTIFICATION_CLICK'
            },
            token
        };

        const response = await admin.messaging().send(message);
        logger.info(`✅ Notification sent successfully. Message ID: ${response}`);
        return response;
    } catch (error) {
        logger.error('❌ Error sending notification:', error.message);
        throw error;
    }
};

/**
 * Send notification to multiple devices
 * @param {string[]} tokens - Array of FCM device tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload
 * @returns {Promise<object>} - Success and failure counts
 */
const sendMulticastNotification = async (tokens, title, body, data = {}) => {
    if (!firebaseInitialized) {
        throw new Error('Firebase Admin SDK is not initialized');
    }

    if (!tokens || tokens.length === 0) {
        throw new Error('No tokens provided');
    }

    try {
        const message = {
            notification: {
                title,
                body
            },
            data: {
                ...data,
                clickAction: 'FLUTTER_NOTIFICATION_CLICK'
            },
            tokens
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        logger.info(`✅ Multicast notification sent: ${response.successCount} successful, ${response.failureCount} failed`);

        // Log failed tokens for debugging
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    logger.warn(`Failed to send to token ${idx}: ${resp.error.message}`);
                }
            });
        }

        return {
            successCount: response.successCount,
            failureCount: response.failureCount,
            responses: response.responses
        };
    } catch (error) {
        logger.error('❌ Error sending multicast notification:', error.message);
        throw error;
    }
};

/**
 * Send notification with custom options
 * @param {object} options - Notification options
 * @returns {Promise<string>} - Message ID if successful
 */
const sendCustomNotification = async (options) => {
    if (!firebaseInitialized) {
        throw new Error('Firebase Admin SDK is not initialized');
    }

    try {
        const response = await admin.messaging().send(options);
        logger.info(`✅ Custom notification sent successfully. Message ID: ${response}`);
        return response;
    } catch (error) {
        logger.error('❌ Error sending custom notification:', error.message);
        throw error;
    }
};

/**
 * Validate FCM token
 * @param {string} token - FCM device token
 * @returns {Promise<boolean>} - True if valid
 */
const validateToken = async (token) => {
    if (!firebaseInitialized) {
        return false;
    }

    try {
        // Try to send a dry run message
        await admin.messaging().send({
            token,
            data: { test: 'true' }
        }, true); // dry run mode
        return true;
    } catch (error) {
        logger.warn(`Invalid FCM token: ${error.message}`);
        return false;
    }
};

module.exports = {
    initializeFirebase,
    isFirebaseInitialized,
    sendNotification,
    sendMulticastNotification,
    sendCustomNotification,
    validateToken
};
