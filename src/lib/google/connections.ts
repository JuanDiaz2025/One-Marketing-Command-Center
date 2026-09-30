// Each signed-in person's Google Ads connection, saved in .data/google-ads.json (not committed).
// The refresh token is encrypted with the app secret before it's written.
import { seal, unseal } from "@/lib/auth/crypto"
import { jsonFileStore } from "@/lib/json-file-store"

// A Google Ads account the person can open. Accounts under a manager (MCC) account are reached
// through it, so their requests carry the manager's id as loginCustomerId.
export type AdsAccount = {
  customerId: string
  name: string
  currency: string
  loginCustomerId?: string
  managerName?: string
  test: boolean
}

type StoredConnection = {
  email: string
  refreshToken: string // sealed
  connectedAt: string
  accounts: AdsAccount[]
  accountsFetchedAt?: string
  selectedCustomerId?: string
}

export type AdsConnection = Omit<StoredConnection, "refreshToken"> & { refreshToken: string }

const file = jsonFileStore<Record<string, StoredConnection>>("google-ads.json", () => ({}))

export async function getConnection(sub: string): Promise<AdsConnection | null> {
  const stored = (await file.read())[sub]
  if (!stored) return null
  const refreshToken = await unseal<string>(stored.refreshToken)
  // A token sealed with a different secret (e.g. AUTH_SECRET changed) can't be used: reconnect.
  return refreshToken ? { ...stored, refreshToken } : null
}

export async function saveConnection(sub: string, email: string, refreshToken: string) {
  const sealed = await seal(refreshToken)
  await file.update((db) => {
    db[sub] = {
      email,
      refreshToken: sealed,
      connectedAt: new Date().toISOString(),
      accounts: [],
      selectedCustomerId: db[sub]?.selectedCustomerId,
    }
  })
}

export async function updateConnection(
  sub: string,
  patch: Partial<Pick<StoredConnection, "accounts" | "accountsFetchedAt" | "selectedCustomerId">>,
) {
  await file.update((db) => {
    if (db[sub]) Object.assign(db[sub], patch)
  })
}

export async function deleteConnection(sub: string) {
  await file.update((db) => {
    delete db[sub]
  })
}
