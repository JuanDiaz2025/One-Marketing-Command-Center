// Turns a lead sent by a WordPress form webhook into a Lead. Form plugins name their fields
// differently (Elementor: "Name" or fields[name][value]; Contact Form 7: "your-name"; WPForms and
// Gravity Forms: whatever the site owner mapped), so fields are matched by common names and
// anything left over goes into the notes.
import { randomBytes, timingSafeEqual } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { Lead } from "@/lib/leads/types"

export type WebsiteLead = Omit<Lead, "id" | "createdAt" | "qrCodeId">

// The key WordPress must send, from LEADS_WEBHOOK_SECRET or created once in .data/webhook-secret.
const secretFile = path.join(process.cwd(), ".data", "webhook-secret")
let secret: Promise<string> | null = null

export function webhookSecret() {
  secret ??= (async () => {
    const configured = process.env.LEADS_WEBHOOK_SECRET?.trim()
    if (configured) return configured
    try {
      return (await readFile(secretFile, "utf8")).trim()
    } catch {
      const created = randomBytes(18).toString("base64url")
      await mkdir(path.dirname(secretFile), { recursive: true })
      await writeFile(secretFile, created, { mode: 0o600 })
      return created
    }
  })()
  return secret
}

// The public address go-online.bat saved (a Cloudflare tunnel), if it's running.
export async function tunnelUrl() {
  try {
    const url = (await readFile(path.join(process.cwd(), ".data", "public-url"), "utf8")).trim()
    return /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(url) ? url : null
  } catch {
    return null
  }
}

export async function isValidSecret(given: string | null | undefined) {
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(await webhookSecret())
  return a.length === b.length && timingSafeEqual(a, b)
}

const norm = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, "")

// Field names each part of a lead goes by, after lowercasing and dropping spaces and punctuation.
const aliases = {
  name: ["name", "fullname", "yourname", "contactname", "customername", "sellername", "ownername"],
  firstName: ["firstname", "fname", "first", "givenname"],
  lastName: ["lastname", "lname", "last", "surname", "familyname"],
  phone: ["phone", "phonenumber", "tel", "telephone", "mobile", "cell", "cellphone", "yourphone", "yourtel", "bestphone"],
  email: ["email", "emailaddress", "youremail", "mail", "eml"],
  address: ["propertyaddress", "address", "streetaddress", "street", "address1", "addressline1", "youraddress", "propertylocation", "location"],
  city: ["city", "town"],
  state: ["state", "province", "region"],
  zip: ["zip", "zipcode", "postalcode", "postcode"],
  notes: ["message", "notes", "note", "comments", "comment", "yourmessage", "details", "description", "anythingelse", "tellusmore"],
  form: ["formname", "formtitle", "formid", "form"],
} as const

// Plugin bookkeeping that isn't worth keeping in the notes.
const skip = new Set(["formid", "formname", "formtitle", "form", "postid", "referer", "referrer", "remoteip", "useragent", "date", "time", "pageurl", "pagetitle", "sourceurl", "submittedon", "entryid", "id", "nonce", "action", "gdpr", "acceptance", "consent", "recaptcha", "grecaptcharesponse", "honeypot"])

// Flattens nested payloads into label → value pairs. A field sent as { id|name|label, value }
// (Elementor with advanced data, many webhook plugins) is keyed by its label or id.
function flatten(value: unknown, key = "", out: [string, string][] = []): [string, string][] {
  if (value === null || value === undefined) return out
  if (typeof value !== "object") {
    const text = String(value).trim()
    if (text) out.push([key, text])
    return out
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, key ? `${key}.${i}` : String(i), out))
    return out
  }
  const obj = value as Record<string, unknown>
  if ("value" in obj && (typeof obj.value !== "object" || obj.value === null)) {
    const label = [obj.label, obj.title, obj.name, obj.id, key].find((l) => typeof l === "string" && l.trim()) as string | undefined
    const text = String(obj.value ?? "").trim()
    if (text) out.push([label ?? key, text])
    return out
  }
  for (const [k, v] of Object.entries(obj)) {
    // A "form" block describes the form itself ({ id, name }), not the person: keep its fields
    // apart as form_id / form_name so they aren't mistaken for the lead's name.
    const child = norm(key) === "form" ? `form_${k}` : k === "value" || k === "raw_value" ? key : k
    flatten(v, child, out)
  }
  return out
}

export function parseWebsiteLead(payload: unknown): WebsiteLead | null {
  const pairs = flatten(payload)
  const used = new Set<number>()
  const take = (names: readonly string[]) => {
    for (const alias of names) {
      const i = pairs.findIndex(([k], index) => !used.has(index) && norm(k.split(".").pop() ?? k) === alias)
      if (i >= 0) {
        used.add(i)
        return pairs[i][1].slice(0, 500)
      }
    }
    return undefined
  }

  const email = take(aliases.email)?.toLowerCase()
  const phone = take(aliases.phone)
  const full = take(aliases.name)
  const first = take(aliases.firstName)
  const last = take(aliases.lastName)
  const street = take(aliases.address)
  const cityStateZip = [take(aliases.city), [take(aliases.state), take(aliases.zip)].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ")
  const message = take(aliases.notes)
  const form = take(aliases.form)

  if (!email && !phone && !full && !first && !last) return null

  const extras = pairs
    .filter(([k], i) => !used.has(i) && !skip.has(norm(k.split(".").pop() ?? k)) && !/^\d+$/.test(k))
    .slice(0, 20)
    .map(([k, v]) => `${k.split(".").pop()}: ${v.slice(0, 300)}`)

  return {
    name: full || [first, last].filter(Boolean).join(" ") || email || phone || "Website lead",
    phone,
    email,
    propertyAddress: [street, cityStateZip].filter(Boolean).join(", ") || undefined,
    notes: [message, ...extras].filter(Boolean).join("\n").slice(0, 2000) || undefined,
    source: form && !/^\d+$/.test(form) ? `Website · ${form.slice(0, 60)}` : "Website",
  }
}
