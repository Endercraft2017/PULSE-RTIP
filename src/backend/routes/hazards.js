/**
 * =============================================================================
 * Hazard Routes
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Validation Rules
 * 3. Route Definitions
 *
 * GET  /api/hazards - List all hazard alerts
 * POST /api/hazards - Create a hazard alert (admin only)
 * =============================================================================
 */

const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');
const hazardController = require('../controllers/hazardController');

const router = Router();

/* --------------------------------------------------------------------------
 * 2. Validation Rules
 * -------------------------------------------------------------------------- */

const createRules = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('severity').isIn(['high', 'medium', 'low']).withMessage('Severity must be high, medium, or low'),
  body('location').optional().trim(),
  body('description').optional().trim(),
];

/* --------------------------------------------------------------------------
 * 3. Route Definitions
 * -------------------------------------------------------------------------- */

router.get('/', authenticate, hazardController.getHazards);
router.post('/', authenticate, requireAdmin, validate(createRules), hazardController.createHazard);

module.exports = router;
