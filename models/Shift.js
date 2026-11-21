const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
      index: true
    },
    branchNo: { type: Number, required: true, index: true },
    shiftDate: { type: String, required: true, index: true },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    }
  },
  { timestamps: true }
);

shiftSchema.index({ staff: 1, shiftDate: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model('Shift', shiftSchema);
