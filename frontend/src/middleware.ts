import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const sessionToken = request.cookies.get("session_token")?.value;
  const activeWorkspaceId = request.cookies.get("active_workspace_id")?.value;

  // Paths that do not require authentication
  const isPublicPath = path === "/login" || path === "/register";

  // Static files and internal next/api paths to exclude from middleware filtering
  if (
    path.startsWith("/_next") ||
    path.startsWith("/api") ||
    path.includes(".") ||
    path === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 1. Unauthenticated users trying to access protected paths
  if (!sessionToken && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 2. Authenticated users trying to access public paths (login/register)
  if (sessionToken && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 3. Authenticated users who have NOT selected a workspace yet
  if (sessionToken && !activeWorkspaceId && path !== "/select-workspace") {
    return NextResponse.redirect(new URL("/select-workspace", request.url));
  }

  // 4. Authenticated users who already selected a workspace trying to access select-workspace
  if (sessionToken && activeWorkspaceId && path === "/select-workspace") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}
