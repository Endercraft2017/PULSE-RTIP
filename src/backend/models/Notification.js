/**
 * =============================================================================
 * Notification Model
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. findByUserId - Get notifications for a user
 * 3. create       - Create a new notification
 * 4. countUnread  - Count unread notifications for a user
 * 5. markAsRead   - Mark a notification as read
 *
 * Data access layer for the notifications table.
 * =============================================================================
 */

const db = require('../config/database');

/* --------------------------------------------------------------------------
 * 2. findByUserId
 * -------------------------------------------------------------------------- */

/**
 * Gets all notifications for a specific user, newest first.
 * @param {number} userId - The user ID
 * @returns {Promise<Array>} Array of notification objects
 */
async function findByUserId(userId) {
  return db.query(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
}

/* --------------------------------------------------------------------------
 * 3. create
 * -------------------------------------------------------------------------- */

/**
 * Creates a new notification.
 * @param {object} data - Notification data
 * @param {number} data.user_id - Target user ID
 * @param {number} [data.report_id] - Related report ID
 * @param {string} data.title - Notification title
 * @param {string} data.text - Notification body text
 * @param {string} [data.status] - Related report status
 * @returns {Promise<object>} Created notification
 */
async function create(data) {
  const { user_id, report_id, title, text, status } = data;
  const result = await db.query(
    `INSERT INTO notifications (user_id, report_id, title, text, status)
     VALUES (?, ?, ?, ?, ?)`,
    [user_id, report_id || null, title, text || null, status || null]
  );

  const insertId = result.insertId || result.lastInsertRowid;
  const rows = await db.query('SELECT * FROM notifications WHERE id = ?', [insertId]);
  return rows[0] || null;
}

/* --------------------------------------------------------------------------
 * 4. countUnread
 * -------------------------------------------------------------------------- */

/**
 * Counts unread notifications for a user.
 * @param {number} userId - The user ID
 * @returns {Promise<number>} Unread count
 */
async function countUnread(userId) {
  const rows = await db.query(
    'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  );
  return Number(rows[0].total) || 0;
}

/* --------------------------------------------------------------------------
 * 5. markAsRead
 * -------------------------------------------------------------------------- */

/**
 * Marks a notification as read.
 * @param {number} id - Notification ID
 * @param {number} userId - User ID (for ownership verification)
 * @returns {Promise<object>} Update result
 */
async function markAsRead(id, userId) {
  return db.query(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [id, userId]
  );
}

/**
 * Marks all notifications for a user as read.
 * @param {number} userId - The user ID
 * @returns {Promise<object>} Update result
 */
async function markAllAsRead(userId) {
  return db.query(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
    [userId]
  );
}

module.exports = { findByUserId, create, countUnread, markAsRead, markAllAsRead };
