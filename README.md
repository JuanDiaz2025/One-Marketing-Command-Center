# One Marketing Command Center

**More customers. Zero ad hassle.**

One Marketing Command Center helps small business owners run ads on Meta and Google without learning either platform.

**[Watch the demo video](https://youtu.be/ZaBx4PjeQfo)**

## How it works

1. **Tell us about your business.** Answer a few simple questions: what you sell, where your customers are, your goal, and your budget.
2. **Launch campaigns.** One Marketing Command Center creates campaigns on Meta (Facebook and Instagram) and Google for you.
3. **Track results.** A conversion feed records real sales, bookings, and leads.
4. **See insights.** One dashboard shows what's working and what to do next.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

**Windows:** unzip the project, open the folder, and double-click `start.bat`. It installs everything the first time, starts the app, and opens your browser.

## Demo login

Use this account on the login page (`/login`):

| Email | Password |
| --- | --- |
| `demo@onemarketing.com` | `demo1234` |

Logging in takes you to the campaign dashboard (`/dashboard`). The home page (`/`) is the landing page with **Get started** and **Log in**. This is a demo-only account checked in the browser (see `src/lib/demo-account.ts`); there's no real authentication yet.

## Conversion feed and QR codes

QR codes are an in-store conversion source. Owners create one at `/conversions/qr/new` (filled in from the business profile, with a live preview of what customers see), print the poster, and put it at the counter. Customers scan it, see the order just rung up at the register, and add their email or phone number to get the offer (20% off their first coffee) at `/s/<code-id>`.

Each conversion is matched to the ad the customer saw (by email, phone number, or cookie) and sent back to Meta and Google. The **Conversion feed** (`/conversions`) shows every conversion with the platform, placement, and ad that drove it. The **dashboard** (`/dashboard`) shows the campaign launched in setup, with conversions and revenue counted from the feed.

- **Testing with a phone:** in local development the QR code uses this computer's Wi-Fi address instead of `localhost`, so a phone on the same Wi-Fi can open it. Once deployed, set `SITE_URL` (e.g. `SITE_URL=https://onemarketing.example.com`).
- **Data:** QR codes and conversions are saved to `.data/conversions.json` (not committed), seeded from mock data in `src/lib/conversions/mock-data.ts`. Delete the file to reset the demo. To use a real database, replace the functions in `src/lib/conversions/store.ts`.
- **Mocked for now:** the register lookup (`src/lib/conversions/menu.ts`), matching customers to ads (`src/lib/conversions/match.ts`), and ad delivery numbers on the dashboard (`src/lib/dashboard-data.ts`).
