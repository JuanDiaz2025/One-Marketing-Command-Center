"use client"

import { useState, useTransition, type CSSProperties } from "react"
import { CircleCheck, Mail, Phone, Receipt, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { claimOfferAction } from "@/lib/conversions/actions"
import { priceOrder } from "@/lib/conversions/menu"
import { qrTheme, type OrderItem, type QrCode } from "@/lib/conversions/types"

export type QrLandingContent = Pick<
  QrCode,
  "businessName" | "headline" | "percentOff" | "offerItem" | "message" | "headerPhoto" | "theme"
>

type QrLandingProps = {
  content: QrLandingContent
  // What was just rung up at the register.
  items: OrderItem[]
  // Live pages claim the offer through the server; previews just show the result.
  live?: { qrCodeId: string; orderSeed: number }
}

const usd = (n: number) => `$${n.toFixed(2)}`

type Claimed = {
  items: OrderItem[]
  subtotal: number
  discount: number
  total: number
  firstVisit: boolean
}

// The page customers see after scanning a QR code: the offer, their order pulled from the
// register, and an email or phone number to claim the discount.
export default function QrLanding({ content, items, live }: QrLandingProps) {
  const theme = qrTheme(content.theme)
  const [contactType, setContactType] = useState<"email" | "phone">("email")
  const [contact, setContact] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [claimed, setClaimed] = useState<Claimed | null>(null)
  const [pending, startTransition] = useTransition()
  const price = priceOrder(items, content.percentOff)

  function claim() {
    if (!contact.trim()) {
      setErrors({ email: "Add your email or phone number to get the discount." })
      return
    }
    if (!live) {
      setClaimed({ items, ...price, firstVisit: true })
      return
    }
    startTransition(async () => {
      const result = await claimOfferAction(live.qrCodeId, {
        email: contactType === "email" ? contact : "",
        phone: contactType === "phone" ? contact : "",
        orderSeed: live.orderSeed,
      })
      if (result.ok) {
        setClaimed(result)
        window.scrollTo({ top: 0 })
      } else {
        setErrors(result.errors)
      }
    })
  }

  const Container = live ? "form" : "div"
  const themeVars = { "--qr": theme.primary, "--qr-soft": theme.soft } as CSSProperties
  const error = errors.email ?? errors.phone ?? errors.form

  return (
    <div style={themeVars} className="flex min-h-full flex-col bg-white text-neutral-900">
      <header className="relative h-44 shrink-0 overflow-hidden bg-neutral-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={content.headerPhoto} alt="" className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 p-4 text-white">
          <span className="flex size-9 items-center justify-center rounded-full bg-[var(--qr)] text-base font-bold shadow-md">
            {content.businessName.charAt(0).toUpperCase() || "?"}
          </span>
          <span className="text-lg font-semibold drop-shadow">
            {content.businessName || "Your business"}
          </span>
        </div>
      </header>

      {claimed ? (
        <div className="flex flex-col items-center gap-5 px-5 py-8 text-center" role="status">
          <CircleCheck className="size-16 text-[var(--qr)]" />
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {claimed.firstVisit ? `${content.percentOff}% off applied` : "Welcome back!"}
            </h1>
            <p className="text-neutral-600">
              {claimed.firstVisit
                ? `You saved ${usd(claimed.discount)}. Show this screen at the counter.`
                : "Your first-visit discount was already used, but we've saved today's order to your account."}
            </p>
          </div>
          <OrderSummary
            {...claimed}
            percentOff={content.percentOff}
            offerItem={content.offerItem}
          />
          <p className="text-sm text-neutral-500">See you soon at {content.businessName}.</p>
          {!live && (
            <button
              type="button"
              onClick={() => setClaimed(null)}
              className="text-sm font-medium text-[var(--qr)] underline underline-offset-4"
            >
              Back to the offer
            </button>
          )}
        </div>
      ) : (
        // Previews sit inside other forms, so only the live page renders a real <form>.
        <Container
          {...(live
            ? {
                onSubmit: (e: React.FormEvent) => {
                  e.preventDefault()
                  claim()
                },
                noValidate: true,
              }
            : {})}
          className="flex flex-col gap-5 px-5 py-6"
        >
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--qr-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--qr)]">
              <Sparkles className="size-3" />
              Welcome offer
            </span>
            <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance">
              {content.headline || "Your offer"}
            </h1>
            {content.message && <p className="text-neutral-600">{content.message}</p>}
          </div>

          <OrderSummary
            items={items}
            {...price}
            percentOff={content.percentOff}
            offerItem={content.offerItem}
            fromRegister
          />

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 font-semibold">
              Email or phone number <span className="text-[var(--qr)]">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 text-sm font-medium">
              {(
                [
                  { value: "email", label: "Email", icon: Mail },
                  { value: "phone", label: "Phone", icon: Phone },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 transition-all",
                    contactType === value ? "bg-white shadow-sm" : "text-neutral-500",
                  )}
                >
                  <input
                    type="radio"
                    name="contactType"
                    checked={contactType === value}
                    onChange={() => {
                      setContactType(value)
                      setContact("")
                      setErrors({})
                    }}
                    className="sr-only"
                  />
                  <Icon className="size-4" />
                  {label}
                </label>
              ))}
            </div>
            <input
              value={contact}
              onChange={(e) => {
                setContact(e.target.value)
                setErrors({})
              }}
              type={contactType === "email" ? "email" : "tel"}
              inputMode={contactType === "email" ? "email" : "tel"}
              autoComplete={contactType === "email" ? "email" : "tel"}
              placeholder={contactType === "email" ? "you@example.com" : "(415) 555-0123"}
              aria-label={contactType === "email" ? "Email" : "Phone number"}
              aria-invalid={Boolean(error)}
              className={cn(
                "h-13 w-full rounded-xl border bg-white px-4 text-base outline-none focus-visible:ring-3",
                error
                  ? "border-red-500 focus-visible:ring-red-500/20"
                  : "border-neutral-300 focus-visible:border-[var(--qr)] focus-visible:ring-[var(--qr)]/20",
              )}
            />
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </fieldset>

          <button
            type={live ? "submit" : "button"}
            onClick={live ? undefined : claim}
            disabled={pending}
            className="h-14 rounded-xl bg-[var(--qr)] text-lg font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
          >
            {pending ? "Applying…" : `Get ${content.percentOff}% off`}
          </button>
          <p className="text-center text-xs text-neutral-500">
            We&apos;ll send your receipt and the occasional offer. Unsubscribe anytime.
          </p>
        </Container>
      )}

      <p className="mt-auto pb-5 text-center text-xs text-neutral-400">Powered by One Marketing Command Center</p>
    </div>
  )
}

function OrderSummary({
  items,
  subtotal,
  discount,
  total,
  percentOff,
  offerItem,
  fromRegister,
}: {
  items: OrderItem[]
  subtotal: number
  discount: number
  total: number
  percentOff: number
  offerItem: string
  fromRegister?: boolean
}) {
  return (
    <div className="w-full rounded-2xl bg-[var(--qr-soft)] p-4 text-left">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Receipt className="size-4 text-[var(--qr)]" />
        Your order
        {fromRegister && (
          <span className="ml-auto text-xs font-normal text-neutral-500">From the register</span>
        )}
      </p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex justify-between gap-3">
            <span>{item.name}</span>
            <span className="tabular-nums">{usd(item.price)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-col gap-1 border-t border-black/10 pt-3 text-sm">
        <p className="flex justify-between text-neutral-600">
          <span>Subtotal</span>
          <span className="tabular-nums">{usd(subtotal)}</span>
        </p>
        {discount > 0 && (
          <p className="flex justify-between font-medium text-[var(--qr)]">
            <span>
              {percentOff}% off your first {offerItem}
            </span>
            <span className="tabular-nums">−{usd(discount)}</span>
          </p>
        )}
        <p className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{usd(total)}</span>
        </p>
      </div>
    </div>
  )
}
