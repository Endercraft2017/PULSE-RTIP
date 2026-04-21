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
  body('location').optional({ nullable: true, checkFalsy: true }).trim(),
  body('description').optional({ nullable: true, checkFalsy: true }).trim(),
  body('latitude').optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude').optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
];

/* --------------------------------------------------------------------------
 * 3. Route Definitions
 * -------------------------------------------------------------------------- */

router.get('/', authenticate, hazardController.getHazards);
router.post('/', authenticate, requireAdmin, validate(createRules), hazardController.createHazard);

module.exports = router;
