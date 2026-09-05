'use strict';

/**
 * Centralized error handling + a consistent JSON response shape across the API.
 *
 * Every response in this API uses the shape:
 *   { success: boolean, message: string, data?: any }
 *
 * `sendSuccess` and `sendError` are exported helpers so controllers stay concise
 * and consistent. `errorHandler` is the Express error-handling middleware
 * (4-arg signature) registered last in server.js. `notFoundHandler` catches
 * unmatched routes.
 */

function sendSuccess(res, statusCode, message, data) {
  const body = { success: true, message };
  if (data !== undefined) body.data = data;
  return res.status(statusCode).json(body);
}

function sendError(res, statusCode, message, data) {
  const body = { success: false, message };
  if (data !== undefined) body.data = data;
  return res.status(statusCode).json(body);
}

// 404 for unmatched routes.
function notFoundHandler(req, res) {
  return sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

// Express error-handling middleware (must have 4 args).
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  if (statusCode >= 500) {
    // Log server-side faults for debugging; do not leak stack traces to clients.
    console.error('[ERROR]', err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = { sendSuccess, sendError, notFoundHandler, errorHandler };
