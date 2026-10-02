// The signed-in person's Google Ads connection and the account they're looking at, or null when
// Google Ads isn't connected.
import { adsConfig } from "@/lib/auth/config"
import { chosenAccount, listAccounts } from "@/lib/google/ads"
import { getConnection, updateConnection } from "@/lib/google/connections"

export async function activeAccount(sub: string) {
  if (!adsConfig().developerToken) return null
  const connection = await getConnection(sub)
  if (!connection) return null
  if (!connection.accounts.length) {
    connection.accounts = await listAccounts(connection)
    await updateConnection(sub, { accounts: connection.accounts, accountsFetchedAt: new Date().toISOString() })
  }
  const account = chosenAccount(connection.accounts, connection.selectedCustomerId)
  return account ? { connection, account } : null
}
