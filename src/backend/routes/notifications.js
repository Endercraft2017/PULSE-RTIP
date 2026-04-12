/**
 * =============================================================================
 * Notification Routes
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Route Definitions
 *
 * GET /api/notifications - List notifications for current user
 * =============================================================================
 */

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

const router = Router();

/* --------------------------------------------------------------------------
 * 2. Route Definitions
 * -------------------------------------------------------------------------- */

router.get('/', authenticate, notificationController.getNotifications);
router.put('/read', authenticate, notificationController.markAllRead);

module.exports = router;
