// Fasting Instruction routes

const express = require('express');
const router = express.Router();
const {
    addFastingInstruction,
    getFastingInstructions,
    getFastingInstruction,
    updateFastingInstruction,
    deleteFastingInstruction,
    getPatientFastingInstructions,
    toggleFastingInstructionStatus,
    updatePatientPersonalNotes
} = require('../controllers/fastingInstructionController');
const { protect } = require('../middleware/auth');

// All routes are protected (require authentication)
router.use(protect);

// Main routes
router.route('/')
    .get(getFastingInstructions)
    .post(addFastingInstruction);

// Specific routes (must come before /:id to avoid conflicts)
router.get('/patient/:patientId', getPatientFastingInstructions);

router.route('/:id')
    .get(getFastingInstruction)
    .put(updateFastingInstruction)
    .delete(deleteFastingInstruction);

// Additional routes
router.patch('/:id/toggle', toggleFastingInstructionStatus);
router.patch('/:id/personal-notes', updatePatientPersonalNotes);

module.exports = router;
