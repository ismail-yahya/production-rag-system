// ---------------------------------------------------------------------------
// Next.js proxy middleware — role-based route protection
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Minimal JWT payload decoder for middleware (Edge runtime).
 * Only extracts claims — no signature verification (backend handles that).
 */
function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const ROLE_LEVELS: Record<string, number> = {
  USER: 0,
  MANAGER: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip static assets and API proxy routes
  if (
    path.startsWith("/_next") ||
    path.startsWith("/api") ||
    path.includes(".") ||
    path === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const isPublicPath = path === "/login" || path === "/register";

  // Read the access token from the authorization cookie
  // (We set this cookie on login for middleware access)
  const authCookie = request.cookies.get("rag_auth")?.value;

  // 1. Unauthenticated → redirect to login (except public paths)
  if (!authCookie && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 2. Authenticated → redirect away from public paths
  if (authCookie && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 3. Role-based protection for /admin routes
  if (authCookie && path.startsWith("/admin")) {
    const payload = decodeJWTPayload(authCookie);
    const role = (payload?.role as string) ?? "USER";
    const roleLevel = ROLE_LEVELS[role] ?? 0;

    if (roleLevel < ROLE_LEVELS.ADMIN) {
      // Unauthorized — redirect to dashboard
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
