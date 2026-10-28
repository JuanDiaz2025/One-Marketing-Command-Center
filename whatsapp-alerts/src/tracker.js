// Pure tracking logic: which instructions are still waiting on replies, and
// which alerts are due. No WhatsApp or network code here, so it can be tested.

const MIN = 60 * 1000;
const STAGES = ['🔔 NEW message', '⏰ 1st reminder', '⏰ 2nd reminder', '🚨 ESCALATION'];
const KEEP_FOR = 3 * 24 * 60 * MIN;

// Greetings and acknowledgements from a manager don't need a reply.
const NO_REPLY_NEEDED = /^(ok(ay)?|k|thanks?( you)?( all| po| team)?|ty|thx|noted|copy|got it|nice|great|good( job| work)?|good (morning|afternoon|evening|night)( all| team| everyone| po)?|hi|hello|hey|[\p{Extended_Pictographic}\u200d\ufe0f\s]+)[\s!.]*$/iu;

const emptyState = () => ({ requests: {}, names: {} });

// "1 (408) 555-1234", "14085551234@s.whatsapp.net", "123:4@lid" -> digits of the user part
const userDigits = jid => String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');

function isGiver(cfg, jid, name) {
  const d = userDigits(jid);
  return (cfg.givers || []).some(g => {
    const s = String(g).trim();
    if (s.includes('@')) return userDigits(s) === d && d !== '';
    const gd = s.replace(/\D/g, '');
    if (gd.length >= 7) return gd === d;
    return !!name && s.toLowerCase() === String(name).toLowerCase();
  });
}

function nameOf(state, jid) {
  return state.names[jid] || `+${userDigits(jid)}`;
}

function isOpen(r) {
  return r.anyone ? !r.answeredBy : r.required.some(j => !r.replied[j]);
}

// A message in a tracked group. msg: { id, group, groupName, from, fromName, text,
// at, quotedId, mentions: [jid], reactionTo, participants: [jid] }
function onMessage(state, cfg, msg) {
  if (msg.fromName) state.names[msg.from] = msg.fromName;
  const giver = isGiver(cfg, msg.from, msg.fromName);
  const inGroup = Object.values(state.requests).filter(r => r.group === msg.group);

  if (giver && !msg.reactionTo) {
    const text = String(msg.text || '').trim();
    if (!text || NO_REPLY_NEEDED.test(text)) return null;
    // a manager chasing their own open request ("hello??") is not a new one
    const chased = msg.quotedId && state.requests[msg.quotedId];
    if (chased && chased.from === msg.from && isOpen(chased)) return null;
    if (state.requests[msg.id]) return null;
    const notGiver = j => j !== msg.from && !isGiver(cfg, j, state.names[j]);
    const mentioned = (msg.mentions || []).filter(j => j !== msg.from);
    const required = mentioned.length ? mentioned : (msg.participants || []).filter(notGiver);
    // "who has the key?" with nobody named: one answer from anyone settles it
    const anyone = !mentioned.length && /^(who|anyone|any ?body|does anyone|did anyone|can anyone)\b/i.test(text);
    if (!required.length && !anyone) return null;
    state.requests[msg.id] = {
      id: msg.id, group: msg.group, groupName: msg.groupName, from: msg.from,
      text, at: msg.at, required: anyone ? [] : required, anyone, answeredBy: null,
      replied: {}, sentLevel: -1,
    };
    return state.requests[msg.id];
  }

  // Anyone else's message (or a manager's reply to another manager): a quoted
  // reply or reaction answers that request; any other message answers every
  // open request before it that was waiting on this person.
  const target = msg.reactionTo || msg.quotedId;
  const answer = r => {
    if (r.at > msg.at || r.from === msg.from) return;
    if (r.anyone) { if (!r.answeredBy && !giver) r.answeredBy = msg.from; return; }
    if (r.required.includes(msg.from) && !r.replied[msg.from]) r.replied[msg.from] = msg.at;
  };
  if (target && state.requests[target]) answer(state.requests[target]);
  else if (!msg.reactionTo) inGroup.forEach(answer);
  return null;
}

// Someone left the group: stop waiting on them.
function onLeave(state, group, jids, at) {
  Object.values(state.requests).forEach(r => {
    if (r.group !== group) return;
    jids.forEach(j => { if (r.required.includes(j) && !r.replied[j]) r.replied[j] = at; });
  });
}

const levelAt = (cfg, waited) => [cfg.timing.first, cfg.timing.second, cfg.timing.escalate].filter(m => waited >= m * MIN).length;

function fmtWhen(at, tz) {
  return new Date(at).toLocaleString('en-US', { timeZone: tz || 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Alerts due now, highest stage reached only, each sent once. Marks them sent.
function dueAlerts(state, cfg, now) {
  const out = [];
  for (const r of Object.values(state.requests)) {
    if (!isOpen(r)) continue;
    const lvl = levelAt(cfg, now - r.at);
    if (lvl <= r.sentLevel) continue;
    const pending = r.anyone ? 'anyone in the group' : r.required.filter(j => !r.replied[j]).map(j => nameOf(state, j)).join(', ');
    const text = `${STAGES[lvl]} from ${nameOf(state, r.from)} in "${r.groupName || 'WhatsApp group'}" (${fmtWhen(r.at, cfg.timeZone)}):\n"${r.text.slice(0, 600)}"\n\nNo reply yet: ${pending}. Please reply in WhatsApp now.`;
    out.push({ id: r.id, level: lvl, text });
  }
  return out;
}

function markSent(state, alert) {
  const r = state.requests[alert.id];
  if (r) r.sentLevel = Math.max(r.sentLevel, alert.level);
}

function prune(state, now) {
  for (const [id, r] of Object.entries(state.requests)) {
    const done = !isOpen(r) || r.sentLevel >= 3;
    if (now - r.at > KEEP_FOR || (done && now - r.at > 60 * MIN)) delete state.requests[id];
  }
}

module.exports = { emptyState, onMessage, onLeave, dueAlerts, markSent, prune, isGiver, isOpen, userDigits, MIN };
