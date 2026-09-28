import type { Metadata } from "next"
import Link from "next/link"

import AppHeader from "@/components/app-header"
import QrCodeForm from "@/components/leads/qr-code-form"
import { requireSession } from "@/lib/auth/session"
import { createQrCodeAction } from "@/lib/leads/actions"
import { NEW_QR_CODE } from "@/lib/leads/qr-schema"
import { listQrCodes } from "@/lib/leads/store"

export const metadata: Metadata = { title: "Create QR code · One Marketing Command Center" }

export default async function NewQrCodePage() {
  const user = await requireSession("/leads/qr/new")
  // Reuse the business name from the last code so it only has to be typed once.
  const businessName = (await listQrCodes()).at(-1)?.businessName ?? ""

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/leads" user={user} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <Link href="/leads" className="text-sm text-muted-foreground hover:text-foreground">
          ← Leads
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Create a QR code</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Make one for each sign, mailer or flyer, so you can see which one brings in leads.
        </p>
        <div className="mt-8">
          <QrCodeForm
            action={createQrCodeAction}
            defaults={{ ...NEW_QR_CODE, businessName }}
            submitLabel="Create QR code"
          />
        </div>
      </main>
    </div>
  )
}
