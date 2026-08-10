import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * A node in the resources folder tree (`MIU File Storage / Freshman / Programming / Lectures`).
 *
 * `ancestors` is a materialized root-first chain of parent ids. It costs a little
 * on writes but turns "everything under this folder" — needed for breadcrumbs,
 * recursive delete, and move-loop detection — into a single indexed query.
 */
const folderSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    parentId: { type: Schema.Types.ObjectId, ref: "Folder", default: null, index: true },
    ancestors: { type: [{ type: Schema.Types.ObjectId, ref: "Folder" }], default: [], index: true },
    // Display path, kept in sync on rename/move. Never used to address R2 objects.
    path: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Two folders cannot share a name inside the same parent. Mongo treats missing
// and null parentId alike, so this also covers the root level.
folderSchema.index({ parentId: 1, name: 1 }, { unique: true });

export type FolderDoc = InferSchemaType<typeof folderSchema>;

export const Folder: Model<FolderDoc> =
  (mongoose.models.Folder as Model<FolderDoc>) ||
  mongoose.model<FolderDoc>("Folder", folderSchema);

export function buildFolderPath(parentPath: string | null, name: string) {
  return parentPath ? `${parentPath}/${name}` : `/${name}`;
}
