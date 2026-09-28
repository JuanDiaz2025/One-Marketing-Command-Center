import type { Metadata } from "next"
import Link from "next/link"

import AppHeader from "@/components/app-header"
import QrCodeForm from "@/components/conversions/qr-code-form"
import { createQrCodeAction } from "@/lib/conversions/actions"
import { DEFAULT_OFFER } from "@/lib/conversions/qr-schema"
import { demoBusiness, demoPhotos } from "@/lib/demo"

export const metadata: Metadata = { title: "Create QR code · AdPilot" }

export default function NewQrCodePage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/conversions" />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <Link href="/conversions" className="text-sm text-muted-foreground hover:text-foreground">
          ← Conversion feed
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Create a QR code</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Put it where customers pay. When they scan it and add their email or phone number, you get
          an in-store conversion, matched to the ad that brought them in.
        </p>
        <div className="mt-8">
          <QrCodeForm
            action={createQrCodeAction}
            defaults={{
              businessName: demoBusiness.businessName,
              placement: "Front counter",
              ...DEFAULT_OFFER,
            }}
            photos={demoPhotos}
            submitLabel="Create QR code"
            suggestedFor={demoBusiness.businessName}
          />
        </div>
      </main>
    </div>
  )
}
