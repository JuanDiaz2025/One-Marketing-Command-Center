"use client"

import { useState, useTransition } from "react"
import { Smartphone, X } from "lucide-react"
import QRCode from "qrcode"

import CopyButton from "@/components/dashboard/copy-button"
import { Button } from "@/components/ui/button"
import { createDeviceLinkAction } from "@/lib/auth/device-link-actions"

// "Open on another device": a one-time sign-in link (and QR code for a phone) for go-online.bat's
// address, where Google sign-in can't work.
export default function DeviceLinkButton() {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<{ url?: string; qr?: string; error?: string } | null>(null)
  const [pending, start] = useTransition()

  const make = () =>
    start(async () => {
      const res = await createDeviceLinkAction()
      const qr = res.url ? await QRCode.toDataURL(res.url, { margin: 1, width: 220 }).catch(() => undefined) : undefined
      setResult({ ...res, qr })
    })

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="lg"
        title="Open the app on your phone or another computer"
        onClick={() => {
          setOpen(!open)
          if (!open) make()
        }}
      >
        <Smartphone data-icon="inline-start" />
        <span className="hidden lg:inline">Open on another device</span>
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 flex w-80 flex-col gap-3 rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold">Open on your phone or another computer</p>
            <button type="button" aria-label="Close" className="text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </button>
          </div>
          {pending && <p className="text-muted-foreground">Making a sign-in link…</p>}
          {!pending && result?.error && <p className="text-destructive">{result.error}</p>}
          {!pending && result?.url && (
            <>
              {result.qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.qr} alt="QR code of the sign-in link" className="mx-auto size-44 rounded-lg bg-white p-1" />
              )}
              <p className="text-muted-foreground">
                Scan it with your phone&apos;s camera, or copy the link to the other computer. It signs that device in as you, works
                once, and expires in 15 minutes. Don&apos;t share it with anyone outside your team.
              </p>
              <CopyButton text={result.url} label="Copy link" />
              <Button type="button" variant="ghost" size="sm" onClick={make}>
                Make a new link
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
