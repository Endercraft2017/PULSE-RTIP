/**
 * =============================================================================
 * Report Model
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. findAll      - List reports with optional filters
 * 3. findById     - Find a single report by ID
 * 4. findByUserId - Find all reports by a specific user
 * 5. create       - Create a new incident report
 * 6. updateStatus - Update a report's status
 * 7. getStats     - Get dashboard statistics counts
 *
 * Data access layer for the reports table.
 * =============================================================================
 */

const db = require('../config/database');

/* --------------------------------------------------------------------------
 * 2. findAll
 * -------------------------------------------------------------------------- */

/**
 * Lists reports with optional filters.
 * @param {object} [filters={}] - Filter options
 * @param {string} [filters.status] - Filter by status
 * @param {string} [filters.type] - Filter by incident type
 * @param {string} [filters.search] - Search in title and description
 * @returns {Promise<Array>} Array of report objects
 */
async function findAll(filters = {}) {
  let sql = `
    SELECT r.*, u.name AS submitted_by_name
    FROM reports r
    LEFT JOIN users u ON r.submitted_by = u.id
    WHERE 1=1
  `;
  const params = [];

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
 * Finds a single report by ID, including the submitter's name.
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
 * Finds all reports submitted by a specific user.
 * @param {number} userId - The user ID
 * @param {object} [filters={}] - Optional status filter
 * @returns {Promise<Array>} Array of report objects
 */
async function findByUserId(userId, filters = {}) {
  let sql = `
    SELECT r.*, u.name AS submitted_by_name
    FROM reports r
    LEFT JOIN users u ON r.submitted_by = u.id
    WHERE r.submitted_by = ?
  `;
  const params = [userId];

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
  const { title, type, description, location, latitude, longitude, submitted_by } = data;

  const result = await db.query(
    `INSERT INTO reports (title, type, description, location, latitude, longitude, submitted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, type, description || null, location || null, latitude || null, longitude || null, submitted_by]
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

/* --------------------------------------------------------------------------
 * 7. getStats
 * -------------------------------------------------------------------------- */

/**
 * Gets dashboard statistics (counts by status).
 * @returns {Promise<object>} Stats object with counts
 */
async function getStats() {
  const rows = await db.query(
    `SELECT
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
       SUM(CASE WHEN status = 'investigating' THEN 1 ELSE 0 END) AS investigating_count,
       SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count
     FROM reports`
  );

  const stats = rows[0] || {};
  return {
    pendingCount: Number(stats.pending_count) || 0,
    investigatingCount: Number(stats.investigating_count) || 0,
    resolvedCount: Number(stats.resolved_count) || 0,
  };
}

module.exports = { findAll, findById, findByUserId, create, updateStatus, getStats };
