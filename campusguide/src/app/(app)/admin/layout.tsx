import { redirect } from "next/navigation";
import { requireRole } from "@/server/security/requireRole";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

/**
 * Standalone shell for /admin: a fixed full-height sidebar and a scrolling
 * content column. The site navbar and footer are suppressed here (see
 * AppChrome) so the sidebar is the only navigation.
 *
 * The role check is belt-and-braces — the middleware already redirects
 * non-admins — but it means a routing mistake can't expose an admin screen.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("admin");
  if (!session) redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-background">
      <AdminSidebar />

      {/* Offset matches the fixed rail's width; below lg the rail is a drawer. */}
      <div className="lg:pl-72 xl:pl-80">
        {/*
          The console is a dense tool, not an article, so it runs much wider
          than the old 90rem cap allowed — that was leaving a third of a wide
          monitor empty. The remaining cap only stops tables becoming
          unreadable on ultrawides, and the padding tightens as space gets
          scarce rather than staying fixed.
        */}
        <div className="mx-auto min-w-0 max-w-[140rem] px-3 py-5 sm:px-6 sm:py-6 2xl:px-10">{children}</div>
      </div>
    </div>
  );
}
