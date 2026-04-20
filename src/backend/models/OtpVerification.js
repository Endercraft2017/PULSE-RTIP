/**
 * =============================================================================
 * OtpVerification Model
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. normalizePhone  - Canonicalize PH phone numbers
 * 3. create          - Store a new OTP record (invalidates prior unverified)
 * 4. findLatest      - Fetch the most recent OTP for a phone + purpose
 * 5. incrementAttempt
 * 6. markVerified
 * 7. hasRecentVerified - Check if a phone has a verified OTP in the window
 * 8. cleanupExpired  - Housekeeping: delete old rows
 *
 * Data access for the otp_verifications table.
 * =============================================================================
 */

const db = require('../config/database');

/* --------------------------------------------------------------------------
 * 2. normalizePhone
 * -------------------------------------------------------------------------- */

/**
 * Normalizes a Philippine phone number to the 0-prefixed local format.
 * Examples: "+63 912 345 6789" -> "09123456789"
 *           "63 912 345 6789"  -> "09123456789"
 *           "09123456789"      -> "09123456789"
 *           "9123456789"       -> "09123456789" (missing leading 0)
 * @param {string} phone
 * @returns {string}
 */
function normalizePhone(phone) {
  if (!phone) return '';
  let clean = String(phone).replace(/[^\d+]/g, '');

  if (clean.startsWith('+63')) clean = '0' + clean.slice(3);
  else if (clean.startsWith('63') && clean.length === 12) clean = '0' + clean.slice(2);
  // Missing leading 0 — user typed "9171234567" instead of "09171234567"
  else if (clean.length === 10 && clean.startsWith('9')) clean = '0' + clean;

  return clean;
}

/* --------------------------------------------------------------------------
 * 3. create
 * -------------------------------------------------------------------------- */

/**
 * Creates a new OTP record and invalidates previous unverified OTPs for the
 * same phone+purpose combination (so only the latest code is valid).
 * @param {object} data - { phone, code, purpose, ttlSeconds }
 * @returns {Promise<object>} Created OTP row
 */
async function create({ phone, code, purpose = 'signup', ttlSeconds = 600 }) {
  const normalized = normalizePhone(phone);

  // Invalidate prior unverified codes for this phone+purpose
  await db.query(
    `DELETE FROM otp_verifications
     WHERE phone = ? AND purpose = ? AND verified = 0`,
    [normalized, purpose]
  );

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
    .toISOString().slice(0, 19).replace('T', ' ');

  const result = await db.query(
    `INSERT INTO otp_verifications (phone, code, purpose, expires_at)
     VALUES (?, ?, ?, ?)`,
    [normalized, code, purpose, expiresAt]
  );

  const insertId = result.insertId || result.lastInsertRowid;
  const rows = await db.query('SELECT * FROM otp_verifications WHERE id = ?', [insertId]);
  return rows[0];
}

/* --------------------------------------------------------------------------
 * 4. findLatest
 * -------------------------------------------------------------------------- */

/**
 * Finds the latest OTP record for a phone + purpose.
 * @param {string} phone
 * @param {string} purpose
 * @returns {Promise<object|null>}
 */
async function findLatest(phone, purpose = 'signup') {
  const normalized = normalizePhone(phone);
  const rows = await db.query(
    `SELECT * FROM otp_verifications
     WHERE phone = ? AND purpose = ?
     ORDER BY id DESC LIMIT 1`,
    [normalized, purpose]
  );
  return rows[0] || null;
}

/* --------------------------------------------------------------------------
 * 5. incrementAttempt
 * -------------------------------------------------------------------------- */

async function incrementAttempt(id) {
  await db.query(
    'UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?',
    [id]
  );
}

/* --------------------------------------------------------------------------
 * 6. markVerified
 * -------------------------------------------------------------------------- */

async function markVerified(id) {
  await db.query(
    'UPDATE otp_verifications SET verified = 1 WHERE id = ?',
    [id]
  );
}

/* --------------------------------------------------------------------------
 * 7. hasRecentVerified
 * -------------------------------------------------------------------------- */

/**
 * Checks whether the phone has a verified OTP in the last N seconds.
 * Used by the register endpoint to gate account creation on phone proof.
 * @param {string} phone
 * @param {string} purpose
 * @param {number} windowSeconds
 * @returns {Promise<boolean>}
 */
async function hasRecentVerified(phone, purpose = 'signup', windowSeconds = 900) {
  const normalized = normalizePhone(phone);
  const cutoff = new Date(Date.now() - windowSeconds * 1000)
    .toISOString().slice(0, 19).replace('T', ' ');
  const rows = await db.query(
    `SELECT id FROM otp_verifications
     WHERE phone = ? AND purpose = ? AND verified = 1
       AND created_at >= ?
     ORDER BY id DESC LIMIT 1`,
    [normalized, purpose, cutoff]
  );
  return rows.length > 0;
}

/* --------------------------------------------------------------------------
 * 8. cleanupExpired
 * -------------------------------------------------------------------------- */

/** Removes all expired OTP rows. Safe to run on a schedule. */
async function cleanupExpired() {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await db.query('DELETE FROM otp_verifications WHERE expires_at < ?', [now]);
}

module.exports = {
  normalizePhone,
  create,
  findLatest,
  incrementAttempt,
  markVerified,
  hasRecentVerified,
  cleanupExpired,
};
