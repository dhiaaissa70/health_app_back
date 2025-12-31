// Medication controller - handles medication management

const Medication = require('../models/Medication');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Add new medication
// @route   POST /api/medications
// @access  Private (Patient only)
const addMedication = asyncHandler(async (req, res) => {
    const { name, type, dosage, frequency, times, instructions, startDate, endDate, reminders, notes } = req.body;

    // Create medication with patient reference
    const medication = await Medication.create({
        patient: req.user.id,
        name,
        type,
        dosage,
        frequency,
        times,
        instructions,
        startDate,
        endDate,
        reminders,
        notes
    });

    res.status(201).json({
        success: true,
        data: medication
    });
});

// @desc    Get all medications for logged in user
// @route   GET /api/medications
// @access  Private
const getMedications = asyncHandler(async (req, res) => {
    // Filter options
    const filter = { patient: req.user.id };

    // Optional: filter by active status
    if (req.query.active !== undefined) {
        filter.isActive = req.query.active === 'true';
    }

    const medications = await Medication.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: medications.length,
        data: medications
    });
});

// @desc    Get single medication
// @route   GET /api/medications/:id
// @access  Private
const getMedication = asyncHandler(async (req, res) => {
    const medication = await Medication.findById(req.params.id);

    if (!medication) {
        return res.status(404).json({
            success: false,
            error: 'Medication not found'
        });
    }

    // Make sure user owns the medication
    if (medication.patient.toString() !== req.user.id) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to access this medication'
        });
    }

    res.status(200).json({
        success: true,
        data: medication
    });
});

// @desc    Update medication
// @route   PUT /api/medications/:id
// @access  Private
const updateMedication = asyncHandler(async (req, res) => {
    let medication = await Medication.findById(req.params.id);

    if (!medication) {
        return res.status(404).json({
            success: false,
            error: 'Medication not found'
        });
    }

    // Make sure user owns the medication
    if (medication.patient.toString() !== req.user.id) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to update this medication'
        });
    }

    medication = await Medication.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    );

    res.status(200).json({
        success: true,
        data: medication
    });
});

// @desc    Delete medication
// @route   DELETE /api/medications/:id
// @access  Private
const deleteMedication = asyncHandler(async (req, res) => {
    const medication = await Medication.findById(req.params.id);

    if (!medication) {
        return res.status(404).json({
            success: false,
            error: 'Medication not found'
        });
    }

    // Make sure user owns the medication
    if (medication.patient.toString() !== req.user.id) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to delete this medication'
        });
    }

    await medication.deleteOne();

    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Toggle medication active status
// @route   PATCH /api/medications/:id/toggle
// @access  Private
const toggleMedicationStatus = asyncHandler(async (req, res) => {
    let medication = await Medication.findById(req.params.id);

    if (!medication) {
        return res.status(404).json({
            success: false,
            error: 'Medication not found'
        });
    }

    // Make sure user owns the medication
    if (medication.patient.toString() !== req.user.id) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to update this medication'
        });
    }

    medication.isActive = !medication.isActive;
    await medication.save();

    res.status(200).json({
        success: true,
        data: medication
    });
});

// @desc    Get medications by type
// @route   GET /api/medications/type/:type
// @access  Private
const getMedicationsByType = asyncHandler(async (req, res) => {
    const medications = await Medication.find({
        patient: req.user.id,
        type: req.params.type,
        isActive: true
    }).sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: medications.length,
        data: medications
    });
});

module.exports = {
    addMedication,
    getMedications,
    getMedication,
    updateMedication,
    deleteMedication,
    toggleMedicationStatus,
    getMedicationsByType
};
