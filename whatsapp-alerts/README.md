# WhatsApp → Google Chat alerts

Watches your WhatsApp groups and posts an **@all** alert to the team's Google Chat space whenever an instruction is still waiting on replies:

| When | Alert |
| --- | --- |
| As soon as the instruction lands | 🔔 NEW message |
| 15 min with no reply | ⏰ 1st reminder |
| 30 min | ⏰ 2nd reminder |
| 60 min | 🚨 ESCALATION |

Each alert names the people who still haven't replied and stops as soon as they all have. It runs on its own: no browser, no Claude chat, no clicks.

## How it decides

- **Instruction:** any message from an instruction-giver (`givers` in `config.json`, for example Juan) in a tracked group. Greetings and acknowledgements ("good morning", "thanks", 👍) are skipped.
- **Who must reply:** the people @mentioned, or everyone in the group who isn't an instruction-giver. A question like "Who has the key?" needs one answer from anyone.
- **Replied:** a swipe-reply or reaction to that message, or any message the person sends in the group after it. A manager chasing their own message ("hello??") isn't a new instruction.

## Set up (Windows)

1. Install Node.js 20 or newer from https://nodejs.org.
2. Double-click `start-alerts.bat` once. It installs everything and creates `config.json` and `.env`, then stops at a QR code. Close it.
3. Open `.env` and paste the Google Chat webhook URL (Google Chat → the space → Apps & integrations → Webhooks).
4. Run `npm run groups` in this folder, link WhatsApp when asked, and note the group names and the instruction-givers' ids.
5. Edit `config.json`: `groups` (names or ids), `givers` (phone numbers with country code, or the ids from step 4).
6. Double-click `start-alerts.bat`. On first run, scan the QR code: WhatsApp → Settings → Linked devices → Link a device.

Check Google Chat works any time with `node src/index.js --test-alert`.

**Keep it running:** press Win+R, type `shell:startup`, and put a shortcut to `start-alerts.bat` in that folder so it starts when you log in. The computer must stay on and awake.

## Files

- `data/auth/` — the WhatsApp link. Delete it to unlink and re-scan.
- `data/state.json` — instructions being tracked and alerts already sent, so a restart never repeats one.

Tests: `npm test`.

**Note:** WhatsApp doesn't officially support linking third-party programs. To protect your main number, link a separate WhatsApp account that's in the groups.
