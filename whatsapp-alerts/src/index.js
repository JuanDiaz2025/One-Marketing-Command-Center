// WhatsApp -> Google Chat alerts. Links to WhatsApp as a device (like WhatsApp
// Web), watches the tracked groups, and posts an @all alert to Google Chat for
// every instruction still waiting on replies: when it lands, then at each
// reminder and escalation step.

const fs = require('fs');
const path = require('path');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getContentType, jidNormalizedUser } = require('baileys');
const T = require('./tracker');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA, 'state.json');
const CHECK_EVERY = 15 * 1000;
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);

// ---------------- config ----------------
function loadEnv() {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function loadConfig() {
  const f = path.join(ROOT, 'config.json');
  if (!fs.existsSync(f)) { console.error('Missing config.json. Copy config.example.json to config.json and fill it in.'); process.exit(1); }
  const cfg = JSON.parse(fs.readFileSync(f, 'utf8'));
  cfg.timing = { first: 15, second: 30, escalate: 60, ...(cfg.timing || {}) };
  cfg.groups = cfg.groups || [];
  cfg.givers = cfg.givers || [];
  return cfg;
}

// ---------------- state ----------------
function loadState() {
  try { return { ...T.emptyState(), ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; }
  catch (_) { return T.emptyState(); }
}
function saveState(state) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(STATE_FILE + '.tmp', JSON.stringify(state, null, 1));
  fs.renameSync(STATE_FILE + '.tmp', STATE_FILE);
}

// ---------------- Google Chat ----------------
async function postToChat(text) {
  const url = process.env.GCHAT_WEBHOOK_URL;
  if (!url) throw new Error('GCHAT_WEBHOOK_URL is not set in .env');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ text: `<users/all> ${text}`.slice(0, 3900) }),
  });
  if (!res.ok) throw new Error(`Google Chat answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// ---------------- WhatsApp message parsing ----------------
function unwrap(message) {
  let m = message;
  for (let i = 0; i < 4 && m; i++) {
    const inner = m.ephemeralMessage || m.viewOnceMessage || m.viewOnceMessageV2 || m.documentWithCaptionMessage || m.editedMessage;
    if (!inner) break;
    m = inner.message;
  }
  return m;
}

function parse(raw, me) {
  const m = unwrap(raw.message);
  if (!m) return null;
  const type = getContentType(m);
  const body = m[type] || {};
  const ctx = body.contextInfo || {};
  const from = raw.key.fromMe ? me : jidNormalizedUser(raw.key.participant || raw.participant || '');
  if (!from) return null;
  return {
    id: raw.key.id,
    group: raw.key.remoteJid,
    from,
    fromName: raw.key.fromMe ? null : raw.pushName,
    text: typeof body === 'string' ? body : (body.text || body.caption || ''),
    at: Number(raw.messageTimestamp) * 1000 || Date.now(),
    quotedId: ctx.stanzaId || null,
    mentions: (ctx.mentionedJid || []).map(jidNormalizedUser),
    reactionTo: type === 'reactionMessage' ? body.key && body.key.id : null,
  };
}

// ---------------- main ----------------
async function main() {
  loadEnv();
  const listOnly = process.argv.includes('--list-groups');
  if (process.argv.includes('--test-alert')) {
    await postToChat('✅ Test from the WhatsApp alerts program. Alerts are connected.');
    log('Test alert posted to Google Chat.');
    return;
  }
  const cfg = loadConfig();
  const state = loadState();
  const groups = {}; // id -> { name, participants }
  const tracked = id => !!groups[id];
  let sock, timer, sending = false;

  const matchesConfig = (id, subject) => cfg.groups.some(g => g === id || String(subject || '').toLowerCase().includes(String(g).toLowerCase()));

  async function loadGroups() {
    const all = await sock.groupFetchAllParticipating();
    if (listOnly) {
      console.log('\nYour WhatsApp groups (put names or ids in config.json "groups"):\n');
      for (const g of Object.values(all)) {
        console.log(`• ${g.subject}   id: ${g.id}`);
        g.participants.forEach(p => console.log(`    ${p.id}${p.admin ? ' (admin)' : ''}`));
      }
      console.log('\nPut the instruction-givers (for example Juan) in "givers" as phone numbers, or as the exact ids above.');
      process.exit(0);
    }
    for (const k of Object.keys(groups)) delete groups[k];
    for (const g of Object.values(all)) {
      if (matchesConfig(g.id, g.subject)) groups[g.id] = { name: g.subject, participants: g.participants.map(p => jidNormalizedUser(p.id)) };
    }
    const names = Object.values(groups).map(g => g.name);
    log(names.length ? `Watching ${names.length} group(s): ${names.join(', ')}` : 'No groups matched config.json "groups". Run: npm run groups');
  }

  async function tick() {
    if (sending) return;
    sending = true;
    try {
      const now = Date.now();
      const alerts = T.dueAlerts(state, cfg, now);
      if (alerts.length) {
        await postToChat(alerts.map(a => a.text).join('\n\n———\n\n'));
        alerts.forEach(a => T.markSent(state, a));
        log(`Posted ${alerts.length} alert(s) to Google Chat.`);
      }
      T.prune(state, now);
      saveState(state);
    } catch (e) {
      log('Could not post alerts, will retry:', e.message);
    } finally { sending = false; }
  }

  async function connect() {
    const { state: auth, saveCreds } = await useMultiFileAuthState(path.join(DATA, 'auth'));
    const { version } = await fetchLatestBaileysVersion().catch(() => ({}));
    sock = makeWASocket({ auth, version, logger: pino({ level: 'silent' }), markOnlineOnConnect: false, syncFullHistory: false });
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.log('\nOn your phone: WhatsApp → Settings → Linked devices → Link a device, then scan:\n');
        qrcode.generate(qr, { small: true });
      }
      if (connection === 'open') {
        log('Connected to WhatsApp.');
        try { await loadGroups(); } catch (e) { log('Could not load groups:', e.message); }
      }
      if (connection === 'close') {
        const code = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode;
        if (code === DisconnectReason.loggedOut) {
          log('WhatsApp logged this device out. Delete the data/auth folder and start again to re-link.');
          process.exit(1);
        }
        log('Disconnected, reconnecting in 5 seconds…');
        setTimeout(() => connect().catch(e => log('Reconnect failed:', e.message)), 5000);
      }
    });

    sock.ev.on('messages.upsert', ({ messages }) => {
      const me = sock.user && jidNormalizedUser(sock.user.id);
      for (const raw of messages) {
        if (!raw.message || !tracked(raw.key.remoteJid)) continue;
        const msg = parse(raw, me);
        if (!msg) continue;
        const g = groups[msg.group];
        const req = T.onMessage(state, cfg, { ...msg, groupName: g.name, participants: g.participants });
        if (req) log(`New instruction in "${g.name}": waiting on ${req.anyone ? 'anyone' : req.required.length + ' people'}.`);
      }
      tick();
    });

    sock.ev.on('group-participants.update', ({ id, participants, action }) => {
      const g = groups[id];
      if (!g) return;
      const jids = participants.map(p => jidNormalizedUser(typeof p === 'string' ? p : p.id));
      if (action === 'remove') { g.participants = g.participants.filter(j => !jids.includes(j)); T.onLeave(state, id, jids, Date.now()); }
      if (action === 'add') g.participants = [...new Set([...g.participants, ...jids])];
    });

    sock.ev.on('groups.update', () => { loadGroups().catch(() => {}); });
  }

  await connect();
  if (!listOnly) timer = setInterval(tick, CHECK_EVERY);
  const stop = () => { clearInterval(timer); saveState(state); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch(e => { console.error(e); process.exit(1); });
