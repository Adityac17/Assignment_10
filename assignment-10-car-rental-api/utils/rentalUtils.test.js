'use strict';

/**
 * Lightweight, zero-dependency unit tests for the pure rental utils.
 * Run with:  node utils/rentalUtils.test.js   (or `npm test`)
 *
 * Exits with code 1 if any assertion fails, so it works in CI.
 */

const assert = require('assert');
const {
  daysBetween,
  calculateTotalCost,
  datesOverlap,
  hasBookingCollision,
  isFutureDate,
} = require('./rentalUtils');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL - ${name}`);
    console.error(`         ${err.message}`);
  }
}

console.log('\nrentalUtils unit tests\n----------------------');

// ---- daysBetween --------------------------------------------------------
test('daysBetween 2026-05-01 -> 2026-05-05 is 4 days', () => {
  assert.strictEqual(daysBetween('2026-05-01', '2026-05-05'), 4);
});

test('daysBetween same day is 0', () => {
  assert.strictEqual(daysBetween('2026-05-01', '2026-05-01'), 0);
});

// ---- calculateTotalCost -------------------------------------------------
test('cost = days * daily_rate (4 days * 50.00 = 200.00)', () => {
  assert.strictEqual(calculateTotalCost('2026-05-01', '2026-05-05', 50), 200);
});

test('cost respects fractional daily rate (4 * 49.99 = 199.96)', () => {
  assert.strictEqual(calculateTotalCost('2026-05-01', '2026-05-05', 49.99), 199.96);
});

test('same-day booking bills minimum of 1 day', () => {
  assert.strictEqual(calculateTotalCost('2026-05-01', '2026-05-01', 75), 75);
});

test('cost throws on non-positive rate', () => {
  assert.throws(() => calculateTotalCost('2026-05-01', '2026-05-05', 0));
});

// ---- datesOverlap -------------------------------------------------------
test('COLLISION: existing 05-01->05-05 vs new 05-03->05-07 overlaps', () => {
  assert.strictEqual(datesOverlap('2026-05-03', '2026-05-07', '2026-05-01', '2026-05-05'), true);
});

test('NO COLLISION: 05-01->05-05 vs 05-10->05-12 does not overlap', () => {
  assert.strictEqual(datesOverlap('2026-05-01', '2026-05-05', '2026-05-10', '2026-05-12'), false);
});

test('COLLISION: fully contained range overlaps', () => {
  assert.strictEqual(datesOverlap('2026-05-02', '2026-05-03', '2026-05-01', '2026-05-05'), true);
});

test('COLLISION: touching endpoints (05-05 end vs 05-05 start) overlaps', () => {
  assert.strictEqual(datesOverlap('2026-05-05', '2026-05-08', '2026-05-01', '2026-05-05'), true);
});

// ---- hasBookingCollision ------------------------------------------------
test('hasBookingCollision detects the partial-overlap scenario', () => {
  const existing = [
    { start_date: '2026-05-01', end_date: '2026-05-05' },
    { start_date: '2026-06-01', end_date: '2026-06-03' },
  ];
  const result = hasBookingCollision({ start_date: '2026-05-03', end_date: '2026-05-07' }, existing);
  assert.strictEqual(result, true);
});

test('hasBookingCollision returns false when no ranges overlap', () => {
  const existing = [{ start_date: '2026-05-01', end_date: '2026-05-05' }];
  const result = hasBookingCollision({ start_date: '2026-05-10', end_date: '2026-05-12' }, existing);
  assert.strictEqual(result, false);
});

test('hasBookingCollision returns false for empty list', () => {
  assert.strictEqual(hasBookingCollision({ start_date: '2026-05-01', end_date: '2026-05-05' }, []), false);
});

// ---- isFutureDate -------------------------------------------------------
test('isFutureDate true for tomorrow', () => {
  const now = new Date('2026-05-01T12:00:00Z');
  assert.strictEqual(isFutureDate('2026-05-02', now), true);
});

test('isFutureDate false for today', () => {
  const now = new Date('2026-05-01T12:00:00Z');
  assert.strictEqual(isFutureDate('2026-05-01', now), false);
});

test('isFutureDate false for past', () => {
  const now = new Date('2026-05-01T12:00:00Z');
  assert.strictEqual(isFutureDate('2026-04-01', now), false);
});

// ---- summary ------------------------------------------------------------
console.log('----------------------');
console.log(`${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
