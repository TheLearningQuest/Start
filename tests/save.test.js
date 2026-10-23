/* Save repair, word-garden unlock, and quota handling.
   The app is one HTML file, so the pure helpers are the marked blocks in index.html. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function scriptBlocks() {
  const out = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = re.exec(html))) out.push(match[1]);
  return out;
}

function loadBlock(marker) {
  const code = scriptBlocks().find(function (src) { return src.indexOf(marker) !== -1; });
  assert.ok(code, 'missing script ' + marker);
  const context = { module: { exports: {} }, window: {}, console: console };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: marker + '.js' });
  return context.module.exports;
}

const Save = loadBlock('NMQ_SAVE_MODULE_START');
const Words = loadBlock('Orton-Gillingham "heart words"');

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

test('a file that is not this game is rejected and described as not a backup', function () {
  assert.equal(Save.sanitize(null).ok, false);
  assert.equal(Save.sanitize([]).ok, false);
  assert.equal(Save.sanitize('hello').ok, false);
  assert.equal(Save.sanitize({ hello: 'world' }).ok, false);
  assert.equal(Save.sanitize({ settings: [] }).ok, false);
  assert.match(Save.MSG.notBackup, /not changed/);
  assert.match(html, /That file does not look like a Brain Quest backup\. The current game was not changed/);
});

test('a real backup keeps progress and reads the version field', function () {
  assert.equal(typeof Save.MIGRATIONS[0], 'function');
  const migrated = { v: 0, settings: { pin: '1111' } };
  Save.migrate(migrated);
  assert.equal(migrated.v, 1);

  const out = Save.sanitize({
    settings: { pin: '2468', sound: false, redVoice: false, voiceURI: 'zoe-e', voiceName: 'Zoe (Enhanced)' },
    coins: '42',
    modules: { 'add|easy|streak': { stars: 2, best: 11, plays: 3, tiers: {} } },
    facts: { '2+2': { key: '2+2', op: 'add', diff: 'easy', terms: [2, 2], answer: 4, text: '2 + 2', seen: 3, wrong: 1, miss: 0, cstreak: 2, ms: 1500 } },
    red: {
      custom: [{ id: 'c:yacht:1', w: 'yacht', red: [1], s: 'We saw a yacht.', ts: 10 }],
      words: { 'c:yacht:1': { box: 1, seen: 2, right: 2, wrong: 0 } },
      records: { 'spell|my|streak': { stars: 1, best: 8, plays: 1 } }
    },
    sessions: [{ ts: 5, op: 'add', diff: 'easy', mode: 'streak', method: 'pad', stars: 1, coins: 3, problems: 4, correct: 3, bestStreak: 3 }]
  }, { pin: '1234' });
  assert.equal(out.ok, true);
  const save = out.save;
  assert.equal(save.v, 1);
  assert.equal(save.coins, 42);
  assert.equal(save.settings.pin, '2468');
  assert.equal(save.settings.sound, false);
  assert.equal(save.settings.redVoice, false);
  assert.equal(save.settings.voiceURI, 'zoe-e');
  assert.equal(save.settings.voiceName, 'Zoe (Enhanced)');
  assert.equal(save.modules['add|easy|streak'].stars, 2);
  assert.equal(save.modules['add|easy|streak'].best, 11);
  assert.equal(save.facts['2+2'].wrong, 1);
  assert.equal(save.red.custom[0].w, 'yacht');
  assert.deepEqual(Array.from(save.red.custom[0].red), [1]);
  assert.equal(save.red.words['c:yacht:1'].box, 1);
  assert.equal(save.red.records['spell|my|streak'].best, 8);
  assert.equal(save.sessions[0].mode, 'streak');
  assert.equal(save.sessions[0].stars, 1);

  const newer = Save.sanitize({ v: 9, settings: { pin: '1111' }, coins: 3 }).save;
  assert.equal(newer.v, Save.SCHEMA);
  assert.equal(newer.coins, 3);
});

test('malicious amount, mode, pin, and egg type cannot reach the page', function () {
  const payload = '<img src=x onerror=alert(1)>';
  const out = Save.sanitize({
    name: 'Naomi',
    coins: payload,
    settings: {
      pin: payload,
      rewards: [{ id: '"><img src=x onerror=alert(1)>', icon: '💎', name: 'Robux', cost: payload, amount: payload, unit: payload, enabled: true }]
    },
    modules: {},
    eggs: [{ type: 'clothing"><img src=x onerror=alert(1)>', minRarity: payload }],
    requests: [{ id: payload, amount: payload, cost: payload, unit: 'minutes', icon: '💎', name: 'Screen', status: payload, ts: 1 }],
    sessions: [
      { ts: 1, op: 'add', diff: 'easy', mode: 'streak"><img src=x onerror=alert(1)>', method: payload, stars: payload, coins: payload, rereads: payload, problems: 1, correct: 1 },
      { ts: 2, op: 'add', diff: 'easy', mode: 'speed', method: 'write', stars: 2, coins: 4, rereads: 2, problems: 10, correct: 9, bestStreak: 4 }
    ],
    red: { custom: [null, { w: null }, { w: 'fr[iend', red: [0, 99, 'x'], s: 'We <b>saw</b> a friend.', id: 'c:friend:1' }, { w: 'a]' }, { w: 12 }, { w: 'said', red: [1, 1], s: 'She said it.', id: 'c:said:1' }] }
  }, { pin: '4321' });
  assert.equal(out.ok, true);
  const save = out.save;
  assert.equal(JSON.stringify(save).indexOf('onerror'), -1);
  assert.equal(JSON.stringify(save).indexOf('<'), -1);
  assert.equal(save.coins, 0);
  assert.equal(save.settings.pin, '4321');
  assert.equal(save.eggs[0].type, 'clothing');
  assert.equal(save.eggs[0].minRarity, 'common');
  assert.equal(typeof save.settings.rewards[0].amount, 'number');
  assert.equal(typeof save.settings.rewards[0].cost, 'number');
  assert.equal(typeof save.requests[0].amount, 'number');
  assert.equal(save.requests[0].status, 'pending');
  assert.ok(!/["'<>]/.test(save.requests[0].id));
  assert.deepEqual(Array.from(save.sessions, function (s) { return s.mode; }), ['speed']);
  assert.equal(save.sessions[0].method, 'write');
  assert.equal(save.sessions[0].stars, 2);
  assert.deepEqual(Array.from(save.red.custom, function (c) { return c.w; }), ['friend', 'said']);
  assert.deepEqual(Array.from(save.red.custom[0].red), [0]);
  assert.equal(save.red.custom[0].s.indexOf('<'), -1);
  assert.match(save.red.custom[0].s, /saw/);
  assert.equal(esc(save.requests[0].amount).indexOf('<'), -1);
  assert.equal(esc(save.sessions[0].mode).indexOf('onerror'), -1);
});

test('the page escapes save fields that are written with innerHTML', function () {
  assert.match(html, /esc\(q\.amount\)/);
  assert.match(html, /esc\(q\.id\)/);
  assert.match(html, /esc\(q\.cost\)/);
  assert.match(html, /esc\(s\.mode\)/);
  assert.match(html, /esc\(finite\(s\.stars\)\)/);
  assert.match(html, /esc\(finite\(s\.coins\)\)/);
  assert.match(html, /esc\(rereads\)/);
  assert.match(html, /esc\(r\.amount\)/);
  assert.match(html, /esc\(r\.cost\)/);
  assert.match(html, /methodLabel\(m\) \{ var i = L\.METHOD_INFO\[m \|\| 'pad'\]; return i \? i\.icon \+ ' ' \+ i\.name : esc\(m \|\| ''\); \}/);
});

test('bad pin falls back, and list caps keep the newest rows', function () {
  assert.equal(Save.sanitize({ settings: { pin: 'nope' }, modules: {} }).save.settings.pin, '1234');
  assert.equal(Save.sanitize({ settings: { pin: 9876 }, modules: {} }).save.settings.pin, '9876');
  const sessions = [];
  for (let i = 0; i < 500; i++) sessions.push({ ts: i, op: 'mul', diff: 'hard', mode: 'streak', method: 'bubble', stars: 1, coins: 1, problems: 1, correct: 1, bestStreak: i });
  const save = Save.sanitize({ settings: { pin: '1234' }, modules: { 'mul|hard|streak': { stars: 3, best: 40 } }, sessions: sessions }).save;
  assert.equal(save.sessions.length, Save.CAPS.sessions);
  assert.equal(save.sessions[0].ts, 500 - Save.CAPS.sessions);
  assert.equal(save.sessions[save.sessions.length - 1].bestStreak, 499);
  assert.equal(save.modules['mul|hard|streak'].stars, 3);
  assert.equal(save.modules['mul|hard|streak'].best, 40);
});

test('word garden unlock compares ids, not object identity', function () {
  const a = { id: 'c:yacht:1', w: 'yacht' };
  const b = { id: 'c:yacht:1', w: 'yacht' };
  assert.equal(a === b, false);
  assert.equal(Save.gardenLocked('new', a.id, b.id, 2), false);
  assert.equal(Save.gardenLocked('new', 'c:yacht:1', 'c:friend:2', 2), true);
  assert.equal(Save.gardenLocked('new', 'c:yacht:1', 'c:yacht:1', 0), true);
  assert.equal(Save.gardenLocked('learning', 'c:yacht:1', 'c:friend:2', 2), false);
  assert.equal(Save.gardenLocked('new', 'c:yacht:1', null, 2), true);
  assert.match(html, /gardenLocked\(st, w\.id, nx && nx\.id, left\)/);
});

test('allWords skips bad custom entries and blankSentence escapes regex characters', function () {
  const base = Words.allWords([]).length;
  const all = Words.allWords([null, { w: 'fr[iend', red: [0] }, { w: 12 }, { w: 'said', red: [1], id: 'c:said:1', s: 'She said hi.' }]);
  assert.equal(all.length, base + 1);
  assert.equal(all[all.length - 1].id, 'c:said:1');
  assert.equal(all[all.length - 1].w, 'said');

  const blank = Words.blankSentence('She said hi.', 'said');
  assert.equal(blank.before, 'She ');
  assert.equal(blank.word, 'said');
  ['*', '+', '(', ')', '[', 'a+b', '\\', 'said.'].forEach(function (word) {
    assert.doesNotThrow(function () { Words.blankSentence('see ' + word + ' now', word); });
  });
});

test('a full disk trims old sessions, keeps personal bests, and reports the failure', function () {
  function quota() { const e = new Error('quota exceeded'); e.name = 'QuotaExceededError'; return e; }
  const state = {
    sessions: Array.from({ length: 100 }, function (_, i) { return { ts: i, mode: 'streak' }; }),
    red: {
      sessions: Array.from({ length: 30 }, function (_, i) { return { ts: i }; }),
      learned: Array.from({ length: 90 }, function (_, i) { return { id: 'w' + i }; }),
      records: { 'spell|1|streak': { stars: 3, best: 12 } }
    },
    modules: { 'add|easy|streak': { stars: 3, best: 9 } },
    facts: { '1+1': { seen: 4, wrong: 1 } },
    totals: { coinsEarned: 50, eggsHatched: 2 }
  };
  let writes = 0;
  const trimmed = Save.persist(state, function () {
    writes++;
    if (writes === 1) throw quota();
  });
  assert.equal(trimmed.ok, true);
  assert.equal(trimmed.warning, 'trimmed');
  assert.equal(state.sessions.length, Save.EMERGENCY_KEEP);
  assert.equal(state.sessions[0].ts, 80);
  assert.equal(state.red.records['spell|1|streak'].stars, 3);
  assert.equal(state.modules['add|easy|streak'].best, 9);
  assert.equal(state.facts['1+1'].seen, 4);
  assert.equal(state.totals.coinsEarned, 50);
  assert.equal(state.totals.eggsHatched, 2);
  assert.equal(Save.saveMessage('trimmed', true), Save.MSG.kidTrimmed);
  assert.match(Save.MSG.kidFull, /ask a grown-up/);
  assert.match(Save.MSG.parentFull, /out of storage/);

  const stuck = { sessions: [{ ts: 1 }, { ts: 2 }], modules: { 'add|easy|streak': { stars: 1, best: 4 } } };
  const failed = Save.persist(stuck, function () { throw quota(); });
  assert.equal(failed.ok, false);
  assert.equal(failed.warning, 'quota');
  assert.equal(stuck.sessions.length, 2);
  assert.equal(stuck.modules['add|easy|streak'].stars, 1);

  const priv = Save.persist({ sessions: [{ ts: 1 }] }, function () { const e = new Error('denied'); e.name = 'SecurityError'; throw e; });
  assert.equal(priv.ok, false);
  assert.equal(priv.warning, 'private');
  assert.equal(Save.isQuotaError({ name: 'QuotaExceededError' }), true);
  assert.equal(Save.isQuotaError({ code: 22 }), true);
  assert.equal(Save.isQuotaError({ name: 'SecurityError' }), false);
});

test('backup share stays on the device and speech is primed from the tap', function () {
  assert.match(html, /navigator\.share/);
  assert.match(html, /navigator\.canShare/);
  assert.match(html, /new File\(/);
  assert.match(html, /id="backup-text"/);
  assert.match(html, /function unlockSpeech\(/);
  assert.match(html, /function primeAudio\(/);
  assert.match(html, /primeFromGesture/);
  assert.match(html, /touchend/);
  assert.equal((html.match(/https:\/\//g) || []).length, 0);
});
