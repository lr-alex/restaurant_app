const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addDaysString,
  isPastDate,
  parseDateOnly,
  weekdayName
} = require('../utils/dates');

test('parseDateOnly accepts valid dates and rejects impossible dates', () => {
  assert.ok(parseDateOnly('2028-02-29'));
  assert.equal(parseDateOnly('2027-02-29'), null);
  assert.equal(parseDateOnly('2026-13-01'), null);
  assert.equal(parseDateOnly('10/12/2026'), null);
});

test('weekdayName uses date-only UTC-safe calculation', () => {
  assert.equal(weekdayName('2026-11-21'), 'Saturday');
  assert.equal(weekdayName('2026-11-23'), 'Monday');
});

test('addDaysString crosses month boundaries', () => {
  assert.equal(addDaysString('2026-11-30', 1), '2026-12-01');
  assert.equal(addDaysString('2026-01-01', -1), '2025-12-31');
});

test('past dates are distinguished from invalid and today values', () => {
  assert.equal(isPastDate('2000-01-01'), true);
  assert.equal(isPastDate('not-a-date'), true);
  assert.equal(isPastDate('2999-01-01'), false);
});
