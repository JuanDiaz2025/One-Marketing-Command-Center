// The lead inbox: a Google Sheet with a small Google Apps Script that WordPress sends every lead
// to. It's always online and its address never changes, so no lead is lost while this computer or
// the app is off, or after an update. The app pulls in anything new whenever it's open.
//
// The script (INBOX_SCRIPT) saves each submission as a row: when it arrived, an id, and exactly
// what the form sent. GET ?key=…&after=<row> returns the rows after that one.
import { jsonFileStore } from "@/lib/json-file-store"
import { mergeFields, parseBody } from "@/lib/leads/incoming"
import { addLead, listLeads } from "@/lib/leads/store"
import { parseWebsiteLead, webhookSecret } from "@/lib/leads/webhook"
import { logAttempt } from "@/lib/leads/webhook-log"

type InboxState = {
  url?: string // the Apps Script web app address, ending in /exec
  lastRow?: number // the last sheet row already brought in
  lastSync?: string
  lastError?: string
}

const file = jsonFileStore<InboxState>("lead-inbox.json", () => ({}))
const SYNC_EVERY_MS = 30_000
let lastAttempt = 0
let running: Promise<void> | null = null

export const getInbox = () => file.read()

export const isInboxUrl = (url: string) => /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)

export async function setInboxUrl(url: string) {
  await file.update((s) => {
    s.url = url
    s.lastRow = 1 // row 1 is the sheet's header row
    delete s.lastError
  })
  lastAttempt = 0
}

// The address WordPress sends leads to: the inbox, with the key the script checks.
export async function inboxWebhookAddress() {
  const { url } = await file.read()
  return url ? `${url}?key=${encodeURIComponent(await webhookSecret())}` : null
}

type InboxRow = { row: number; received: string; id: string; contentType: string; body: string; params: Record<string, string> }

// Brings in leads that arrived in the inbox since the last time. At most every 30 seconds, and one
// at a time; `force` skips the wait (e.g. right after saving the address).
export function syncInbox(force = false): Promise<void> {
  if (running) return running
  if (!force && Date.now() - lastAttempt < SYNC_EVERY_MS) return Promise.resolve()
  lastAttempt = Date.now()
  running = (async () => {
    const state = await file.read()
    if (!state.url) return
    try {
      const key = await webhookSecret()
      const res = await fetch(`${state.url}?key=${encodeURIComponent(key)}&after=${state.lastRow ?? 1}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; rows?: InboxRow[] } | null
      if (!data?.ok) throw new Error(data?.error ?? `The inbox answered ${res.status}. Check its address, and that it's deployed for "Anyone".`)

      const known = new Set((await listLeads()).map((l) => l.inboxId).filter(Boolean))
      let lastRow = state.lastRow ?? 1
      for (const r of data.rows ?? []) {
        lastRow = Math.max(lastRow, r.row)
        if (known.has(r.id)) continue
        const body = mergeFields(r.params ?? {}, await parseBody(r.contentType ?? "", r.body ?? ""))
        const lead = parseWebsiteLead(body)
        if (!lead) {
          await logAttempt({ ok: false, result: "no-contact", fields: body && typeof body === "object" ? Object.keys(body).slice(0, 30) : [] })
          continue
        }
        await addLead({ ...lead, inboxId: r.id }, Number.isNaN(Date.parse(r.received)) ? undefined : r.received)
        await logAttempt({ ok: true, result: "lead", lead: `${lead.name.slice(0, 80)} (from the inbox)` })
      }
      await file.update((s) => {
        s.lastRow = lastRow
        s.lastSync = new Date().toISOString()
        delete s.lastError
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await file.update((s) => {
        s.lastError = message.slice(0, 300)
        s.lastSync = new Date().toISOString()
      })
    }
  })().finally(() => {
    running = null
  })
  return running
}

// The Google Apps Script for the inbox, with this app's key filled in.
export function inboxScript(key: string) {
  return `// One Marketing Command Center: lead inbox. Saves every WordPress form submission in this
// sheet, and gives them to the Command Center when it asks with the right key.
const KEY = ${JSON.stringify(key)};
const SHEET = "Leads";

function sheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET);
  if (!sheet) sheet = book.insertSheet(SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Received", "Id", "Name", "Email", "Phone", "Content type", "Body", "Fields in address"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// A readable guess at name, email and phone for the sheet's own columns (the app reads the raw data).
function pick_(body, params, names) {
  let fields = {};
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object") fields = parsed;
  } catch (err) {
    body.split("&").forEach(function (pair) {
      const i = pair.indexOf("=");
      if (i < 0) return;
      try {
        fields[decodeURIComponent(pair.slice(0, i).replace(/\\+/g, " "))] = decodeURIComponent(pair.slice(i + 1).replace(/\\+/g, " "));
      } catch (e) {}
    });
  }
  Object.assign(fields, params);
  const lower = {};
  Object.keys(fields).forEach(function (k) { lower[k.toLowerCase()] = fields[k]; });
  for (const n of names) {
    const v = lower[n];
    if (v !== undefined && v !== null && typeof v !== "object") return String(v).trim();
  }
  return "";
}

// A leading ' keeps Sheets from turning text into numbers, dates or formulas (+1 305..., =...).
function text_(value) {
  return "'" + String(value);
}

function doPost(e) {
  if (e.parameter.key !== KEY) return json_({ ok: false, error: "Wrong or missing key." });
  const params = Object.assign({}, e.parameter);
  delete params.key;
  const body = e.postData ? e.postData.contents : "";
  const type = e.postData ? e.postData.type : "";
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sheet_().appendRow([
      text_(new Date().toISOString()),
      text_(Utilities.getUuid()),
      text_(pick_(body, params, ["your-name", "name", "full_name", "first_name"])),
      text_(pick_(body, params, ["your-email", "email"])),
      text_(pick_(body, params, ["your-phone", "your-tel", "phone", "tel"])),
      text_(type),
      text_(body.slice(0, 45000)),
      text_(JSON.stringify(params)),
    ]);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

function doGet(e) {
  if (e.parameter.key !== KEY) return json_({ ok: false, error: "Wrong or missing key." });
  const sheet = sheet_();
  const last = sheet.getLastRow();
  const after = Math.max(1, Number(e.parameter.after || 1));
  if (last <= after) return json_({ ok: true, rows: [] });
  const count = Math.min(last - after, 500);
  const values = sheet.getRange(after + 1, 1, count, 8).getValues();
  return json_({
    ok: true,
    rows: values.map(function (v, i) {
      let params = {};
      try { params = JSON.parse(v[7] || "{}"); } catch (err) {}
      return { row: after + 1 + i, received: String(v[0]), id: String(v[1]), contentType: String(v[5]), body: String(v[6]), params: params };
    }),
  });
}
`
}
