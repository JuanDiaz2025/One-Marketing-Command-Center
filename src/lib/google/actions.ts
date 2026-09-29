"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { requireSession, SESSION_COOKIE } from "@/lib/auth/session"
import { deleteConnection, getConnection, updateConnection } from "@/lib/google/connections"
import { revokeToken } from "@/lib/google/oauth"
import { periodQuery, resolvePeriod } from "@/lib/google/period"

export async function signOutAction() {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect("/login?signed_out=1")
}

export async function disconnectAdsAction() {
  const session = await requireSession()
  const connection = await getConnection(session.sub)
  if (connection) await revokeToken(connection.refreshToken)
  await deleteConnection(session.sub)
  redirect("/dashboard")
}

export async function selectAccountAction(formData: FormData) {
  const session = await requireSession()
  const connection = await getConnection(session.sub)
  const customerId = String(formData.get("customerId") ?? "")
  // The date range to come back to, e.g. "range=30" or "from=2026-08-01&to=2026-08-31".
  const back = new URLSearchParams(String(formData.get("period") ?? ""))
  const period = resolvePeriod({
    range: back.get("range") ?? undefined,
    from: back.get("from") ?? undefined,
    to: back.get("to") ?? undefined,
  })
  // Only accounts Google listed for this person can be picked.
  if (connection?.accounts.some((a) => a.customerId === customerId)) {
    await updateConnection(session.sub, { selectedCustomerId: customerId })
  }
  redirect(`/dashboard?${periodQuery(period)}`)
}

export async function refreshAccountsAction() {
  const session = await requireSession()
  await updateConnection(session.sub, { accounts: [], accountsFetchedAt: undefined })
  redirect("/dashboard")
}
