/**
 * =============================================================================
 * Hazard Controller
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. getHazards  - List all hazard alerts
 * 3. createHazard - Create a new hazard alert (admin only)
 *
 * Handles hazard alert operations.
 * =============================================================================
 */

const Hazard = require('../models/Hazard');

/* --------------------------------------------------------------------------
 * 2. getHazards
 * -------------------------------------------------------------------------- */

/**
 * Lists all active hazard alerts.
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function getHazards(req, res, next) {
  try {
    const hazards = await Hazard.findAll();
    res.json({
      success: true,
      data: hazards,
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 3. createHazard
 * -------------------------------------------------------------------------- */

/**
 * Creates a new hazard alert. Admin only.
 *
 * @param {object} req - Express request (body: { title, severity, location, description })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function createHazard(req, res, next) {
  try {
    const { title, severity, location, description } = req.body;
    const hazard = await Hazard.create({
      title,
      severity,
      location,
      description,
      created_by: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: hazard,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getHazards, createHazard };
