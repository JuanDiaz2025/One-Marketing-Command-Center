// How motivated a caller is to sell, from what they said on the phone: a few quick answers picked
// right after the call, plus notes. The AI set up for the chat (Claude, OpenAI or Claude Code)
// scores it 0-100 with its reasons; when no AI is set up, or it doesn't answer, a rule-based score
// from the quick answers is used instead, so a call always gets a score.
import { assistantProvider } from "@/lib/assistant/shared"
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
    const p = v && Object.hasOwn(POINTS[q], v) ? POINTS[q][v] : undefined
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

// Only the choices offered in the form (anything else is dropped), and notes as plain text of a
// sensible length.
export function cleanAnswers(raw: unknown, notes: unknown): CallAnswers {
  const out: Record<string, string> = {}
  const given = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  for (const q of Object.keys(callQuestions) as (keyof typeof callQuestions)[]) {
    const v = given[q]
    if (typeof v === "string" && v && (callQuestions[q].options as readonly (readonly [string, string])[]).some(([k]) => k === v)) out[q] = v
  }
  if (typeof notes === "string" && notes.trim()) out.notes = notes.trim().slice(0, 3000)
  return out as CallAnswers
}

// The first {...} in the reply that parses as the score object.
function parse(text: string): { score: number; notSeller?: boolean; reasons?: unknown; summary?: unknown } | null {
  for (let start = text.indexOf("{"); start >= 0; start = text.indexOf("{", start + 1)) {
    for (let end = text.lastIndexOf("}"); end > start; end = text.lastIndexOf("}", end - 1)) {
      try {
        const v = JSON.parse(text.slice(start, end + 1))
        const score = Number(v?.score)
        if (Number.isFinite(score)) return { ...v, score }
      } catch {
        // not this span
      }
    }
  }
  return null
}

const TIMEOUT_MS = 60_000

// The AI's score, or the rule-based one if no AI is set up or it doesn't give a usable answer
// within a minute (the AI is stopped then, so nothing keeps running).
export async function scoreCall(a: CallAnswers): Promise<Motivation> {
  const rules = ruleMotivation(a)
  const provider = assistantProvider()
  const facts = describe(a)
  if (!provider || !facts) return rules
  const prompt = `The call:\n${facts}`
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), TIMEOUT_MS)
  try {
    const text =
      provider === "openai"
        ? await (await import("@/lib/assistant/openai")).askOpenAIPlain(TASK, prompt, stop.signal)
        : provider === "anthropic"
          ? await (await import("@/lib/assistant/claude")).askClaudePlain(TASK, prompt, stop.signal)
          : await (await import("@/lib/assistant/claude-code")).askClaudeCodePlain(TASK, prompt, TIMEOUT_MS)
    const got = parse(text)
    if (!got) return { ...rules, reasons: [...rules.reasons, "(The AI didn't give a score, so this one is from the quick answers.)"] }
    const notSeller = got.notSeller === true || a.reason === "not_seller"
    const value = notSeller ? 0 : Math.max(0, Math.min(100, Math.round(got.score)))
    return {
      value,
      grade: gradeOf(value, notSeller),
      reasons: (Array.isArray(got.reasons) ? got.reasons : []).map(String).slice(0, 5),
      summary: typeof got.summary === "string" && got.summary ? got.summary.slice(0, 300) : undefined,
      by: "ai",
      at: new Date().toISOString(),
    }
  } catch {
    return { ...rules, reasons: [...rules.reasons, "(The AI didn't answer in time, so this score is from the quick answers.)"] }
  } finally {
    clearTimeout(timer)
  }
}
