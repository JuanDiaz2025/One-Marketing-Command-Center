"use client"

import Link from "next/link"
import { useState } from "react"
import QRCode from "qrcode"
import { Check, Copy, FileDown, ImageDown, Printer } from "lucide-react"

import { buildPosterPdf } from "@/lib/conversions/poster-pdf"
import { Button, buttonVariants } from "@/components/ui/button"

function download(href: string, filename: string) {
  const a = document.createElement("a")
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "qr-code"

export default function QrDownloads({
  qrCodeId,
  url,
  name,
  message,
}: {
  qrCodeId: string
  url: string
  name: string
  message: string
}) {
  const [copied, setCopied] = useState(false)

  async function downloadPng() {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 1200,
      margin: 2,
      errorCorrectionLevel: "M",
    })
    download(dataUrl, `${slug(name)}-qr.png`)
  }

  function downloadPdf() {
    const href = URL.createObjectURL(buildPosterPdf({ url, title: name, message }))
    download(href, `${slug(name)}-poster.pdf`)
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Button variant="outline" size="lg" className="h-11" onClick={downloadPng}>
          <ImageDown data-icon="inline-start" />
          QR code (PNG)
        </Button>
        <Button variant="outline" size="lg" className="h-11" onClick={downloadPdf}>
          <FileDown data-icon="inline-start" />
          Poster (PDF)
        </Button>
        <Link
          href={`/conversions/qr/${qrCodeId}/poster`}
          className={buttonVariants({ size: "lg", className: "h-11" })}
        >
          <Printer data-icon="inline-start" />
          Print poster
        </Link>
      </div>
      <button
        type="button"
        onClick={copyLink}
        className="flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  )
}
