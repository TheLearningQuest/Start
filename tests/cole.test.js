/* Cole's prototype: save migration, tracing, swatches, and the strict CSP.
   The page is one HTML file, so the pure helpers are the marked blocks. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'cole', 'index.html'), 'utf8');

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

const Save = loadBlock('COLE_SAVE_MODULE_START');
const Trace = loadBlock('COLE_TRACE_MODULE_START');
const Explore = loadBlock('COLE_EXPLORE_MODULE_START');

test('inline scripts all parse', function () {
  const blocks = scriptBlocks();
  assert.ok(blocks.length >= 4);
  blocks.forEach(function (src, i) {
    new vm.Script(src, { filename: 'cole-inline-' + i + '.js' });
  });
});

test('the page is strict, local, and separate from Naomi', function () {
  assert.match(html, /default-src 'none'/);
  assert.match(html, /script-src 'unsafe-inline'/);
  assert.match(html, /style-src 'unsafe-inline'/);
  assert.match(html, /img-src 'self' data:/);
  assert.match(html, /media-src 'self'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.match(html, /base-uri 'none'/);
  assert.equal((html.match(/https?:\/\//g) || []).length, 0);
  assert.equal(html.indexOf('fetch('), -1);
  assert.equal(html.indexOf('XMLHttpRequest'), -1);
  assert.equal(html.indexOf('WebSocket'), -1);
  assert.equal(html.indexOf('naomiMathQuest'), -1);
  assert.match(html, /coleQuest\.v1/);
  assert.match(html, /\.\.\/audio\/letters\//);
  assert.match(html, /audio\/q-float\.m4a/);
  const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'recording-script.md'), 'utf8');
  assert.match(doc, /rw-k-said/);
  assert.match(doc, /audio\/letters\/a\.m4a/);
  assert.match(doc, /## Cole/);
  assert.match(doc, /cole\/audio\/n0\.m4a/);
  assert.match(doc, /cole\/audio\/n10\.m4a/);
  assert.match(doc, /Which one floats\?/);
});

test('a version 0 save becomes version 1 and keeps stars and tracing', function () {
  assert.equal(typeof Save.MIGRATIONS[0], 'function');
  assert.equal(Save.SCHEMA, 1);
  assert.equal(Save.KEY, 'coleQuest.v1');
  const raw = {
    stars: 4,
    swatch: 'blue',
    sound: false,
    avatar: { head: 'hat' },
    trace: { L: { stage: 1, wins: 1, mastered: false } }
  };
  Save.migrate(raw);
  assert.equal(raw.v, 1);
  assert.equal(raw.trace.L.stage, 1);
  Save.MIGRATIONS[0](raw);
  assert.equal(raw.stars, 4);
  assert.equal(raw.trace.L.wins, 1);
  const out = Save.sanitize(raw).save;
  assert.equal(out.v, 1);
  assert.equal(out.stars, 4);
  assert.equal(out.sound, false);
  assert.equal(out.swatch, 'blue');
  assert.equal(out.avatar.head, 'hat');
  assert.equal(out.trace.L.stage, 1);
  assert.equal(out.trace.L.wins, 1);
  assert.equal(out.trace.L.mastered, false);
  assert.deepEqual(Array.from(Save.SWATCH_IDS), Array.from(Trace.SWATCHES, function (s) { return s.id; }));
});

test('sanitize drops junk and keeps a save that is already version 1', function () {
  assert.equal(Save.sanitize(null).ok, false);
  assert.equal(Save.sanitize([]).ok, false);
  assert.equal(Save.sanitize('nope').ok, false);
  const junk = Save.sanitize({
    v: 1,
    stars: 5000,
    swatch: 'plaid',
    sound: false,
    hello: 'x',
    avatar: { head: 'hat', hand: 'sword' },
    trace: { '<bad>': { stage: 9, wins: -3 }, A: { stage: 2, wins: 4, mastered: true } },
    explorer: { float: true, '<no>': true },
    gallery: [
      { id: 'tree', fills: { crown: 'green', '<x>': 'blue' }, ink: [{ color: 'blue', pts: [[1, 2], [200, -5], [3]] }] },
      { id: 'nope', fills: { crown: 'red' } }
    ]
  }).save;
  assert.equal(junk.stars, 999);
  assert.equal(junk.swatch, 'red');
  assert.equal(junk.sound, false);
  assert.equal(junk.hello, undefined);
  assert.equal(junk.avatar.head, 'hat');
  assert.equal(junk.avatar.hand, 'sword');
  const poor = Save.sanitize({ v: 1, stars: 0, avatar: { head: 'hat', hand: 'sword' } }).save;
  assert.equal(poor.avatar.head, '');
  assert.equal(poor.avatar.hand, '');
  const almost = Save.sanitize({ v: 1, stars: 6, avatar: { hand: 'sword', off: 'shield' } }).save;
  assert.equal(almost.avatar.hand, '');
  assert.equal(almost.avatar.off, '');
  assert.equal(junk.trace['<bad>'], undefined);
  assert.equal(junk.trace.A.stage, 2);
  assert.equal(junk.trace.A.mastered, true);
  assert.equal(junk.explorer.float, true);
  assert.equal(junk.explorer['<no>'], undefined);
  assert.equal(junk.gallery.length, 1);
  assert.equal(junk.gallery[0].id, 'tree');
  assert.equal(junk.gallery[0].fills.crown, 'green');
  assert.equal(junk.gallery[0].fills['<x>'], undefined);
  const pts = Array.from(junk.gallery[0].ink[0].pts, function (p) { return Array.from(p); });
  assert.deepEqual(pts, [[1, 2], [100, 0]]);
  const partial = Save.sanitize({ v: 1, stars: 3 }).save;
  assert.equal(partial.stars, 3);
  assert.ok(Array.isArray(partial.gallery));
  assert.equal(partial.swatch, 'red');
  assert.equal(Save.unlocked(2, 'hat'), true);
  assert.equal(Save.unlocked(1, 'hat'), false);
  assert.equal(Save.unlocked(8, 'excavator'), true);
  assert.equal(Save.unlocked(7, 'excavator'), false);
  assert.equal(Save.unlocked(7, 'sword'), true);
  assert.equal(Save.unlocked(7, 'shield'), true);
});

test('five swatches resolve, and an unknown color falls back', function () {
  assert.equal(Trace.SWATCHES.length, 5);
  const ids = Array.from(Trace.SWATCHES, function (s) { return s.id; });
  assert.deepEqual(ids, ['red', 'orange', 'yellow', 'green', 'blue']);
  assert.equal(Trace.selectSwatch('blue').hex, '#3b82f6');
  assert.equal(Trace.selectSwatch('yellow').id, 'yellow');
  assert.equal(Trace.selectSwatch('nope').id, 'red');
  assert.equal(Trace.selectSwatch('').id, 'red');
});

test('tracing scores a real stroke, rejects a scribble, and advances stages', function () {
  assert.equal(Trace.ORDER.length, 63);
  Trace.ORDER.forEach(function (id) {
    const g = Trace.glyph(id);
    assert.ok(g && g.strokes.length >= 1, id);
    g.strokes.forEach(function (stroke) {
      assert.ok(stroke.length >= 2, id);
    });
  });
  const L = Trace.glyph('L');
  assert.equal(Trace.scoreStroke(L.strokes[0], L.strokes[0], 16, 0.7).ok, true);
  const noisy = L.strokes[0].map(function (p) { return [p[0] + 6, p[1]]; });
  assert.equal(Trace.scoreStroke(L.strokes[0], noisy, 16, 0.7).ok, true);
  const far = L.strokes[0].map(function (p) { return [p[0] + 30, p[1]]; });
  const missed = Trace.scoreStroke(L.strokes[0], far, 16, 0.7);
  assert.equal(missed.ok, false);
  const start = L.strokes[0][0];
  const scribble = [start, [start[0] + 2, start[1] + 2], [90, 10], [92, 12]];
  const shape = Trace.scoreStroke(L.strokes[0], scribble, 16, 0.7);
  assert.equal(shape.ok, false);
  assert.equal(shape.reason, 'shape');
  const backwards = L.strokes[0].slice().reverse();
  assert.equal(Trace.scoreStroke(L.strokes[0], backwards, 16, 0.7).ok, false);
  assert.equal(Trace.scoreAttempt(L, L.strokes, { tolerance: 16, need: 0.7 }).ok, true);
  assert.equal(Trace.scoreAttempt(L, [L.strokes[1], L.strokes[0]], { tolerance: 16, need: 0.7 }).ok, false);
  assert.equal(Trace.scoreAttempt(L, [L.strokes[0]], { tolerance: 16 }).ok, false);

  let card = { stage: 0, wins: 0, mastered: false };
  const seen = [];
  for (let i = 0; i < 4; i++) {
    const step = Trace.progressAfter(card, true);
    seen.push(step.card.stage + ':' + step.card.mastered + ':' + step.earned);
    card = step.card;
  }
  assert.deepEqual(seen, ['1:false:1', '2:false:1', '3:false:1', '3:true:1']);
  const stay = Trace.progressAfter(card, true);
  assert.equal(stay.earned, 0);
  assert.equal(stay.card.mastered, true);
  assert.equal(stay.card.stage, 3);
  const fail = Trace.progressAfter({ stage: 1, wins: 2, mastered: false }, false);
  assert.equal(fail.card.stage, 1);
  assert.equal(fail.card.wins, 2);
  assert.equal(fail.earned, 0);
  assert.equal(Trace.stageName(0), 'guide');
  assert.equal(Trace.stageName(1), 'fade');
  assert.equal(Trace.stageName(2), 'dot');
  assert.equal(Trace.stageName(3), 'free');
  assert.equal(Trace.suggested({}), 'A');
  assert.equal(Trace.suggested({ A: { mastered: true } }), 'B');
  assert.equal(Trace.nextGlyph('Z'), 'a');
  assert.equal(Trace.nextGlyph('z'), '0');
  assert.equal(Trace.nextGlyph('9'), '10');
  assert.match(Trace.stageLine('A', 0), /^A\. Trace on the dots/);
  assert.match(Trace.stageLine('A', 0), /arrow/);
  assert.match(Trace.stageLine('10', 3), /^ten\. Write it in the box/);
  assert.equal(Trace.nameClip('b'), '../audio/letters/b.m4a');
  assert.equal(Trace.nameClip('7'), 'audio/n7.m4a');
  assert.equal(Trace.nameClip('10'), 'audio/n10.m4a');
  assert.equal(Trace.spokenName('a'), 'A');
  assert.equal(Trace.spokenName('4'), 'four');
});

test('explorer questions are picture choices with one right answer', function () {
  assert.ok(Explore.QUESTIONS.length >= 6);
  Explore.QUESTIONS.forEach(function (q) {
    assert.ok(q.choices.length >= 2 && q.choices.length <= 4, q.id);
    const right = q.choices.filter(function (c) { return c.ok; });
    assert.equal(right.length, 1, q.id);
    assert.match(q.say, /\?$/);
  });
  assert.equal(Explore.correct('float', 'boat'), true);
  assert.equal(Explore.correct('float', 'rock'), false);
  assert.equal(Explore.correct('seed', 'flower'), true);
  assert.equal(Explore.correct('water', 'fish'), true);
  assert.equal(Explore.correct('water', 'dog'), false);
  assert.equal(Explore.correct('next', 'circle'), true);
  assert.equal(Explore.correct('next', 'triangle'), false);
  assert.equal(Explore.correct('bigger', 'elephant'), true);
  assert.equal(Explore.correct('sort', 'apple'), true);
  assert.equal(Explore.correct('sort', 'shoe'), false);
  assert.equal(Explore.correct('missing', 'boat'), false);
});
