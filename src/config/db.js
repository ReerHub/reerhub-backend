import mongoose from 'mongoose';

const resolveDbName = () => {
  // Explicit value always wins (e.g. MONGO_DB_NAME=reerhub-prod in prod).
  if (process.env.MONGO_DB_NAME) return process.env.MONGO_DB_NAME;
  // Dev and prod must never share a database by accident.
  if (process.env.NODE_ENV === 'production') return 'reerhub-prod';
  if (process.env.NODE_ENV === 'test') return 'reerhub-test';
  return 'reerhub-dev';
};

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined');
    }
    const dbName = resolveDbName();
    await mongoose.connect(mongoUri, {
      dbName,
    });

    console.log(
      `✅ MongoDB connected to DB: ${dbName} (NODE_ENV=${process.env.NODE_ENV || 'development'})`
    );
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
};

export default connectDB;

export const disconnectDB = async () => {
  await mongoose.disconnect();
};
