/**
 * =============================================================================
 * User Routes
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Route Definitions
 *
 * GET  /api/users/me                - Get current user profile
 * PUT  /api/users/me                - Update current user profile (name, address)
 * PUT  /api/users/me/password       - Change current user's password
 * POST /api/users/me/phone/send-otp - Send OTP to a new phone number
 * PUT  /api/users/me/phone          - Verify OTP and update phone number
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

router.put('/me/password', authenticate, validate([
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
]), userController.changePassword);

router.post('/me/phone/check', authenticate, validate([
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
]), userController.checkPhoneAvailable);

router.post('/me/phone/send-otp', authenticate, validate([
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
]), userController.sendPhoneChangeOtp);

router.put('/me/phone', authenticate, validate([
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits'),
]), userController.updatePhone);

module.exports = router;
