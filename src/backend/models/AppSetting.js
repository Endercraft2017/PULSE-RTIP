/**
 * =============================================================================
 * AppSetting Model
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. get       - Fetch a single setting value
 * 3. getMany   - Fetch multiple settings as an object
 * 4. set       - Upsert a setting value (SQLite / MySQL compatible)
 *
 * Runtime-editable key/value config table. Used by the admin Settings UI so
 * operators can rotate SMS gateway credentials (and similar) without a
 * server restart. Always returns the raw string or null — callers decide
 * whether to fall back to env.
 *
 * Note: `key` is a reserved word in MySQL — we backtick-quote it everywhere
 * so the same SQL works under both SQLite and MySQL.
 * =============================================================================
 */

const db = require('../config/database');
const config = require('../config');

/* --------------------------------------------------------------------------
 * 2. get
 * -------------------------------------------------------------------------- */

/**
 * Returns the string value stored for `key`, or null when no row exists.
 * Empty-string values are treated as "unset" so clearing a field in the UI
 * cleanly falls back to the .env default.
 *
 * @param {string} key
 * @returns {Promise<string|null>}
 */
async function get(key) {
    const rows = await db.query('SELECT value FROM app_settings WHERE `key` = ?', [key]);
    if (!rows || rows.length === 0) return null;
    const v = rows[0].value;
    if (v === null || v === undefined || v === '') return null;
    return String(v);
}

/* --------------------------------------------------------------------------
 * 3. getMany
 * -------------------------------------------------------------------------- */

/**
 * Batch lookup. Returns `{ [key]: value|null, ... }` for every key passed in.
 * Missing rows resolve to null (same semantics as get()).
 *
 * @param {string[]} keys
 * @returns {Promise<Object<string, string|null>>}
 */
async function getMany(keys) {
    const out = {};
    for (const key of keys) {
        out[key] = await get(key);
    }
    return out;
}

/* --------------------------------------------------------------------------
 * 4. set
 * -------------------------------------------------------------------------- */

/**
 * Upserts a (key, value) pair. Uses dialect-specific upsert syntax since the
 * app supports both MySQL (production) and SQLite (offline). `userId` is
 * stored for audit; pass null when no user context is available.
 *
 * @param {string} key
 * @param {string|null} value  - pass '' or null to clear (falls back to env)
 * @param {number|null} [userId]
 * @returns {Promise<void>}
 */
async function set(key, value, userId = null) {
    const val = value === undefined ? null : value;

    if (config.appMode === 'production') {
        // MySQL upsert
        await db.query(
            'INSERT INTO app_settings (`key`, value, updated_at, updated_by) '
            + 'VALUES (?, ?, CURRENT_TIMESTAMP, ?) '
            + 'ON DUPLICATE KEY UPDATE '
            + 'value = VALUES(value), '
            + 'updated_at = CURRENT_TIMESTAMP, '
            + 'updated_by = VALUES(updated_by)',
            [key, val, userId]
        );
        return;
    }

    // SQLite upsert
    await db.query(
        'INSERT INTO app_settings (`key`, value, updated_at, updated_by) '
        + 'VALUES (?, ?, CURRENT_TIMESTAMP, ?) '
        + 'ON CONFLICT(`key`) DO UPDATE SET '
        + 'value = excluded.value, '
        + 'updated_at = CURRENT_TIMESTAMP, '
        + 'updated_by = excluded.updated_by',
        [key, val, userId]
    );
}

module.exports = { get, getMany, set };
