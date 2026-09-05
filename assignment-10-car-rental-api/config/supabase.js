'use strict';

/**
 * Supabase client factory.
 *
 * The client is created from environment variables:
 *   - SUPABASE_URL
 *   - SUPABASE_ANON_KEY
 *
 * Per the assignment constraint, if either variable is missing we log a clear
 * startup WARNING but DO NOT crash. This lets the server boot for inspection /
 * grading even when no live Supabase project has been wired up yet. Any actual
 * request that hits Supabase will surface a runtime error, which the centralized
 * error handler turns into a clean JSON response.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabase;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '\n[WARNING] Supabase credentials are missing.\n' +
      '          SUPABASE_URL and/or SUPABASE_ANON_KEY are not set in the environment.\n' +
      '          The server will still boot, but any request that touches the database\n' +
      '          or auth will fail until you add real credentials to your .env file.\n' +
      '          See README.md > "Supabase Setup" for instructions.\n'
  );

  // Create the client with harmless placeholder values so that `require`-ing this
  // module never throws. Real calls will fail gracefully at request time.
  supabase = createClient(
    SUPABASE_URL || 'https://placeholder.supabase.co',
    SUPABASE_ANON_KEY || 'placeholder-anon-key'
  );
} else {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

module.exports = supabase;
