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
 * POST /api/auth/login       - Authenticate user
 * POST /api/auth/register    - Create new account (requires verified OTP)
 * POST /api/auth/send-otp    - Send a 6-digit SMS verification code
 * POST /api/auth/verify-otp  - Verify a submitted OTP
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
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('address').optional().trim(),
  body('role').optional().isIn(['citizen', 'admin']).withMessage("Role must be 'citizen' or 'admin'"),
];

const sendOtpRules = [
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('purpose').optional().isIn(['signup', 'login', 'reset']),
];

const verifyOtpRules = [
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits'),
  body('purpose').optional().isIn(['signup', 'login', 'reset']),
];

/* --------------------------------------------------------------------------
 * 3. Route Definitions
 * -------------------------------------------------------------------------- */

router.post('/login', validate(loginRules), authController.login);
router.post('/register', validate(registerRules), authController.register);
router.post('/send-otp', validate(sendOtpRules), authController.sendOtp);
router.post('/verify-otp', validate(verifyOtpRules), authController.verifyOtp);

module.exports = router;
