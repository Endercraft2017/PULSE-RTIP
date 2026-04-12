/**
 * =============================================================================
 * News Routes
 * =============================================================================
 *
 * GET /api/news - Fetch Philippines news filtered for Morong/Rizal
 * =============================================================================
 */

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const newsController = require('../controllers/newsController');

const router = Router();

router.get('/', authenticate, newsController.getNews);

module.exports = router;
