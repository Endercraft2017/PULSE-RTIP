/**
 * =============================================================================
 * Community Posts Routes
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Validation Rules
 * 3. Multipart Helper
 * 4. Route Definitions
 *
 * GET    /api/posts            - List posts (filter by ?category, ?search, ?limit)
 * POST   /api/posts            - Create a new post (authenticated; accepts multipart)
 * PUT    /api/posts/:id        - Edit own post title/content (author or admin)
 * GET    /api/posts/:id/edits  - Edit history for a post
 * POST   /api/posts/:id/repost - Repost another user's post
 * DELETE /api/posts/:id        - Delete a post (owner or admin)
 * =============================================================================
 */

const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const postController = require('../controllers/postController');
const { upload } = require('../controllers/mediaController');

const router = Router();

/* --------------------------------------------------------------------------
 * 2. Validation Rules
 * -------------------------------------------------------------------------- */

const createRules = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('category')
    .optional()
    .isIn(['community', 'city-news', 'videos'])
    .withMessage('Category must be community, city-news, or videos'),
  body('type')
    .optional()
    .isIn(['post', 'video'])
    .withMessage('Type must be post or video'),
  body('content').optional().trim(),
  body('image_path').optional().trim(),
  body('video_path').optional().trim(),
  body('location').optional().trim(),
];

const updateRules = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('content').optional({ nullable: true }).trim(),
  body('remove_image').optional(),
  body('remove_video').optional(),
];

/* --------------------------------------------------------------------------
 * 3. Multipart Helper
 * -------------------------------------------------------------------------- */

// Conditional multer: only eat the body as multipart when the client actually
// sent a file upload. JSON posts (the common case from news-updates.js) skip
// the parser entirely so existing clients keep working unchanged.
function maybeMultipart(req, res, next) {
  const ct = req.headers['content-type'] || '';
  if (ct.startsWith('multipart/form-data')) {
    return upload.single('media')(req, res, next);
  }
  return next();
}

/* --------------------------------------------------------------------------
 * 4. Route Definitions
 * -------------------------------------------------------------------------- */

router.get('/', authenticate, postController.getPosts);
router.post('/', authenticate, maybeMultipart, validate(createRules), postController.createPost);
router.put('/:id', authenticate, maybeMultipart, validate(updateRules), postController.updatePost);
router.get('/:id/edits', authenticate, postController.getPostEdits);
router.post('/:id/repost', authenticate, postController.repostPost);
router.delete('/:id', authenticate, postController.deletePost);

module.exports = router;
