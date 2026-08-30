import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * One row per admin kill switch. Absence means "off", so an empty collection is
 * a fully open site rather than a locked one — a failed write can never take
 * the drive offline by accident.
 */
const featureFlagSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, required: true, default: false },
    /** Optional custom notice shown to students in place of the default. */
    message: { type: String },

    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedByName: { type: String },
  },
  { timestamps: true }
);

export type FeatureFlagDoc = InferSchemaType<typeof featureFlagSchema>;

export const FeatureFlag: Model<FeatureFlagDoc> =
  (mongoose.models.FeatureFlag as Model<FeatureFlagDoc>) ||
  mongoose.model<FeatureFlagDoc>("FeatureFlag", featureFlagSchema);
