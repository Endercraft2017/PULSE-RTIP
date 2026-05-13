/**
 * =============================================================================
 * Push Token Controller
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. register - Register or refresh a device's FCM token (auth-optional)
 * 3. claim    - Attach a previously unclaimed token to the logged-in user
 *
 * Backs the /api/push-tokens routes. Devices can register a token before
 * the user has logged in (user_id = NULL). After login, the client calls
 * /claim so the unclaimed row gets linked to the user + their barangay.
 * =============================================================================
 */

const PushToken = require('../models/PushToken');

/* --------------------------------------------------------------------------
 * 2. register
 * -------------------------------------------------------------------------- */

/**
 * POST /api/push-tokens
 * Public-ish: works unauthenticated (unclaimed registration) but if the
 * caller includes a valid Bearer token the route layer runs authenticate
 * first so we can associate user_id here.
 *
 * Body: { token, platform, barangay }
 */
async function register(req, res, next) {
  try {
    const { token, platform, barangay } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'token is required' });
    }

    const userId = req.user ? req.user.id : null;
    const effectiveBarangay = barangay || (req.user && req.user.barangay) || null;

    await PushToken.upsert({
      token,
      user_id: userId,
      platform: platform || 'android',
      barangay: effectiveBarangay,
    });

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 3. claim
 * -------------------------------------------------------------------------- */

/**
 * POST /api/push-tokens/claim
 * Authenticated. Attaches a previously unclaimed device token to the
 * logged-in user and stamps their barangay so audience-filtered
 * broadcasts can target this device.
 *
 * Body: { token }
 */
async function claim(req, res, next) {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'token is required' });
    }
    await PushToken.claim(token, req.user.id, req.user.barangay || null);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, claim };
