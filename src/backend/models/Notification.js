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

// Statuses an admin still considers "open / needs attention". Notifications
// tied to reports outside this set are filtered out of the admin inbox + bell
// badge so those measures align with the dashboard's "Pending" tile.
const ADMIN_OPEN_STATUSES = ['submitted', 'pending', 'investigating', 'in_progress', 'pending_confirmation'];
const ADMIN_OPEN_PLACEHOLDERS = ADMIN_OPEN_STATUSES.map(() => '?').join(',');

/* --------------------------------------------------------------------------
 * 2. findByUserId
 * -------------------------------------------------------------------------- */

/**
 * Gets all notifications for a specific user, newest first.
 *
 * For admins, notifications about reports that have already been
 * resolved/rejected/cancelled are hidden so the inbox matches the
 * dashboard's open-workload counters. Citizens always see their full
 * personal history.
 *
 * @param {number} userId - The user ID
 * @param {string} [role] - 'admin' triggers the open-report filter
 * @returns {Promise<Array>} Array of notification objects
 */
async function findByUserId(userId, role) {
  // LEFT JOIN reports so the notification card can show the report's
  // current status, not the status snapshot taken when the notification
  // was created (which goes stale as the report moves through workflow).
  if (role === 'admin') {
    return db.query(
      `SELECT n.*, r.status AS report_current_status
         FROM notifications n
         LEFT JOIN reports r ON r.id = n.report_id
        WHERE n.user_id = ?
          AND (n.report_id IS NULL OR r.status IN (${ADMIN_OPEN_PLACEHOLDERS}))
        ORDER BY n.created_at DESC`,
      [userId, ...ADMIN_OPEN_STATUSES]
    );
  }
  return db.query(
    `SELECT n.*, r.status AS report_current_status
       FROM notifications n
       LEFT JOIN reports r ON r.id = n.report_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC`,
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
  const { user_id, report_id, title, text, status, type, actor_user_id } = data;
  const result = await db.query(
    `INSERT INTO notifications (user_id, report_id, title, text, status, type, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user_id, report_id || null, title, text || null, status || null, type || null, actor_user_id || null]
  );

  const insertId = result.insertId || result.lastInsertRowid;
  const rows = await db.query('SELECT * FROM notifications WHERE id = ?', [insertId]);
  return rows[0] || null;
}

/**
 * Deletes notifications by type + actor (used to clean up an admin-request
 * notification across all admins after it is approved/rejected).
 */
async function deleteByTypeAndActor(type, actor_user_id) {
  return db.query(
    'DELETE FROM notifications WHERE type = ? AND actor_user_id = ?',
    [type, actor_user_id]
  );
}

/* --------------------------------------------------------------------------
 * 4. countUnread
 * -------------------------------------------------------------------------- */

/**
 * Counts unread notifications for a user.
 *
 * For admins, only unread notifications whose related report is still in
 * an "open" status (or notifications without an attached report) count
 * toward the bell badge — this keeps the badge aligned with the
 * dashboard's pending-work counters and prevents stale entries about
 * already-resolved reports from inflating the number.
 *
 * @param {number} userId - The user ID
 * @param {string} [role] - 'admin' triggers the open-report filter
 * @returns {Promise<number>} Unread count
 */
async function countUnread(userId, role) {
  if (role === 'admin') {
    const rows = await db.query(
      `SELECT COUNT(*) AS total
         FROM notifications n
         LEFT JOIN reports r ON r.id = n.report_id
        WHERE n.user_id = ?
          AND n.is_read = 0
          AND (n.report_id IS NULL OR r.status IN (${ADMIN_OPEN_PLACEHOLDERS}))`,
      [userId, ...ADMIN_OPEN_STATUSES]
    );
    return Number(rows[0].total) || 0;
  }
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

/**
 * Marks every notification tied to a given report as read (across all users).
 * Used when an admin acts on a report so the "new report" inbox entries
 * across all admins resolve automatically.
 * @param {number} reportId
 */
async function markReadByReportId(reportId) {
  return db.query(
    'UPDATE notifications SET is_read = 1 WHERE report_id = ? AND is_read = 0',
    [reportId]
  );
}

module.exports = { findByUserId, create, deleteByTypeAndActor, countUnread, markAsRead, markAllAsRead, markReadByReportId };
