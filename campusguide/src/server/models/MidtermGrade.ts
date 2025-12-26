import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const midtermGradeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true },
    midtermMark: { type: Number, min: 0, max: 40, required: true },
    creditHours: { type: Number, min: 0, max: 10, required: true, default: 3 },
  },
  { timestamps: true }
);

midtermGradeSchema.index({ userId: 1, subject: 1 }, { unique: true });

export type MidtermGradeDoc = InferSchemaType<typeof midtermGradeSchema>;

export const MidtermGrade: Model<MidtermGradeDoc> =
  (mongoose.models.MidtermGrade as Model<MidtermGradeDoc>) ||
  mongoose.model<MidtermGradeDoc>("MidtermGrade", midtermGradeSchema);
