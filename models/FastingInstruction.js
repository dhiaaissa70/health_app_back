const mongoose = require('mongoose');

const FastingInstructionSchema = new mongoose.Schema({
    // Patient reference
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Patient reference is required']
    },

    // Doctor/Anesthesiologist who created the instruction
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Doctor reference is required']
    },

    // Operation details
    operationDate: {
        type: Date,
        required: [true, 'Operation date is required']
    },

    operationType: {
        type: String,
        trim: true,
        maxlength: [200, 'Operation type cannot exceed 200 characters']
    },

    // Extra fasting rules
    extraFastingRules: [{
        type: String,
        trim: true,
        maxlength: [500, 'Fasting rule cannot exceed 500 characters']
    }],

    // Hygiene instructions
    hygieneInstructions: [{
        type: String,
        trim: true,
        maxlength: [500, 'Hygiene instruction cannot exceed 500 characters']
    }],

    // Administrative instructions
    administrativeInstructions: [{
        type: String,
        trim: true,
        maxlength: [500, 'Administrative instruction cannot exceed 500 characters']
    }],

    // Medical exceptions (medications allowed, special conditions)
    medicalExceptions: [{
        type: String,
        trim: true,
        maxlength: [500, 'Medical exception cannot exceed 500 characters']
    }],

    // Personal notes and reminders
    personalNotes: [{
        type: String,
        trim: true,
        maxlength: [500, 'Personal note cannot exceed 500 characters']
    }],

    // Status
    isActive: {
        type: Boolean,
        default: true
    },

    // Additional notes from doctor
    doctorNotes: {
        type: String,
        trim: true,
        maxlength: [1000, 'Doctor notes cannot exceed 1000 characters']
    }
}, {
    timestamps: true
});

// Index for faster queries
FastingInstructionSchema.index({ patient: 1, isActive: 1 });
FastingInstructionSchema.index({ patient: 1, operationDate: -1 });
FastingInstructionSchema.index({ doctor: 1, createdAt: -1 });

// Virtual for checking if operation is upcoming
FastingInstructionSchema.virtual('isUpcoming').get(function () {
    return this.operationDate > new Date();
});

// Virtual for checking if operation is today
FastingInstructionSchema.virtual('isToday').get(function () {
    const today = new Date();
    const opDate = new Date(this.operationDate);
    return today.toDateString() === opDate.toDateString();
});

// Method to get days until operation
FastingInstructionSchema.methods.getDaysUntilOperation = function () {
    const today = new Date();
    const opDate = new Date(this.operationDate);
    const diffTime = opDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

// Method to check if instruction is complete
FastingInstructionSchema.methods.isComplete = function () {
    return (
        this.extraFastingRules.length > 0 ||
        this.hygieneInstructions.length > 0 ||
        this.administrativeInstructions.length > 0 ||
        this.medicalExceptions.length > 0 ||
        this.personalNotes.length > 0
    );
};

module.exports = mongoose.model('FastingInstruction', FastingInstructionSchema);
