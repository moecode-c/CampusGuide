import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { env } from "@/env";

function isApi(pathname: string) {
  return pathname.startsWith("/api/");
}

/**
 * Forwards the path to server components. The layout needs it to know whether
 * the current page is the one screen an unverified account may see.
 */
function passThrough(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const needsAuth =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/gpa") ||
    pathname.startsWith("/attendance") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/resources") ||
    pathname.startsWith("/videos") ||
    pathname.startsWith("/faq") ||
    pathname.startsWith("/map") ||
    pathname.startsWith("/teams") ||
    pathname.startsWith("/pending") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/student") ||
    pathname.startsWith("/api/admin");

  if (!needsAuth) return passThrough(req);

  const token = await getToken({ req, secret: env.NEXTAUTH_SECRET });

  // An expired short session is stripped of its identity claims by the `jwt`
  // callback rather than deleted, so the object survives and `!token` alone
  // would wave it through. No `sub` means no user.
  const signedIn = Boolean(token?.sub);

  if (!signedIn) {
    if (isApi(pathname)) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Account status is deliberately not checked here. Middleware can only read
  // the JWT, which stays valid for weeks after a ban; the (app) layout and the
  // API guards re-read the database instead, so revocation is immediate.

  if (pathname.startsWith("/api/admin") || pathname.startsWith("/admin")) {
    if ((token as any).role !== "admin") {
      if (isApi(pathname)) {
        return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      }
      // A 307 without a Location header leaves the browser on a blank page.
      // Send non-admins back to a page they can actually use.
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/api/student")) {
    // Admins should be able to use student APIs as well (admin is a superuser).
    if ((token as any).role !== "student" && (token as any).role !== "admin") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
  }

  return passThrough(req);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/gpa/:path*",
    "/attendance/:path*",
    "/calendar/:path*",
    "/resources/:path*",
    "/videos/:path*",
    "/faq/:path*",
    "/map/:path*",
    "/teams/:path*",
    "/pending/:path*",
    "/admin/:path*",
    "/api/student/:path*",
    "/api/admin/:path*",
  ],
};
