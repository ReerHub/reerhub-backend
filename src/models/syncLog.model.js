import mongoose from 'mongoose';

const syncStatsSchema = new mongoose.Schema(
  {
    fetched: { type: Number, default: 0 },
    parsed: { type: Number, default: 0 },
    newJobs: { type: Number, default: 0 },
    updatedJobs: { type: Number, default: 0 },
    unchangedJobs: { type: Number, default: 0 },
    closedJobs: { type: Number, default: 0 },
    duplicates: { type: Number, default: 0 },
  },
  { _id: false }
);

const syncLogSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobSource',
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    status: {
      type: String,
      enum: ['running', 'success', 'partial', 'failed'],
      required: true,
    },
    stats: { type: syncStatsSchema, default: () => ({}) },
    errors: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

syncLogSchema.index({ sourceId: 1, startedAt: -1 });

const SyncLog = mongoose.model('SyncLog', syncLogSchema);

export default SyncLog;
