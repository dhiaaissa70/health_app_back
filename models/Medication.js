const mongoose = require('mongoose');

const MedicationSchema = new mongoose.Schema({
    // Patient reference
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Medication details
    name: {
        type: String,
        required: [true, 'Please provide medication name'],
        trim: true,
        maxlength: [100, 'Medication name cannot exceed 100 characters']
    },

    type: {
        type: String,
        enum: ['pill', 'injection', 'solution', 'drops', 'inhaler', 'powder', 'other'],
        required: [true, 'Please select medication type']
    },

    dosage: {
        type: String,
        required: [true, 'Please provide dosage information'],
        trim: true,
        maxlength: [50, 'Dosage cannot exceed 50 characters']
    },

    // Frequency and timing
    frequency: {
        type: String,
        enum: ['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'as_needed', 'custom'],
        required: [true, 'Please select frequency'],
        default: 'once_daily'
    },

    times: {
        type: [String],
        required: [true, 'Please provide at least one time'],
        validate: {
            validator: function (times) {
                return times && times.length > 0;
            },
            message: 'At least one time is required'
        }
    },

    // Additional information
    instructions: {
        type: String,
        trim: true,
        maxlength: [500, 'Instructions cannot exceed 500 characters']
    },

    startDate: {
        type: Date,
        default: Date.now
    },

    endDate: {
        type: Date
    },

    // Status
    isActive: {
        type: Boolean,
        default: true
    },

    reminders: {
        type: Boolean,
        default: true
    },

    // Notes
    notes: {
        type: String,
        trim: true,
        maxlength: [1000, 'Notes cannot exceed 1000 characters']
    }
}, {
    timestamps: true
});

// Index for faster queries
MedicationSchema.index({ patient: 1, isActive: 1 });
MedicationSchema.index({ patient: 1, createdAt: -1 });

// Virtual for checking if medication is expired
MedicationSchema.virtual('isExpired').get(function () {
    if (this.endDate) {
        return new Date() > this.endDate;
    }
    return false;
});

// Method to get formatted times
MedicationSchema.methods.getFormattedTimes = function () {
    return this.times.map(time => {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    });
};

module.exports = mongoose.model('Medication', MedicationSchema);
