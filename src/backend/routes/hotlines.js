/**
 * =============================================================================
 * Hotline Routes
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Route Definitions
 *
 * GET /api/hotlines - List all emergency hotlines
 * =============================================================================
 */

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const Hotline = require('../models/Hotline');

const router = Router();

/* --------------------------------------------------------------------------
 * 2. Route Definitions
 * -------------------------------------------------------------------------- */

router.get('/', authenticate, async (req, res, next) => {
  try {
    const hotlines = await Hotline.findAll();
    res.json({
      success: true,
      data: hotlines,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
