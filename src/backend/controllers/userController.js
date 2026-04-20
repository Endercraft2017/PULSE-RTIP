/**
 * =============================================================================
 * User Controller
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. getMe    - Get current authenticated user profile
 * 3. updateMe - Update current user's profile
 *
 * Handles user profile operations.
 * =============================================================================
 */

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const OtpVerification = require('../models/OtpVerification');
const textbee = require('../services/sms/textbee');

/** Digits-only for phone equality comparison (tolerant of -, spaces, etc.) */
function sameDigits(a, b) {
  return String(a || '').replace(/\D/g, '') === String(b || '').replace(/\D/g, '');
}

/** Masks middle digits for display: 09171234567 -> 0917****567 */
function maskPhone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/[^\d+]/g, '');
  if (clean.length < 7) return clean;
  return clean.slice(0, 4) + '*'.repeat(clean.length - 7) + clean.slice(-3);
}

/* --------------------------------------------------------------------------
 * 2. getMe
 * -------------------------------------------------------------------------- */

/**
 * Returns the authenticated user's profile.
 *
 * @param {object} req - Express request (req.user set by auth middleware)
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function getMe(req, res, next) {
  try {
    res.json({
      success: true,
      data: req.user,
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 3. updateMe
 * -------------------------------------------------------------------------- */

/**
 * Updates the authenticated user's profile fields.
 * Allowed fields: name, phone, address.
 *
 * @param {object} req - Express request (body: { name?, phone?, address? })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function updateMe(req, res, next) {
  try {
    const { name, phone, address } = req.body;
    const updated = await User.updateById(req.user.id, { name, phone, address });

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 4. changePassword
 * -------------------------------------------------------------------------- */

/**
 * Changes the authenticated user's password. Requires the current
 * password to be supplied to defend against session hijacks.
 * The user's JWT remains valid — no forced re-login.
 *
 * @param {object} req - Express request (body: { currentPassword, newPassword })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new password are both required.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters.',
      });
    }

    // Fetch full user row (findById omits password_hash)
    const user = await User.findByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from your current password.',
      });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await User.updatePassword(user.id, password_hash);

    res.json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 5a. checkPhoneAvailable
 * --------------------------------------------------------------------------
 * Preflight check the client can call BEFORE sending an OTP to catch
 * format errors, duplicate-phone, and same-as-current without spending
 * an SMS. Authenticated.
 * -------------------------------------------------------------------------- */

async function checkPhoneAvailable(req, res, next) {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const normalized = OtpVerification.normalizePhone(phone);

    if (!/^09\d{9}$/.test(normalized)) {
      return res.json({
        success: false,
        available: false,
        reason: 'invalid_format',
        message: 'Please enter a valid Philippine mobile number (e.g. 0917-123-4567).',
      });
    }

    if (sameDigits(normalized, req.user.phone)) {
      return res.json({
        success: false,
        available: false,
        reason: 'same_as_current',
        message: 'This is already your current phone number.',
      });
    }

    const existing = await User.findByPhone(normalized);
    if (existing && existing.id !== req.user.id) {
      return res.json({
        success: false,
        available: false,
        reason: 'taken',
        message: 'This phone number is already registered to another account.',
      });
    }

    return res.json({
      success: true,
      available: true,
      phone: normalized,
      maskedPhone: maskPhone(normalized),
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 5. sendPhoneChangeOtp
 * -------------------------------------------------------------------------- */

/**
 * Dispatches an SMS OTP to the user's proposed NEW phone number to prove
 * ownership before the phone change is persisted. Authenticated endpoint.
 *
 * Rules:
 * - Reject if phone is the same as the current phone (no-op)
 * - Reject if phone is already tied to a different user
 * - Rate-limit to one send per 30 seconds per phone
 *
 * @param {object} req - Express request (body: { phone })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function sendPhoneChangeOtp(req, res, next) {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const normalized = OtpVerification.normalizePhone(phone);
    // Strict PH mobile format: exactly 11 digits starting with "09"
    if (!/^09\d{9}$/.test(normalized)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid Philippine mobile number (e.g. 0917-123-4567).',
      });
    }

    // Reject if phone didn't actually change
    if (sameDigits(normalized, req.user.phone)) {
      return res.status(400).json({
        success: false,
        message: 'This is already your current phone number.',
      });
    }

    // Reject if phone is already registered to a different user
    const existing = await User.findByPhone(normalized);
    if (existing && existing.id !== req.user.id) {
      return res.status(409).json({
        success: false,
        message: 'This phone number is already registered to another account.',
      });
    }

    // Rate-limit: 30s per phone+purpose
    const lastOtp = await OtpVerification.findLatest(normalized, 'phone_change');
    if (lastOtp) {
      const age = (Date.now() - new Date(lastOtp.created_at + 'Z').getTime()) / 1000;
      if (age < 30) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(30 - age)}s before requesting a new code.`,
        });
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await OtpVerification.create({ phone: normalized, code, purpose: 'phone_change', ttlSeconds: 600 });

    const message = `PULSE 911 phone change code: ${code}\nValid for 10 minutes. Do not share this code with anyone.`;

    if (!textbee.isConfigured()) {
      console.warn('[sendPhoneChangeOtp] TextBee not configured, returning code in response for dev');
      return res.json({
        success: true,
        maskedPhone: maskPhone(normalized),
        devCode: code,
        message: 'OTP generated (SMS gateway not configured — dev mode).',
      });
    }

    try {
      await textbee.sendSMS(normalized, message);
    } catch (smsErr) {
      console.error('[sendPhoneChangeOtp] SMS send failed:', smsErr.message);
      return res.status(502).json({
        success: false,
        message: 'Unable to deliver the SMS code right now. Please try again shortly.',
      });
    }

    res.json({
      success: true,
      maskedPhone: maskPhone(normalized),
      message: 'Verification code sent via SMS to the new number.',
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 6. updatePhone
 * -------------------------------------------------------------------------- */

/**
 * Verifies the OTP for the new phone number and commits the change.
 * Authenticated.
 *
 * @param {object} req - Express request (body: { phone, code })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function updatePhone(req, res, next) {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and code are required.' });
    }

    const normalized = OtpVerification.normalizePhone(phone);
    const record = await OtpVerification.findLatest(normalized, 'phone_change');

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'No verification code found for this number. Please request a new one.',
      });
    }

    if (new Date(record.expires_at + 'Z') < new Date()) {
      return res.status(410).json({
        success: false,
        message: 'This verification code has expired. Please request a new one.',
      });
    }

    if (record.attempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new code.',
      });
    }

    if (String(code).trim() !== record.code) {
      await OtpVerification.incrementAttempt(record.id);
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }

    // Double-check the phone isn't now taken by someone else (race condition guard)
    const taken = await User.findByPhone(normalized);
    if (taken && taken.id !== req.user.id) {
      return res.status(409).json({
        success: false,
        message: 'This phone number is already registered to another account.',
      });
    }

    await OtpVerification.markVerified(record.id);
    const updated = await User.updateById(req.user.id, { phone: normalized });

    res.json({
      success: true,
      message: 'Phone number updated successfully.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, updateMe, changePassword, checkPhoneAvailable, sendPhoneChangeOtp, updatePhone };
