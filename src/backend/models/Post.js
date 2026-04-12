/**
 * =============================================================================
 * Post Model (Community Posts)
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. findAll   - List posts with optional filters
 * 3. findById  - Get single post by ID
 * 4. create    - Create a new community post
 * 5. remove    - Delete a post (owner or admin only)
 *
 * Data access layer for the community_posts table.
 * =============================================================================
 */

const db = require('../config/database');

/* --------------------------------------------------------------------------
 * 2. findAll
 * -------------------------------------------------------------------------- */

/**
 * Lists community posts with optional category filter and search.
 * Joins with users to include the author name.
 * @param {object} [filters]
 * @param {string} [filters.category] - Filter by category
 * @param {string} [filters.search]   - Search title/content
 * @returns {Promise<Array>} Array of post objects
 */
async function findAll(filters = {}) {
  let sql = `
    SELECT p.*, u.name AS author_name, u.avatar AS author_avatar
    FROM community_posts p
    JOIN users u ON p.user_id = u.id
  `;
  const conditions = [];
  const params = [];

  if (filters.category) {
    conditions.push('p.category = ?');
    params.push(filters.category);
  }

  if (filters.search) {
    conditions.push('(p.title LIKE ? OR p.content LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY p.created_at DESC';

  return db.query(sql, params);
}

/* --------------------------------------------------------------------------
 * 3. findById
 * -------------------------------------------------------------------------- */

/**
 * Retrieves a single post by ID with author info.
 * @param {number} id - Post ID
 * @returns {Promise<object|null>}
 */
async function findById(id) {
  const rows = await db.query(
    `SELECT p.*, u.name AS author_name, u.avatar AS author_avatar
     FROM community_posts p
     JOIN users u ON p.user_id = u.id
     WHERE p.id = ?`,
    [id]
  );
  return rows[0] || null;
}

/* --------------------------------------------------------------------------
 * 4. create
 * -------------------------------------------------------------------------- */

/**
 * Creates a new community post.
 * @param {object} data
 * @param {number} data.user_id    - Author user ID
 * @param {string} data.title      - Post title
 * @param {string} data.content    - Post body text
 * @param {string} data.category   - 'community' | 'city-news' | 'videos'
 * @param {string} data.type       - 'post' | 'video'
 * @param {string} [data.image_path] - Optional image file path
 * @returns {Promise<object>} Created post with author info
 */
async function create(data) {
  const { user_id, title, content, category, type, image_path } = data;
  const result = await db.query(
    `INSERT INTO community_posts (user_id, title, content, category, type, image_path)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user_id, title, content || null, category || 'community', type || 'post', image_path || null]
  );

  const insertId = result.insertId || result.lastInsertRowid;
  return findById(insertId);
}

/* --------------------------------------------------------------------------
 * 5. remove
 * -------------------------------------------------------------------------- */

/**
 * Deletes a community post by ID.
 * @param {number} id - Post ID
 * @returns {Promise<void>}
 */
async function remove(id) {
  await db.query('DELETE FROM community_posts WHERE id = ?', [id]);
}

module.exports = { findAll, findById, create, remove };
