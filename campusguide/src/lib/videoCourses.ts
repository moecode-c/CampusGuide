/**
 * Video-course vocabulary, shared by the model, the API schemas and the pages.
 *
 * Lives in `lib` rather than beside the Mongoose model so client components can
 * import it without pulling mongoose into the browser bundle — the same split
 * ActivityActions and teams use.
 */

/** Enough for a full term of recordings; a guard against a paste-loop, not a policy. */
export const MAX_LESSONS_PER_COURSE = 200;

export type CourseLesson = {
  id: string;
  title: string;
  /**
   * The bare 11-character YouTube id, never a URL. Storing the id rather than
   * whatever the admin pasted means the embed src is built by us, so nothing
   * that is not a YouTube video can end up in an iframe.
   */
  videoId: string;
  description: string | null;
  /** Free text as shown on YouTube, e.g. "12:04". We never fetch it — no API key. */
  durationLabel: string | null;
};

export type VideoCourseSummary = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  subject: string | null;
  academicYear: number | null;
  instructor: string | null;
  published: boolean;
  lessonCount: number;
  /** First lesson's video, for the card thumbnail. Null on an empty course. */
  coverVideoId: string | null;
  updatedAt: string | null;
};

export type VideoCourseDetail = VideoCourseSummary & {
  lessons: CourseLesson[];
};

/**
 * URL-safe id derived from the title. Kept ASCII-only: Arabic titles are common
 * here and percent-encoded slugs are unreadable in a share link, so a title with
 * no Latin characters falls back to a short random suffix instead.
 */
export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    // NFKD splits an accented letter into base + combining mark. Dropping the
    // marks keeps "Réseaux" as "reseaux" instead of "r-seaux".
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base || `course-${Math.random().toString(36).slice(2, 8)}`;
}

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

/** Total runtime is unknown without the YouTube API, so the count is the honest figure. */
export function lessonCountLabel(count: number): string {
  return `${count} video${count === 1 ? "" : "s"}`;
}
