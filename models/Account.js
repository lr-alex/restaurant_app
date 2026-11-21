const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 40
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ['customer', 'staff', 'admin'],
      required: true,
      index: true
    },
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

accountSchema.set('toJSON', {
  transform: (_document, result) => {
    delete result.password;
    delete result.__v;
    return result;
  }
});

module.exports = mongoose.model('Account', accountSchema);
