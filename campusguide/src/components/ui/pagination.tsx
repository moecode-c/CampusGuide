"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Client-side paging for the admin lists.
 *
 * Deliberately client-side: every one of these endpoints already returns a
 * capped list in a single request (100 log entries, 500 posts, the whole user
 * table). Paging the fetch as well would mean a round trip per page for data
 * already in hand, and would fight the search and filter controls that sit above
 * each list. The cap is what bounds the work; this only bounds what is painted.
 *
 * The alerts history is the exception and keeps its cursor, because its history
 * genuinely grows without limit.
 */

export type Paged<T> = {
  page: number;
  setPage: (page: number) => void;
  pageItems: T[];
  totalPages: number;
  total: number;
  pageSize: number;
  /** True while a long list is collapsed to its first `previewSize` rows. */
  collapsed: boolean;
  expand: () => void;
  previewSize: number;
};

/**
 * @param previewSize when set, the list starts collapsed to this many rows and
 *   offers a "see all" — for panels that are a glance, not a workspace.
 */
export function usePaged<T>(items: T[], pageSize = 25, previewSize?: number): Paged<T> {
  const [page, setPage] = React.useState(1);
  const [expanded, setExpanded] = React.useState(false);

  const total = items.length;
  const collapsed = previewSize !== undefined && !expanded && total > previewSize;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // A filter that shrinks the list can strand you on a page that no longer
  // exists, which renders as an empty panel with no way back.
  React.useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pageItems = React.useMemo(() => {
    if (collapsed) return items.slice(0, previewSize);
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [collapsed, items, page, pageSize, previewSize]);

  const expand = React.useCallback(() => {
    setExpanded(true);
    setPage(1);
  }, []);

  return {
    page,
    setPage,
    pageItems,
    totalPages,
    total,
    pageSize,
    collapsed,
    expand,
    previewSize: previewSize ?? 0,
  };
}

/** "See all 426" for a collapsed panel. Renders nothing once expanded. */
export function SeeAll<T>({ paged, noun = "items" }: { paged: Paged<T>; noun?: string }) {
  if (!paged.collapsed) return null;

  return (
    <Button variant="ghost" className="w-full" onClick={paged.expand}>
      See all {paged.total} {noun}
    </Button>
  );
}

export function Pagination<T>({
  paged,
  noun = "items",
  className,
}: {
  paged: Paged<T>;
  noun?: string;
  className?: string;
}) {
  // Nothing to page through, or the list is still showing its short preview.
  if (paged.collapsed || paged.totalPages <= 1) return null;

  const first = (paged.page - 1) * paged.pageSize + 1;
  const last = Math.min(paged.page * paged.pageSize, paged.total);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 pt-1", className)}>
      <p className="text-xs text-foreground/55">
        {first}–{last} of {paged.total} {noun}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => paged.setPage(paged.page - 1)}
          disabled={paged.page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs font-semibold text-foreground/70">
          Page {paged.page} of {paged.totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => paged.setPage(paged.page + 1)}
          disabled={paged.page >= paged.totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
