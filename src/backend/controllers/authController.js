/**
 * =============================================================================
 * Auth Controller
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. login    - Authenticate user and return JWT
 * 3. register - Create new user account and return JWT
 * 4. Helper   - Generate JWT token
 *
 * Handles user authentication and registration.
 * =============================================================================
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Notification = require('../models/Notification');

/* --------------------------------------------------------------------------
 * 4. Helper - Generate JWT token
 * -------------------------------------------------------------------------- */

/**
 * Generates a JWT access token for a user.
 * @param {object} user - User object with id and role
 * @returns {string} Signed JWT token
 */
function generateToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

/* --------------------------------------------------------------------------
 * 2. login
 * -------------------------------------------------------------------------- */

/**
 * Authenticates a user with email and password.
 * Returns a JWT token and user profile on success.
 *
 * @param {object} req - Express request (body: { email, password })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user);
    const notificationCount = await Notification.countUnread(user.id);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address,
          avatar: user.avatar,
          role: user.role,
          joinedDate: user.joined_date,
        },
        notificationCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 3. register
 * -------------------------------------------------------------------------- */

/**
 * Creates a new user account.
 * Returns a JWT token and user profile on success.
 *
 * @param {object} req - Express request (body: { name, email, password, phone, address })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function register(req, res, next) {
  try {
    const { name, email, password, phone, address } = req.body;

    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      phone,
      address,
      password_hash,
      role: 'citizen',
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address,
          avatar: user.avatar,
          role: user.role,
          joinedDate: user.joined_date,
        },
        notificationCount: 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register };
