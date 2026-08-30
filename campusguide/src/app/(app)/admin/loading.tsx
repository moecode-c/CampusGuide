import {
  LoadingAnnouncement,
  Skeleton,
  SkeletonCard,
  SkeletonHeader,
} from "@/components/Skeleton";

/**
 * Admin-area loading state.
 *
 * Nested inside the admin layout, so the sidebar stays put and only the content
 * column is replaced — navigating between admin pages never flashes the whole
 * shell. The shapes match the console's usual header-then-stat-tiles-then-rows
 * arrangement.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <LoadingAnnouncement label="Loading admin page" />
      <SkeletonHeader />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-foreground/10 bg-background p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-9 w-16" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>

      <SkeletonCard lines={5} />
      <SkeletonCard lines={4} />
    </div>
  );
}
