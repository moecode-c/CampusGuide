import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { AccountStatuses, User } from "../src/server/models/User";
import { Roles } from "../src/server/roles";
import { ensureSrvDns } from "../src/server/dns";

function getArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (idx === -1) return undefined;
  const raw = process.argv[idx];
  if (raw.includes("=")) return raw.split("=").slice(1).join("=");
  return process.argv[idx + 1];
}

function randomPassword() {
  // 18 chars url-safe
  return crypto.randomBytes(14).toString("base64url").slice(0, 18);
}

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

  const email = (getArg("--email") ?? "admin@campusguide.local").trim().toLowerCase();
  const name = (getArg("--name") ?? "Admin").trim() || "Admin";
  const password = (getArg("--password") ?? randomPassword()).trim();

  // The schema caps this at 1–4 but updateOne does not run validators, so an
  // out-of-range --year would be written straight through.
  const rawYear = Number(getArg("--year") ?? 1);
  const academicYear = Number.isFinite(rawYear) ? Math.min(4, Math.max(1, Math.trunc(rawYear))) : 1;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Put it in .env.local.");

  // Atlas SRV URIs need a resolver that answers SRV/TXT, and a remote cluster
  // needs more than the 5s that was tuned for localhost.
  ensureSrvDns(uri);

  await mongoose.connect(uri, {
    dbName: "campusguide",
    serverSelectionTimeoutMS: 30_000,
    connectTimeoutMS: 30_000,
    socketTimeoutMS: 45_000,
  });

  const passwordHash = await bcrypt.hash(password, 12);

  await User.updateOne(
    { email },
    {
      $set: {
        email,
        name,
        passwordHash,
        role: Roles.Admin,
        academicYear,
        // Without this the schema default (`pending`) is applied on insert, and
        // requireRole("admin") turns the new admin away from /admin entirely.
        status: AccountStatuses.Active,
        verifiedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  console.log("Admin account ready:");
  console.log(`  email: ${email}`);
  console.log(`  password: ${password}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
