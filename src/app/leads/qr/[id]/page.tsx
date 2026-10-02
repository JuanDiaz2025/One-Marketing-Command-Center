import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import QRCode from "qrcode"
import { Pencil, TriangleAlert } from "lucide-react"

import AppHeader from "@/components/app-header"
import LeadList from "@/components/leads/lead-list"
import QrDownloads from "@/components/leads/qr-downloads"
import StatusBadge from "@/components/leads/status-badge"
import ToggleActiveButton from "@/components/leads/toggle-active-button"
import { formatNumber } from "@/components/dashboard/format"
import { buttonVariants } from "@/components/ui/button"
import { requireSession } from "@/lib/auth/session"
import { getQrUrl } from "@/lib/leads/qr-url"
import { getQrCode, listLeads } from "@/lib/leads/store"
import { qrTheme } from "@/lib/leads/types"

export const metadata: Metadata = { title: "QR code · One Marketing Command Center" }

export default async function QrCodePage({ params }: PageProps<"/leads/qr/[id]">) {
  const { id } = await params
  const user = await requireSession(`/leads/qr/${id}`)
  const code = await getQrCode(id)
  if (!code) notFound()

  const [{ url, localOnly, lan }, all] = await Promise.all([getQrUrl(id), listLeads()])
  const mine = all.filter((l) => l.qrCodeId === id)
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
  const theme = qrTheme(code.theme)

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/leads" user={user} />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/leads" className="text-sm text-muted-foreground hover:text-foreground">
          ← Leads
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{code.placement}</h1>
            <StatusBadge active={code.active} />
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/leads/qr/${id}/edit`}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <Pencil data-icon="inline-start" />
              Edit
            </Link>
            <ToggleActiveButton id={id} active={code.active} />
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-4 rounded-2xl border bg-white p-6 text-center shadow-xs">
            <p className="text-sm font-medium" style={{ color: theme.primary }}>
              {code.businessName}
            </p>
            <p className="text-2xl leading-tight font-bold text-neutral-900">{code.headline}</p>
            <div
              className="aspect-square w-full max-w-64 [&_svg]:size-full"
              role="img"
              aria-label={`QR code linking to ${url}`}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p className="text-sm text-neutral-500">Scan with your phone camera</p>
          </div>

          <div className="flex flex-col gap-6">
            {!code.active && (
              <p className="flex gap-2 rounded-xl bg-muted p-4 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                This code is paused. People who scan it see that the form is closed.
              </p>
            )}
            <section className="flex flex-col gap-3">
              <h2 className="font-semibold">Download and print</h2>
              <QrDownloads qrCodeId={id} url={url} name={code.placement} businessName={code.businessName} message={code.headline} />
            </section>

            <section className="rounded-2xl border bg-card p-5 text-sm">
              <h2 className="font-semibold">Form link</h2>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-primary underline underline-offset-4"
              >
                {url}
              </a>
              {lan && (
                <p className="mt-2 text-muted-foreground">
                  Uses this computer&apos;s Wi-Fi address so a phone on the same network can open
                  it. Set <code>SITE_URL</code> once the app is deployed.
                </p>
              )}
              {localOnly && (
                <p className="mt-2 text-destructive">
                  Phones can&apos;t open localhost. Connect to Wi-Fi or set <code>SITE_URL</code> to
                  your deployed address.
                </p>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Leads from this code</p>
              <p className="mt-1 text-3xl font-semibold">{formatNumber(mine.length)}</p>
            </section>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
          <h2 className="text-lg font-semibold">Latest from this code</h2>
          {mine.length ? (
            <LeadList leads={mine.slice(0, 20)} qrCodes={[code]} />
          ) : (
            <p className="py-6 text-sm text-muted-foreground">
              No leads yet. Print it and put it up!
            </p>
          )}
        </section>
      </main>
    </div>
  )
}
