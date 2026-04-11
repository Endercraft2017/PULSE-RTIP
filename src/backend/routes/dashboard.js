/**
 * =============================================================================
 * Dashboard Routes
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Route Definitions
 *
 * GET /api/dashboard/stats - Get admin dashboard statistics
 * =============================================================================
 */

const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');

const router = Router();

/* --------------------------------------------------------------------------
 * 2. Route Definitions
 * -------------------------------------------------------------------------- */

router.get('/stats', authenticate, requireAdmin, dashboardController.getStats);

module.exports = router;
