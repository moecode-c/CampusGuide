import mongoose from "mongoose";
import { env } from "@/env";
import { ensureSrvDns } from "@/server/dns";

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
    // An Atlas SRV URI needs a working SRV/TXT lookup before the driver can
    // dial anything; this adds public resolvers when the local one refuses.
    ensureSrvDns(env.MONGODB_URI);
    globalForMongoose.__mongoose.uri = env.MONGODB_URI;
    globalForMongoose.__mongoose.promise = mongoose
      .connect(env.MONGODB_URI, {
        dbName: "campusguide",
        /**
         * 5 seconds was tuned against a Mongo on localhost and is not enough for
         * a remote Atlas connection: a cold start has to do a DNS lookup, a TCP
         * handshake and a TLS handshake before the driver can pick a server, and
         * on a low-traffic app almost every request is a cold start. The
         * seeding scripts already use 30s for the same reason.
         *
         * Not higher than this, though. A serverless function is killed at its
         * own limit (10s on Vercel Hobby by default), so a database timeout
         * longer than that never fires — the platform kills the request first
         * and you get a generic error instead of a useful one. 15s leaves room
         * for a slow handshake while still failing before most function caps.
         */
        serverSelectionTimeoutMS: 15_000,
        connectTimeoutMS: 15_000,
        // Per-operation, not per-connection: a query that runs this long is a
        // problem to fix, not to wait out.
        socketTimeoutMS: 20_000,
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
