const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Account = require('../models/Account');
const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const Order = require('../models/Order');

test('account role enum rejects unknown roles', () => {
  const account = new Account({
    username: 'demo',
    password: 'plain-demo-password',
    role: 'owner',
    profileId: new mongoose.Types.ObjectId()
  });
  assert.ok(account.validateSync().errors.role);
  assert.equal(account.toJSON().password, undefined);
});

test('booking party size must remain between 1 and 12', () => {
  const base = {
    customer: new mongoose.Types.ObjectId(),
    branchNo: 1,
    bookingDate: '2026-12-10',
    slotStart: '19:00',
    slotEnd: '21:00'
  };
  assert.ok(new Booking({ ...base, partySize: 0 }).validateSync().errors.partySize);
  assert.ok(new Booking({ ...base, partySize: 13 }).validateSync().errors.partySize);
  assert.equal(new Booking({ ...base, partySize: 2 }).validateSync(), undefined);
});

test('branch requires at least one booking slot', () => {
  const branch = new Branch({
    branchNo: 9,
    name: 'Test Room',
    address: '1 Test Street',
    openTime: '09:00',
    closeTime: '17:00',
    restDay: 'Monday',
    bookingSlots: []
  });
  assert.ok(branch.validateSync().errors.bookingSlots);
});

test('orders require line items and enforce a non-negative total', () => {
  const order = new Order({
    customer: new mongoose.Types.ObjectId(),
    branchNo: 1,
    items: [],
    totalAmount: -1
  });
  const errors = order.validateSync().errors;
  assert.ok(errors.items);
  assert.ok(errors.totalAmount);
});
