import path from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ensureSrvDns } from "../src/server/dns";

export async function connect() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Put it in .env.local.");

  // Same SRV/DNS fallback the app uses, or seeding an Atlas cluster fails on
  // any network whose resolver refuses SRV lookups.
  ensureSrvDns(uri);

  await mongoose.connect(uri, {
    dbName: "campusguide",
    // Atlas is a network round trip away, not localhost. Five seconds is not
    // enough for a cold TLS handshake to a remote cluster.
    serverSelectionTimeoutMS: 30_000,
    connectTimeoutMS: 30_000,
    socketTimeoutMS: 45_000,
  });
}

export async function disconnect() {
  await mongoose.disconnect();
}
