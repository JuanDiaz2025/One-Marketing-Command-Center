// How motivated a caller is to sell, from what they said on the phone: a few quick answers picked
// right after the call, plus notes. The AI set up for the chat (Claude, OpenAI or Claude Code)
// scores it 0-100 with its reasons; when no AI is set up, or it doesn't answer, a rule-based score
// from the quick answers is used instead, so a call always gets a score.
import { assistantProvider, type AskInput } from "@/lib/assistant/shared"
import { callQuestions, type CallAnswers } from "@/lib/leads/call-questions"
import type { LeadGrade, Motivation } from "@/lib/leads/types"

export { callQuestions, type CallAnswers }


const label = (q: keyof typeof callQuestions, v?: string) =>
  (callQuestions[q].options as readonly (readonly [string, string])[]).find(([k]) => k === v)?.[1]

const gradeOf = (value: number, notSeller: boolean): LeadGrade => (notSeller ? "junk" : value >= 70 ? "hot" : value >= 40 ? "warm" : "cold")

// Points for each quick answer. A cash buyer's best sellers have a reason, a deadline, a house
// needing work, and room on price.
const POINTS: Record<string, Record<string, number>> = {
  reason: { foreclosure: 30, inherited: 25, divorce: 25, relocating: 20, landlord: 20, repairs: 25, downsizing: 10, testing: -10 },
  timeline: { asap: 30, "90": 20, "6m": 5, later: -10 },
  condition: { major: 20, some: 10, good: -5 },
  price: { flexible: 20, realistic: 10, retail: -20 },
  occupancy: { vacant: 10, owner: 0, tenants: 5 },
}

export function ruleMotivation(a: CallAnswers): Motivation {
  const reasons: string[] = []
  let value = 15 // they called: some interest
  for (const q of Object.keys(POINTS) as (keyof typeof callQuestions)[]) {
    const v = a[q]
    const p = v ? POINTS[q][v] : undefined
    if (p === undefined) continue
    value += p
    if (p) reasons.push(`${p > 0 ? "+" : ""}${p} ${callQuestions[q].label}: ${label(q, v)}`)
  }
  const notSeller = a.reason === "not_seller"
  if (notSeller) reasons.unshift("Not a seller")
  value = notSeller ? 0 : Math.max(0, Math.min(100, value))
  return { value, grade: gradeOf(value, notSeller), reasons, by: "rules", at: new Date().toISOString() }
}

function describe(a: CallAnswers) {
  const lines = (Object.keys(callQuestions) as (keyof typeof callQuestions)[])
    .map((q) => (a[q] ? `${callQuestions[q].label}: ${label(q, a[q])}` : null))
    .filter(Boolean)
  return [...lines, a.notes?.trim() ? `Notes from the call: ${a.notes.trim()}` : null].filter(Boolean).join("\n")
}

const TASK = `You score how motivated a caller is to sell their house to a cash home buyer (Twin Home Buyer), from what was noted during a phone call from a Google ad. Highly motivated sellers have a pressing reason (foreclosure, inherited, divorce, relocation, tired landlord, repairs they can't afford), a short timeline, a house needing work, and flexibility on price. Low motivation: just curious, no deadline, wants full retail price, or not a seller at all (wrong number, real estate agent, buyer, renter, spam).
Reply with only a JSON object, no other text: {"score": <0-100>, "notSeller": <true|false>, "reasons": ["<short reason>", ...up to 5], "summary": "<one sentence for the sales team>"}`

function parse(text: string): { score: number; notSeller?: boolean; reasons?: string[]; summary?: string } | null {
  const json = text.match(/\{[\s\S]*\}/)?.[0]
  if (!json) return null
  try {
    const v = JSON.parse(json)
    return typeof v.score === "number" ? v : null
  } catch {
    return null
  }
}

// The AI's score, or the rule-based one if no AI is set up or it doesn't give a usable answer
// within 60 seconds.
export async function scoreCall(a: CallAnswers): Promise<Motivation> {
  const rules = ruleMotivation(a)
  const provider = assistantProvider()
  const facts = describe(a)
  if (!provider || !facts) return rules
  const input: AskInput = {
    turns: [{ role: "user", content: `${TASK}\n\nThe call:\n${facts}` }],
    situation: "This is a scoring task, not a chat: no tools are needed. Reply with the JSON object only.",
    tools: { connection: null, account: null },
  }
  try {
    const ask =
      provider === "openai"
        ? (await import("@/lib/assistant/openai")).askOpenAI
        : provider === "anthropic"
          ? (await import("@/lib/assistant/claude")).askClaude
          : (await import("@/lib/assistant/claude-code")).askClaudeCode
    const text = await Promise.race([ask(input), new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), 60_000))])
    const got = parse(text)
    if (!got) return { ...rules, reasons: [...rules.reasons, "(The AI didn't give a score, so this one is from the quick answers.)"] }
    const notSeller = Boolean(got.notSeller) || a.reason === "not_seller"
    const value = notSeller ? 0 : Math.max(0, Math.min(100, Math.round(got.score)))
    return {
      value,
      grade: gradeOf(value, notSeller),
      reasons: (got.reasons ?? []).map(String).slice(0, 5),
      summary: got.summary ? String(got.summary).slice(0, 300) : undefined,
      by: "ai",
      at: new Date().toISOString(),
    }
  } catch {
    return { ...rules, reasons: [...rules.reasons, "(The AI didn't answer, so this score is from the quick answers.)"] }
  }
}
