import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const attendanceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Aggregated per title/type (simple + scalable)
    key: { type: String, required: true },
    missedCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

attendanceSchema.index({ userId: 1, key: 1 }, { unique: true });

export type AttendanceDoc = InferSchemaType<typeof attendanceSchema>;

export const Attendance: Model<AttendanceDoc> =
  (mongoose.models.Attendance as Model<AttendanceDoc>) ||
  mongoose.model<AttendanceDoc>("Attendance", attendanceSchema);
