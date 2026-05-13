/**
 * =============================================================================
 * User Model
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. findByEmail  - Find a user by email address
 * 3. findById     - Find a user by ID
 * 4. create       - Create a new user
 * 5. updateById   - Update user profile fields
 *
 * Data access layer for the users table.
 *
 * Soft-delete convention: all find/list helpers add `AND deleted_at IS NULL`
 * so callers never accidentally surface a deleted account. Use
 * findByIdIncludingDeleted() on the rare path (audit) where a deleted row
 * still needs to be read.
 * =============================================================================
 */

const db = require('../config/database');

/* --------------------------------------------------------------------------
 * 2. findByEmail
 * -------------------------------------------------------------------------- */

/**
 * Finds a user by their email address.
 * @param {string} email - The email to search for
 * @returns {Promise<object|null>} User object or null
 */
async function findByEmail(email) {
  const rows = await db.query(
    'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL',
    [email]
  );
  return rows[0] || null;
}

/**
 * Like findByEmail but also surfaces soft-deleted rows. The users.email
 * UNIQUE constraint applies to ALL rows including tombstones, so the signup
 * path must consult this variant before INSERT to avoid a UNIQUE-violation
 * crash on emails belonging to deleted accounts.
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findByEmailIncludingDeleted(email) {
  const rows = await db.query(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
  return rows[0] || null;
}

/**
 * Finds a user by their phone number. Tolerant of formatting differences —
 * seed data uses "0917-135-0541" style while lookups typically pass
 * "09171350541". Compares digits only.
 * @param {string} phone - The phone number to search for
 * @returns {Promise<object|null>} User object or null
 */
async function findByPhone(phone) {
  if (!phone) return null;

  // Exact match first (fastest)
  let rows = await db.query(
    'SELECT * FROM users WHERE phone = ? AND deleted_at IS NULL',
    [phone]
  );
  if (rows[0]) return rows[0];

  // Fallback: compare stripped-to-digits on both sides
  const needle = String(phone).replace(/[^\d]/g, '');
  if (!needle) return null;

  rows = await db.query(
    `SELECT * FROM users
     WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '(', ''), ')', ''), '+', '') = ?
       AND deleted_at IS NULL`,
    [needle]
  );
  return rows[0] || null;
}

/* --------------------------------------------------------------------------
 * 3. findById
 * -------------------------------------------------------------------------- */

/**
 * Finds a user by their ID.
 * @param {number} id - The user ID
 * @returns {Promise<object|null>} User object or null (excludes password_hash)
 */
async function findById(id) {
  const rows = await db.query(
    'SELECT id, name, email, phone, address, barangay, avatar, role, admin_request_status, id_type, id_number, id_document_path, id_verified_at, id_verified_by, joined_date, created_at, updated_at FROM users WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  return rows[0] || null;
}

/**
 * Like findById but also surfaces soft-deleted rows. Use sparingly — only
 * when an admin tool genuinely needs to inspect a tombstoned account.
 * @param {number} id - The user ID
 * @returns {Promise<object|null>}
 */
async function findByIdIncludingDeleted(id) {
  const rows = await db.query(
    'SELECT id, name, email, phone, address, barangay, avatar, role, admin_request_status, joined_date, created_at, updated_at, deleted_at FROM users WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

/* --------------------------------------------------------------------------
 * 4. create
 * -------------------------------------------------------------------------- */

/**
 * Creates a new user.
 * @param {object} data - User data
 * @param {string} data.name - Full name
 * @param {string} data.email - Email address
 * @param {string} data.phone - Phone number
 * @param {string} data.address - Barangay/address
 * @param {string} data.password_hash - Hashed password
 * @param {string} [data.role='citizen'] - User role
 * @returns {Promise<object>} Created user (without password_hash)
 */
async function create(data) {
  const {
    name, email, phone, address, barangay = null, password_hash,
    role = 'citizen', admin_request_status = null,
    id_type = null, id_number = null, id_document_path = null,
  } = data;
  const avatar = name ? name.charAt(0).toUpperCase() : 'U';

  const result = await db.query(
    `INSERT INTO users (name, email, phone, address, barangay, avatar, role, password_hash, admin_request_status, id_type, id_number, id_document_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, email, phone || null, address || null, barangay || null, avatar, role, password_hash, admin_request_status, id_type, id_number, id_document_path]
  );

  const insertId = result.insertId || result.lastInsertRowid;
  return findById(insertId);
}

/**
 * Stamps the ID-verification audit columns. Called from the approval flow
 * so approving the account also marks the ID as manually verified.
 * @param {number} userId
 * @param {number} adminUserId - admin who approved
 */
async function setIdVerified(userId, adminUserId) {
  await db.query(
    'UPDATE users SET id_verified_at = CURRENT_TIMESTAMP, id_verified_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [adminUserId, userId]
  );
}

/**
 * Updates a user's admin request status (and optionally promotes/demotes role).
 */
async function updateAdminRequest(id, status, opts = {}) {
  const fields = ['admin_request_status = ?'];
  const values = [status];
  if (opts.role) {
    fields.push('role = ?');
    values.push(opts.role);
  }
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
}

/**
 * Lists users waiting on admin approval — covers both admin-role upgrade
 * requests ('pending_admin') AND plain citizen signups ('pending').
 * We reuse admin_request_status as a discriminator to avoid a migration:
 *   'pending'       → citizen signup, stays citizen on approval
 *   'pending_admin' → admin-role upgrade, promoted to admin on approval
 * `kind` is computed and added to the payload so the UI can badge them.
 */
async function findPendingApprovals() {
  const rows = await db.query(
    "SELECT id, name, email, phone, barangay, avatar, role, admin_request_status, id_type, id_number, id_document_path, joined_date, created_at FROM users WHERE admin_request_status IN ('pending', 'pending_admin') AND deleted_at IS NULL ORDER BY created_at DESC"
  );
  return rows.map(r => ({
    ...r,
    kind: r.admin_request_status === 'pending_admin' ? 'admin_request' : 'citizen_signup',
  }));
}

// Backward-compat alias — older callers still import the original name.
const findPendingAdminRequests = findPendingApprovals;

/* --------------------------------------------------------------------------
 * 5. updateById
 * -------------------------------------------------------------------------- */

/**
 * Updates a user's profile fields.
 * @param {number} id - The user ID
 * @param {object} data - Fields to update
 * @param {string} [data.name] - New name
 * @param {string} [data.phone] - New phone
 * @param {string} [data.address] - New address
 * @returns {Promise<object|null>} Updated user object
 */
async function updateById(id, data) {
  const fields = [];
  const values = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
    fields.push('avatar = ?');
    values.push(data.name.charAt(0).toUpperCase());
  }
  if (data.phone !== undefined) {
    fields.push('phone = ?');
    values.push(data.phone);
  }
  if (data.address !== undefined) {
    fields.push('address = ?');
    values.push(data.address);
  }
  if (data.barangay !== undefined) {
    fields.push('barangay = ?');
    values.push(data.barangay || null);
  }

  if (fields.length === 0) return findById(id);

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  await db.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return findById(id);
}

/* --------------------------------------------------------------------------
 * 6. findCitizenPhones
 * -------------------------------------------------------------------------- */

/**
 * Returns all non-null phone numbers for citizen users.
 * Used by the SMS service to broadcast alerts.
 * @returns {Promise<string[]>} Array of phone numbers
 */
async function findCitizenPhones() {
  const rows = await db.query(
    "SELECT phone FROM users WHERE role = 'citizen' AND phone IS NOT NULL AND phone != '' AND deleted_at IS NULL"
  );
  return rows.map(r => r.phone);
}

/**
 * Returns citizen phone numbers filtered by barangay. Used for targeted
 * SMS broadcasts — e.g. a hazard confirmed in Bombongan only needs to
 * reach residents of that barangay, not the whole municipality.
 * @param {string} barangay - Barangay name (must match exactly, case-sensitive)
 * @returns {Promise<string[]>}
 */
async function findCitizenPhonesByBarangay(barangay) {
  if (!barangay) return [];
  const rows = await db.query(
    "SELECT phone FROM users WHERE role = 'citizen' AND barangay = ? AND phone IS NOT NULL AND phone != '' AND deleted_at IS NULL",
    [barangay]
  );
  return rows.map(r => r.phone);
}

/**
 * Returns every non-null phone number in the system (citizens AND admins).
 * Used for confirmed-hazard emergency SMS broadcasts where we want
 * everyone — including responders — to get the alert.
 * @returns {Promise<string[]>}
 */
async function findAllPhones() {
  const rows = await db.query(
    "SELECT phone FROM users WHERE phone IS NOT NULL AND phone != '' AND deleted_at IS NULL"
  );
  return rows.map(r => r.phone);
}

/**
 * Finds all users with a given role.
 * @param {string} role - 'admin' or 'citizen'
 * @returns {Promise<Array>} Array of user objects
 */
async function findByRole(role) {
  return db.query(
    'SELECT * FROM users WHERE role = ? AND deleted_at IS NULL',
    [role]
  );
}

/**
 * Updates a user's password hash. Used by the SMS-based reset flow.
 * @param {number} id - User ID
 * @param {string} password_hash - Pre-hashed password (bcrypt)
 * @returns {Promise<void>}
 */
async function updatePassword(id, password_hash) {
  await db.query(
    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [password_hash, id]
  );
}

/* --------------------------------------------------------------------------
 * 7. deleteUser
 * -------------------------------------------------------------------------- */

/**
 * Soft-deletes a user by setting deleted_at. The row itself is preserved so
 * that LEFT/INNER joins on authored reports, hazards, and community posts
 * continue to render the original author name.
 *
 * Idempotent: a no-op on rows already tombstoned.
 *
 * @param {number} id - User ID
 * @returns {Promise<void>}
 */
async function deleteUser(id) {
  await db.query(
    'UPDATE users SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

/**
 * Returns citizen phone numbers filtered by a hazard/announcement audience
 * spec. audience_type='all' falls back to findCitizenPhones();
 * audience_type='barangay' restricts to the given barangay list.
 *
 * @param {object} opts
 * @param {string} opts.audience_type         'all' | 'barangay'
 * @param {string[]} [opts.audience_barangays]
 * @returns {Promise<string[]>}
 */
async function findPhonesForAudience({ audience_type = 'all', audience_barangays = [] } = {}) {
  if (audience_type !== 'barangay' || !Array.isArray(audience_barangays) || audience_barangays.length === 0) {
    return findCitizenPhones();
  }
  const placeholders = audience_barangays.map(() => '?').join(', ');
  const rows = await db.query(
    `SELECT phone FROM users
      WHERE role = 'citizen'
        AND deleted_at IS NULL
        AND phone IS NOT NULL AND phone != ''
        AND barangay IN (${placeholders})`,
    audience_barangays
  );
  return rows.map(r => r.phone);
}

module.exports = { findByEmail, findByEmailIncludingDeleted, findByPhone, findById, findByIdIncludingDeleted, create, updateById, updatePassword, updateAdminRequest, setIdVerified, findPendingAdminRequests, findPendingApprovals, findCitizenPhones, findCitizenPhonesByBarangay, findAllPhones, findPhonesForAudience, findByRole, deleteUser };
