// The team password: a second way in, for go-online.bat's address (where Google sign-in can't
// work) or any computer without Google. Only a scrambled fingerprint is kept (scrypt with a random
// salt), in .data/app-password, or APP_PASSWORD_HASH in .env.local. Wrong guesses are slowed down.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import { shared } from "@/lib/shared-state"

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>
const file = path.join(process.cwd(), ".data", "app-password")

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  // "scrypt:salt:fingerprint" (no "$", which .env.local would read as a variable).
  return `scrypt:${salt.toString("base64url")}:${(await scrypt(password, salt, 32)).toString("base64url")}`
}

async function savedHash() {
  const fromFile = await readFile(file, "utf8").then((t) => t.trim(), () => "")
  return fromFile || process.env.APP_PASSWORD_HASH?.trim() || ""
}

export async function hasPassword() {
  return /^scrypt:/.test(await savedHash())
}

export async function setPassword(password: string) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, await hashPassword(password), { mode: 0o600 })
}

// At most 5 wrong guesses per visitor in 15 minutes, and 30 for everyone together, so the password
// can't be guessed by trying many.
const tries = shared("password-tries", () => ({ byVisitor: new Map<string, number[]>(), all: [] as number[] }))
const WINDOW_MS = 15 * 60_000

export function tooManyTries(visitor: string) {
  const since = Date.now() - WINDOW_MS
  const mine = (tries.byVisitor.get(visitor) ?? []).filter((t) => t > since)
  tries.all = tries.all.filter((t) => t > since)
  return mine.length >= 5 || tries.all.length >= 30
}

function noteWrong(visitor: string) {
  const since = Date.now() - WINDOW_MS
  tries.byVisitor.set(visitor, [...(tries.byVisitor.get(visitor) ?? []).filter((t) => t > since), Date.now()])
  tries.all.push(Date.now())
}

export async function checkPassword(password: string, visitor: string) {
  const saved = await savedHash()
  const [kind, salt, hash] = saved.split(":")
  if (kind !== "scrypt" || !salt || !hash) return false
  const expected = Buffer.from(hash, "base64url")
  const given = await scrypt(password, Buffer.from(salt, "base64url"), expected.length)
  const ok = given.length === expected.length && timingSafeEqual(given, expected)
  if (!ok) noteWrong(visitor)
  return ok
}
