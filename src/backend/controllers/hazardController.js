/**
 * =============================================================================
 * Hazard Controller
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. getHazards   - List all hazard alerts
 * 3. createHazard - Create a new hazard alert (admin only) + SMS broadcast
 * 4. buildAlertMessage - Compose the emergency SMS body
 *
 * Handles hazard alert operations.
 * =============================================================================
 */

const Hazard = require('../models/Hazard');
const User = require('../models/User');
const textbee = require('../services/sms/textbee');
const { getTipsFor } = require('../services/hazard/tips');

/* --------------------------------------------------------------------------
 * 2. getHazards
 * -------------------------------------------------------------------------- */

async function getHazards(req, res, next) {
  try {
    const hazards = await Hazard.findAll();
    res.json({ success: true, data: hazards });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 4. buildAlertMessage
 * -------------------------------------------------------------------------- */

/**
 * Composes the emergency SMS body including severity, title, location,
 * coordinates (with a Google Maps link), and hazard-specific safety tips.
 * @param {object} hazard - Stored hazard row
 * @returns {string}
 */
function buildAlertMessage(hazard) {
  const severity = String(hazard.severity || '').toUpperCase();
  const lines = [];

  lines.push(`[PULSE 911 ALERT - ${severity}]`);
  lines.push(hazard.title);

  if (hazard.location) {
    lines.push(`Location: ${hazard.location}`);
  }

  // Include GPS + a tap-to-open Google Maps link when coordinates are set
  if (hazard.latitude != null && hazard.longitude != null) {
    const lat = Number(hazard.latitude).toFixed(5);
    const lng = Number(hazard.longitude).toFixed(5);
    lines.push(`GPS: ${lat}, ${lng}`);
    lines.push(`Map: https://maps.google.com/?q=${lat},${lng}`);
  }

  if (hazard.description) {
    lines.push('');
    lines.push(hazard.description);
  }

  // Type-specific safety tips (flood / fire / landslide / typhoon / etc.)
  const tips = getTipsFor(hazard.title);
  if (tips && tips.length) {
    lines.push('');
    lines.push('SAFETY TIPS:');
    for (const tip of tips) lines.push(`- ${tip}`);
  }

  lines.push('');
  lines.push('Follow MDRRMO Morong instructions.');

  return lines.join('\n');
}

/* --------------------------------------------------------------------------
 * 3. createHazard
 * -------------------------------------------------------------------------- */

/**
 * Creates a new hazard alert. Admin-only. On success, broadcasts an
 * emergency SMS to every registered user (citizens AND admins) so
 * both residents and responders get the confirmation.
 *
 * @param {object} req - Express request
 *   body: { title, severity, location, description, latitude, longitude }
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function createHazard(req, res, next) {
  try {
    const { title, severity, location, description, latitude, longitude } = req.body;

    const hazard = await Hazard.create({
      title,
      severity,
      location,
      description,
      latitude,
      longitude,
      created_by: req.user.id,
    });

    // Fire-and-forget SMS broadcast. Both citizens and admins get notified.
    if (textbee.isConfigured()) {
      const msg = buildAlertMessage(hazard);

      User.findAllPhones()
        .then(phones => {
          if (phones.length > 0) return textbee.sendBulkSMS(phones, msg);
        })
        .then(results => {
          if (results) console.log(`[SMS] Hazard alert broadcast to ${results.length} batch(es)`);
        })
        .catch(err => console.error('[SMS] Failed to send hazard alert:', err.message));
    }

    res.status(201).json({
      success: true,
      data: hazard,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getHazards, createHazard };
