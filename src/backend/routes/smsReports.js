/**
 * =============================================================================
 * SMS Report Routes
 * =============================================================================
 *
 * GET  /api/sms-reports              - List all SMS reports (admin)
 * POST /api/sms-reports/:id/convert  - Convert to incident report (admin)
 * POST /api/sms-reports/:id/dismiss  - Dismiss an SMS report (admin)
 * =============================================================================
 */

const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const smsReportController = require('../controllers/smsReportController');

const router = Router();

router.get('/', authenticate, requireAdmin, smsReportController.list);
router.post('/:id/convert', authenticate, requireAdmin, smsReportController.convert);
router.post('/:id/dismiss', authenticate, requireAdmin, smsReportController.dismiss);

module.exports = router;
