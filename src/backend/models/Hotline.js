/**
 * =============================================================================
 * Hotline Model
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. findAll - List all emergency hotlines
 *
 * Data access layer for the emergency_hotlines table.
 * =============================================================================
 */

const db = require('../config/database');

/* --------------------------------------------------------------------------
 * 2. findAll
 * -------------------------------------------------------------------------- */

/**
 * Lists all emergency hotlines, ordered by sort_order.
 * @returns {Promise<Array>} Array of hotline objects
 */
async function findAll() {
  return db.query('SELECT * FROM emergency_hotlines ORDER BY sort_order ASC');
}

module.exports = { findAll };
