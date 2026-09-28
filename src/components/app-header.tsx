import Link from "next/link"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import BrandLogo from "@/components/brand-logo"
import { buttonVariants } from "@/components/ui/button"

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/conversions", label: "Conversion feed" },
]

export default function AppHeader({ current }: { current: "/dashboard" | "/conversions" }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <BrandLogo href="/dashboard" />
          <nav aria-label="Main" className="hidden items-center gap-1 text-sm sm:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={current === l.href ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                  current === l.href && "bg-muted font-medium text-foreground",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className={buttonVariants({ variant: "ghost", size: "lg" })}>
            Log in
          </Link>
          <Link href="/setup" className={buttonVariants({ size: "lg" })}>
            <Plus data-icon="inline-start" />
            New campaign
          </Link>
        </div>
      </div>
      {/* Small screens: main links on their own row */}
      <nav aria-label="Main" className="flex gap-1 border-t border-border/70 px-4 py-1.5 text-sm sm:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current === l.href ? "page" : undefined}
            className={cn("rounded-md px-2.5 py-1 text-muted-foreground", current === l.href && "bg-muted font-medium text-foreground")}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
