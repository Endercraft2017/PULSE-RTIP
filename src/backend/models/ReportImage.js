/**
 * =============================================================================
 * ReportImage Model
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. create         - Link an image file to a report
 * 3. findByReportId - Get all images for a report
 *
 * Data access layer for the report_images table.
 * =============================================================================
 */

const db = require('../config/database');

/* --------------------------------------------------------------------------
 * 2. create
 * -------------------------------------------------------------------------- */

/**
 * Links an uploaded image file to a report.
 * @param {number} reportId - The report ID
 * @param {string} filePath - The file path/URL of the uploaded image
 * @returns {Promise<object>} Insert result
 */
async function create(reportId, filePath) {
  return db.query(
    'INSERT INTO report_images (report_id, file_path) VALUES (?, ?)',
    [reportId, filePath]
  );
}

/* --------------------------------------------------------------------------
 * 3. findByReportId
 * -------------------------------------------------------------------------- */

/**
 * Gets all images for a specific report.
 * @param {number} reportId - The report ID
 * @returns {Promise<Array>} Array of image objects
 */
async function findByReportId(reportId) {
  return db.query(
    'SELECT * FROM report_images WHERE report_id = ? ORDER BY uploaded_at ASC',
    [reportId]
  );
}

module.exports = { create, findByReportId };
