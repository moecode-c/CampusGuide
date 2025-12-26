import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const roomSchema = new Schema(
  {
    roomCode: { type: String, required: true, unique: true, index: true },
    building: { type: String, required: true, index: true },
    floor: { type: Number, required: true },
    // x/y are normalized (0..1) coordinates relative to the map image
    x: { type: Number, min: 0, max: 1, required: true },
    y: { type: Number, min: 0, max: 1, required: true },
  },
  { timestamps: true }
);

roomSchema.index({ building: 1, floor: 1 });

export type RoomDoc = InferSchemaType<typeof roomSchema>;

export const Room: Model<RoomDoc> =
  (mongoose.models.Room as Model<RoomDoc>) || mongoose.model<RoomDoc>("Room", roomSchema);
