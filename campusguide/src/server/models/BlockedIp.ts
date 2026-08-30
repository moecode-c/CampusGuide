import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { BLOCK_REASONS } from "@/lib/ipBlocks";

/**
 * An address the app refuses to serve.
 *
 * Rows are kept after they lapse rather than expired away by a TTL index: a
 * blocking decision is a moderation action, and the record of who blocked what
 * and why is worth more than the few bytes it costs. `expiresAt` in the past
 * simply means it is no longer enforced.
 */
const blockedIpSchema = new Schema(
  {
    ip: { type: String, required: true, unique: true, index: true },

    reason: { type: String, enum: BLOCK_REASONS, required: true },
    /** Free text from the admin — usually what they saw in the log. */
    note: { type: String, maxlength: 500 },

    /** Null means it stays until someone lifts it. */
    expiresAt: { type: Date, default: null, index: true },

    createdById: { type: Schema.Types.ObjectId, ref: "User" },
    // Denormalized so the record still reads correctly if the admin is deleted.
    createdByName: { type: String },
  },
  { timestamps: true }
);

// The admin list reads newest first.
blockedIpSchema.index({ createdAt: -1 });

export type BlockedIpDoc = InferSchemaType<typeof blockedIpSchema>;

export const BlockedIp: Model<BlockedIpDoc> =
  (mongoose.models.BlockedIp as Model<BlockedIpDoc>) ||
  mongoose.model<BlockedIpDoc>("BlockedIp", blockedIpSchema);
