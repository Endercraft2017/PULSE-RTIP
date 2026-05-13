/**
 * =============================================================================
 * Authentication Middleware
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. authenticate  - Verify JWT token and attach user to request
 * 3. requireAdmin  - Restrict access to admin users only
 *
 * Provides JWT-based authentication guards for protected API routes.
 * =============================================================================
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

// In-memory throttle for last_seen_at writes — keyed by user id, value is the
// epoch ms of the last DB write. Reset on every server restart, which is fine
// because the very next authenticated request will rewrite the row.
const _lastSeenWriteAt = new Map();

/* --------------------------------------------------------------------------
 * 2. authenticate
 * -------------------------------------------------------------------------- */

/**
 * Middleware that verifies the JWT Bearer token from the Authorization header.
 * On success, attaches the user object to req.user.
 * On failure, returns 401 Unauthorized.
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.sub);

    // findById filters soft-deleted rows, so a null here can mean either the
    // account never existed or it was deleted after the token was issued. To
    // give a clearer message on the common "I just deleted my account" path,
    // disambiguate by checking the deleted-inclusive lookup.
    if (!user) {
      const orphan = await User.findByIdIncludingDeleted(decoded.sub);
      if (orphan && orphan.deleted_at) {
        return res.status(401).json({
          success: false,
          code: 'ACCOUNT_DELETED',
          message: 'This account has been deleted and can no longer be accessed.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.',
      });
    }

    req.user = user;

    // Presence tracking: bump users.last_seen_at, throttled to one write per
    // user per 60s so chatty endpoints don't hammer the DB. Fire-and-forget;
    // never blocks the request even if it errors.
    try {
      const now = Date.now();
      const last = _lastSeenWriteAt.get(user.id) || 0;
      if (now - last >= 60_000) {
        _lastSeenWriteAt.set(user.id, now);
        const db = require('../config/database');
        db.query('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id])
          .catch(() => { /* ignore, presence is best-effort */ });
      }
    } catch (_) { /* never block on presence */ }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }
}

/* --------------------------------------------------------------------------
 * 3. requireAdmin
 * -------------------------------------------------------------------------- */

/**
 * Middleware that restricts access to admin users only.
 * Must be used after authenticate middleware.
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
