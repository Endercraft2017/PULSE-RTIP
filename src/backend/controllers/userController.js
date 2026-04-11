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

const User = require('../models/User');

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

module.exports = { getMe, updateMe };
