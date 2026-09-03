'use strict';

/**
 * Pure, dependency-free helpers for rental booking logic.
 *
 * These are intentionally free of any database or HTTP concerns so they can be
 * unit-tested in isolation (see rentalUtils.test.js).
 */

/**
 * Parse a YYYY-MM-DD (or ISO) date string into a UTC Date at midnight.
 * Using UTC avoids timezone drift when computing day differences.
 *
 * @param {string|Date} value
 * @returns {Date}
 */
function toUtcDate(value) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const parts = String(value).slice(0, 10).split('-').map(Number);
  const [y, m, d] = parts;
  return new Date(Date.UTC(y, m - 1, d));
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Number of rental days between start and end (inclusive of both endpoints is a
 * business choice; here we use the plain calendar span: end - start).
 *
 * Example: 2026-05-01 -> 2026-05-05 = 4 days.
 *
 * @param {string|Date} startDate
 * @param {string|Date} endDate
 * @returns {number} whole number of days (>= 0)
 */
function daysBetween(startDate, endDate) {
  const start = toUtcDate(startDate);
  const end = toUtcDate(endDate);
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/**
 * Compute the total rental cost server-side.
 *
 * total = days(end - start) * dailyRate
 *
 * If start === end (a same-day booking), we bill a minimum of 1 day so the
 * customer is never charged 0. This is a documented design choice.
 *
 * @param {string|Date} startDate
 * @param {string|Date} endDate
 * @param {number} dailyRate
 * @returns {number} total cost rounded to 2 decimals
 */
function calculateTotalCost(startDate, endDate, dailyRate) {
  const rate = Number(dailyRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('daily_rate must be a positive number');
  }
  let days = daysBetween(startDate, endDate);
  if (days < 0) {
    throw new Error('end_date must be on or after start_date');
  }
  if (days === 0) {
    days = 1; // minimum one-day charge for a same-day booking
  }
  return Math.round(days * rate * 100) / 100;
}

/**
 * Determine whether two date ranges overlap.
 *
 * Two ranges [aStart, aEnd] and [bStart, bEnd] DO NOT overlap only when one ends
 * strictly before the other begins:
 *     NOT (aEnd < bStart OR aStart > bEnd)
 *
 * We treat the ranges as inclusive on both ends (a booking that ends on the same
 * day another starts is considered a conflict, since the vehicle is not returned
 * and re-prepared instantaneously). This is a documented design choice.
 *
 * Partial overlap example (must return true):
 *   existing 2026-05-01 -> 2026-05-05
 *   new      2026-05-03 -> 2026-05-07
 *
 * @param {string|Date} aStart
 * @param {string|Date} aEnd
 * @param {string|Date} bStart
 * @param {string|Date} bEnd
 * @returns {boolean} true if the ranges overlap
 */
function datesOverlap(aStart, aEnd, bStart, bEnd) {
  const as = toUtcDate(aStart).getTime();
  const ae = toUtcDate(aEnd).getTime();
  const bs = toUtcDate(bStart).getTime();
  const be = toUtcDate(bEnd).getTime();

  const noOverlap = ae < bs || as > be;
  return !noOverlap;
}

/**
 * Given a new booking range and a list of existing rentals, return true if the
 * new range collides with any of them. Callers should pre-filter `existing` to
 * only include rentals with status in ('booked', 'active').
 *
 * @param {{start_date:string,end_date:string}} newBooking
 * @param {Array<{start_date:string,end_date:string}>} existing
 * @returns {boolean}
 */
function hasBookingCollision(newBooking, existing) {
  if (!Array.isArray(existing) || existing.length === 0) return false;
  return existing.some((r) =>
    datesOverlap(newBooking.start_date, newBooking.end_date, r.start_date, r.end_date)
  );
}

/**
 * Is the given date strictly in the future relative to `now` (date-only compare)?
 *
 * @param {string|Date} date
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
function isFutureDate(date, now = new Date()) {
  const target = toUtcDate(date).getTime();
  const today = toUtcDate(now).getTime();
  return target > today;
}

module.exports = {
  toUtcDate,
  daysBetween,
  calculateTotalCost,
  datesOverlap,
  hasBookingCollision,
  isFutureDate,
};
