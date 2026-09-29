import { existsSync } from "node:fs"
import path from "node:path"
import Link from "next/link"

import LogoMark from "@/components/logo-mark"

// The company logo, when one has been added at public/logo.png. Checked once per server start.
const hasCompanyLogo = existsSync(path.join(process.cwd(), "public", "logo.png"))

// `compact` hides the app name on small screens, where it crowds the header. `large` is for the
// sign-in page, where the company logo stands on its own.
export default function BrandLogo({
  href = "/",
  compact = false,
  large = false,
}: {
  href?: string
  compact?: boolean
  large?: boolean
}) {
  const name = (
    <span className={compact ? "hidden sm:inline" : undefined}>One Marketing Command Center</span>
  )

  if (hasCompanyLogo && large) {
    return (
      <Link href={href} aria-label="One Marketing Command Center" className="flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Twin Home Buyer" className="h-auto w-72 max-w-full" />
        <span className="text-sm font-medium text-muted-foreground">Marketing Command Center</span>
      </Link>
    )
  }

  if (hasCompanyLogo) {
    return (
      <Link
        href={href}
        aria-label="One Marketing Command Center"
        className="flex items-center gap-3 font-semibold tracking-tight whitespace-nowrap"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Twin Home Buyer" className="h-12 w-auto shrink-0" />
        <span className={compact ? "hidden border-l pl-3 text-sm text-muted-foreground lg:inline" : "border-l pl-3 text-sm text-muted-foreground"}>
          Marketing Command Center
        </span>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      aria-label="One Marketing Command Center"
      className="flex items-center gap-2.5 font-semibold tracking-tight whitespace-nowrap"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 via-pink-500 to-violet-600 text-white shadow-md shadow-pink-500/30">
        <LogoMark className="size-5" />
      </span>
      {name}
    </Link>
  )
}
