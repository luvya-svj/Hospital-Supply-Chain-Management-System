// Centralized error handling middleware
// Quality Rule: Handle errors gracefully with clear messages; never show stack traces to users.

function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${new Date().toISOString()} ${req.method} ${req.originalUrl}:`, err.message || err);

  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const message = err.clientMessage || (statusCode === 500 ? 'An unexpected server error occurred. Please try again later.' : err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode).json({
    error: message
  });
}

module.exports = errorHandler;
