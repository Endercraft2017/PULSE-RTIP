/**
 * =============================================================================
 * SMS Controller
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. getStatus    - Check gateway status
 * 3. sendSMS      - Send an SMS (admin only)
 * 4. getReceived  - List received SMS messages
 * 5. sendTestSMS  - Quick test endpoint
 *
 * Handles SMS-related API endpoints powered by TextBee.
 * =============================================================================
 */

const textbee = require('../services/sms/textbee');

/* --------------------------------------------------------------------------
 * 2. getStatus
 * -------------------------------------------------------------------------- */

async function getStatus(req, res, next) {
  try {
    const status = await textbee.getStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 3. sendSMS
 * -------------------------------------------------------------------------- */

async function sendSMS(req, res, next) {
  try {
    const { recipients, message } = req.body;
    const result = await textbee.sendSMS(recipients, message);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 4. getReceived
 * -------------------------------------------------------------------------- */

async function getReceived(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await textbee.getReceived({ page, limit });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 5. sendTestSMS
 * -------------------------------------------------------------------------- */

async function sendTestSMS(req, res, next) {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const message = `[PULSE 911 TEST] This is a test message from the PULSE-RTIP system. If you received this, SMS integration is working. - MDRRMO Morong`;
    const result = await textbee.sendSMS(phone, message);

    res.json({
      success: true,
      message: `Test SMS sent to ${phone}`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStatus, sendSMS, getReceived, sendTestSMS };
