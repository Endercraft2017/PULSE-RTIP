/**
 * =============================================================================
 * Nominatim Reverse-Geocoder (OpenStreetMap)
 * =============================================================================
 *
 * Table of Contents:
 * 1. Config
 * 2. reverseGeocode — async(lat, lng) -> string|null
 * 3. formatAddress  — shape a Nominatim response for PH readability
 * 4. In-memory cache (TTL)
 *
 * Uses the public Nominatim endpoint per its Usage Policy:
 *   - Unique User-Agent header identifying this app
 *   - <= 1 request per second (we enforce with an in-memory cache + the
 *     call pattern: only once per hazard creation)
 *   - Best-effort: we NEVER fail a hazard creation because of geocoding.
 *     All errors (network, parse, timeout) resolve to null.
 *
 * Usage policy: https://operations.osmfoundation.org/policies/nominatim/
 * =============================================================================
 */

const https = require('https');

/* --------------------------------------------------------------------------
 * 1. Config
 * -------------------------------------------------------------------------- */

const USER_AGENT = 'PULSE-RTIP/0.1 (MDRRMO Morong, Rizal thesis project)';
const TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — coordinates don't move
const CACHE_MAX = 500;

/* --------------------------------------------------------------------------
 * 4. In-memory cache
 * -------------------------------------------------------------------------- */

const _cache = new Map(); // key "lat,lng" -> { value, expiresAt }

function _cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) { _cache.delete(key); return undefined; }
  return hit.value;
}

function _cacheSet(key, value) {
  if (_cache.size >= CACHE_MAX) {
    // Evict oldest (Map iteration is insertion order)
    const first = _cache.keys().next().value;
    _cache.delete(first);
  }
  _cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/* --------------------------------------------------------------------------
 * 3. formatAddress
 * -------------------------------------------------------------------------- */

/**
 * Nominatim returns very long display_names like
 *   "Dr. José Rizal Street, Barangay San Pedro, Morong, Rizal, Calabarzon,
 *    1960, Philippines"
 * We want something shorter that still gives a resident useful context:
 *   "Barangay San Pedro, Morong, Rizal"
 */
function formatAddress(data) {
  if (!data) return null;
  const a = data.address || {};

  // PH barangays are commonly tagged as suburb in OSM; check a few
  // alternatives for rural areas.
  const barangay = a.suburb || a.neighbourhood || a.village || a.hamlet || a.quarter;
  const city = a.town || a.city || a.municipality || a.county;
  const state = a.state || a.region;

  const parts = [];
  if (barangay) parts.push(barangay);
  if (city && city !== barangay) parts.push(city);
  if (state && state !== city) parts.push(state);

  if (parts.length === 0) return data.display_name || null;
  return parts.join(', ');
}

/* --------------------------------------------------------------------------
 * 2. reverseGeocode
 * -------------------------------------------------------------------------- */

/**
 * Reverse-geocodes a lat/lng pair. Never throws — returns null on any error
 * so the caller can treat it as best-effort metadata.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string|null>} Formatted address or null
 */
function reverseGeocode(lat, lng) {
  return new Promise((resolve) => {
    if (lat == null || lng == null) return resolve(null);

    const nlat = Number(lat);
    const nlng = Number(lng);
    if (!Number.isFinite(nlat) || !Number.isFinite(nlng)) return resolve(null);
    if (nlat < -90 || nlat > 90 || nlng < -180 || nlng > 180) return resolve(null);

    // Cache on 5-decimal precision (~1m resolution)
    const key = `${nlat.toFixed(5)},${nlng.toFixed(5)}`;
    const cached = _cacheGet(key);
    if (cached !== undefined) return resolve(cached);

    const url = 'https://nominatim.openstreetmap.org/reverse'
      + `?format=jsonv2&lat=${nlat}&lon=${nlng}`
      + '&zoom=17&addressdetails=1&accept-language=en';

    const req = https.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      timeout: TIMEOUT_MS,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            _cacheSet(key, null);
            return resolve(null);
          }
          const data = JSON.parse(body);
          const address = formatAddress(data);
          _cacheSet(key, address);
          resolve(address);
        } catch (err) {
          _cacheSet(key, null);
          resolve(null);
        }
      });
    });

    req.on('error', () => { _cacheSet(key, null); resolve(null); });
    req.on('timeout', () => { req.destroy(); _cacheSet(key, null); resolve(null); });
  });
}

module.exports = { reverseGeocode, formatAddress };
