import { NextResponse, type NextRequest } from "next/server"

import { SESSION_COOKIE } from "@/lib/auth/cookie-name"

// A quick first check: anyone without a session cookie goes to /login. Pages still verify the
// cookie itself (requireSession), since this only looks at whether one is there.
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next()
  const login = new URL("/login", request.url)
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(login)
}

// The public lead form at /s/<id>, sign-in, and static files stay open.
export const config = {
  matcher: ["/dashboard/:path*", "/leads/:path*"],
}
