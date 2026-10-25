/* Swipe paging for the standalone gardens prototype. No WebGL. */
'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const P = require('../prototypes/gardens/js/pager.js');
const root = path.join(__dirname, '..');
const proto = path.join(root, 'prototypes', 'gardens');

function arrive(state) {
  for (let i = 0; i < 360; i++) P.step(state, 1 / 60);
}

test('kindergarten, 1st, and 2nd are separate gardens in that order', function () {
  assert.deepEqual(P.GARDENS.map(function (g) { return g.short; }), ['K', '1st', '2nd']);
  assert.deepEqual(P.GARDENS.map(function (g) { return g.title; }), ['Kindergarten', '1st grade', '2nd grade']);
  const ids = P.GARDENS.map(function (g) { return g.id; });
  assert.equal(new Set(ids).size, 3);
});

test('one viewport of sideways drag equals one garden', function () {
  assert.equal(P.logicalFromDrag(0, 800, 800, 1000), 0);
  assert.equal(P.logicalFromDrag(0, 900, 100, 800), 1);
  assert.equal(P.logicalFromDrag(1, 200, 600, 800), 0.5);
  assert.equal(P.logicalFromDrag(0, 10, 10, 0), 0);
});

test('a flick advances one garden, a short drag returns, the midpoint commits', function () {
  assert.equal(P.settleTarget(0.2, 2, 0, 3), 1);
  assert.equal(P.settleTarget(0.2, 0.1, 0, 3), 0);
  assert.equal(P.settleTarget(0.62, 0, 0, 3), 1);
  assert.equal(P.settleTarget(1.7, 2, 0, 3), 2);
  assert.equal(P.settleTarget(0.8, -2, 1, 3), 0);
  assert.equal(P.settleTarget(-0.4, -3, 0, 3), 0);
  assert.equal(P.settleTarget(2.8, 3, 2, 3), 2);

  const flick = P.createState({ width: 1000 });
  P.pointerDown(flick, 900, 0);
  P.pointerMove(flick, 700, 0.016);
  P.pointerMove(flick, 480, 0.032);
  P.pointerUp(flick, 480, 0.048);
  assert.equal(flick.target, 1);
  arrive(flick);
  assert.equal(flick.offset, 1);
  assert.equal(flick.arrived, true);
  assert.equal(P.nearest(flick), 1);

  const slow = P.createState({ width: 1000, index: 1 });
  P.pointerDown(slow, 500, 5);
  P.pointerMove(slow, 540, 5.1);
  P.pointerMove(slow, 590, 5.2);
  P.pointerUp(slow, 590, 5.22);
  assert.equal(slow.target, 1);
});

test('holding still after a drag does not count as a flick', function () {
  const s = P.createState({ width: 800 });
  P.pointerDown(s, 400, 1);
  P.pointerMove(s, 250, 1.04);
  P.pointerUp(s, 250, 1.4);
  assert.equal(s.target, 0);
  assert.ok(s.offset > 0.15 && s.offset < 0.25, s.offset);
});

test('the ends rubber-band and spring home', function () {
  assert.ok(P.rubberOffset(-2, 3) > -0.42);
  assert.ok(P.rubberOffset(-2, 3) < 0);
  assert.ok(P.rubberOffset(4, 3) < 2.42);
  assert.ok(P.rubberOffset(4, 3) > 2);
  assert.equal(P.rubberOffset(1.2, 3), 1.2);

  const s = P.createState({ width: 500 });
  P.pointerDown(s, 100, 0);
  P.pointerMove(s, 700, 0.03);
  assert.ok(s.offset < 0);
  assert.ok(s.offset > -0.42);
  P.pointerUp(s, 700, 0.04);
  assert.equal(s.target, 0);
  arrive(s);
  assert.equal(s.offset, 0);

  const end = P.createState({ width: 500, index: 2 });
  P.pointerDown(end, 400, 0);
  P.pointerMove(end, 20, 0.02);
  assert.ok(end.offset < 2.42);
  assert.ok(end.offset > 2);
  P.pointerUp(end, 20, 0.03);
  assert.equal(end.target, 2);
});

test('the spring arrives without stepping into the next garden', function () {
  function peak(reduced) {
    const s = P.createState({ reduced: reduced });
    s.target = 1;
    s.arrived = false;
    let hi = 0;
    let t = 0;
    let settled = 99;
    for (let i = 0; i < 360; i++) {
      P.step(s, 1 / 60);
      t += 1 / 60;
      if (s.offset > hi) hi = s.offset;
      if (settled === 99 && s.arrived) settled = t;
    }
    assert.equal(s.offset, 1);
    assert.ok(hi < 1.02, hi);
    return settled;
  }
  const calm = peak(true);
  const plain = peak(false);
  assert.ok(calm < plain, calm + ' vs ' + plain);
  assert.ok(calm < 0.75, calm);
  assert.ok(plain < 1.05, plain);

  const mid = P.createState();
  mid.target = 1;
  mid.arrived = false;
  for (let i = 0; i < 27; i++) P.step(mid, 1 / 60);
  assert.ok(mid.offset > 0.85, mid.offset);
});

test('a drag freezes the spring, and goTo stays inside the row', function () {
  const s = P.createState();
  s.offset = 0.25;
  s.target = 1;
  s.dragging = true;
  P.step(s, 1 / 60);
  assert.equal(s.offset, 0.25);
  P.goTo(s, 8);
  assert.equal(s.target, 2);
  assert.equal(s.dragging, false);
  P.goTo(s, -3);
  assert.equal(s.target, 0);
  arrive(s);
  assert.equal(s.offset, 0);
});

test('the page is self-contained and offline', function () {
  const html = fs.readFileSync(path.join(proto, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(proto, 'style.css'), 'utf8');
  const pager = fs.readFileSync(path.join(proto, 'js', 'pager.js'), 'utf8');
  const world = fs.readFileSync(path.join(proto, 'js', 'world.js'), 'utf8');
  const three = fs.readFileSync(path.join(proto, 'vendor', 'three.min.js'));
  const canonical = fs.readFileSync(path.join(root, 'red-words', 'three.min.js'));
  assert.ok(three.equals(canonical));
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /style-src 'self'/);
  assert.equal(html.includes('unsafe-inline'), false);
  assert.equal(html.includes('wasm-unsafe-eval'), false);
  assert.match(html, /vendor\/three\.min\.js/);
  assert.match(html, /js\/pager\.js/);
  assert.match(html, /js\/world\.js/);
  assert.match(html, />K</);
  assert.match(html, />1st</);
  assert.match(html, />2nd</);
  assert.match(html, /Kindergarten/);
  [html, css, pager, world].forEach(function (src) {
    assert.equal(src.includes('https://'), false);
    assert.equal(src.includes('http://'), false);
    assert.equal(src.includes('localStorage'), false);
    assert.equal(src.includes('speechSynthesis'), false);
    assert.equal(src.includes('leitner'), false);
    assert.equal(src.includes('eval('), false);
    assert.equal(src.includes('new Function'), false);
    assert.equal(src.includes('WebAssembly'), false);
  });
  const threeText = three.toString('utf8');
  assert.ok(threeText.includes('SPDX-License-Identifier: MIT'));
  assert.equal(threeText.includes('WebAssembly'), false);
});
