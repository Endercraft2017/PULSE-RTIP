/**
 * =============================================================================
 * User Routes
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Route Definitions
 *
 * GET  /api/users/me - Get current user profile
 * PUT  /api/users/me - Update current user profile
 * =============================================================================
 */

const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = Router();

/* --------------------------------------------------------------------------
 * 2. Route Definitions
 * -------------------------------------------------------------------------- */

router.get('/me', authenticate, userController.getMe);

router.put('/me', authenticate, validate([
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().trim(),
  body('address').optional().trim(),
]), userController.updateMe);

module.exports = router;
