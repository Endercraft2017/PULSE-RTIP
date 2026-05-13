/**
 * =============================================================================
 * Hazard Model
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. findAll          - List hazard alerts (excludes binned by default)
 * 3. create           - Create a new hazard alert
 * 4. count            - Count active hazards
 * 5. findById / update
 * 6. remove           - Soft-delete (move to bin)
 * 7. restore          - Restore from bin
 * 8. permanentRemove  - Hard-delete
 * 9. findDeleted      - List binned hazards
 *
 * Data access layer for the hazard_alerts table.
 * =============================================================================
 */

const db = require('../config/database');

/* --------------------------------------------------------------------------
 * 2. findAll
 * -------------------------------------------------------------------------- */

/**
 * Lists hazard alerts, newest first. By default, soft-deleted (binned) rows
 * are excluded — pass `includeDeleted: true` for the admin Bin view.
 *
 * @param {object} [filters={}]
 * @param {boolean} [filters.includeDeleted=false]
 * @returns {Promise<Array>}
 */
async function findAll(filters = {}) {
  const includeDeleted = filters && filters.includeDeleted;
  const where = includeDeleted ? '' : ' WHERE deleted_at IS NULL';
  return db.query(
    `SELECT * FROM hazard_alerts${where} ORDER BY created_at DESC`
  );
}

/* --------------------------------------------------------------------------
 * 3. create
 * -------------------------------------------------------------------------- */

/**
 * Creates a new hazard alert.
 * @param {object} data - Hazard data
 * @param {string} data.title - Alert title
 * @param {string} data.severity - Severity level (high, medium, low)
 * @param {string} data.location - Affected location (free text)
 * @param {string} data.description - Alert description
 * @param {number} [data.latitude] - Optional GPS latitude (-90 to 90)
 * @param {number} [data.longitude] - Optional GPS longitude (-180 to 180)
 * @param {number} data.created_by - Admin user ID
 * @returns {Promise<object>} Created hazard alert
 */
async function create(data) {
  const { title, severity, location, description, latitude, longitude, resolved_address, created_by } = data;
  const result = await db.query(
    `INSERT INTO hazard_alerts
       (title, severity, location, description, latitude, longitude, resolved_address, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      severity,
      location || null,
      description || null,
      latitude != null ? Number(latitude) : null,
      longitude != null ? Number(longitude) : null,
      resolved_address || null,
      created_by,
    ]
  );

  const insertId = result.insertId || result.lastInsertRowid;
  const rows = await db.query('SELECT * FROM hazard_alerts WHERE id = ?', [insertId]);
  return rows[0] || null;
}

/* --------------------------------------------------------------------------
 * 4. count
 * -------------------------------------------------------------------------- */

/**
 * Counts active (non-binned) hazard alerts.
 * @returns {Promise<number>} Total hazard count
 */
async function count() {
  const rows = await db.query(
    'SELECT COUNT(*) AS total FROM hazard_alerts WHERE deleted_at IS NULL'
  );
  return Number(rows[0].total) || 0;
}

/* --------------------------------------------------------------------------
 * 5. findById / update
 * -------------------------------------------------------------------------- */

/**
 * Finds a hazard by ID. Soft-deleted rows are still returned so the admin
 * Bin view can inspect them.
 */
async function findById(id) {
  const rows = await db.query('SELECT * FROM hazard_alerts WHERE id = ?', [id]);
  return rows[0] || null;
}

/**
 * Edits an existing hazard. Only the supplied fields are updated.
 */
async function update(id, data) {
  const fields = [];
  const values = [];
  const allowed = ['title', 'severity', 'location', 'description', 'latitude', 'longitude', 'resolved_address'];
  for (const k of allowed) {
    if (data[k] !== undefined) {
      fields.push(`${k} = ?`);
      values.push(data[k] === '' ? null : data[k]);
    }
  }
  if (fields.length === 0) return findById(id);
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  await db.query(`UPDATE hazard_alerts SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
}

/* --------------------------------------------------------------------------
 * 6. remove (soft-delete)
 * -------------------------------------------------------------------------- */

/**
 * Soft-deletes a hazard alert by stamping deleted_at. The citizen home
 * screen pulls live from /api/hazards (which filters deleted_at IS NULL),
 * so the alert disappears from the "Active Hazard Alerts" list immediately.
 * Restore via Hazard.restore.
 *
 * @param {number} id - Hazard ID
 * @returns {Promise<void>}
 */
async function remove(id) {
  await db.query(
    'UPDATE hazard_alerts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id]
  );
}

/* --------------------------------------------------------------------------
 * 7. restore
 * -------------------------------------------------------------------------- */

/**
 * Restores a soft-deleted hazard by clearing deleted_at.
 */
async function restore(id) {
  await db.query(
    'UPDATE hazard_alerts SET deleted_at = NULL WHERE id = ?',
    [id]
  );
}

/* --------------------------------------------------------------------------
 * 8. permanentRemove (hard-delete)
 * -------------------------------------------------------------------------- */

/**
 * Permanently deletes a hazard. hazard_alerts is a leaf table — no child
 * FKs to clean up, so a single DELETE is sufficient.
 */
async function permanentRemove(id) {
  await db.query('DELETE FROM hazard_alerts WHERE id = ?', [id]);
}

/* --------------------------------------------------------------------------
 * 9. findDeleted
 * -------------------------------------------------------------------------- */

/**
 * Returns soft-deleted hazards for the admin Bin view, newest-binned first.
 */
async function findDeleted() {
  return db.query(
    `SELECT * FROM hazard_alerts
     WHERE deleted_at IS NOT NULL
     ORDER BY deleted_at DESC`
  );
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
  restore,
  permanentRemove,
  findDeleted,
  count,
};
