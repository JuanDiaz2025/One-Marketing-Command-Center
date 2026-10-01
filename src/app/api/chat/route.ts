import { z } from "zod"

import { askClaude } from "@/lib/assistant/claude"
import { askClaudeCode } from "@/lib/assistant/claude-code"
import { dropQuestion, saveQuestion, saveReply } from "@/lib/assistant/history"
import { askOpenAI } from "@/lib/assistant/openai"
import { AssistantError, assistantProvider } from "@/lib/assistant/shared"
import { getSession } from "@/lib/auth/session"
import { formatCustomerId, listAccounts } from "@/lib/google/ads"
import { getConnection, updateConnection } from "@/lib/google/connections"

const requestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20_000) }))
    .min(1)
    .max(200)
    .refine((m) => m.at(-1)?.role === "user", "The last message must be a question."),
  // What the page is showing, e.g. the dashboard's dates.
  context: z.string().max(300).optional(),
  // The saved conversation this belongs to; a new one is started without it.
  chatId: z.string().regex(/^[a-f0-9]{16}$/).optional(),
})

const fail = (error: string, status: number) => Response.json({ error }, { status })

// POST { messages: [{ role, content }], context?, chatId? } → { reply, chatId }
// The conversation is saved (history.ts) with the question first and the reply once it's ready.
// The model gets the last 40 turns as plain text; tool calls happen inside a single request.
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

  const chatId = await saveQuestion(session.sub, parsed.data.chatId, parsed.data.messages)
  let turns = parsed.data.messages.slice(-40)
  while (turns[0]?.role === "assistant") turns = turns.slice(1)
  const input = { turns, situation, tools: { connection, account }, userId: session.sub }
  try {
    const reply =
      provider === "openai"
        ? await askOpenAI(input)
        : provider === "claude-code"
          ? await askClaudeCode(input)
          : await askClaude(input)
    await saveReply(session.sub, chatId, reply)
    return Response.json({ reply, chatId })
  } catch (error) {
    await dropQuestion(session.sub, chatId)
    if (error instanceof AssistantError) {
      return Response.json({ error: error.message, code: error.code, chatId }, { status: error.status })
    }
    console.error("Assistant failed:", error)
    return fail("The assistant couldn't be reached. Check your internet connection.", 502)
  }
}
