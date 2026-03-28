import mongoose from "mongoose";
import { env } from "../config/env.js";

export const connectDB=async()=>{
try {
   const conn=await mongoose.connect(env.mongoUri);
   console.log(`MongoDB connected:${conn.connection.host}`);
   return conn;
} catch (error) {
    throw error;
}
};
