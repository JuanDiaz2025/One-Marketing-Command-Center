import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import AppHeader from "@/components/app-header"
import QrCodeForm from "@/components/leads/qr-code-form"
import { requireSession } from "@/lib/auth/session"
import { updateQrCodeAction } from "@/lib/leads/actions"
import { getQrCode } from "@/lib/leads/store"

export const metadata: Metadata = { title: "Edit QR code · One Marketing Command Center" }

export default async function EditQrCodePage({ params }: PageProps<"/leads/qr/[id]/edit">) {
  const { id } = await params
  const user = await requireSession(`/leads/qr/${id}/edit`)
  const code = await getQrCode(id)
  if (!code) notFound()

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/leads" user={user} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <Link href={`/leads/qr/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {code.placement}
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Edit QR code</h1>
        <p className="mt-2 text-muted-foreground">
          The code itself stays the same, so signs you already printed keep working.
        </p>
        <div className="mt-8">
          <QrCodeForm
            action={updateQrCodeAction.bind(null, id)}
            defaults={code}
            submitLabel="Save changes"
          />
        </div>
      </main>
    </div>
  )
}
