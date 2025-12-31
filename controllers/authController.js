// Authentication controller - handles user registration and login

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
    const { name, email, password, role, patientInfo, doctorInfo, adminInfo } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
        return res.status(400).json({
            success: false,
            error: 'User already exists with this email'
        });
    }

    // Create user object
    const userData = {
        name,
        email,
        password,
        role: role || 'patient'
    };

    // Add role-specific information
    if (role === 'patient' && patientInfo) {
        userData.patientInfo = patientInfo;
    } else if (role === 'doctor' && doctorInfo) {
        userData.doctorInfo = doctorInfo;
    } else if (role === 'admin' && adminInfo) {
        userData.adminInfo = adminInfo;
    }

    // Create user
    const user = await User.create(userData);

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
        success: true,
        data: {
            user: user.getPublicProfile(),
            token
        }
    });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Please provide email and password'
        });
    }

    // Check for user (include password for comparison)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        return res.status(401).json({
            success: false,
            error: 'Invalid credentials'
        });
    }

    // Check if user is active
    if (!user.isActive) {
        return res.status(401).json({
            success: false,
            error: 'Account is deactivated. Please contact support.'
        });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
        return res.status(401).json({
            success: false,
            error: 'Invalid credentials'
        });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
        success: true,
        data: {
            user: user.getPublicProfile(),
            token
        }
    });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    res.status(200).json({
        success: true,
        data: user
    });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
    const fieldsToUpdate = {
        name: req.body.name,
        email: req.body.email,
        profileImage: req.body.profileImage
    };

    // Update role-specific fields
    if (req.user.role === 'patient' && req.body.patientInfo) {
        fieldsToUpdate.patientInfo = req.body.patientInfo;
    } else if (req.user.role === 'doctor' && req.body.doctorInfo) {
        fieldsToUpdate.doctorInfo = req.body.doctorInfo;
    } else if (req.user.role === 'admin' && req.body.adminInfo) {
        fieldsToUpdate.adminInfo = req.body.adminInfo;
    }

    const user = await User.findByIdAndUpdate(
        req.user.id,
        fieldsToUpdate,
        {
            new: true,
            runValidators: true
        }
    );

    res.status(200).json({
        success: true,
        data: user
    });
});

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
const updatePassword = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.comparePassword(req.body.currentPassword))) {
        return res.status(401).json({
            success: false,
            error: 'Current password is incorrect'
        });
    }

    user.password = req.body.newPassword;
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
        success: true,
        data: {
            token
        }
    });
});

module.exports = {
    register,
    login,
    getMe,
    updateProfile,
    updatePassword
};
