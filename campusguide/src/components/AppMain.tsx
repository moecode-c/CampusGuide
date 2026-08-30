"use client";

import { usePathname } from "next/navigation";

/**
 * The `<main>` wrapper for signed-in pages.
 *
 * This has to be a client component. The layout above it is shared by /admin
 * and every student page, and a shared layout is preserved across navigations
 * between its children rather than re-rendered — so deciding the width there
 * from the `x-pathname` header meant the value was frozen at whatever page you
 * first landed on. Going /admin -> /calendar left the student page with the
 * admin's full-bleed `w-full` and no padding at all.
 *
 * `usePathname()` is reactive, so the class now follows the actual route.
 */
export function AppMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");

  // The admin console runs its own sidebar shell and needs the full viewport;
  // student pages stay in a readable centered column.
  return (
    <main
      className={
        isAdminArea
          ? "w-full min-w-0"
          : "mx-auto w-full min-w-0 max-w-6xl px-3 py-5 sm:px-4 sm:py-6"
      }
    >
      {children}
    </main>
  );
}
