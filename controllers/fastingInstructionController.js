// Fasting Instruction controller - handles pre-operative fasting instruction management

const FastingInstruction = require('../models/FastingInstruction');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Add new fasting instruction
// @route   POST /api/fasting-instructions
// @access  Private (Doctor/Admin only)
const addFastingInstruction = asyncHandler(async (req, res) => {
    const {
        patient,
        operationDate,
        operationType,
        extraFastingRules,
        hygieneInstructions,
        administrativeInstructions,
        medicalExceptions,
        personalNotes,
        doctorNotes
    } = req.body;

    // Check if user is doctor or admin
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Only doctors and administrators can create fasting instructions'
        });
    }

    // Create fasting instruction
    const fastingInstruction = await FastingInstruction.create({
        patient,
        doctor: req.user.id,
        operationDate,
        operationType,
        extraFastingRules: extraFastingRules || [],
        hygieneInstructions: hygieneInstructions || [],
        administrativeInstructions: administrativeInstructions || [],
        medicalExceptions: medicalExceptions || [],
        personalNotes: personalNotes || [],
        doctorNotes
    });

    // Populate patient and doctor information
    await fastingInstruction.populate('patient', 'name email');
    await fastingInstruction.populate('doctor', 'name email doctorInfo.specialization');

    res.status(201).json({
        success: true,
        data: fastingInstruction
    });
});

// @desc    Get all fasting instructions (role-based)
// @route   GET /api/fasting-instructions
// @access  Private
const getFastingInstructions = asyncHandler(async (req, res) => {
    let filter = {};

    // Patients can only see their own instructions
    if (req.user.role === 'patient') {
        filter.patient = req.user.id;
    } else if (req.query.patientId) {
        // Doctors/Admins can optionally filter by patientId
        filter.patient = req.query.patientId;
    }

    // Optional: filter by active status
    if (req.query.active !== undefined) {
        filter.isActive = req.query.active === 'true';
    }

    // Optional: filter by upcoming operations
    if (req.query.upcoming === 'true') {
        filter.operationDate = { $gte: new Date() };
    }

    const fastingInstructions = await FastingInstruction.find(filter)
        .populate('patient', 'name email patientInfo.phoneNumber')
        .populate('doctor', 'name email doctorInfo.specialization')
        .sort({ operationDate: 1 });

    res.status(200).json({
        success: true,
        count: fastingInstructions.length,
        data: fastingInstructions
    });
});

// @desc    Get single fasting instruction
// @route   GET /api/fasting-instructions/:id
// @access  Private
const getFastingInstruction = asyncHandler(async (req, res) => {
    const fastingInstruction = await FastingInstruction.findById(req.params.id)
        .populate('patient', 'name email patientInfo')
        .populate('doctor', 'name email doctorInfo');

    if (!fastingInstruction) {
        return res.status(404).json({
            success: false,
            error: 'Fasting instruction not found'
        });
    }

    // Check authorization
    // Patients can only view their own instructions
    if (req.user.role === 'patient' && fastingInstruction.patient._id.toString() !== req.user.id) {
        return res.status(403).json({
            success: false,
            error: 'Not authorized to access this fasting instruction'
        });
    }

    res.status(200).json({
        success: true,
        data: fastingInstruction
    });
});

// @desc    Update fasting instruction
// @route   PUT /api/fasting-instructions/:id
// @access  Private (Doctor/Admin only)
const updateFastingInstruction = asyncHandler(async (req, res) => {
    // Check if user is doctor or admin
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Only doctors and administrators can update fasting instructions'
        });
    }

    let fastingInstruction = await FastingInstruction.findById(req.params.id);

    if (!fastingInstruction) {
        return res.status(404).json({
            success: false,
            error: 'Fasting instruction not found'
        });
    }

    // Update the instruction
    fastingInstruction = await FastingInstruction.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    ).populate('patient', 'name email')
        .populate('doctor', 'name email doctorInfo.specialization');

    res.status(200).json({
        success: true,
        data: fastingInstruction
    });
});

// @desc    Delete fasting instruction
// @route   DELETE /api/fasting-instructions/:id
// @access  Private (Doctor/Admin only)
const deleteFastingInstruction = asyncHandler(async (req, res) => {
    // Check if user is doctor or admin
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Only doctors and administrators can delete fasting instructions'
        });
    }

    const fastingInstruction = await FastingInstruction.findById(req.params.id);

    if (!fastingInstruction) {
        return res.status(404).json({
            success: false,
            error: 'Fasting instruction not found'
        });
    }

    await fastingInstruction.deleteOne();

    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Get fasting instructions for a specific patient
// @route   GET /api/fasting-instructions/patient/:patientId
// @access  Private (Doctor/Admin only)
const getPatientFastingInstructions = asyncHandler(async (req, res) => {
    // Check if user is doctor or admin
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Only doctors and administrators can view patient fasting instructions'
        });
    }

    const fastingInstructions = await FastingInstruction.find({
        patient: req.params.patientId
    })
        .populate('patient', 'name email patientInfo')
        .populate('doctor', 'name email doctorInfo.specialization')
        .sort({ operationDate: -1 });

    res.status(200).json({
        success: true,
        count: fastingInstructions.length,
        data: fastingInstructions
    });
});

// @desc    Toggle fasting instruction active status
// @route   PATCH /api/fasting-instructions/:id/toggle
// @access  Private (Doctor/Admin only)
const toggleFastingInstructionStatus = asyncHandler(async (req, res) => {
    // Check if user is doctor or admin
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Only doctors and administrators can toggle fasting instruction status'
        });
    }

    let fastingInstruction = await FastingInstruction.findById(req.params.id);

    if (!fastingInstruction) {
        return res.status(404).json({
            success: false,
            error: 'Fasting instruction not found'
        });
    }

    fastingInstruction.isActive = !fastingInstruction.isActive;
    await fastingInstruction.save();

    res.status(200).json({
        success: true,
        data: fastingInstruction
    });
});

// @desc    Update patient's personal notes
// @route   PATCH /api/fasting-instructions/:id/personal-notes
// @access  Private (Patient only - for their own instructions)
const updatePatientPersonalNotes = asyncHandler(async (req, res) => {
    const { personalNotes } = req.body;

    // Validate that personalNotes is provided and is an array
    if (!personalNotes || !Array.isArray(personalNotes)) {
        return res.status(400).json({
            success: false,
            error: 'Personal notes must be provided as an array'
        });
    }

    let fastingInstruction = await FastingInstruction.findById(req.params.id);

    if (!fastingInstruction) {
        return res.status(404).json({
            success: false,
            error: 'Fasting instruction not found'
        });
    }

    // Check if patient is updating their own instruction
    if (req.user.role === 'patient' && fastingInstruction.patient.toString() !== req.user.id) {
        return res.status(403).json({
            success: false,
            error: 'You can only update your own fasting instructions'
        });
    }

    // Update only the personal notes field
    fastingInstruction.personalNotes = personalNotes;
    await fastingInstruction.save();

    // Populate and return updated instruction
    await fastingInstruction.populate('patient', 'name email');
    await fastingInstruction.populate('doctor', 'name email doctorInfo.specialization');

    res.status(200).json({
        success: true,
        data: fastingInstruction
    });
});

module.exports = {
    addFastingInstruction,
    getFastingInstructions,
    getFastingInstruction,
    updateFastingInstruction,
    deleteFastingInstruction,
    getPatientFastingInstructions,
    toggleFastingInstructionStatus,
    updatePatientPersonalNotes
};
