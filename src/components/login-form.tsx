"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleAlert } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { DEMO_ACCOUNT } from "@/lib/demo-account"

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
})

type LoginDetails = z.infer<typeof loginSchema>

const inputClass = "h-12 rounded-xl bg-card px-4 text-base shadow-xs md:text-base"

export default function LoginForm() {
  const router = useRouter()
  const [failed, setFailed] = useState(false)

  const form = useForm<LoginDetails>({
    resolver: zodResolver(loginSchema),
    // Pre-filled with the demo account so demos are one click.
    defaultValues: { ...DEMO_ACCOUNT },
  })

  function onSubmit({ email, password }: LoginDetails) {
    const ok =
      email.trim().toLowerCase() === DEMO_ACCOUNT.email && password === DEMO_ACCOUNT.password
    if (ok) {
      router.push("/dashboard")
    } else {
      setFailed(true)
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      onChange={() => setFailed(false)}
      className="flex flex-col gap-6"
      noValidate
    >
      <FieldGroup className="gap-5">
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                {...field}
                id="email"
                type="email"
                placeholder="you@business.com"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
                className={inputClass}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                {...field}
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
                className={inputClass}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>

      <Button type="submit" size="lg" className="h-12 rounded-xl text-base">
        Log in
      </Button>

      {failed && (
        <p role="alert" className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          That email and password don&apos;t match. Use the demo account below.
        </p>
      )}

      <p className="text-center text-sm text-muted-foreground">
        New to One Marketing Command Center?{" "}
        <Link href="/setup" className="font-medium text-foreground underline underline-offset-4">
          Get started
        </Link>
      </p>
    </form>
  )
}
