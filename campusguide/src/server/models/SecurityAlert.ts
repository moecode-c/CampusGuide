import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { AlertSeverities, AlertTypes } from "@/lib/alerts";

/**
 * One raised suspicion, shown on the admin overview until acknowledged.
 *
 * Alerts are deduplicated on `(type, subject)` while unacknowledged: a password
 * being guessed a hundred times is one alert with a rising count, not a hundred
 * alerts that bury everything else on the dashboard.
 */
const securityAlertSchema = new Schema(
  {
    type: { type: String, enum: Object.values(AlertTypes), required: true, index: true },
    severity: { type: String, enum: Object.values(AlertSeverities), required: true, index: true },

    /**
     * What the alert is *about* — a user id, or an IP address. Half of the
     * dedupe key, and what the admin clicks through to.
     */
    subject: { type: String, required: true, index: true },
    /** Human-readable version of the subject: a student's name, or the raw IP. */
    subjectLabel: { type: String },
    /** Set when the subject is (or maps to) a real account. */
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },

    /** How many underlying events this alert represents. */
    count: { type: Number, required: true, default: 1 },
    message: { type: String, required: true },

    firstSeenAt: { type: Date, required: true, default: Date.now },
    lastSeenAt: { type: Date, required: true, default: Date.now, index: true },

    acknowledgedAt: { type: Date },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User" },
    acknowledgedByName: { type: String },
  },
  { timestamps: true }
);

// The dashboard's only query: unacknowledged, newest first.
securityAlertSchema.index({ acknowledgedAt: 1, lastSeenAt: -1 });
// The dedupe lookup. Partial so acknowledged alerts don't block a fresh one
// being raised for the same subject later.
securityAlertSchema.index(
  { type: 1, subject: 1 },
  { unique: true, partialFilterExpression: { acknowledgedAt: { $exists: false } } }
);

export type SecurityAlertDoc = InferSchemaType<typeof securityAlertSchema>;

export const SecurityAlert: Model<SecurityAlertDoc> =
  (mongoose.models.SecurityAlert as Model<SecurityAlertDoc>) ||
  mongoose.model<SecurityAlertDoc>("SecurityAlert", securityAlertSchema);
