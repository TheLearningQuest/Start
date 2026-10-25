/* NMQWorld — canvas scenes for Naomi's word garden.
   One requestAnimationFrame loop, pointer input, no network.
   Claw skill is judgeGrab: what she sees (center + still) is the grab. */
(function (root) {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function ease(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }

  function stepPendulum(c, dt, ax, rope, reduced) {
    var L = Math.max(36, rope || 80);
    var g = 2400;
    var damp = reduced ? 7.2 : 2.35;
    var alpha = -(g / L) * Math.sin(c.theta) - ((ax || 0) / L) * Math.cos(c.theta) - damp * c.omega;
    c.omega = clamp(c.omega + alpha * dt, -8, 8);
    c.theta += c.omega * dt;
    if (c.theta > 1.15) { c.theta = 1.15; c.omega = 0; }
    if (c.theta < -1.15) { c.theta = -1.15; c.omega = 0; }
    return c;
  }

  /* tipX is where the claw will meet the pile. Still + centered = clean. */
  function judgeGrab(tipX, capsules, theta, omega) {
    var best = -1, bestDx = Infinity, bestR = 36, i, dx;
    for (i = 0; i < capsules.length; i++) {
      dx = Math.abs(tipX - capsules[i].x);
      if (dx < bestDx) { bestDx = dx; best = i; bestR = capsules[i].r || 36; }
    }
    if (best < 0 || bestDx > bestR * 1.12) return { result: 'miss', index: -1, hint: 'Slide over a capsule' };
    var still = Math.abs(theta) < 0.1 && Math.abs(omega) < 0.6;
    var centered = bestDx <= bestR * 0.5;
    if (still && centered) return { result: 'clean', index: best, hint: '' };
    var hint = !still ? 'Let the claw hang still' : (tipX < capsules[best].x ? 'A little to the right' : 'A little to the left');
    return { result: 'slip', index: best, hint: hint };
  }

  var session = null;

  function stop() {
    if (!session) return;
    var s = session;
    s.dead = true;
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
    if (s.canvas) {
      s.canvas.removeEventListener('pointerdown', s.onDown);
      s.canvas.removeEventListener('pointermove', s.onMove);
      s.canvas.removeEventListener('pointerup', s.onUp);
      s.canvas.removeEventListener('pointercancel', s.onUp);
    }
    if (session === s) session = null;
  }

  function attach(canvas, sceneName, api) {
    stop();
    var s = {
      canvas: canvas, api: api, scene: sceneName, dead: false, raf: 0,
      time: 0, shake: 0, parts: [], ui: [],
      pointer: { down: false, id: null, x: 0, y: 0, sx: 0, sy: 0, moved: false },
      pip: { mood: 'happy', line: '', t: 0 },
      claw: null, lesson: null, ceremony: null, spin: null,
      pan: 0, W: 1, H: 1, dpr: 1, box: null, drag: null
    };
    session = s;
    s.onDown = function (e) { pointer(e, 'down'); };
    s.onMove = function (e) { pointer(e, 'move'); };
    s.onUp = function (e) { pointer(e, 'up'); };
    canvas.addEventListener('pointerdown', s.onDown);
    canvas.addEventListener('pointermove', s.onMove);
    canvas.addEventListener('pointerup', s.onUp);
    canvas.addEventListener('pointercancel', s.onUp);
    enter(s);
    s.raf = requestAnimationFrame(loop);
    return {
      stop: function () { if (session === s) stop(); else s.dead = true; },
      clawState: function () {
        if (!s.claw) return null;
        var c = s.claw;
        return {
          phase: c.phase,
          x: Math.round(c.x),
          swing: Math.round(c.theta * 1000) / 1000,
          held: c.held >= 0 && c.caps[c.held] ? c.caps[c.held].id : null,
          clean: !!c.clean
        };
      }
    };
  }

  function enter(s) {
    var v = s.api.view();
    if (s.scene === 'hub') s.pip = { mood: 'happy', line: 'Pick a place', t: 2.2 };
    if (s.scene === 'claw') enterClaw(s, v);
    if (s.scene === 'lesson') s.pip = { mood: 'happy', line: 'Tap the letters in order', t: 2.4 };
    if (s.scene === 'garden') s.pip = { mood: 'happy', line: v.garden && v.garden.length ? 'Tap a thirsty flower' : 'Master a word to plant it', t: 2.6 };
    if (s.scene === 'nursery') s.pip = { mood: 'happy', line: 'Seeds rest here', t: 2 };
    if (s.scene === 'ceremony') s.pip = { mood: 'cheer', line: '', t: 0 };
  }

  function loop(ts) {
    var s = session;
    if (!s || s.dead) return;
    if (!s.last) s.last = ts;
    var dt = Math.min(0.034, Math.max(0, (ts - s.last) / 1000));
    s.last = ts;
    s.time += dt;
    try {
      if (!s.canvas.isConnected || !s.canvas.closest('.screen.active')) { stop(); return; }
      syncSize(s);
      var reduced = !!(s.api.reduced && s.api.reduced());
      s.reduced = reduced;
      update(s, dt, reduced);
      draw(s, reduced);
    } catch (err) {
      s.dead = true;
      if (root.console && console.error) console.error(err);
      return;
    }
    if (!s.dead) s.raf = requestAnimationFrame(loop);
  }

  function syncSize(s) {
    var rect = s.canvas.getBoundingClientRect();
    var cssW = Math.max(2, rect.width), cssH = Math.max(2, rect.height);
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    var bw = Math.round(cssW * dpr), bh = Math.round(cssH * dpr);
    if (s.canvas.width !== bw || s.canvas.height !== bh) { s.canvas.width = bw; s.canvas.height = bh; }
    s.W = cssW; s.H = cssH; s.dpr = dpr;
    s.box = layout(s);
  }

  function localPos(s, e) {
    var r = s.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function pointer(e, kind) {
    var s = session;
    if (!s || s.dead) return;
    if (kind === 'down') {
      try { s.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    } else if (s.pointer.id !== e.pointerId) return;
    if (kind === 'move') e.preventDefault();
    syncSize(s);
    var p = localPos(s, e);
    if (kind === 'down') {
      s.pointer = { down: true, id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
      onDown(s, p);
    } else if (kind === 'move') {
      if (dist(p.x, p.y, s.pointer.sx, s.pointer.sy) > 8) s.pointer.moved = true;
      s.pointer.x = p.x; s.pointer.y = p.y;
      onMove(s, p);
    } else {
      s.pointer.x = p.x; s.pointer.y = p.y;
      onUp(s, p);
      s.pointer.down = false;
    }
  }

  function hitList(list, x, y, slop) {
    slop = slop || 6;
    for (var i = (list || []).length - 1; i >= 0; i--) {
      var b = list[i];
      if (x >= b.x - slop && y >= b.y - slop && x <= b.x + b.w + slop && y <= b.y + b.h + slop) return b;
    }
    return null;
  }

  function uiHit(s, x, y) { return hitList(s.ui, x, y, 8); }

  function sayPip(s, line, mood) {
    s.pip.line = line;
    s.pip.mood = mood || 'happy';
    s.pip.t = 2.5;
  }

  function nav(s, name) {
    s.dead = true;
    s.api.go(name);
  }

  /* ---------- layout ---------- */
  function layout(s) {
    var W = s.W, H = s.H, pad = Math.max(10, Math.min(22, W * 0.018));
    var portrait = H > W * 1.05;
    var box = { W: W, H: H, pad: pad, portrait: portrait, buttons: [] };
    if (s.scene === 'hub') layoutHub(s, box);
    else if (s.scene === 'claw') layoutClaw(s, box);
    else if (s.scene === 'lesson') layoutLesson(s, box);
    else if (s.scene === 'ceremony') layoutCeremony(s, box);
    else if (s.scene === 'nursery') layoutPots(s, box, 'nursery');
    else if (s.scene === 'garden') layoutGarden(s, box);
    return box;
  }

  function layoutHub(s, box) {
    var v = s.api.view();
    var W = box.W, H = box.H, pad = box.pad;
    var banners = [];
    if (v.award) banners.push('award');
    if (v.canSpin) banners.push('spin');
    if (!v.placed && !v.award) banners.push('place');
    var banH = banners.length ? Math.max(58, Math.min(76, H * 0.1)) : 0;
    var stack = banners.length ? banners.length * banH + (banners.length - 1) * 8 : 0;
    var top = pad + 8;
    var bot = H - pad - Math.max(stack, 100) - 8;
    var gridTop = top + Math.max(36, H * 0.06);
    var gridH = Math.max(120, bot - gridTop - 70);
    var bw, bh, gap = 12;
    if (box.portrait) {
      bw = (W - pad * 2 - gap) / 2;
      bh = Math.min(210, (gridH - gap) / 2);
    } else {
      bw = (W - pad * 2 - gap * 3) / 4;
      bh = Math.min(gridH, 340);
    }
    function at(col, row) {
      return { x: pad + col * (bw + gap), y: gridTop + row * (bh + gap), w: bw, h: bh };
    }
    box.doors = box.portrait
      ? { claw: at(0, 0), nursery: at(1, 0), garden: at(0, 1), explore: at(1, 1) }
      : { claw: at(0, 0), nursery: at(1, 0), garden: at(2, 0), explore: at(3, 0) };
    box.banners = [];
    var pipCol = 156;
    var by = H - pad - stack;
    banners.forEach(function (id, i) {
      box.banners.push({ id: id, x: pad + pipCol, y: by + i * (banH + 8), w: Math.max(120, W - pad * 2 - pipCol), h: banH });
    });
    box.pip = { x: pad + 74, y: H - pad - 42 };
    box.basket = { x: W - pad - 20, y: top + 8 };
  }

  /* One capsule sits on the machine's center line so a still claw can grab clean. */
  function pilePlan(n) {
    var plans = {
      1: [[0]],
      2: [[0, 1]],
      3: [[-1, 0, 1]],
      4: [[-1, 0, 1], [0]],
      5: [[-1, 0, 1], [-0.5, 0.5]],
      6: [[-1.5, -0.5, 0.5, 1.5], [0]]
    };
    var rows = plans[n] || plans[6];
    var out = [];
    rows.forEach(function (row, ri) {
      row.forEach(function (col) { out.push({ col: col, row: ri }); });
    });
    return out;
  }

  function layoutClaw(s, box) {
    var W = box.W, H = box.H, pad = box.pad;
    var dropH = Math.max(78, Math.min(112, H * 0.16));
    var cab = { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 - dropH - 14 };
    if (cab.h < 180) { dropH = 72; cab.h = H - pad * 2 - dropH - 10; }
    var glass = { x: cab.x + 18, y: cab.y + 64, w: cab.w - 36, h: cab.h - 110 };
    box.cab = cab;
    box.glass = glass;
    box.drop = { id: 'drop', x: W / 2 - 100, y: cab.y + cab.h + 10, w: 200, h: dropH, label: 'DROP!', fill: '#4ade80', edge: '#15803d', color: '#14532d' };
    box.railY = glass.y + 18;
    box.floorY = glass.y + glass.h - 8;
  }

  function layoutLesson(s, box) {
    var W = box.W, H = box.H, pad = box.pad;
    var v = s.api.view();
    var les = v.lesson;
    box.hear = { id: 'hear', x: W - pad - 120, y: pad, w: 110, h: 64, label: 'Hear', fill: '#7dd3fc', edge: '#0369a1', color: '#0c4a6e' };
    box.promptY = pad + 36;
    if (!les) return;
    if (les.step < 2) {
      box.letters = layoutChars(les.w, pad, pad + 110, W - pad * 2, H - pad - 160);
    } else if (les.step === 2) {
      var side = Math.min(W * 0.72, H * 0.62, 440);
      box.letterBox = { x: (W - side * 0.72) / 2, y: pad + 100, w: side * 0.72, h: side };
    } else {
      box.slots = layoutSlots(les.w, pad, pad + 150, W, H);
      box.tiles = layoutTileRow(s, les.w, pad, H);
    }
  }

  function layoutChars(word, x, y, w, h) {
    var n = word.length || 1;
    var rows = n > 7 ? 2 : 1;
    var cols = Math.ceil(n / rows);
    var tile = Math.min(150, (w - 10 * (cols - 1)) / cols, (h - 10) / rows);
    tile = Math.max(48, tile);
    var out = [];
    var totalW = cols * tile + (cols - 1) * 10;
    var x0 = x + (w - totalW) / 2;
    for (var i = 0; i < n; i++) {
      var c = i % cols, r = Math.floor(i / cols);
      out.push({ i: i, ch: word.charAt(i), x: x0 + c * (tile + 10), y: y + r * (tile + 10), w: tile, h: tile * 1.05 });
    }
    return out;
  }

  function layoutSlots(word, pad, y, W) {
    var n = word.length || 1;
    var slot = Math.min(92, (W - pad * 2) / n - 8);
    slot = Math.max(36, slot);
    var total = n * slot + (n - 1) * 8;
    var x0 = (W - total) / 2;
    var slots = [];
    for (var i = 0; i < n; i++) slots.push({ i: i, x: x0 + i * (slot + 8), y: y, w: slot, h: slot * 1.15 });
    return slots;
  }

  function layoutTileRow(s, word, pad, H) {
    var tiles = (s.lesson && s.lesson.spell && s.lesson.spell.tiles) || s.api.tiles();
    var n = Math.max(1, tiles.length);
    var W = s.W;
    var tw = Math.min(100, (W - pad * 2) / n - 8);
    tw = Math.max(48, tw);
    var total = n * tw + (n - 1) * 8;
    var x0 = (W - total) / 2;
    var y = H - pad - tw * 1.15 - 8;
    var out = [];
    for (var i = 0; i < tiles.length; i++) out.push({ i: i, ch: tiles[i], x: x0 + i * (tw + 8), y: y, w: tw, h: tw * 1.1 });
    return out;
  }

  function layoutCeremony(s, box) {
    var W = box.W, H = box.H, pad = box.pad;
    var v = s.api.view();
    var phase = v.award ? v.award.phase : 'done';
    if (phase === 'wheel') {
      var rad = Math.min(W, H) * (box.portrait ? 0.32 : 0.34);
      box.wheel = { x: W / 2, y: H * 0.48, r: rad };
    } else if (phase === 'packet' || phase === 'water' || phase === 'done') {
      if (box.portrait) {
        box.packet = { x: W / 2 - 90, y: pad + 70, w: 180, h: 200 };
        box.pot = { x: W / 2, y: H * 0.62 };
        box.canHome = { x: W * 0.28, y: H * 0.78 };
      } else {
        box.packet = { x: pad + 20, y: H * 0.22, w: Math.min(240, W * 0.28), h: Math.min(280, H * 0.5) };
        box.pot = { x: W * 0.68, y: H * 0.58 };
        box.canHome = { x: W * 0.32, y: H * 0.7 };
      }
      box.potR = Math.min(150, W * 0.22);
    }
    box.done = { id: 'done', x: W / 2 - 150, y: H - pad - 86, w: 300, h: 74, label: 'Look!', fill: '#fbbf24', edge: '#b45309', color: '#3b2600' };
  }

  function layoutPots(s, box, kind) {
    var v = s.api.view();
    var items = kind === 'nursery' ? (v.nursery || []) : [];
    var pad = box.pad, W = box.W, H = box.H;
    var potW = Math.max(110, Math.min(150, W * 0.18));
    box.shelf = { x: pad, y: 90, w: W - pad * 2, h: H - 160 };
    box.pots = items.map(function (p, i) {
      return { id: p.id, i: i, x: 16 + i * (potW + 18) - s.pan, y: 40, w: potW, h: 180, item: p };
    });
    box.contentW = Math.max(box.shelf.w, items.length * (potW + 18) + 20);
  }

  function layoutGarden(s, box) {
    var v = s.api.view();
    var pad = box.pad, W = box.W, H = box.H;
    var shopW = box.portrait ? W - pad * 2 : Math.min(230, W * 0.24);
    var shopH = box.portrait ? Math.min(210, H * 0.28) : H - pad * 2 - 20;
    box.shopPanel = box.portrait
      ? { x: pad, y: H - pad - shopH, w: shopW, h: shopH }
      : { x: W - pad - shopW, y: pad + 10, w: shopW, h: shopH };
    var bedW = box.portrait ? W - pad * 2 : W - pad * 3 - shopW;
    var bedH = box.portrait ? H - shopH - pad * 3 - 80 : H - pad * 2 - 30;
    box.bed = { x: pad, y: pad + 64, w: bedW, h: bedH };
    var flowers = v.garden || [];
    var fw = 120, gap = 16;
    var cols = Math.max(1, Math.floor((Math.max(bedW, fw) ) / (fw + gap)));
    var rows = Math.ceil(flowers.length / cols) || 1;
    box.bedContent = rows * 150 + 40;
    var gpan = clamp(s.gpan || 0, 0, Math.max(0, box.bedContent - box.bed.h));
    s.gpan = gpan;
    box.flowers = flowers.map(function (f, i) {
      var col = i % cols, row = Math.floor(i / cols);
      return {
        id: f.id, i: i, item: f,
        x: box.bed.x + 20 + col * (fw + gap),
        y: box.bed.y + 30 + row * 150 - gpan,
        w: fw, h: 140
      };
    });
    var items = v.shop || [];
    var bh = Math.max(56, Math.min(72, (box.shopPanel.h - 48) / Math.max(1, items.length) - 6));
    box.shop = items.map(function (it, i) {
      return { id: 'buy:' + it.id, shopId: it.id, item: it, x: box.shopPanel.x + 10, y: box.shopPanel.y + 40 + i * (bh + 6), w: box.shopPanel.w - 20, h: bh };
    });
    if (v.canSpin) {
      box.spinBtn = { id: 'spin', x: box.bed.x, y: pad, w: 180, h: 52, label: 'Daily spin', fill: '#c4b5fd', edge: '#6d28d9', color: '#3b0764' };
    }
  }

  /* ---------- update ---------- */
  function update(s, dt, reduced) {
    if (s.pip.t > 0) s.pip.t -= dt;
    if (s.pip.t <= 0) s.pip.line = '';
    s.pip.hop = reduced ? 0 : (s.pip.mood === 'cheer' ? Math.abs(Math.sin(s.time * 8)) * 14 : Math.abs(Math.sin(s.time * 2.2)) * 5);
    if (s.scene === 'claw') updateClaw(s, dt, reduced);
    if (s.scene === 'lesson') updateLesson(s, dt);
    if (s.scene === 'ceremony') updateCeremony(s, dt, reduced);
    if (s.spin) updateSpin(s, dt, reduced);
    root.NMQDraw.stepParts(s.parts, dt);
  }

  function enterClaw(s, v) {
    var due = (v.due || []).slice(0, 6);
    s.claw = {
      phase: 'aim', phaseT: 0, x: 0, vx: 0, prevVx: 0, axSmooth: 0,
      theta: 0.15, omega: 0, rope: 64, open: 1,
      drag: false, held: -1, clean: false, caps: [],
      hint: due.length ? 'Slide the claw. Still and centered grabs.' : '',
      hintT: 3, verdict: null, inited: false, due: due
    };
    if (!due.length) sayPip(s, 'No capsules today', 'sleepy');
    else sayPip(s, 'Center it, then let it hang still', 'happy');
  }

  function prepClaw(s) {
    var c = s.claw, g = s.box.glass;
    if (!c || !g) return;
    c.railL = g.x + 36;
    c.railR = g.x + g.w - 36;
    c.railY = s.box.railY;
    c.chuteX = g.x + g.w - 42;
    c.drawerY = s.box.cab.y + s.box.cab.h - 36;
    var n = c.due.length || 1;
    var r = clamp(Math.min(g.w, g.h) / 9, 32, 54);
    var plan = pilePlan(Math.min(6, n));
    var gap = r * 1.42;
    var lift = r * 1.12;
    var floorY = g.y + g.h - r - 16;
    var midX = g.x + g.w / 2;
    if (!c.inited) {
      c.x = (c.railL + c.railR) / 2;
      c.caps = c.due.map(function (w, i) {
        var slot = plan[i] || { col: 0, row: 0 };
        return { id: w.id, w: w.w, i: i, r: r, col: slot.col, row: slot.row, x: 0, y: 0, homeX: 0, homeY: 0, vx: 0, vy: 0, sx: 1, sy: 1, loose: false };
      });
      c.inited = true;
    }
    c.caps.forEach(function (cap) {
      cap.r = r;
      cap.homeX = clamp(midX + cap.col * gap, g.x + r + 6, g.x + g.w - r - 6);
      cap.homeY = floorY - cap.row * lift;
      if (!cap.loose && c.held !== cap.i && c.phase !== 'fall' && c.phase !== 'drawer' && c.phase !== 'crack' && c.phase !== 'slip' && c.phase !== 'bounce') {
        cap.x = cap.homeX;
        cap.y = cap.homeY;
      }
    });
    var targetY = c.caps.length ? c.caps[0].homeY : (g.y + g.h - 40);
    c.dropRope = Math.max(90, targetY - c.railY);
  }

  function landingX(c) { return c.x + Math.sin(c.theta) * c.dropRope; }
  function tipOf(c) { return { x: c.x + Math.sin(c.theta) * c.rope, y: c.railY + Math.cos(c.theta) * c.rope }; }

  function stickHeld(c) {
    if (c.held < 0) return;
    var cap = c.caps[c.held];
    if (!cap) return;
    var tip = tipOf(c);
    cap.x = tip.x;
    cap.y = tip.y + cap.r * 0.15;
  }

  function settleCaps(c, dt) {
    c.caps.forEach(function (cap) {
      if (!cap.loose) return;
      var ax = (cap.homeX - cap.x) * 28 - cap.vx * 6;
      var ay = (cap.homeY - cap.y) * 28 - cap.vy * 6;
      cap.vx += ax * dt; cap.vy += ay * dt;
      cap.x += cap.vx * dt; cap.y += cap.vy * dt;
      if (dist(cap.x, cap.y, cap.homeX, cap.homeY) < 2 && Math.hypot(cap.vx, cap.vy) < 20) {
        cap.x = cap.homeX; cap.y = cap.homeY; cap.vx = 0; cap.vy = 0; cap.loose = false;
      }
    });
  }

  function resetAim(c) {
    c.phase = 'aim';
    c.phaseT = 0;
    c.held = -1;
    c.clean = false;
    c.verdict = null;
  }

  function updateClaw(s, dt, reduced) {
    var c = s.claw;
    if (!c) return;
    prepClaw(s);
    if (!c.due.length) return;
    if (c.phase === 'aim') {
      var ax = 0;
      if (c.drag) {
        var target = clamp(c.dragX, c.railL, c.railR);
        var prev = c.x;
        c.x = target;
        c.vx = clamp((c.x - prev) / Math.max(0.001, dt), -2200, 2200);
        ax = Math.abs(c.x - prev) < 0.8 ? 0 : clamp((c.vx - c.prevVx) / Math.max(0.001, dt), -5000, 5000);
      } else c.vx *= Math.exp(-2.4 * dt);
      c.axSmooth = c.axSmooth * 0.45 + ax * 0.55;
      c.prevVx = c.vx;
      c.x = clamp(c.x, c.railL, c.railR);
      c.rope += (64 - c.rope) * Math.min(1, dt * 5);
      stepPendulum(c, dt, c.drag ? c.axSmooth : 0, c.rope, reduced);
      c.open += (1 - c.open) * Math.min(1, dt * 8);
      c.caps.forEach(function (cap) {
        if (cap.loose) return;
        var bob = reduced ? 0 : Math.sin(s.time * 2.1 + cap.i) * 0.03;
        cap.sy = 1 + bob;
        cap.sx = 1 - bob * 0.6;
      });
    } else if (c.phase === 'drop') {
      stepPendulum(c, dt, 0, c.rope, reduced);
      var speed = reduced ? 16 : 5;
      c.rope += (c.dropRope - c.rope) * Math.min(1, dt * speed);
      c.phaseT += dt;
      if (Math.abs(c.rope - c.dropRope) < 8 || c.phaseT > 0.85) {
        c.rope = c.dropRope;
        c.phase = 'close';
        c.phaseT = 0;
      }
    } else if (c.phase === 'close') {
      c.open += (0 - c.open) * Math.min(1, dt * 16);
      c.phaseT += dt;
      if (c.phaseT > (reduced ? 0.08 : 0.16)) {
        var verdict = c.verdict || { result: 'miss', index: -1, hint: '' };
        if (verdict.result === 'clean') {
          c.phase = 'lift'; c.held = verdict.index; c.clean = true; c.phaseT = 0;
          c.hint = 'Clean grab!'; c.hintT = 1.6;
          s.shake = reduced ? 0 : 8;
          s.api.sfx().reward();
          if (s.api.confetti) s.api.confetti(18);
          root.NMQDraw.burst(s.parts, c.caps[verdict.index].x, c.caps[verdict.index].y, ['#fff7ad', '#fbbf24', '#fff'], reduced ? 6 : 16, reduced);
          sayPip(s, 'Clean grab!', 'cheer');
        } else if (verdict.result === 'slip') {
          c.phase = 'slip'; c.held = verdict.index; c.phaseT = 0;
          c.hint = 'Almost! ' + verdict.hint; c.hintT = 1.8;
          s.api.sfx().wrong();
          sayPip(s, verdict.hint, 'oops');
        } else {
          c.phase = 'empty'; c.phaseT = 0;
          c.hint = 'Nothing under it'; c.hintT = 1.3;
          s.api.sfx().wrong();
          sayPip(s, 'Slide over a capsule', 'oops');
        }
      }
    } else if (c.phase === 'empty') {
      c.phaseT += dt;
      c.open += (1 - c.open) * Math.min(1, dt * 5);
      c.rope += (64 - c.rope) * Math.min(1, dt * 4);
      if (c.phaseT > (reduced ? 0.2 : 0.5)) resetAim(c);
    } else if (c.phase === 'slip') {
      c.phaseT += dt;
      var lift = Math.min(1, c.phaseT / (reduced ? 0.12 : 0.28));
      c.rope = c.dropRope - 50 * lift;
      stickHeld(c);
      if (c.phaseT > (reduced ? 0.16 : 0.4)) {
        var cap = c.caps[c.held];
        if (cap) { cap.loose = true; cap.vy = -260; cap.vx = (landingX(c) < cap.homeX ? -40 : 40); cap.sy = 0.8; }
        c.held = -1;
        c.phase = 'bounce';
        c.phaseT = 0;
      }
    } else if (c.phase === 'bounce') {
      c.phaseT += dt;
      settleCaps(c, dt);
      c.rope += (64 - c.rope) * Math.min(1, dt * 4);
      c.open += (1 - c.open) * Math.min(1, dt * 6);
      if (c.phaseT > (reduced ? 0.2 : 0.65)) resetAim(c);
    } else if (c.phase === 'lift') {
      c.phaseT += dt;
      c.rope += (64 - c.rope) * Math.min(1, dt * (reduced ? 12 : 3));
      c.theta *= Math.exp(-3 * dt);
      stickHeld(c);
      if (c.rope < 78) { c.phase = 'carry'; c.phaseT = 0; c.carryFrom = c.x; }
    } else if (c.phase === 'carry') {
      c.phaseT += dt;
      var t = ease(c.phaseT / (reduced ? 0.18 : 0.55));
      c.x = lerp(c.carryFrom, c.chuteX, t);
      c.theta *= Math.exp(-5 * dt);
      stickHeld(c);
      if (t >= 1) {
        c.open = 1;
        var held = c.caps[c.held];
        if (held) { held.loose = true; held.vy = 30; held.vx = 0; }
        c.fallCap = c.held;
        c.held = -1;
        c.phase = 'fall';
        c.phaseT = 0;
      }
    } else if (c.phase === 'fall') {
      var capf = c.caps[c.fallCap];
      if (capf) {
        capf.vy += 1100 * dt;
        capf.y += capf.vy * dt;
        capf.x += (c.chuteX - capf.x) * Math.min(1, dt * 8);
        if (capf.y >= c.drawerY) {
          capf.y = c.drawerY; capf.x = c.chuteX; capf.vy = 0;
          c.phase = 'drawer'; c.phaseT = 0;
          c.hint = 'Tap the capsule!'; c.hintT = 2.4;
          s.api.sfx().pop();
        }
      }
    } else if (c.phase === 'drawer') {
      var capd = c.caps[c.fallCap];
      if (capd) capd.sx = 1 + Math.sin(s.time * 7) * (reduced ? 0 : 0.05);
    } else if (c.phase === 'crack') {
      c.phaseT += dt;
      if (c.phaseT > (reduced ? 0.22 : 0.72)) {
        var capc = c.caps[c.fallCap];
        s.dead = true;
        s.api.beginLesson(capc.id, c.clean);
      }
    }
    if (c.hintT > 0) c.hintT -= dt;
    if (c.hintT <= 0) c.hint = '';
  }

  function updateLesson(s, dt) {
    var L = s.lesson;
    if (!L) return;
    if (L.wiggleT > 0) L.wiggleT -= dt;
    if (L.trace && L.trace.pop > 0) L.trace.pop -= dt;
    if (L.spell && L.spell.reveal > 0) L.spell.reveal -= dt;
    if (L.spell) L.spell.leaf = lerp(L.spell.leaf, L.spell.reveal > 0 ? 0.05 : 1, Math.min(1, dt * 6));
    if (L.dragTile && !s.pointer.down) L.dragTile = null;
  }

  function updateCeremony(s, dt, reduced) {
    var c = s.ceremony;
    if (!c || !c.spinning) {
      /* pour handled by pointer while held */
    }
    if (c && c.spinning) {
      var left = c.dest - c.angle;
      var speed = Math.min(reduced ? 20 : 9, Math.max(0.7, Math.abs(left) * 0.04));
      var step = clamp(left, -speed, speed);
      if (Math.abs(left) < 0.6) {
        c.angle = c.dest;
        c.spinning = false;
        if (!c.landed) {
          c.landed = true;
          s.api.landWheel(c.rarity);
          s.api.sfx().reward();
          if (s.api.confetti) s.api.confetti(24);
          root.NMQDraw.burst(s.parts, s.box.wheel.x, s.box.wheel.y, ['#fbbf24', '#fff', '#86efac'], 18, reduced);
        }
      } else {
        var before = s.api.slotUnder(c.angle, 8);
        c.angle += step;
        var after = s.api.slotUnder(c.angle, 8);
        if (before !== after) s.api.sfx().tick();
      }
    }
    if (c && c.seed && c.seed.held) {
      c.seed.vx = (s.pointer.x - c.seed.x) * 8;
      c.seed.vy = (s.pointer.y - 28 - c.seed.y) * 8;
      c.seed.x = s.pointer.x;
      c.seed.y = s.pointer.y - 28;
    } else if (c && c.seed && !c.seed.planted) {
      spring(c.seed, c.seed.homeX, c.seed.homeY, dt);
    }
    if (c && c.can && c.can.held) {
      c.can.x = s.pointer.x;
      c.can.y = s.pointer.y - 36;
    } else if (c && c.can && !c.watered) {
      spring(c.can, c.can.homeX, c.can.homeY, dt);
    }
    if (c && c.pouring && !c.watered) {
      c.pour = Math.min(1, c.pour + dt / (reduced ? 0.35 : 1.4));
      if (!reduced && Math.random() < dt * 24) {
        var spout = c.can || { x: 0, y: 0 };
        s.parts.push({ x: spout.x + 40, y: spout.y + 10, vx: 20 + Math.random() * 40, vy: 80, life: 0.45, age: 0, color: '#38bdf8', r: 4, g: 300 });
      }
      if (c.pour >= 1) {
        c.pour = 1; c.pouring = false; c.watered = true;
        var grown = s.api.view().award || {};
        c.memory = { flower: grown.flower, rarity: grown.rarity, kind: grown.kind, level: grown.level, shiny: grown.shiny, w: grown.w };
        c.next = s.api.finishWater();
        s.shake = reduced ? 0 : 6;
        s.api.sfx().reward();
        if (s.api.confetti) s.api.confetti(30);
        sayPip(s, 'It grew!', 'cheer');
      }
    }
  }

  function spring(o, hx, hy, dt) {
    o.vx = (o.vx || 0) + (hx - o.x) * 70 * dt - (o.vx || 0) * 8 * dt;
    o.vy = (o.vy || 0) + (hy - o.y) * 70 * dt - (o.vy || 0) * 8 * dt;
    o.x += o.vx * dt; o.y += o.vy * dt;
  }

  function updateSpin(s, dt, reduced) {
    var sp = s.spin;
    if (!sp || !sp.spinning) return;
    var left = sp.dest - sp.angle;
    if (Math.abs(left) < 0.8) {
      sp.angle = sp.dest; sp.spinning = false; sp.done = true;
      s.api.sfx().reward();
      sayPip(s, sp.label, 'cheer');
    } else sp.angle += clamp(left, reduced ? -18 : -8, reduced ? 18 : 8);
  }

  /* ---------- input ---------- */
  function onDown(s, p) {
    if (s.spin) { spinPointer(s, p, 'down'); return; }
    if (s.scene === 'hub') hubPointer(s, p, 'down');
    else if (s.scene === 'claw') clawPointer(s, p, 'down');
    else if (s.scene === 'lesson') lessonPointer(s, p, 'down');
    else if (s.scene === 'ceremony') ceremonyPointer(s, p, 'down');
    else if (s.scene === 'nursery') nurseryPointer(s, p, 'down');
    else if (s.scene === 'garden') gardenPointer(s, p, 'down');
  }
  function onMove(s, p) {
    if (s.spin) { spinPointer(s, p, 'move'); return; }
    if (s.scene === 'claw' && s.claw && s.claw.drag) s.claw.dragX = p.x;
    if (s.scene === 'lesson') lessonPointer(s, p, 'move');
    if (s.scene === 'ceremony') ceremonyPointer(s, p, 'move');
    if (s.scene === 'nursery' && s.panning) s.pan = clamp(s.pan0 - (p.x - s.pointer.sx), 0, Math.max(0, (s.box.contentW || 0) - s.box.shelf.w));
    if (s.scene === 'garden' && s.bedDrag) s.gpan = (s.gpan0 || 0) - (p.y - s.pointer.sy);
  }
  function onUp(s, p) {
    if (s.spin) { spinPointer(s, p, 'up'); return; }
    if (s.scene === 'claw' && s.claw) s.claw.drag = false;
    if (s.scene === 'lesson') lessonPointer(s, p, 'up');
    if (s.scene === 'ceremony') ceremonyPointer(s, p, 'up');
    if (s.scene === 'hub') hubPointer(s, p, 'up');
    if (s.scene === 'nursery') nurseryPointer(s, p, 'up');
    if (s.scene === 'garden') gardenPointer(s, p, 'up');
    s.panning = false;
  }

  function hubPointer(s, p, kind) {
    if (kind !== 'up' || s.pointer.moved) return;
    var b = uiHit(s, p.x, p.y);
    if (!b) return;
    s.api.sfx().tap();
    if (b.id === 'claw') {
      if (s.api.view().award) nav(s, 'ceremony');
      else nav(s, 'claw');
    } else if (b.id === 'nursery') nav(s, 'nursery');
    else if (b.id === 'garden') nav(s, 'garden');
    else if (b.id === 'explore') { s.api.toggleExplore(); sayPip(s, s.api.view().explore ? '2nd grade is in the claw' : 'Path words only', 'happy'); }
    else if (b.id === 'award') nav(s, 'ceremony');
    else if (b.id === 'spin') openSpin(s);
    else if (b.id === 'place') { s.dead = true; s.api.beginPlace(); }
  }

  function clawPointer(s, p, kind) {
    var c = s.claw, box = s.box;
    if (!c || !c.due.length) {
      if (kind === 'up') {
        var b0 = uiHit(s, p.x, p.y);
        if (b0 && b0.id === 'garden') nav(s, 'garden');
      }
      return;
    }
    if (kind === 'down') {
      if (c.phase === 'drawer') {
        var cap = c.caps[c.fallCap];
        if (cap && dist(p.x, p.y, cap.x, cap.y) < cap.r * 1.6) {
          var word = s.api.word(cap.id);
          if (word) s.api.speakWord(word);
          s.api.sfx().crack();
          c.phase = 'crack'; c.phaseT = 0;
          s.shake = s.reduced ? 0 : 5;
          root.NMQDraw.burst(s.parts, cap.x, cap.y, ['#fff', '#fde68a', '#fb7185'], 14, s.reduced);
          return;
        }
      }
      var drop = uiHit(s, p.x, p.y);
      if (drop && drop.id === 'drop' && c.phase === 'aim') {
        c.verdict = judgeGrab(landingX(c), c.caps, c.theta, c.omega);
        c.phase = 'drop'; c.phaseT = 0; c.drag = false;
        s.api.sfx().tap();
        return;
      }
      var cab = box.cab;
      if (c.phase === 'aim' && cab && p.x >= cab.x && p.y >= cab.y && p.x <= cab.x + cab.w && p.y <= cab.y + cab.h) {
        c.drag = true; c.dragX = p.x;
      }
    }
  }

  function lessonPointer(s, p, kind) {
    var v = s.api.view();
    var les = v.lesson;
    if (!les) {
      if (kind === 'up' && uiHit(s, p.x, p.y)) nav(s, 'hub');
      return;
    }
    ensureLesson(s, les);
    var L = s.lesson;
    if (kind === 'down') {
      var hear = uiHit(s, p.x, p.y);
      if (hear && hear.id === 'hear' && les.step < 3) { s.api.speakWord(s.api.word(les.id)); return; }
      if (les.step < 2 && s.box.letters) {
        var tile = hitList(s.box.letters, p.x, p.y, 4);
        if (!tile) return;
        var expect = nextIndex(les.w, L.tapAt);
        if (tile.i === expect) {
          s.api.speakLetter(tile.ch);
          s.api.sfx().tap();
          L.tapAt = tile.i + 1;
          L.squ = tile.i;
          L.squT = s.time;
          if (nextIndex(les.w, L.tapAt) >= les.w.length) {
            s.api.markStar('letterStar');
            s.api.setStep(2, false);
            sayPip(s, 'Now trace it', 'cheer');
          }
        } else {
          L.wiggle = expect;
          L.wiggleT = 0.45;
          s.api.sfx().tap();
        }
        return;
      }
      if (les.step === 2) traceDown(s, p);
      if (les.step >= 3) spellDown(s, p);
    } else if (kind === 'move') {
      if (les.step === 2) traceMove(s, p);
      if (L.dragTile) { L.dragTile.x = p.x; L.dragTile.y = p.y; }
    } else if (kind === 'up') {
      if (L.trace && L.trace.armSpell) {
        L.trace.armSpell = false;
        s.api.markStar('traceStar');
        s.api.setStep(3, true);
        sayPip(s, 'Spell it from memory', 'happy');
      }
      if (L.trace) L.trace.drawing = false;
      if (L.dragTile) {
        var tile = L.dragTile;
        L.dragTile = null;
        var near = s.box.slots && hitList(s.box.slots, p.x, p.y, 28);
        if (!s.pointer.moved || near) placeTile(s, tile.i, tile.ch);
      }
    }
  }

  function isLetter(ch) {
    if (ch === 'I') return true;
    ch = ch.toLowerCase();
    return ch >= 'a' && ch <= 'z';
  }
  function nextIndex(word, from) {
    var i = from;
    while (i < word.length && !isLetter(word.charAt(i))) i++;
    return i;
  }

  function ensureLesson(s, les) {
    if (!s.lesson || s.lesson.id !== les.id) {
      s.lesson = { id: les.id, tapAt: 0, wiggle: -1, wiggleT: 0, trace: null, spell: null, squ: -1 };
    }
    var L = s.lesson;
    if (les.step >= 2 && !L.trace) L.trace = makeTrace(les);
    if (les.step >= 3 && !L.spell) L.spell = { leaf: 0, reveal: 0, tiles: s.api.tiles(), used: {}, order: [] };
    if (les.step >= 2 && L.trace && !L.trace.chars.length && !L.trace.skipped) {
      L.trace.skipped = true;
      s.api.markStar('traceStar');
      s.api.setStep(3, false);
    }
    return L;
  }

  function makeTrace(les) {
    var chars = [], i, ch, key, strokes;
    for (i = 0; i < les.w.length; i++) {
      ch = les.w.charAt(i);
      key = ch === 'I' ? 'I' : ch.toLowerCase();
      strokes = root.NMQStrokes.get(key);
      if (!strokes) continue;
      chars.push({ i: i, ch: ch, hot: (les.tricky || []).indexOf(i) >= 0, strokes: strokes });
    }
    return { chars: chars, li: 0, si: 0, pi: 0, drawing: false, cueSaid: false, pop: 0, armSpell: false, skipped: false };
  }

  function mapPt(pt, box) {
    return { x: box.x + (pt[0] / 100) * box.w, y: box.y + (pt[1] / 140) * box.h };
  }

  function traceDown(s, p) {
    var tr = s.lesson.trace, box = s.box.letterBox;
    if (!tr || !box || tr.li >= tr.chars.length) return;
    var ch = tr.chars[tr.li];
    var stroke = ch.strokes[tr.si];
    var tol = Math.max(34, box.w * 0.16);
    var p0 = mapPt(stroke.pts[0], box);
    if (stroke.dot) {
      if (dist(p.x, p.y, p0.x, p0.y) < tol * 1.35) {
        s.api.speakCue(stroke.cue);
        advanceStroke(s, tr, 'down');
      }
      return;
    }
    if (tr.pi === 0 && dist(p.x, p.y, p0.x, p0.y) > tol * 1.2) return;
    tr.drawing = true;
    if (!tr.cueSaid) { s.api.speakCue(stroke.cue); tr.cueSaid = true; s.api.sfx().tap(); }
    traceMove(s, p);
  }

  function traceMove(s, p) {
    var tr = s.lesson && s.lesson.trace;
    var box = s.box.letterBox;
    if (!tr || !tr.drawing || !box) return;
    var ch = tr.chars[tr.li];
    if (!ch) return;
    var stroke = ch.strokes[tr.si];
    if (!stroke || stroke.dot) return;
    var tol = Math.max(34, box.w * 0.16);
    while (tr.pi < stroke.pts.length && dist(p.x, p.y, mapPt(stroke.pts[tr.pi], box).x, mapPt(stroke.pts[tr.pi], box).y) < tol) tr.pi++;
    if (tr.pi >= stroke.pts.length) {
      tr.drawing = false;
      advanceStroke(s, tr, 'move');
    }
  }

  function advanceStroke(s, tr, how) {
    var ch = tr.chars[tr.li];
    tr.si++; tr.pi = 0; tr.cueSaid = false; tr.drawing = false;
    if (tr.si >= ch.strokes.length) {
      tr.li++; tr.si = 0; tr.pop = 0.35;
      s.api.sfx().pop();
      root.NMQDraw.burst(s.parts, s.box.letterBox.x + s.box.letterBox.w / 2, s.box.letterBox.y + 20, ['#fde68a', '#86efac'], 8, s.reduced);
      if (tr.li >= tr.chars.length) {
        if (how === 'down') {
          s.api.markStar('traceStar');
          s.api.setStep(3, true);
        } else tr.armSpell = true;
      }
    }
  }

  function spellDown(s, p) {
    var L = s.lesson, sp = L.spell;
    if (!sp) return;
    var slot = s.box.slots && hitList(s.box.slots, p.x, p.y, 6);
    if (slot) {
      var built = (s.api.view().lesson && s.api.view().lesson.built) || '';
      if (built.length && slot.i === built.length - 1) {
        s.api.undoLetter();
        var idx = sp.order.pop();
        if (idx != null) delete sp.used[idx];
        s.api.sfx().tap();
        return;
      }
    }
    var tile = s.box.tiles && hitList(s.box.tiles, p.x, p.y, 6);
    if (tile && !sp.used[tile.i]) {
      L.dragTile = { i: tile.i, ch: tile.ch, x: p.x, y: p.y };
    }
  }

  function placeTile(s, index, ch) {
    var sp = s.lesson.spell;
    if (!sp || sp.used[index]) return;
    var r = s.api.typeLetter(ch);
    if (!r || !r.accepted) return;
    if (r.done && r.ok) { s.dead = true; return; }
    if (r.done && !r.ok) {
      sp.used = {}; sp.order = []; sp.lastUsed = null; sp.reveal = 1.15;
      s.shake = s.reduced ? 0 : 9;
      sayPip(s, 'Look at the hearts', 'oops');
      return;
    }
    sp.used[index] = true;
    sp.order.push(index);
    sp.lastUsed = index;
    s.api.sfx().pop();
  }

  function ceremonyPointer(s, p, kind) {
    var v = s.api.view();
    ensureCeremony(s, v);
    var c = s.ceremony;
    var phase = v.award ? v.award.phase : (c && c.watered ? 'done' : 'done');
    if (kind === 'down') {
      if (phase === 'wheel' && s.box.wheel && !c.spinning) {
        var w = s.box.wheel;
        if (dist(p.x, p.y, w.x, w.y) < w.r + 20) {
          c.wdrag = true;
          c.lastA = Math.atan2(p.y - w.y, p.x - w.x);
          c.lastT = s.time;
          c.vel = 0;
        }
      }
      if (phase === 'packet' && c.open < 1 && s.box.packet && hitList([s.box.packet], p.x, p.y, 8)) {
        c.open = 1;
        s.api.sfx().pop();
        sayPip(s, 'Drag the seed into the pot', 'happy');
        return;
      }
      if (phase === 'packet' && c.open >= 1 && c.seed && !c.seed.planted && dist(p.x, p.y, c.seed.x, c.seed.y) < 50) {
        c.seed.held = true;
      }
      if ((phase === 'water' || (v.award && v.award.phase === 'water')) && c.can && dist(p.x, p.y, c.can.x, c.can.y) < 70) {
        c.can.held = true;
      }
      var hit = uiHit(s, p.x, p.y);
      if (hit && hit.id === 'hub') { nav(s, 'hub'); return; }
      if (hit && hit.id === 'done' && c.watered) nav(s, c.next || 'nursery');
    } else if (kind === 'move') {
      if (c.wdrag && s.box.wheel) {
        var w2 = s.box.wheel;
        var a = Math.atan2(p.y - w2.y, p.x - w2.x);
        var delta = (a - c.lastA) * 180 / Math.PI;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        c.angle += delta;
        var dt = Math.max(0.016, s.time - c.lastT);
        c.vel = delta / (dt * 1000);
        c.lastA = a; c.lastT = s.time;
        var slot = s.api.slotUnder(c.angle, 8);
        if (slot !== c.lastSlot) { c.lastSlot = slot; s.api.sfx().tick(); }
      }
      if (c.can && c.can.held && s.box.pot) {
        var over = dist(c.can.x, c.can.y, s.box.pot.x, s.box.pot.y) < s.box.potR + 30;
        c.pouring = over;
        c.can.tilt = over ? -0.7 : -0.15;
      }
    } else if (kind === 'up') {
      if (c.wdrag) {
        c.wdrag = false;
        var speed = c.vel || 0;
        if (Math.abs(speed) > 0.05 || s.reduced) {
          var rarity = s.api.pickPacket();
          var distDeg = speed * 900;
          if (Math.abs(distDeg) < 420) distDeg = (speed < 0 ? -1 : 1) * (s.reduced ? 50 : 520);
          c.rarity = rarity;
          c.dest = s.api.stopAngle(c.angle, distDeg, rarity);
          c.spinning = !s.reduced;
          c.landed = false;
          if (s.reduced) {
            c.angle = c.dest;
            c.spinning = false;
            c.landed = true;
            s.api.landWheel(rarity);
            s.api.sfx().reward();
          }
        }
      }
      if (c.seed && c.seed.held) {
        c.seed.held = false;
        if (s.box.pot && dist(c.seed.x, c.seed.y, s.box.pot.x, s.box.pot.y - 20) < s.box.potR) {
          c.seed.planted = true;
          c.seed.x = s.box.pot.x;
          c.seed.y = s.box.pot.y - 30;
          s.api.plantSeed();
          s.api.sfx().pop();
          sayPip(s, 'Now pour!', 'cheer');
        }
      }
      if (c.can) { c.can.held = false; c.pouring = false; c.can.tilt = 0; }
    }
  }

  function ensureCeremony(s, v) {
    if (s.ceremony) {
      syncCeremonyPieces(s, v);
      return s.ceremony;
    }
    s.ceremony = {
      angle: 0, vel: 0, spinning: false, dest: null, rarity: null, landed: false, lastSlot: 0,
      open: v.award && v.award.phase !== 'wheel' ? 1 : 0,
      seed: null, can: null, pour: 0, pouring: false, watered: false, next: null, wdrag: false
    };
    if (v.award && v.award.kind === 'thirst') s.ceremony.pour = 0;
    syncCeremonyPieces(s, v);
    if (v.lastPlay && v.lastPlay.letters && v.lastPlay.trace && v.lastPlay.first) sayPip(s, 'Perfect word!', 'cheer');
    else if (v.award && v.award.phase === 'wheel') sayPip(s, 'Flick the wheel', 'happy');
    return s.ceremony;
  }

  function syncCeremonyPieces(s, v) {
    var c = s.ceremony, phase = v.award ? v.award.phase : 'done';
    if ((phase === 'packet' || c.open >= 1) && !c.seed && s.box.packet) {
      var pk = s.box.packet;
      c.seed = { x: pk.x + pk.w / 2, y: pk.y + pk.h * 0.55, homeX: pk.x + pk.w / 2, homeY: pk.y + pk.h * 0.55, vx: 0, vy: 0, held: false, planted: false };
    }
    if (phase === 'water' && !c.can && s.box.canHome) {
      c.can = { x: s.box.canHome.x, y: s.box.canHome.y, homeX: s.box.canHome.x, homeY: s.box.canHome.y, vx: 0, vy: 0, held: false, tilt: 0 };
      if (c.seed) c.seed.planted = true;
    }
    if (c.seed && s.box.packet && !c.seed.held && !c.seed.planted) {
      c.seed.homeX = s.box.packet.x + s.box.packet.w / 2;
      c.seed.homeY = s.box.packet.y + s.box.packet.h * 0.55;
    }
    if (c.can && s.box.canHome && !c.can.held) {
      c.can.homeX = s.box.canHome.x; c.can.homeY = s.box.canHome.y;
    }
  }

  function nurseryPointer(s, p, kind) {
    if (kind === 'down') { s.panning = true; s.pan0 = s.pan; s.downPot = hitList(s.box.pots, p.x, p.y, 4); }
    if (kind === 'up' && !s.pointer.moved && s.downPot) {
      var item = s.downPot.item;
      var word = s.api.word(item.id);
      if (word) s.api.speakWord(word);
      sayPip(s, item.w + ' · ' + item.stage, 'happy');
    }
  }

  function gardenPointer(s, p, kind) {
    if (kind === 'down') {
      var shop = hitList(s.box.shop, p.x, p.y, 4);
      var flower = hitList(s.box.flowers, p.x, p.y, 4);
      var spin = s.box.spinBtn && uiHit(s, p.x, p.y);
      s.downShop = shop; s.downFlower = flower; s.downSpin = spin && spin.id === 'spin';
      s.bedDrag = !shop && !flower && !spin && s.box.bed && p.x >= s.box.bed.x && p.x <= s.box.bed.x + s.box.bed.w && p.y >= s.box.bed.y && p.y <= s.box.bed.y + s.box.bed.h;
      s.gpan0 = s.gpan || 0;
    }
    if (kind === 'up' && !s.pointer.moved) {
      if (s.downSpin) { openSpin(s); return; }
      if (s.downShop) {
        var res = s.api.buy(s.downShop.shopId);
        if (res && res.ok) { s.api.sfx().reward(); sayPip(s, 'Welcome!', 'cheer'); }
        else sayPip(s, 'Need more coins', 'oops');
        return;
      }
      if (s.downFlower) {
        var f = s.downFlower.item;
        if (f.thirsty) {
          s.dead = true;
          if (!s.api.beginReview(f.id)) { s.dead = false; sayPip(s, 'Finish the seed first', 'oops'); }
        } else {
          var w = s.api.word(f.id);
          if (w) s.api.speakWord(w);
          sayPip(s, f.w, 'happy');
        }
      }
    }
  }

  function openSpin(s) {
    s.spin = { angle: 0, dest: 0, spinning: false, done: false, label: '', prize: null };
  }

  function spinPointer(s, p, kind) {
    var sp = s.spin;
    if (!sp) return;
    if (kind === 'up') {
      var b = uiHit(s, p.x, p.y);
      if (b && b.id === 'spin-go' && !sp.spinning && !sp.done) {
        var prize = s.api.dailySpin();
        if (!prize) { s.spin = null; return; }
        sp.prize = prize.prize; sp.label = prize.label;
        var seg = prize.prize === 'fertilizer' ? 1 : prize.prize === 'seed' ? 2 : 0;
        sp.dest = 360 * 2 + (seg * 120 + 60);
        sp.spinning = !s.reduced;
        if (s.reduced) { sp.angle = sp.dest; sp.done = true; sayPip(s, prize.label, 'cheer'); s.api.sfx().reward(); }
      }
      if (b && b.id === 'spin-close' && (sp.done || !sp.spinning)) s.spin = null;
    }
  }

  /* ---------- draw ---------- */
  function draw(s, reduced) {
    var ctx = s.canvas.getContext('2d');
    var D = root.NMQDraw;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.W, s.H);
    ctx.save();
    if (s.shake > 0.3 && !reduced) ctx.translate(Math.sin(s.time * 42) * s.shake, Math.cos(s.time * 36) * s.shake * 0.5);
    s.shake *= Math.exp(-3.5 * (1 / 60));
    backdrop(ctx, s, reduced);
    s.ui = [];
    if (s.scene === 'hub') drawHub(ctx, s);
    else if (s.scene === 'claw') drawClaw(ctx, s);
    else if (s.scene === 'lesson') drawLesson(ctx, s);
    else if (s.scene === 'ceremony') drawCeremony(ctx, s);
    else if (s.scene === 'nursery') drawNursery(ctx, s);
    else if (s.scene === 'garden') drawGarden(ctx, s);
    s.ui.forEach(function (b) {
      if (b.ghost) return;
      var pressed = s.pointer.down && s.pointer.x >= b.x && s.pointer.x <= b.x + b.w && s.pointer.y >= b.y && s.pointer.y <= b.y + b.h;
      D.button(ctx, b, pressed);
    });
    if (s.pip && s.pip.line && (s.scene === 'hub' || s.scene === 'nursery' || s.scene === 'garden')) {
      D.pip(ctx, s.box.pip ? s.box.pip.x : 70, (s.box.pip ? s.box.pip.y : s.H - 30), 0.85, s.pip.mood, s.pip.hop);
      D.bubble(ctx, (s.box.pip ? s.box.pip.x : 70) + 20, (s.box.pip ? s.box.pip.y : s.H - 30) - 70, s.pip.line, Math.min(320, s.W * 0.6));
    }
    D.drawParts(ctx, s.parts);
    if (s.spin) drawSpin(ctx, s);
    ctx.restore();
    mirror(s);
  }

  function backdrop(ctx, s, reduced) {
    var W = s.W, H = s.H, D = root.NMQDraw;
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7ec8f8');
    g.addColorStop(0.55, '#d7f6ff');
    g.addColorStop(1, '#b6f3c2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    var drift = reduced ? 0 : (s.time * 12);
    D.sun(ctx, W - 90, 70, 36);
    D.cloud(ctx, 80 + (drift % (W + 160)) - 40, 50, 1.1);
    D.cloud(ctx, 280 + ((drift * 0.6) % (W + 200)) - 80, 90, 0.8);
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.72);
    ctx.quadraticCurveTo(W * 0.3, H * 0.66, W * 0.55, H * 0.74);
    ctx.quadraticCurveTo(W * 0.8, H * 0.82, W, H * 0.7);
    ctx.lineTo(W, H); ctx.lineTo(0, H);
    ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, H * 0.86, W, H);
  }

  function pushBtn(s, b) { s.ui.push(b); return b; }

  function drawHub(ctx, s) {
    var D = root.NMQDraw, v = s.api.view(), box = s.box;
    D.text(ctx, 'Today', box.pad + 8, box.pad + 18, 18, '#3b2760', 'left');
    var goal = v.goal || 3, got = Math.min(goal, v.todayCount || 0);
    for (var i = 0; i < goal; i++) {
      D.seed(ctx, box.pad + 80 + i * 28, box.pad + 18, 0.28, { mood: i < got ? 'happy' : 'sleepy', sx: 1, sy: i < got ? 1 : 0.85 });
    }
    function door(rect, fill, edge, title, sub) {
      D.panel(ctx, rect.x, rect.y, rect.w, rect.h, { fill: fill, edge: edge, r: 32, lip: 12 });
      D.label(ctx, title, rect.x + rect.w / 2, rect.y + rect.h * 0.58, Math.min(36, rect.w * 0.16), '#fffdf8', edge);
      D.text(ctx, sub, rect.x + rect.w / 2, rect.y + rect.h * 0.78, Math.min(18, rect.w * 0.09), '#fffdf8');
      pushBtn(s, { id: rect.id, x: rect.x, y: rect.y, w: rect.w, h: rect.h, label: '', ghost: true });
    }
    var doors = box.doors;
    doors.claw.id = 'claw'; doors.nursery.id = 'nursery'; doors.garden.id = 'garden'; doors.explore.id = 'explore';
    door(doors.claw, '#3b82f6', '#1e3a8a', v.award ? 'Seed' : 'Claw', v.award ? 'plant it' : ((v.due || []).length + ' capsules'));
    D.clawGrip(ctx, doors.claw.x + doors.claw.w / 2, doors.claw.y + 54, 0.7, 1.1);
    door(doors.nursery, '#4ade80', '#166534', 'Nursery', 'seeds');
    D.pot(ctx, doors.nursery.x + doors.nursery.w / 2, doors.nursery.y + 78, 0.55, { mood: 'happy' });
    var thirsty = (v.garden || []).filter(function (f) { return f.thirsty; }).length;
    door(doors.garden, '#f472b6', '#9d174d', 'Garden', (v.garden || []).length + ' flowers' + (thirsty ? ' · ' + thirsty + ' thirsty' : ''));
    D.flower(ctx, doors.garden.x + doors.garden.w / 2, doors.garden.y + 100, 'daisy', { scale: 0.7, growth: 1 });
    door(doors.explore, v.explore ? '#fbbf24' : '#e5e7eb', v.explore ? '#b45309' : '#6b7280', v.explore ? 'Explore on' : 'Explore', '2nd grade');
    box.banners.forEach(function (b) {
      var label = b.id === 'award' ? 'Your seed is waiting' : b.id === 'spin' ? 'Daily spin!' : 'Words I already know';
      var fill = b.id === 'award' ? '#bbf7d0' : b.id === 'spin' ? '#ddd6fe' : '#fde68a';
      pushBtn(s, { id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, label: label, fill: fill, edge: '#7c3aed', color: '#3b2760', size: 26 });
    });
  }

  function drawClaw(ctx, s) {
    var D = root.NMQDraw, c = s.claw, box = s.box;
    if (!c) return;
    prepClaw(s);
    var cab = box.cab;
    D.panel(ctx, cab.x, cab.y, cab.w, cab.h, { fill: '#2563eb', edge: '#1e3a8a', r: 36, lip: 14 });
    D.roundRect(ctx, cab.x + 16, cab.y + 12, cab.w - 32, 44, 16);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    D.text(ctx, 'RED WORD CLAW', cab.x + cab.w / 2, cab.y + 34, Math.min(28, cab.w * 0.05), '#fff');
    var bulbs = 10;
    for (var i = 0; i < bulbs; i++) {
      var on = !s.reduced && Math.floor(s.time * 6) % bulbs === i;
      ctx.beginPath();
      ctx.arc(cab.x + 36 + i * ((cab.w - 72) / (bulbs - 1)), cab.y + 58, 6, 0, Math.PI * 2);
      ctx.fillStyle = on || (c.clean && c.phase !== 'aim') ? '#fde047' : '#fef9c3';
      ctx.fill();
    }
    var g = box.glass;
    ctx.save();
    D.roundRect(ctx, g.x, g.y, g.w, g.h, 18);
    ctx.fillStyle = 'rgba(224,242,254,.92)';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = '#bfdbfe';
    D.roundRect(ctx, g.x + 10, c.railY - 6, g.w - 20, 12, 6);
    ctx.fill();
    if (!c.due.length) {
      D.text(ctx, 'All empty!', g.x + g.w / 2, g.y + g.h / 2, 32, '#1e3a8a');
    } else {
      var preview = c.phase === 'aim' ? judgeGrab(landingX(c), c.caps, c.theta, c.omega) : null;
      if (c.phase === 'aim') {
        var lx = landingX(c);
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = preview && preview.result === 'clean' ? '#16a34a' : '#64748b';
        ctx.setLineDash([6, 8]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(c.x, c.railY);
        ctx.lineTo(lx, c.railY + c.dropRope);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(lx, c.railY + c.dropRope, 16, 0, Math.PI * 2);
        ctx.fillStyle = preview && preview.result === 'clean' ? 'rgba(74,222,128,.45)' : 'rgba(148,163,184,.35)';
        ctx.fill();
      }
      var ordered = c.caps.slice().sort(function (a, b) {
        if (a.loose !== b.loose) return a.loose ? 1 : -1;
        return b.row - a.row;
      });
      ordered.forEach(function (cap) {
        if (c.phase === 'crack' && cap.i === c.fallCap) return;
        var glow = preview && preview.result === 'clean' && preview.index === cap.i;
        var mood = Math.abs(cap.x - c.x) < cap.r ? 'wow' : (cap.i % 4 === 2 ? 'sleepy' : 'happy');
        if (glow) {
          ctx.beginPath();
          ctx.arc(cap.x, cap.y, cap.r + 8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(74,222,128,.35)';
          ctx.fill();
        }
        D.capsule(ctx, cap.x, cap.y, cap.r, { i: cap.i, mood: mood, sx: cap.sx, sy: cap.sy, shiny: c.clean && cap.i === c.fallCap && (c.phase === 'drawer' || c.phase === 'fall') });
      });
      var tip = tipOf(c);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c.x, c.railY);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      D.roundRect(ctx, c.x - 22, c.railY - 14, 44, 20, 8);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      D.clawGrip(ctx, tip.x, tip.y, c.open, 1);
      if (c.hint && c.hintT > 0) D.label(ctx, c.hint, g.x + g.w / 2, g.y + 36, 26, '#1e3a8a', '#fff');
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 4;
    D.roundRect(ctx, g.x, g.y, g.w, g.h, 18);
    ctx.stroke();
    /* chute + drawer */
    D.roundRect(ctx, cab.x + cab.w - 92, cab.y + cab.h - 70, 74, 56, 14);
    ctx.fillStyle = '#fde68a';
    ctx.fill();
    D.text(ctx, 'Prize', cab.x + cab.w - 55, cab.y + cab.h - 42, 16, '#92400e');
    if (c.phase === 'crack') {
      var capc = c.caps[c.fallCap];
      if (capc) {
        var k = clamp(c.phaseT / 0.35, 0, 1);
        D.capsule(ctx, capc.x - 20 * k, capc.y, capc.r, { i: capc.i, sx: 1, sy: 1 });
        D.capsule(ctx, capc.x + 20 * k, capc.y, capc.r, { i: capc.i, sx: 1, sy: 1 });
        var sc = ease(clamp((c.phaseT - 0.1) / 0.35, 0, 1));
        ctx.save();
        ctx.translate(g.x + g.w / 2, g.y + g.h / 2);
        ctx.scale(sc, sc);
        D.panel(ctx, -110, -50, 220, 100, { fill: '#fff', r: 20, lip: 6 });
        D.text(ctx, capc.w, 0, 0, 48, '#be123c');
        ctx.restore();
      }
    }
    if (!c.due.length) {
      pushBtn(s, { id: 'garden', x: s.W / 2 - 120, y: box.drop.y, w: 240, h: box.drop.h, label: 'Garden', fill: '#f472b6', edge: '#9d174d', color: '#fff' });
    } else if (c.phase === 'aim') {
      var prev = judgeGrab(landingX(c), c.caps, c.theta, c.omega);
      var label = prev.result === 'clean' ? 'DROP!' : (prev.result === 'slip' && prev.hint.indexOf('still') >= 0 ? 'WAIT' : (prev.result === 'slip' ? 'NUDGE' : 'SLIDE'));
      var fill = prev.result === 'clean' ? '#4ade80' : (label === 'WAIT' ? '#fdba74' : '#fde68a');
      pushBtn(s, { id: 'drop', x: box.drop.x, y: box.drop.y, w: box.drop.w, h: box.drop.h, label: label, fill: fill, edge: '#166534', color: '#14532d', size: 32 });
    } else {
      pushBtn(s, { id: 'busy', x: box.drop.x, y: box.drop.y, w: box.drop.w, h: box.drop.h, label: c.phase === 'drawer' ? 'Tap it' : '...', fill: '#e5e7eb', edge: '#9ca3af', color: '#374151', size: 28 });
    }
  }

  function drawLesson(ctx, s) {
    var D = root.NMQDraw, v = s.api.view(), les = v.lesson;
    var box = s.box;
    if (!les) {
      D.text(ctx, 'All done', s.W / 2, s.H / 2, 36, '#3b2760');
      pushBtn(s, { id: 'hub', x: s.W / 2 - 100, y: s.H / 2 + 30, w: 200, h: 70, label: 'Garden', fill: '#fde68a', edge: '#b45309', color: '#3b2600' });
      return;
    }
    ensureLesson(s, les);
    drawStars(ctx, s, padStars(s), !!(les.letterStar || les.step >= 2), !!(les.traceStar || les.step >= 3), false);
    if (les.step < 3) pushBtn(s, box.hear);
    var prompt = les.step < 2 ? 'Tap each letter' : (les.step === 2 ? 'Trace the letter' : (les.mode === 'review' ? 'This flower is thirsty. Spell it.' : 'Spell it from memory'));
    D.label(ctx, prompt, s.W / 2, box.promptY, 26, '#3b2760', '#fff');
    if (les.step < 2) drawTapLetters(ctx, s, les);
    else if (les.step === 2) drawTrace(ctx, s, les);
    else drawSpell(ctx, s, les);
  }

  function padStars(s) { return { x: s.box.pad + 10, y: s.box.pad + 8 }; }
function drawStars(ctx, s, at, a, b, c) {
  var D = root.NMQDraw;
  [a, b, c].forEach(function (on, i) {
    var x = at.x + 16 + i * 36;
    if (on) D.star(ctx, x, at.y + 16, 16, '#fbbf24', true);
    else D.star(ctx, x, at.y + 16, 16, '#d6d3d1', false);
  });
}

  function drawTapLetters(ctx, s, les) {
    var D = root.NMQDraw, L = s.lesson;
    var expect = nextIndex(les.w, L.tapAt);
    (s.box.letters || []).forEach(function (tile) {
      var done = tile.i < L.tapAt || !isLetter(tile.ch);
      var hot = (les.tricky || []).indexOf(tile.i) >= 0;
      var wig = L.wiggle === tile.i && L.wiggleT > 0 ? Math.sin(s.time * 40) * 4 : 0;
      var squ = L.squ === tile.i ? 1.08 : 1;
      ctx.save();
      ctx.translate(tile.x + tile.w / 2 + wig, tile.y + tile.h / 2);
      ctx.scale(squ, 1 / squ);
      D.roundRect(ctx, -tile.w / 2, -tile.h / 2, tile.w, tile.h, 18);
      ctx.fillStyle = done ? (hot ? '#fecdd3' : '#bbf7d0') : (hot ? '#ffe4e6' : '#fff');
      ctx.fill();
      ctx.lineWidth = expect === tile.i ? 6 : 3;
      ctx.strokeStyle = expect === tile.i ? '#fbbf24' : '#e9d5ff';
      ctx.stroke();
      D.text(ctx, tile.ch, 0, 4, Math.min(64, tile.w * 0.55), hot ? '#be123c' : '#3b2760');
      if (hot) D.heart(ctx, tile.w * 0.28, -tile.h * 0.28, Math.max(8, tile.w * 0.08), '#fb7185');
      ctx.restore();
    });
  }

  function drawTrace(ctx, s, les) {
    var D = root.NMQDraw, tr = s.lesson.trace, box = s.box.letterBox;
    if (!tr || !box) return;
    if (!tr.chars.length) return;
    var ch = tr.chars[Math.min(tr.li, tr.chars.length - 1)];
    D.roundRect(ctx, box.x - 16, box.y - 16, box.w + 32, box.h + 32, 28);
    ctx.fillStyle = 'rgba(255,255,255,.88)';
    ctx.fill();
    ctx.globalAlpha = 0.12;
    D.text(ctx, ch.ch, box.x + box.w / 2, box.y + box.h / 2, box.h * 0.7, '#3b2760');
    ctx.globalAlpha = 1;
    ch.strokes.forEach(function (stroke, si) {
      var done = si < tr.si || tr.li > ch.strokes && false;
      var past = tr.chars.indexOf(ch) < tr.li || si < tr.si;
      var cur = si === tr.si && tr.li < tr.chars.length;
      drawStroke(ctx, stroke, box, past ? stroke.pts.length : (cur ? tr.pi : 0), ch.hot ? '#fb7185' : '#22c55e', cur);
    });
    if (tr.li < tr.chars.length) {
      var stroke = ch.strokes[tr.si];
      var pt = mapPt(stroke.pts[Math.min(tr.pi, stroke.pts.length - 1)], box);
      var pulse = s.reduced ? 12 : 12 + Math.sin(s.time * 6) * 3;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#f472b6';
      ctx.fill();
      D.label(ctx, stroke.cue, s.W / 2, box.y + box.h + 36, 24, '#3b2760', '#fff');
    }
    var dots = tr.chars;
    dots.forEach(function (c2, i) {
      D.text(ctx, c2.ch, s.box.pad + 24 + i * 28, s.H - 28, 20, i < tr.li ? '#16a34a' : '#94a3b8');
    });
  }

  function drawStroke(ctx, stroke, box, upto, color, current) {
    var pts = stroke.pts;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(16, box.w * 0.08);
    ctx.strokeStyle = current ? 'rgba(253,224,71,.95)' : 'rgba(233,213,255,.9)';
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var p = mapPt(pts[i], box);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    if (upto > 1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(12, box.w * 0.055);
      ctx.beginPath();
      for (var j = 0; j < upto && j < pts.length; j++) {
        var q = mapPt(pts[j], box);
        if (j === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
    }
  }

  function drawSpell(ctx, s, les) {
    var D = root.NMQDraw, L = s.lesson, sp = L.spell;
    if (!sp) return;
    var show = sp.reveal > 0;
    if (s.box.slots) {
      ctx.save();
      s.box.slots.forEach(function (slot, i) {
        if (!show) return;
        var hot = (les.tricky || []).indexOf(i) >= 0;
        D.text(ctx, les.w.charAt(i), slot.x + slot.w / 2, slot.y - slot.h * 0.65, slot.h * 0.6, hot ? '#be123c' : '#3b2760');
        if (hot) D.heart(ctx, slot.x + slot.w - 8, slot.y - slot.h * 0.95, 8, '#fb7185');
      });
      if (!show) {
        ctx.globalAlpha = sp.leaf;
        var leafY = s.box.slots[0].y - s.box.slots[0].h * 0.7;
        D.ellipse(ctx, s.W / 2, leafY, Math.min(s.W * 0.4, 280), 36);
        ctx.fillStyle = '#4ade80';
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      var built = les.built || '';
      s.box.slots.forEach(function (slot, i) {
        D.roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 16);
        ctx.fillStyle = '#f5f3ff';
        ctx.fill();
        ctx.strokeStyle = '#ddd6fe';
        ctx.lineWidth = 3;
        ctx.stroke();
        if (built.charAt(i)) D.text(ctx, built.charAt(i), slot.x + slot.w / 2, slot.y + slot.h / 2, slot.h * 0.55, '#3b2760');
      });
      ctx.restore();
    }
    (s.box.tiles || []).forEach(function (tile) {
      if (sp.used[tile.i]) return;
      if (L.dragTile && L.dragTile.i === tile.i) return;
      D.panel(ctx, tile.x, tile.y, tile.w, tile.h, { fill: '#fff', r: 16, lip: 6, edge: '#86efac' });
      D.text(ctx, tile.ch, tile.x + tile.w / 2, tile.y + tile.h / 2, tile.h * 0.5, '#3b2760');
    });
    if (L.dragTile) {
      D.seed(ctx, L.dragTile.x, L.dragTile.y, 0.7, { mood: 'wow' });
      D.text(ctx, L.dragTile.ch, L.dragTile.x, L.dragTile.y, 28, '#14532d');
    }
  }

  function drawCeremony(ctx, s) {
    var D = root.NMQDraw, v = s.api.view();
    ensureCeremony(s, v);
    var c = s.ceremony;
    var award = v.award || (c && c.memory) || null;
    var phase = v.award ? v.award.phase : (c && c.watered ? 'done' : 'done');
    if (v.lastPlay) {
      drawStars(ctx, s, { x: s.box.pad, y: s.box.pad }, !!v.lastPlay.letters, !!v.lastPlay.trace, !!v.lastPlay.first);
      if (v.lastPlay.clean) D.label(ctx, 'Clean grab!', s.W / 2, s.box.pad + 18, 22, '#b45309', '#fff');
    }
    if (!v.award && !c.watered) {
      D.label(ctx, 'All planted', s.W / 2, s.H / 2 - 20, 36, '#3b2760', '#fff');
      pushBtn(s, { id: 'hub', x: s.W / 2 - 110, y: s.H / 2 + 20, w: 220, h: 72, label: 'Garden', fill: '#fde68a', edge: '#b45309', color: '#3b2600' });
    } else if (phase === 'wheel' && s.box.wheel) drawWheel(ctx, s, c, s.box.wheel, v);
    else if (award || c.watered) drawPlant(ctx, s, v, c, phase);
    if (c.watered) {
      var next = c.next === 'garden' ? 'See the garden' : 'To the nursery';
      s.box.done.label = next;
      pushBtn(s, s.box.done);
      var tag = (award && award.rarity ? award.rarity + ' ' : '') + pretty(award && award.flower);
      D.label(ctx, tag, s.W / 2, s.box.done.y - 28, 24, '#3b2760', '#fff');
    }
  }

  function pretty(name) { return String(name || 'flower').replace(/-/g, ' '); }

  function drawWheel(ctx, s, c, w, v) {
    var D = root.NMQDraw;
    var slots = (v.wheel || ['common', 'rare', 'epic', 'mythic', 'common', 'rare', 'epic', 'mythic']);
    var cols = { common: '#86efac', rare: '#93c5fd', epic: '#d8b4fe', mythic: '#fde68a' };
    var slice = Math.PI * 2 / slots.length;
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(c.angle * Math.PI / 180);
    for (var i = 0; i < slots.length; i++) {
      var a0 = -Math.PI / 2 + i * slice - slice / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, w.r, a0, a0 + slice);
      ctx.closePath();
      ctx.fillStyle = cols[slots[i]] || '#fff';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 10;
    ctx.stroke();
    for (var p = 0; p < slots.length; p++) {
      var a = c.angle * Math.PI / 180 - Math.PI / 2 + p * slice;
      D.seed(ctx, w.x + Math.cos(a) * w.r * 0.62, w.y + Math.sin(a) * w.r * 0.62, 0.35, { mood: 'happy' });
    }
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    D.face(ctx, w.x, w.y, w.r * 0.16, 'happy');
    var flap = Math.sin(s.time * (c.spinning ? 28 : 2)) * (c.spinning ? 0.2 : 0.04);
    ctx.save();
    ctx.translate(w.x, w.y - w.r - 6);
    ctx.rotate(flap);
    ctx.beginPath();
    ctx.moveTo(-16, -8);
    ctx.lineTo(16, -8);
    ctx.lineTo(0, 28);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
    D.label(ctx, 'Flick the wheel', w.x, w.y + w.r + 36, 26, '#3b2760', '#fff');
  }

  function drawPlant(ctx, s, v, c, phase) {
    var D = root.NMQDraw, award = v.award || c.memory || {};
    if (phase === 'packet' && s.box.packet) {
      var pk = s.box.packet;
      D.packet(ctx, pk.x, pk.y, pk.w, pk.h, { rarity: award.rarity, flower: award.flower, open: c.open });
      if (c.open < 1) D.label(ctx, 'Tap the packet', s.W / 2, pk.y + pk.h + 30, 24, '#3b2760', '#fff');
    }
    if (s.box.pot) {
      var growth = phase === 'water' || c.watered || phase === 'done'
        ? (award.kind === 'thirst' ? 0.75 + 0.25 * c.pour : c.pour)
        : 0;
      var droop = award.kind === 'thirst' ? (1 - c.pour) * 0.5 : 0;
      D.pot(ctx, s.box.pot.x, s.box.pot.y, s.box.potR / 90, {
        mood: growth > 0.4 ? 'wow' : 'happy',
        glow: c.seed && c.seed.held,
        mound: phase === 'water' && growth < 0.2
      });
      if (growth > 0.02) {
        D.flower(ctx, s.box.pot.x, s.box.pot.y - 10, award.flower || 'daisy', {
          growth: Math.max(0.15, growth), scale: s.box.potR / 120, droop: droop, level: award.level || 1, shiny: award.shiny
        });
      }
    }
    if (c.seed && !c.seed.planted && c.open >= 1) D.seed(ctx, c.seed.x, c.seed.y, 0.9, { mood: c.seed.held ? 'wow' : 'happy' });
    if ((phase === 'water') && c.can) {
      D.can(ctx, c.can.x, c.can.y, 1, c.can.tilt || 0, { mood: c.pouring ? 'wow' : 'happy' });
      if (!c.pouring && c.pour <= 0) D.label(ctx, 'Drag the can onto the pot', s.W / 2, s.box.pad + 70, 24, '#3b2760', '#fff');
    }
  }

  function drawNursery(ctx, s) {
    var D = root.NMQDraw, v = s.api.view(), box = s.box;
    D.label(ctx, 'Nursery', s.W / 2, 36, 32, '#166534', '#fff');
    ctx.save();
    D.roundRect(ctx, box.shelf.x, box.shelf.y, box.shelf.w, box.shelf.h, 24);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fill();
    ctx.clip();
    if (!(v.nursery || []).length) D.text(ctx, 'Grab a capsule in the claw', box.shelf.x + box.shelf.w / 2, box.shelf.y + 80, 22, '#166534');
    (box.pots || []).forEach(function (p) {
      var item = p.item;
      D.pot(ctx, p.x + p.w / 2, p.y + 120, 0.8, { mound: item.step < 2, mood: 'sleepy' });
      if (item.step >= 1) D.flower(ctx, p.x + p.w / 2, p.y + 100, item.flower || 'daisy', { growth: item.step >= 3 ? 0.8 : item.step === 2 ? 0.45 : 0.2, scale: 0.7, shiny: item.shiny });
      D.text(ctx, item.w, p.x + p.w / 2, p.y + 12, 20, '#3b2760');
      D.text(ctx, item.stage + (item.days > 0 ? ' · ' + item.days + 'd' : ' · ready'), p.x + p.w / 2, p.y + 168, 14, '#166534');
    });
    ctx.restore();
    if (v.fertilizer) D.text(ctx, 'Fertilizer x' + v.fertilizer, s.W / 2, s.H - 24, 16, '#3b2760');
  }

  function drawGarden(ctx, s) {
    var D = root.NMQDraw, v = s.api.view(), box = s.box;
    D.label(ctx, 'My garden', box.bed.x + 80, box.pad + 24, 28, '#3b2760', '#fff');
    if (v.rate) D.text(ctx, 'coins ticking', box.bed.x + 200, box.pad + 24, 16, '#166534', 'left');
    D.roundRect(ctx, box.bed.x, box.bed.y, box.bed.w, box.bed.h, 24);
    ctx.fillStyle = '#c4864a';
    ctx.fill();
    ctx.save();
    D.roundRect(ctx, box.bed.x, box.bed.y, box.bed.w, box.bed.h, 24);
    ctx.clip();
    if (!(v.garden || []).length) D.text(ctx, 'Flowers you master get planted here', box.bed.x + box.bed.w / 2, box.bed.y + 40, 18, '#fff');
    (box.flowers || []).forEach(function (f) {
      var item = f.item;
      D.flower(ctx, f.x + f.w / 2, f.y + f.h - 10, item.flower || 'daisy', {
        level: item.level, growth: 1, scale: 0.85,
        droop: item.thirsty ? 0.4 : 0, shiny: item.shiny
      });
      if (item.thirsty) D.label(ctx, 'thirsty', f.x + f.w / 2, f.y + 8, 14, '#0369a1', '#fff');
      D.text(ctx, item.w, f.x + f.w / 2, f.y + f.h + 6, 16, '#fff');
    });
    ctx.restore();
    (v.owned || []).forEach(function (id, i) {
      if (id === 'fence' || id === 'hat' || id === 'can') return;
      var x = box.bed.x + 40 + i * 64 + (s.reduced ? 0 : Math.sin(s.time * 0.8 + i) * 10);
      var y = box.bed.y + box.bed.h - 24;
      D.critter(ctx, id, x, y, 0.7 + (id === 'butterfly' && !s.reduced ? Math.sin(s.time * 6) * 0.05 : 0));
    });
    if ((v.owned || []).indexOf('fence') >= 0) D.critter(ctx, 'fence', box.bed.x + 30, box.bed.y + 30, 0.8);
    D.panel(ctx, box.shopPanel.x, box.shopPanel.y, box.shopPanel.w, box.shopPanel.h, { fill: '#fff7ed', edge: '#d97706', r: 20, lip: 8 });
    D.text(ctx, 'Stall', box.shopPanel.x + box.shopPanel.w / 2, box.shopPanel.y + 20, 20, '#9a3412');
    (box.shop || []).forEach(function (b) {
      var it = b.item;
      pushBtn(s, {
        id: b.id, x: b.x, y: b.y, w: b.w, h: b.h,
        label: it.owned ? it.name : it.name + ' ' + it.cost,
        fill: it.owned ? '#e5e7eb' : '#bbf7d0', edge: '#166534', color: '#14532d', size: 16
      });
    });
    if (box.spinBtn) pushBtn(s, box.spinBtn);
  }

  function drawSpin(ctx, s) {
    var D = root.NMQDraw, sp = s.spin;
    ctx.fillStyle = 'rgba(30,27,75,.35)';
    ctx.fillRect(0, 0, s.W, s.H);
    var cx = s.W / 2, cy = s.H / 2 - 10, r = Math.min(s.W, s.H) * 0.28;
    var names = ['coins', 'plant food', 'rare seed'];
    var cols = ['#fde68a', '#86efac', '#c4b5fd'];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sp.angle * Math.PI / 180);
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, i * Math.PI * 2 / 3, (i + 1) * Math.PI * 2 / 3);
      ctx.closePath();
      ctx.fillStyle = cols[i];
      ctx.fill();
    }
    ctx.restore();
    D.text(ctx, 'Daily spin', cx, cy - r - 28, 28, '#fff');
    if (sp.done) D.label(ctx, sp.label, cx, cy + r + 24, 26, '#3b2760', '#fff');
    pushBtn(s, { id: 'spin-go', x: cx - 90, y: cy + r + 50, w: 180, h: 64, label: sp.done ? sp.label : 'Spin', fill: '#fbbf24', edge: '#b45309', color: '#3b2600' });
    pushBtn(s, { id: 'spin-close', x: s.W - 120, y: 20, w: 96, h: 52, label: 'Close', fill: '#fff', edge: '#9ca3af', color: '#374151', size: 18 });
  }

  function mirror(s) {
    var v = s.api.view();
    var text = 'Word garden';
    if (s.scene === 'claw') text = s.claw && s.claw.hint ? s.claw.hint : 'Claw';
    if (s.scene === 'lesson' && v.lesson) text = v.lesson.w;
    if (s.scene === 'ceremony' && v.award) text = 'Prize ' + (v.award.w || '');
    var m = s.canvas.parentNode && s.canvas.parentNode.querySelector('.rw-mirror');
    if (!m && s.canvas.parentNode) {
      m = document.createElement('div');
      m.className = 'rw-mirror';
      s.canvas.parentNode.appendChild(m);
    }
    if (m && m.textContent !== text) m.textContent = text;
  }

  var api = { attach: attach, judgeGrab: judgeGrab, stepPendulum: stepPendulum };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NMQWorld = api;
})(typeof window !== 'undefined' ? window : globalThis);
