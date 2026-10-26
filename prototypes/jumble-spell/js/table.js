/* Jumble spell table. No DOM and no network.

   Deal
   One card per letter of the word, then 2, 3, or 4 decoys.
   A decoy is a letter that does not appear in the word, so it
   never matches a slot. Heart letters (the bracket parts) are marked.
   The word cards start in the dotted slots and jumble out to the table.
   Decoys start off the table and fly in. Scatter spots stay off the slots.

   Drag
   A press arms the card. It starts moving after 8 CSS pixels.
   Lifting a card out of a slot opens that slot at once.
   Letting go on the open table parks the card there (clamped on the mat).
   That is not a miss.

   Snap
   Only the nearest slot can catch a card.
   The card center must be within SNAP_RATIO (0.62) of that slot's side.
   The slot must be empty. The letter must match. The heart must match,
   so the pink e in "because" does not sit in the plain e's slot.
   Two cards with the same letter and the same heart can trade slots.
   A snap locks the card to the slot center and straightens it.
   Slots may be filled in any order.

   Miss
   If that nearest slot is inside the snap reach but the letter is different,
   the heart does not match, or the slot is full, the slot shakes for SHAKE
   seconds (0.32) and the card springs back to where the drag started.
   A card picked up from a slot returns to that slot.
   Nothing is counted against her. A decoy always misses. */
(function (root) {
  'use strict';

  var SNAP_RATIO = 0.62;
  var DECOY_MIN = 2;
  var DECOY_MAX = 4;
  var SHAKE = 0.32;
  var TILT = 16;
  var ARM = 8;

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hash(str) {
    var h = 2166136261;
    var i;
    str = String(str || '');
    for (i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function shuffle(list, rng) {
    var i, j, tmp;
    for (i = list.length - 1; i > 0; i--) {
      j = Math.floor(rng() * (i + 1));
      tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeOutBack(t) {
    var c1 = 1.15;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function clamp(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  function lettersOf(word) {
    var out = [];
    var src = word && word.letters ? word.letters : [];
    var i, ch;
    for (i = 0; i < src.length; i++) {
      ch = String(src[i].ch || '').toLowerCase();
      if (ch.length !== 1) continue;
      out.push({ ch: ch, heart: !!(src[i].red || src[i].heart) });
    }
    return out;
  }

  function slotGeometry(letters, box) {
    var count = letters.length;
    var edge = Math.max(18, Math.round(Math.min(box.w, box.h) * 0.025));
    var avail = Math.max(40, box.w - edge * 2);
    var gapR = 0.18;
    var slot = avail / (count + gapR * Math.max(0, count - 1));
    var maxH = Math.min(148, box.h * 0.36);
    if (slot > maxH) slot = maxH;
    var gap = slot * gapR;
    var rowW = count * slot + Math.max(0, count - 1) * gap;
    if (rowW > avail) {
      var k = avail / rowW;
      slot *= k;
      gap *= k;
      rowW = avail;
    }
    var x0 = (box.w - rowW) / 2;
    var y0 = (box.h - slot) / 2;
    var slots = [];
    var i, x, y;
    for (i = 0; i < count; i++) {
      x = x0 + i * (slot + gap);
      y = y0;
      slots.push({
        i: i,
        ch: letters[i].ch,
        heart: !!letters[i].heart,
        x: x,
        y: y,
        w: slot,
        h: slot,
        cx: x + slot / 2,
        cy: y + slot / 2,
        tile: null,
        shake: 0
      });
    }
    return {
      slots: slots,
      slot: slot,
      edge: edge,
      card: slot * 0.86
    };
  }

  function hitsSlot(cx, cy, size, slots, gap) {
    var i, s;
    for (i = 0; i < slots.length; i++) {
      s = slots[i];
      if (Math.abs(cx - s.cx) * 2 < size + s.w + gap * 2 &&
          Math.abs(cy - s.cy) * 2 < size + s.h + gap * 2) return true;
    }
    return false;
  }

  function inside(cx, cy, size, box, edge) {
    var half = size / 2;
    return cx - half >= edge && cy - half >= edge &&
      cx + half <= box.w - edge && cy + half <= box.h - edge;
  }

  function scatterSpots(box, slots, card, count, rng) {
    var edge = Math.max(18, Math.round(Math.min(box.w, box.h) * 0.025));
    var guard = Math.max(8, card * 0.1);
    var slotTop = slots[0].y - guard;
    var slotBot = slots[0].y + slots[0].h + guard;
    var rowLeft = slots[0].x - guard;
    var rowRight = slots[slots.length - 1].x + slots[slots.length - 1].w + guard;
    var regions = [];
    if (slotTop - edge > card * 0.72) regions.push({ x: edge, y: edge, w: box.w - edge * 2, h: slotTop - edge });
    if (box.h - edge - slotBot > card * 0.72) regions.push({ x: edge, y: slotBot, w: box.w - edge * 2, h: box.h - edge - slotBot });
    if (rowLeft - edge > card * 0.8) regions.push({ x: edge, y: slotTop, w: rowLeft - edge, h: slotBot - slotTop });
    if (box.w - edge - rowRight > card * 0.8) regions.push({ x: rowRight, y: slotTop, w: box.w - edge - rowRight, h: slotBot - slotTop });
    if (!regions.length) regions.push({ x: edge, y: edge, w: Math.max(1, box.w - edge * 2), h: Math.max(1, box.h - edge * 2) });

    var candidates = [];
    var r, c, rows, cols, reg, cw, rh, jx, jy, x, y;
    for (r = 0; r < regions.length; r++) {
      reg = regions[r];
      cols = Math.max(1, Math.floor(reg.w / (card * 0.92)));
      rows = Math.max(1, Math.floor(reg.h / (card * 0.92)));
      cw = reg.w / cols;
      rh = reg.h / rows;
      for (var rr = 0; rr < rows; rr++) {
        for (c = 0; c < cols; c++) {
          jx = (rng() - 0.5) * cw * 0.62;
          jy = (rng() - 0.5) * rh * 0.62;
          x = reg.x + cw * (c + 0.5) + jx;
          y = reg.y + rh * (rr + 0.5) + jy;
          x = clamp(x, edge + card / 2, box.w - edge - card / 2);
          y = clamp(y, edge + card / 2, box.h - edge - card / 2);
          if (!inside(x, y, card, box, edge)) continue;
          if (hitsSlot(x, y, card, slots, 4)) continue;
          candidates.push({ x: x, y: y, rot: (rng() * 2 - 1) * TILT });
        }
      }
    }
    shuffle(candidates, rng);

    function take(minDist) {
      var spots = [];
      var i, k, ok, dx, dy, need;
      need = minDist * minDist;
      for (i = 0; i < candidates.length && spots.length < count; i++) {
        ok = true;
        for (k = 0; k < spots.length; k++) {
          dx = spots[k].x - candidates[i].x;
          dy = spots[k].y - candidates[i].y;
          if (dx * dx + dy * dy < need) { ok = false; break; }
        }
        if (ok) spots.push(candidates[i]);
      }
      return spots;
    }

    var spots = take(card * 0.84);
    var how = 'scatter';
    if (spots.length < count) {
      spots = take(card * 0.7);
    }
    if (spots.length < count) {
      how = 'fallback';
      var used = {};
      var n;
      for (n = 0; n < spots.length; n++) used[spots[n].x + ',' + spots[n].y] = true;
      for (n = 0; n < candidates.length && spots.length < count; n++) {
        var key = candidates[n].x + ',' + candidates[n].y;
        if (used[key]) continue;
        used[key] = true;
        spots.push(candidates[n]);
      }
      var extra = 0;
      while (spots.length < count) {
        spots.push({
          x: clamp(edge + card / 2 + (extra % 5) * card * 0.72, edge + card / 2, box.w - edge - card / 2),
          y: clamp(box.h - edge - card / 2 - Math.floor(extra / 5) * card * 0.4, edge + card / 2, box.h - edge - card / 2),
          rot: ((extra % 5) - 2) * 4
        });
        extra++;
      }
    }
    return { spots: spots.slice(0, count), how: how };
  }

  function offstage(box, edge, along) {
    var m = Math.max(72, Math.min(box.w, box.h) * 0.12);
    if (edge === 0) return { x: -m, y: along * box.h, rot: -18 };
    if (edge === 1) return { x: box.w + m, y: along * box.h, rot: 16 };
    if (edge === 2) return { x: along * box.w, y: -m, rot: -10 };
    return { x: along * box.w, y: box.h + m, rot: 12 };
  }

  function chooseCount(rng, forced) {
    if (forced == null || forced === '') return DECOY_MIN + Math.floor(rng() * (DECOY_MAX - DECOY_MIN + 1));
    var n = Math.round(Number(forced));
    if (!isFinite(n)) return DECOY_MIN + Math.floor(rng() * (DECOY_MAX - DECOY_MIN + 1));
    if (n < DECOY_MIN) n = DECOY_MIN;
    if (n > DECOY_MAX) n = DECOY_MAX;
    return n;
  }

  function pickDecoys(letters, count, rng) {
    var used = {};
    var i, ch, pool;
    for (i = 0; i < letters.length; i++) used[letters[i].ch] = true;
    pool = [];
    for (i = 0; i < 26; i++) {
      ch = String.fromCharCode(97 + i);
      if (!used[ch]) pool.push(ch);
    }
    shuffle(pool, rng);
    return pool.slice(0, count);
  }

  function byId(state, id) {
    var i;
    for (i = 0; i < state.tiles.length; i++) if (state.tiles[i].id === id) return state.tiles[i];
    return null;
  }

  function isDone(state) {
    var i;
    if (!state || !state.slots.length) return false;
    for (i = 0; i < state.slots.length; i++) if (!state.slots[i].tile) return false;
    return true;
  }

  function syncPhase(state) {
    if (!state || state.phase === 'deal') return;
    state.phase = isDone(state) ? 'done' : 'play';
  }

  function create(word, box, opts) {
    opts = opts || {};
    box = { w: Math.max(1, Number(box.w) || 1), h: Math.max(1, Number(box.h) || 1) };
    var letters = lettersOf(word);
    var joined = '';
    for (i = 0; i < letters.length; i++) joined += letters[i].ch;
    var seed = opts.seed == null || opts.seed === '' ? hash((word && word.w) || joined) : (Number(opts.seed) >>> 0);
    var rng = mulberry32(seed);
    var decoyCount = chooseCount(rng, opts.decoys);
    var decoyChars = pickDecoys(letters, decoyCount, rng);
    var geom = slotGeometry(letters, box);
    var scattered = scatterSpots(box, geom.slots, geom.card, letters.length + decoyCount, rng);
    var spots = scattered.spots;
    shuffle(spots, rng);
    var tiles = [];
    var i, spot, tile, from;
    for (i = 0; i < letters.length; i++) {
      spot = spots[i];
      tile = {
        id: 'w' + i,
        n: i,
        ch: letters[i].ch,
        heart: !!letters[i].heart,
        decoy: false,
        letterIndex: i,
        w: geom.card,
        h: geom.card,
        tilt: spot.rot,
        from: { x: geom.slots[i].cx, y: geom.slots[i].cy, rot: 0 },
        to: { x: spot.x, y: spot.y, rot: spot.rot },
        x: spot.x,
        y: spot.y,
        rot: spot.rot,
        slot: null,
        delay: 0.2 + i * 0.045,
        dur: 0.58,
        dragging: false,
        armed: false,
        anim: null
      };
      tiles.push(tile);
    }
    for (i = 0; i < decoyChars.length; i++) {
      spot = spots[letters.length + i];
      from = offstage(box, i % 4, rng());
      tile = {
        id: 'd' + i,
        n: letters.length + i,
        ch: decoyChars[i],
        heart: false,
        decoy: true,
        letterIndex: -1,
        w: geom.card,
        h: geom.card,
        tilt: spot.rot,
        from: from,
        to: { x: spot.x, y: spot.y, rot: spot.rot },
        x: spot.x,
        y: spot.y,
        rot: spot.rot,
        slot: null,
        delay: 0.38 + i * 0.08,
        dur: 0.64,
        dragging: false,
        armed: false,
        anim: null
      };
      tiles.push(tile);
    }

    var state = {
      w: (word && word.w) || '',
      id: (word && word.id) || '',
      letters: letters,
      box: box,
      seed: seed,
      decoyCount: decoyCount,
      placed: scattered.how,
      slots: geom.slots,
      tiles: tiles,
      phase: 'deal',
      time: 0,
      pending: null
    };

    var still = !!opts.still || !!opts.filled;
    if (still) finishDeal(state);
    if (opts.filled) {
      for (i = 0; i < tiles.length; i++) {
        tile = tiles[i];
        if (tile.decoy) continue;
        var slot = state.slots[tile.letterIndex];
        slot.tile = tile.id;
        tile.slot = slot.i;
        tile.x = slot.cx;
        tile.y = slot.cy;
        tile.rot = 0;
        tile.anim = null;
      }
      state.phase = 'done';
    }
    return state;
  }

  function pose(state, tile) {
    var x = tile.x;
    var y = tile.y;
    var rot = tile.rot;
    var scale = 1;
    var up = false;
    var z = tile.slot != null ? 4 : 8 + tile.n;
    if (tile.dragging) {
      x = tile.x;
      y = tile.y;
      rot = 0;
      scale = 1.14;
      up = true;
      z = 70;
    } else if (tile.anim) {
      var u = tile.anim.dur > 0 ? tile.anim.t / tile.anim.dur : 1;
      if (u < 0) u = 0;
      if (u > 1) u = 1;
      var e = tile.anim.ease === 'back' ? easeOutBack(u) : easeOutCubic(u);
      x = tile.anim.from.x + (tile.anim.to.x - tile.anim.from.x) * e;
      y = tile.anim.from.y + (tile.anim.to.y - tile.anim.from.y) * e;
      rot = tile.anim.from.rot + (tile.anim.to.rot - tile.anim.from.rot) * e;
      if (tile.anim.ease === 'back') scale = 1 + Math.sin(u * Math.PI) * 0.08;
      up = true;
      z = 30;
    } else if (state.phase === 'deal') {
      var local = tile.dur <= 0 ? 1 : (state.time - tile.delay) / tile.dur;
      if (local < 0) local = 0;
      if (local > 1) local = 1;
      var e2 = easeOutBack(local);
      x = tile.from.x + (tile.to.x - tile.from.x) * e2;
      y = tile.from.y + (tile.to.y - tile.from.y) * e2;
      rot = tile.from.rot + (tile.to.rot - tile.from.rot) * e2;
    }
    if (tile.armed && !tile.dragging) {
      scale = 1.06;
      up = true;
      z = 60;
    }
    return { x: x, y: y, rot: rot, scale: scale, z: z, up: up };
  }

  function finishDeal(state) {
    if (!state || state.phase !== 'deal') return state;
    var i, tile;
    for (i = 0; i < state.tiles.length; i++) {
      tile = state.tiles[i];
      tile.x = tile.to.x;
      tile.y = tile.to.y;
      tile.rot = tile.to.rot;
      tile.anim = null;
      tile.dragging = false;
      tile.armed = false;
    }
    state.time = 999;
    state.phase = 'play';
    state.pending = null;
    return state;
  }

  function step(state, dt) {
    if (!state || !(dt > 0)) return state;
    var i, tile, slot;
    if (state.phase === 'deal') {
      state.time += dt;
      var all = true;
      for (i = 0; i < state.tiles.length; i++) {
        tile = state.tiles[i];
        if (state.time < tile.delay + tile.dur) all = false;
      }
      if (all) finishDeal(state);
    }
    for (i = 0; i < state.tiles.length; i++) {
      tile = state.tiles[i];
      if (tile.anim) {
        tile.anim.t += dt;
        if (tile.anim.t >= tile.anim.dur) tile.anim = null;
      }
    }
    for (i = 0; i < state.slots.length; i++) {
      slot = state.slots[i];
      if (slot.shake > 0) slot.shake = Math.max(0, slot.shake - dt);
    }
    return state;
  }

  function shakeOffset(slot) {
    if (!slot || !(slot.shake > 0)) return 0;
    var u = 1 - slot.shake / SHAKE;
    if (u < 0) u = 0;
    if (u > 1) u = 1;
    return Math.sin(u * Math.PI * 3) * 8 * (1 - u);
  }

  function nearestSlot(state, x, y) {
    var best = null;
    var bestD = Infinity;
    var i, s, dx, dy, d;
    for (i = 0; i < state.slots.length; i++) {
      s = state.slots[i];
      dx = x - s.cx;
      dy = y - s.cy;
      d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (!best) return null;
    return { slot: best, dist: bestD };
  }

  function accepts(slot, tile) {
    return !!slot && !!tile && slot.tile == null && slot.ch === tile.ch && !!slot.heart === !!tile.heart;
  }

  function reachOf(slot) {
    return SNAP_RATIO * slot.w;
  }

  function clampCenter(x, y, tile, box) {
    var edge = 8;
    var half = tile.w / 2;
    return {
      x: clamp(x, edge + half, box.w - edge - half),
      y: clamp(y, edge + half, box.h - edge - half)
    };
  }

  function clearOfSlots(x, y, tile, slots, box) {
    var gap = 6;
    var pass, i, s, half, penL, penR, penT, penB, minPen;
    half = tile.w / 2;
    for (pass = 0; pass < 2; pass++) {
      for (i = 0; i < slots.length; i++) {
        s = slots[i];
        var l = x - half;
        var t = y - half;
        var r = x + half;
        var b = y + half;
        var L = s.x - gap;
        var T = s.y - gap;
        var R = s.x + s.w + gap;
        var B = s.y + s.h + gap;
        if (!(l < R && r > L && t < B && b > T)) continue;
        penL = r - L;
        penR = R - l;
        penT = b - T;
        penB = B - t;
        minPen = Math.min(penL, penR, penT, penB);
        if (minPen === penT) y -= penT;
        else if (minPen === penB) y += penB;
        else if (minPen === penL) x -= penL;
        else x += penR;
      }
      var c = clampCenter(x, y, tile, box);
      x = c.x;
      y = c.y;
    }
    return { x: x, y: y };
  }

  function resolve(state, tile, home) {
    var near = nearestSlot(state, tile.x, tile.y);
    var from = { x: tile.x, y: tile.y, rot: tile.rot };
    if (near && near.dist <= reachOf(near.slot)) {
      if (accepts(near.slot, tile)) {
        var slot = near.slot;
        slot.tile = tile.id;
        tile.slot = slot.i;
        tile.x = slot.cx;
        tile.y = slot.cy;
        tile.rot = 0;
        tile.anim = { from: from, to: { x: slot.cx, y: slot.cy, rot: 0 }, t: 0, dur: 0.22, ease: 'back' };
        syncPhase(state);
        return { kind: 'snap', slot: slot.i, ch: tile.ch, done: state.phase === 'done' };
      }
      near.slot.shake = SHAKE;
      var backSlot = null;
      if (home && home.slot != null && state.slots[home.slot] && state.slots[home.slot].tile == null) {
        backSlot = state.slots[home.slot];
      }
      var to;
      if (backSlot) {
        backSlot.tile = tile.id;
        tile.slot = backSlot.i;
        to = { x: backSlot.cx, y: backSlot.cy, rot: 0 };
      } else {
        tile.slot = null;
        to = {
          x: home ? home.x : tile.x,
          y: home ? home.y : tile.y,
          rot: home ? home.rot : tile.tilt
        };
      }
      tile.x = to.x;
      tile.y = to.y;
      tile.rot = to.rot;
      tile.anim = { from: from, to: to, t: 0, dur: 0.36, ease: 'out' };
      syncPhase(state);
      return { kind: 'miss', slot: near.slot.i, ch: tile.ch, done: false };
    }
    var parked = clearOfSlots(tile.x, tile.y, tile, state.slots, state.box);
    var rot = home && home.slot == null ? home.rot : tile.tilt;
    tile.slot = null;
    tile.x = parked.x;
    tile.y = parked.y;
    tile.rot = rot;
    tile.anim = {
      from: from,
      to: { x: parked.x, y: parked.y, rot: rot },
      t: 0,
      dur: 0.16,
      ease: 'out'
    };
    syncPhase(state);
    return { kind: 'park', ch: tile.ch, done: false };
  }

  function pointerDown(state, id, x, y) {
    if (!state || state.phase === 'deal' || state.pending) return null;
    var tile = byId(state, id);
    if (!tile) return null;
    var p = pose(state, tile);
    tile.anim = null;
    tile.x = p.x;
    tile.y = p.y;
    tile.rot = p.rot;
    tile.armed = true;
    state.pending = {
      id: id,
      x: x,
      y: y,
      ox: p.x,
      oy: p.y,
      orot: p.rot,
      slot: tile.slot
    };
    return { kind: 'down', id: id };
  }

  function pointerMove(state, x, y) {
    if (!state || !state.pending) return null;
    var pending = state.pending;
    var tile = byId(state, pending.id);
    if (!tile) return null;
    var dx = x - pending.x;
    var dy = y - pending.y;
    if (!tile.dragging) {
      if (dx * dx + dy * dy < ARM * ARM) return null;
      tile.dragging = true;
      tile.anim = null;
      if (tile.slot != null) {
        state.slots[tile.slot].tile = null;
        tile.slot = null;
        syncPhase(state);
      }
      tile.grab = { dx: pending.x - pending.ox, dy: pending.y - pending.oy };
    }
    tile.x = x - tile.grab.dx;
    tile.y = y - tile.grab.dy;
    tile.rot = 0;
    return { kind: 'move', id: tile.id };
  }

  function pointerUp(state, x, y) {
    if (!state || !state.pending) return null;
    var pending = state.pending;
    state.pending = null;
    var tile = byId(state, pending.id);
    if (!tile) return null;
    tile.armed = false;
    if (!tile.dragging) {
      tile.x = pending.ox;
      tile.y = pending.oy;
      tile.rot = pending.orot;
      return { kind: 'tap', id: tile.id, ch: tile.ch };
    }
    tile.dragging = false;
    tile.x = x - tile.grab.dx;
    tile.y = y - tile.grab.dy;
    return resolve(state, tile, {
      x: pending.ox,
      y: pending.oy,
      rot: pending.orot,
      slot: pending.slot
    });
  }

  function dropOn(state, id, x, y) {
    if (!state || state.phase === 'deal') return null;
    var tile = byId(state, id);
    if (!tile) return null;
    var p = pose(state, tile);
    tile.anim = null;
    tile.dragging = false;
    tile.armed = false;
    state.pending = null;
    var home = { x: p.x, y: p.y, rot: p.rot, slot: tile.slot };
    if (tile.slot != null) {
      state.slots[tile.slot].tile = null;
      tile.slot = null;
    }
    tile.x = x;
    tile.y = y;
    tile.rot = 0;
    return resolve(state, tile, home);
  }

  function hit(state, x, y) {
    if (!state || state.phase === 'deal') return null;
    var i, tile, p, half;
    for (i = state.tiles.length - 1; i >= 0; i--) {
      tile = state.tiles[i];
      if (!tile.dragging && !tile.armed) continue;
      p = pose(state, tile);
      half = tile.w / 2;
      if (Math.abs(x - p.x) <= half && Math.abs(y - p.y) <= half) return tile.id;
    }
    for (i = state.tiles.length - 1; i >= 0; i--) {
      tile = state.tiles[i];
      p = pose(state, tile);
      half = tile.w / 2;
      if (Math.abs(x - p.x) <= half && Math.abs(y - p.y) <= half) return tile.id;
    }
    return null;
  }

  function hitSlot(state, x, y) {
    if (!state || state.phase === 'deal') return null;
    var i, s;
    for (i = state.slots.length - 1; i >= 0; i--) {
      s = state.slots[i];
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return s;
    }
    return null;
  }

  function preview(state, tile) {
    if (!state || !tile || !tile.dragging || state.phase === 'deal') return null;
    var near = nearestSlot(state, tile.x, tile.y);
    if (!near || near.dist > reachOf(near.slot)) return null;
    return { index: near.slot.i, ok: accepts(near.slot, tile) };
  }

  function resize(state, box) {
    if (!state || !(box.w > 0) || !(box.h > 0)) return state;
    var sx = box.w / state.box.w;
    var sy = box.h / state.box.h;
    var seated = [];
    var i;
    for (i = 0; i < state.slots.length; i++) seated.push(state.slots[i].tile);
    var geom = slotGeometry(state.letters, box);
    state.box = { w: box.w, h: box.h };
    state.slots = geom.slots;
    for (i = 0; i < seated.length && i < state.slots.length; i++) state.slots[i].tile = seated[i];
    for (i = 0; i < state.tiles.length; i++) {
      var tile = state.tiles[i];
      tile.w = geom.card;
      tile.h = geom.card;
      if (!tile.decoy && state.slots[tile.letterIndex]) {
        var origin = state.slots[tile.letterIndex];
        tile.from = { x: origin.cx, y: origin.cy, rot: 0 };
      } else {
        tile.from = {
          x: tile.from.x * sx,
          y: tile.from.y * sy,
          rot: tile.from.rot
        };
      }
      tile.to = { x: tile.to.x * sx, y: tile.to.y * sy, rot: tile.to.rot };
      if (tile.slot != null && state.slots[tile.slot]) {
        var s = state.slots[tile.slot];
        tile.x = s.cx;
        tile.y = s.cy;
        tile.rot = 0;
        if (tile.anim) {
          tile.anim.to = { x: s.cx, y: s.cy, rot: 0 };
        }
      } else if (state.phase === 'deal') {
        tile.x = tile.to.x;
        tile.y = tile.to.y;
      } else {
        tile.x *= sx;
        tile.y *= sy;
        var c = clampCenter(tile.x, tile.y, tile, state.box);
        tile.x = c.x;
        tile.y = c.y;
        if (tile.anim) {
          tile.anim.from.x *= sx;
          tile.anim.from.y *= sy;
          tile.anim.to.x *= sx;
          tile.anim.to.y *= sy;
        }
      }
    }
    return state;
  }

  var api = {
    SNAP_RATIO: SNAP_RATIO,
    DECOY_MIN: DECOY_MIN,
    DECOY_MAX: DECOY_MAX,
    SHAKE: SHAKE,
    TILT: TILT,
    ARM: ARM,
    create: create,
    step: step,
    pose: pose,
    shakeOffset: shakeOffset,
    finishDeal: finishDeal,
    pointerDown: pointerDown,
    pointerMove: pointerMove,
    pointerUp: pointerUp,
    dropOn: dropOn,
    hit: hit,
    hitSlot: hitSlot,
    preview: preview,
    resize: resize,
    isDone: isDone
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.JumbleTable = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
