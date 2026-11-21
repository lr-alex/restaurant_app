const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    branchNo: { type: Number, required: true, index: true },
    bookingDate: { type: String, required: true, index: true },
    slotStart: { type: String, required: true },
    slotEnd: { type: String, required: true },
    partySize: { type: Number, required: true, min: 1, max: 12 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
      index: true
    },
    notes: { type: String, default: '', trim: true, maxlength: 300 }
  },
  { timestamps: true }
);

bookingSchema.index({
  branchNo: 1,
  bookingDate: 1,
  slotStart: 1,
  status: 1
});

module.exports = mongoose.model('Booking', bookingSchema);
