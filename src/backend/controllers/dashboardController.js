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

    res.json({
      success: true,
      data: {
        ...reportStats,
        hazardsCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats };
