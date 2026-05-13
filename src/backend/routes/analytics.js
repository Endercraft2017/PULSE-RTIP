/**
 * =============================================================================
 * Analytics Routes
 * =============================================================================
 * Admin-only. Powers the Reports & Analytics dashboard (A-11).
 * =============================================================================
 */

const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.get('/incidents-over-time', authenticate, requireAdmin, ctrl.getIncidentsOverTime);
router.get('/type-breakdown',      authenticate, requireAdmin, ctrl.getTypeBreakdown);
router.get('/response-time',       authenticate, requireAdmin, ctrl.getResponseTime);
router.get('/location-breakdown',  authenticate, requireAdmin, ctrl.getLocationBreakdown);

module.exports = router;
