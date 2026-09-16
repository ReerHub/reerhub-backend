import mongoose from 'mongoose';

const headquartersSchema = new mongoose.Schema(
  {
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
  },
  { _id: false }
);

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    website: { type: String, required: true, trim: true },
    careersUrl: { type: String, required: true, trim: true },
    logoUrl: { type: String, trim: true },
    industry: { type: String, trim: true },
    companyType: { type: String, trim: true },
    headquarters: headquartersSchema,
    country: { type: String, trim: true, default: 'India' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

companySchema.index({ slug: 1 }, { unique: true });

const Company = mongoose.model('Company', companySchema);

export default Company;
