/**
 * =============================================================================
 * Hazard Controller
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. getHazards   - List all hazard alerts
 * 3. createHazard - Create a hazard / announcement + SMS + push broadcast
 * 4. buildAlertMessage - Compose the emergency SMS body
 *
 * Handles hazard alert operations. A "hazard" is a localized safety alert
 * (default); an "announcement" shares the same pipeline but carries a
 * wider advisory (e.g. class suspension). Both broadcast via SMS AND push,
 * and both can be audience-scoped to 'all' citizens or a set of barangays.
 * =============================================================================
 */

const db = require('../config/database');
const Hazard = require('../models/Hazard');
const User = require('../models/User');
const PushToken = require('../models/PushToken');
const textbee = require('../services/sms/textbee');
const fcm = require('../services/push/fcm');
const { getTipsFor } = require('../services/hazard/tips');
const { reverseGeocode } = require('../services/geocode/nominatim');
const { logAction } = require('../middleware/auditLog');

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
 * Composes the emergency SMS body. When category='announcement' the prefix
 * flips to "PULSE 911 ANNOUNCEMENT:" and safety tips are skipped — an
 * announcement is an advisory, not a hazard-specific response playbook.
 * @param {object} hazard - Stored hazard row (includes category, audience, etc.)
 * @returns {string}
 */
function buildAlertMessage(hazard) {
  const category = String(hazard.category || 'hazard').toLowerCase();
  const isAnnouncement = category === 'announcement';
  const severity = String(hazard.severity || '').toUpperCase();
  const lines = [];

  if (isAnnouncement) {
    lines.push(`[PULSE 911 ANNOUNCEMENT${severity ? ' - ' + severity : ''}]`);
  } else {
    lines.push(`[PULSE 911 HAZARD - ${severity}]`);
  }
  lines.push(hazard.title);

  if (hazard.location) {
    lines.push(`Location: ${hazard.location}`);
  }

  // Include GPS + a tap-to-open Google Maps link when coordinates are set
  if (hazard.latitude != null && hazard.longitude != null) {
    const lat = Number(hazard.latitude).toFixed(5);
    const lng = Number(hazard.longitude).toFixed(5);

    if (hazard.resolved_address &&
        (!hazard.location || !hazard.location.toLowerCase().includes(hazard.resolved_address.toLowerCase().split(',')[0]))) {
      lines.push(`Area: ${hazard.resolved_address}`);
    }

    lines.push(`GPS: ${lat}, ${lng}`);
    lines.push(`Map: https://maps.google.com/?q=${lat},${lng}`);
  }

  if (hazard.description) {
    lines.push('');
    lines.push(hazard.description);
  }

  if (!isAnnouncement) {
    const tips = getTipsFor(hazard.title);
    if (tips && tips.length) {
      lines.push('');
      lines.push('SAFETY TIPS:');
      for (const tip of tips) lines.push(`- ${tip}`);
    }
  }

  lines.push('');
  lines.push('Follow MDRRMO Morong instructions.');

  return lines.join('\n');
}

/* --------------------------------------------------------------------------
 * 3. createHazard
 * -------------------------------------------------------------------------- */

/**
 * Creates a hazard or announcement record. Admin-only. On success, fans
 * the alert out via SMS and push, respecting the chosen audience scope.
 *
 * @param {object} req - Express request
 *   body: {
 *     title, severity, location, description, latitude, longitude,
 *     audience_type?: 'all' | 'barangay',
 *     audience_barangays?: string[],
 *     category?: 'hazard' | 'announcement',
 *     sound_enabled?: boolean | 0 | 1,
 *   }
 */
async function createHazard(req, res, next) {
  try {
    const {
      title, severity, location, description, latitude, longitude,
    } = req.body;

    // Normalize audience / category / sound inputs
    const rawAudienceType = String(req.body.audience_type || 'all').toLowerCase();
    const audience_type = rawAudienceType === 'barangay' ? 'barangay' : 'all';
    const audience_barangays = Array.isArray(req.body.audience_barangays)
      ? req.body.audience_barangays.filter(b => typeof b === 'string' && b.trim()).map(b => b.trim())
      : [];
    const category = String(req.body.category || 'hazard').toLowerCase() === 'announcement'
      ? 'announcement' : 'hazard';
    const sound_enabled = req.body.sound_enabled === false || req.body.sound_enabled === 0 ? 0 : 1;

    // Best-effort reverse-geocode so the SMS and detail view include the
    // resolved barangay/municipality. Never blocks creation.
    let resolved_address = null;
    if (latitude != null && longitude != null) {
      try {
        resolved_address = await reverseGeocode(latitude, longitude);
      } catch (_) { /* best-effort only */ }
    }

    const base = await Hazard.create({
      title,
      severity,
      location,
      description,
      latitude,
      longitude,
      resolved_address,
      created_by: req.user.id,
    });

    // Persist the new audience/category/sound columns directly — Hazard.create
    // was deliberately not broadened so this controller owns the extension.
    const audienceJson = audience_type === 'barangay' ? JSON.stringify(audience_barangays) : null;
    await db.query(
      `UPDATE hazard_alerts
          SET audience_type = ?, audience_barangays = ?, category = ?, sound_enabled = ?
        WHERE id = ?`,
      [audience_type, audienceJson, category, sound_enabled, base.id]
    );

    const rows = await db.query('SELECT * FROM hazard_alerts WHERE id = ?', [base.id]);
    const hazard = rows[0] || base;

    logAction(req.user.id, 'hazard_created', 'hazard', hazard.id, {
      title: hazard.title,
      severity: hazard.severity,
      location: hazard.location,
      category,
      audience_type,
      audience_barangays: audience_type === 'barangay' ? audience_barangays : undefined,
    });

    const msg = buildAlertMessage(hazard);

    // Fire-and-forget SMS broadcast, scoped to audience.
    if (textbee.isConfigured()) {
      User.findPhonesForAudience({ audience_type, audience_barangays })
        .then(phones => {
          if (phones.length > 0) return textbee.sendBulkSMS(phones, msg);
        })
        .then(results => {
          if (results) console.log(`[SMS] ${category} broadcast to ${results.length} batch(es) (audience=${audience_type})`);
        })
        .catch(err => console.error('[SMS] Failed to send hazard alert:', err.message));
    }

    // Fire-and-forget push broadcast, same audience filter. fcm.send is
    // a no-op (logs only) until the owner sets FCM_SERVER_KEY.
    PushToken.findTokensForAudience({ audience_type, audience_barangays })
      .then(rows => {
        const tokens = (rows || []).map(r => r.token).filter(Boolean);
        if (tokens.length === 0) return null;
        const title = category === 'announcement'
          ? `Announcement: ${hazard.title}`
          : `${String(hazard.severity || '').toUpperCase()} Hazard: ${hazard.title}`;
        const bodyText = hazard.description || hazard.location || 'Tap for details.';
        return fcm.send(tokens, {
          title,
          body: bodyText,
          sound: !!sound_enabled,
          data: {
            hazardId: String(hazard.id),
            category,
          },
        });
      })
      .then(res => {
        if (res) console.log(`[push] ${category} broadcast dispatched (batches=${res.batches ?? (res.devOnly ? 'dev' : 0)})`);
      })
      .catch(err => console.error('[push] Failed to send hazard push:', err.message));

    res.status(201).json({
      success: true,
      data: hazard,
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 5. updateHazard
 * -------------------------------------------------------------------------- */

/**
 * Edits an existing hazard. Admin-only. Does NOT re-broadcast SMS / push —
 * editing is a correction, not a new alert.
 */
async function updateHazard(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await Hazard.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Hazard not found.' });
    }

    const { title, severity, location, description, latitude, longitude } = req.body;

    // Re-resolve the address if coordinates changed
    let resolved_address;
    const latChanged = latitude != null && Number(latitude) !== Number(existing.latitude);
    const lngChanged = longitude != null && Number(longitude) !== Number(existing.longitude);
    if (latChanged || lngChanged) {
      try {
        resolved_address = await reverseGeocode(latitude, longitude);
      } catch (_) { /* best-effort only */ }
    }

    const updated = await Hazard.update(id, {
      title,
      severity,
      location,
      description,
      latitude: latitude != null ? Number(latitude) : undefined,
      longitude: longitude != null ? Number(longitude) : undefined,
      ...(resolved_address !== undefined ? { resolved_address } : {}),
    });

    // audience / category / sound_enabled live outside Hazard.update — write directly
    const updates = [];
    const params = [];
    if (req.body.category !== undefined) {
      updates.push('category = ?');
      params.push(String(req.body.category).toLowerCase() === 'announcement' ? 'announcement' : 'hazard');
    }
    if (req.body.audience_type !== undefined) {
      const t = String(req.body.audience_type).toLowerCase() === 'barangay' ? 'barangay' : 'all';
      updates.push('audience_type = ?');
      params.push(t);
      if (t === 'barangay' && Array.isArray(req.body.audience_barangays)) {
        updates.push('audience_barangays = ?');
        params.push(JSON.stringify(req.body.audience_barangays.filter(b => typeof b === 'string' && b.trim()).map(b => b.trim())));
      } else if (t === 'all') {
        updates.push('audience_barangays = NULL');
      }
    }
    if (req.body.sound_enabled !== undefined) {
      updates.push('sound_enabled = ?');
      params.push(req.body.sound_enabled === false || req.body.sound_enabled === 0 ? 0 : 1);
    }
    if (updates.length) {
      params.push(id);
      await db.query(`UPDATE hazard_alerts SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const final = await Hazard.findById(id);
    logAction(req.user.id, 'hazard_updated', 'hazard', id, { title: final.title });

    res.json({ success: true, data: final });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 6. deleteHazard — admin-only soft-delete (move to bin)
 * -------------------------------------------------------------------------- */

/**
 * Soft-deletes a hazard alert (moves it to the recycle bin). Admin-only.
 * The citizen home screen pulls live from /api/hazards (which filters
 * deleted_at IS NULL), so the alert disappears from "Active Hazard Alerts"
 * immediately. Restore from the admin Bin view if needed.
 */
async function deleteHazard(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await Hazard.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Hazard not found.' });
    }

    await Hazard.remove(id);

    logAction(req.user.id, 'hazard_binned', 'hazard', id, {
      title: existing.title,
      severity: existing.severity,
      location: existing.location,
    });

    res.json({ success: true, message: 'Hazard moved to bin.' });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 7. restoreHazard — admin-only restore from bin
 * -------------------------------------------------------------------------- */

async function restoreHazard(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await Hazard.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Hazard not found.' });
    }
    if (existing.deleted_at == null) {
      return res.status(400).json({ success: false, message: 'Hazard is not in the bin.' });
    }

    await Hazard.restore(id);

    logAction(req.user.id, 'hazard_restored', 'hazard', id, {
      title: existing.title,
    });

    res.json({ success: true, message: 'Hazard restored.' });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 8. permanentDeleteHazard — admin-only purge from bin
 * -------------------------------------------------------------------------- */

async function permanentDeleteHazard(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await Hazard.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Hazard not found.' });
    }

    await Hazard.permanentRemove(id);

    logAction(req.user.id, 'hazard_permanently_deleted', 'hazard', id, {
      title: existing.title,
      severity: existing.severity,
      location: existing.location,
    });

    res.json({ success: true, message: 'Hazard permanently deleted.' });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 9. getBinHazards — admin-only Bin view
 * -------------------------------------------------------------------------- */

async function getBinHazards(req, res, next) {
  try {
    const hazards = await Hazard.findDeleted();
    res.json({ success: true, data: hazards });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getHazards,
  createHazard,
  updateHazard,
  deleteHazard,
  restoreHazard,
  permanentDeleteHazard,
  getBinHazards,
};
