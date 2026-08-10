import mongoose from "mongoose";
import { env } from "@/env";

type MongooseGlobal = typeof globalThis & {
  __mongoose?: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
    uri?: string;
  };
};

const globalForMongoose = globalThis as MongooseGlobal;

export async function connectToDatabase() {
  if (!globalForMongoose.__mongoose) {
    globalForMongoose.__mongoose = { conn: null, promise: null, uri: undefined };
  }

  // In dev, the global can survive hot reloads. If the URI changed (or we previously tried localhost),
  // reset cached connection state so we reconnect using the current env value.
  if (globalForMongoose.__mongoose.uri && globalForMongoose.__mongoose.uri !== env.MONGODB_URI) {
    globalForMongoose.__mongoose.conn = null;
    globalForMongoose.__mongoose.promise = null;
  }

  if (globalForMongoose.__mongoose.conn && mongoose.connection.readyState === 1) {
    return globalForMongoose.__mongoose.conn;
  }

  if (!globalForMongoose.__mongoose.promise) {
    globalForMongoose.__mongoose.uri = env.MONGODB_URI;
    globalForMongoose.__mongoose.promise = mongoose
      .connect(env.MONGODB_URI, {
        dbName: "campusguide",
        // Fail fast in dev/unstable networks (default can be ~30s)
        serverSelectionTimeoutMS: 5_000,
        connectTimeoutMS: 5_000,
        socketTimeoutMS: 10_000,
        // Every warm serverless instance holds its own pool, so the default of
        // 100 multiplies fast and can exhaust an Atlas connection cap. Each
        // instance handles one request at a time; a handful of sockets is plenty.
        maxPoolSize: 5,
        minPoolSize: 0,
        maxIdleTimeMS: 60_000,
      })
      .then((m) => m);
  }

  try {
    globalForMongoose.__mongoose.conn = await globalForMongoose.__mongoose.promise;
    return globalForMongoose.__mongoose.conn;
  } catch (err) {
    // Allow retry on next request if the initial connection failed.
    globalForMongoose.__mongoose.promise = null;
    globalForMongoose.__mongoose.conn = null;
    globalForMongoose.__mongoose.uri = undefined;
    throw err;
  }
}
