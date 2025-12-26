import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const EventTypes = {
  Lecture: "lecture",
  Lab: "lab",
  Midterm: "midterm",
  Assignment: "assignment",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

const eventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    type: { type: String, enum: Object.values(EventTypes), required: true },
    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true },
    roomCode: { type: String },
    building: { type: String },
    isRecurring: { type: Boolean, default: false },
    rrule: { type: String },
  },
  { timestamps: true }
);

eventSchema.index({ userId: 1, start: 1 });

eventSchema.index({ roomCode: 1 });

export type EventDoc = InferSchemaType<typeof eventSchema>;

export const Event: Model<EventDoc> =
  (mongoose.models.Event as Model<EventDoc>) || mongoose.model<EventDoc>("Event", eventSchema);
