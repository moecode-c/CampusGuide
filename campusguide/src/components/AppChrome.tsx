"use client";

import { usePathname } from "next/navigation";

/**
 * Decides whether a route gets the student chrome.
 *
 * The admin area runs its own full-height shell with a sidebar, so the site
 * navbar and footer would be a second, competing navigation.
 *
 * The nav and footer arrive as props rather than imports so they stay server
 * components; and this reads `usePathname` rather than `headers()` in the root
 * layout, which would force every page in the app to render dynamically.
 */
export function AppChrome({
  navbar,
  footer,
  children,
}: {
  navbar: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdminArea) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col">
      {navbar}
      <div className="flex-1">{children}</div>
      {footer}
    </div>
  );
}
