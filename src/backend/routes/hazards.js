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
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireAdmin, requireAgency } = require('../middleware/auth');
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
  body('category').optional({ nullable: true })
    .isIn(['hazard', 'announcement']).withMessage("Category must be 'hazard' or 'announcement'"),
  body('audience_type').optional({ nullable: true })
    .isIn(['all', 'barangay']).withMessage("Audience must be 'all' or 'barangay'"),
  body('audience_barangays').optional({ nullable: true })
    .isArray().withMessage('audience_barangays must be an array'),
  body('sound_enabled').optional({ nullable: true })
    .isBoolean().withMessage('sound_enabled must be a boolean'),
];

/* --------------------------------------------------------------------------
 * 3. Route Definitions
 * -------------------------------------------------------------------------- */

router.get('/', authenticate, hazardController.getHazards);

// Recycle bin (admin-only). MUST be declared before the /:id routes below
// so Express matches the literal "/bin" segment instead of treating it as
// a numeric hazard id.
router.get('/bin', authenticate, requireAdmin, hazardController.getBinHazards);

router.get('/:id', authenticate, validate([param('id').isInt({ min: 1 })]), hazardController.getHazard);
router.put('/:id/location', authenticate, requireAdmin, requireAgency, validate([
  param('id').isInt({ min: 1 }),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 }),
  body('note').isString().trim().isLength({ min: 1, max: 5000 }),
]), hazardController.updateHazard);

router.post('/', authenticate, requireAdmin, requireAgency, validate(createRules), hazardController.createHazard);
router.put('/:id', authenticate, requireAdmin, requireAgency, validate(createRules), hazardController.updateHazard);
router.put('/:id/restore', authenticate, requireAdmin, requireAgency, hazardController.restoreHazard);
router.delete('/:id/permanent', authenticate, requireAdmin, (req, res) => res.status(405).json({ success: false, message: 'Permanent deletion is disabled. Archive records instead.' }));
router.delete('/:id', authenticate, requireAdmin, requireAgency, hazardController.deleteHazard);

module.exports = router;
