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
const { authenticate, requireAdmin, requireAgency } = require('../middleware/auth');
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
  body('note').optional().isString().trim().isLength({ max: 5000 }),
  param('id').isInt().withMessage('Invalid report ID'),
  body('status').isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
];

const updateRules = [
  param('id').isInt().withMessage('Invalid report ID'),
  body('note').optional().isString().trim().isLength({max:5000}),
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
router.post('/:id/events', authenticate, requireAdmin, requireAgency, validate([param('id').isInt({ min: 1 }), body('note').isString().trim().isLength({ min: 1, max: 5000 })]), reportController.addReportNote);
router.get('/:id/events', authenticate, reportController.getReportEvents);
router.put('/:id/priority', authenticate, requireAdmin, requireAgency, validate([param('id').isInt({min:1}),body('priority').isIn(['low','medium','high','critical']),body('note').isString().trim().isLength({min:1,max:5000})]), async (req,res,next)=>{
  const db=require('../config/database');
  try {
    const report=await db.transaction(async()=>{
      const old=(await db.query('SELECT * FROM reports WHERE id=?',[req.params.id]))[0];
      if(!old || old.deleted_at) throw Object.assign(new Error('Active report not found.'),{statusCode:404});
      if(old.priority===req.body.priority) throw Object.assign(new Error('This priority is already saved.'),{statusCode:409});
      const changed=await db.query('UPDATE reports SET priority=?,updated_at=? WHERE id=? AND priority=? AND deleted_at IS NULL',[req.body.priority,new Date().toISOString(),old.id,old.priority]);
      if(!changed.affectedRows) throw Object.assign(new Error('Report changed. Refresh and retry.'),{statusCode:409});
      await require('../models/ReportEvent').create({report_id:old.id,actor_user_id:req.user.id,actor_department:req.user.department,action:'priority_changed',note:`Priority ${old.priority} → ${req.body.priority}: ${req.body.note}`});
      await require('../middleware/auditLog').recordAction(req.user.id,'report_priority_changed','report',old.id,{from:old.priority,to:req.body.priority,note:req.body.note});
      return require('../models/Report').findById(old.id);
    });res.json({success:true,data:report});
  }catch(e){next(e);}
});
router.put('/:id/status', authenticate, requireAgency, validate(statusRules), reportController.updateReportStatus);
router.put('/:id', authenticate, requireAgency, validate(updateRules), reportController.updateReport);
router.put('/:id/restore', authenticate, requireAdmin, requireAgency, reportController.restoreReport);
router.delete('/:id/permanent', authenticate, requireAdmin, (req, res) => res.status(405).json({ success: false, message: 'Permanent deletion is disabled. Archive records instead.' }));
router.delete('/:id', authenticate, requireAdmin, requireAgency, reportController.deleteReport);

// A-14: admins can spin a report into a community post.
router.post(
  '/:id/promote-to-post',
  authenticate,
  requireAdmin,
  require('../controllers/postController').promoteReportToPost
);

module.exports = router;
