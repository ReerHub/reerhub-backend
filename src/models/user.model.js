import mongoose from 'mongoose';

const TECH_TRACKS = [
  'software',
  'ai-ml',
  'data',
  'cloud-infra',
  'mobile',
  'security',
  'qa',
  'systems',
  'eng-management',
];

const profileSchema = new mongoose.Schema(
  {
    headline: { type: String, trim: true, maxlength: 160 },
    currentRole: { type: String, trim: true, maxlength: 120 },
    techTrack: { type: String, enum: TECH_TRACKS },
    techRoles: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    city: { type: String, trim: true, maxlength: 120 },
    experienceYears: { type: Number, min: 0, max: 60 },
    remoteType: {
      type: String,
      enum: ['onsite', 'hybrid', 'remote', 'unknown'],
      default: 'unknown',
    },
    targetLocations: { type: [String], default: [] },
    availability: {
      type: String,
      enum: ['actively-looking', 'open', 'not-looking'],
      default: 'open',
    },
    education: { type: String, trim: true, maxlength: 240 },
    experienceSummary: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true, index: true },
    avatarUrl: { type: String, trim: true },
    authProvider: {
      type: String,
      enum: ['email', 'google'],
      default: 'email',
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    profile: { type: profileSchema, default: {} },
    notificationPreferences: {
      digest: {
        type: String,
        enum: ['daily', 'weekdays', 'weekly', 'paused'],
        default: 'daily',
      },
      lastDigestAt: { type: Date },
    },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
