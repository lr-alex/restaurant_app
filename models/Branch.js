const mongoose = require('mongoose');

const bookingSlotSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    },
    capacity: { type: Number, required: true, min: 1, max: 200 }
  },
  { _id: false }
);

const branchSchema = new mongoose.Schema(
  {
    branchNo: { type: Number, required: true, unique: true, min: 1 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    address: { type: String, required: true, trim: true, maxlength: 160 },
    openTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    },
    closeTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    },
    restDay: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true
    },
    bookingSlots: {
      type: [bookingSlotSchema],
      validate: {
        validator: (slots) => slots.length > 0,
        message: 'A branch must have at least one booking slot'
      }
    },
    isResting: { type: Boolean, default: false },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Branch', branchSchema);
