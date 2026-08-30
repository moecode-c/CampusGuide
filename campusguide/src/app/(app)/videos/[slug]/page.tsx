import { CoursePlayer } from "./CoursePlayer";

/**
 * The slug and the starting lesson are read here rather than with
 * useSearchParams, so the client component never needs a Suspense boundary.
 */
export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const lesson = typeof query.lesson === "string" ? query.lesson : null;

  return <CoursePlayer slug={slug} initialLessonId={lesson} />;
}
