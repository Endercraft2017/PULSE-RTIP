/**
 * =============================================================================
 * Central Route Index
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Route Mounting
 * 3. Health Check
 *
 * Mounts all API sub-routers under their respective prefixes.
 *
 * /api/auth          - Authentication (login, register)
 * /api/users         - User profile management
 * /api/reports       - Incident report CRUD
 * /api/hazards       - Hazard alert management
 * /api/notifications - User notifications
 * /api/dashboard     - Admin dashboard statistics
 * /api/media         - Media file uploads
 * /api/hotlines      - Emergency hotlines
 * /api/sms           - SMS gateway (TextBee)
 * =============================================================================
 */

const { Router } = require('express');

const router = Router();

/* --------------------------------------------------------------------------
 * 2. Route Mounting
 * -------------------------------------------------------------------------- */

router.use('/auth', require('./auth'));
router.use('/users', require('./users'));
router.use('/reports', require('./reports'));
router.use('/hazards', require('./hazards'));
router.use('/notifications', require('./notifications'));
router.use('/dashboard', require('./dashboard'));
router.use('/media', require('./media'));
router.use('/hotlines', require('./hotlines'));
router.use('/sms', require('./sms'));

/* --------------------------------------------------------------------------
 * 3. Health Check
 * -------------------------------------------------------------------------- */

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'PULSE-RTIP API is running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
