"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

// Keeps the Leads page current: every few seconds it asks the app whether anything changed (a new
// website lead, a status, a Google Ads result) and reloads the page's data only then. Pauses
// while the tab is in the background.
export default function LiveRefresh({ version, seconds = 10 }: { version: string; seconds?: number }) {
  const router = useRouter()
  const shown = useRef(version)
  useEffect(() => {
    shown.current = version
  }, [version])
  useEffect(() => {
    let busy = false
    const tick = async () => {
      if (busy || document.visibilityState !== "visible") return
      busy = true
      try {
        const res = await fetch("/api/leads/changes", { cache: "no-store" })
        const { version: now } = (await res.json()) as { version?: string }
        if (now && now !== shown.current) {
          shown.current = now
          router.refresh()
        }
      } catch {
        // Offline for a moment: try again next time.
      } finally {
        busy = false
      }
    }
    const timer = setInterval(tick, seconds * 1000)
    document.addEventListener("visibilitychange", tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [router, seconds])
  return null
}
