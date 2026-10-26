/* Jumble spell: heart parts, the deal, and the snap. No browser. */
'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const Words = require('../prototypes/jumble-spell/js/words.js');
const Table = require('../prototypes/jumble-spell/js/table.js');
const Speech = require('../prototypes/jumble-spell/js/speech.js');

const root = path.join(__dirname, '..');
const proto = path.join(root, 'prototypes', 'jumble-spell');
const IPAD = { w: 1024, h: 768 };

function tileById(state, id) {
  return state.tiles.find(function (t) { return t.id === id; });
}

function wordTiles(state) {
  return state.tiles.filter(function (t) { return !t.decoy; });
}

function drag(state, id, x, y) {
  const tile = tileById(state, id);
  const start = Table.pose(state, tile);
  assert.ok(Table.pointerDown(state, id, start.x, start.y));
  Table.pointerMove(state, start.x + 24, start.y);
  Table.pointerMove(state, x, y);
  return Table.pointerUp(state, x, y);
}

function overlaps(tile, slot) {
  const half = tile.w / 2;
  return Math.abs(tile.x - slot.cx) * 2 < tile.w + slot.w &&
    Math.abs(tile.y - slot.cy) * 2 < tile.h + slot.h;
}

function minGap(tiles) {
  let gap = Infinity;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const dx = tiles[i].x - tiles[j].x;
      const dy = tiles[i].y - tiles[j].y;
      gap = Math.min(gap, Math.sqrt(dx * dx + dy * dy));
    }
  }
  return gap;
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
    assert.ok(word.sentence.toLowerCase().includes(word.w), word.w);
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
  assert.deepEqual(Words.heartParts({ runs: Words.runsFrom(Words.parseSpec('cat')) }), []);
  assert.throws(function () { Words.parseSpec('s[ai:e'); }, /bad spec/);
});

test('a deal adds 2 to 4 decoys and keeps them off the slots', function () {
  assert.equal(Table.SNAP_RATIO, 0.62);
  assert.equal(Table.DECOY_MIN, 2);
  assert.equal(Table.DECOY_MAX, 4);
  const seen = {};
  for (let seed = 0; seed < 40; seed++) {
    const st = Table.create(Words.find('said'), IPAD, { seed: seed, still: true });
    assert.ok(st.decoyCount >= 2 && st.decoyCount <= 4);
    seen[st.decoyCount] = true;
    assert.equal(st.tiles.length, 4 + st.decoyCount);
  }
  assert.ok(seen[2] && seen[3] && seen[4]);

  const sizes = [[1024, 768], [1180, 820], [834, 1112], [900, 600]];
  Words.DEMO.forEach(function (word) {
    sizes.forEach(function (wh) {
      const st = Table.create(word, { w: wh[0], h: wh[1] }, { seed: 4, decoys: 4, still: true });
      assert.equal(st.placed, 'scatter', word.w + ' ' + wh.join('x'));
      assert.equal(st.decoyCount, 4);
      assert.equal(wordTiles(st).length, word.letters.length);
      const used = {};
      word.letters.forEach(function (L) { used[L.ch] = true; });
      st.tiles.filter(function (t) { return t.decoy; }).forEach(function (t) {
        assert.equal(used[t.ch], undefined, t.ch);
        assert.equal(t.heart, false);
      });
      st.tiles.forEach(function (t) {
        assert.ok(t.x - t.w / 2 >= 8 && t.y - t.h / 2 >= 8, word.w);
        assert.ok(t.x + t.w / 2 <= wh[0] - 8 && t.y + t.h / 2 <= wh[1] - 8, word.w);
        st.slots.forEach(function (slot) {
          assert.equal(overlaps(t, slot), false, word.w + ' ' + t.ch);
        });
      });
      assert.ok(minGap(st.tiles) >= st.tiles[0].w * 0.68);
      const rowMid = (st.slots[0].cx + st.slots[st.slots.length - 1].cx) / 2;
      assert.ok(Math.abs(rowMid - wh[0] / 2) < 2);
      const band = (st.slots[0].cy + st.slots[0].h / 2 + st.slots[0].cy - st.slots[0].h / 2) / 2;
      assert.ok(Math.abs(band - wh[1] / 2) < 2);
    });
  });

  const clamped = Table.create(Words.find('the'), IPAD, { seed: 1, decoys: 9, still: true });
  assert.equal(clamped.decoyCount, 4);
  const raised = Table.create(Words.find('the'), IPAD, { seed: 1, decoys: 1, still: true });
  assert.equal(raised.decoyCount, 2);

  const a = Table.create(Words.find('friend'), IPAD, { seed: 11, decoys: 3, still: true });
  const b = Table.create(Words.find('friend'), IPAD, { seed: 11, decoys: 3, still: true });
  assert.deepEqual(a.tiles.map(function (t) { return [t.ch, t.heart, Math.round(t.x), Math.round(t.y)]; }),
    b.tiles.map(function (t) { return [t.ch, t.heart, Math.round(t.x), Math.round(t.y)]; }));
});

test('word cards jumble out of the slots and decoys fly in from off the mat', function () {
  const st = Table.create(Words.find('said'), IPAD, { seed: 3, decoys: 3, still: false });
  assert.equal(st.phase, 'deal');
  assert.equal(Table.pointerDown(st, st.tiles[0].id, 40, 40), null);
  st.tiles.forEach(function (tile) {
    const p = Table.pose(st, tile);
    if (tile.decoy) {
      assert.ok(p.x < -1 || p.x > st.box.w + 1 || p.y < -1 || p.y > st.box.h + 1, tile.id);
    } else {
      const slot = st.slots[tile.letterIndex];
      assert.ok(Math.abs(p.x - slot.cx) < 0.6);
      assert.ok(Math.abs(p.y - slot.cy) < 0.6);
      assert.ok(Math.hypot(tile.to.x - slot.cx, tile.to.y - slot.cy) > tile.w * 0.8);
    }
  });
  const first = st.tiles[0];
  Table.step(st, first.delay + first.dur * 0.45);
  const mid = Table.pose(st, first);
  assert.ok(Math.hypot(mid.x - st.slots[0].cx, mid.y - st.slots[0].cy) > 8);
  assert.equal(st.phase, 'deal');
  Table.step(st, 3);
  assert.equal(st.phase, 'play');
  st.tiles.forEach(function (tile) {
    const p = Table.pose(st, tile);
    assert.ok(p.x > 0 && p.x < st.box.w);
    assert.ok(p.y > 0 && p.y < st.box.h);
    assert.ok(Math.hypot(p.x - tile.to.x, p.y - tile.to.y) < 0.6);
  });

  const held = Table.create(Words.find('was'), IPAD, { seed: 2, decoys: 2, still: false });
  Table.finishDeal(held);
  assert.equal(held.phase, 'play');
  assert.ok(Table.pointerDown(held, held.tiles[0].id, held.tiles[0].x, held.tiles[0].y));
  Table.pointerUp(held, held.tiles[0].x, held.tiles[0].y);
});

test('a card snaps inside the reach, parks just outside, and a miss springs back', function () {
  const st = Table.create(Words.find('said'), IPAD, { seed: 8, decoys: 3, still: true });
  const slot = st.slots[0];
  const tile = wordTiles(st)[0];
  assert.equal(tile.ch, 's');
  assert.equal(slot.ch, 's');
  const reach = Table.SNAP_RATIO * slot.w;

  // Above the row, so a neighbor slot is not the nearer catch.
  const outside = drag(st, tile.id, slot.cx, slot.cy - reach - 2);
  assert.equal(outside.kind, 'park');
  assert.equal(slot.tile, null);
  assert.equal(slot.shake, 0);
  Table.step(st, 1);
  assert.equal(overlaps(tile, slot), false);

  const inside = drag(st, tile.id, slot.cx, slot.cy - (reach - 1));
  assert.equal(inside.kind, 'snap');
  assert.equal(slot.tile, tile.id);
  assert.equal(tile.slot, 0);
  Table.step(st, 1);
  assert.ok(Math.abs(tile.x - slot.cx) < 0.6);
  assert.ok(Math.abs(tile.y - slot.cy) < 0.6);
  assert.equal(tile.rot, 0);

  const decoy = st.tiles.find(function (t) { return t.decoy; });
  const decoyHome = { x: decoy.x, y: decoy.y };
  const others = st.tiles.filter(function (t) { return t.id !== decoy.id; }).map(function (t) {
    return { id: t.id, x: t.x, y: t.y, slot: t.slot };
  });
  const miss = drag(st, decoy.id, slot.cx, slot.cy);
  assert.equal(miss.kind, 'miss');
  assert.equal(slot.tile, tile.id, 'the letter already home stays put');
  assert.ok(slot.shake > 0.2);
  Table.step(st, 0.08);
  assert.ok(Math.abs(Table.shakeOffset(st.slots[0])) > 1);
  Table.step(st, 1);
  assert.equal(st.slots[0].shake, 0);
  assert.equal(Table.shakeOffset(st.slots[0]), 0);
  assert.ok(Math.abs(decoy.x - decoyHome.x) < 0.6);
  assert.ok(Math.abs(decoy.y - decoyHome.y) < 0.6);
  others.forEach(function (prev) {
    const now = tileById(st, prev.id);
    assert.equal(now.slot, prev.slot);
    assert.ok(Math.abs(now.x - prev.x) < 0.6);
    assert.ok(Math.abs(now.y - prev.y) < 0.6);
  });
  assert.equal(st.misses, undefined);
});

test('the heart e will not sit in the plain e slot, and identical letters can trade', function () {
  const because = Table.create(Words.find('because'), IPAD, { seed: 2, decoys: 2, still: true });
  const heartE = because.tiles.find(function (t) { return t.ch === 'e' && t.heart && !t.decoy; });
  const plainE = because.tiles.find(function (t) { return t.ch === 'e' && !t.heart && !t.decoy; });
  const plainSlot = because.slots.find(function (s) { return s.ch === 'e' && !s.heart; });
  const heartSlot = because.slots.find(function (s) { return s.ch === 'e' && s.heart; });
  const bounced = Table.dropOn(because, heartE.id, plainSlot.cx, plainSlot.cy);
  assert.equal(bounced.kind, 'miss');
  assert.equal(plainSlot.tile, null);
  assert.equal(heartSlot.tile, null);
  const seated = Table.dropOn(because, heartE.id, heartSlot.cx, heartSlot.cy);
  assert.equal(seated.kind, 'snap');
  assert.equal(heartSlot.tile, heartE.id);
  const plainSeated = Table.dropOn(because, plainE.id, plainSlot.cx, plainSlot.cy);
  assert.equal(plainSeated.kind, 'snap');

  const oo = Table.create({
    w: 'oo',
    letters: [{ ch: 'o', red: false }, { ch: 'o', red: false }]
  }, IPAD, { seed: 1, decoys: 2, still: true });
  const pair = wordTiles(oo);
  const first = Table.dropOn(oo, pair[0].id, oo.slots[1].cx, oo.slots[1].cy);
  assert.equal(first.kind, 'snap');
  assert.equal(oo.slots[1].tile, pair[0].id);
  const crowded = Table.dropOn(oo, pair[1].id, oo.slots[1].cx, oo.slots[1].cy);
  assert.equal(crowded.kind, 'miss');
  assert.equal(oo.slots[1].tile, pair[0].id);
  const second = Table.dropOn(oo, pair[1].id, oo.slots[0].cx, oo.slots[0].cy);
  assert.equal(second.kind, 'snap');
  assert.equal(second.done, true);
  assert.equal(oo.phase, 'done');
});

test('any order finishes the word, and lifting a card opens the slot again', function () {
  const st = Table.create(Words.find('they'), IPAD, { seed: 6, decoys: 2, still: true });
  const tiles = wordTiles(st);
  for (let i = tiles.length - 1; i >= 0; i--) {
    const slot = st.slots[tiles[i].letterIndex];
    const result = Table.dropOn(st, tiles[i].id, slot.cx, slot.cy);
    assert.equal(result.kind, 'snap');
    if (i > 0) assert.equal(result.done, false);
    else assert.equal(result.done, true);
  }
  assert.equal(Table.isDone(st), true);
  assert.equal(st.phase, 'done');

  const lifted = tiles[0];
  const slot = st.slots[lifted.letterIndex];
  Table.pointerDown(st, lifted.id, slot.cx, slot.cy);
  Table.pointerMove(st, slot.cx + 30, slot.cy);
  assert.equal(slot.tile, null);
  assert.equal(st.phase, 'play');
  const parked = Table.pointerUp(st, 48, 48);
  assert.equal(parked.kind, 'park');
  assert.equal(Table.isDone(st), false);

  const back = Table.dropOn(st, lifted.id, slot.cx, slot.cy);
  assert.equal(back.kind, 'snap');
  assert.equal(back.done, true);

  const tap = Table.pointerDown(st, lifted.id, slot.cx, slot.cy);
  assert.ok(tap);
  const held = Table.pointerUp(st, slot.cx + 2, slot.cy + 1);
  assert.equal(held.kind, 'tap');
  assert.equal(slot.tile, lifted.id);
});

test('a wrong nearest slot misses even if another slot would have matched', function () {
  const st = Table.create(Words.find('said'), IPAD, { seed: 5, decoys: 2, still: true });
  const s = wordTiles(st)[0];
  const aSlot = st.slots[1];
  assert.equal(aSlot.ch, 'a');
  const miss = drag(st, s.id, aSlot.cx, aSlot.cy);
  assert.equal(miss.kind, 'miss');
  assert.equal(st.slots[0].tile, null);
  assert.equal(aSlot.tile, null);
});

test('the preview glow is only the slot that would catch the card', function () {
  const st = Table.create(Words.find('was'), IPAD, { seed: 9, decoys: 2, still: true });
  const tile = wordTiles(st)[0];
  const slot = st.slots[0];
  const start = Table.pose(st, tile);
  Table.pointerDown(st, tile.id, start.x, start.y);
  Table.pointerMove(st, slot.cx, slot.cy);
  const ready = Table.preview(st, tile);
  assert.equal(ready.ok, true);
  assert.equal(ready.index, slot.i);
  const decoy = st.tiles.find(function (t) { return t.decoy; });
  Table.pointerUp(st, start.x, start.y);
  const d0 = Table.pose(st, decoy);
  Table.pointerDown(st, decoy.id, d0.x, d0.y);
  Table.pointerMove(st, slot.cx, slot.cy);
  const nope = Table.preview(st, decoy);
  assert.equal(nope.ok, false);
  Table.pointerMove(st, 30, 30);
  assert.equal(Table.preview(st, decoy), null);
  Table.pointerUp(st, 30, 30);
});

test('resize keeps a seated letter on the new slot center', function () {
  const st = Table.create(Words.find('come'), IPAD, { seed: 4, decoys: 2, still: true });
  const tile = wordTiles(st)[0];
  Table.dropOn(st, tile.id, st.slots[0].cx, st.slots[0].cy);
  Table.step(st, 1);
  const free = wordTiles(st)[1];
  const nx = free.x / st.box.w;
  Table.resize(st, { w: IPAD.w * 1.2, h: IPAD.h * 0.85 });
  assert.equal(st.slots[0].tile, tile.id);
  assert.ok(Math.abs(tile.x - st.slots[0].cx) < 0.6);
  assert.ok(Math.abs(tile.y - st.slots[0].cy) < 0.6);
  assert.ok(Math.abs(free.x / st.box.w - nx) < 0.02);
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
  assert.equal(calls[0].text, 'said');
  assert.equal(calls[0].voice, zoe);
  assert.equal(calls[0].lang, 'en-US');
  assert.equal(Speech.speak('', { synth: {}, Utterance: function () {} }), false);
  const src = fs.readFileSync(path.join(proto, 'js', 'speech.js'), 'utf8');
  assert.equal(src.includes('fetch('), false);
  assert.equal(src.includes('new Audio'), false);
  assert.equal(src.includes('XMLHttpRequest'), false);
});

test('the page is self-contained, ungraded, and kept off the main app', function () {
  const html = fs.readFileSync(path.join(proto, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(proto, 'style.css'), 'utf8');
  const app = fs.readFileSync(path.join(proto, 'js', 'app.js'), 'utf8');
  const table = fs.readFileSync(path.join(proto, 'js', 'table.js'), 'utf8');
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
  assert.match(html, /src="js\/table.js"/);
  assert.match(html, /href="style.css"/);
  assert.match(css, /fonts\/fredoka-latin\.woff2/);
  assert.match(css, /dotted/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.equal(fs.existsSync(path.join(proto, 'fonts', 'fredoka-latin.woff2')), true);
  assert.equal(fs.existsSync(path.join(proto, 'fonts', 'OFL.txt')), true);

  [html, css, app, table].forEach(function (blob) {
    assert.equal(/https?:\/\//.test(blob), false);
    assert.equal(blob.includes('letter-play'), false);
    assert.equal(blob.includes('prize-crack'), false);
    assert.equal(blob.includes('red-words'), false);
    assert.equal(blob.includes('cole/'), false);
    assert.equal(blob.includes('localStorage'), false);
    assert.equal(blob.includes('fetch('), false);
  });
  assert.doesNotMatch(app, /leitner|handwriting|indexedDB|score|accuracy|percent/i);
  assert.match(app, /You spelled /);
  assert.match(app, /bounced back/);
  assert.match(readme, /https:\/\/thelearningquest\.github\.io\/Start\/prototypes\/jumble-spell\//);
  assert.match(readme, /s\[ai:e\]d/);
  assert.match(readme, /SNAP_RATIO/);
  assert.match(readme, /0\.62/);
  assert.equal(rootHtml.includes('jumble-spell'), false);
});
