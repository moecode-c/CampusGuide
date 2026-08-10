import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Meaningful actions only — sign-ins, registrations, verification decisions,
 * bans, and content changes. Deliberately not a per-request access log: this
 * collection is meant to stay readable and small enough to page through.
 */
// Re-exported so existing server-side importers keep working; the definitions
// live in lib/ so client components can use them without importing mongoose.
export { ActivityActions, type ActivityAction } from "@/lib/activityActions";

const activityLogSchema = new Schema(
  {
    /** Who performed the action. */
    actorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    // Denormalized so the log still reads correctly after an account is deleted.
    actorName: { type: String },
    actorMiuId: { type: String },

    action: { type: String, required: true, index: true },

    /** Who or what it was done to — lets the per-user log show actions taken *on* someone. */
    targetId: { type: Schema.Types.ObjectId, index: true },
    targetType: { type: String },
    /** Short human-readable summary, e.g. a file name or a folder path. */
    targetLabel: { type: String },

    meta: { type: Schema.Types.Mixed },
    ip: { type: String },

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

// The dashboard reads newest-first, both globally and filtered to one account.
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ actorId: 1, createdAt: -1 });
activityLogSchema.index({ targetId: 1, createdAt: -1 });

export type ActivityLogDoc = InferSchemaType<typeof activityLogSchema>;

export const ActivityLog: Model<ActivityLogDoc> =
  (mongoose.models.ActivityLog as Model<ActivityLogDoc>) ||
  mongoose.model<ActivityLogDoc>("ActivityLog", activityLogSchema);
