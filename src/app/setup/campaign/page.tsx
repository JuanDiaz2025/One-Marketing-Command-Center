"use client"

import dynamic from "next/dynamic"

// The campaign step reads the in-memory setup draft, so it only renders in the browser.
const CampaignStep = dynamic(() => import("@/components/setup/campaign-step"), { ssr: false })

export default function CampaignPage() {
  return <CampaignStep />
}
