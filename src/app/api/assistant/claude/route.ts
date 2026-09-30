import { claudeStatus, startClaudeLogin } from "@/lib/assistant/claude-code"
import { getSession } from "@/lib/auth/session"

// Only the person at this computer may start a sign-in here, not someone reaching the app through
// go-online.bat's public address.
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
const LOOPBACK = /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+|localhost)$/
function fromThisComputer(request: Request) {
  const h = request.headers
  // The app itself adds x-forwarded-for (this computer's own address); the tunnel adds Cloudflare's headers.
  const forwarded = (h.get("x-forwarded-for") ?? "").split(",").map((a) => a.trim()).filter(Boolean)
  return (
    LOCAL.test(h.get("host") ?? "") &&
    !h.get("cf-connecting-ip") &&
    !h.get("cf-ray") &&
    forwarded.every((a) => LOOPBACK.test(a))
  )
}

// GET → { installed, loggedIn }: whether the chat can use Claude on this computer.
export async function GET() {
  if (!(await getSession())) return Response.json({ error: "Sign in first." }, { status: 401 })
  return Response.json(await claudeStatus())
}

// POST → opens the Claude sign-in (installing Claude Code first if needed).
export async function POST(request: Request) {
  if (!(await getSession())) return Response.json({ error: "Sign in first." }, { status: 401 })
  if (!fromThisComputer(request)) {
    return Response.json(
      { error: "Open the Command Center on the computer that runs it (http://localhost:4000) to sign in to Claude." },
      { status: 403 },
    )
  }
  startClaudeLogin()
  return Response.json({ ok: true })
}
