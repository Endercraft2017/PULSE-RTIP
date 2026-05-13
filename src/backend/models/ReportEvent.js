/**
 * =============================================================================
 * ReportEvent Model
 * =============================================================================
 *
 * Processing history for reports. One row per status change (or other
 * auditable action) on a report. Citizens view the history of their own
 * reports; admins view all.
 * =============================================================================
 */

const db = require('../config/database');

/**
 * Inserts a new report event.
 * @param {object} data
 * @param {number} data.report_id
 * @param {number} data.actor_user_id
 * @param {string} data.action
 * @param {string|null} [data.from_status]
 * @param {string|null} [data.to_status]
 * @param {string|null} [data.note]
 * @returns {Promise<object>} Inserted row
 */
async function create(data) {
  const { report_id, actor_user_id, action, from_status, to_status, note } = data;
  const result = await db.query(
    `INSERT INTO report_events (report_id, actor_user_id, action, from_status, to_status, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [report_id, actor_user_id, action, from_status || null, to_status || null, note || null]
  );

  const insertId = result.insertId || result.lastInsertRowid;
  const rows = await db.query('SELECT * FROM report_events WHERE id = ?', [insertId]);
  return rows[0] || null;
}

/**
 * Returns the event timeline for a report, oldest first, with actor name
 * joined in for display.
 * @param {number} reportId
 * @returns {Promise<Array>}
 */
async function findByReport(reportId) {
  return db.query(
    `SELECT e.*, u.name AS actor_name, u.role AS actor_role
       FROM report_events e
       LEFT JOIN users u ON u.id = e.actor_user_id
      WHERE e.report_id = ?
      ORDER BY e.created_at ASC, e.id ASC`,
    [reportId]
  );
}

module.exports = { create, findByReport };
