/**
 * =============================================================================
 * Post Controller (Community Posts)
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. getPosts   - List posts (optional filters: category, search)
 * 3. createPost - Create a new community post
 * 4. deletePost - Delete own post (or any post if admin)
 *
 * Handles community board post operations.
 * =============================================================================
 */

const Post = require('../models/Post');

/* --------------------------------------------------------------------------
 * 2. getPosts
 * -------------------------------------------------------------------------- */

/**
 * Lists community posts with optional category and search filters.
 *
 * Query params:
 *   ?category=community|city-news|videos
 *   ?search=keyword
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function getPosts(req, res, next) {
  try {
    const { category, search } = req.query;
    const posts = await Post.findAll({ category, search });
    res.json({
      success: true,
      data: posts,
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 3. createPost
 * -------------------------------------------------------------------------- */

/**
 * Creates a new community post.
 *
 * Body: { title, content, category, type, image_path }
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function createPost(req, res, next) {
  try {
    const { title, content, category, type, image_path } = req.body;
    const post = await Post.create({
      user_id: req.user.id,
      title,
      content,
      category,
      type,
      image_path,
    });

    res.status(201).json({
      success: true,
      data: post,
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 4. deletePost
 * -------------------------------------------------------------------------- */

/**
 * Deletes a community post. Authors can delete their own posts;
 * admins can delete any post.
 *
 * @param {object} req - Express request (params: id)
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function deletePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Only the author or an admin may delete
    if (post.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await Post.remove(post.id);
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPosts, createPost, deletePost };
