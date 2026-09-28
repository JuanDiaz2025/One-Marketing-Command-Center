import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import QRCode from "qrcode"

import PrintButton from "@/components/conversions/print-button"
import { getQrUrl } from "@/lib/conversions/qr-url"
import { getQrCode } from "@/lib/conversions/store"
import { qrTheme } from "@/lib/conversions/types"

export const metadata: Metadata = { title: "Poster · One Marketing Command Center" }

export default async function PosterPage({ params }: PageProps<"/conversions/qr/[id]/poster">) {
  await connection()
  const { id } = await params
  const code = await getQrCode(id)
  if (!code) notFound()
  const { url } = await getQrUrl(id)
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
  const theme = qrTheme(code.theme)

  return (
    <div className="flex flex-1 flex-col items-center bg-muted/40 px-4 py-8 print:bg-white print:p-0">
      <div className="mb-6 flex w-full max-w-[8.5in] items-center justify-between print:hidden">
        <Link
          href={`/conversions/qr/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to QR code
        </Link>
        <PrintButton />
      </div>

      {/* US Letter poster */}
      <article className="flex aspect-[8.5/11] w-full max-w-[8.5in] flex-col items-center justify-between bg-white px-[8%] py-[9%] text-center text-neutral-900 shadow-xl print:max-w-none print:shadow-none">
        <p className="text-[clamp(1rem,2.6vw,1.5rem)] font-medium" style={{ color: theme.primary }}>
          {code.businessName}
        </p>
        <h1 className="text-[clamp(1.75rem,6vw,3.25rem)] leading-tight font-bold tracking-tight text-balance">
          {code.headline}
        </h1>
        <div className="w-[62%] [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <div>
          <p className="text-[clamp(1rem,3vw,1.75rem)] font-semibold">
            Scan with your phone camera
          </p>
          <p className="mt-1 text-[clamp(0.75rem,1.8vw,1rem)] text-neutral-500">{code.message}</p>
        </div>
        <p className="text-xs text-neutral-400">Powered by One Marketing Command Center</p>
      </article>
    </div>
  )
}
