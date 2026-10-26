/* Letter-play ribbons. No canvas and no network. */
'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const Words = require('../prototypes/letter-play/js/words.js');
const Forms = require('../prototypes/letter-play/js/letters.js');
const Ribbon = require('../prototypes/letter-play/js/ribbon.js');
const Speech = require('../prototypes/letter-play/js/speech.js');

const root = path.join(__dirname, '..');
const proto = path.join(root, 'prototypes', 'letter-play');

function shift(poly, dx, dy) {
  return poly.map(function (p) { return { x: p.x + dx, y: p.y + dy }; });
}

function rotate(poly, k) {
  const n = poly.length;
  const i = ((k % n) + n) % n;
  return poly.slice(i).concat(poly.slice(0, i));
}

function paintPolys(sheet, polys) {
  polys.forEach(function (poly) { Ribbon.paint(sheet, poly); });
  return sheet;
}

function pageOf(ch, heart, box) {
  return Ribbon.layout([{ ch: ch, heart: !!heart }], box || { x: 0, y: 0, w: 420, h: 520 });
}

test('demo specs use the bracket heart parts', function () {
  const want = {
    said: ['ai'],
    the: ['e'],
    because: ['au', 'e'],
    was: ['a'],
    they: ['ey'],
    friend: ['ie'],
    come: ['o', 'e'],
    one: ['one']
  };
  assert.deepEqual(Words.DEMO.map(function (w) { return w.w; }), Object.keys(want));
  Words.DEMO.forEach(function (word) {
    assert.deepEqual(Words.heartParts(word), want[word.w]);
    assert.equal(Words.find(word.w).id, word.id);
    assert.equal(Words.find(word.id).spec, word.spec);
  });
  const said = Words.find('said');
  assert.equal(said.spec, 's[ai:e]d');
  assert.equal(said.parts[0].sound, 'e');
  assert.equal(said.runs[1].heart, true);
  const because = Words.find('because');
  assert.equal(because.spec, 'bec[au:u]s[e:]');
  assert.equal(because.parts[0].sound, 'u');
  assert.equal(because.parts[1].sound, '');
  assert.equal(because.letters.filter(function (L) { return L.red; }).map(function (L) { return L.ch; }).join(''), 'aue');
  const one = Words.find('one');
  assert.equal(one.parts[0].sound, 'wun');
  assert.equal(one.letters.every(function (L) { return L.red; }), true);
});

test('every demo letter has a ribbon, and a heart does not change the shape', function () {
  const seen = {};
  Words.DEMO.forEach(function (word) {
    word.letters.forEach(function (L) {
      const form = Forms.get(L.ch);
      assert.ok(form && form.length > 0, L.ch);
      assert.ok(form[0].length > 0, L.ch);
      seen[L.ch] = true;
    });
  });
  assert.ok(seen.a && seen.y && seen.s);
  const box = { x: 0, y: 0, w: 400, h: 480 };
  const plain = Ribbon.layout([{ ch: 'a', heart: false }], box);
  const heart = Ribbon.layout([{ ch: 'a', heart: true }], box);
  assert.equal(plain.total, heart.total);
  assert.equal(plain.letters[0].heart, false);
  assert.equal(heart.letters[0].heart, true);
  assert.equal(plain.letters[0].stamps[0].x, heart.letters[0].stamps[0].x);
  assert.equal(plain.letters[0].stamps[0].y, heart.letters[0].stamps[0].y);
  assert.ok(plain.brush >= Ribbon.FINGER);
});

test('half the ribbon is enough, a tap is not, and a blank letter blocks a word', function () {
  assert.ok(Ribbon.COVER <= 0.55);
  assert.ok(Ribbon.COVER >= 0.45);
  assert.equal(Ribbon.judge({
    covered: 50, total: 100, length: 80, need: 40,
    letters: [{ ratio: 1 }]
  }).done, true);
  assert.equal(Ribbon.judge({
    covered: 49, total: 100, length: 80, need: 40,
    letters: [{ ratio: 0.49 }]
  }).done, false);
  assert.equal(Ribbon.judge({
    covered: 100, total: 100, length: 10, need: 40,
    letters: [{ ratio: 1 }]
  }).done, false);
  assert.equal(Ribbon.judge({
    covered: 80, total: 100, length: 200, need: 40,
    letters: [{ ratio: 0.9 }, { ratio: 0.05 }]
  }).done, false);
  assert.equal(Ribbon.judge({
    covered: 80, total: 100, length: 200, need: 40,
    letters: [{ ratio: 0.7 }, { ratio: Ribbon.FLOOR }]
  }).done, true);

  const l = pageOf('l');
  const mid = l.letters[0].stamps[Math.floor(l.letters[0].stamps.length / 2)];
  Ribbon.paint(l, [{ x: mid.x, y: mid.y }]);
  assert.equal(l.done, false);
  assert.equal(l.length, 0);
});

test('the ribbon forgives direction, order, and a fingertip past the edge', function () {
  const box = { x: 10, y: 8, w: 430, h: 540 };
  const forward = pageOf('o', false, box);
  paintPolys(forward, forward.letters[0].polys);
  assert.equal(forward.done, true);
  assert.ok(forward.ratio + 1e-9 >= Ribbon.COVER);

  const backward = pageOf('o', true, box);
  const reversed = backward.letters[0].polys.map(function (poly) { return poly.slice().reverse(); });
  paintPolys(backward, reversed);
  assert.equal(backward.done, true);

  const spun = pageOf('o', false, box);
  const turned = spun.letters[0].polys.map(function (poly) { return rotate(poly, Math.floor(poly.length / 3)); });
  paintPolys(spun, turned);
  assert.equal(spun.done, true, 'starting partway around the ribbon still finishes');

  const tee = pageOf('t', false, box);
  assert.ok(tee.letters[0].polys.length >= 2);
  paintPolys(tee, tee.letters[0].polys.slice().reverse());
  assert.equal(tee.done, true);

  const near = pageOf('l', false, box);
  const reach = near.letters[0].stamps[0].r + near.brush;
  const inside = near.letters[0].stamps[0].r + near.brush * 0.45;
  assert.ok(inside > near.letters[0].stamps[0].r, 'the test stroke sits outside the visible ribbon');
  assert.ok(inside < reach);
  paintPolys(near, near.letters[0].polys.map(function (poly) { return shift(poly, inside, 0); }));
  assert.equal(near.done, true);

  const far = pageOf('l', false, box);
  const outside = far.letters[0].stamps[0].r + far.brush + Ribbon.STEP * far.letters[0].scale + 24;
  paintPolys(far, far.letters[0].polys.map(function (poly) { return shift(poly, outside, 0); }));
  assert.equal(far.covered, 0);
  assert.equal(far.done, false);
  assert.ok(far.length > far.need);
});

test('misses never remove paint, and one blank letter keeps the word unfinished', function () {
  const messy = pageOf('a', true);
  const before = messy.covered;
  Ribbon.paint(messy, [
    { x: -200, y: -200 },
    { x: -40, y: 800 },
    { x: 900, y: 10 }
  ]);
  assert.equal(messy.covered, before);
  assert.equal(messy.done, false);
  paintPolys(messy, messy.letters[0].polys);
  const filled = messy.covered;
  assert.equal(messy.done, true);
  Ribbon.paint(messy, [{ x: 2000, y: 2000 }, { x: 2100, y: 2400 }]);
  assert.equal(messy.covered, filled);

  const word = Words.find('because');
  const sheet = Ribbon.layout(word.letters.map(function (L) {
    return { ch: L.ch, heart: L.red };
  }), { x: 0, y: 0, w: 980, h: 360 });
  assert.equal(sheet.letters.length, 7);
  assert.equal(sheet.letters[3].heart, true);
  assert.equal(sheet.letters[3].ch, 'a');
  assert.equal(sheet.letters[6].heart, true);
  const keep = sheet.letters.slice(0, 6);
  keep.forEach(function (L) { paintPolys(sheet, L.polys); });
  assert.equal(sheet.letters[6].ratio, 0);
  assert.equal(sheet.done, false);
  paintPolys(sheet, sheet.letters[6].polys);
  assert.equal(sheet.done, true);
});

test('speech picks Zoe and never builds an audio element', function () {
  const zoe = { name: 'Zoe (Enhanced)', lang: 'en-US', voiceURI: 'com.apple.voice.enhanced.en-US.Zoe' };
  const plain = { name: 'Zoe', lang: 'en-GB', voiceURI: 'Zoe' };
  const other = { name: 'Samantha', lang: 'en-US', voiceURI: 'Samantha' };
  assert.equal(Speech.pickReader([other, plain, zoe]), zoe);
  assert.equal(Speech.pickReader([other]), null);
  assert.equal(Speech.baseName('Zoey (Premium)'), 'zoe');

  const calls = [];
  const ok = Speech.speak('said', {
    synth: {
      cancel: function () {},
      speak: function (u) { calls.push(u); },
      paused: false
    },
    Utterance: function (text) { this.text = text; },
    voices: [other, zoe]
  });
  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].text, 'said');
  assert.equal(calls[0].voice, zoe);
  assert.equal(calls[0].lang, 'en-US');
  assert.equal(Speech.speak('', { synth: {}, Utterance: function () {} }), false);

  const src = fs.readFileSync(path.join(proto, 'js', 'speech.js'), 'utf8');
  assert.equal(src.includes('fetch('), false);
  assert.equal(src.includes('Audio'), false);
  assert.equal(src.includes('XMLHttpRequest'), false);
});

test('the page is self-contained, ungraded, and kept off the main app', function () {
  const html = fs.readFileSync(path.join(proto, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(proto, 'style.css'), 'utf8');
  const app = fs.readFileSync(path.join(proto, 'js', 'app.js'), 'utf8');
  const readme = fs.readFileSync(path.join(proto, 'README.md'), 'utf8');
  const rootHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  assert.match(html, /script-src 'self'/);
  assert.match(html, /style-src 'self'/);
  assert.match(html, /font-src 'self'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /media-src 'none'/);
  assert.doesNotMatch(html, /unsafe-inline/);
  assert.doesNotMatch(html, /<style/);
  assert.doesNotMatch(html, /\sstyle="/);
  assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)/);
  assert.match(html, /src="js\/words.js"/);
  assert.match(html, /src="js\/ribbon.js"/);
  assert.match(html, /href="style.css"/);
  assert.match(css, /fonts\/fredoka-latin\.woff2/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.equal(fs.existsSync(path.join(proto, 'fonts', 'fredoka-latin.woff2')), true);
  assert.equal(fs.existsSync(path.join(proto, 'fonts', 'OFL.txt')), true);

  [html, css, app].forEach(function (blob) {
    assert.equal(/https?:\/\//.test(blob), false);
    assert.equal(blob.includes('prize-crack'), false);
    assert.equal(blob.includes('red-words'), false);
    assert.equal(blob.includes('cole/'), false);
  });
  assert.doesNotMatch(app, /try again|wrong|score|accuracy|percent/i);
  assert.match(app, /You painted it/);
  assert.match(readme, /https:\/\/thelearningquest\.github\.io\/Start\/prototypes\/letter-play\//);
  assert.match(readme, /s\[ai:e\]d/);
  assert.match(readme, /FINGER/);
  assert.equal(rootHtml.includes('letter-play'), false);
});
