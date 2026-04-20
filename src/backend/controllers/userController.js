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

module.exports = { getMe, updateMe, changePassword };
