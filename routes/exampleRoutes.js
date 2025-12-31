// Example routes

const express = require('express');
const router = express.Router();
const { getItems, createItem } = require('../controllers/exampleController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/', getItems);

// Protected routes
router.post('/', protect, createItem);

module.exports = router;
