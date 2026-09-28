import type { Metadata } from "next"

import BrandLogo from "@/components/brand-logo"

export const metadata: Metadata = {
  title: "Set up your campaign · One Marketing Command Center",
}

export default function SetupLayout({ children }: LayoutProps<"/setup">) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandLogo compact />
          <p className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Campaign setup
          </p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:py-14">
        {children}
      </main>
    </div>
  )
}
