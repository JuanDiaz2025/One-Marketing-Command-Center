import { after } from "next/server"

import { getSession } from "@/lib/auth/session"
import { catchUp, leadsVersion } from "@/lib/leads/background"

export const dynamic = "force-dynamic"

// Asked every few seconds by an open Leads page: starts the background work and says whether
// anything changed, so the page reloads only then.
export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 })
  after(() => catchUp(session.sub))
  return Response.json({ version: await leadsVersion() }, { headers: { "Cache-Control": "no-store" } })
}
