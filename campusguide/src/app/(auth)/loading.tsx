import { LoadingAnnouncement, Skeleton } from "@/components/Skeleton";

/**
 * Sign-in and register.
 *
 * A single centred card rather than the app's multi-column skeleton, matching
 * what those two pages actually are.
 */
export default function AuthLoading() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <LoadingAnnouncement label="Loading" />

      <div className="rounded-2xl border border-foreground/10 bg-panel p-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-56 max-w-full" />

        <div className="mt-6 space-y-4">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </div>
  );
}
