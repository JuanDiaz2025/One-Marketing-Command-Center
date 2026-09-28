import type { Platform } from "@/lib/setup"

// Tailwind classes and CSS colors for each ad platform, backed by --platform-* in globals.css.
export const platformBg: Record<Platform, string> = {
  meta: "bg-platform-meta",
  google: "bg-platform-google",
}

export const platformStroke: Record<Platform, string> = {
  meta: "var(--platform-meta)",
  google: "var(--platform-google)",
}
