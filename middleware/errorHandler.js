/**
 * Global Error Handler Middleware
 */

const logger = require('../utils/logger');

/**
 * 404 Not Found handler - for unmatched routes
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route '${req.method} ${req.originalUrl}' not found`,
  });
}

/**
 * Global error handling middleware
 * Must have 4 parameters (err, req, res, next) for Express to treat it as error handler
 */
function globalErrorHandler(err, req, res, next) {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
  });

  // Handle specific error types
  if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    return res.status(503).json({
      success: false,
      message: 'Database access denied. Check credentials.',
    });
  }

  if (err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(503).json({
      success: false,
      message: 'Database table not found. Run: npm run db:setup',
    });
  }

  if (err.code === 'ECONNREFUSED' && err.port) {
    return res.status(503).json({
      success: false,
      message: 'Database connection refused. Is MySQL running?',
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = { notFoundHandler, globalErrorHandler };
