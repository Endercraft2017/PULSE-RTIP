/**
 * =============================================================================
 * Community Posts Routes
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Validation Rules
 * 3. Route Definitions
 *
 * GET    /api/posts     - List posts (filter by ?category, ?search)
 * POST   /api/posts     - Create a new post (authenticated)
 * DELETE /api/posts/:id - Delete a post (owner or admin)
 * =============================================================================
 */

const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const postController = require('../controllers/postController');

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
];

/* --------------------------------------------------------------------------
 * 3. Route Definitions
 * -------------------------------------------------------------------------- */

router.get('/', authenticate, postController.getPosts);
router.post('/', authenticate, validate(createRules), postController.createPost);
router.delete('/:id', authenticate, postController.deletePost);

module.exports = router;
