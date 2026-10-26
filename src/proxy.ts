import { NextResponse, type NextRequest } from "next/server";

// Optimistic only: sends visitors without a session cookie to the sign-in
// page. Whether the session is valid, and what it may do, is checked on the
// server by the guards in src/server/auth/guards.ts.
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) return NextResponse.next();
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/operator/:path*", "/client/:path*", "/change-password", "/j/:path*"],
};
