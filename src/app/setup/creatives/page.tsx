"use client"

import dynamic from "next/dynamic"

// The creatives step reads the in-memory setup draft and photos, so it only renders in the browser.
const CreativesStep = dynamic(() => import("@/components/setup/creatives-step"), { ssr: false })

export default function CreativesPage() {
  return <CreativesStep />
}
