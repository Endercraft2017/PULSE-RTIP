/**
 * =============================================================================
 * Media Routes
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Route Definitions
 *
 * POST /api/media/upload - Upload media files
 * =============================================================================
 */

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { upload, uploadFile } = require('../controllers/mediaController');

const router = Router();

/* --------------------------------------------------------------------------
 * 2. Route Definitions
 * -------------------------------------------------------------------------- */

router.post('/upload', authenticate, upload.array('files', 5), uploadFile);

module.exports = router;
