import { headers } from "next/headers"
import { Globe, TriangleAlert } from "lucide-react"

import CopyButton from "@/components/dashboard/copy-button"
import { webhookSecret } from "@/lib/leads/webhook"

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

// Where to point the WordPress form webhook, with the key it has to send.
export default async function WebhookSetup({ websiteLeads }: { websiteLeads: number }) {
  const h = await headers()
  const configured = process.env.SITE_URL?.replace(/\/$/, "")
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:4000"
  const origin = configured || `${h.get("x-forwarded-proto") ?? "http"}://${host}`
  const url = `${origin}/api/leads/webhook?key=${await webhookSecret()}`
  const localOnly = !configured && LOCAL.test(host)

  return (
    <details className="group rounded-2xl border bg-card shadow-xs" open={websiteLeads === 0}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5 sm:px-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Globe className="size-5" />
        </span>
        <span className="flex flex-col">
          <span className="text-lg font-semibold">Website leads (WordPress)</span>
          <span className="text-sm text-muted-foreground">
            {websiteLeads
              ? `${websiteLeads} lead${websiteLeads === 1 ? "" : "s"} from the website so far. Click to see the connection details.`
              : "Send your website form leads here with a webhook."}
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t px-5 py-5 text-sm sm:px-6">
        <div className="flex flex-col gap-2">
          <p className="font-medium">Webhook address</p>
          <code className="block rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all">{url}</code>
          <div>
            <CopyButton text={url} label="Copy webhook address" />
          </div>
          <p className="text-muted-foreground">
            The part after <code className="font-mono">key=</code> is the secret that keeps others from sending fake leads.
            Treat it like a password.
          </p>
        </div>

        {localOnly && (
          <p className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              This address only works on this computer, so WordPress can&apos;t reach it yet. Once the app
              is online, set <code className="font-mono">SITE_URL</code> and this address updates
              itself. The README explains the options.
            </span>
          </p>
        )}

        <div className="flex flex-col gap-1">
          <p className="font-medium">In WordPress</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Open your form&apos;s webhook settings (in Elementor: the form&apos;s Actions After Submit → Webhook; in WPForms, Gravity Forms or Contact Form 7: their webhook add-on).</li>
            <li>Paste the webhook address above, method POST. JSON or a regular form post both work.</li>
            <li>Send the fields you have: name (or first and last name), phone, email, property address, message. Other fields are kept in the lead&apos;s notes.</li>
            <li>Submit your form once as a test. The lead shows up in the list above, marked Website.</li>
          </ol>
        </div>
      </div>
    </details>
  )
}
