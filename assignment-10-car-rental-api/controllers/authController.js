'use strict';

/**
 * Auth controller — wraps Supabase Auth.
 *
 * Design choice: the customer's display name is stored in Supabase Auth
 * `user_metadata.name` at sign-up (options.data.name). Supabase manages the
 * auth.users table automatically; we never write to it directly.
 */

const supabase = require('../config/supabase');
const { sendSuccess, sendError } = require('../middleware/errorHandler');

/**
 * POST /api/auth/register
 * Body: { name, email, password }
 */
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body || {};

    if (!email || !password) {
      return sendError(res, 400, 'email and password are required.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Stored on auth.users.user_metadata; returned as user.user_metadata.name
        data: { name: name || null },
      },
    });

    if (error) {
      // e.g. weak password, duplicate email, invalid email
      return sendError(res, 400, error.message);
    }

    const user = data.user;
    return sendSuccess(res, 201, 'Registration successful. Please verify your email if confirmation is enabled.', {
      id: user ? user.id : null,
      email: user ? user.email : email,
      name: user && user.user_metadata ? user.user_metadata.name : name || null,
      // If email confirmation is disabled, Supabase returns a session here.
      session: data.session || null,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns the Supabase access_token to the client.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return sendError(res, 400, 'email and password are required.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data || !data.session) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    return sendSuccess(res, 200, 'Login successful.', {
      access_token: data.session.access_token,
      token_type: data.session.token_type,
      expires_in: data.session.expires_in,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata ? data.user.user_metadata.name : null,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login };
