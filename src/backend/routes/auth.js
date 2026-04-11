/**
 * =============================================================================
 * Auth Routes
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Validation Rules
 * 3. Route Definitions
 *
 * POST /api/auth/login    - Authenticate user
 * POST /api/auth/register - Create new account
 * =============================================================================
 */

const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authController = require('../controllers/authController');

const router = Router();

/* --------------------------------------------------------------------------
 * 2. Validation Rules
 * -------------------------------------------------------------------------- */

const loginRules = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().trim(),
  body('address').optional().trim(),
];

/* --------------------------------------------------------------------------
 * 3. Route Definitions
 * -------------------------------------------------------------------------- */

router.post('/login', validate(loginRules), authController.login);
router.post('/register', validate(registerRules), authController.register);

module.exports = router;
