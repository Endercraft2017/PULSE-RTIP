/**
 * =============================================================================
 * Report Routes
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Validation Rules
 * 3. Route Definitions
 *
 * GET    /api/reports          - List reports (filtered)
 * POST   /api/reports          - Create a new report
 * GET    /api/reports/:id      - Get a single report
 * PUT    /api/reports/:id/status - Update report status (admin)
 * =============================================================================
 */

const { Router } = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');
const reportController = require('../controllers/reportController');
const { upload } = require('../controllers/mediaController');

const router = Router();

/* --------------------------------------------------------------------------
 * 2. Validation Rules
 * -------------------------------------------------------------------------- */

const VALID_STATUSES = ['submitted', 'pending', 'under-review', 'investigating', 'resolved'];
const VALID_TYPES = ['Flood', 'Fire', 'Infrastructure Damage', 'Earthquake', 'Landslide', 'Typhoon', 'Others'];

const createRules = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('type').isIn(VALID_TYPES).withMessage(`Type must be one of: ${VALID_TYPES.join(', ')}`),
  body('description').optional().trim(),
  body('location').optional().trim(),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
];

const statusRules = [
  param('id').isInt().withMessage('Invalid report ID'),
  body('status').isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
];

/* --------------------------------------------------------------------------
 * 3. Route Definitions
 * -------------------------------------------------------------------------- */

router.get('/', authenticate, reportController.getReports);
router.post('/', authenticate, upload.array('images', 5), validate(createRules), reportController.createReport);
router.get('/:id', authenticate, reportController.getReport);
router.put('/:id/status', authenticate, requireAdmin, validate(statusRules), reportController.updateReportStatus);

module.exports = router;
