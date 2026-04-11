/**
 * =============================================================================
 * Validation Middleware
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. validate - Run express-validator chains and handle errors
 *
 * Wraps express-validator to provide consistent validation error responses.
 * =============================================================================
 */

const { validationResult } = require('express-validator');

/* --------------------------------------------------------------------------
 * 2. validate
 * -------------------------------------------------------------------------- */

/**
 * Middleware factory that runs an array of express-validator validation chains.
 * If validation fails, returns 400 with error details.
 * If validation passes, calls next().
 *
 * @param {Array} validations - Array of express-validator validation chains
 * @returns {function} Express middleware function
 */
function validate(validations) {
  return async (req, res, next) => {
    for (const validation of validations) {
      await validation.run(req);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(e => ({
          field: e.path,
          message: e.msg,
        })),
      });
    }

    next();
  };
}

module.exports = validate;
