import mongoose from "mongoose";
import { env } from "../config/env.js";

export const connectDB=async()=>{
try {
   const conn=await mongoose.connect(env.mongoUri);
   console.log(`MongoDB connected:${conn.connection.host}`);
} catch (error) {
    console.log("MongoDB connection error:",error);
    process.exit(1);
}
};
