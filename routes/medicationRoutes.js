// Medication routes

const express = require('express');
const router = express.Router();
const {
    addMedication,
    getMedications,
    getMedication,
    updateMedication,
    deleteMedication,
    toggleMedicationStatus,
    getMedicationsByType
} = require('../controllers/medicationController');
const { protect } = require('../middleware/auth');

// All routes are protected (require authentication)
router.use(protect);

// Main routes
router.route('/')
    .get(getMedications)
    .post(addMedication);

router.route('/:id')
    .get(getMedication)
    .put(updateMedication)
    .delete(deleteMedication);

// Additional routes
router.patch('/:id/toggle', toggleMedicationStatus);
router.get('/type/:type', getMedicationsByType);

module.exports = router;
