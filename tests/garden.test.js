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
  assert.equal(all.length, 136);
  const seen = {};
  all.forEach(function (w) {
    assert.equal(seen[w.id], undefined, w.id);
    seen[w.id] = 1;
    assert.match(w.id, /^rw-(k|1|2)-/);
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
  assert.equal(custom.length, 137);
  assert.equal(custom[136].id, 'c:yacht:1');
  assert.equal(custom[136].pathway, true);
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

test('the weekly block is empty and only accepts the documented shape', function () {
  const start = html.indexOf('/* WEEKLY_RED_WORDS_START */');
  const end = html.indexOf('/* WEEKLY_RED_WORDS_END */');
  assert.ok(start !== -1 && end > start);
  const context = {};
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context, { filename: 'weekly.js' });
  assert.deepEqual(Array.from(context.WEEKLY_RED_WORDS), []);
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
});
