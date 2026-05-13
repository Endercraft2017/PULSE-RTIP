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

const VALID_STATUSES = ['submitted', 'pending', 'investigating', 'in_progress', 'pending_confirmation', 'resolved', 'rejected', 'cancelled'];
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

const updateRules = [
  param('id').isInt().withMessage('Invalid report ID'),
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('type').optional().isIn(VALID_TYPES).withMessage(`Type must be one of: ${VALID_TYPES.join(', ')}`),
  body('description').optional({ nullable: true }).trim(),
  body('location').optional({ nullable: true }).trim(),
  body('latitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -180, max: 180 }),
];

/* --------------------------------------------------------------------------
 * 3. Route Definitions
 * -------------------------------------------------------------------------- */

router.get('/', authenticate, reportController.getReports);
router.post(
  '/',
  authenticate,
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'video',  maxCount: 1 },
  ]),
  validate(createRules),
  reportController.createReport
);

// Recycle bin (admin-only). MUST be declared before the /:id catch-alls
// below so Express matches the literal "/bin" segment first instead of
// treating it as a numeric report id.
router.get('/bin', authenticate, requireAdmin, reportController.getBinReports);

router.get('/:id', authenticate, reportController.getReport);
router.get('/:id/events', authenticate, reportController.getReportEvents);
router.put('/:id/status', authenticate, validate(statusRules), reportController.updateReportStatus);
router.put('/:id', authenticate, validate(updateRules), reportController.updateReport);
router.put('/:id/restore', authenticate, requireAdmin, reportController.restoreReport);
router.delete('/:id/permanent', authenticate, requireAdmin, reportController.permanentDeleteReport);
router.delete('/:id', authenticate, requireAdmin, reportController.deleteReport);

// A-14: admins can spin a report into a community post.
router.post(
  '/:id/promote-to-post',
  authenticate,
  requireAdmin,
  require('../controllers/postController').promoteReportToPost
);

module.exports = router;
