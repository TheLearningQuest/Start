/* Red Words garden: word ids, mastery steps, weekly block, save migration. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function loadBlock(startMark, endMark) {
  const start = html.indexOf(startMark);
  const end = html.indexOf(endMark);
  assert.ok(start !== -1 && end > start, startMark);
  const context = { module: { exports: {} }, window: {}, console: console };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context, { filename: startMark + '.js' });
  return context.module.exports;
}

const Garden = loadBlock('/* NMQ_GARDEN_MODULE_START', '/* NMQ_GARDEN_MODULE_END */');
const Save = loadBlock('/* NMQ_SAVE_MODULE_START', '/* NMQ_SAVE_MODULE_END */');

function ids(list) { return list.map(function (w) { return w.id; }); }

test('kindergarten, first grade, and the explore list load with unique ids', function () {
  assert.equal(Garden.KINDERGARTEN.length, 44);
  assert.equal(Garden.FIRST.length, 52);
  assert.equal(Garden.EXPLORE.length, 40);
  const all = Garden.catalog([]);
  assert.equal(all.length, 142);
  const seen = {};
  all.forEach(function (w) {
    assert.equal(seen[w.id], undefined, w.id);
    seen[w.id] = 1;
    assert.match(w.id, /^rw-(k|1|2w|2)-/);
  });
  const eye = Garden.KINDERGARTEN.filter(function (w) { return w.id === 'rw-k-i'; })[0];
  assert.equal(eye.w, 'I');
  const said = Garden.byId('rw-k-said', []);
  assert.equal(said.w, 'said');
  assert.deepEqual(Array.from(said.tricky), [1, 2]);
  const friend = Garden.byId('rw-1-friend', []);
  assert.equal(friend.w, 'friend');
  const dont = Garden.byId('rw-2-dont', []);
  assert.equal(dont.w, "don't");
  assert.equal(Garden.KINDERGARTEN.every(function (w) { return w.pathway; }), true);
  assert.equal(Garden.FIRST.every(function (w) { return w.pathway; }), true);
  assert.equal(Garden.EXPLORE.every(function (w) { return w.pathway; }), false);
  const custom = Garden.catalog([{ id: 'c:yacht:1', w: 'yacht', red: [1] }]);
  assert.equal(custom.length, 143);
  assert.equal(custom[142].id, 'c:yacht:1');
  assert.equal(custom[142].pathway, true);
});

test('mastery takes three first-try days and a miss steps back once', function () {
  let card = Garden.sessionResult(null, true, 100);
  assert.equal(card.step, 1);
  assert.equal(card.due, 101);
  assert.equal(card.planted, false);
  card = Garden.sessionResult(card, true, 101);
  assert.equal(card.step, 2);
  assert.equal(card.due, 104);
  card = Garden.sessionResult(card, true, 104);
  assert.equal(card.step, 3);
  assert.equal(card.planted, true);
  assert.equal(card.due, 111);
  const review = Garden.sessionResult(card, true, 111);
  assert.equal(review.step, 3);
  assert.equal(review.level, 2);
  assert.equal(review.due, 118);
  const miss = Garden.sessionResult(card, false, 111);
  assert.equal(miss.step, 2);
  assert.equal(miss.planted, false);
  assert.notEqual(miss.step, 0);
  const early = Garden.sessionResult({ step: 1, misses: 0, level: 1 }, false, 50);
  assert.equal(early.step, 1);
  const fresh = Garden.sessionResult({ step: 0 }, false, 50);
  assert.equal(fresh.step, 0);
  assert.equal(fresh.misses, 1);
  const known = Garden.plantKnown(null, 10);
  assert.equal(known.step, 3);
  assert.equal(known.planted, true);
  assert.equal(known.rarity, 'common');
  assert.equal(Garden.isThirsty(known, 10), false);
  assert.equal(Garden.isThirsty(known, 17), true);
  assert.equal(Garden.isDue(miss, 111), false);
  const due = Garden.dueWords(Garden.KINDERGARTEN, { 'rw-k-said': { step: 3, planted: true, due: 200, restDay: 0 } }, 100, false);
  assert.equal(due.some(function (w) { return w.id === 'rw-k-said'; }), false);
  assert.equal(due.some(function (w) { return w.id === 'rw-k-the'; }), true);
  assert.equal(due.some(function (w) { return w.grade === '2'; }), false);
});

test('a finished grade stays out of the claw, and the claw stops when every pool is planted', function () {
  function plant(list) {
    const cards = {};
    list.forEach(function (word) { cards[word.id] = { planted: true, step: 3 }; });
    return cards;
  }
  const open = Garden.poolReport({});
  assert.equal(open.length, 3);
  assert.equal(String(open[0].title), 'Kindergarten');
  assert.equal(open[0].total, 44);
  assert.equal(open[0].done, false);
  assert.equal(String(open[1].title), '1st grade');
  assert.equal(open[1].total, 52);
  assert.equal(open[1].done, false);
  assert.equal(String(open[2].title), '2nd grade');
  assert.equal(open[2].total, 40);
  assert.equal(open[2].done, false);
  const kindergarten = plant(Garden.KINDERGARTEN);
  const afterK = Garden.clawWords(Garden.catalog([]), kindergarten, false);
  assert.equal(afterK.pools[0].done, true);
  assert.equal(afterK.pools[1].done, false);
  assert.equal(afterK.clawOff, false);
  assert.equal(afterK.words.some(function (word) { return word.grade === 'k'; }), false);
  assert.equal(afterK.words.some(function (word) { return word.grade === '1'; }), true);
  assert.equal(afterK.words.some(function (word) { return word.grade === '2'; }), false);

  const two = plant(Garden.KINDERGARTEN.concat(Garden.FIRST));
  const exploreLeft = Garden.clawWords(Garden.catalog([]), two, false);
  assert.equal(exploreLeft.clawOff, false);
  assert.equal(exploreLeft.words.every(function (word) { return word.grade === '2'; }), true);

  const all = plant(Garden.KINDERGARTEN.concat(Garden.FIRST, Garden.EXPLORE));
  const done = Garden.clawWords(Garden.catalog([]), all, false);
  assert.equal(done.clawOff, true);
  assert.equal(done.words.length, 0);
  assert.equal(done.pools.every(function (pool) { return pool.done; }), true);

  const custom = Garden.catalog([{ id: 'c:yacht:1', w: 'yacht', red: [1] }]);
  const reopened = Garden.clawWords(custom, all, false);
  assert.equal(reopened.clawOff, false);
  assert.deepEqual(Array.from(reopened.words, function (word) { return String(word.w); }), ['yacht']);

  const fresh = Garden.catalog([], [{ weekOf: '2026-11-02', words: ['sparkle'] }]);
  const weekly = Garden.clawWords(fresh, all, true);
  assert.equal(weekly.clawOff, false);
  assert.deepEqual(Array.from(weekly.words, function (word) { return String(word.w); }), ['sparkle']);
  assert.equal(Garden.clawWords(Garden.catalog([]), all, true).clawOff, true);
});

test('the weekly block lists each dated week and only accepts the documented shape', function () {
  const start = html.indexOf('/* WEEKLY_RED_WORDS_START */');
  const end = html.indexOf('/* WEEKLY_RED_WORDS_END */');
  assert.ok(start !== -1 && end > start);
  const context = {};
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context, { filename: 'weekly.js' });
  assert.deepEqual(Array.from(context.WEEKLY_RED_WORDS).map(function (entry) {
    return { weekOf: entry.weekOf, words: Array.from(entry.words) };
  }), [
    { weekOf: '2026-10-19', words: ['far', 'goes'] },
    { weekOf: '2026-10-26', words: ['because', 'very'] },
    { weekOf: '2026-11-02', words: ['door', 'car'] }
  ]);
  assert.deepEqual(Array.from(Garden.weeklyWords(context.WEEKLY_RED_WORDS), function (word) {
    return String(word.id);
  }), [
    'rw-2w-2026-10-19-far',
    'rw-2w-2026-10-19-goes',
    'rw-2w-2026-10-26-because',
    'rw-2w-2026-10-26-very',
    'rw-2w-2026-11-02-door',
    'rw-2w-2026-11-02-car'
  ]);
  assert.equal(Garden.validateWeekly(context.WEEKLY_RED_WORDS).ok, true);
  assert.equal(Garden.validateWeekly([{ weekOf: '2026-10-30', words: ['world', 'I'] }]).ok, true);
  const weekly = Garden.weeklyWords([{ weekOf: '2026-10-30', words: ['world'] }]);
  assert.equal(weekly[0].id, 'rw-2w-2026-10-30-world');
  assert.equal(Garden.validateWeekly([{ weekOf: 'Friday', words: ['World'] }]).ok, false);
  assert.equal(Garden.validateWeekly([{ weekOf: '2026-10-30', words: [] }]).ok, false);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'docs/weekly-red-words.md'), 'utf8'), /WEEKLY_RED_WORDS_START/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'docs/recording-script.md'), 'utf8'), /rw-k-said/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'docs/recording-script.md'), 'utf8'), /audio\/letters\/a\.m4a/);
});

test('a version 2 save gains an empty garden and keeps custom words and coins', function () {
  assert.equal(typeof Save.MIGRATIONS[2], 'function');
  const out = Save.sanitize({
    v: 2,
    coins: 15,
    settings: { pin: '1111', voiceURI: 'system', voiceName: 'iPad default voice' },
    red: { custom: [{ id: 'c:yacht:1', w: 'yacht', red: [1], s: 'We saw a yacht.', ts: 4 }] }
  }).save;
  assert.equal(out.v, Save.SCHEMA);
  assert.equal(out.coins, 15);
  assert.equal(out.settings.voiceURI, 'system');
  assert.equal(out.red.custom[0].w, 'yacht');
  assert.deepEqual(Array.from(out.red.plot.owned), []);
  assert.equal(out.red.plot.explore, false);
  const junk = Save.sanitize({
    v: 3,
    settings: { pin: '1111' },
    red: {
      plot: {
        cards: { 'rw-k-said': { step: 9, planted: true, rarity: 'mythic', flower: 'rainbow-rose', shiny: true, level: 4, misses: 2, due: 20 }, '<bad>': { step: 1 } },
        owned: ['bunny', 'nope', 'bunny'],
        explore: true,
        purseAt: 50
      }
    }
  }).save;
  assert.equal(junk.red.plot.cards['rw-k-said'].step, 3);
  assert.equal(junk.red.plot.cards['rw-k-said'].flower, 'rainbow-rose');
  assert.equal(junk.red.plot.cards['<bad>'], undefined);
  assert.deepEqual(Array.from(junk.red.plot.owned), ['bunny']);
  assert.equal(junk.red.plot.explore, true);
  assert.equal(junk.red.plot.purseAt, 50);
  assert.ok(Array.isArray(junk.settings.hand));
});

test('a save that already reached version 3 from only one side keeps that side and gains the other', function () {
  const inkOnly = Save.sanitize({
    v: 3,
    coins: 7,
    settings: {
      pin: '1111',
      voiceURI: 'system',
      voiceName: 'iPad default voice',
      hand: [{ d: 9, s: [[[1, 2], [3, 40]]] }]
    }
  }).save;
  assert.equal(inkOnly.settings.hand.length, 1);
  assert.equal(inkOnly.settings.hand[0].d, 9);
  assert.equal(inkOnly.red.plot.explore, false);
  assert.deepEqual(Array.from(inkOnly.red.plot.owned), []);

  const gardenOnly = Save.sanitize({
    v: 3,
    coins: 9,
    settings: { pin: '1111', voiceURI: 'zoe-e', voiceName: 'Zoe (Enhanced)' },
    red: {
      plot: {
        cards: { 'rw-k-said': { step: 3, planted: true, rarity: 'common', flower: 'daisy', level: 2, due: 40 } },
        owned: ['chick'],
        explore: true,
        purseAt: 80
      }
    }
  }).save;
  assert.deepEqual(Array.from(gardenOnly.settings.hand), []);
  assert.equal(gardenOnly.settings.voiceURI, 'zoe-e');
  assert.equal(gardenOnly.red.plot.cards['rw-k-said'].flower, 'daisy');
  assert.equal(gardenOnly.red.plot.cards['rw-k-said'].planted, true);
  assert.deepEqual(Array.from(gardenOnly.red.plot.owned), ['chick']);

  const both = {
    v: 2,
    settings: { pin: '1111', hand: [{ d: 1, s: [[[0, 0], [0, 80]]] }] },
    red: { plot: { cards: { 'rw-k-said': { step: 1, flower: 'tulip', rarity: 'common' } }, purseAt: 10 } }
  };
  Save.MIGRATIONS[2](both);
  Save.MIGRATIONS[2](both);
  assert.equal(both.v, 3);
  assert.equal(both.settings.hand[0].d, 1);
  assert.equal(both.red.plot.cards['rw-k-said'].flower, 'tulip');
  assert.equal(both.red.plot.purseAt, 10);
  const saved = Save.sanitize(both).save;
  assert.equal(saved.v, 3);
  assert.equal(saved.settings.hand[0].d, 1);
  assert.equal(saved.red.plot.cards['rw-k-said'].step, 1);
  assert.equal(saved.red.plot.cards['rw-k-said'].flower, 'tulip');
  assert.match(html, /media-src 'self'/);
});

test('harder words land on rarer seed packets, and the wheel stops on that slot', function () {
  const easy = Garden.byId('rw-k-and', []);
  const hard = Garden.byId('rw-2-through', []);
  assert.deepEqual(Array.from(Garden.packetWeights(easy, 0)), [2, 5, 2, 1]);
  assert.deepEqual(Array.from(Garden.packetWeights(hard, 0)), [0, 1, 3, 5]);
  function tilt(word) {
    const weights = Garden.packetWeights(word, 0);
    let total = 0, sum = 0;
    weights.forEach(function (n, i) { total += n; sum += n * i; });
    return sum / total;
  }
  assert.ok(tilt(hard) > tilt(easy) + 1);
  assert.equal(Garden.pickPacket(easy, 0, 0), 'common');
  assert.equal(Garden.pickPacket(hard, 0, 0.99), 'mythic');
  assert.equal(Garden.pickPacket(easy, 0, 0.75), 'epic');
  assert.equal(Garden.slotUnder(0), 0);
  assert.equal(Garden.WHEEL_SLOTS[Garden.slotUnder(45)], 'mythic');
  const dest = Garden.stopAngle(10, 500, 'mythic');
  assert.ok(dest > 10);
  assert.equal(Garden.WHEEL_SLOTS[Garden.slotUnder(dest)], 'mythic');
  const back = Garden.stopAngle(800, -500, 'rare');
  assert.ok(back < 800);
  assert.equal(Garden.WHEEL_SLOTS[Garden.slotUnder(back)], 'rare');
});

test('a half-finished seed award is kept and junk is dropped', function () {
  const kept = Save.sanitize({
    v: 3,
    settings: { pin: '1111' },
    red: { plot: { award: { id: 'rw-k-said', phase: 'packet', rarity: 'epic', kind: 'seed' }, cards: { 'rw-k-said': { step: 1 } } } }
  }).save;
  assert.equal(kept.red.plot.award.id, 'rw-k-said');
  assert.equal(kept.red.plot.award.phase, 'packet');
  assert.equal(kept.red.plot.award.rarity, 'epic');
  assert.equal(kept.red.plot.award.kind, 'seed');
  assert.equal(kept.red.plot.cards['rw-k-said'].step, 1);
  const junk = Save.sanitize({
    v: 3,
    settings: { pin: '1111' },
    red: { plot: { award: { id: '<no>', phase: 'explode', rarity: 'ultra' } } }
  }).save;
  assert.equal(junk.red.plot.award, null);
  const thirst = Save.sanitize({
    v: 3,
    settings: { pin: '1111' },
    red: { plot: { award: { id: 'rw-k-the', phase: 'water', rarity: 'common', kind: 'thirst' } } }
  }).save;
  assert.equal(thirst.red.plot.award.kind, 'thirst');
  assert.equal(thirst.red.plot.award.phase, 'water');
});
