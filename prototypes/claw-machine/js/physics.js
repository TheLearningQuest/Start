/* Standalone toy-claw physics. No rendering, no network.
   The claw is a pendulum hung from a trolley. A grab is clean only when
   the swing has died and the bite sits in the middle of one resting toy.
   An off-center bite slips and kicks the toy. A fast swing knocks it aside.
   After a grab, the prize has to be carried, calm, over the front hole. */
(function (root) {
  'use strict';

  var RAIL_Y = 1.46;
  var BITE = 0.115;
  var PRIZE_R = 0.145;
  var IDLE_CABLE = 0.66;
  var DROP_CABLE = RAIL_Y - PRIZE_R - BITE;
  var STILL_TILT = 0.032;
  var STILL_SPEED = 0.12;
  var CLEAN_FRAC = 0.44;
  var TOUCH_FRAC = 1.05;
  var MAX_V = 0.8;
  var G_PRIZE = 18;

  var WORLD = {
    railY: RAIL_Y,
    bite: BITE,
    prizeR: PRIZE_R,
    idleCable: IDLE_CABLE,
    dropCable: DROP_CABLE,
    stillTilt: STILL_TILT,
    stillSpeed: STILL_SPEED,
    cleanFrac: CLEAN_FRAC,
    touchFrac: TOUCH_FRAC,
    slots: [
      [-0.4, -0.44], [0, -0.44], [0.4, -0.44],
      [-0.4, -0.02], [0, -0.02], [0.4, -0.02],
      [-0.4, 0.4], [0.4, 0.4]
    ],
    chute: { x: 0, z: 0.6, r: 0.155 },
    bounds: { x0: -0.74, x1: 0.74, z0: -0.66, z1: 0.82 },
    trolleyLim: { x0: -0.58, x1: 0.58, z0: -0.52, z1: 0.66 },
    catalog: [
      { kind: 'bear', color: 0xff8aa4 },
      { kind: 'duck', color: 0xffd24a },
      { kind: 'car', color: 0x4aa3ff },
      { kind: 'star', color: 0xffc857 },
      { kind: 'heart', color: 0xff5d8f },
      { kind: 'blob', color: 0xb794f6 },
      { kind: 'capsule', color: 0x3ddec0 },
      { kind: 'rocket', color: 0xff7a45 },
      { kind: 'ring', color: 0xff8ad4 }
    ]
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }

  function moveToward(cur, target, maxDelta) {
    var d = target - cur;
    if (Math.abs(d) <= maxDelta) return target;
    return cur + (d < 0 ? -maxDelta : maxDelta);
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = a + 0x6d2b79f5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function makePrize(state, x, y, z, kindIndex) {
    var spec = WORLD.catalog[kindIndex % WORLD.catalog.length];
    return {
      id: state.nextId++,
      x: x, y: y, z: z,
      vx: 0, vy: 0, vz: 0,
      r: WORLD.prizeR,
      kind: spec.kind,
      color: spec.color,
      yaw: state.rng() * Math.PI * 2,
      held: false,
      alive: true,
      won: false,
      sleep: true
    };
  }

  function createState(opts) {
    var seed = opts && opts.seed ? opts.seed : 1;
    var state = {
      nextId: 1,
      rng: mulberry32(seed),
      generation: 1,
      trolley: { x: -0.22, z: 0.22, vx: 0, vz: 0 },
      pend: { x: 0, z: 0, wx: 0, wz: 0 },
      cable: WORLD.idleCable,
      jaws: 1,
      phase: 'idle',
      phaseT: 0,
      judged: false,
      spawned: false,
      pendingSpawns: 0,
      prizes: [],
      heldId: null,
      hint: 'Ease the stick. Drop when the ring turns green.',
      hintLock: 0,
      aim: 'off',
      wins: 0,
      events: [],
      lastResult: null,
      knocked: false,
      swingFault: false
    };
    for (var i = 0; i < WORLD.slots.length; i++) {
      state.prizes.push(makePrize(state, WORLD.slots[i][0], WORLD.prizeR, WORLD.slots[i][1], i));
    }
    return state;
  }

  function headPoint(state) {
    var L = state.cable;
    var sx = Math.sin(state.pend.x);
    var sz = Math.sin(state.pend.z);
    var cy = Math.cos(state.pend.x) * Math.cos(state.pend.z);
    return {
      x: state.trolley.x + sx * L,
      y: WORLD.railY - cy * L,
      z: state.trolley.z + sz * L
    };
  }

  function bitePoint(state) {
    var head = headPoint(state);
    var dx = head.x - state.trolley.x;
    var dy = head.y - WORLD.railY;
    var dz = head.z - state.trolley.z;
    var len = Math.hypot(dx, dy, dz) || 1;
    return {
      x: head.x + (dx / len) * WORLD.bite,
      y: head.y + (dy / len) * WORLD.bite,
      z: head.z + (dz / len) * WORLD.bite
    };
  }

  function stability(state) {
    var tilt = Math.hypot(state.pend.x, state.pend.z);
    var swing = Math.hypot(state.pend.wx, state.pend.wz) * Math.max(0.25, state.cable);
    var slide = Math.hypot(state.trolley.vx, state.trolley.vz);
    var speed = swing + slide;
    return {
      tilt: tilt,
      speed: speed,
      still: tilt < WORLD.stillTilt && speed < WORLD.stillSpeed
    };
  }

  function prizeById(state, id) {
    for (var i = 0; i < state.prizes.length; i++) {
      if (state.prizes[i].id === id) return state.prizes[i];
    }
    return null;
  }

  function overHole(p) {
    var c = WORLD.chute;
    return Math.hypot(p.x - c.x, p.z - c.z) < c.r * 0.78;
  }

  function emit(state, type, extra) {
    var ev = { type: type };
    if (extra) {
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) ev[k] = extra[k];
    }
    state.events.push(ev);
  }

  function assess(state) {
    var b = bitePoint(state);
    var st = stability(state);
    var atBottom = state.cable > WORLD.dropCable - 0.08;
    var best = null;
    var bestH = Infinity;
    var reach = 0;
    var i, p, dx, dz, horiz, seated, vertOk, touch;
    for (i = 0; i < state.prizes.length; i++) {
      p = state.prizes[i];
      if (!p.alive || p.held) continue;
      dx = p.x - b.x;
      dz = p.z - b.z;
      horiz = Math.hypot(dx, dz);
      seated = p.y <= p.r + 0.05 && Math.hypot(p.vx, p.vz, p.vy) < 0.12;
      vertOk = !atBottom || Math.abs(p.y - b.y) < p.r * 0.9 + 0.05;
      touch = p.r * WORLD.touchFrac;
      if (seated && vertOk && horiz <= touch) reach++;
      if (horiz < bestH) { bestH = horiz; best = p; }
    }
    if (!best) {
      return { result: 'miss', id: null, hint: 'Line the ring up with a toy', aim: 'off', still: st.still, dist: bestH, crowded: false };
    }
    dx = best.x - b.x;
    dz = best.z - b.z;
    horiz = bestH;
    seated = best.y <= best.r + 0.05 && Math.hypot(best.vx, best.vz, best.vy) < 0.12;
    vertOk = !atBottom || Math.abs(best.y - b.y) < best.r * 0.9 + 0.05;
    touch = best.r * WORLD.touchFrac;
    var clean = best.r * WORLD.cleanFrac;
    var crowded = reach >= 2;
    var dir = Math.abs(dx) >= Math.abs(dz)
      ? (dx > 0 ? 'A little to the right' : 'A little to the left')
      : (dz > 0 ? 'A little toward you' : 'A little farther back');
    if (!seated || !vertOk || horiz > touch * 1.25) {
      var missHint = !st.still && horiz < 0.42
        ? 'Let the claw hang still'
        : (horiz < touch * 2.2 ? dir : 'Line the ring up with a toy');
      return { result: 'miss', id: best.id, hint: missHint, aim: 'off', still: st.still, dist: horiz, crowded: false };
    }
    var hint = !st.still ? 'Let the claw hang still' : (crowded ? 'Too crowded — nudge one aside' : dir);
    var centered = horiz <= clean;
    var result = (st.still && centered && !crowded) ? 'clean' : 'slip';
    var aim = result === 'clean' ? 'ready' : 'close';
    if (horiz > touch) {
      result = 'miss';
      aim = horiz < touch * 1.35 ? 'close' : 'off';
    }
    return { result: result, id: best.id, hint: hint, aim: aim, still: st.still, dist: horiz, crowded: crowded };
  }

  function award(state, prize) {
    if (!prize || prize.won) return;
    prize.won = true;
    prize.alive = false;
    prize.held = false;
    prize.vx = prize.vy = prize.vz = 0;
    if (state.heldId === prize.id) state.heldId = null;
    state.wins += 1;
    state.pendingSpawns += 1;
    if (state.phase !== 'celebrate') {
      state.phase = 'celebrate';
      state.phaseT = 0;
      state.spawned = false;
    }
    state.hint = 'Prize!';
    state.hintLock = 1.5;
    state.lastResult = 'win';
    emit(state, 'win', { id: prize.id, kind: prize.kind, color: prize.color, x: prize.x, y: prize.y, z: prize.z });
  }

  function applyVerdict(state, verdict) {
    state.lastResult = verdict.result;
    var p = verdict.id != null ? prizeById(state, verdict.id) : null;
    if (verdict.result === 'clean' && p) {
      p.held = true;
      p.sleep = false;
      state.heldId = p.id;
      state.hint = 'Got it! Steer to the glowing hole.';
      emit(state, 'grab', { id: p.id });
    } else if (verdict.result === 'slip' && p) {
      if (!state.knocked) {
        var b = bitePoint(state);
        var dx = p.x - b.x;
        var dz = p.z - b.z;
        var d = Math.hypot(dx, dz) || 1;
        p.sleep = false;
        p.vx += (dx / d) * 1.2;
        p.vz += (dz / d) * 1.2;
        p.vy += 1.7;
      }
      state.hint = verdict.crowded ? 'Too crowded — nudge one aside' : ('Slipped! ' + verdict.hint);
      emit(state, 'slip', { id: p.id });
    } else {
      var stNow = stability(state);
      state.hint = (state.swingFault || !stNow.still)
        ? 'Missed — let the claw hang still'
        : 'Missed — put the ring on the middle';
      emit(state, 'miss');
    }
    state.hintLock = 2.1;
  }

  function tryRelease(state) {
    var p = prizeById(state, state.heldId);
    if (!p) { state.phase = 'idle'; state.heldId = null; return; }
    var b = bitePoint(state);
    var c = WORLD.chute;
    var d = Math.hypot(b.x - c.x, b.z - c.z);
    var st = stability(state);
    if (d <= c.r * 0.82 && st.still) {
      p.x = c.x;
      p.z = c.z;
      p.y = 0.18;
      award(state, p);
      return;
    }
    if (d <= c.r * 1.2 && !st.still) {
      state.hint = 'Let it rest over the glow';
      state.hintLock = 0.7;
      return;
    }
    p.held = false;
    p.sleep = false;
    state.heldId = null;
    p.vy = -0.35;
    p.vx += state.pend.wx * state.cable * 0.35;
    p.vz += state.pend.wz * state.cable * 0.35;
    state.phase = 'idle';
    state.hint = 'Back in the pile — aim for the hole';
    state.hintLock = 1.6;
    emit(state, 'release', { id: p.id });
  }

  function setCable(state, next) {
    var oldL = state.cable;
    if (Math.abs(next - oldL) < 1e-8) return;
    var ox = Math.sin(state.pend.x) * oldL;
    var oz = Math.sin(state.pend.z) * oldL;
    state.cable = next;
    var maxO = next * 0.92;
    ox = clamp(ox, -maxO, maxO);
    oz = clamp(oz, -maxO, maxO);
    state.pend.x = Math.asin(clamp(ox / next, -0.92, 0.92));
    state.pend.z = Math.asin(clamp(oz / next, -0.92, 0.92));
    var scale = oldL / next;
    state.pend.wx *= scale;
    state.pend.wz *= scale;
  }

  function stepSwing(state, dt, ax, az, reduced) {
    var st = stability(state);
    var lowering = state.phase === 'drop' || state.phase === 'close';
    if (lowering && st.still) {
      state.pend.wx = 0;
      state.pend.wz = 0;
      return;
    }
    var L = Math.max(0.25, state.cable);
    var g = 9.81;
    var damp = reduced ? 8.2 : 2.45;
    var alphax = -(g / L) * Math.sin(state.pend.x) - (ax / L) * Math.cos(state.pend.x) - damp * state.pend.wx;
    var alphaz = -(g / L) * Math.sin(state.pend.z) - (az / L) * Math.cos(state.pend.z) - damp * state.pend.wz;
    state.pend.wx = clamp(state.pend.wx + alphax * dt, -6, 6);
    state.pend.wz = clamp(state.pend.wz + alphaz * dt, -6, 6);
    state.pend.x = clamp(state.pend.x + state.pend.wx * dt, -1.05, 1.05);
    state.pend.z = clamp(state.pend.z + state.pend.wz * dt, -1.05, 1.05);
  }

  function collideClaw(state) {
    var b = bitePoint(state);
    var st = stability(state);
    var clawR = 0.085;
    var hit = false;
    var i, p, dx, dy, dz, dist, min, nx, ny, nz, push;
    for (i = 0; i < state.prizes.length; i++) {
      p = state.prizes[i];
      if (!p.alive || p.held) continue;
      dx = p.x - b.x;
      dy = p.y - b.y;
      dz = p.z - b.z;
      dist = Math.hypot(dx, dy, dz);
      min = p.r * 0.62 + clawR;
      if (dist >= min || dist < 1e-5) continue;
      /* A calm drop lets the jaws decide. Only a moving claw shoves toys. */
      if (st.still) continue;
      nx = dx / dist;
      ny = dy / dist;
      nz = dz / dist;
      push = min - dist;
      var away = p.vx * nx + p.vy * ny + p.vz * nz;
      if (away < 0.4) {
        var kick = Math.min(1.05, 0.42 + st.speed * 0.28);
        p.vx += nx * kick;
        p.vy += 0.28 + Math.max(0, ny) * 0.35;
        p.vz += nz * kick;
        state.swingFault = true;
      }
      p.x += nx * push;
      p.y += ny * push;
      p.z += nz * push;
      p.sleep = false;
      hit = true;
    }
    if (hit && !state.knocked) emit(state, 'knock');
    state.knocked = hit;
  }

  function solve(state) {
    var list = [];
    var i, j, a, b, dx, dy, dz, d, min, pen, nx, ny, nz, wa, wb, w, rv, jimp, p, B;
    for (i = 0; i < state.prizes.length; i++) if (state.prizes[i].alive) list.push(state.prizes[i]);
    B = WORLD.bounds;
    for (var n = 0; n < 5; n++) {
      for (i = 0; i < list.length; i++) {
        for (j = i + 1; j < list.length; j++) {
          a = list[i];
          b = list[j];
          dx = b.x - a.x;
          dy = b.y - a.y;
          dz = b.z - a.z;
          d = Math.hypot(dx, dy, dz);
          min = a.r + b.r;
          if (d >= min) continue;
          if (d < 1e-5) { dx = 0.01; dy = 0; dz = 0; d = 0.01; }
          pen = min - d;
          nx = dx / d; ny = dy / d; nz = dz / d;
          wa = a.held ? 0 : 1;
          wb = b.held ? 0 : 1;
          w = wa + wb || 1;
          if (wa) { a.x -= nx * pen * wa / w; a.y -= ny * pen * wa / w; a.z -= nz * pen * wa / w; a.sleep = false; }
          if (wb) { b.x += nx * pen * wb / w; b.y += ny * pen * wb / w; b.z += nz * pen * wb / w; b.sleep = false; }
          rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
          if (rv < 0) {
            jimp = -(1.18) * rv / w;
            if (wa) { a.vx -= jimp * nx * wa; a.vy -= jimp * ny * wa; a.vz -= jimp * nz * wa; }
            if (wb) { b.vx += jimp * nx * wb; b.vy += jimp * ny * wb; b.vz += jimp * nz * wb; }
          }
        }
      }
      for (i = 0; i < list.length; i++) {
        p = list[i];
        if (p.held) continue;
        if (p.x < B.x0 + p.r) { p.x = B.x0 + p.r; if (p.vx < 0) p.vx *= -0.25; p.sleep = false; }
        if (p.x > B.x1 - p.r) { p.x = B.x1 - p.r; if (p.vx > 0) p.vx *= -0.25; p.sleep = false; }
        if (p.z < B.z0 + p.r) { p.z = B.z0 + p.r; if (p.vz < 0) p.vz *= -0.25; p.sleep = false; }
        if (p.z > B.z1 - p.r) { p.z = B.z1 - p.r; if (p.vz > 0) p.vz *= -0.25; p.sleep = false; }
        if (!overHole(p) && p.y < p.r) {
          p.y = p.r;
          if (p.vy < 0) p.vy = 0;
        }
      }
    }
    for (i = 0; i < list.length; i++) {
      p = list[i];
      var sp = Math.hypot(p.vx, p.vy, p.vz);
      if (sp > 3.2) {
        var k = 3.2 / sp;
        p.vx *= k; p.vy *= k; p.vz *= k;
      }
    }
  }

  function integratePrizes(state, dt) {
    var b = bitePoint(state);
    var i, p;
    for (i = 0; i < state.prizes.length; i++) {
      p = state.prizes[i];
      if (!p.alive) continue;
      if (p.held) {
        p.x = b.x; p.y = b.y; p.z = b.z;
        p.vx = p.vy = p.vz = 0;
        continue;
      }
      if (p.sleep) continue;
      p.vy -= G_PRIZE * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (!overHole(p) && p.y <= p.r && p.vy <= 0) {
        p.y = p.r;
        p.vy = 0;
        p.vx *= Math.exp(-8 * dt);
        p.vz *= Math.exp(-8 * dt);
        if (Math.hypot(p.vx, p.vz) < 0.06) {
          p.vx = 0; p.vz = 0; p.vy = 0;
          p.sleep = true;
        }
      } else if (overHole(p) && p.y < -0.42) {
        award(state, p);
      }
    }
  }

  function pickSlot(state) {
    var best = null;
    var bestScore = -1;
    var i, j, s, minD, p, d, chuteD;
    for (i = 0; i < WORLD.slots.length; i++) {
      s = WORLD.slots[i];
      chuteD = Math.hypot(s[0] - WORLD.chute.x, s[1] - WORLD.chute.z);
      if (chuteD < WORLD.chute.r + WORLD.prizeR + 0.08) continue;
      minD = 99;
      for (j = 0; j < state.prizes.length; j++) {
        p = state.prizes[j];
        if (!p.alive) continue;
        d = Math.hypot(p.x - s[0], p.z - s[1]);
        if (d < minD) minD = d;
      }
      if (minD > bestScore) { bestScore = minD; best = s; }
    }
    return best;
  }

  function spawnPrize(state) {
    var slot = pickSlot(state);
    if (!slot) return;
    var kindIndex = state.wins + state.prizes.length;
    var p = makePrize(state, slot[0], 0.92, slot[1], kindIndex);
    p.sleep = false;
    state.prizes.push(p);
    emit(state, 'spawn', { id: p.id });
  }

  function jawGoal(state) {
    if (state.phase === 'celebrate' && state.phaseT > 0.22) return 1;
    if (state.phase === 'close' || state.phase === 'rise' || state.phase === 'hold' || state.phase === 'celebrate') return 0;
    return 1;
  }

  function updateAim(state) {
    if (state.phase === 'hold') {
      var b = bitePoint(state);
      var c = WORLD.chute;
      var d = Math.hypot(b.x - c.x, b.z - c.z);
      var st = stability(state);
      if (d <= c.r * 0.82 && st.still) state.aim = 'ready';
      else if (d <= c.r * 1.25) state.aim = 'close';
      else state.aim = 'off';
      if (state.hintLock <= 0) {
        state.hint = state.aim === 'ready' ? 'Let go!' : 'Carry it to the glowing hole';
      }
      return;
    }
    if (state.phase === 'idle' || state.phase === 'drop' || state.phase === 'close') {
      var verdict = assess(state);
      state.aim = verdict.aim;
      if (state.phase === 'idle' && state.hintLock <= 0) {
        if (verdict.aim === 'ready') state.hint = 'Green ring — drop!';
        else if (verdict.aim === 'close') state.hint = verdict.hint;
        else state.hint = 'Ease the stick. Drop when the ring turns green.';
      }
    }
  }

  function stepOnce(state, dt, input, dropEdge) {
    var reduced = !!(input && input.reduced);
    var locked = state.phase === 'drop' || state.phase === 'close' || state.phase === 'rise' || state.phase === 'celebrate';
    var axIn = locked ? 0 : clamp(num(input && input.ax), -1, 1);
    var azIn = locked ? 0 : clamp(num(input && input.az), -1, 1);
    state.hintLock = Math.max(0, state.hintLock - dt);

    if (state.phase === 'idle' && dropEdge) {
      state.phase = 'drop';
      state.judged = false;
      state.swingFault = false;
      emit(state, 'down');
    } else if (state.phase === 'hold' && dropEdge) {
      tryRelease(state);
    }

    var prevVx = state.trolley.vx;
    var prevVz = state.trolley.vz;
    var desiredVx = axIn * MAX_V;
    var desiredVz = azIn * MAX_V;
    var releasing = Math.abs(axIn) < 0.08 && Math.abs(desiredVx) + 0.02 < Math.abs(state.trolley.vx);
    var rate = locked ? 5.5 : (releasing ? 2.5 : 3.7);
    state.trolley.vx = moveToward(state.trolley.vx, desiredVx, rate * dt);
    state.trolley.vz = moveToward(state.trolley.vz, desiredVz, rate * dt);
    state.trolley.x += state.trolley.vx * dt;
    state.trolley.z += state.trolley.vz * dt;
    var lim = WORLD.trolleyLim;
    if (state.trolley.x < lim.x0) { state.trolley.x = lim.x0; if (state.trolley.vx < 0) state.trolley.vx = 0; }
    if (state.trolley.x > lim.x1) { state.trolley.x = lim.x1; if (state.trolley.vx > 0) state.trolley.vx = 0; }
    if (state.trolley.z < lim.z0) { state.trolley.z = lim.z0; if (state.trolley.vz < 0) state.trolley.vz = 0; }
    if (state.trolley.z > lim.z1) { state.trolley.z = lim.z1; if (state.trolley.vz > 0) state.trolley.vz = 0; }

    var supportAx = clamp((state.trolley.vx - prevVx) / dt, -14, 14);
    var supportAz = clamp((state.trolley.vz - prevVz) / dt, -14, 14);
    stepSwing(state, dt, supportAx, supportAz, reduced);

    var targetCable = (state.phase === 'drop' || state.phase === 'close') ? WORLD.dropCable : WORLD.idleCable;
    var cableSpeed = state.phase === 'drop' ? 0.95 : 1.28;
    setCable(state, moveToward(state.cable, targetCable, cableSpeed * dt));

    state.jaws = moveToward(state.jaws, jawGoal(state), 2.5 * dt);

    integratePrizes(state, dt);
    if (state.phase !== 'celebrate') collideClaw(state);
    solve(state);
    if (state.heldId) {
      var held = prizeById(state, state.heldId);
      var bite = bitePoint(state);
      if (held && held.held) {
        held.x = bite.x; held.y = bite.y; held.z = bite.z;
      }
    }

    var atBottom = state.cable > WORLD.dropCable - 0.012;
    var atTop = state.cable < WORLD.idleCable + 0.02;
    if (state.phase === 'drop' && atBottom) state.phase = 'close';
    if (state.phase === 'close' && state.jaws <= 0.06 && !state.judged) {
      state.judged = true;
      if (state.phase === 'close') {
        applyVerdict(state, assess(state));
        if (state.phase === 'close') state.phase = 'rise';
      }
    }
    if (state.phase === 'rise' && atTop) {
      state.phase = state.heldId ? 'hold' : 'idle';
      state.judged = false;
    }
    if (state.phase === 'celebrate') {
      state.phaseT += dt;
      if (!state.spawned && state.phaseT > 0.42 && state.pendingSpawns > 0) {
        var n = state.pendingSpawns;
        state.pendingSpawns = 0;
        state.spawned = true;
        for (var s = 0; s < n; s++) spawnPrize(state);
      }
      if (state.phaseT > 1.2) {
        state.phase = 'idle';
        state.judged = false;
        state.spawned = false;
      }
    }

    updateAim(state);
  }

  function step(state, dt, input) {
    state.events = [];
    var total = clamp(num(dt), 0, 0.05);
    if (total <= 0) return state;
    var sub = 2;
    var h = total / sub;
    var drop = !!(input && input.drop);
    for (var i = 0; i < sub; i++) {
      stepOnce(state, h, input || {}, drop);
      drop = false;
    }
    return state;
  }

  function refillPile(state) {
    if (!state || state.phase !== 'idle' || state.heldId) return false;
    var wins = state.wins;
    var fresh = createState({ seed: (state.generation + 1) * 17 + 3 });
    state.prizes = fresh.prizes;
    state.nextId = fresh.nextId;
    state.rng = fresh.rng;
    state.pendingSpawns = 0;
    state.heldId = null;
    state.phase = 'idle';
    state.jaws = 1;
    state.cable = WORLD.idleCable;
    state.wins = wins;
    state.generation += 1;
    state.hint = 'Fresh toys. Ease the stick.';
    state.hintLock = 1.2;
    state.aim = 'off';
    state.lastResult = null;
    return true;
  }

  var api = {
    WORLD: WORLD,
    createState: createState,
    step: step,
    assess: assess,
    bitePoint: bitePoint,
    headPoint: headPoint,
    stability: stability,
    refillPile: refillPile
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ClawPhysics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
