import Link from "next/link"
import { LogOut } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Session } from "@/lib/auth/session"
import { signOutAction } from "@/lib/google/actions"
import BrandLogo from "@/components/brand-logo"
import { Button } from "@/components/ui/button"

const links = [
  { href: "/dashboard", label: "Google Ads" },
  { href: "/leads", label: "Leads" },
] as const

type Current = (typeof links)[number]["href"]

export default function AppHeader({ current, user }: { current: Current; user: Session }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <BrandLogo href="/dashboard" compact />
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
        <div className="flex min-w-0 items-center gap-2">
          {user.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.picture}
              alt=""
              referrerPolicy="no-referrer"
              className="size-8 shrink-0 rounded-full"
            />
          ) : null}
          <span className="hidden truncate text-sm text-muted-foreground md:inline" title={user.email}>
            {user.email}
          </span>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="lg">
              <LogOut data-icon="inline-start" />
              Sign out
            </Button>
          </form>
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
