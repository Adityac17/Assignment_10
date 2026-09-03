'use strict';

/**
 * Authentication middleware.
 *
 * Reads a Bearer token from the Authorization header and verifies it against
 * Supabase Auth via supabase.auth.getUser(token). On success, attaches the
 * authenticated user (including user.id, used for ownership checks) to req.user.
 *
 * Responds 401 when the header is missing/malformed or the token is invalid.
 */

const supabase = require('../config/supabase');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Missing or malformed Authorization header. Expected: Bearer <token>.',
      });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({ success: false, message: 'Bearer token is empty.' });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data || !data.user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }

    // Attach the authenticated user; user.id is a uuid used for ownership checks.
    req.user = data.user;
    req.accessToken = token;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = requireAuth;
