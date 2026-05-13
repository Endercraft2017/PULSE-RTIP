/**
 * =============================================================================
 * Post Controller (Community Posts)
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. getPosts              - List posts (optional filters: category, search, limit)
 * 3. createPost            - Create a new community post (accepts image OR video)
 * 4. updatePost            - Edit own post; preserves history via PostEdit
 * 5. getPostEdits          - List edit history for a post
 * 6. repostPost            - Share another user's post (no chain of reposts)
 * 7. deletePost            - Delete own post (or any post if admin)
 * 8. promoteReportToPost   - Admin: promote a report into a community post
 *
 * Handles community board post operations.
 * =============================================================================
 */

const Post = require('../models/Post');
const PostEdit = require('../models/PostEdit');
const User = require('../models/User');
const Report = require('../models/Report');
const ReportImage = require('../models/ReportImage');
const PushToken = require('../models/PushToken');
const fcm = require('../services/push/fcm');
const { generateIncidentImage } = require('../services/ai/pollinations');

/* --------------------------------------------------------------------------
 * 2. getPosts
 * -------------------------------------------------------------------------- */

async function getPosts(req, res, next) {
  try {
    const { category, search, limit } = req.query;
    const posts = await Post.findAll({
      category,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
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
 * Creates a community post. When the request is multipart/form-data, the
 * posts route runs multer first so req.file is already populated here.
 *
 * Body fields (all optional except title): title, content, category, type,
 *   image_path, video_path, location, reposted_from_post_id.
 * Files: single upload under field name "media" (image/* or video/mp4).
 */
async function createPost(req, res, next) {
  try {
    const {
      title,
      content,
      category,
      type,
      reposted_from_post_id,
    } = req.body;

    let { image_path, video_path, location } = req.body;

    // If a file came through multer, classify by mimetype and override paths.
    if (req.file) {
      const publicPath = `/uploads/${req.file.filename}`;
      if ((req.file.mimetype || '').startsWith('video/')) {
        video_path = publicPath;
      } else {
        image_path = publicPath;
      }
    }

    // U-5: default location to the author's barangay when not supplied.
    if (!location) {
      try {
        const author = await User.findById(req.user.id);
        if (author && author.barangay) {
          location = author.barangay;
        }
      } catch (_) {
        // Non-fatal — just leave location null.
      }
    }

    // If the citizen didn't attach any media and this isn't a repost, ask
    // Pollinations.ai for a decorative image. Capped at 35s and never fatal —
    // post creation must succeed even if the AI service is slow or down.
    // Mirrors the pattern used in promoteReportToPost.
    if (!image_path && !video_path && !reposted_from_post_id) {
      const aiStart = Date.now();
      try {
        const aiType = (category === 'community') ? 'community' : (category || type || 'community');
        const aiPath = await Promise.race([
          generateIncidentImage({
            type: aiType,
            location,
            title,
          }),
          new Promise((resolve) => setTimeout(() => resolve(null), 35000)),
        ]);
        if (aiPath) {
          image_path = aiPath;
          console.log(`[post-ai] createPost -> AI image ${aiPath} (${Date.now() - aiStart}ms)`);
        } else {
          console.log(`[post-ai] createPost -> AI image skipped/timeout (${Date.now() - aiStart}ms)`);
        }
      } catch (err) {
        console.warn(`[post-ai] createPost AI image generation failed: ${err && err.message}`);
      }
    }

    const post = await Post.create({
      user_id: req.user.id,
      title,
      content,
      category,
      type,
      image_path,
      video_path,
      location,
      reposted_from_post_id: reposted_from_post_id
        ? parseInt(reposted_from_post_id, 10)
        : null,
    });

    // U-5: fire-and-forget push fan-out so every account gets a popup when a
    // new community post lands (mirrors hazardController.createHazard). The
    // author IS included on purpose — single-device testing relies on it, and
    // owner asked for "push to all accounts" semantics. The notification's
    // own data.kind lets clients suppress redundant in-app toasts if needed.
    PushToken.findTokensForAudience({ audience_type: 'all' })
      .then(rows => {
        const tokens = (rows || [])
          .map(r => r && r.token)
          .filter(Boolean);
        if (tokens.length === 0) return null;
        const author = post && post.author_name ? post.author_name : 'Someone';
        const isRepost = !!reposted_from_post_id;
        const pushTitle = isRepost ? `${author} reposted` : `New post from ${author}`;
        const bodyText = (post && post.title ? String(post.title) : '').slice(0, 120)
          || (post && post.content ? String(post.content) : '').slice(0, 120)
          || 'Tap to view.';
        return fcm.send(tokens, {
          title: pushTitle,
          body: bodyText,
          sound: false,
          data: {
            postId: String(post.id),
            kind: 'community_post',
          },
        });
      })
      .then(r => {
        if (r) console.log(`[push] community post broadcast (batches=${r.batches ?? (r.devOnly ? 'dev' : 0)})`);
      })
      .catch(err => console.error('[push] community post fan-out failed:', err.message));

    res.status(201).json({
      success: true,
      data: post,
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 4. updatePost
 * -------------------------------------------------------------------------- */

async function updatePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (post.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { title, content } = req.body;
    const changes = { title, content };

    // Media handling — three signals the client can send:
    //   1. multipart upload under "media"  → replace image/video
    //   2. body.remove_image === '1'/true  → clear image_path
    //   3. body.remove_video === '1'/true  → clear video_path
    if (req.file) {
      const publicPath = `/uploads/${req.file.filename}`;
      if ((req.file.mimetype || '').startsWith('video/')) {
        changes.video_path = publicPath;
        changes.image_path = null;
      } else {
        changes.image_path = publicPath;
        changes.video_path = null;
      }
    } else {
      const truthy = (v) => v === true || v === '1' || v === 1 || v === 'true';
      if (truthy(req.body.remove_image)) changes.image_path = null;
      if (truthy(req.body.remove_video)) changes.video_path = null;
    }

    const updated = await Post.update(post.id, req.user.id, changes);

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 5. getPostEdits
 * -------------------------------------------------------------------------- */

async function getPostEdits(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const edits = await PostEdit.findByPost(post.id);
    res.json({ success: true, data: edits });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 6. repostPost
 * -------------------------------------------------------------------------- */

async function repostPost(req, res, next) {
  try {
    const original = await Post.findById(req.params.id);
    if (!original) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // No chains of reposts — keeps attribution clear and avoids infinite
    // "Reposted from reposter of reposter..." rendering.
    if (original.reposted_from_post_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot repost a repost. Share the original post instead.',
      });
    }

    const repost = await Post.create({
      user_id: req.user.id,
      title: '[Repost] ' + original.title,
      content: original.content,
      category: original.category,
      type: original.type,
      image_path: original.image_path,
      video_path: original.video_path,
      location: original.location,
      reposted_from_post_id: original.id,
    });

    res.status(201).json({ success: true, data: repost });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 7. deletePost
 * -------------------------------------------------------------------------- */

async function deletePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (post.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await Post.remove(post.id);

    // Best-effort: unlink local upload file so the disk doesn't fill up with
    // orphan AI-generated images. Only touch /uploads/ paths (skip anything
    // hosted externally) and only if the file isn't shared by another row.
    try {
      const fs = require('fs');
      const path = require('path');
      const config = require('../config');
      for (const p of [post.image_path, post.video_path]) {
        if (!p || typeof p !== 'string' || !p.startsWith('/uploads/')) continue;
        const filename = p.replace(/^\/uploads\//, '');
        // Don't delete a file still referenced by another community_post
        const db = require('../config/database');
        const rows = await db.query(
          'SELECT 1 FROM community_posts WHERE image_path = ? OR video_path = ? LIMIT 1',
          [p, p]
        );
        if (rows.length > 0) continue;
        const abs = path.join(config.upload.dir, filename);
        fs.unlink(abs, (err) => {
          if (err && err.code !== 'ENOENT') console.warn('[deletePost] unlink failed:', err.message);
        });
      }
    } catch (e) {
      console.warn('[deletePost] file cleanup error:', e.message);
    }

    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 8. promoteReportToPost (A-14)
 * -------------------------------------------------------------------------- */

/**
 * Admin-only: spin a report into a community post so MDRRMO progress is
 * visible in the public feed. The promoted post stays linked to the
 * originating report via promoted_from_report_id so we can deep-link
 * back on the card.
 */
async function promoteReportToPost(req, res, next) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const existing = await Post.findByPromotedReport(report.id);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'This report has already been promoted to a community post.',
        data: { post_id: existing.id },
      });
    }

    // SMS-origin reports may have a null submitter — fall back to the
    // admin performing the promotion so user_id always satisfies the FK.
    const authorId = report.submitted_by || req.user.id;

    const now = new Date();
    const asOf = now.toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const baseDesc = report.description || '';
    const statusLine = `\n\nStatus: ${report.status} (as of ${asOf})`;
    const content = baseDesc + statusLine;

    // Attach the first uploaded report image, if any, as the post thumb.
    let image_path = null;
    try {
      const imgs = await ReportImage.findByReportId(report.id);
      if (imgs && imgs.length > 0) {
        image_path = imgs[0].file_path;
      }
    } catch (_) {
      // Non-fatal — post can still be created without an image.
    }

    // If the promoted post has no image yet, ask Pollinations.ai for an
    // illustrative one. Capped at 35s and never fatal — the promotion
    // must succeed even if the AI service is slow or unreachable.
    if (!image_path) {
      const aiStart = Date.now();
      try {
        const aiPath = await Promise.race([
          generateIncidentImage({
            type: report.type,
            location: report.location,
            title: report.title,
          }),
          new Promise((resolve) => setTimeout(() => resolve(null), 35000)),
        ]);
        if (aiPath) {
          image_path = aiPath;
          console.log(`[promote] report ${report.id} -> AI image ${aiPath} (${Date.now() - aiStart}ms)`);
        } else {
          console.log(`[promote] report ${report.id} -> AI image skipped/timeout (${Date.now() - aiStart}ms)`);
        }
      } catch (err) {
        console.warn('[promoteReportToPost] AI image generation failed:', err && err.message);
      }
    }

    const post = await Post.create({
      user_id: authorId,
      title: report.title,
      content,
      category: 'city-news',
      type: 'post',
      image_path,
      location: report.location,
      promoted_from_report_id: report.id,
    });

    console.log(`[promote] report ${report.id} -> post ${post.id} (image=${image_path ? 'yes' : 'no'})`);

    res.status(201).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPosts,
  createPost,
  updatePost,
  getPostEdits,
  repostPost,
  deletePost,
  promoteReportToPost,
};
