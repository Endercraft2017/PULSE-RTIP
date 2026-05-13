/**
 * =============================================================================
 * PushToken Model
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. upsert               - Register or refresh a device token
 * 3. claim                - Attach a previously-unclaimed token to a user
 * 4. touchLastSeen        - Refresh last_seen_at only
 * 5. findTokensForAudience - Resolve a hazard audience to target tokens
 *
 * Data access layer for the push_tokens table. Tokens may be unclaimed
 * (user_id = NULL) when registered pre-login; post-login they get claimed
 * by calling claim().
 * =============================================================================
 */

const db = require('../config/database');

/* --------------------------------------------------------------------------
 * 2. upsert
 * -------------------------------------------------------------------------- */

/**
 * Inserts a new push token row or refreshes the existing row's
 * last_seen_at (+ associated user/barangay when provided).
 *
 * @param {object} data
 * @param {string} data.token      FCM registration token
 * @param {number} [data.user_id]  Attach to user if known, else null/unclaimed
 * @param {string} [data.platform='android']
 * @param {string} [data.barangay] Barangay captured at registration (optional)
 * @returns {Promise<object>} The stored row
 */
async function upsert({ token, user_id = null, platform = 'android', barangay = null }) {
  if (!token) throw new Error('token is required');

  const existing = await db.query('SELECT * FROM push_tokens WHERE token = ?', [token]);
  if (existing && existing[0]) {
    // Only overwrite non-null values we now know. Keeps previous associations
    // intact when a pre-login ping happens after login on the same device.
    const row = existing[0];
    const nextUser = user_id != null ? user_id : row.user_id;
    const nextBarangay = barangay != null ? barangay : row.barangay;
    const nextPlatform = platform || row.platform || 'android';

    await db.query(
      'UPDATE push_tokens SET user_id = ?, platform = ?, barangay = ?, last_seen_at = CURRENT_TIMESTAMP WHERE token = ?',
      [nextUser, nextPlatform, nextBarangay, token]
    );
    const rows = await db.query('SELECT * FROM push_tokens WHERE token = ?', [token]);
    return rows[0] || null;
  }

  await db.query(
    'INSERT INTO push_tokens (token, user_id, platform, barangay) VALUES (?, ?, ?, ?)',
    [token, user_id, platform, barangay]
  );
  const rows = await db.query('SELECT * FROM push_tokens WHERE token = ?', [token]);
  return rows[0] || null;
}

/* --------------------------------------------------------------------------
 * 3. claim
 * -------------------------------------------------------------------------- */

/**
 * Attaches an existing (typically unclaimed) token to a user after login.
 * Also stamps the user's barangay so future audience-filtered broadcasts
 * can target this device even before it next checks in.
 *
 * @param {string} token
 * @param {number} user_id
 * @param {string} [barangay]
 * @returns {Promise<object|null>}
 */
async function claim(token, user_id, barangay = null) {
  if (!token || !user_id) return null;
  const existing = await db.query('SELECT id FROM push_tokens WHERE token = ?', [token]);
  if (existing && existing[0]) {
    await db.query(
      'UPDATE push_tokens SET user_id = ?, barangay = COALESCE(?, barangay), last_seen_at = CURRENT_TIMESTAMP WHERE token = ?',
      [user_id, barangay, token]
    );
  } else {
    // Race: device sent /claim before its earlier /register reached us, or the
    // earlier /register was lost. Insert so we don't silently drop the token.
    await db.query(
      'INSERT INTO push_tokens (token, user_id, platform, barangay) VALUES (?, ?, ?, ?)',
      [token, user_id, 'android', barangay]
    );
  }
  const rows = await db.query('SELECT * FROM push_tokens WHERE token = ?', [token]);
  return rows[0] || null;
}

/* --------------------------------------------------------------------------
 * 4. touchLastSeen
 * -------------------------------------------------------------------------- */

/**
 * Updates last_seen_at only. Useful for a lightweight heartbeat when we
 * don't want to overwrite user_id/barangay.
 * @param {string} token
 */
async function touchLastSeen(token) {
  if (!token) return;
  await db.query(
    'UPDATE push_tokens SET last_seen_at = CURRENT_TIMESTAMP WHERE token = ?',
    [token]
  );
}

/* --------------------------------------------------------------------------
 * 5. findTokensForAudience
 * -------------------------------------------------------------------------- */

/**
 * Resolves a hazard audience to the set of push tokens that should receive
 * the broadcast. Excludes soft-deleted users. Unclaimed tokens (user_id
 * NULL) are included when audience_type='all', and also when they carry
 * a matching barangay tag themselves.
 *
 * @param {object} opts
 * @param {string} opts.audience_type       'all' | 'barangay'
 * @param {string[]} [opts.audience_barangays]
 * @returns {Promise<Array<{token: string, user_id: number|null, barangay: string|null}>>}
 */
async function findTokensForAudience({ audience_type = 'all', audience_barangays = [] } = {}) {
  if (audience_type !== 'barangay' || !Array.isArray(audience_barangays) || audience_barangays.length === 0) {
    // Default: everyone. Join users left-side so unclaimed tokens still flow through.
    const rows = await db.query(
      `SELECT pt.token, pt.user_id, pt.barangay
         FROM push_tokens pt
    LEFT JOIN users u ON u.id = pt.user_id
        WHERE (pt.user_id IS NULL OR u.deleted_at IS NULL)`
    );
    return rows || [];
  }

  const placeholders = audience_barangays.map(() => '?').join(', ');
  const params = [...audience_barangays, ...audience_barangays];

  const rows = await db.query(
    `SELECT pt.token, pt.user_id, pt.barangay
       FROM push_tokens pt
  LEFT JOIN users u ON u.id = pt.user_id
      WHERE (u.deleted_at IS NULL OR pt.user_id IS NULL)
        AND (
              pt.barangay IN (${placeholders})
           OR u.barangay IN (${placeholders})
        )`,
    params
  );
  return rows || [];
}

/* --------------------------------------------------------------------------
 * 6. findByUserId
 * -------------------------------------------------------------------------- */

/**
 * Returns all push tokens registered to a specific user. Used for direct
 * user-targeted pushes (e.g. report status updates → submitter's devices).
 *
 * @param {number} user_id
 * @returns {Promise<Array<{token: string, user_id: number, barangay: string|null}>>}
 */
async function findByUserId(user_id) {
  if (!user_id) return [];
  const rows = await db.query(
    `SELECT pt.token, pt.user_id, pt.barangay
       FROM push_tokens pt
  LEFT JOIN users u ON u.id = pt.user_id
      WHERE pt.user_id = ?
        AND (u.deleted_at IS NULL)`,
    [user_id]
  );
  return rows || [];
}

module.exports = { upsert, claim, touchLastSeen, findTokensForAudience, findByUserId };
