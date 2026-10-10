"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={async () => {
        // The browser can refuse (an http address or a blocked permission): then nothing happens.
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          return
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
      {copied ? "Copied" : label}
    </Button>
  )
}
