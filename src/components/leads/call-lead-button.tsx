"use client"

import { useState, useTransition } from "react"
import { Plus, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { addCallLeadAction } from "@/lib/leads/call-actions"
import type { CallInfo } from "@/lib/leads/call-id"
import { callQuestions, type CallAnswers } from "@/lib/leads/call-questions"
import type { Motivation } from "@/lib/leads/types"
import { cn } from "@/lib/utils"

const input = "h-9 rounded-lg border bg-card px-2 text-sm"

const gradeStyle: Record<Motivation["grade"], { label: string; cls: string }> = {
  hot: { label: "Hot", cls: "bg-red-600 text-white" },
  warm: { label: "Warm", cls: "bg-amber-400 text-amber-950" },
  cold: { label: "Cold", cls: "bg-sky-100 text-sky-900" },
  junk: { label: "Not a seller", cls: "bg-muted text-muted-foreground" },
}

// A call's motivation score, as a badge.
export function MotivationBadge({ m }: { m: Pick<Motivation, "value" | "grade"> }) {
  const g = gradeStyle[m.grade]
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={cn("rounded-full px-2 py-0.5", g.cls)}>{g.label}</span>
      <span className="tabular-nums">Motivation {m.value}</span>
    </span>
  )
}

// "Add as lead" on a Google Ads call: right after the call, pick a few quick answers (why they're
// selling, when, the house, price, who lives there) and add notes; they're saved in the lead's
// notes, and the lead is sent to Google Ads like any other, matched by the caller's number.
export default function CallLeadButton({ call, added }: { call: CallInfo; added: Pick<Motivation, "value" | "grade"> | null | false }) {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState(call.areaCode ? `(${call.areaCode}) ` : "")
  const [name, setName] = useState("")
  const [status, setStatus] = useState("new")
  const [notes, setNotes] = useState("")
  const [answers, setAnswers] = useState<CallAnswers>({})
  const [result, setResult] = useState<{ ok: boolean; text: string; motivation?: Motivation } | null>(null)
  const [pending, start] = useTransition()

  if (result?.ok) {
    return (
      <div className="flex max-w-md flex-col gap-1">
        {result.motivation && <MotivationBadge m={result.motivation} />}
        {result.motivation?.summary && <span className="text-xs">{result.motivation.summary}</span>}
        <span className="text-xs text-emerald-700">{result.text}</span>
      </div>
    )
  }
  if (added !== false) {
    return added ? <MotivationBadge m={added} /> : <span className="text-xs font-medium text-emerald-700">Added as a lead ✓</span>
  }
  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserPlus data-icon="inline-start" />
        Add as lead
      </Button>
    )
  }
  return (
    <form
      className="flex max-w-xl flex-col gap-2 rounded-xl border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        setResult(null)
        start(async () => {
          try {
            // The quick answers, in words, ahead of the typed notes.
            const picked = (Object.keys(callQuestions) as (keyof typeof callQuestions)[])
              .filter((q) => answers[q])
              .map((q) => `${callQuestions[q].label}: ${(callQuestions[q].options as readonly (readonly [string, string])[]).find(([k]) => k === answers[q])?.[1] ?? answers[q]}`)
            const input = { phone, name, status, notes: [...picked, notes.trim()].filter(Boolean).join("\n") }
            const res = await addCallLeadAction(call, input)
            setResult(res.error ? { ok: false, text: res.error } : { ok: true, text: res.ok ?? "Added ✓", motivation: "motivation" in res ? (res.motivation as Motivation | undefined) : undefined })
          } catch {
            setResult({ ok: false, text: "Couldn't add it. Try again." })
          }
        })
      }}
    >
      <div className="flex flex-wrap gap-2">
        <input aria-label="Caller's phone number" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(510) 555-0123" className={cn(input, "w-36")} />
        <input aria-label="Caller's name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className={cn(input, "w-40")} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(callQuestions) as (keyof typeof callQuestions)[]).map((q) => (
          <label key={q} className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {callQuestions[q].label}
            <select value={answers[q] ?? ""} onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })} className={cn(input, "text-foreground")}>
              {callQuestions[q].options.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <textarea
        aria-label="Notes from the call"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="What did they say? e.g. inherited the house from mom, it needs a new roof, wants to close before the end of the month"
        className="rounded-lg border bg-card px-2 py-1.5 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          <option value="new">New</option>
          <option value="interested">Interested</option>
          <option value="appointment">Appointment</option>
          <option value="offer">Offer made</option>
          <option value="closed">Closed deal</option>
          <option value="not_interested">Not interested</option>
        </select>
        <Button type="submit" size="sm" disabled={pending}>
          <Plus data-icon="inline-start" />
          {pending ? "Adding…" : "Add lead"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {result && !result.ok && <span className="text-xs text-destructive">{result.text}</span>}
    </form>
  )
}
