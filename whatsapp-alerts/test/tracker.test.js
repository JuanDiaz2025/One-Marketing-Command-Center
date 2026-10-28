const test = require('node:test');
const assert = require('node:assert');
const T = require('../src/tracker');

const MIN = T.MIN;
const cfg = { givers: ['+1 408 555 0000'], timing: { first: 15, second: 30, escalate: 60 } };
const G = '123@g.us';
const juan = '14085550000@s.whatsapp.net', ana = '111@s.whatsapp.net', ben = '222@s.whatsapp.net';
const base = { group: G, groupName: 'TEST', participants: [juan, ana, ben] };
const t0 = Date.UTC(2026, 9, 28, 17, 0);
const say = (state, from, text, at, extra = {}) => T.onMessage(state, cfg, { ...base, id: `m${at}${from}`, from, text, at, ...extra });

test('a manager instruction alerts NEW, then each stage once, until everyone replies', () => {
  const s = T.emptyState();
  s.names[ana] = 'Ana'; s.names[ben] = 'Ben';
  const r = say(s, juan, 'Send me the photos of the kitchen', t0);
  assert.deepStrictEqual(r.required, [ana, ben]);

  let a = T.dueAlerts(s, cfg, t0 + 1000);
  assert.strictEqual(a.length, 1);
  assert.match(a[0].text, /NEW message/);
  assert.match(a[0].text, /No reply yet: Ana, Ben/);
  a.forEach(x => T.markSent(s, x));
  assert.strictEqual(T.dueAlerts(s, cfg, t0 + 5 * MIN).length, 0, 'not repeated');

  say(s, ana, 'on it', t0 + 10 * MIN);
  a = T.dueAlerts(s, cfg, t0 + 16 * MIN);
  assert.match(a[0].text, /1st reminder/);
  assert.match(a[0].text, /No reply yet: Ben\./);
  a.forEach(x => T.markSent(s, x));

  say(s, ben, 'done', t0 + 20 * MIN);
  assert.strictEqual(T.dueAlerts(s, cfg, t0 + 61 * MIN).length, 0, 'answered, no more alerts');
});

test('skips a backlog straight to the highest stage reached', () => {
  const s = T.emptyState();
  say(s, juan, 'Confirm the schedule please', t0);
  const a = T.dueAlerts(s, cfg, t0 + 61 * MIN);
  assert.strictEqual(a.length, 1);
  assert.match(a[0].text, /ESCALATION/);
});

test('greetings and a manager chasing their own request are not new requests', () => {
  const s = T.emptyState();
  assert.strictEqual(say(s, juan, 'Good morning team!', t0), null);
  assert.strictEqual(say(s, juan, '👍', t0 + 1), null);
  const r = say(s, juan, 'Who has the key?', t0 + 2);
  assert.ok(r.anyone);
  assert.strictEqual(say(s, juan, 'hello??', t0 + 3, { quotedId: r.id }), null);
  say(s, ben, 'I do', t0 + 4);
  assert.ok(!T.isOpen(s.requests[r.id]));
});

test('mentions narrow who must reply; quoted replies and reactions count', () => {
  const s = T.emptyState();
  const r = say(s, juan, '@Ana call the plumber', t0, { mentions: [ana] });
  assert.deepStrictEqual(r.required, [ana]);
  say(s, ben, 'I can help', t0 + 1);
  assert.ok(T.isOpen(s.requests[r.id]));
  T.onMessage(s, cfg, { ...base, id: 'x', from: ana, at: t0 + 2, reactionTo: r.id });
  assert.ok(!T.isOpen(s.requests[r.id]));
});

test('givers match by phone number in any format', () => {
  assert.ok(T.isGiver(cfg, '14085550000@s.whatsapp.net'));
  assert.ok(T.isGiver(cfg, '14085550000:12@s.whatsapp.net'));
  assert.ok(!T.isGiver(cfg, '14085550001@s.whatsapp.net'));
  assert.ok(T.isGiver({ givers: ['Juan'] }, '9@lid', 'juan'));
});
