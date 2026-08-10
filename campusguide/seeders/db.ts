import path from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";

export async function connect() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Put it in .env.local.");

  await mongoose.connect(uri, {
    dbName: "campusguide",
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 5000,
  });
}

export async function disconnect() {
  await mongoose.disconnect();
}
