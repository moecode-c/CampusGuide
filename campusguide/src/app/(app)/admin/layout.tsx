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
      <div className="lg:pl-80">
        <div className="mx-auto min-w-0 max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
