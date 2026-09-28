import Link from "next/link"

import LogoMark from "@/components/logo-mark"

// `compact` shows only the mark on small screens, where the full name crowds the header.
export default function BrandLogo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link
      href={href}
      aria-label="One Marketing Command Center"
      className="flex items-center gap-2.5 font-semibold tracking-tight whitespace-nowrap"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 via-pink-500 to-violet-600 text-white shadow-md shadow-pink-500/30">
        <LogoMark className="size-5" />
      </span>
      <span className={compact ? "hidden sm:inline" : undefined}>One Marketing Command Center</span>
    </Link>
  )
}
