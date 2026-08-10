import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { Roles, type Role } from "@/server/roles";

export const AccountStatuses = {
  /** Registered, waiting for an admin to check their ID photo. Can sign in, but only sees the pending screen. */
  Pending: "pending",
  /** Verified student or admin. Full access. */
  Active: "active",
  /** Locked out. Rejected at the next authenticated request, not just at sign-in. */
  Banned: "banned",
} as const;

export type AccountStatus = (typeof AccountStatuses)[keyof typeof AccountStatuses];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Object.values(Roles), required: true, default: Roles.Student },
    academicYear: { type: Number, min: 1, max: 4, required: true },

    // MIU identity. Sparse so the seeded admin accounts — which predate this and
    // have no student ID — don't all collide on a single null in the unique index.
    miuId: { type: String, unique: true, sparse: true, index: true },
    phone: { type: String },

    status: {
      type: String,
      enum: Object.values(AccountStatuses),
      required: true,
      default: AccountStatuses.Pending,
      index: true,
    },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    bannedAt: { type: Date },
    banReason: { type: String },
    rejectionReason: { type: String },

    // Written at most once a minute per user; the source of the DAU/WAU/MAU counts.
    lastSeenAt: { type: Date, index: true },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { role: Role; status: AccountStatus };

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", userSchema);
