"use client"

import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function PrintButton() {
  return (
    <Button size="lg" className="h-11 px-5" onClick={() => window.print()}>
      <Printer data-icon="inline-start" />
      Print poster
    </Button>
  )
}
