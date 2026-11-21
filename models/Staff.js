const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
  {
    staffCode: { type: String, required: true, unique: true, trim: true },
    branchNo: { type: Number, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    roleTitle: {
      type: String,
      enum: ['chef', 'waiter', 'manager', 'administrator'],
      required: true
    },
    address: { type: String, default: '', trim: true, maxlength: 160 },
    dateOfBirth: { type: String, default: '' },
    salary: { type: Number, min: 0, default: 0 },
    workingPeriod: {
      type: String,
      enum: ['day', 'night', 'flexible'],
      default: 'flexible'
    },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Staff', staffSchema, 'staff');
