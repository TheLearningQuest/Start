/* Smoke tests for the standalone claw prototype. Physics only — no WebGL. */
'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const P = require('../prototypes/claw-machine/js/physics.js');
const root = path.join(__dirname, '..');
const proto = path.join(root, 'prototypes', 'claw-machine');

function stillClaw(s) {
  s.pend.x = s.pend.z = s.pend.wx = s.pend.wz = 0;
  s.trolley.vx = s.trolley.vz = 0;
}

function toyAt(s, id, x, y, z) {
  return {
    id: id, x: x, y: y, z: z,
    vx: 0, vy: 0, vz: 0,
    r: P.WORLD.prizeR,
    kind: 'star', color: 0xffc857, yaw: 0,
    held: false, alive: true, won: false, sleep: true
  };
}

test('the cabinet starts with three rows and no overlapping toys', function () {
  const s = P.createState();
  const zs = new Set(s.prizes.map(function (p) { return p.z.toFixed(2); }));
  const xs = new Set(s.prizes.map(function (p) { return p.x.toFixed(2); }));
  assert.ok(zs.size >= 2);
  assert.ok(xs.size >= 2);
  assert.ok(s.prizes.length >= 6);
  const W = P.WORLD;
  assert.ok(Math.abs((W.railY - W.dropCable) - (W.prizeR + W.bite)) < 1e-9);
  for (let i = 0; i < s.prizes.length; i++) {
    const a = s.prizes[i];
    assert.ok(a.x > W.bounds.x0 + a.r && a.x < W.bounds.x1 - a.r);
    assert.ok(a.z > W.bounds.z0 + a.r && a.z < W.bounds.z1 - a.r);
    const hole = Math.hypot(a.x - W.chute.x, a.z - W.chute.z);
    assert.ok(hole > W.chute.r + a.r + 0.05);
    for (let j = i + 1; j < s.prizes.length; j++) {
      const b = s.prizes[j];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) >= a.r + b.r - 0.001);
    }
  }
});

test('a shove swings the claw and a calm pendulum settles', function () {
  const flicked = P.createState();
  stillClaw(flicked);
  flicked.pend.x = 0;
  flicked.pend.wx = 0;
  for (let i = 0; i < 18; i++) P.step(flicked, 1 / 60, { ax: 1, az: 0 });
  assert.ok(Math.abs(flicked.pend.x) > 0.03 || Math.abs(flicked.pend.wx) > 0.15, JSON.stringify(flicked.pend));

  const hung = P.createState();
  hung.pend.x = 0.5;
  hung.pend.wx = 0;
  for (let i = 0; i < 360; i++) P.step(hung, 1 / 60, {});
  assert.ok(Math.abs(hung.pend.x) < 0.02, hung.pend.x);
  assert.ok(Math.abs(hung.pend.wx) < 0.2, hung.pend.wx);

  function amp(reduced) {
    const s = P.createState();
    s.pend.x = 0.55;
    s.pend.wx = 0;
    for (let i = 0; i < 90; i++) P.step(s, 1 / 60, { reduced: reduced });
    return Math.abs(s.pend.x);
  }
  assert.ok(amp(true) < amp(false));
});

test('a calm centered drop grabs, an offset slips, a swing slips, empty air misses', function () {
  const W = P.WORLD;
  const s = P.createState();
  s.prizes.forEach(function (p) { p.alive = false; });
  stillClaw(s);
  s.trolley.x = 0.12;
  s.trolley.z = -0.18;
  const landing = P.bitePoint(s);
  const prize = toyAt(s, 7, landing.x, W.prizeR, landing.z);
  s.prizes.push(prize);
  s.phase = 'drop';
  s.judged = false;
  let held = false;
  for (let i = 0; i < 240; i++) {
    P.step(s, 1 / 60, {});
    if (s.heldId === 7) held = true;
  }
  assert.equal(held, true, s.lastResult + ' / ' + s.hint);

  function runDrop(setup) {
    const g = P.createState();
    g.prizes.forEach(function (p) { p.alive = false; });
    stillClaw(g);
    g.trolley.x = 0;
    g.trolley.z = 0;
    const bite = P.bitePoint(g);
    const toy = toyAt(g, 9, bite.x, W.prizeR, bite.z);
    setup(g, toy, bite);
    g.prizes.push(toy);
    g.phase = 'drop';
    g.judged = false;
    let feedback = null;
    for (let i = 0; i < 240; i++) {
      P.step(g, 1 / 60, {});
      if (!feedback && g.lastResult) feedback = { result: g.lastResult, hint: g.hint, held: g.heldId };
    }
    return { g: g, toy: toy, feedback: feedback };
  }

  const slipped = runDrop(function (g, toy) { toy.x += 0.09; });
  assert.equal(slipped.g.heldId, null);
  assert.equal(slipped.feedback.result, 'slip');
  assert.match(slipped.feedback.hint, /right|left|still|crowded/i);
  assert.ok(Math.abs(slipped.toy.vx) > 0.2 || Math.abs(slipped.toy.x - 0.09) > 0.02);

  const swung = runDrop(function (g, toy) {
    g.pend.wx = 1.4;
    toy.x = P.bitePoint(g).x;
    toy.z = P.bitePoint(g).z;
  });
  assert.equal(swung.feedback.held, null);
  assert.notEqual(swung.feedback.result, 'clean');
  assert.match(swung.feedback.hint, /still/i);

  const air = runDrop(function (g, toy) { toy.x += 0.8; toy.alive = true; });
  assert.equal(air.g.heldId, null);
  assert.equal(air.feedback.result, 'miss');
});

test('near misses name a direction, and two toys in the jaws are crowded', function () {
  const W = P.WORLD;
  const s = P.createState();
  s.prizes.forEach(function (p) { p.alive = false; });
  stillClaw(s);
  s.cable = W.dropCable;
  s.phase = 'close';
  const b = P.bitePoint(s);
  s.prizes.push(toyAt(s, 1, b.x + 0.09, b.y, b.z));
  let a = P.assess(s);
  assert.equal(a.result, 'slip');
  assert.match(a.hint, /right/);

  s.prizes[s.prizes.length - 1].x = b.x - 0.09;
  a = P.assess(s);
  assert.match(a.hint, /left/);

  s.prizes[s.prizes.length - 1].x = b.x;
  s.prizes[s.prizes.length - 1].z = b.z + 0.09;
  a = P.assess(s);
  assert.match(a.hint, /toward you/);

  s.prizes[s.prizes.length - 1].z = b.z - 0.09;
  a = P.assess(s);
  assert.match(a.hint, /farther back/);

  s.pend.wx = 1.3;
  s.prizes[s.prizes.length - 1].x = b.x;
  s.prizes[s.prizes.length - 1].z = b.z;
  a = P.assess(s);
  assert.equal(a.result, 'slip');
  assert.match(a.hint, /still/);

  stillClaw(s);
  s.prizes.push(toyAt(s, 2, b.x - 0.08, b.y, b.z));
  s.prizes.push(toyAt(s, 3, b.x + 0.08, b.y, b.z));
  s.prizes.forEach(function (p) { if (p.id === 1) p.alive = false; });
  a = P.assess(s);
  assert.equal(a.result, 'slip');
  assert.match(a.hint, /crowded/);
});

test('a calm claw drops straight, and a knock stays inside the cabinet', function () {
  const s = P.createState();
  s.prizes.forEach(function (p) { p.alive = false; });
  stillClaw(s);
  s.pend.x = 0.02;
  s.pend.z = -0.015;
  s.phase = 'drop';
  const before = P.bitePoint(s);
  for (let i = 0; i < 180 && s.phase !== 'close'; i++) P.step(s, 1 / 60, {});
  assert.equal(s.phase, 'close');
  const after = P.bitePoint(s);
  assert.ok(Math.abs(after.x - before.x) < 0.015, after.x - before.x);
  assert.ok(Math.abs(after.z - before.z) < 0.015, after.z - before.z);
  assert.ok(after.y < before.y - 0.35);

  const k = P.createState();
  const target = k.prizes[4];
  const home = target.x;
  stillClaw(k);
  k.trolley.x = target.x - 0.05;
  k.trolley.z = target.z;
  k.cable = P.WORLD.dropCable;
  k.phase = 'drop';
  k.trolley.vx = 1.4;
  k.pend.wx = 1.5;
  for (let i = 0; i < 20; i++) P.step(k, 1 / 60, { ax: 1 });
  assert.ok(Math.abs(target.x - home) > 0.015 || Math.hypot(target.vx, target.vz) > 0.05);
  for (let i = 0; i < 240; i++) P.step(k, 1 / 60, {});
  for (const p of k.prizes) {
    if (!p.alive) continue;
    assert.ok(p.y > -0.2 && p.y < 1.4);
    assert.ok(p.x > P.WORLD.bounds.x0 - 0.02 && p.x < P.WORLD.bounds.x1 + 0.02);
    assert.ok(p.z > P.WORLD.bounds.z0 - 0.02 && p.z < P.WORLD.bounds.z1 + 0.02);
  }
});

test('easing onto a toy and waiting scores, and the claw drops the prize at home by itself', function () {
  const s = P.createState();
  const target = s.prizes.find(function (p) { return Math.abs(p.x) < 0.001 && Math.abs(p.z + 0.02) < 0.001; });
  assert.ok(target);
  let input = { ax: 0, az: 0, drop: false };
  let grabbed = false;
  let homed = false;
  let won = false;
  for (let i = 0; i < 60 * 18 && !won; i++) {
    P.step(s, 1 / 60, input);
    if (s.heldId === target.id) grabbed = true;
    if (s.phase === 'home') homed = true;
    if (s.wins > 0) won = true;
    if (s.phase === 'idle' && !grabbed) {
      const dx = target.x - s.trolley.x;
      const dz = target.z - s.trolley.z;
      const dist = Math.hypot(dx, dz);
      input = {
        ax: dist > 0.025 ? Math.max(-0.55, Math.min(0.55, dx * 2.8)) : 0,
        az: dist > 0.025 ? Math.max(-0.55, Math.min(0.55, dz * 2.8)) : 0,
        drop: s.aim === 'ready'
      };
    } else {
      input = { ax: 1, az: -1, drop: true };
    }
  }
  assert.equal(grabbed, true, JSON.stringify({ phase: s.phase, aim: s.aim, hint: s.hint, last: s.lastResult, trolley: s.trolley, pend: s.pend }));
  assert.equal(homed, true, 'a clean grab should ride home without another button press');
  assert.equal(won, true, JSON.stringify({ phase: s.phase, aim: s.aim, hint: s.hint, wins: s.wins, trolley: s.trolley, homeT: s.homeT }));
  for (let i = 0; i < 100; i++) P.step(s, 1 / 60, {});
  assert.ok(s.prizes.some(function (p) { return p.alive && p.id > 8; }), 'a replacement toy drops in');
});

test('homing ignores the stick, and a swing over the hole does not drop early', function () {
  const early = P.createState();
  const swinging = early.prizes[0];
  early.prizes.forEach(function (p) { if (p !== swinging) p.alive = false; });
  swinging.held = true;
  early.heldId = swinging.id;
  early.phase = 'home';
  early.homeT = 0;
  early.trolley.x = P.WORLD.home.x;
  early.trolley.z = P.WORLD.home.z;
  early.trolley.vx = early.trolley.vz = 0;
  early.cable = P.WORLD.idleCable;
  early.pend.x = 0;
  early.pend.z = 0;
  early.pend.wx = 2.2;
  early.pend.wz = 0;
  P.step(early, 1 / 60, { drop: true, ax: 1, az: 1 });
  assert.equal(early.wins, 0);
  assert.equal(early.phase, 'home');

  const s = P.createState();
  const prize = s.prizes[0];
  s.prizes.forEach(function (p) { if (p !== prize) p.alive = false; });
  prize.held = true;
  s.heldId = prize.id;
  s.phase = 'home';
  s.homeT = 0;
  s.trolley.x = 0.42;
  s.trolley.z = -0.3;
  s.trolley.vx = s.trolley.vz = 0;
  s.cable = P.WORLD.idleCable;
  s.pend.x = s.pend.z = s.pend.wx = s.pend.wz = 0;
  const x0 = s.trolley.x;
  for (let i = 0; i < 25; i++) P.step(s, 1 / 60, { ax: 1, az: -1, drop: true });
  assert.ok(s.trolley.x < x0 - 0.02, s.trolley.x);
  assert.equal(s.wins, 0);
  assert.equal(s.phase, 'home');
  for (let i = 0; i < 60 * 8 && s.wins === 0; i++) P.step(s, 1 / 60, { ax: 1, az: -1, drop: true });
  assert.equal(s.wins, 1);
  assert.equal(prize.won, true);
  assert.ok(Math.hypot(prize.x - P.WORLD.chute.x, prize.z - P.WORLD.chute.z) < 0.02);
});

test('toys rest in the box, and the prototype stays offline', function () {
  const s = P.createState();
  for (let i = 0; i < 180; i++) P.step(s, 1 / 60, {});
  for (const p of s.prizes) {
    assert.equal(p.alive, true);
    assert.ok(p.y >= p.r - 0.001);
    assert.ok(p.x > P.WORLD.bounds.x0 && p.x < P.WORLD.bounds.x1);
    assert.ok(p.z > P.WORLD.bounds.z0 && p.z < P.WORLD.bounds.z1);
  }

  const html = fs.readFileSync(path.join(proto, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(proto, 'style.css'), 'utf8');
  const game = fs.readFileSync(path.join(proto, 'js', 'game.js'), 'utf8');
  const physics = fs.readFileSync(path.join(proto, 'js', 'physics.js'), 'utf8');
  const three = fs.readFileSync(path.join(proto, 'vendor', 'three.min.js'));
  const canonical = fs.readFileSync(path.join(root, 'red-words', 'three.min.js'));
  assert.ok(three.equals(canonical));
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /style-src 'self'/);
  assert.equal(html.includes('unsafe-inline'), false);
  assert.equal(html.includes('wasm-unsafe-eval'), false);
  assert.match(html, /vendor\/three\.min\.js/);
  assert.match(html, /js\/physics\.js/);
  assert.match(html, /js\/game\.js/);
  [html, css, game, physics].forEach(function (src) {
    assert.equal(src.includes('https://'), false);
    assert.equal(src.includes('http://'), false);
    assert.equal(src.includes('unpkg.com'), false);
    assert.equal(src.includes('eval('), false);
    assert.equal(src.includes('new Function'), false);
    assert.equal(src.includes('WebAssembly'), false);
  });
  const threeText = three.toString('utf8');
  assert.ok(threeText.includes('SPDX-License-Identifier: MIT'));
  assert.equal(threeText.includes('WebAssembly'), false);
});
