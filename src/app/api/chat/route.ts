import { z } from "zod"

import { askClaude } from "@/lib/assistant/claude"
import { askClaudeCode } from "@/lib/assistant/claude-code"
import { askOpenAI } from "@/lib/assistant/openai"
import { AssistantError, assistantProvider } from "@/lib/assistant/shared"
import { getSession } from "@/lib/auth/session"
import { formatCustomerId, listAccounts } from "@/lib/google/ads"
import { getConnection, updateConnection } from "@/lib/google/connections"

const requestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20_000) }))
    .min(1)
    .max(40)
    .refine((m) => m.at(-1)?.role === "user", "The last message must be a question."),
  // What the page is showing, e.g. the dashboard's dates.
  context: z.string().max(300).optional(),
})

const fail = (error: string, status: number) => Response.json({ error }, { status })

// POST { messages: [{ role, content }], context? } → { reply }
// Earlier turns are sent back as plain text; tool calls happen inside a single request.
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return fail("Sign in first.", 401)
  const provider = assistantProvider()
  if (!provider) {
    return fail("The assistant isn't set up yet. Add OPENAI_API_KEY to .env.local and restart the app.", 503)
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail("That message couldn't be read.", 400)

  const connection = await getConnection(session.sub)
  // The dashboard normally looks the accounts up; do it here if the chat is used first.
  if (connection && !connection.accounts.length) {
    try {
      connection.accounts = await listAccounts(connection)
      await updateConnection(session.sub, {
        accounts: connection.accounts,
        accountsFetchedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Couldn't list Google Ads accounts for the assistant:", error)
    }
  }
  const account =
    connection?.accounts.find((a) => a.customerId === connection.selectedCustomerId) ??
    connection?.accounts[0] ??
    null

  const today = new Date().toISOString().slice(0, 10)
  const situation =
    (account
      ? `Today is ${today}. The selected Google Ads account is "${account.name}" (${formatCustomerId(account.customerId)}), currency ${account.currency}${account.test ? ", a test account with no real spend" : ""}. The person asking is ${session.name} (${session.email}).`
      : `Today is ${today}. Google Ads isn't connected yet, so only website leads are available. The person asking is ${session.name} (${session.email}).`) +
    (parsed.data.context ? ` ${parsed.data.context} Use that period unless the question names another.` : "")

  const input = { turns: parsed.data.messages, situation, tools: { connection, account }, userId: session.sub }
  try {
    const reply =
      provider === "openai"
        ? await askOpenAI(input)
        : provider === "claude-code"
          ? await askClaudeCode(input)
          : await askClaude(input)
    return Response.json({ reply })
  } catch (error) {
    if (error instanceof AssistantError) return fail(error.message, error.status)
    console.error("Assistant failed:", error)
    return fail("The assistant couldn't be reached. Check your internet connection.", 502)
  }
}
