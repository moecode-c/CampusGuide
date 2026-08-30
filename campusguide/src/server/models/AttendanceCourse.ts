import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * A manually tracked course on the Attendance page.
 *
 * Absences are stored as the **set of session indices** that were ticked, not
 * as a count. A count is derivable from the set; a set is not derivable from a
 * count, and the two could drift apart. Since a wrong number here can cost a
 * student their exam, the ticks are the only source of truth.
 *
 * This lives on the server rather than in localStorage because localStorage is
 * per-device and vanishes when browser data is cleared — a silent, total loss
 * of the record with no way to notice it happened.
 */
const attendanceCourseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    name: { type: String, required: true, maxlength: 80 },
    weeks: { type: Number, required: true, min: 1, max: 30 },
    lecturesPerWeek: { type: Number, required: true, min: 0, max: 14 },
    hasLab: { type: Boolean, default: false },
    labsPerWeek: { type: Number, default: 0, min: 0, max: 14 },

    // Sorted, deduplicated, always inside the course's session count. The API
    // re-normalizes on every write so a malformed client cannot corrupt these.
    missedLectures: { type: [Number], default: [] },
    missedLabs: { type: [Number], default: [] },
  },
  { timestamps: true }
);

// One course name per student; re-saving the same name edits it rather than
// creating a second card that splits the absences across two records.
attendanceCourseSchema.index({ userId: 1, name: 1 }, { unique: true });

export type AttendanceCourseDoc = InferSchemaType<typeof attendanceCourseSchema>;

export const AttendanceCourse: Model<AttendanceCourseDoc> =
  (mongoose.models.AttendanceCourse as Model<AttendanceCourseDoc>) ||
  mongoose.model<AttendanceCourseDoc>("AttendanceCourse", attendanceCourseSchema);
