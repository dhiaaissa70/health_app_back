// Authentication middleware with JWT verification and role-based access control

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// Protect routes - verify JWT token
const protect = asyncHandler(async (req, res, next) => {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Not authorized to access this route'
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from token (excluding password)
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if user is active
        if (!req.user.isActive) {
            return res.status(401).json({
                success: false,
                error: 'User account is deactivated'
            });
        }

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Not authorized to access this route'
        });
    }
});

// Role-based access control
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `User role '${req.user.role}' is not authorized to access this route`
            });
        }
        next();
    };
};

// Check if user is a patient
const isPatient = authorize('patient');

// Check if user is a doctor
const isDoctor = authorize('doctor');

// Check if user is an admin
const isAdmin = authorize('admin');

// Check if user is doctor or admin
const isDoctorOrAdmin = authorize('doctor', 'admin');

module.exports = {
    protect,
    authorize,
    isPatient,
    isDoctor,
    isAdmin,
    isDoctorOrAdmin
};
