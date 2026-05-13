/**
 * =============================================================================
 * Dashboard Controller
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. getStats - Get dashboard statistics (admin only)
 *
 * Provides aggregated statistics for the admin dashboard.
 * =============================================================================
 */

const Report = require('../models/Report');
const Hazard = require('../models/Hazard');
const db = require('../config/database');

// "Logged in" is approximated by "active in the last 5 minutes" — i.e. has hit
// any authenticated endpoint within the window. The auth middleware bumps
// users.last_seen_at (throttled) so this stays cheap.
const ACTIVE_WINDOW_MINUTES = 5;

/* --------------------------------------------------------------------------
 * 2. getStats
 * -------------------------------------------------------------------------- */

/**
 * Returns dashboard statistics: report counts by status and total hazards.
 * Admin only.
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function getStats(req, res, next) {
  try {
    const reportStats = await Report.getStats();
    const hazardsCount = await Hazard.count();

    // User counters for the analytics page.
    const regRows = await db.query(
      'SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL'
    );
    const activeRows = await db.query(
      `SELECT COUNT(*) AS total FROM users
       WHERE deleted_at IS NULL
         AND last_seen_at IS NOT NULL
         AND datetime(last_seen_at) >= datetime('now', ?)`,
      [`-${ACTIVE_WINDOW_MINUTES} minutes`]
    );

    res.json({
      success: true,
      data: {
        ...reportStats,
        hazardsCount,
        registeredCount: Number(regRows[0].total) || 0,
        loggedInCount: Number(activeRows[0].total) || 0,
        loggedInWindowMinutes: ACTIVE_WINDOW_MINUTES,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats };
