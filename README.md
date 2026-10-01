# One Marketing Command Center

Your Google Ads results, website leads and phone calls in one place.

- **Sign in with Google.** Only the Google accounts you allow can get in.
- **Google Ads dashboard.** Connect your Google Ads account to see spend, clicks, conversions and cost per conversion, by day and by campaign, for the last 7, 30 or 90 days, all time, or exact dates picked on the calendar. It reads your real account through the Google Ads API. The only changes it ever makes in Google Ads are the lead-quality conversions described under Leads.
- **Needs attention.** Every time the dashboard opens it checks the account for problems: disapproved or limited ads, campaigns limited by budget or unable to run, active campaigns with no impressions, spend with no conversions (including conversion tracking that looks broken), search campaigns with a low click rate, and keywords with a poor Quality Score. Each problem says how to fix it, and **Ask how to fix** sends it to the chat box for step-by-step help. The checks are in `src/lib/google/health.ts`.
- **More tabs.** **Keywords** (spend, clicks, cost per click and per lead, Quality Score; poor scores and keywords spending a lead's worth with no lead in red), **Ads** (headlines, approval, Ad Strength, results), **Devices** (phones vs computers vs tablets, with the cheapest and the wasteful one called out), **Best times** (leads and spend by day of the week and hour, for an ad schedule), **Conversion tracking** (what Google counts as a lead, and actions that record nothing), and impression share on **Campaigns** (how often ads showed, and how much was lost to budget or rank).
- **Locations.** Where each campaign is set to show (included and excluded places, and whether it reaches only people in the area), and which cities the clicks and spend came from, with places outside your target area marked. Needs attention flags campaigns with no location, the "Presence or interest" setting, spend from outside the area, and places that spend without bringing leads.
- **Searches to remove.** Lists search terms that cost money without bringing in a lead (renters, job seekers, home buyers, DIY research, or anything that cost more than a lead usually does), with a **Copy negative keywords** button to paste into Google Ads. Searches first spotted in the last day are tagged **New**, and wasted searches also appear as an alert under **Needs attention**. The rules are in `src/lib/google/wasted-searches.ts`.
- **Ask about your ads.** The button in the bottom corner of every page opens a chat: ask a question or ask for a report ("build a report for the last 7 days"), and it looks up your Google Ads data, website leads and calls to answer, with tables you can copy or download. It needs an OpenAI or Anthropic key (see below), and it only reads data; it can't change anything in Google Ads.
- **Website leads.** Your WordPress forms send each new lead to the app by webhook, and it appears on the **Leads** page marked **Website**, with the form's name, without reloading the page. The Leads page shows the webhook address to paste into WordPress, and the last few times WordPress sent something (and why anything was turned away).
- **Lead tracking.** Leads show as a spreadsheet (search, filter by channel, 25 per page) with a column for each detail: date, name, phone, email, property, channel (Google Ads, Facebook, organic search, direct mail...), UTM source, medium, campaign, term and content, Google click ID, landing page, referrer and form. The Lead Saver plugin fills these in by itself (it adds hidden fields to every Contact Form 7 form and a small tracking script to every page; nothing to paste), and **Export CSV** includes every column.
- **Lead quality back to Google Ads.** Each lead has a **Status** (New, Interested, Appointment, Offer made, Closed deal, Not interested). Interested and later, and Closed deal, are uploaded to Google Ads as offline conversions to two conversion actions the app creates the first time ("Command Center – Interested lead" and "Command Center – Deal closed", as secondary conversions so bidding doesn't change until you make them primary under Goals → Conversions). Each is matched by the lead's Google click ID (gclid, from the tracking snippet) and, when present, the lead's email and phone hashed with SHA-256 (enhanced conversions for leads: turn them on in Google Ads under Goals → Settings → Enhanced conversions for leads). Google needs a few hours before a new conversion action accepts uploads; the app retries waiting ones hourly while the Leads page is open, and shows each lead's result in the Google Ads column.
- **Phone calls.** Calls from your Google Ads (call assets, call ads, and your website's number with Google's call tracking) show on the **Leads** page: when, answered or missed, how long, the caller's area code, and the campaign. Missed calls are highlighted, and also show under **Needs attention**.

## Running it

**Updates install themselves.** Each time you start the app with `start.bat`, it checks for a newer version, downloads it and restarts with it. Your settings (`.env.local`) and data (`.data`) are kept. No internet? It just starts the version you have.

**Windows:** unzip the project, open the folder, and double-click `start.bat`.

1. The first time, it installs everything and creates a `.env.local` settings file, which it opens in Notepad.
2. Fill in the settings (see [One-time Google setup](#one-time-google-setup)), save, and run `start.bat` again.
3. Your browser opens at http://localhost:4000. Keep the black window open while you use the app.

**Mac or Linux:**

```bash
cp .env.example .env.local   # then fill it in
npm install
npm run dev
```

## One-time Google setup

You need three values for `.env.local`. This takes about 15 minutes, plus a few days' wait for Google to approve the developer token (step 4).

### 1. Create a Google Cloud project

1. Go to https://console.cloud.google.com and create a project (for example "Marketing Command Center").
2. Open **APIs & Services → Library**, search for **Google Ads API**, and click **Enable**.

### 2. Set up the sign-in screen

Open **Google Auth Platform** (under APIs & Services) and click **Get started**.

- **App name:** One Marketing Command Center. **Support email:** yours.
- **Audience:** pick **Internal** if you sign in with a company Google Workspace account (like `@twinhomebuyer.com`). Only your company's accounts can use it, and Google doesn't need to review it. Otherwise pick **External** and add yourself and your team under **Test users**.
- **Data access → Add or remove scopes:** add `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `https://www.googleapis.com/auth/adwords`.

> With **External** and publishing status **Testing**, Google makes the Google Ads connection expire after 7 days, and you'll need to click **Connect again** each week. To stop that, either use **Internal** or publish the app.

### 3. Create the sign-in client

1. **Google Auth Platform → Clients → Create client**, type **Web application**.
2. Under **Authorized redirect URIs**, add exactly:
   `http://localhost:4000/api/auth/google/callback`
   (and `https://your-domain/api/auth/google/callback` once the app is on a website).
3. Copy the **Client ID** and **Client secret** into `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### 4. Get a Google Ads developer token

1. You need a Google Ads **manager account**. Create one free at https://ads.google.com/home/tools/manager-accounts/, then link your Google Ads account to it.
2. In the manager account, open **Tools → API Center**, fill in the form, and accept the terms.
3. Copy the **Developer token** into `.env.local` as `GOOGLE_ADS_DEVELOPER_TOKEN`.
4. A new token has **Test Account Access** only, which can't read real accounts. Click **Apply for Basic Access** in the API Center. Google usually replies within a few business days. Until then the dashboard explains that the token only has test access.

### 5. Turn on the chat (optional)

The chat can use OpenAI (GPT-5.5 by default) or Anthropic's Claude. Fill in one key:

- **OpenAI:** at https://platform.openai.com add credit under **Settings → Billing**, then open **API keys → Create new secret key** and copy it into `.env.local` as `OPENAI_API_KEY`. Set a monthly cap under **Settings → Limits**.
- **Claude:** at https://console.anthropic.com create a workspace under **Settings → Workspaces**, then **API keys → Create key** in that workspace, and copy it into `.env.local` as `ANTHROPIC_API_KEY`.

- **Claude with no API key:** set `ASSISTANT_PROVIDER=claude-code`, then in the chat click **Sign in with Claude** (or double-click `setup-claude.bat`). It installs Claude Code if it's missing and signs in with your Claude account in the browser; the chat asks your question again when it's done. Each question runs Claude Code with its own tools turned off and only the chat's read-only Google Ads and leads lookups (`scripts/assistant-mcp.ts`), and counts against your Claude plan's usage. Everyone using the app shares the signed-in person's plan.

With both keys filled in, OpenAI answers unless `ASSISTANT_PROVIDER=anthropic`. Each question costs a few cents; a long report can cost more. Questions and the data the assistant looks up (ad numbers, and lead names and contact details when you ask about leads) are sent to the provider you chose to produce the answer.

### 6. Choose who can sign in

Set `ALLOWED_EMAILS` in `.env.local`, for example:

```
ALLOWED_EMAILS=@twinhomebuyer.com,partner@gmail.com
```

An entry starting with `@` allows a whole domain. If you leave it empty, any Google account can sign in while the app runs on your computer. On a website it refuses everyone until you set it.

Restart the app after saving `.env.local`.

## Using it

1. Open http://localhost:4000 and click **Continue with Google**.
2. On the **Google Ads** page, click **Connect Google Ads** and sign in with the Google account you use at ads.google.com. It can be a different account from the one you signed in with. Tick the box that lets the app see your Google Ads.
3. If you can open more than one Google Ads account, pick one from the **Account** list. Accounts under a manager account are included.

## Website leads from WordPress (Contact Form 7)

The **Lead Saver** plugin keeps every Contact Form 7 submission in WordPress itself, so leads sent while the app or your computer is off are never lost, and nothing needs a public address. On the Leads page, open **Website leads (WordPress)**:

1. Click **Download the Lead Saver plugin**. The file has your private key inside, so don't share it.
2. In WordPress, open **Plugins → Add New Plugin** and click **Upload Plugin** at the top (it isn't in the WordPress plugin store; you upload the file), choose `omcc-lead-saver.zip`, click **Install Now**, then **Activate**.
3. Type your website's address in the app and click **Connect**.

The plugin also does the lead tracking (UTM tags, Google click ID, landing page, referrer) on its own. When the app has a newer plugin, the Leads page says so: download it and upload it the same way, then click **Replace current with uploaded**.

The app picks up new leads every 30 seconds while it's open (and whenever the chat needs leads), keeping the time each one was really sent. In WordPress, **Contact → Command Center leads** shows what's been saved and when the app last picked leads up. The app reads them from `/wp-json/omcc/v1/leads` (or `?rest_route=/omcc/v1/leads` on sites without pretty permalinks), sending the key. If a security plugin or firewall blocks the WordPress REST API, allow `/wp-json/omcc/`. CF7 to Webhook isn't needed with it; if both are on, a lead still shows up only once.

## Other way: an instant webhook

Not needed with the Lead Saver plugin; useful for other form plugins. It only works while the app is running and reachable from the internet.

1. Open the **Leads** page, expand **Website leads (WordPress)** and then **Other way (advanced)**. Copy the webhook address.
2. In WordPress, open your form's webhook setting and paste the address, method **POST**:
   - **Contact Form 7:** install the free **CF7 to Webhook** plugin, edit the form, open its **Webhook** tab, tick the box, and paste the address.
   - **Elementor:** Actions After Submit → Webhook. **WPForms, Gravity Forms:** their webhook add-on.
3. Name the fields name (or first name and last name), phone, email, property address and message. Most forms already do. Anything else is kept in the lead's notes.
4. Submit the form once as a test.

**WordPress has to be able to reach the app.** It's on the internet and the app runs on your computer, so `localhost` addresses don't work from WordPress. Either:

- **Put the app online** (recommended, and leads arrive even when your computer is off): host it somewhere with a disk that keeps files, set `SITE_URL` to its address, set `AUTH_SECRET`, and add `https://your-address/api/auth/google/callback` to the Google sign-in client's redirect URIs.
- **Or open a tunnel from your computer:** with the app running, double-click **go-online.bat**. It downloads Cloudflare's free tunnel tool once, gives the app a public `https://…trycloudflare.com` address, and shows and copies the full webhook address to paste into WordPress. Leads only arrive while that window and the app are running, and the address changes each time, so paste the new one into WordPress each time.

Every request must carry the secret key (`?key=…` in the address, or an `X-Webhook-Secret` header). A test request with GET to the same address answers `{"ok": true}` without adding a lead.

## Daily Google Ads check

`npm run daily-check -- <folder>` pulls the dashboard's numbers and problems (including locations) for the last 7, 30 and 90 days and all time, and writes them to that folder as JSON, plus `summary.md`: what's wrong in the last 30 days, most serious first, with how to fix each one. A scheduled Claude session runs it every morning, loads the results into the live Command Center page, and sends the summary.

It needs `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_ADS_DEVELOPER_TOKEN` (and optionally `GOOGLE_ADS_CUSTOMER_ID`), from the environment or `.env.local`. The refresh token has to come from the same Google client as `GOOGLE_CLIENT_ID`: in https://developers.google.com/oauthplayground, click the gear, tick **Use your own OAuth credentials**, enter the client ID and secret, authorize `https://www.googleapis.com/auth/adwords`, and exchange the code for tokens. (Add `https://developers.google.com/oauthplayground` to the client's redirect URIs first.)

## Where data is kept

Everything is saved in the `.data/` folder next to the app (it's never committed):

- `leads.json`: leads from the website (and any older QR code leads).
- `webhook-log.json`: the last few times something called the website-leads webhook.
- `wordpress.json`: your website's address and how far its saved leads have been picked up.
- `conversion-actions.json`: the two conversion actions the app created in Google Ads.
- `chat-problem.log`: why the chat last answered without its tools, if it did.
- `public-url`: the tunnel address from go-online.bat.
- `webhook-secret`: the key WordPress sends with each lead, unless `LEADS_WEBHOOK_SECRET` is set.
- `google-ads.json`: each person's Google Ads connection. The Google token is encrypted.
- `auth-secret`: the key used for that encryption and for sign-in cookies. If you delete it, everyone has to sign in and connect Google Ads again.

Before putting the app on a website, set `AUTH_SECRET`, `SITE_URL` and `ALLOWED_EMAILS`, and use a host with a disk that keeps files (or swap `src/lib/leads/store.ts` and `src/lib/google/connections.ts` for a database).

## For developers

- Next.js 16 (App Router), Tailwind CSS 4, TypeScript. `npm run lint`, `npm run build`.
- Sign-in: `src/app/api/auth/google/*` (OAuth 2.0 authorization code flow with PKCE), `src/lib/auth/*` (AES-GCM encrypted session cookie), `src/proxy.ts` (redirects signed-out visitors).
- Google Ads: `src/lib/google/ads.ts` calls the REST API (`googleAds:search` with GAQL) using the signed-in person's refresh token and the developer token.
- Leads: `src/lib/leads/*`, public form at `/s/<code-id>`.
