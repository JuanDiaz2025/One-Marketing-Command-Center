import { NextResponse, type NextRequest } from "next/server"

import { SESSION_COOKIE } from "@/lib/auth/cookie-name"
import { appUrl, temporaryTunnel } from "@/lib/auth/local-url"

// A quick first check: anyone without a session cookie goes to /login. Pages still verify the
// cookie itself (requireSession), since this only looks at whether one is there.
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next()
  const path = `/login?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`
  // Here a redirect needs a full address. Through go-online.bat's tunnel the app only sees
  // "localhost", which the visitor's browser can't open: send them on with a tiny page instead,
  // so they stay on the tunnel's address.
  if (temporaryTunnel(request.headers)) {
    return new NextResponse(`<!doctype html><meta http-equiv="refresh" content="0;url=${path}">`, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    })
  }
  return NextResponse.redirect(appUrl(path, request.url))
}

// The public lead form at /s/<id>, sign-in, and static files stay open.
export const config = {
  matcher: ["/dashboard/:path*", "/leads/:path*"],
}
