"use client"

import { useRef, useState } from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

type KeywordInputProps = {
  id?: string
  value: string[]
  onChange: (value: string[]) => void
  onBlur?: () => void
  placeholder?: string
  invalid?: boolean
  // Colors for the keyword chips, so each section has its own.
  chipClassName?: string
  // Turns typed text into a keyword, or returns null to reject it.
  parse?: (text: string) => string | null
  rejectMessage?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
}

// A list of keywords shown as removable chips. Type and press Enter or comma to add one.
export default function KeywordInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  invalid,
  chipClassName = "bg-secondary text-secondary-foreground",
  parse = (text) => text,
  rejectMessage,
  inputMode,
}: KeywordInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState("")
  const [rejected, setRejected] = useState(false)

  function commit() {
    const trimmed = text.trim().replace(/,+$/, "").trim()
    if (!trimmed) return
    const keyword = parse(trimmed)
    if (!keyword) {
      setRejected(true)
      return
    }
    if (!value.some((v) => v.toLowerCase() === keyword.toLowerCase())) {
      onChange([...value, keyword])
    }
    setText("")
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-12 cursor-text flex-wrap items-center gap-2 rounded-xl border border-input bg-card p-2 shadow-xs transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          invalid && "border-destructive ring-3 ring-destructive/20",
        )}
      >
        {value.map((keyword) => (
          <span
            key={keyword}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg py-1 pr-1 pl-2.5 text-sm font-medium",
              chipClassName,
            )}
          >
            {keyword}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange(value.filter((v) => v !== keyword))
              }}
              aria-label={`Remove ${keyword}`}
              className="rounded-md p-0.5 opacity-60 transition hover:bg-black/10 hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={text}
          inputMode={inputMode}
          aria-invalid={invalid || rejected}
          placeholder={value.length ? "Add more…" : placeholder}
          onChange={(e) => {
            setText(e.target.value)
            setRejected(false)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              commit()
            } else if (e.key === "Backspace" && text === "" && value.length > 0) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={() => {
            commit()
            onBlur?.()
          }}
          className="h-8 min-w-32 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground"
        />
      </div>
      {rejected && rejectMessage && <p className="text-sm text-destructive">{rejectMessage}</p>}
    </div>
  )
}
