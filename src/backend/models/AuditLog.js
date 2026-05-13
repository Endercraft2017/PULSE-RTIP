/**
 * =============================================================================
 * AuditLog Model
 * =============================================================================
 *
 * Append-only trail of privileged admin actions. `details` stores an
 * optional JSON-serializable payload (who got approved, which fields
 * changed, etc.) — stringified on write, parsed on read.
 * =============================================================================
 */

const db = require('../config/database');

/**
 * Inserts an audit entry. `details` may be any JSON-serializable value
 * (object preferred); null is allowed.
 */
async function create(data) {
  const { actor_user_id, action, target_type, target_id, details } = data;

  let detailsJson = null;
  if (details != null) {
    // Never let a bad `details` payload prevent the primary admin action
    // from being logged — fall back to a stringified message.
    try {
      detailsJson = typeof details === 'string' ? details : JSON.stringify(details);
    } catch (_) {
      detailsJson = String(details);
    }
  }

  const result = await db.query(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, details)
     VALUES (?, ?, ?, ?, ?)`,
    [actor_user_id, action, target_type || null, target_id || null, detailsJson]
  );

  const insertId = result.insertId || result.lastInsertRowid;
  const rows = await db.query('SELECT * FROM audit_log WHERE id = ?', [insertId]);
  return rows[0] || null;
}

/**
 * Returns the most recent audit log entries. Supports basic pagination
 * and an optional actor filter so an admin can look at just their own
 * activity.
 * @param {object} opts
 * @param {number} [opts.limit=50]
 * @param {number} [opts.offset=0]
 * @param {number} [opts.actor_user_id]
 */
async function findRecent(opts = {}) {
  const limit = Math.max(1, Math.min(500, Number(opts.limit) || 50));
  const offset = Math.max(0, Number(opts.offset) || 0);

  let sql = `
    SELECT a.*, u.name AS actor_name, u.role AS actor_role, u.email AS actor_email
      FROM audit_log a
      LEFT JOIN users u ON u.id = a.actor_user_id
  `;
  const params = [];
  if (opts.actor_user_id) {
    sql += ' WHERE a.actor_user_id = ?';
    params.push(opts.actor_user_id);
  }
  sql += ' ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = await db.query(sql, params);
  return rows.map(row => ({
    ...row,
    details: parseDetails(row.details),
  }));
}

/**
 * Total count (for pagination). Mirrors findRecent's filter.
 */
async function countAll(opts = {}) {
  let sql = 'SELECT COUNT(*) AS total FROM audit_log';
  const params = [];
  if (opts.actor_user_id) {
    sql += ' WHERE actor_user_id = ?';
    params.push(opts.actor_user_id);
  }
  const rows = await db.query(sql, params);
  return Number(rows[0] && rows[0].total) || 0;
}

function parseDetails(raw) {
  if (raw == null || raw === '') return null;
  try { return JSON.parse(raw); }
  catch (_) { return raw; }
}

module.exports = { create, findRecent, countAll };
