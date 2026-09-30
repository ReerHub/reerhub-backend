import mongoose from 'mongoose';

const schedulerStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    dueAt: { type: Date, required: true, index: true },
    claimedUntil: { type: Date },
    lastCompletedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('SchedulerState', schedulerStateSchema);
