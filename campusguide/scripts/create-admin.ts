import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { User } from "../src/server/models/User";
import { Roles } from "../src/server/roles";

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
  const academicYear = Number(getArg("--year") ?? 1);

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Put it in .env.local.");

  await mongoose.connect(uri, {
    dbName: "campusguide",
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 5000,
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
        academicYear: Number.isFinite(academicYear) ? academicYear : 1,
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
