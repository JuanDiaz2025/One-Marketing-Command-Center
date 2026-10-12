// The signed-in person's Google Ads connection and the account they're looking at, or null when
// Google Ads isn't connected.
import { adsConfig } from "@/lib/auth/config"
import { chosenAccount, listAccounts } from "@/lib/google/ads"
import { connectedPeople, getConnection, updateConnection } from "@/lib/google/connections"

export async function activeAccount(sub: string) {
  if (!adsConfig().developerToken) return null
  const connection = await getConnection(sub)
  if (!connection) return null
  // No accounts yet: ask Google, but at most every 10 minutes (an open page checks every few seconds).
  const askedRecently = connection.accountsFetchedAt && Date.now() - Date.parse(connection.accountsFetchedAt) < 10 * 60_000
  if (!connection.accounts.length && !askedRecently) {
    connection.accounts = await listAccounts(connection)
    await updateConnection(sub, { accounts: connection.accounts, accountsFetchedAt: new Date().toISOString() })
  }
  const account = chosenAccount(connection.accounts, connection.selectedCustomerId, connection.email)
  return account ? { connection, account } : null
}

// The Google Ads connection that sends conversions when this person changes a lead: their own, or,
// for a teammate who hasn't connected Google Ads, the first person on the team who has (leads are
// shared, so a status a teammate sets reaches Google Ads right away too).
export async function senderAccount(sub: string) {
  const own = await activeAccount(sub).catch(() => null)
  if (own) return own
  for (const other of await connectedPeople()) {
    if (other === sub) continue
    const active = await activeAccount(other).catch(() => null)
    if (active) return active
  }
  return null
}
