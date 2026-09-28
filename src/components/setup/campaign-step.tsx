"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, ExternalLink, LoaderCircle, PartyPopper, Printer, QrCode } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import CampaignForm from "@/components/setup/campaign-form"
import { currency } from "@/components/setup/form-parts"
import SetupProgress from "@/components/setup/setup-progress"
import StepLoading, { LOADING_STEP_MS } from "@/components/setup/step-loading"
import { primaryButtonClass } from "@/components/setup/styles"
import { suggestCampaign } from "@/lib/campaign-suggestion"
import { launchQrCodeAction, type LaunchQrResult } from "@/lib/conversions/actions"
import {
  DEFAULT_OFFER,
  qrCodeSchema,
  qrFieldErrors,
  type QrCodeFields,
} from "@/lib/conversions/qr-schema"
import { demoPhotos, isDemoBusiness } from "@/lib/demo"
import {
  conversionSourceOptions,
  loadDraft,
  metaShareFor,
  platformOptions,
  saveDraft,
  setupSteps,
  type BusinessDetails,
  type CampaignSettings,
  type UploadedPhoto,
} from "@/lib/setup"

type Phase = "edit" | "launching" | "live"

function labelsFor<T extends string>(
  options: ReadonlyArray<{ value: T; label: string }>,
  values: T[],
) {
  return options.filter((o) => values.includes(o.value)).map((o) => o.label)
}

function launchingSteps(campaign: CampaignSettings, adCount: number, qrPlacement: string) {
  const otherSources = campaign.conversionSources.filter((s) => s !== "qr")
  return [
    ...labelsFor(platformOptions, campaign.platforms).map(
      (label) => `Creating your ${label} campaign`,
    ),
    `Uploading your ${adCount} ads`,
    ...(campaign.conversionSources.includes("qr")
      ? [`Creating your QR code for ${qrPlacement.toLowerCase()}`]
      : []),
    ...(otherSources.length
      ? [`Connecting ${labelsFor(conversionSourceOptions, otherSources).join(" and ")}`]
      : []),
    "Turning on A/B testing",
  ]
}

// Photos a customer's phone can load. Uploads only exist in this browser, so fall back to the
// demo photos for the QR page's header.
function headerPhotos(photos: UploadedPhoto[] | undefined) {
  const shareable = (photos ?? []).filter((p) => !p.url.startsWith("blob:"))
  return shareable.length ? shareable : demoPhotos
}

function defaultQrFields(business: BusinessDetails, photos: UploadedPhoto[]): QrCodeFields {
  const offer = isDemoBusiness(business)
    ? DEFAULT_OFFER
    : {
        ...DEFAULT_OFFER,
        headline: "20% off your first visit",
        offerItem: "item",
        headerPhoto: photos[0].url,
      }
  return { businessName: business.businessName, placement: "Front counter", ...offer }
}

// Rendered in the browser only (see the page), since the draft lives in browser memory.
export default function CampaignStep() {
  const router = useRouter()
  const [draft] = useState(loadDraft)
  const { business, profile, selectedCreatives } = draft
  const [suggestion] = useState(() =>
    business && profile ? suggestCampaign(business, profile, selectedCreatives?.length ?? 0) : null,
  )
  // The picked ads, or the photo a mock ad was drawn over, for the placement previews.
  const [adImages] = useState(() =>
    (draft.creatives ?? [])
      .filter((creative) => selectedCreatives?.includes(creative.id))
      .map((creative) => creative.image ?? draft.photos?.[creative.sourcePhotos[0]]?.url)
      .filter((url): url is string => Boolean(url)),
  )
  const [campaign, setCampaign] = useState<CampaignSettings | undefined>(draft.campaign)
  const [phase, setPhase] = useState<Phase>("edit")
  const [qrPhotos] = useState(() => headerPhotos(draft.photos))
  const [qrFields, setQrFields] = useState<QrCodeFields | null>(() =>
    business ? defaultQrFields(business, qrPhotos) : null,
  )
  const [qrErrors, setQrErrors] = useState<Record<string, string>>({})
  const [qrCode, setQrCode] = useState<Extract<LaunchQrResult, { ok: true }> | null>(null)

  useEffect(() => {
    if (!business) router.replace("/setup")
    else if (!profile) router.replace("/setup/profile")
    else if (!selectedCreatives?.length) router.replace("/setup/creatives")
  }, [business, profile, selectedCreatives, router])

  // Launching is mocked: play the steps, then show the campaign as live.
  useEffect(() => {
    if (phase !== "launching" || !campaign) return
    const steps = launchingSteps(
      campaign,
      selectedCreatives?.length ?? 0,
      qrFields?.placement ?? "",
    )
    const timer = setTimeout(() => setPhase("live"), steps.length * LOADING_STEP_MS + 400)
    return () => clearTimeout(timer)
  }, [phase, campaign, selectedCreatives, qrFields])

  if (!business || !profile || !selectedCreatives?.length || !suggestion || !qrFields) return null

  function launch(settings: CampaignSettings) {
    const wantsQr = settings.conversionSources.includes("qr")
    const parsed = qrCodeSchema.safeParse(qrFields)
    if (wantsQr && !parsed.success) {
      setQrErrors(qrFieldErrors(parsed.error))
      document.getElementById("qr-setup")?.scrollIntoView({ behavior: "smooth" })
      return
    }
    saveDraft({ campaign: settings })
    setCampaign(settings)
    setQrCode(null)
    setPhase("launching")
    if (wantsQr && parsed.success) {
      launchQrCodeAction(parsed.data).then((result) => {
        if (result.ok) {
          setQrCode(result)
        } else {
          setQrErrors(result.errors)
          setPhase("edit")
        }
      })
    }
  }

  if (phase === "launching" && campaign) {
    return (
      <StepLoading
        title="Launching your campaign"
        steps={launchingSteps(campaign, selectedCreatives.length, qrFields.placement)}
      />
    )
  }

  if (phase === "live" && campaign) {
    const metaShare = metaShareFor(campaign.platforms, campaign.budget.metaShare)
    const split =
      campaign.platforms.length === 2
        ? `Meta ${metaShare}% · Google ${100 - metaShare}%${campaign.budget.splitMode === "auto" ? " (auto)" : ""}`
        : `All on ${labelsFor(platformOptions, campaign.platforms)[0]}`
    const summary = [
      { label: "Platforms", value: labelsFor(platformOptions, campaign.platforms).join(" and ") },
      { label: "Budget", value: `${currency.format(campaign.budget.monthly)} a month · ${split}` },
      { label: "Ads", value: `${selectedCreatives.length} ads, A/B tested automatically` },
      {
        label: "Conversions",
        value: labelsFor(conversionSourceOptions, campaign.conversionSources).join(", "),
      },
    ]
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-8 py-10 text-center">
        <span className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-400 via-pink-500 to-violet-600 text-white shadow-xl shadow-pink-500/30">
          <PartyPopper className="size-9" />
        </span>
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">
            {business.businessName} is{" "}
            <span className="bg-gradient-to-r from-primary via-fuchsia-500 to-orange-500 bg-clip-text text-transparent">
              live
            </span>
          </h1>
          <p className="text-lg text-pretty text-muted-foreground">
            Your ads are running. We&apos;ll keep testing them and moving your budget to what brings
            in the most customers.
          </p>
        </div>
        <dl className="flex w-full flex-col divide-y rounded-3xl bg-card text-left shadow-xs ring-1 ring-border">
          {summary.map((row) => (
            <div key={row.label} className="flex gap-4 px-5 py-4">
              <dt className="w-28 shrink-0 text-sm text-muted-foreground">{row.label}</dt>
              <dd className="text-sm font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
        {campaign.conversionSources.includes("qr") && (
          <section className="flex w-full flex-col items-center gap-4 rounded-3xl bg-white p-6 text-neutral-900 shadow-lg ring-1 ring-border">
            <div className="flex flex-col gap-1">
              <p className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-700">
                <QrCode className="size-4" />
                Your QR code is ready · {qrFields.placement}
              </p>
              <p className="text-2xl font-bold tracking-tight">{qrFields.headline}</p>
            </div>
            {qrCode ? (
              <div
                className="aspect-square w-52 [&_svg]:size-full"
                role="img"
                aria-label={`QR code linking to ${qrCode.url}`}
                dangerouslySetInnerHTML={{ __html: qrCode.svg }}
              />
            ) : (
              <div className="flex aspect-square w-52 items-center justify-center rounded-2xl bg-muted">
                <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <p className="text-sm text-neutral-500">
              Put it by the register. Every scan is a conversion, fed back to your ad platforms.
            </p>
            {qrCode && (
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href={`/conversions/qr/${qrCode.id}/poster`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-11 rounded-xl px-4",
                  )}
                >
                  <Printer className="size-4" />
                  Print poster
                </Link>
                <a
                  href={qrCode.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-11 rounded-xl px-4",
                  )}
                >
                  <ExternalLink className="size-4" />
                  Open offer page
                </a>
              </div>
            )}
          </section>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/conversions"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-12 rounded-xl px-5",
            )}
          >
            Conversion feed
          </Link>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ size: "lg" }), primaryButtonClass)}
          >
            Go to your dashboard
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <div className="flex flex-col gap-6">
        <SetupProgress current={3} />
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-primary">Step 4 of {setupSteps.length}</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Set up your{" "}
            <span className="bg-gradient-to-r from-primary via-fuchsia-500 to-orange-500 bg-clip-text text-transparent">
              campaign
            </span>
          </h1>
          <p className="text-lg text-pretty text-muted-foreground">
            Pick where your ads run, how much to spend, and how we&apos;ll count the customers they
            bring in.
          </p>
        </div>
      </div>
      <CampaignForm
        businessName={business.businessName}
        suggestion={suggestion}
        adImages={adImages}
        initial={campaign}
        qr={{
          fields: qrFields,
          onChange: (fields) => {
            setQrFields(fields)
            setQrErrors({})
          },
          errors: qrErrors,
          photos: qrPhotos,
        }}
        onLaunch={launch}
      />
    </div>
  )
}
