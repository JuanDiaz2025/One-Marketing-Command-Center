import { NextResponse, type NextRequest } from "next/server"

import { googleSignInEnabled } from "@/lib/auth"
import { startSignIn } from "@/lib/google-signin"
import { redirectTo, temporaryTunnel } from "@/lib/local-url"

// GET /api/auth/google?next=/overview → Google's account picker.
export async function GET(request: NextRequest) {
  if (!googleSignInEnabled()) return redirectTo("/login?error=google_off")
  // Through go-online.bat's temporary address, Google would send the person back to an address
  // their browser can't use: the password sign-in is the way in there.
  if (temporaryTunnel(request.headers)) return redirectTo(`/login?error=temporary&next=${encodeURIComponent(request.nextUrl.searchParams.get("next") ?? "/overview")}`)
  return NextResponse.redirect(await startSignIn(request.url, request.nextUrl.searchParams.get("next") ?? "/overview"))
}
