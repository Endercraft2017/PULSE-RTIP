/**
 * =============================================================================
 * Auth Controller
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. login    - Authenticate user and return JWT
 * 3. register - Create new user account and return JWT
 * 4. Helper   - Generate JWT token
 *
 * Handles user authentication and registration.
 * =============================================================================
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Notification = require('../models/Notification');
const OtpVerification = require('../models/OtpVerification');
const textbee = require('../services/sms/textbee');

/* --------------------------------------------------------------------------
 * 4. Helper - Generate JWT token
 * -------------------------------------------------------------------------- */

/**
 * Generates a JWT access token for a user.
 * @param {object} user - User object with id and role
 * @returns {string} Signed JWT token
 */
function generateToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

/* --------------------------------------------------------------------------
 * 2. login
 * -------------------------------------------------------------------------- */

/**
 * Authenticates a user with email and password.
 * Returns a JWT token and user profile on success.
 *
 * @param {object} req - Express request (body: { email, password })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user);
    const notificationCount = await Notification.countUnread(user.id);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address,
          avatar: user.avatar,
          role: user.role,
          joinedDate: user.joined_date,
        },
        notificationCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 3. register
 * -------------------------------------------------------------------------- */

/**
 * Creates a new user account.
 * Returns a JWT token and user profile on success.
 *
 * @param {object} req - Express request (body: { name, email, password, phone, address })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function register(req, res, next) {
  try {
    const { name, email, password, phone, address, role: requestedRole } = req.body;

    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Require a recently-verified SMS OTP for the signup phone.
    // (15-minute window — matches the OTP TTL + a small grace period.)
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'A phone number is required. It must be verified via SMS before signup.',
      });
    }
    const phoneVerified = await OtpVerification.hasRecentVerified(phone, 'signup', 900);
    if (!phoneVerified) {
      return res.status(403).json({
        success: false,
        message: 'Phone number has not been verified. Please verify via SMS before completing signup.',
      });
    }

    // Admin signups are queued for approval — the account is created as a
    // citizen and flagged pending. Existing admins get a notification with
    // approve/reject actions.
    const wantsAdmin = requestedRole === 'admin';

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      phone,
      address,
      password_hash,
      role: 'citizen',
      admin_request_status: wantsAdmin ? 'pending' : null,
    });

    if (wantsAdmin) {
      try {
        const Notification = require('../models/Notification');
        const admins = await User.findByRole('admin');
        for (const admin of admins) {
          await Notification.create({
            user_id: admin.id,
            actor_user_id: user.id,
            type: 'admin_request',
            title: 'New admin account request',
            text: `${user.name} (${user.email}) has requested admin access. Review and approve or reject.`,
          });
        }
      } catch (notifErr) {
        console.error('[register] failed to notify admins of admin request:', notifErr.message);
      }

      // Don't auto-login the requester; respond with a status the frontend
      // can use to show "request submitted" toast and bounce back to login.
      return res.status(202).json({
        success: true,
        adminRequest: 'pending',
        message: 'Your admin account request has been submitted for approval.',
      });
    }

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address,
          avatar: user.avatar,
          role: user.role,
          joinedDate: user.joined_date,
        },
        notificationCount: 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 5. sendOtp
 * -------------------------------------------------------------------------- */

/**
 * Generates a 6-digit OTP, stores it, and dispatches it via SMS to the
 * supplied phone number. Used during signup (phone verification) and can
 * be reused for login-OTP or password reset by passing a different purpose.
 *
 * Rate-limited: one OTP per phone per 30 seconds.
 *
 * @param {object} req - Express request (body: { phone, purpose? })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function sendOtp(req, res, next) {
  try {
    const { phone, purpose = 'signup' } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    // For signup: reject if the phone is already tied to an existing account
    if (purpose === 'signup') {
      const normalized = OtpVerification.normalizePhone(phone);
      const existingUser = await User.findByPhone(normalized);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'This phone number is already registered. Please log in instead.',
        });
      }
    }

    // Rate limit: block sending if the last OTP was less than 30 seconds ago
    const lastOtp = await OtpVerification.findLatest(phone, purpose);
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
    await OtpVerification.create({ phone, code, purpose, ttlSeconds: 600 });

    const message = `PULSE 911 verification code: ${code}\nValid for 10 minutes. Do not share this code with anyone.`;

    if (!textbee.isConfigured()) {
      // Dev/offline fallback: return the code in the response. In production
      // with a working gateway this branch never fires.
      console.warn('[sendOtp] TextBee not configured, returning code in response for dev');
      return res.json({
        success: true,
        message: 'OTP generated (SMS gateway not configured — dev mode).',
        devCode: code,
      });
    }

    try {
      await textbee.sendSMS(phone, message);
    } catch (smsErr) {
      console.error('[sendOtp] SMS send failed:', smsErr.message);
      return res.status(502).json({
        success: false,
        message: 'Unable to deliver the SMS verification code right now. Please try again or contact MDRRMO support.',
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent via SMS.',
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 6. verifyOtp
 * -------------------------------------------------------------------------- */

/**
 * Validates a submitted OTP against the latest stored code for that phone.
 * On success, marks the OTP as verified — the register endpoint then
 * looks for this verified record to allow account creation.
 *
 * @param {object} req - Express request (body: { phone, code, purpose? })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function verifyOtp(req, res, next) {
  try {
    const { phone, code, purpose = 'signup' } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and code are required.' });
    }

    const record = await OtpVerification.findLatest(phone, purpose);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'No verification code found for this number. Please request a new one.',
      });
    }

    // Expiry check
    if (new Date(record.expires_at + 'Z') < new Date()) {
      return res.status(410).json({
        success: false,
        message: 'This verification code has expired. Please request a new one.',
      });
    }

    // Attempt ceiling (5 tries)
    if (record.attempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new code.',
      });
    }

    if (String(code).trim() !== record.code) {
      await OtpVerification.incrementAttempt(record.id);
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code.',
      });
    }

    await OtpVerification.markVerified(record.id);

    res.json({
      success: true,
      message: 'Phone number verified.',
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 7. forgotPassword
 * -------------------------------------------------------------------------- */

/**
 * Masks a phone number for UI display, keeping the first 4 and last 3 digits.
 * 09171234567 -> 0917****567
 */
function maskPhone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/[^\d+]/g, '');
  if (clean.length < 7) return clean;
  const first = clean.slice(0, 4);
  const last = clean.slice(-3);
  return first + '*'.repeat(clean.length - 7) + last;
}

/**
 * Initiates the password-reset flow. Accepts an email OR phone, looks up
 * the user, and sends an SMS OTP to the user's registered phone number.
 *
 * @param {object} req - Express request (body: { identifier })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function forgotPassword(req, res, next) {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Email or phone number is required.' });
    }

    // Find user by email or phone
    const looksLikeEmail = String(identifier).includes('@');
    let user;
    if (looksLikeEmail) {
      user = await User.findByEmail(identifier.trim());
    } else {
      const normalized = OtpVerification.normalizePhone(identifier);
      user = await User.findByPhone(normalized);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found for that email or phone number.',
      });
    }

    if (!user.phone) {
      return res.status(400).json({
        success: false,
        message: 'This account has no phone number on file. Contact MDRRMO support to reset your password.',
      });
    }

    // Rate limit: one OTP per 30 seconds per phone+purpose
    const lastOtp = await OtpVerification.findLatest(user.phone, 'reset');
    if (lastOtp) {
      const age = (Date.now() - new Date(lastOtp.created_at + 'Z').getTime()) / 1000;
      if (age < 30) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(30 - age)}s before requesting a new code.`,
        });
      }
    }

    // Generate + store OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await OtpVerification.create({ phone: user.phone, code, purpose: 'reset', ttlSeconds: 600 });

    const message = `PULSE 911 password reset code: ${code}\nValid for 10 minutes. Do not share this code with anyone.`;

    // Dev fallback when TextBee isn't configured
    if (!textbee.isConfigured()) {
      console.warn('[forgotPassword] TextBee not configured, returning code in response for dev');
      return res.json({
        success: true,
        phone: user.phone,
        maskedPhone: maskPhone(user.phone),
        devCode: code,
        message: 'OTP generated (SMS gateway not configured — dev mode).',
      });
    }

    try {
      await textbee.sendSMS(user.phone, message);
    } catch (smsErr) {
      console.error('[forgotPassword] SMS send failed:', smsErr.message);
      return res.status(502).json({
        success: false,
        message: 'Unable to deliver the SMS code right now. Please try again shortly.',
      });
    }

    res.json({
      success: true,
      phone: user.phone,                 // Full — frontend uses for subsequent API calls
      maskedPhone: maskPhone(user.phone), // For display only
      message: 'Verification code sent via SMS.',
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 8. resetPassword
 * -------------------------------------------------------------------------- */

/**
 * Resets a user's password. Requires a recently-verified OTP for the phone
 * (15-minute window matching the OTP TTL + grace period).
 *
 * @param {object} req - Express request (body: { phone, newPassword })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function resetPassword(req, res, next) {
  try {
    const { phone, newPassword } = req.body;

    if (!phone || !newPassword) {
      return res.status(400).json({ success: false, message: 'Phone and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const verified = await OtpVerification.hasRecentVerified(phone, 'reset', 900);
    if (!verified) {
      return res.status(403).json({
        success: false,
        message: 'Phone has not been verified. Please request a new code.',
      });
    }

    const normalized = OtpVerification.normalizePhone(phone);
    const user = await User.findByPhone(normalized);
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found for this phone number.' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await User.updatePassword(user.id, password_hash);

    res.json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register, sendOtp, verifyOtp, forgotPassword, resetPassword };
