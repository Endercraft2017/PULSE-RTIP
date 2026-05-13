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

/**
 * Translates a tagged TextBee error into an HTTP response. Returns true if
 * the error was handled (response sent); false if the caller should fall
 * through to `next(err)`. Keeps 429/502 passthrough logic in one place.
 */
function handleSmsError(err, res) {
  if (err.isRateLimit) {
    const q = err.quota;
    // TextBee distinguishes two flavors of 429: daily/monthly quota vs a
    // short-term burst throttle. Surface the right message to the admin.
    const isQuota = q && q.hasReachedLimit;
    const message = isQuota
      ? `TextBee daily SMS limit reached (${q.dailyRemaining}/${q.dailyLimit} remaining today, ${q.monthlyRemaining}/${q.monthlyLimit} for the month). Resets at 00:00 UTC.`
      : 'The SMS gateway is temporarily rate-limited. Please wait a minute and try again.';
    res.status(429).json({
      success: false,
      code: isQuota ? 'SMS_QUOTA_EXCEEDED' : 'SMS_RATE_LIMITED',
      message,
      ...(q ? { quota: q } : {}),
    });
    return true;
  }
  if (err.isGatewayError) {
    res.status(502).json({
      success: false,
      code: 'SMS_GATEWAY_ERROR',
      message: err.message || 'SMS gateway is unavailable. Please try again shortly.',
    });
    return true;
  }
  return false;
}

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
    if (handleSmsError(err, res)) return;
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
    if (handleSmsError(err, res)) return;
    next(err);
  }
}

module.exports = { getStatus, sendSMS, getReceived, sendTestSMS };
