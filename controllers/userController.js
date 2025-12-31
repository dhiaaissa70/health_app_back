// User Management Controller
// Handles user listing, searching, and public profile retrieval

const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get all users with filters and search
// @route   GET /api/users
// @access  Private
const getUsers = asyncHandler(async (req, res) => {
    const { role, search, limit = 50, page = 1 } = req.query;

    const query = { _id: { $ne: req.user.id } }; // Exclude current user

    // Filter by role
    if (role) {
        query.role = role;
    }

    // Search by name or email
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
        .select('name email role profileImage doctorInfo.specialization patientInfo.phoneNumber')
        .limit(parseInt(limit))
        .skip(skip)
        .sort({ name: 1 });

    const total = await User.countDocuments(query);

    res.status(200).json({
        success: true,
        count: users.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        data: users
    });
});

// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
        .select('name email role profileImage doctorInfo patientInfo isActive');

    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    res.status(200).json({
        success: true,
        data: user
    });
});

module.exports = {
    getUsers,
    getUserById
};
