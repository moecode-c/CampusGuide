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
    // For videos this is an external URL
    externalUrl: { type: String },
    // For files stored in R2
    objectKey: { type: String, index: true },
    mimeType: { type: String },
    sizeBytes: { type: Number },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

resourceSchema.index({ subject: 1, academicYear: 1, type: 1 });

export type ResourceDoc = InferSchemaType<typeof resourceSchema>;

export const Resource: Model<ResourceDoc> =
  (mongoose.models.Resource as Model<ResourceDoc>) ||
  mongoose.model<ResourceDoc>("Resource", resourceSchema);
