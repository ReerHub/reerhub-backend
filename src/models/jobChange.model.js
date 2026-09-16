import mongoose from 'mongoose';

const jobChangeSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['created', 'updated', 'closed', 'reopened'],
    },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },
    detectedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

jobChangeSchema.index({ jobId: 1, detectedAt: -1 });

const JobChange = mongoose.model('JobChange', jobChangeSchema);

export default JobChange;
