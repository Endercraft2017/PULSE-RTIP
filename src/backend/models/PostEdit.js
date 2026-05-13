/**
 * =============================================================================
 * PostEdit Model (Community Post Edit History)
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. create       - Snapshot a post's pre-edit title/content
 * 3. findByPost   - Fetch ordered history for a post (oldest first)
 *
 * Backs U-6: "See edit history" on the post detail modal.
 * =============================================================================
 */

const db = require('../config/database');

/* --------------------------------------------------------------------------
 * 2. create
 * -------------------------------------------------------------------------- */

/**
 * @param {object} data
 * @param {number} data.post_id
 * @param {number} data.editor_user_id
 * @param {string} [data.old_title]
 * @param {string} [data.old_content]
 * @returns {Promise<object>}
 */
async function create({ post_id, editor_user_id, old_title, old_content }) {
  return db.query(
    `INSERT INTO post_edits (post_id, editor_user_id, old_title, old_content)
     VALUES (?, ?, ?, ?)`,
    [post_id, editor_user_id, old_title || null, old_content || null]
  );
}

/* --------------------------------------------------------------------------
 * 3. findByPost
 * -------------------------------------------------------------------------- */

/**
 * Returns edit history rows for a post, oldest first. Joins users so the
 * UI can show "Edited by <name>" without a second round-trip.
 * @param {number} postId
 * @returns {Promise<Array>}
 */
async function findByPost(postId) {
  return db.query(
    `SELECT pe.*, u.name AS editor_name
     FROM post_edits pe
     LEFT JOIN users u ON pe.editor_user_id = u.id
     WHERE pe.post_id = ?
     ORDER BY pe.edited_at ASC`,
    [postId]
  );
}

module.exports = { create, findByPost };
