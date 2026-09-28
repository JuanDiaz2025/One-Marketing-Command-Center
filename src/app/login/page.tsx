import type { Metadata } from "next"

import BrandLogo from "@/components/brand-logo"
import LoginForm from "@/components/login-form"
import { DEMO_ACCOUNT } from "@/lib/demo-account"

export const metadata: Metadata = {
  title: "Log in · AdPilot",
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <BrandLogo />
        </div>
        <div className="mt-8 rounded-2xl border bg-card p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log in to see how your ads are doing.
          </p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-dashed bg-card/60 p-4 text-center text-sm">
          <p className="font-medium">Demo account</p>
          <p className="mt-1 font-mono text-muted-foreground">
            {DEMO_ACCOUNT.email} / {DEMO_ACCOUNT.password}
          </p>
        </div>
      </div>
    </main>
  )
}
