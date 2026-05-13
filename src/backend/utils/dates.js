/**
 * Robustly parse a datetime value coming from the database.
 *
 * SQLite (better-sqlite3) returns DATETIME columns as strings, typically in
 * the form "YYYY-MM-DD HH:MM:SS" (UTC, since we always store with
 * toISOString()). mysql2 may return a JS Date object or a string depending
 * on driver config. This helper accepts either and always returns a Date.
 *
 * Naive date strings (no timezone suffix) are treated as UTC — the app
 * always stores UTC, so this matches storage semantics.
 *
 * @param {string|Date|null|undefined} value
 * @returns {Date|null} null if value is null/undefined/invalid
 */
function parseDbDate(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  const s = String(value);
  // Already has timezone (Z or +HH:MM / -HH:MM at end) — parse as-is
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  // Naive "YYYY-MM-DD HH:MM:SS" — append Z so it parses as UTC
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? null : d;
}

module.exports = { parseDbDate };
