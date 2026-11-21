const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const AppError = require('../utils/AppError');
const {
  currentTimeString,
  isPastDate,
  isValidTime,
  parseDateOnly,
  todayString,
  weekdayName
} = require('../utils/dates');

const ACTIVE_STATUSES = ['pending', 'confirmed'];
const ALL_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'];

async function validateBookingInput(input, options = {}) {
  const branchNo = Number(input.branchNo);
  const partySize = Number(input.partySize);
  const bookingDate = String(input.bookingDate || '');
  const slotStart = String(input.slotStart || '');
  const slotEnd = String(input.slotEnd || '');

  if (!Number.isInteger(branchNo) || branchNo < 1) {
    throw new AppError(400, 'Select a valid branch.');
  }
  if (!parseDateOnly(bookingDate) || isPastDate(bookingDate)) {
    throw new AppError(400, 'Choose today or a future booking date.');
  }
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 12) {
    throw new AppError(400, 'Party size must be between 1 and 12.');
  }
  if (!isValidTime(slotStart) || !isValidTime(slotEnd) || slotStart >= slotEnd) {
    throw new AppError(400, 'Select a valid booking slot.');
  }

  const branch = await Branch.findOne({ branchNo, active: true });
  if (!branch) {
    throw new AppError(404, 'The selected branch is unavailable.');
  }
  if (weekdayName(bookingDate) === branch.restDay) {
    throw new AppError(400, `This branch is closed on ${branch.restDay}s.`);
  }

  const slot = branch.bookingSlots.find(
    (candidate) =>
      candidate.startTime === slotStart && candidate.endTime === slotEnd
  );
  if (!slot) {
    throw new AppError(400, 'The selected time is not an available booking slot.');
  }
  if (bookingDate === todayString() && slotStart <= currentTimeString()) {
    throw new AppError(400, 'The selected booking time has already passed.');
  }

  if (options.customerId) {
    const duplicateFilter = {
      customer: options.customerId,
      branchNo,
      bookingDate,
      slotStart,
      status: { $in: ACTIVE_STATUSES }
    };
    if (options.excludeId) {
      duplicateFilter._id = { $ne: options.excludeId };
    }
    const duplicate = await Booking.exists(duplicateFilter);
    if (duplicate) {
      throw new AppError(
        409,
        'You already have an active booking for this branch and time.'
      );
    }
  }

  const occupancyFilter = {
    branchNo,
    bookingDate,
    slotStart,
    status: { $in: ACTIVE_STATUSES }
  };
  if (options.excludeId) {
    occupancyFilter._id = { $ne: options.excludeId };
  }
  const occupied = await Booking.aggregate([
    { $match: occupancyFilter },
    { $group: { _id: null, total: { $sum: '$partySize' } } }
  ]);
  const occupiedSeats = occupied[0]?.total || 0;
  if (occupiedSeats + partySize > slot.capacity) {
    throw new AppError(
      409,
      `Only ${Math.max(slot.capacity - occupiedSeats, 0)} seats remain for this slot.`
    );
  }

  return {
    branch,
    slot,
    data: {
      branchNo,
      bookingDate,
      slotStart,
      slotEnd,
      partySize,
      notes: String(input.notes || '').trim().slice(0, 300)
    }
  };
}

async function createBooking(customerId, input) {
  const { data } = await validateBookingInput(input, { customerId });
  return Booking.create({
    ...data,
    customer: customerId,
    status: 'pending'
  });
}

async function updateCustomerBooking(customerId, bookingId, input) {
  const existing = await Booking.findOne({ _id: bookingId, customer: customerId });
  if (!existing) {
    throw new AppError(404, 'Booking not found.');
  }
  if (!ACTIVE_STATUSES.includes(existing.status)) {
    throw new AppError(409, 'Only active bookings can be changed.');
  }
  if (
    existing.bookingDate < todayString() ||
    (existing.bookingDate === todayString() &&
      existing.slotStart <= currentTimeString())
  ) {
    throw new AppError(409, 'Past bookings cannot be changed.');
  }

  const { data } = await validateBookingInput(input, {
    customerId,
    excludeId: existing._id
  });
  Object.assign(existing, data);
  await existing.save();
  return existing;
}

async function cancelCustomerBooking(customerId, bookingId) {
  const booking = await Booking.findOne({ _id: bookingId, customer: customerId });
  if (!booking) {
    throw new AppError(404, 'Booking not found.');
  }
  if (!ACTIVE_STATUSES.includes(booking.status)) {
    throw new AppError(409, 'This booking can no longer be cancelled.');
  }
  booking.status = 'cancelled';
  await booking.save();
  return booking;
}

async function updateBookingStatus(booking, status, role) {
  if (!ALL_STATUSES.includes(status)) {
    throw new AppError(400, 'Invalid booking status.');
  }
  if (role === 'staff' && booking.status === 'completed' && status !== 'completed') {
    throw new AppError(409, 'Completed bookings cannot be reopened.');
  }
  if (status === 'confirmed' && ['cancelled', 'completed'].includes(booking.status)) {
    throw new AppError(409, 'A closed booking cannot be confirmed.');
  }
  booking.status = status;
  await booking.save();
  return booking;
}

module.exports = {
  ACTIVE_STATUSES,
  ALL_STATUSES,
  cancelCustomerBooking,
  createBooking,
  updateBookingStatus,
  updateCustomerBooking,
  validateBookingInput
};
