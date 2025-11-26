import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "MERN-Authentication",
    });
    console.log("✅ MongoDB Database connected successfully");
  } catch (error) {
    console.error("❌ MongoDB Database connection failed:", error);
  }
};
export default connectDB;