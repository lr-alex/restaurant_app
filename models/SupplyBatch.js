const mongoose = require('mongoose');

const supplyBatchSchema = new mongoose.Schema(
  {
    batchCode: { type: String, required: true, unique: true, trim: true },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true
    },
    branchNo: { type: Number, required: true, index: true },
    itemName: { type: String, required: true, trim: true, maxlength: 120 },
    receivedDate: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  'SupplyBatch',
  supplyBatchSchema,
  'supply_batches'
);
