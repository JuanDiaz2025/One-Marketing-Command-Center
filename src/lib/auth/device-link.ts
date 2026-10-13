// "Open on another device": a one-time link that signs a phone or another computer in as you,
// through go-online.bat's address. Google sign-in can't work there (Google only sends people back
// to addresses registered with it, and that one is new each time), so the computer you're already
// signed in on vouches for the other device instead. Each link works once, for 15 minutes.
import { createHash, randomBytes } from "node:crypto"

import type { Session } from "@/lib/auth/session"
import { jsonFileStore } from "@/lib/json-file-store"

type Saved = { hash: string; user: Omit<Session, "exp">; expires: number }

const file = jsonFileStore<{ links: Saved[] }>("device-links.json", () => ({ links: [] }))
const LIFETIME_MS = 15 * 60_000
// Only a fingerprint of each link is kept, so the file alone can't be used to sign in.
const fingerprint = (token: string) => createHash("sha256").update(token).digest("hex")

export async function createDeviceLink(user: Omit<Session, "exp">) {
  const token = randomBytes(24).toString("base64url")
  await file.update((db) => {
    db.links = db.links.filter((l) => l.expires > Date.now())
    db.links.push({ hash: fingerprint(token), user: { sub: user.sub, email: user.email, name: user.name, picture: user.picture }, expires: Date.now() + LIFETIME_MS })
  })
  return token
}

// The person the link signs in, once; null when it's used, expired or made up.
export async function redeemDeviceLink(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  const hash = fingerprint(token)
  return file.update((db) => {
    const link = db.links.find((l) => l.hash === hash && l.expires > Date.now())
    db.links = db.links.filter((l) => l.hash !== hash && l.expires > Date.now())
    return link?.user ?? null
  })
}
