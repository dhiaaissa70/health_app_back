const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const UserSchema = new mongoose.Schema({
    // Basic Information
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // Don't return password by default
    },

    // Role Management
    role: {
        type: String,
        enum: ['patient', 'doctor', 'admin'],
        default: 'patient',
        required: true
    },

    // Patient-specific fields
    patientInfo: {
        dateOfBirth: Date,
        phoneNumber: String,
        address: String,
        medicalHistory: [String],
        allergies: [String],
        currentMedications: [String],
        emergencyContact: {
            name: String,
            relationship: String,
            phoneNumber: String
        }
    },

    // Doctor-specific fields
    doctorInfo: {
        specialization: {
            type: String,
            enum: ['anesthesiologist', 'surgeon', 'general_practitioner', 'other']
        },
        licenseNumber: String,
        department: String,
        yearsOfExperience: Number,
        availableHours: {
            start: String,
            end: String
        }
    },

    // Admin-specific fields
    adminInfo: {
        accessLevel: {
            type: String,
            enum: ['super_admin', 'moderator', 'support'],
            default: 'support'
        },
        permissions: [String]
    },

    // Common fields
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    profileImage: {
        type: String,
        default: ''
    },

    // FCM tokens for push notifications (array to support multiple devices)
    fcmTokens: [{
        token: {
            type: String,
            required: true
        },
        deviceId: String,
        platform: {
            type: String,
            enum: ['ios', 'android', 'web']
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Notification preferences
    notificationPreferences: {
        medicationReminders: {
            type: Boolean,
            default: true
        },
        fastingReminders: {
            type: Boolean,
            default: true
        },
        appointmentReminders: {
            type: Boolean,
            default: true
        },
        chatMessages: {
            type: Boolean,
            default: true
        },
        reminderMinutesBefore: {
            type: Number,
            default: 15,
            min: 0,
            max: 120
        },
        quietHoursEnabled: {
            type: Boolean,
            default: false
        },
        quietHoursStart: {
            type: String,
            default: '22:00'
        },
        quietHoursEnd: {
            type: String,
            default: '08:00'
        }
    },

    lastLogin: {
        type: Date
    }
}, {
    timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
    // Only hash if password is modified
    if (!this.isModified('password')) {
        return next();
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile (without sensitive data)
UserSchema.methods.getPublicProfile = function () {
    const user = this.toObject();
    delete user.password;
    return user;
};

module.exports = mongoose.model('User', UserSchema);
