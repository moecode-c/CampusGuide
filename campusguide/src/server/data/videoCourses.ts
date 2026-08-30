import mongoose from "mongoose";
import { z } from "zod";
import { youtubeIdFromInput } from "@/lib/youtube";
import {
  MAX_LESSONS_PER_COURSE,
  type VideoCourseDetail,
  type VideoCourseSummary,
} from "@/lib/videoCourses";

/**
 * Shapes a VideoCourse document for the wire.
 *
 * Kept in one place so the admin list, the student list and the course page all
 * agree on field names — and so `_id` is stringified exactly once.
 */

type LessonLike = {
  _id?: unknown;
  title?: string | null;
  videoId?: string | null;
  description?: string | null;
  durationLabel?: string | null;
};

type CourseLike = {
  _id?: unknown;
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  subject?: string | null;
  academicYear?: number | null;
  instructor?: string | null;
  published?: boolean | null;
  lessons?: LessonLike[] | null;
  updatedAt?: Date | string | null;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function serializeCourseSummary(doc: CourseLike): VideoCourseSummary {
  const lessons = doc.lessons ?? [];

  return {
    id: String(doc._id),
    title: doc.title ?? "",
    slug: doc.slug ?? "",
    description: doc.description ?? null,
    subject: doc.subject ?? null,
    academicYear: doc.academicYear ?? null,
    instructor: doc.instructor ?? null,
    published: Boolean(doc.published),
    lessonCount: lessons.length,
    coverVideoId: lessons[0]?.videoId ?? null,
    updatedAt: toIso(doc.updatedAt),
  };
}

export function serializeCourseDetail(doc: CourseLike): VideoCourseDetail {
  return {
    ...serializeCourseSummary(doc),
    lessons: (doc.lessons ?? []).map((l) => ({
      id: String(l._id),
      title: l.title ?? "",
      videoId: l.videoId ?? "",
      description: l.description ?? null,
      durationLabel: l.durationLabel ?? null,
    })),
  };
}

/**
 * Lesson input, shared by create and update.
 *
 * The admin types a link; what gets stored is the id. Anything that is not a
 * YouTube video is rejected here, which is what makes the "YouTube embeds only"
 * rule real rather than a convention.
 */
export const lessonInputSchema = z
  .object({
    /**
     * Present when editing an existing lesson. Preserved so a save does not
     * mint new subdocument ids and break `?lesson=` links people have shared.
     */
    id: z.string().optional(),
    title: z.string().min(1).max(160).trim(),
    url: z.string().min(1).max(500),
    description: z.string().max(1000).trim().optional(),
    durationLabel: z.string().max(16).trim().optional(),
  })
  .strict()
  .transform((lesson, ctx) => {
    const videoId = youtubeIdFromInput(lesson.url);
    if (!videoId) {
      ctx.addIssue({
        code: "custom",
        message: `"${lesson.title}" is not a YouTube link`,
        path: ["url"],
      });
      return z.NEVER;
    }

    return {
      ...(lesson.id && mongoose.isValidObjectId(lesson.id) ? { _id: lesson.id } : {}),
      title: lesson.title,
      videoId,
      description: lesson.description || undefined,
      durationLabel: lesson.durationLabel || undefined,
    };
  });

export const lessonArraySchema = z.array(lessonInputSchema).max(MAX_LESSONS_PER_COURSE);
