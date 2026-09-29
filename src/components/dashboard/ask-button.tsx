"use client"

import { MessageSquareText } from "lucide-react"

import { Button } from "@/components/ui/button"

export const ASK_EVENT = "assistant:ask"

// Sends a question to the assistant on the same page and scrolls to it.
export default function AskButton({ question }: { question: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: question }))
        document.getElementById("assistant")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }}
    >
      <MessageSquareText data-icon="inline-start" />
      Ask how to fix
    </Button>
  )
}
