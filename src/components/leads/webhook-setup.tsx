import { headers } from "next/headers"
import { CircleAlert, CircleCheck, Globe, TriangleAlert } from "lucide-react"

import CopyButton from "@/components/dashboard/copy-button"
import Disclosure from "@/components/ui/disclosure"
import InboxForm from "@/components/leads/inbox-form"
import { timeAgo } from "@/components/leads/lead-list"
import { getInbox, inboxScript, inboxWebhookAddress } from "@/lib/leads/inbox"
import { tunnelUrl, webhookSecret } from "@/lib/leads/webhook"
import { recentAttempts, type WebhookAttempt } from "@/lib/leads/webhook-log"
import { CF7_HIDDEN_FIELDS, TRACKING_SNIPPET } from "@/lib/leads/wordpress-snippets"
import { cn } from "@/lib/utils"

// Google Ads fills in {campaignid}, {keyword} and {creative} for each click.
const FINAL_URL_SUFFIX = "utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}&utm_content={creative}"

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

function describe(a: WebhookAttempt) {
  if (a.result === "lead") return `Lead received: ${a.lead ?? "website lead"}`
  if (a.result === "test") return "Connection test: OK"
  if (a.result === "wrong-key") return "Turned away: the key in the address was wrong or missing. Copy the address above again."
  return `Turned away: no name, phone or email found. The form sent: ${a.fields?.length ? a.fields.join(", ") : "no fields"}.`
}

// Where to point the WordPress form webhook, with the key it has to send, and what arrived lately.
// Stays open until the inbox has delivered a lead, so its address is in view while setting it up.
export default async function WebhookSetup({ websiteLeads, inboxLeads }: { websiteLeads: number; inboxLeads: number }) {
  const h = await headers()
  const configured = process.env.SITE_URL?.replace(/\/$/, "")
  const tunnel = configured ? null : await tunnelUrl()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:4000"
  const origin = configured || tunnel || `${h.get("x-forwarded-proto") ?? "http"}://${host}`
  const url = `${origin}/api/leads/webhook?key=${encodeURIComponent(await webhookSecret())}`
  const localOnly = !configured && !tunnel && LOCAL.test(host)
  const attempts = await recentAttempts()
  const inbox = await getInbox()
  const inboxAddress = await inboxWebhookAddress()
  const script = inboxScript(await webhookSecret())

  return (
    <Disclosure className="group rounded-2xl border bg-card shadow-xs" initialOpen={websiteLeads === 0 || inboxLeads === 0}>
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
      <div className="flex flex-col gap-5 border-t px-5 py-5 text-sm sm:px-6">
        <section
          className={cn(
            "flex flex-col gap-3 rounded-xl border-2 p-4",
            inbox.url && !inbox.lastError ? "border-emerald-500/40 bg-emerald-500/5" : "border-primary/40 bg-primary/5",
          )}
        >
          <div>
            <p className="text-base font-semibold">
              {inbox.url ? "Lead inbox: on" : "Recommended: the lead inbox, so no lead is ever missed"}
            </p>
            <p className="text-muted-foreground">
              WordPress sends every lead to a Google Sheet that&apos;s always online, with an address that never changes. The app
              brings them in whenever it&apos;s open, so leads sent while this computer was off or during an update still show up
              here, with the time they were really sent.
            </p>
          </div>

          {inbox.url && inboxAddress && (
            <div className="flex flex-col gap-2">
              <p className="font-medium">Put this address in WordPress (Contact Form 7 → your form → Webhook tab). It never changes:</p>
              <code className="block rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all">{inboxAddress}</code>
              <div>
                <CopyButton text={inboxAddress} label="Copy inbox address for WordPress" />
              </div>
              <p className={cn(inbox.lastError ? "text-destructive" : "text-muted-foreground")}>
                {inbox.lastError
                  ? `Couldn't read the inbox: ${inbox.lastError}`
                  : inbox.lastSync
                    ? `Checked for new leads ${timeAgo(inbox.lastSync)}. It checks every 30 seconds while this page is open.`
                    : "Not checked yet."}
              </p>
            </div>
          )}

          <Disclosure className="rounded-lg border bg-card p-3" initialOpen={!inbox.url}>
            <summary className="cursor-pointer font-medium">{inbox.url ? "Set-up steps" : "Set it up (about 5 minutes, once)"}</summary>
            <ol className="mt-2 list-decimal space-y-3 pl-5 text-muted-foreground">
              <li>
                Open <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-primary underline">sheets.new</a>{" "}
                (signed in with your company Google account) and name the sheet &ldquo;Command Center leads&rdquo;.
              </li>
              <li>
                In the sheet, click <strong>Extensions → Apps Script</strong>. Delete what&apos;s there, paste this script (it already has
                your key), and click the <strong>Save</strong> icon.
                <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-muted px-3 py-2 font-mono text-[11px] text-foreground">{script}</pre>
                <div className="mt-2">
                  <CopyButton text={script} label="Copy the script" />
                </div>
              </li>
              <li>
                Click <strong>Deploy → New deployment</strong>, click the gear and choose <strong>Web app</strong>. Set{" "}
                <strong>Execute as: Me</strong> and <strong>Who has access: Anyone</strong>, then <strong>Deploy</strong>. Allow the
                access Google asks for (choose your account, then <strong>Advanced → Go to … (unsafe) → Allow</strong>; it&apos;s your
                own script). Copy the <strong>Web app URL</strong>.
              </li>
              <li>Paste it below and click Save.</li>
              <li>
                Copy the inbox address that appears above into Contact Form 7&apos;s <strong>Webhook</strong> tab (replacing any
                localhost or trycloudflare address), save, and submit a test lead.
              </li>
            </ol>
            <div className="mt-3">
              <InboxForm current={inbox.url} />
            </div>
          </Disclosure>
        </section>

        {!inbox.url && localOnly && (
          <div className="flex gap-2 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-4 text-amber-950">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="flex flex-col gap-2">
              <p className="font-semibold">
                WordPress can&apos;t reach this address yet: &ldquo;localhost&rdquo; means this computer, and
                your website runs somewhere else.
              </p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  Keep the app running, open the app folder, and double-click <strong>go-online.bat</strong>.
                </li>
                <li>
                  It gives the app a public address, and shows and copies the full webhook address (it starts
                  with <code className="font-mono">https://</code> and ends in <code className="font-mono">trycloudflare.com/…</code>).
                </li>
                <li>Paste that into WordPress instead of the localhost address, save, and submit a test lead.</li>
              </ol>
              <p className="text-amber-900/80">
                Leads arrive while that window and the app are running. The address changes each time you
                start go-online.bat, so paste the new one into WordPress each time. To stop that, the app can be
                put online for good; the README explains how.
              </p>
            </div>
          </div>
        )}

        {tunnel && (
          <p className="flex gap-2 rounded-xl bg-emerald-500/10 p-3 text-emerald-900">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span>
              Online through go-online.bat. This address works while its window is open, and changes the next
              time you run it: paste the new one into WordPress then.
            </span>
          </p>
        )}

        <div className="flex flex-col gap-2">
          <p className="font-medium">
            {inbox.url ? "Other way: send leads straight to this computer (only while the app is running)" : "Webhook address (straight to this computer)"}
          </p>
          <code className="block rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all">{url}</code>
          <div>
            <CopyButton text={url} label="Copy webhook address" />
          </div>
          <p className="text-muted-foreground">
            The part after <code className="font-mono">key=</code> is the secret that keeps others from sending fake leads.
            Treat it like a password.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-medium">What WordPress sent lately</p>
          {attempts.length ? (
            <ul className="flex flex-col gap-1.5">
              {attempts.map((a) => (
                <li key={a.at} className="flex items-start gap-2">
                  {a.ok ? (
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <span className={cn(!a.ok && "text-destructive")}>
                    <span className="text-muted-foreground">{timeAgo(a.at)} · </span>
                    {describe(a)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              Nothing yet. If you submitted a form and nothing shows here, WordPress couldn&apos;t reach the
              app{localOnly ? " (see the yellow box above)" : ""}.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <p className="font-medium">Contact Form 7</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>
              In WordPress, open <strong>Plugins → Add New</strong>, search for <strong>CF7 to Webhook</strong>,
              then install and activate it.
            </li>
            <li>
              Open <strong>Contact → Contact Forms</strong>, edit your form, and open its new <strong>Webhook</strong> tab.
            </li>
            <li>Tick the box to send to a webhook, paste the webhook address, and save.</li>
            <li>
              Keep the usual field names (<code className="font-mono">your-name</code>,{" "}
              <code className="font-mono">your-email</code>, <code className="font-mono">your-phone</code>,{" "}
              <code className="font-mono">your-message</code>; address fields named address). Other fields go into the
              lead&apos;s notes.
            </li>
            <li>Submit the form once as a test. The lead shows up in the list above, marked Website.</li>
          </ol>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-medium">Track where each lead came from (UTM source, campaign, keyword, Google click)</p>
          <ol className="list-decimal space-y-3 pl-5 text-muted-foreground">
            <li>
              <span>
                In Contact Form 7, edit your form and paste these hidden fields anywhere in the <strong>Form</strong> tab,
                then save. Visitors don&apos;t see them.
              </span>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">{CF7_HIDDEN_FIELDS}</pre>
              <div className="mt-2">
                <CopyButton text={CF7_HIDDEN_FIELDS} label="Copy hidden fields" />
              </div>
            </li>
            <li>
              <span>
                Add this snippet to every page of the site: install the free <strong>WPCode</strong> plugin, open{" "}
                <strong>Code Snippets → Header &amp; Footer</strong>, paste it into <strong>Footer</strong>, and save. It
                remembers the UTM tags and Google click ID from the ad a visitor came in on, even if they browse other
                pages first, and fills in the hidden fields.
              </span>
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">{TRACKING_SNIPPET}</pre>
              <div className="mt-2">
                <CopyButton text={TRACKING_SNIPPET} label="Copy tracking snippet" />
              </div>
            </li>
            <li>
              In Google Ads, make sure <strong>Admin → Account settings → Auto-tagging</strong> is on (it adds the Google
              click ID). To also fill UTM columns for ad clicks, set{" "}
              <strong>Admin → Account settings → Tracking → Final URL suffix</strong> to:
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">{FINAL_URL_SUFFIX}</pre>
              <div className="mt-2">
                <CopyButton text={FINAL_URL_SUFFIX} label="Copy URL suffix" />
              </div>
            </li>
            <li>For other links (Facebook, email, postcards with a web address), add your own ?utm_source=…&amp;utm_medium=… tags.</li>
          </ol>
        </div>

        <div className="flex flex-col gap-1">
          <p className="font-medium">Other form plugins</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Elementor: the form&apos;s Actions After Submit → Webhook. WPForms or Gravity Forms: their webhook add-on.</li>
            <li>Paste the webhook address, method POST. JSON or a regular form post both work.</li>
            <li>Send name (or first and last name), phone, email, property address and message.</li>
          </ol>
        </div>
      </div>
    </Disclosure>
  )
}
