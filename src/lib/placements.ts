import type { ChannelFormat, Platform } from "@/lib/setup"

// Every ad placement One Marketing Command Center can use, shared by the campaign plan, the conversion feed, and the
// dashboard so they all name and draw placements the same way.
export const placements = [
  {
    id: "ig-reels",
    platform: "meta",
    name: "Instagram Reels",
    format: "vertical",
    formatLabel: "Vertical video · 9:16",
  },
  {
    id: "ig-stories",
    platform: "meta",
    name: "Instagram Stories",
    format: "vertical",
    formatLabel: "Full-screen story · 9:16",
  },
  {
    id: "fb-feed",
    platform: "meta",
    name: "Facebook Feed",
    format: "feed",
    formatLabel: "Feed post · 4:5",
  },
  {
    id: "google-search",
    platform: "google",
    name: "Google Search",
    format: "search",
    formatLabel: "Text ad",
  },
  {
    id: "google-maps",
    platform: "google",
    name: "Google Maps",
    format: "map",
    formatLabel: "Promoted pin",
  },
  {
    id: "yt-shorts",
    platform: "google",
    name: "YouTube Shorts",
    format: "vertical",
    formatLabel: "Vertical video · 9:16",
  },
] as const satisfies ReadonlyArray<{
  id: string
  platform: Platform
  name: string
  format: ChannelFormat
  formatLabel: string
}>

export type Placement = (typeof placements)[number]
export type PlacementId = Placement["id"]

export function placement(id: PlacementId): Placement {
  return placements.find((p) => p.id === id)!
}
