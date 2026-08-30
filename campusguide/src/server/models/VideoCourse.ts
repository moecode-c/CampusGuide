import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { MAX_LESSONS_PER_COURSE } from "@/lib/videoCourses";

/**
 * A playlist of YouTube videos presented as a course — "Networks", "Data
 * Structures" — so students get an ordered sequence rather than a flat wall of
 * unrelated clips.
 *
 * Lessons are embedded rather than a separate collection because a course is
 * always read whole, ordering is just the array order, and nothing ever queries
 * lessons across courses. That keeps reordering a single document write.
 *
 * Nothing here stores a URL. The admin pastes any YouTube link shape and we keep
 * only the 11-character id, so the iframe src is always one we built — a link to
 * somewhere else cannot reach the player.
 */

const lessonSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    videoId: {
      type: String,
      required: true,
      // Belt and braces: the API extracts and validates the id, and the schema
      // refuses anything that is not one even if a future caller forgets.
      match: /^[A-Za-z0-9_-]{11}$/,
    },
    description: { type: String, trim: true, maxlength: 1000 },
    /** Typed in by the admin; we have no API key to look it up. */
    durationLabel: { type: String, trim: true, maxlength: 16 },
  },
  { _id: true }
);

const videoCourseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },

    /**
     * Stable, human-readable key for /videos/<slug>. Unique so a shared link
     * always resolves to one course.
     */
    slug: { type: String, required: true, unique: true, index: true },

    description: { type: String, trim: true, maxlength: 2000 },

    subject: { type: String, trim: true, maxlength: 120, index: true },
    academicYear: { type: Number, min: 1, max: 4, index: true },
    /** Who recorded or taught it, when that is worth crediting. */
    instructor: { type: String, trim: true, maxlength: 120 },

    /**
     * Draft by default. An admin can build a course over several sittings
     * without students seeing a two-video stub in the meantime.
     */
    published: { type: Boolean, required: true, default: false, index: true },

    lessons: {
      type: [lessonSchema],
      default: [],
      validate: {
        validator: (v: unknown[]) => v.length <= MAX_LESSONS_PER_COURSE,
        message: `A course cannot hold more than ${MAX_LESSONS_PER_COURSE} videos`,
      },
    },

    createdById: { type: Schema.Types.ObjectId, ref: "User" },
    // Denormalized so the course still shows its author after an account is deleted.
    createdByName: { type: String },
  },
  { timestamps: true }
);

// The student list: published only, newest first, optionally narrowed by year.
videoCourseSchema.index({ published: 1, academicYear: 1, updatedAt: -1 });

export type VideoCourseDoc = InferSchemaType<typeof videoCourseSchema>;

export const VideoCourse: Model<VideoCourseDoc> =
  (mongoose.models.VideoCourse as Model<VideoCourseDoc>) ||
  mongoose.model<VideoCourseDoc>("VideoCourse", videoCourseSchema);
