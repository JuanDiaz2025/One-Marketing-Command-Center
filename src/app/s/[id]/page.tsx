import type { Metadata, Viewport } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"

import QrLanding from "@/components/conversions/qr-landing"
import { currentOrder, currentOrderSeed } from "@/lib/conversions/menu"
import { getQrCode } from "@/lib/conversions/store"

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const code = await getQrCode((await params).id)
  return {
    title: code ? `${code.headline} · ${code.businessName}` : "Offer",
    robots: { index: false },
  }
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 }

// The page a customer's phone opens after scanning a QR code in the store.
export default async function QrOfferPage({ params }: PageProps<"/s/[id]">) {
  await connection()
  const code = await getQrCode((await params).id)
  if (!code) notFound()

  if (!code.active) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">This offer has ended</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Thanks for stopping by {code.businessName}!
        </p>
      </main>
    )
  }

  // What's being rung up at the register right now.
  const orderSeed = currentOrderSeed()
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col bg-white">
      <QrLanding
        content={code}
        items={currentOrder(orderSeed)}
        live={{ qrCodeId: code.id, orderSeed }}
      />
    </main>
  )
}
