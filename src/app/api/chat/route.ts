import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"

import { tools, runTool, type ToolContext } from "@/lib/assistant/tools"
import { getSession } from "@/lib/auth/session"
import { formatCustomerId } from "@/lib/google/ads"
import { getConnection } from "@/lib/google/connections"

const MODEL = "claude-opus-5-5"
// Enough rounds for a report that needs several queries; stops a runaway loop.
const MAX_ROUNDS = 10

// Stable instructions first, so they can be cached across questions.
const INSTRUCTIONS = `You are the marketing analyst inside One Marketing Command Center, an internal tool for Twin Home Buyer, a company that buys houses for cash. The people asking are the company's own staff. Good leads are homeowners who want to sell; searches from renters, home buyers or job seekers are waste.

Answer questions about the company's Google Ads account and the leads from its QR codes (yard signs, postcards, flyers). Get real numbers with the tools before answering. Never make up figures; if the data isn't available, say so and say what would be needed.

When asked for a report, write it in Markdown: a one-line summary, then short sections with tables (campaigns, search terms, days, lead sources as fits the question), then 3 to 5 concrete recommendations. Show money in the account currency with two decimals, and percentages with one decimal. Keep answers short and plain; the readers aren't technical. Don't show GAQL or JSON unless asked.

The dashboard's "Searches to remove" list flags search terms with no conversions that match junk words or cost more than a lead normally does. Suggest negative keywords in Google Ads' format: "phrase" or [exact].

This tool is read-only: it can't change campaigns, budgets or keywords. When a change is needed, say exactly where to click in Google Ads.`

const requestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20_000) }))
    .min(1)
    .max(40)
    .refine((m) => m.at(-1)?.role === "user", "The last message must be a question."),
})

const fail = (error: string, status: number) => Response.json({ error }, { status })

// POST { messages: [{ role, content }] } → { reply }
// Earlier turns are sent back as plain text; tool calls happen inside a single request.
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return fail("Sign in first.", 401)
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return fail("The assistant isn't set up yet. Add ANTHROPIC_API_KEY to .env.local and restart the app.", 503)
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail("That message couldn't be read.", 400)

  const connection = await getConnection(session.sub)
  const account =
    connection?.accounts.find((a) => a.customerId === connection.selectedCustomerId) ??
    connection?.accounts[0] ??
    null
  const context: ToolContext = { connection, account }

  const today = new Date().toISOString().slice(0, 10)
  const situation = account
    ? `Today is ${today}. The selected Google Ads account is "${account.name}" (${formatCustomerId(account.customerId)}), currency ${account.currency}${account.test ? ", a test account with no real spend" : ""}. The person asking is ${session.name} (${session.email}).`
    : `Today is ${today}. Google Ads isn't connected yet, so only QR code leads are available. The person asking is ${session.name} (${session.email}).`

  const messages: Anthropic.Beta.BetaMessageParam[] = parsed.data.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const client = new Anthropic()
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: [
          { type: "text", text: INSTRUCTIONS, cache_control: { type: "ephemeral" } },
          { type: "text", text: situation },
        ],
        tools,
        messages,
      })

      if (response.stop_reason === "refusal") {
        return Response.json({ reply: "Sorry, I can't help with that one. Try asking it a different way." })
      }

      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n\n")
        .trim()

      if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence") {
        return Response.json({ reply: text || "I don't have an answer for that." })
      }
      if (response.stop_reason === "max_tokens") {
        return Response.json({ reply: `${text}\n\n_(The answer was cut off. Ask for a shorter version.)_` })
      }

      // Keep the whole turn (thinking and tool calls included) so the next round continues it.
      messages.push({ role: "assistant", content: response.content })
      if (response.stop_reason === "pause_turn") continue

      const calls = response.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
      )
      const results = await Promise.all(
        calls.map(async (call): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
          const result = await runTool(call.name, call.input, context)
          return {
            type: "tool_result",
            tool_use_id: call.id,
            content: result.content,
            ...(result.isError ? { is_error: true } : {}),
          }
        }),
      )
      messages.push({ role: "user", content: results })
    }
    return Response.json({ reply: "That question needed too many steps. Try asking something narrower." })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return fail("The ANTHROPIC_API_KEY in .env.local isn't valid.", 502)
    }
    if (error instanceof Anthropic.RateLimitError) {
      return fail("The assistant is busy right now. Try again in a minute.", 429)
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Claude API error:", error.status, error.message)
      return fail("The assistant ran into a problem. Please try again.", 502)
    }
    console.error("Assistant failed:", error)
    return fail("The assistant couldn't be reached. Check your internet connection.", 502)
  }
}
