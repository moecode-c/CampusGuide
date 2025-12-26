import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { env } from "@/env";

function isApi(pathname: string) {
  return pathname.startsWith("/api/");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const needsAuth =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/gpa") ||
    pathname.startsWith("/attendance") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/resources") ||
    pathname.startsWith("/map") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/student") ||
    pathname.startsWith("/api/admin");

  if (!needsAuth) return NextResponse.next();

  const token = await getToken({ req, secret: env.NEXTAUTH_SECRET });
  if (!token) {
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

  if (pathname.startsWith("/api/admin") || pathname.startsWith("/admin")) {
    if ((token as any).role !== "admin") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: isApi(pathname) ? 403 : 307,
        headers: isApi(pathname) ? { "content-type": "application/json" } : undefined,
      });
    }
  }

  if (pathname.startsWith("/api/student")) {
    if ((token as any).role !== "student") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/gpa/:path*",
    "/attendance/:path*",
    "/calendar/:path*",
    "/resources/:path*",
    "/map/:path*",
    "/admin/:path*",
    "/api/student/:path*",
    "/api/admin/:path*",
  ],
};
