import type { Metadata, Viewport } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"

import QrLanding from "@/components/leads/qr-landing"
import { getQrCode } from "@/lib/leads/store"

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const code = await getQrCode((await params).id)
  return {
    title: code ? `${code.headline} · ${code.businessName}` : "Form",
    robots: { index: false },
  }
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 }

// The public page a phone opens after scanning a QR code. No sign-in needed.
export default async function QrFormPage({ params }: PageProps<"/s/[id]">) {
  await connection()
  const code = await getQrCode((await params).id)
  if (!code) notFound()

  if (!code.active) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">This form is closed</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Thanks for your interest in {code.businessName}!
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col bg-white">
      <QrLanding content={code} qrCodeId={code.id} />
    </main>
  )
}
