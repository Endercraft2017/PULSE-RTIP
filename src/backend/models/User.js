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
  const rows = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
}

/**
 * Finds a user by their phone number (exact match after caller normalization).
 * @param {string} phone - The phone number to search for
 * @returns {Promise<object|null>} User object or null
 */
async function findByPhone(phone) {
  if (!phone) return null;
  const rows = await db.query('SELECT * FROM users WHERE phone = ?', [phone]);
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
    'SELECT id, name, email, phone, address, avatar, role, admin_request_status, joined_date, created_at, updated_at FROM users WHERE id = ?',
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
  const { name, email, phone, address, password_hash, role = 'citizen', admin_request_status = null } = data;
  const avatar = name ? name.charAt(0).toUpperCase() : 'U';

  const result = await db.query(
    `INSERT INTO users (name, email, phone, address, avatar, role, password_hash, admin_request_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, email, phone || null, address || null, avatar, role, password_hash, admin_request_status]
  );

  const insertId = result.insertId || result.lastInsertRowid;
  return findById(insertId);
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
 * Lists users with a pending admin request.
 */
async function findPendingAdminRequests() {
  return db.query(
    "SELECT id, name, email, phone, avatar, joined_date, created_at FROM users WHERE admin_request_status = 'pending' ORDER BY created_at DESC"
  );
}

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
    "SELECT phone FROM users WHERE role = 'citizen' AND phone IS NOT NULL AND phone != ''"
  );
  return rows.map(r => r.phone);
}

/**
 * Finds all users with a given role.
 * @param {string} role - 'admin' or 'citizen'
 * @returns {Promise<Array>} Array of user objects
 */
async function findByRole(role) {
  return db.query('SELECT * FROM users WHERE role = ?', [role]);
}

module.exports = { findByEmail, findByPhone, findById, create, updateById, updateAdminRequest, findPendingAdminRequests, findCitizenPhones, findByRole };
