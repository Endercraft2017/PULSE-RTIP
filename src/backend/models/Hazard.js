/**
 * =============================================================================
 * Hazard Model
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. findAll - List all hazard alerts
 * 3. create  - Create a new hazard alert
 * 4. count   - Count total active hazards
 *
 * Data access layer for the hazard_alerts table.
 * =============================================================================
 */

const db = require('../config/database');

/* --------------------------------------------------------------------------
 * 2. findAll
 * -------------------------------------------------------------------------- */

/**
 * Lists all hazard alerts, newest first.
 * @returns {Promise<Array>} Array of hazard alert objects
 */
async function findAll() {
  return db.query(
    'SELECT * FROM hazard_alerts ORDER BY created_at DESC'
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
  const { title, severity, location, description, latitude, longitude, created_by } = data;
  const result = await db.query(
    `INSERT INTO hazard_alerts
       (title, severity, location, description, latitude, longitude, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      severity,
      location || null,
      description || null,
      latitude != null ? Number(latitude) : null,
      longitude != null ? Number(longitude) : null,
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
 * Counts total active hazard alerts.
 * @returns {Promise<number>} Total hazard count
 */
async function count() {
  const rows = await db.query('SELECT COUNT(*) AS total FROM hazard_alerts');
  return Number(rows[0].total) || 0;
}

module.exports = { findAll, create, count };
