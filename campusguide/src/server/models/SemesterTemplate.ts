import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const excludedRangeSchema = new Schema(
  {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);

const semesterTemplateSchema = new Schema(
  {
    academicYear: { type: Number, min: 1, max: 4, required: true, index: true },
    termName: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    excludedRanges: { type: [excludedRangeSchema], default: [] },
    maxAbsencePercent: { type: Number, min: 0, max: 100, default: 25 },
  },
  { timestamps: true }
);

semesterTemplateSchema.index({ academicYear: 1, termName: 1 }, { unique: true });

export type SemesterTemplateDoc = InferSchemaType<typeof semesterTemplateSchema>;

export const SemesterTemplate: Model<SemesterTemplateDoc> =
  (mongoose.models.SemesterTemplate as Model<SemesterTemplateDoc>) ||
  mongoose.model<SemesterTemplateDoc>("SemesterTemplate", semesterTemplateSchema);
