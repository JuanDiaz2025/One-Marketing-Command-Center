"use client"

import { useEffect, useState } from "react"
import { Check, LoaderCircle, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

export const LOADING_STEP_MS = 600

type StepLoadingProps = {
  title: string
  steps: string[]
  // Shown large beside the steps (below them on small screens), e.g. the photos being worked on.
  children?: React.ReactNode
}

// A loading screen that ticks through what AdPilot is doing. Let it run for at least
// steps.length * LOADING_STEP_MS so every step gets its moment.
export default function StepLoading({ title, steps, children }: StepLoadingProps) {
  const [active, setActive] = useState(0)

  // Walk through the steps; the last one stays active until the suggestion arrives.
  useEffect(() => {
    const timer = setInterval(() => {
      setActive((current) => Math.min(current + 1, steps.length - 1))
    }, LOADING_STEP_MS)
    return () => clearInterval(timer)
  }, [steps.length])

  return (
    <div
      className={cn(
        "mx-auto grid items-center gap-10 py-10",
        children ? "max-w-5xl lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14" : "max-w-md",
      )}
    >
      {children && <div className="order-2 lg:order-1">{children}</div>}
      <div className="order-1 flex flex-col items-center gap-8 text-center lg:order-2">
        <div className="relative flex size-24 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full bg-[conic-gradient(from_0deg,var(--color-primary),#d946ef,#f97316,#22d3ee,var(--color-primary))] [animation-duration:2.5s]" />
          <div className="absolute inset-1.5 rounded-full bg-background" />
          <div className="absolute inset-0 animate-pulse rounded-full bg-fuchsia-400/20 blur-xl" />
          <Sparkles className="relative size-9 text-primary" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
          <p className="text-muted-foreground">This takes a few seconds.</p>
        </div>

        <ol className="flex w-full flex-col gap-1 rounded-3xl bg-card p-3 text-left shadow-xs ring-1 ring-border">
          {steps.map((step, index) => {
            const done = index < active
            const current = index === active
            return (
              <li
                key={step}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-300",
                  current && "bg-secondary font-medium",
                  !done && !current && "text-muted-foreground/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
                    done && "bg-emerald-500 text-white",
                    current && "text-primary",
                    !done && !current && "ring-1 ring-border",
                  )}
                >
                  {done && <Check className="size-3.5" strokeWidth={3} />}
                  {current && <LoaderCircle className="size-5 animate-spin" />}
                </span>
                {step}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
