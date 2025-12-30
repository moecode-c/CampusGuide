import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const ResourceTypes = {
  Video: "video",
  Pdf: "pdf",
  Summary: "summary",
} as const;

export type ResourceType = (typeof ResourceTypes)[keyof typeof ResourceTypes];

const resourceSchema = new Schema(
  {
    title: { type: String, required: true },
    subject: { type: String, required: true, index: true },
    academicYear: { type: Number, min: 1, max: 4, required: true, index: true },
    type: { type: String, enum: Object.values(ResourceTypes), required: true },
    // Only links allowed now (files removed)
    externalUrl: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

resourceSchema.index({ subject: 1, academicYear: 1, type: 1 });

export type ResourceDoc = InferSchemaType<typeof resourceSchema>;

export const Resource: Model<ResourceDoc> =
  (mongoose.models.Resource as Model<ResourceDoc>) ||
  mongoose.model<ResourceDoc>("Resource", resourceSchema);
