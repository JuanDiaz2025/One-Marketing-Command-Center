"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, ImageUp, Sparkles, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import CreativePicker, { TestingBanner } from "@/components/setup/creative-picker"
import PhotoUpload from "@/components/setup/photo-upload"
import SetupProgress from "@/components/setup/setup-progress"
import StepLoading, { LOADING_STEP_MS } from "@/components/setup/step-loading"
import { primaryButtonClass } from "@/components/setup/styles"
import { demoPhotos, isDemoBusiness } from "@/lib/demo"
import {
  MIN_CREATIVE_PICKS,
  creativesKey,
  loadDraft,
  saveDraft,
  setupSteps,
  type BusinessDetails,
  type BusinessProfile,
  type CreativeVariation,
  type UploadedPhoto,
} from "@/lib/setup"

type Phase = "upload" | "generating" | "review" | "error"

function generatingSteps(photoCount: number) {
  return [
    `Studying your ${photoCount === 1 ? "photo" : `${photoCount} photos`}`,
    "Matching your brand keywords",
    "Writing headlines for each audience",
    "Framing for Stories, Reels, and Shorts",
    "Building variations to test",
  ]
}

// Waits for the creatives, but no less than the loading animation takes to play through.
async function generateCreatives(
  business: BusinessDetails,
  profile: BusinessProfile,
  photos: UploadedPhoto[],
  signal: AbortSignal,
) {
  const minimumWait = generatingSteps(photos.length).length * LOADING_STEP_MS
  const [response] = await Promise.all([
    fetch("/api/creatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business, profile, photoCount: photos.length }),
      signal,
    }),
    new Promise((resolve) => setTimeout(resolve, minimumWait)),
  ])
  if (!response.ok) throw new Error(`Creatives request failed: ${response.status}`)
  const { creatives } = (await response.json()) as { creatives: CreativeVariation[] }
  return creatives
}

function StepHeader({
  title,
  highlight,
  children,
}: {
  title: string
  highlight: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <SetupProgress current={2} />
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-primary">Step 3 of {setupSteps.length}</p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {title}{" "}
          <span className="bg-gradient-to-r from-primary via-fuchsia-500 to-orange-500 bg-clip-text text-transparent">
            {highlight}
          </span>
        </h1>
        <p className="text-lg text-pretty text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

// Rendered in the browser only (see the page), since the draft and photos live in browser memory.
export default function CreativesStep() {
  const router = useRouter()
  const [draft] = useState(loadDraft)
  const { business, profile } = draft
  // The demo starts with the shop's real photos already added.
  const [photos, setPhotos] = useState<UploadedPhoto[]>(
    () => draft.photos ?? (business && isDemoBusiness(business) ? demoPhotos : []),
  )
  const [creatives, setCreatives] = useState<CreativeVariation[]>(draft.creatives ?? [])
  const [selected, setSelected] = useState<string[]>(draft.selectedCreatives ?? [])
  const [phase, setPhase] = useState<Phase>(() =>
    profile && draft.creatives && draft.creativesFor === creativesKey(photos, profile)
      ? "review"
      : "upload",
  )
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (!business) router.replace("/setup")
    else if (!profile) router.replace("/setup/profile")
  }, [business, profile, router])

  useEffect(() => {
    if (phase !== "generating" || !business || !profile) return
    const controller = new AbortController()
    generateCreatives(business, profile, photos, controller.signal).then(
      (creatives) => {
        if (controller.signal.aborted) return
        saveDraft({ creatives, creativesFor: creativesKey(photos, profile), selectedCreatives: [] })
        setCreatives(creatives)
        setSelected([])
        setPhase("review")
      },
      () => {
        if (!controller.signal.aborted) setPhase("error")
      },
    )
    return () => controller.abort()
  }, [phase, business, profile, photos])

  if (!business || !profile) return null

  if (phase === "generating") {
    return (
      <StepLoading title="Creating your ads" steps={generatingSteps(photos.length)}>
        {/* The owner's real photos, big, with a light sweeping over each as it's "read". */}
        <div className="grid w-full grid-cols-2 gap-3">
          {photos.slice(0, 4).map((photo, i) => (
            <div
              key={photo.id}
              className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-muted shadow-lg ring-1 ring-black/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.name} className="size-full object-cover" />
              <div
                className="absolute inset-x-0 top-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-white/45 to-transparent"
                style={{ animationDelay: `${i * 400}ms` }}
              />
              <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                Your photo
              </span>
            </div>
          ))}
        </div>
      </StepLoading>
    )
  }

  if (phase === "error") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <TriangleAlert className="size-6" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t make your ads</h1>
          <p className="text-muted-foreground">Something went wrong on our side. Try again.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="lg" onClick={() => setPhase("upload")}>
            Change photos
          </Button>
          <Button size="lg" onClick={() => setPhase("generating")}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (phase === "upload") {
    const missingPhotos = showErrors && photos.length === 0
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-10">
        <StepHeader title="Add photos for" highlight="your ads">
          Upload a few photos of what you sell, your space, or your team. We&apos;ll turn them into
          vertical ads for Stories, Reels, and Shorts.
        </StepHeader>

        <div className="flex flex-col gap-2">
          <PhotoUpload
            photos={photos}
            onChange={(photos) => {
              setPhotos(photos)
              saveDraft({ photos })
            }}
            invalid={missingPhotos}
          />
          {missingPhotos && <p className="text-sm text-destructive">Add at least one photo.</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/setup/profile"
            className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-12 rounded-xl px-4")}
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <Button
            type="button"
            size="lg"
            className={cn(primaryButtonClass, "ml-auto")}
            onClick={() => {
              if (photos.length === 0) {
                setShowErrors(true)
                return
              }
              setShowErrors(false)
              // Reuse the ads already made from these photos and this profile.
              setPhase(
                creatives.length && loadDraft().creativesFor === creativesKey(photos, profile)
                  ? "review"
                  : "generating",
              )
            }}
          >
            <Sparkles className="size-4" />
            Generate creatives
          </Button>
        </div>
      </div>
    )
  }

  const tooFewPicks = showErrors && selected.length < MIN_CREATIVE_PICKS

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10">
      <StepHeader title="Pick your favorite" highlight="ads">
        AdPilot reimagined your photos as {creatives.length} vertical ads. Each one tries a
        different angle to see what your customers respond to.
      </StepHeader>

      <TestingBanner />

      <CreativePicker
        creatives={creatives}
        photos={photos}
        businessName={business.businessName}
        selected={selected}
        onChange={(selected) => {
          setSelected(selected)
        }}
        invalid={tooFewPicks}
      />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="h-12 rounded-xl px-4"
          onClick={() => {
            setShowErrors(false)
            setPhase("upload")
          }}
        >
          <ImageUp className="size-4" />
          Change photos
        </Button>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-4">
          {tooFewPicks && (
            <p className="text-sm text-destructive">
              Pick at least {MIN_CREATIVE_PICKS} so the platforms have something to test.
            </p>
          )}
          <Button
            type="button"
            size="lg"
            className={primaryButtonClass}
            onClick={() => {
              if (selected.length < MIN_CREATIVE_PICKS) {
                setShowErrors(true)
                return
              }
              saveDraft({ selectedCreatives: selected })
              router.push("/setup/campaign")
            }}
          >
            Continue with {selected.length}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
