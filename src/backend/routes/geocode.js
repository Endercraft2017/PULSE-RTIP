/**
 * =============================================================================
 * Geocode Routes
 * =============================================================================
 *
 * GET /api/geocode/reverse?lat=X&lng=Y
 *   - Reverse-geocodes a lat/lng pair via Nominatim/OpenStreetMap.
 *   - Auth-required to prevent anonymous abuse of our shared rate limit.
 *   - Best-effort: returns 200 { success: true, data: { address: null } }
 *     when the upstream couldn't resolve, so the client can fall back
 *     gracefully to a manual entry.
 *
 * Used by the citizen "Detect my location" button on the report-incident
 * form so that the location text field is populated with a human-readable
 * address (U-6 fix), not the hardcoded "Morong, Rizal" placeholder.
 * =============================================================================
 */

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { reverseGeocode } = require('../services/geocode/nominatim');

const router = Router();

router.get('/reverse', authenticate, async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        message: 'lat and lng query params are required and must be numbers',
      });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'lat must be in [-90, 90] and lng in [-180, 180]',
      });
    }

    const address = await reverseGeocode(lat, lng);
    res.json({ success: true, data: { address: address || null } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
