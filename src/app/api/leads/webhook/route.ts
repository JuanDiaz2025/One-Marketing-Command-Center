import { revalidatePath } from "next/cache"

import { isValidSecret, parseWebsiteLead } from "@/lib/leads/webhook"
import { addLead } from "@/lib/leads/store"

// POST /api/leads/webhook?key=<secret>  (or header "X-Webhook-Secret: <secret>")
// Where the WordPress site sends each new form lead. Accepts JSON or a regular form post.
// Open to the internet, so it only answers when the secret matches.

const MAX_BYTES = 100_000

async function authorized(request: Request) {
  const url = new URL(request.url)
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return isValidSecret(url.searchParams.get("key") ?? request.headers.get("x-webhook-secret") ?? bearer)
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text()
  if (text.length > MAX_BYTES) return null
  const type = request.headers.get("content-type") ?? ""
  if (type.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(text))
  if (type.includes("multipart/form-data")) {
    const form = await new Response(text, { headers: { "content-type": type } }).formData()
    return Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"))
  }
  try {
    return JSON.parse(text)
  } catch {
    // Some plugins send form-encoded data without saying so.
    return Object.fromEntries(new URLSearchParams(text))
  }
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "Wrong or missing key." }, { status: 401 })

  const lead = parseWebsiteLead(await readBody(request))
  if (!lead) {
    return Response.json(
      { ok: false, error: "No name, phone or email found in the data sent." },
      { status: 422 },
    )
  }
  const saved = await addLead(lead)
  revalidatePath("/leads")
  return Response.json({ ok: true, id: saved.id })
}

// Lets a webhook plugin's "test connection" check the address and key without adding a lead.
export async function GET(request: Request) {
  if (!(await authorized(request))) return Response.json({ ok: false, error: "Wrong or missing key." }, { status: 401 })
  return Response.json({ ok: true, message: "Connected. New leads posted here appear on the Leads page." })
}
