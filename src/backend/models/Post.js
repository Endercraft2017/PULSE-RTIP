/**
 * =============================================================================
 * Post Model (Community Posts)
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. findAll      - List posts with optional filters
 * 3. findById     - Get single post by ID
 * 4. findLatest   - Get N most recent posts (for citizen-home feed)
 * 5. create       - Create a new community post
 * 6. update       - Edit a post's title/content, snapshotting the old values
 * 7. remove       - Delete a post (owner or admin only)
 * 8. findByPromotedReport - Look up a post promoted from a given report
 *
 * Data access layer for the community_posts table.
 * =============================================================================
 */

const db = require('../config/database');
const PostEdit = require('./PostEdit');

// Shared SELECT fragment — keeps findAll / findById / findLatest consistent
// on which columns + joins are returned so frontend shapes never drift.
// Reposts pull the original author's name via a second LEFT JOIN so the
// "Reposted from @..." header doesn't need a follow-up fetch.
const BASE_SELECT = `
  SELECT p.*,
         u.name   AS author_name,
         u.avatar AS author_avatar,
         ru.name  AS reposted_from_author_name,
         ru.id    AS reposted_from_user_id
  FROM community_posts p
  JOIN users u ON p.user_id = u.id
  LEFT JOIN community_posts rp ON p.reposted_from_post_id = rp.id
  LEFT JOIN users ru ON rp.user_id = ru.id
`;

/* --------------------------------------------------------------------------
 * 2. findAll
 * -------------------------------------------------------------------------- */

async function findAll(filters = {}) {
  let sql = BASE_SELECT;
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

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(Number(filters.limit));
  }

  return db.query(sql, params);
}

/* --------------------------------------------------------------------------
 * 3. findById
 * -------------------------------------------------------------------------- */

async function findById(id) {
  const rows = await db.query(`${BASE_SELECT} WHERE p.id = ?`, [id]);
  return rows[0] || null;
}

/* --------------------------------------------------------------------------
 * 4. findLatest
 * -------------------------------------------------------------------------- */

/**
 * Returns the N most recent posts with author info. Used by the citizen-home
 * newsfeed section (U-4), which only needs a handful of cards.
 * @param {number} [limit=3]
 * @returns {Promise<Array>}
 */
async function findLatest(limit = 3) {
  const sql = `${BASE_SELECT} ORDER BY p.created_at DESC LIMIT ?`;
  return db.query(sql, [Number(limit)]);
}

/* --------------------------------------------------------------------------
 * 5. create
 * -------------------------------------------------------------------------- */

/**
 * Creates a new community post.
 * @param {object} data
 * @param {number} data.user_id
 * @param {string} data.title
 * @param {string} [data.content]
 * @param {string} [data.category]
 * @param {string} [data.type]
 * @param {string} [data.image_path]
 * @param {string} [data.video_path]
 * @param {string} [data.location]
 * @param {number} [data.reposted_from_post_id]
 * @param {number} [data.promoted_from_report_id]
 * @returns {Promise<object>} Created post with author info
 */
async function create(data) {
  const {
    user_id,
    title,
    content,
    category,
    type,
    image_path,
    video_path,
    location,
    reposted_from_post_id,
    promoted_from_report_id,
  } = data;

  const result = await db.query(
    `INSERT INTO community_posts
       (user_id, title, content, category, type, image_path, video_path,
        location, reposted_from_post_id, promoted_from_report_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id,
      title,
      content || null,
      category || 'community',
      type || 'post',
      image_path || null,
      video_path || null,
      location || null,
      reposted_from_post_id || null,
      promoted_from_report_id || null,
    ]
  );

  const insertId = result.insertId || result.lastInsertRowid;
  return findById(insertId);
}

/* --------------------------------------------------------------------------
 * 6. update
 * -------------------------------------------------------------------------- */

/**
 * Edits a post's title and/or content. Snapshots the previous values into
 * post_edits BEFORE applying the change so history is preserved. Bumps
 * updated_at so the detail modal can show "Edited X".
 *
 * @param {number} id            - Post ID
 * @param {number} editorUserId  - User performing the edit
 * @param {object} changes       - { title?, content? } (only changed fields)
 * @returns {Promise<object|null>} Updated post with author info
 */
async function update(id, editorUserId, changes) {
  const current = await findById(id);
  if (!current) return null;

  const newTitle = changes.title !== undefined ? changes.title : current.title;
  const newContent = changes.content !== undefined ? changes.content : current.content;
  const newImage = changes.image_path !== undefined ? changes.image_path : current.image_path;
  const newVideo = changes.video_path !== undefined ? changes.video_path : current.video_path;

  // Skip the audit row if nothing actually changed — saves noise.
  if (newTitle === current.title
      && newContent === current.content
      && newImage === current.image_path
      && newVideo === current.video_path) {
    return current;
  }

  // Only audit text changes; media swaps are noisy + not text-comparable.
  if (newTitle !== current.title || newContent !== current.content) {
    await PostEdit.create({
      post_id: id,
      editor_user_id: editorUserId,
      old_title: current.title,
      old_content: current.content,
    });
  }

  await db.query(
    'UPDATE community_posts SET title = ?, content = ?, image_path = ?, video_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newTitle, newContent, newImage, newVideo, id]
  );

  return findById(id);
}

/* --------------------------------------------------------------------------
 * 7. remove
 * -------------------------------------------------------------------------- */

async function remove(id) {
  // Children first — post_edits.post_id has a FK to community_posts(id)
  // with no ON DELETE CASCADE, so deleting the post directly throws
  // "FOREIGN KEY constraint failed" the moment any edit row exists.
  // Same for any reposts pointing back at this id.
  await db.query('DELETE FROM post_edits WHERE post_id = ?', [id]);
  await db.query('UPDATE community_posts SET reposted_from_post_id = NULL WHERE reposted_from_post_id = ?', [id]);
  await db.query('DELETE FROM community_posts WHERE id = ?', [id]);
}

/* --------------------------------------------------------------------------
 * 8. findByPromotedReport
 * -------------------------------------------------------------------------- */

/**
 * Returns the existing promoted-from post for a given report ID, if any.
 * Used by the promote-to-post flow (A-14) to prevent duplicate promotions.
 * @param {number} reportId
 * @returns {Promise<object|null>}
 */
async function findByPromotedReport(reportId) {
  const rows = await db.query(
    'SELECT * FROM community_posts WHERE promoted_from_report_id = ? LIMIT 1',
    [reportId]
  );
  return rows[0] || null;
}

module.exports = { findAll, findById, findLatest, create, update, remove, findByPromotedReport };
