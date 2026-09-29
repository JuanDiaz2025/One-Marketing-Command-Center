# One Marketing Command Center

Your Google Ads results and your QR code leads in one place.

- **Sign in with Google.** Only the Google accounts you allow can get in.
- **Google Ads dashboard.** Connect your Google Ads account to see spend, clicks, conversions and cost per conversion, by day and by campaign, for the last 7, 30 or 90 days. It reads your real account through the Google Ads API. Nothing is changed in Google Ads.
- **Needs attention.** Every time the dashboard opens it checks the account for problems: disapproved or limited ads, campaigns limited by budget or unable to run, active campaigns with no impressions, spend with no conversions (including conversion tracking that looks broken), search campaigns with a low click rate, and keywords with a poor Quality Score. Each problem says how to fix it, and **Ask how to fix** sends it to the chat box for step-by-step help. The checks are in `src/lib/google/health.ts`.
- **Searches to remove.** Lists search terms that cost money without bringing in a lead (renters, job seekers, home buyers, DIY research, or anything that cost more than a lead usually does), with a **Copy negative keywords** button to paste into Google Ads. Searches first spotted in the last day are tagged **New**, and wasted searches also appear as an alert under **Needs attention**. The rules are in `src/lib/google/wasted-searches.ts`.
- **Ask about your marketing.** A chat box on the dashboard: ask a question or ask for a report ("build a report for the last 7 days"), and it looks up your Google Ads data and QR code leads to answer, with tables you can copy or download. It needs an `ANTHROPIC_API_KEY` (see below), and it only reads data; it can't change anything in Google Ads.
- **QR code leads.** Make a QR code for each yard sign, postcard or flyer. People who scan it fill in a short form (name, phone or email, property address, a note), and the lead shows up under **Leads**, tagged with the sign it came from. You can export leads as a CSV file.

## Running it

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

### 5. Turn on the chat box (optional)

1. Go to https://console.anthropic.com, sign in, and add a payment method under **Billing**.
2. Open **API keys → Create key**, and copy it into `.env.local` as `ANTHROPIC_API_KEY`.

Each question costs a few cents; a long report can cost more. Questions and the data the assistant looks up (ad numbers, and lead names and contact details when you ask about leads) are sent to Anthropic to produce the answer.

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
4. Under **Leads**, click **Create QR code**, then print the poster or download the PNG/PDF.

**Testing a QR code with a phone:** while running locally, the QR code points at this computer's Wi-Fi address, so a phone on the same Wi-Fi can open it. Once the app is on a website, set `SITE_URL` so QR codes point there instead.

## Where data is kept

Everything is saved in the `.data/` folder next to the app (it's never committed):

- `leads.json`: QR codes and leads.
- `google-ads.json`: each person's Google Ads connection. The Google token is encrypted.
- `auth-secret`: the key used for that encryption and for sign-in cookies. If you delete it, everyone has to sign in and connect Google Ads again.

Before putting the app on a website, set `AUTH_SECRET`, `SITE_URL` and `ALLOWED_EMAILS`, and use a host with a disk that keeps files (or swap `src/lib/leads/store.ts` and `src/lib/google/connections.ts` for a database).

## For developers

- Next.js 16 (App Router), Tailwind CSS 4, TypeScript. `npm run lint`, `npm run build`.
- Sign-in: `src/app/api/auth/google/*` (OAuth 2.0 authorization code flow with PKCE), `src/lib/auth/*` (AES-GCM encrypted session cookie), `src/proxy.ts` (redirects signed-out visitors).
- Google Ads: `src/lib/google/ads.ts` calls the REST API (`googleAds:search` with GAQL) using the signed-in person's refresh token and the developer token.
- Leads: `src/lib/leads/*`, public form at `/s/<code-id>`.
