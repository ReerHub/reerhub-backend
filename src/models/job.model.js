import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
  },
  { _id: false }
);

const experienceSchema = new mongoose.Schema(
  {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 },
  },
  { _id: false }
);

const salarySchema = new mongoose.Schema(
  {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 },
    currency: { type: String, trim: true, default: 'INR' },
    period: { type: String, enum: ['hour', 'month', 'year'] },
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobSource',
      required: true,
      index: true,
    },
    externalJobId: { type: String, trim: true },
    jobFingerprint: { type: String, trim: true },
    rawTitle: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    normalizedTitle: { type: String, trim: true },
    description: { type: String, default: '' },
    locations: { type: [locationSchema], default: [] },
    remoteType: {
      type: String,
      enum: ['onsite', 'hybrid', 'remote', 'unknown'],
      default: 'unknown',
    },
    employmentType: { type: String, trim: true },
    department: { type: String, trim: true },
    experience: experienceSchema,
    salary: salarySchema,
    skills: { type: [String], default: [] },
    jobCategory: { type: String, trim: true },
    seniority: { type: String, trim: true },
    applicationUrl: { type: String, required: true, trim: true },
    sourceUrl: { type: String, required: true, trim: true },
    postedAt: { type: Date },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'closed'], default: 'active', index: true },
    contentHash: { type: String, required: true },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

jobSchema.index(
  { sourceId: 1, externalJobId: 1 },
  {
    unique: true,
    partialFilterExpression: { externalJobId: { $type: 'string' } },
  }
);
jobSchema.index(
  { sourceId: 1, jobFingerprint: 1 },
  {
    unique: true,
    partialFilterExpression: { jobFingerprint: { $type: 'string' } },
  }
);
jobSchema.index({ companyId: 1, status: 1 });
jobSchema.index({ 'locations.city': 1, status: 1 });
jobSchema.index({ postedAt: -1 });

const Job = mongoose.model('Job', jobSchema);

export default Job;
