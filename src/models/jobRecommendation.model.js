import mongoose from 'mongoose';

const jobRecommendationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    score: { type: Number, required: true, min: 0, max: 100 },
    reasons: { type: [String], default: [] },
    feedback: {
      type: String,
      enum: ['relevant', 'not_relevant', 'applied', 'interview', 'offer'],
    },
    deliveredAt: { type: Date },
  },
  { timestamps: true }
);

jobRecommendationSchema.index({ userId: 1, jobId: 1 }, { unique: true });
jobRecommendationSchema.index({ userId: 1, feedback: 1, score: -1 });

const JobRecommendation = mongoose.model('JobRecommendation', jobRecommendationSchema);
export default JobRecommendation;
