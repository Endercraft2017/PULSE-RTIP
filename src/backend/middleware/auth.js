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

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.',
      });
    }

    req.user = user;
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
