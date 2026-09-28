import Link from "next/link";
import { ArrowRight } from "lucide-react";

import BrandLogo from "@/components/brand-logo";
import HeroGraphic from "@/components/HeroGraphic";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <BrandLogo compact />
        <nav className="flex items-center gap-2">
          <Link href="/login" className={buttonVariants({ variant: "ghost", size: "lg" })}>
            Log in
          </Link>
          <Link href="/setup" className={buttonVariants({ size: "lg" })}>
            Get started
          </Link>
        </nav>
      </header>

      <main className="relative isolate flex flex-1 items-center overflow-hidden">
        {/* Background decoration */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />

        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 px-6 py-16 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
              More customers.{" "}
              <span className="bg-gradient-to-r from-sky-500 to-violet-600 bg-clip-text text-transparent">
                Zero ad hassle.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground lg:mx-0">
              Ads for small businesses that bring people through your door. Tell us about your
              business and One Marketing Command Center does the rest, from running your Meta and Google ads to moving your
              budget to what works.
            </p>
            <Link
              href="/setup"
              className={buttonVariants({ size: "lg", className: "mt-10 h-12 px-6 text-base" })}
            >
              Get started
              <ArrowRight data-icon="inline-end" />
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
                Log in
              </Link>
            </p>
          </div>

          <HeroGraphic />
        </div>
      </main>
    </div>
  );
}
