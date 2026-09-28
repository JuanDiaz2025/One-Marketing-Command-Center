// Encrypts the session cookie and the stored Google tokens with one app secret.
// AUTH_SECRET from .env.local is used when set; otherwise a random one is created once and kept
// in .data/auth-secret, so running locally needs no setup.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const secretFile = path.join(process.cwd(), ".data", "auth-secret")
let key: Promise<Buffer> | null = null

async function loadSecret() {
  const configured = process.env.AUTH_SECRET?.trim()
  if (configured) return configured
  try {
    return (await readFile(secretFile, "utf8")).trim()
  } catch {
    const created = randomBytes(32).toString("base64url")
    try {
      await mkdir(path.dirname(secretFile), { recursive: true })
      await writeFile(secretFile, created, { mode: 0o600 })
    } catch {
      // Read-only hosting: sessions last until the server restarts. Set AUTH_SECRET there.
    }
    return created
  }
}

function getKey() {
  key ??= loadSecret().then((secret) => createHash("sha256").update(secret).digest())
  return key
}

// AES-256-GCM, so a changed or forged value fails to open instead of being trusted.
export async function seal(value: unknown) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", await getKey(), iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url")
}

export async function unseal<T>(sealed: string | undefined): Promise<T | null> {
  if (!sealed) return null
  try {
    const raw = Buffer.from(sealed, "base64url")
    const decipher = createDecipheriv("aes-256-gcm", await getKey(), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    const data = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()])
    return JSON.parse(data.toString("utf8")) as T
  } catch {
    return null
  }
}
