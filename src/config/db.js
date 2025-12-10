import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB_NAME,
    });

    console.log(`✅ MongoDB connected to DB: ${process.env.MONGO_DB_NAME}`);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
  }
};

export default connectDB;
