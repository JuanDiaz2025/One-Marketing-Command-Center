import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"

import AppHeader from "@/components/app-header"
import QrCodeForm from "@/components/conversions/qr-code-form"
import { updateQrCodeAction } from "@/lib/conversions/actions"
import { getQrCode } from "@/lib/conversions/store"
import { demoPhotos } from "@/lib/demo"

export const metadata: Metadata = { title: "Edit QR code · AdPilot" }

export default async function EditQrCodePage({ params }: PageProps<"/conversions/qr/[id]/edit">) {
  await connection()
  const { id } = await params
  const code = await getQrCode(id)
  if (!code) notFound()

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/conversions" />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <Link
          href={`/conversions/qr/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {code.placement}
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Edit QR code</h1>
        <p className="mt-2 text-muted-foreground">
          The code itself stays the same, so posters you already printed keep working.
        </p>
        <div className="mt-8">
          <QrCodeForm
            action={updateQrCodeAction.bind(null, id)}
            defaults={code}
            photos={demoPhotos}
            submitLabel="Save changes"
          />
        </div>
      </main>
    </div>
  )
}
