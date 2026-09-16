import mongoose from 'mongoose';

const jobSourceSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['greenhouse', 'ashby', 'custom'],
    },
    name: { type: String, required: true, trim: true },
    careersUrl: { type: String, required: true, trim: true },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
    lastSuccessfulSyncAt: { type: Date },
    lastAttemptedSyncAt: { type: Date },
  },
  { timestamps: true }
);

jobSourceSchema.index({ companyId: 1, careersUrl: 1 }, { unique: true });

const JobSource = mongoose.model('JobSource', jobSourceSchema);

export default JobSource;
