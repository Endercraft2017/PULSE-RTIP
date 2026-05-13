/**
 * =============================================================================
 * Report Model
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. findAll          - List reports with optional filters
 * 3. findById         - Find a single report by ID (binned rows still returned)
 * 4. findByUserId     - Find all reports by a specific user
 * 5. create           - Create a new incident report
 * 6. updateStatus     - Update a report's status
 * 7. getStats         - Get dashboard statistics counts
 * 8. remove           - Soft-delete (move to bin)
 * 9. restore          - Restore from bin
 * 10. permanentRemove - Hard-delete + cascade child rows
 * 11. findDeleted     - List rows currently in the bin
 *
 * Data access layer for the reports table.
 * =============================================================================
 */

const db = require('../config/database');

/* --------------------------------------------------------------------------
 * 2. findAll
 * -------------------------------------------------------------------------- */

/**
 * Lists reports with optional filters. By default, soft-deleted (binned)
 * rows are excluded — pass `includeDeleted: true` to surface them (used by
 * the admin Bin view).
 *
 * @param {object} [filters={}] - Filter options
 * @param {string} [filters.status] - Filter by status
 * @param {string} [filters.type] - Filter by incident type
 * @param {string} [filters.search] - Search in title and description
 * @param {boolean} [filters.includeDeleted=false] - Include soft-deleted rows
 * @returns {Promise<Array>} Array of report objects
 */
async function findAll(filters = {}) {
  // LEFT JOIN community_posts so we can (a) surface the promoted_to_post_id
  // on each row and (b) exclude resolved+promoted reports from list views.
  let sql = `
    SELECT r.*, u.name AS submitted_by_name, p.id AS promoted_to_post_id
    FROM reports r
    LEFT JOIN users u ON r.submitted_by = u.id
    LEFT JOIN community_posts p ON p.promoted_from_report_id = r.id
    WHERE 1=1
  `;
  const params = [];

  // Recycle-bin filter — critical so binned items vanish from normal lists.
  if (!filters.includeDeleted) {
    sql += ' AND r.deleted_at IS NULL';
  }

  // Hide resolved reports that have already been promoted — declutter rule.
  if (!filters.includePromoted) {
    sql += " AND NOT (r.status = 'resolved' AND p.id IS NOT NULL)";
  }

  if (filters.status) {
    sql += ' AND r.status = ?';
    params.push(filters.status);
  }
  if (filters.type) {
    sql += ' AND r.type = ?';
    params.push(filters.type);
  }
  if (filters.search) {
    sql += ' AND (r.title LIKE ? OR r.description LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  sql += ' ORDER BY r.created_at DESC';
  return db.query(sql, params);
}

/* --------------------------------------------------------------------------
 * 3. findById
 * -------------------------------------------------------------------------- */

/**
 * Finds a single report by ID, including the submitter's name. Soft-deleted
 * rows are intentionally still returned — the admin Bin view needs to inspect
 * them to render restore / permanent-delete actions.
 *
 * @param {number} id - Report ID
 * @returns {Promise<object|null>} Report object or null
 */
async function findById(id) {
  const rows = await db.query(
    `SELECT r.*, u.name AS submitted_by_name
     FROM reports r
     LEFT JOIN users u ON r.submitted_by = u.id
     WHERE r.id = ?`,
    [id]
  );
  return rows[0] || null;
}

/* --------------------------------------------------------------------------
 * 4. findByUserId
 * -------------------------------------------------------------------------- */

/**
 * Finds all reports submitted by a specific user. Citizen views (my-reports)
 * MUST never show binned items — the deleted_at filter here enforces that.
 *
 * @param {number} userId - The user ID
 * @param {object} [filters={}] - Optional status filter
 * @returns {Promise<Array>} Array of report objects
 */
async function findByUserId(userId, filters = {}) {
  let sql = `
    SELECT r.*, u.name AS submitted_by_name, p.id AS promoted_to_post_id
    FROM reports r
    LEFT JOIN users u ON r.submitted_by = u.id
    LEFT JOIN community_posts p ON p.promoted_from_report_id = r.id
    WHERE r.submitted_by = ?
      AND r.deleted_at IS NULL
  `;
  const params = [userId];

  // Same declutter rule as findAll — hide resolved reports already promoted.
  if (!filters.includePromoted) {
    sql += " AND NOT (r.status = 'resolved' AND p.id IS NOT NULL)";
  }

  if (filters.status) {
    sql += ' AND r.status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY r.created_at DESC';
  return db.query(sql, params);
}

/* --------------------------------------------------------------------------
 * 5. create
 * -------------------------------------------------------------------------- */

/**
 * Creates a new incident report.
 * @param {object} data - Report data
 * @param {string} data.title - Report title
 * @param {string} data.type - Incident type
 * @param {string} data.description - Description
 * @param {string} data.location - Location text
 * @param {number} [data.latitude] - GPS latitude
 * @param {number} [data.longitude] - GPS longitude
 * @param {number} data.submitted_by - User ID of the submitter
 * @returns {Promise<object>} Created report
 */
async function create(data) {
  const { title, type, description, location, latitude, longitude, video_path, submitted_by } = data;

  const result = await db.query(
    `INSERT INTO reports (title, type, description, location, latitude, longitude, video_path, submitted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, type, description || null, location || null, latitude || null, longitude || null, video_path || null, submitted_by]
  );

  const insertId = result.insertId || result.lastInsertRowid;
  return findById(insertId);
}

/* --------------------------------------------------------------------------
 * 6. updateStatus
 * -------------------------------------------------------------------------- */

/**
 * Updates a report's status.
 * @param {number} id - Report ID
 * @param {string} status - New status value
 * @returns {Promise<object|null>} Updated report or null
 */
async function updateStatus(id, status) {
  await db.query(
    'UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, id]
  );
  return findById(id);
}

/**
 * Updates editable report fields. Only the supplied fields are touched.
 */
async function update(id, data) {
  const fields = [];
  const values = [];
  const allowed = ['title', 'type', 'description', 'location', 'latitude', 'longitude'];
  for (const k of allowed) {
    if (data[k] !== undefined) {
      fields.push(`${k} = ?`);
      values.push(data[k] === '' ? null : data[k]);
    }
  }
  if (fields.length === 0) return findById(id);
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  await db.query(`UPDATE reports SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
}

/* --------------------------------------------------------------------------
 * 7. getStats
 * -------------------------------------------------------------------------- */

/**
 * Gets dashboard statistics (counts by status). Excludes binned reports —
 * a soft-deleted item must not pad any tile.
 * @returns {Promise<object>} Stats object with counts
 */
async function getStats() {
  // New reports default to status='submitted', but the dashboard exposes
  // them in the "pending" bucket — fold both states into pending_count so
  // fresh reports don't read as 0. Likewise the "investigating" tile
  // covers the whole active-work band (investigating + in_progress +
  // pending_confirmation) so admins see a true open-workload count.
  // Match the list-view declutter rule: a resolved report that's already
  // been promoted to a community post no longer counts here either.
  const rows = await db.query(
    `SELECT
       SUM(CASE WHEN r.status IN ('submitted', 'pending') THEN 1 ELSE 0 END) AS pending_count,
       SUM(CASE WHEN r.status IN ('investigating', 'in_progress', 'pending_confirmation') THEN 1 ELSE 0 END) AS investigating_count,
       SUM(CASE WHEN r.status = 'resolved' AND p.id IS NULL THEN 1 ELSE 0 END) AS resolved_count
     FROM reports r
     LEFT JOIN community_posts p ON p.promoted_from_report_id = r.id
     WHERE r.deleted_at IS NULL`
  );

  const stats = rows[0] || {};
  return {
    pendingCount: Number(stats.pending_count) || 0,
    investigatingCount: Number(stats.investigating_count) || 0,
    resolvedCount: Number(stats.resolved_count) || 0,
  };
}

/* --------------------------------------------------------------------------
 * 8. remove (soft-delete)
 * -------------------------------------------------------------------------- */

/**
 * Soft-deletes a report by stamping deleted_at. Child rows (images, events,
 * notifications, promoted posts) are intentionally left intact so a restore
 * brings the report back fully wired. To purge the row + cascade, use
 * permanentRemove.
 *
 * @param {number} id - Report ID
 * @returns {Promise<void>}
 */
async function remove(id) {
  await db.query(
    'UPDATE reports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id]
  );
}

/* --------------------------------------------------------------------------
 * 9. restore
 * -------------------------------------------------------------------------- */

/**
 * Restores a soft-deleted report by clearing deleted_at.
 * @param {number} id - Report ID
 * @returns {Promise<void>}
 */
async function restore(id) {
  await db.query(
    'UPDATE reports SET deleted_at = NULL WHERE id = ?',
    [id]
  );
}

/* --------------------------------------------------------------------------
 * 10. permanentRemove (hard-delete)
 * -------------------------------------------------------------------------- */

/**
 * Permanently deletes a report and its dependent rows. Order matters because
 * none of the child FKs declare ON DELETE CASCADE in the migration: clearing
 * them first prevents "FOREIGN KEY constraint failed".
 *
 * Note: a community_post that was promoted from this report is intentionally
 * preserved — published posts have their own life cycle. We just NULL out the
 * back-pointer so the post survives.
 *
 * @param {number} id - Report ID
 * @returns {Promise<void>}
 */
async function permanentRemove(id) {
  await db.query('UPDATE community_posts SET promoted_from_report_id = NULL WHERE promoted_from_report_id = ?', [id]);
  await db.query('DELETE FROM report_images WHERE report_id = ?', [id]);
  await db.query('DELETE FROM report_events WHERE report_id = ?', [id]);
  await db.query('DELETE FROM notifications WHERE report_id = ?', [id]);
  await db.query('DELETE FROM reports WHERE id = ?', [id]);
}

/* --------------------------------------------------------------------------
 * 11. findDeleted
 * -------------------------------------------------------------------------- */

/**
 * Returns soft-deleted reports for the admin Bin view, newest-binned first.
 * @returns {Promise<Array>}
 */
async function findDeleted() {
  return db.query(
    `SELECT r.*, u.name AS submitted_by_name
     FROM reports r
     LEFT JOIN users u ON r.submitted_by = u.id
     WHERE r.deleted_at IS NOT NULL
     ORDER BY r.deleted_at DESC`
  );
}

module.exports = {
  findAll,
  findById,
  findByUserId,
  create,
  update,
  updateStatus,
  remove,
  restore,
  permanentRemove,
  findDeleted,
  getStats,
};
