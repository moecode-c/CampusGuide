import { cn } from "@/lib/cn";

/**
 * Placeholder blocks for route loading states.
 *
 * These are server components with no client JavaScript: Next swaps them in
 * while the next route's data is still being fetched, so they must not depend
 * on anything that needs hydrating.
 *
 * The shapes deliberately echo the real page's layout — a header, then cards —
 * so the swap to real content doesn't visibly reflow.
 */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-xl bg-foreground/10", className)}
    />
  );
}

/** The page title and subtitle every screen starts with. */
export function SkeletonHeader() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-4 w-full max-w-80" />
    </div>
  );
}

export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-foreground/10 bg-panel p-5", className)}>
      <Skeleton className="h-5 w-40" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton
            key={i}
            // Ragged widths read as text rather than as a stack of grey bars.
            className={cn("h-3.5", i === lines - 1 ? "w-2/3" : i % 2 ? "w-5/6" : "w-full")}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The announcement is what makes this accessible: a screen reader is told the
 * page is loading, while the blocks themselves are hidden from it as noise.
 */
export function LoadingAnnouncement({ label = "Loading page" }: { label?: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {label}
    </span>
  );
}
