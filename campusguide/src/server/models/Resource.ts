import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const ResourceTypes = {
  Video: "video",
  Pdf: "pdf",
  Summary: "summary",
} as const;

export type ResourceType = (typeof ResourceTypes)[keyof typeof ResourceTypes];

export const ResourceKinds = {
  /** An object stored in Cloudflare R2 and owned by this app. */
  File: "file",
  /** A plain link to something hosted elsewhere (YouTube, Drive, …). */
  Link: "link",
} as const;

export type ResourceKind = (typeof ResourceKinds)[keyof typeof ResourceKinds];

const resourceSchema = new Schema(
  {
    title: { type: String, required: true },
    // Rows created before the file store existed are all links.
    kind: {
      type: String,
      enum: Object.values(ResourceKinds),
      required: true,
      default: ResourceKinds.Link,
      index: true,
    },
    // null = drive root.
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", default: null, index: true },

    // Optional catalog metadata. The folder tree is the primary organization now,
    // so uploads are not forced to carry a subject/year the uploader may not know.
    subject: { type: String, index: true },
    academicYear: { type: Number, min: 1, max: 4, index: true },
    type: { type: String, enum: Object.values(ResourceTypes) },

    // kind === "link"
    externalUrl: { type: String },

    // kind === "file" — R2 object key is the source of truth; fileUrl is the
    // public bucket URL derived from it and cached here for cheap reads.
    objectKey: { type: String },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    /**
     * How many times the download link has been handed out.
     *
     * Counts issued redirects, not unique students and not completed transfers:
     * the bucket is public and serves the bytes directly, so this is the last
     * point the app sees. Good enough for the only question it exists to answer
     * — which of these files anyone actually opens.
     */
    downloadCount: { type: Number, default: 0, index: true },
    lastDownloadedAt: { type: Date, index: true },
  },
  { timestamps: true }
);

resourceSchema.index({ subject: 1, academicYear: 1, type: 1 });
resourceSchema.index({ folderId: 1, title: 1 });
// "newest first" is the default sort for both the drive listing and the
// dashboard's recent-resources panel; without this Mongo sorts in memory.
resourceSchema.index({ createdAt: -1 });
// The usage dashboard reads "busiest first" and "never opened" off this.
resourceSchema.index({ downloadCount: -1 });

// A link without a URL, or a file without an object key, is unusable in the UI.
resourceSchema.pre("validate", { document: true, query: false }, function validateKind(this: any) {
  if (this.kind === ResourceKinds.Link && !this.externalUrl) {
    throw new Error("externalUrl is required for link resources");
  }
  if (this.kind === ResourceKinds.File && !this.objectKey) {
    throw new Error("objectKey is required for file resources");
  }
});

export type ResourceDoc = InferSchemaType<typeof resourceSchema>;

export const Resource: Model<ResourceDoc> =
  (mongoose.models.Resource as Model<ResourceDoc>) ||
  mongoose.model<ResourceDoc>("Resource", resourceSchema);
