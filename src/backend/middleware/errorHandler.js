/**
 * =============================================================================
 * Global Error Handler Middleware
 * =============================================================================
 *
 * Table of Contents:
 * 1. Error Handler
 *
 * Catches all unhandled errors and returns a consistent JSON response.
 * =============================================================================
 */

/* --------------------------------------------------------------------------
 * 1. Error Handler
 * -------------------------------------------------------------------------- */

/**
 * Global error handling middleware. Catches errors thrown by route handlers
 * and returns a standardized JSON error response.
 *
 * @param {Error} err - The error object
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
function errorHandler(err, req, res, next) {
  console.error(`[Error] ${err.message}`);

  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.errors && { errors: err.errors }),
  });
}

module.exports = errorHandler;
