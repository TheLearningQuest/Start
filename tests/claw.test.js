/* Claw skill is what she sees: centered and still is a clean grab. */
'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const World = require('../red-words/world.js');
const Strokes = require('../red-words/strokes.js');
const Trace = require('../red-words/trace.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('a still centered claw cleans, a swing slips, and empty air misses', function () {
  const caps = [{ x: 200, r: 40 }, { x: 320, r: 40 }];
  const clean = World.judgeGrab(200, caps, 0, 0);
  assert.equal(clean.result, 'clean');
  assert.equal(clean.index, 0);
  const nudge = World.judgeGrab(230, caps, 0, 0);
  assert.equal(nudge.result, 'slip');
  assert.equal(nudge.index, 0);
  assert.match(nudge.hint, /left|right/);
  const swing = World.judgeGrab(200, caps, 0.4, 0);
  assert.equal(swing.result, 'slip');
  assert.match(swing.hint, /still/);
  const air = World.judgeGrab(20, caps, 0, 0);
  assert.equal(air.result, 'miss');
});

test('the pendulum settles after a shove and a hard flick swings it', function () {
  const hung = { theta: 0.45, omega: 0 };
  for (let i = 0; i < 240; i++) World.stepPendulum(hung, 1 / 60, 0, 80, false);
  assert.ok(Math.abs(hung.theta) < 0.05, hung.theta);
  assert.ok(Math.abs(hung.omega) < 0.2, hung.omega);
  const flicked = { theta: 0, omega: 0 };
  for (let i = 0; i < 15; i++) World.stepPendulum(flicked, 1 / 60, 2800, 80, false);
  assert.ok(Math.abs(flicked.theta) > 0.08, flicked.theta);
});

test('tracing a word is a wide ribbon across the whole word, not a perfect letter path', function () {
  const box = { x: 0, y: 0, w: 640, h: 240 };
  const as = Trace.layoutWord('as', box);
  assert.equal(as.cells.length, 2);
  assert.equal(as.cells[0].ch, 'a');
  assert.equal(as.cells[1].ch, 's');
  const dab = Trace.traceReady(as, [{ x: as.cells[0].x + 2, y: as.cells[0].y + 2 }]);
  assert.equal(dab.done, false);
  const wrote = Trace.traceReady(as, [
    { x: as.cells[0].cx, y: as.cells[0].cy },
    { x: as.cells[1].cx, y: as.cells[1].cy }
  ]);
  assert.equal(wrote.done, true);
  assert.ok(wrote.ratio >= 0.75);
  const above = Trace.traceReady(as, [
    { x: as.cells[0].cx, y: as.cells[0].y - 80 },
    { x: as.cells[1].cx, y: as.cells[1].y - 80 }
  ]);
  assert.equal(above.done, false);
  const word = Trace.layoutWord('they', box);
  assert.equal(word.cells.length, 4);
  const fast = Trace.traceReady(word, [
    { x: word.cells[0].cx, y: word.cells[0].cy },
    { x: word.cells[3].cx, y: word.cells[3].cy }
  ]);
  assert.equal(fast.done, true, 'a fast swipe still covers the letters in between');
  const one = Trace.layoutWord('a', box);
  assert.equal(Trace.traceReady(one, [{ x: one.cells[0].cx, y: one.cells[0].cy }]).done, false);
  const stroke = Trace.traceReady(one, [
    { x: one.cells[0].cx - one.cells[0].w * 0.3, y: one.cells[0].cy },
    { x: one.cells[0].cx + one.cells[0].w * 0.3, y: one.cells[0].cy }
  ]);
  assert.equal(stroke.done, true);
  const dont = Trace.layoutWord("don't", box);
  assert.deepEqual(dont.cells.map(function (c) { return c.ch; }), ['d', 'o', 'n', 't']);
  assert.equal(Strokes.get("'"), null);
  const said = JSON.stringify(Strokes.all);
  ['Magic c!', 'Dive down, up, around', 'Big line, little lines'].forEach(function (phrase) {
    assert.ok(said.includes(phrase), phrase);
  });
});

test('the page keeps the offline policy and loads the canvas game from this site', function () {
  assert.match(html, /script-src 'self' 'unsafe-inline'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /media-src 'self'/);
  assert.match(html, /src="red-words\/draw.js"/);
  assert.match(html, /src="red-words\/strokes.js"/);
  assert.match(html, /src="red-words\/trace.js"/);
  assert.match(html, /src="red-words\/three.min.js"/);
  assert.match(html, /src="red-words\/world.js"/);
  assert.equal(html.includes('wasm-unsafe-eval'), false);
  assert.equal(html.includes('unpkg.com'), false);
  const three = fs.readFileSync(path.join(__dirname, '..', 'red-words', 'three.min.js'), 'utf8');
  assert.ok(three.includes('SPDX-License-Identifier: MIT'));
  assert.equal(three.includes('are deprecated'), false);
  assert.equal(three.includes('eval('), false);
  assert.equal(three.includes('new Function'), false);
  assert.equal(three.includes('WebAssembly'), false);
  assert.match(html, /phase: 'wheel'/);
  assert.match(html, /phase = 'packet'/);
  assert.match(html, /phase: 'water'/);
  assert.match(html, /kind: 'seed'/);
  assert.match(html, /kind: 'thirst'/);
  assert.match(html, /G\.sessionResult/);
  assert.equal(html.includes('https://'), false);
});
