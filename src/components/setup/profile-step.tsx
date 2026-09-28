"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import ProfileForm from "@/components/setup/profile-form"
import StepLoading, { LOADING_STEP_MS } from "@/components/setup/step-loading"
import SetupProgress from "@/components/setup/setup-progress"
import {
  businessKey,
  emptyProfile,
  loadDraft,
  saveDraft,
  setupSteps,
  websiteHost,
  type BusinessDetails,
  type BusinessProfile,
  type ProfileSuggestion,
  type SetupDraft,
} from "@/lib/setup"

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; suggestion: ProfileSuggestion; initial?: BusinessProfile }

async function fetchSuggestion(business: BusinessDetails, signal: AbortSignal) {
  const response = await fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ business }),
    signal,
  })
  if (!response.ok) throw new Error(`Profile request failed: ${response.status}`)
  return (await response.json()) as ProfileSuggestion
}

function loadingSteps(host: string) {
  return [
    host ? `Reading ${host}` : "Reading your description",
    "Pinpointing your location",
    "Picking out your brand keywords",
    "Spotting your best sellers",
    "Finding your customers",
    "Suggesting a budget",
  ]
}

// Waits for the suggestion, but no less than the loading animation takes to play through.
async function suggestProfile(business: BusinessDetails, signal: AbortSignal) {
  const minimumWait = loadingSteps(websiteHost(business.website)).length * LOADING_STEP_MS
  const [suggestion] = await Promise.all([
    fetchSuggestion(business, signal),
    new Promise((resolve) => setTimeout(resolve, minimumWait)),
  ])
  return suggestion
}

function initialState(draft: SetupDraft): State {
  // Reuse the earlier suggestion unless step 1 has changed since.
  if (draft.business && draft.suggestion && draft.suggestionFor === businessKey(draft.business)) {
    return { status: "ready", suggestion: draft.suggestion, initial: draft.profile }
  }
  return { status: "loading" }
}

// Rendered in the browser only (see the page), since the draft lives in browser memory.
export default function ProfileStep() {
  const router = useRouter()
  const [draft] = useState(loadDraft)
  const business = draft.business
  const [state, setState] = useState<State>(() => initialState(draft))
  const needsSuggestion = state.status === "loading"

  useEffect(() => {
    if (!business) {
      router.replace("/setup")
      return
    }
    if (!needsSuggestion) return
    const controller = new AbortController()
    suggestProfile(business, controller.signal).then(
      (suggestion) => {
        if (controller.signal.aborted) return
        saveDraft({ suggestion, suggestionFor: businessKey(business), profile: undefined })
        setState({ status: "ready", suggestion })
      },
      () => {
        if (!controller.signal.aborted) setState({ status: "error" })
      },
    )
    return () => controller.abort()
  }, [business, needsSuggestion, router])

  if (!business) return null

  const host = websiteHost(business.website)

  if (state.status === "loading") {
    return (
      <StepLoading title={`Getting to know ${business.businessName}`} steps={loadingSteps(host)} />
    )
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <TriangleAlert className="size-6" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t look you up</h1>
          <p className="text-muted-foreground">
            Try again, or fill in your profile yourself. It only takes a minute.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              setState({ status: "ready", suggestion: { sources: [], profile: emptyProfile() } })
            }
          >
            Fill it in myself
          </Button>
          <Button size="lg" onClick={() => setState({ status: "loading" })}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  const { suggestion, initial } = state
  const found = suggestion.sources.length > 0

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <div className="flex flex-col gap-6">
        <SetupProgress current={1} />
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-primary">Step 2 of {setupSteps.length}</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {found ? "Here's what we found about " : "Tell us more about "}
            <span className="bg-gradient-to-r from-primary via-fuchsia-500 to-orange-500 bg-clip-text text-transparent">
              {business.businessName}
            </span>
          </h1>
          <p className="flex items-start gap-2 text-lg text-pretty text-muted-foreground">
            {found ? (
              <>
                <Sparkles className="mt-1.5 size-4 shrink-0 text-primary" />
                <span>
                  From {suggestion.sources.join(" and ")}. Add, remove, or change anything.
                </span>
              </>
            ) : (
              "We couldn't find much online, so add a few keywords to get started."
            )}
          </p>
        </div>
      </div>
      <ProfileForm suggestion={suggestion} initial={initial} />
    </div>
  )
}
