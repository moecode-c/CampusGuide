import {
  LoadingAnnouncement,
  Skeleton,
  SkeletonCard,
  SkeletonHeader,
} from "@/components/Skeleton";

/**
 * Shown while any signed-in student page is being fetched.
 *
 * Next renders this the instant a navigation starts, so the app responds to a
 * click immediately instead of sitting on the old page until the new one is
 * ready. It also gives the router a Suspense boundary to prefetch up to, which
 * is what the `staleTimes` router cache in next.config.ts needs to work at all.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6">
      <LoadingAnnouncement />
      <SkeletonHeader />

      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-11 w-full min-w-0 flex-1 sm:min-w-64" />
        <Skeleton className="h-11 w-40" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={2} />
      </div>
    </div>
  );
}
