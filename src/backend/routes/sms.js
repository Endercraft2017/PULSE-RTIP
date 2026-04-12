/**
 * =============================================================================
 * SMS Routes
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Validation Rules
 * 3. Route Definitions
 *
 * GET  /api/sms/gateway-phone - Get gateway phone number (public, no auth)
 * GET  /api/sms/status    - Check TextBee gateway status (admin)
 * POST /api/sms/send      - Send SMS to recipients (admin)
 * GET  /api/sms/received  - List received SMS messages (admin)
 * POST /api/sms/test      - Send a test SMS (admin)
 * =============================================================================
 */

const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');
const config = require('../config');
const smsController = require('../controllers/smsController');

const router = Router();

/* --------------------------------------------------------------------------
 * Public endpoint — no auth required (cached by mobile app for offline use)
 * -------------------------------------------------------------------------- */

router.get('/gateway-phone', (req, res) => {
  const phone = config.textbee.gatewayPhone;
  if (!phone) {
    return res.status(503).json({ success: false, message: 'Gateway phone not configured.' });
  }
  res.json({ success: true, data: { phone } });
});

/* --------------------------------------------------------------------------
 * 2. Validation Rules
 * -------------------------------------------------------------------------- */

const sendRules = [
  body('recipients').notEmpty().withMessage('Recipients is required'),
  body('message').trim().notEmpty().withMessage('Message is required')
    .isLength({ max: 480 }).withMessage('Message must be under 480 characters'),
];

const testRules = [
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
];

/* --------------------------------------------------------------------------
 * 3. Route Definitions
 * -------------------------------------------------------------------------- */

router.get('/status', authenticate, requireAdmin, smsController.getStatus);
router.post('/send', authenticate, requireAdmin, validate(sendRules), smsController.sendSMS);
router.get('/received', authenticate, requireAdmin, smsController.getReceived);
router.post('/test', authenticate, requireAdmin, validate(testRules), smsController.sendTestSMS);

module.exports = router;
