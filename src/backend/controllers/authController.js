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
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config');
const db = require('../config/database');
const User = require('../models/User');
const Notification = require('../models/Notification');
const OtpVerification = require('../models/OtpVerification');
const textbee = require('../services/sms/textbee');
const { parseDbDate } = require('../utils/dates');

/* --------------------------------------------------------------------------
 * Multer — ID document uploads
 * -------------------------------------------------------------------------- */
// Separate subfolder under the static uploads dir so /uploads/id-documents/<file>
// serves directly. Admins need to view the image when approving an account.
const ID_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ID_UPLOAD_SUBDIR = 'id-documents';
const ID_UPLOAD_DIR = path.join(config.upload.dir, ID_UPLOAD_SUBDIR);

if (!fs.existsSync(ID_UPLOAD_DIR)) {
  fs.mkdirSync(ID_UPLOAD_DIR, { recursive: true });
}

const idStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ID_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    cb(null, `id-${unique}${ext}`);
  },
});

const idFileFilter = (req, file, cb) => {
  if (ID_ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
  cb(new Error('ID upload must be a PNG, JPG, or WEBP image.'), false);
};

const uploadIdDocument = multer({
  storage: idStorage,
  fileFilter: idFileFilter,
  limits: { fileSize: config.upload.maxFileSize },
}).single('idFile');

/**
 * Route middleware that runs uploadIdDocument only when the request is
 * multipart/form-data. JSON callers pass through untouched so the original
 * JSON flow (and express-validator rules bound to `body('...')`) still work.
 * Multer errors surface as 400 with a readable message.
 */
function handleIdUpload(req, res, next) {
  const ct = req.headers['content-type'] || '';
  if (!ct.startsWith('multipart/form-data')) return next();
  uploadIdDocument(req, res, (err) => {
    if (err) {
      const isSize = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({
        success: false,
        code: isSize ? 'ID_FILE_TOO_LARGE' : 'ID_UPLOAD_FAILED',
        message: isSize
          ? `ID upload failed: file too large (max ${Math.floor(config.upload.maxFileSize / 1024 / 1024)}MB).`
          : `ID upload failed: ${err.message}`,
      });
    }
    next();
  });
}

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
      // findByEmail hides soft-deleted accounts. Do a deleted-inclusive
      // lookup by email so someone trying to log back in after deletion
      // gets a clear "account deleted" message instead of the generic
      // "wrong password" path.
      const deletedCheck = await db.query(
        'SELECT deleted_at FROM users WHERE email = ? AND deleted_at IS NOT NULL',
        [email]
      );
      if (deletedCheck && deletedCheck[0]) {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_DELETED',
          message: 'This account has been deleted. Contact MDRRMO support if this was a mistake.',
        });
      }
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Incorrect email or password. Check for typos, or tap "Forgot password?" to reset.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Incorrect email or password. Check for typos, or tap "Forgot password?" to reset.',
      });
    }

    // Every new account — citizen or admin — is now queued for MDRRMO
    // review before first login. Block until the status is approved (or null,
    // for legacy rows seeded before this flow landed).
    if (user.admin_request_status === 'pending' || user.admin_request_status === 'pending_admin') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_PENDING',
        message: 'Your account is awaiting MDRRMO admin approval. You\'ll receive an SMS and email when reviewed.',
      });
    }
    if (user.admin_request_status === 'rejected') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_REJECTED',
        message: 'Your account application was not approved. Please contact MDRRMO Morong for details.',
      });
    }

    const token = generateToken(user);
    // Pass the role so admins see the badge filtered to still-open
    // reports (matches the dashboard intent + bell badge served by
    // /api/notifications).
    const notificationCount = await Notification.countUnread(user.id, user.role);

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
    const { name, email, password, phone, address, barangay, idType, idNumber } = req.body;

    // Use the "including deleted" variant — the users.email UNIQUE constraint
    // covers tombstones, so a plain findByEmail() lookup misses soft-deleted
    // rows and the insert crashes with `UNIQUE constraint failed`.
    const existing = await User.findByEmailIncludingDeleted(email);
    if (existing) {
      // The uploaded file is now orphaned — clean it up so we don't collect
      // junk for every duplicate-signup attempt.
      if (req.file && req.file.path) fs.unlink(req.file.path, () => {});
      const isDeleted = !!existing.deleted_at;
      return res.status(409).json({
        success: false,
        code: isDeleted ? 'EMAIL_PREVIOUSLY_USED' : 'EMAIL_TAKEN',
        message: isDeleted
          ? `This email was previously used by an account that has since been deleted. Please contact MDRRMO admin to recover it, or sign up with a different email.`
          : `An account already exists for ${email}. Please log in or use a different email.`,
      });
    }

    // Require a recently-verified SMS OTP for the signup phone.
    // (15-minute window — matches the OTP TTL + a small grace period.)
    if (!phone) {
      if (req.file && req.file.path) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        success: false,
        code: 'PHONE_REQUIRED',
        message: 'A phone number is required. It must be verified via SMS before signup.',
      });
    }
    const phoneVerified = await OtpVerification.hasRecentVerified(phone, 'signup', 900);
    if (!phoneVerified) {
      if (req.file && req.file.path) fs.unlink(req.file.path, () => {});
      return res.status(403).json({
        success: false,
        code: 'PHONE_NOT_VERIFIED',
        message: 'Phone verification expired. Please restart signup and verify the 6-digit SMS code again.',
      });
    }

    // ID verification is required for every signup. Reject early with a clear
    // message — the frontend shows this to the user.
    const cleanIdType = (idType || '').trim();
    const cleanIdNumber = (idNumber || '').trim();
    if (!cleanIdType || !cleanIdNumber) {
      if (req.file && req.file.path) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        success: false,
        code: 'ID_FIELDS_REQUIRED',
        message: 'ID type and ID number are required for signup.',
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: 'ID_FILE_REQUIRED',
        message: 'A photo of your ID is required for signup.',
      });
    }

    // Stored as a path relative to the uploads root so frontend can build a
    // URL as `/uploads/<path>`. Always forward slashes.
    const idDocumentPath = `${ID_UPLOAD_SUBDIR}/${req.file.filename}`.replace(/\\/g, '/');

    // Every signup is a citizen awaiting MDRRMO review. The admin
    // self-request path was removed (U-10) — admins are now provisioned
    // only via the server-side CLI (`npm run provision-admin`).
    const password_hash = await bcrypt.hash(password, 10);
    // Role is ALWAYS forced to 'citizen' server-side — a malicious client
    // sending {role:'admin'} cannot self-promote. Admins are minted only
    // through the CLI.
    let user;
    try {
      user = await User.create({
        name,
        email,
        phone,
        address,
        barangay: barangay || null,
        password_hash,
        role: 'citizen',
        admin_request_status: 'pending',
        id_type: cleanIdType,
        id_number: cleanIdNumber,
        id_document_path: idDocumentPath,
      });
    } catch (insertErr) {
      // Safety net: if a UNIQUE-constraint violation slips past the
      // pre-check (race condition, schema mismatch, etc.), translate it
      // into a clean 409 so the client gets parseable JSON instead of an
      // HTML 500 page that the frontend reports as "Network error".
      const msg = String(insertErr && insertErr.message || '');
      const isUnique = /UNIQUE\s+constraint\s+failed|ER_DUP_ENTRY|Duplicate entry/i.test(msg);
      if (isUnique) {
        if (req.file && req.file.path) fs.unlink(req.file.path, () => {});
        const field = /email/i.test(msg) ? 'email' : /phone/i.test(msg) ? 'phone' : 'field';
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_ENTRY',
          message: `This ${field} is already registered. Please use a different ${field} or log in.`,
        });
      }
      throw insertErr;
    }

    // Notify every admin that a new citizen signup is waiting for review.
    try {
      const Notification = require('../models/Notification');
      const admins = await User.findByRole('admin');
      for (const admin of admins) {
        await Notification.create({
          user_id: admin.id,
          actor_user_id: user.id,
          type: 'admin_request',
          title: 'New citizen signup',
          text: `${user.name} (${user.email}) has signed up and is awaiting approval. Review and approve or reject.`,
        });
      }
    } catch (notifErr) {
      console.error('[register] failed to notify admins of pending signup:', notifErr.message);
    }

    // No JWT — user cannot log in until an admin approves. Frontend shows
    // a "pending review" screen and routes back to login.
    return res.status(202).json({
      success: true,
      pending: true,
      kind: 'citizen_signup',
      message: 'Thanks! Your account is pending MDRRMO admin review. You\'ll be notified by SMS and email.',
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

    const normalized = OtpVerification.normalizePhone(phone);

    // Strict PH mobile format: exactly 11 digits starting with "09"
    if (!/^09\d{9}$/.test(normalized)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PHONE_FORMAT',
        message: 'That doesn\'t look like a valid Philippine mobile number. Expected format: 0917-123-4567 (11 digits starting with 09).',
      });
    }

    // For signup: reject if the phone is already tied to an existing account
    if (purpose === 'signup') {
      const existingUser = await User.findByPhone(normalized);
      if (existingUser) {
        // Partially mask the email so users recognize their own account
        // without letting a stranger enumerate phone->email pairs.
        const masked = maskEmail(existingUser.email);
        return res.status(409).json({
          success: false,
          code: 'PHONE_TAKEN',
          message: `An account already exists for this phone number (${masked}). Use "Forgot password?" to recover it, or use a different number.`,
        });
      }
    }

    // Rate limit: block sending if the last OTP was less than 30 seconds ago
    const lastOtp = await OtpVerification.findLatest(phone, purpose);
    if (lastOtp) {
      const createdAt = parseDbDate(lastOtp.created_at);
      const age = createdAt ? (Date.now() - createdAt.getTime()) / 1000 : Infinity;
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
        code: 'OTP_NOT_FOUND',
        message: 'No verification code has been sent to this number yet. Tap "Resend" to request one.',
      });
    }

    // Expiry check
    const expiresAt = parseDbDate(record.expires_at);
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      return res.status(410).json({
        success: false,
        code: 'OTP_EXPIRED',
        message: 'This code has expired (codes are valid for 10 minutes). Tap "Resend" to get a new one.',
      });
    }

    // Attempt ceiling (5 tries)
    if (record.attempts >= 5) {
      return res.status(429).json({
        success: false,
        code: 'OTP_TOO_MANY_ATTEMPTS',
        message: 'Too many wrong codes entered. For your security, please tap "Resend" to request a fresh code.',
      });
    }

    if (String(code).trim() !== record.code) {
      await OtpVerification.incrementAttempt(record.id);
      const attemptsLeft = Math.max(0, 5 - (record.attempts + 1));
      return res.status(400).json({
        success: false,
        code: 'OTP_INVALID',
        message: attemptsLeft > 0
          ? `Incorrect code. You have ${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} left before you'll need to request a new one.`
          : 'Incorrect code. Please tap "Resend" to request a new one.',
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
/**
 * Masks an email for display — keeps first 3 and last 2 chars of the
 * local part, fully shows the domain. kyle.reneg@example.com -> ky***eg@example.com
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const at = email.lastIndexOf('@');
  if (at < 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 3) return local[0] + '***' + domain;
  return local.slice(0, 2) + '***' + local.slice(-2) + domain;
}

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
        code: 'ACCOUNT_NOT_FOUND',
        message: looksLikeEmail
          ? `No account is registered under ${identifier}. Check for typos or create a new account.`
          : 'No account is registered under that phone number. Check for typos or create a new account.',
      });
    }

    if (!user.phone) {
      return res.status(400).json({
        success: false,
        code: 'NO_PHONE_ON_FILE',
        message: 'This account has no phone number on file, so an SMS reset isn\'t possible. Contact MDRRMO support to reset your password.',
      });
    }

    // Rate limit: one OTP per 30 seconds per phone+purpose
    const lastOtp = await OtpVerification.findLatest(user.phone, 'reset');
    if (lastOtp) {
      const createdAt = parseDbDate(lastOtp.created_at);
      const age = createdAt ? (Date.now() - createdAt.getTime()) / 1000 : Infinity;
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
        code: 'OTP_NOT_VERIFIED',
        message: 'Your verification has expired (codes are valid for 15 minutes). Please restart the password reset and verify the code again.',
      });
    }

    const normalized = OtpVerification.normalizePhone(phone);
    const user = await User.findByPhone(normalized);
    if (!user) {
      return res.status(404).json({
        success: false,
        code: 'ACCOUNT_NOT_FOUND',
        message: 'No account found for this phone number.',
      });
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

module.exports = { login, register, sendOtp, verifyOtp, forgotPassword, resetPassword, handleIdUpload };
