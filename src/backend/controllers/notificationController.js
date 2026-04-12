/**
 * =============================================================================
 * Notification Controller
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. getNotifications - List notifications for current user
 *
 * Handles notification retrieval for authenticated users.
 * =============================================================================
 */

const Notification = require('../models/Notification');

/* --------------------------------------------------------------------------
 * 2. getNotifications
 * -------------------------------------------------------------------------- */

/**
 * Lists all notifications for the authenticated user, newest first.
 *
 * @param {object} req - Express request (req.user set by auth middleware)
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function getNotifications(req, res, next) {
  try {
    const notifications = await Notification.findByUserId(req.user.id);
    const unreadCount = await Notification.countUnread(req.user.id);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Marks all notifications for the current user as read.
 */
async function markAllRead(req, res, next) {
  try {
    await Notification.markAllAsRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { getNotifications, markAllRead };
