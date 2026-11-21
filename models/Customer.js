const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    customerCode: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    dateOfBirth: { type: String, default: '' },
    isMember: { type: Boolean, default: false },
    vipId: { type: String, default: null },
    favoriteMealIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meal'
      }
    ],
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Customer', customerSchema);
