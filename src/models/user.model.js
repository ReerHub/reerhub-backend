import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [3, 'Name must be at least 3 characters'],
      maxlength: [50, 'Name must be < 50 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },

    // UPDATED ROLES
    // 'candidate' = Job Seeker (formerly 'user')
    // 'recruiter' = Company/HR
    // 'admin' = System Admin
    role: {
      type: String,
      enum: ['candidate', 'recruiter', 'admin', 'user'], // Kept 'user' for safety
      default: 'candidate',
    },

    // Optional: Company details for recruiters
    companyName: {
      type: String,
      trim: true,
      default: null,
    },

    googleId: {
      type: String,
      default: null,
    },
    isGoogleUser: {
      type: Boolean,
      default: false,
    },

    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
    },
    coins: {
      type: Number,
      default: 5, // Give 5 coins on signup & Google login
    },

    coinHistory: [
      {
        type: {
          type: String,
          enum: ['deduct', 'refund', 'credit'],
          required: true,
        },
        coins: {
          type: Number,
          required: true,
        },
        description: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    paymentHistory: [
      {
        orderId: String,
        paymentId: String,
        amount: Number,
        coins: Number,
        status: { type: String, enum: ['success', 'failed', 'pending'] },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
