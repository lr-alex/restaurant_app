const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema(
  {
    mealCode: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, required: true, trim: true, maxlength: 50 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    price: { type: Number, required: true, min: 0 },
    isAvailable: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Meal', mealSchema);
