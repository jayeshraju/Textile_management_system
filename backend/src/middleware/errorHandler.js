/**
 * Central Error Handler Middleware.
 * Catches unhandled errors and ensures uniform JSON error responses across the API.
 */
const errorHandler = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production';

  // Handle JSON parsing error (e.g. bad payload)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        message: 'Malformed JSON payload in request body',
        code: 'BAD_REQUEST',
      },
    });
  }

  // Handle CORS policy error
  if (err.message && err.message.includes('not allowed by CORS policy')) {
    return res.status(403).json({
      error: {
        message: err.message,
        code: 'CSRF_BLOCKED',
      },
    });
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({
      error: {
        message: details.join('; ') || 'Database validation failed',
        code: 'VALIDATION_ERROR',
      },
    });
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: {
        message: `Invalid format for field '${err.path}'`,
        code: 'INVALID_IDENTIFIER',
      },
    });
  }

  // Handle MongoDB duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'record';
    return res.status(409).json({
      error: {
        message: `A resource with that ${field} already exists`,
        code: 'DUPLICATE_RESOURCE',
      },
    });
  }

  // Default internal server error
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected internal server error occurred';
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  if (isDev) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
  }

  return res.status(statusCode).json({
    error: {
      message,
      code,
    },
  });
};

module.exports = errorHandler;
