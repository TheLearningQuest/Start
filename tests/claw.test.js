/* Claw skill is what she sees: centered and still is a clean grab. */
'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const World = require('../red-words/world.js');
const Strokes = require('../red-words/strokes.js');
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

test('every letter she traces has an ordered stroke and a spoken cue', function () {
  const letters = 'abcdefghijklmnopqrstuvwxyzI'.split('');
  letters.forEach(function (ch) {
    const strokes = Strokes.get(ch);
    assert.ok(strokes && strokes.length, ch);
    strokes.forEach(function (stroke) {
      assert.ok(stroke.cue, ch);
      assert.ok(stroke.pts && stroke.pts.length, ch);
      stroke.pts.forEach(function (p) {
        assert.ok(p[0] > -5 && p[0] < 120, ch + ' x ' + p[0]);
        assert.ok(p[1] > -5 && p[1] < 160, ch + ' y ' + p[1]);
      });
    });
  });
  const magic = Strokes.get('c')[0].pts;
  assert.ok(magic[3][1] < magic[0][1], 'magic c climbs before it curls');
  assert.equal(Strokes.get("'"), null);
});

test('the page keeps the offline policy and loads the canvas game from this site', function () {
  assert.match(html, /script-src 'self' 'unsafe-inline'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /media-src 'self'/);
  assert.match(html, /src="red-words\/draw.js"/);
  assert.match(html, /src="red-words\/strokes.js"/);
  assert.match(html, /src="red-words\/world.js"/);
  assert.match(html, /phase: 'wheel'/);
  assert.match(html, /phase = 'packet'/);
  assert.match(html, /phase: 'water'/);
  assert.match(html, /kind: 'seed'/);
  assert.match(html, /kind: 'thirst'/);
  assert.match(html, /G\.sessionResult/);
  assert.equal(html.includes('https://'), false);
});
