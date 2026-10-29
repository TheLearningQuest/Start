/* NMQWorld — 3D word garden.
   Three.js draws the toy room. A second canvas draws words, buttons, and the trace.
   Claw skill is still judgeGrab: the ring she sees (center + still) is the grab.
   No network. Three.js is vendored and loaded as a same-origin script. */
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
    if (s.hud && s.hud.parentNode) s.hud.parentNode.removeChild(s.hud);
    if (s.world) clearWorld(s);
    if (s.renderer) { s.renderer.dispose(); s.renderer = null; }
    if (session === s) session = null;
  }

  function attach(canvas, sceneName, api) {
    stop();
    var hud = document.createElement('canvas');
    hud.className = 'rw-hud';
    hud.setAttribute('aria-hidden', 'true');
    if (canvas.parentNode) canvas.parentNode.appendChild(hud);
    var s = {
      canvas: canvas, hud: hud, api: api, scene: sceneName, dead: false, raf: 0,
      time: 0, shake: 0, parts: [], ui: [],
      pointer: { down: false, id: null, x: 0, y: 0, sx: 0, sy: 0, moved: false },
      pip: { mood: 'happy', line: '', t: 0 },
      claw: null, lesson: null, ceremony: null, spin: null,
      pan: 0, W: 1, H: 1, dpr: 1, box: null, drag: null,
      refs: {}, viewKey: ''
    };
    session = s;
    s.onDown = function (e) { pointer(e, 'down'); };
    s.onMove = function (e) { pointer(e, 'move'); };
    s.onUp = function (e) { pointer(e, 'up'); };
    canvas.addEventListener('pointerdown', s.onDown);
    canvas.addEventListener('pointermove', s.onMove);
    canvas.addEventListener('pointerup', s.onUp);
    canvas.addEventListener('pointercancel', s.onUp);
    try { bootGL(s); } catch (err) { if (root.console && console.error) console.error(err); }
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
    if (s.scene === 'hub') s.pip = { mood: 'happy', line: '', t: 0 };
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
      if (s.dead || session !== s) return;
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
    var T = root.THREE;
    s.W = cssW;
    s.H = cssH;
    s.dpr = dpr;
    if (s.renderer && T) {
      if (s.renderer.getPixelRatio() !== dpr) s.renderer.setPixelRatio(dpr);
      var size = s.renderer.getSize(s._sz || (s._sz = new T.Vector2()));
      if (Math.abs(size.x - cssW) > 0.5 || Math.abs(size.y - cssH) > 0.5) s.renderer.setSize(cssW, cssH, false);
    }
    if (s.hud) {
      var bw = Math.round(cssW * dpr), bh = Math.round(cssH * dpr);
      if (s.hud.width !== bw || s.hud.height !== bh) { s.hud.width = bw; s.hud.height = bh; }
    }
    if (s.camera) {
      s.camera.aspect = cssW / Math.max(1, cssH);
      s.camera.updateProjectionMatrix();
    }
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

  function roomRect(room, x, y, w, h) {
    return { x: room.x + room.w * x, y: room.y + room.h * y, w: room.w * w, h: room.h * h };
  }

  /* One room. The claw sits in the middle, a door on each side, a picture on the back wall. */
  function layoutHub(s, box) {
    var v = s.api.view();
    var donePools = (v.pools || []).filter(function (pool) { return pool.done; });
    var W = box.W, H = box.H, pad = Math.max(6, box.pad * 0.35);
    var strip = donePools.length ? Math.max(88, Math.min(112, H * 0.16)) : 0;
    box.donePools = donePools;
    box.strip = strip;
    var room = { x: pad, y: pad + strip, w: W - pad * 2, h: H - pad * 2 - strip };
    box.room = room;
    box.doors = box.portrait
      ? {
        explore: roomRect(room, 0.22, 0.03, 0.56, 0.22),
        nursery: roomRect(room, 0.04, 0.28, 0.42, 0.26),
        garden: roomRect(room, 0.54, 0.28, 0.42, 0.26),
        claw: roomRect(room, 0.14, 0.56, 0.72, 0.40)
      }
      : {
        nursery: roomRect(room, 0.02, 0.10, 0.22, 0.74),
        garden: roomRect(room, 0.76, 0.10, 0.22, 0.74),
        explore: roomRect(room, 0.33, 0.04, 0.34, 0.36),
        claw: roomRect(room, 0.26, 0.40, 0.48, 0.56)
      };
    box.banners = [];
    var chips = [];
    if (v.award) chips.push('award');
    if (v.canSpin) chips.push('spin');
    chips.forEach(function (id, i) {
      box.banners.push({
        id: id,
        x: room.x + 10,
        y: room.y + 8 + i * 52,
        w: Math.min(220, room.w * 0.28),
        h: 44
      });
    });
    box.pip = null;
  }

  /* One capsule sits on the machine's center line so a still claw can grab clean. */
  function pilePlan(n) {
    var plans = {
      1: [[0]],
      2: [[0, 1]],
      3: [[-1, 0, 1]],
      4: [[-1, 0, 1], [0]],
      5: [[-1, 0, 1], [-0.5, 0.5]],
      6: [[-1, 0, 1], [-1.5, 0.5, 1.5]]
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
      var bw = Math.min(W - pad * 2, 980);
      var bh = Math.min(Math.max(180, H * 0.42), 320);
      box.letterBox = { x: (W - bw) / 2, y: Math.max(pad + 86, H * 0.22), w: bw, h: bh };
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
    box.pip = { x: pad + 74, y: H - pad - 36 };
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
    box.pip = { x: pad + 74, y: H - pad - 36 };
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
      hint: due.length ? 'Put the ring on a word. Hold still, then drop.' : '',
      hintT: 3, verdict: null, inited: false, due: due
    };
    if (!due.length) sayPip(s, 'No capsules today', 'sleepy');
    else sayPip(s, 'Put the ring on a word', 'happy');
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
    /* Wide enough that each word is its own target, and the back row sits above the front. */
    var gap = r * 2.15;
    var lift = r * 2.45;
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
      c.omega = 0;
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

  function setExplore(s, on) {
    var cur = !!(s.api.view() && s.api.view().explore);
    if (cur !== !!on && s.api.toggleExplore) s.api.toggleExplore();
  }

  function hubPointer(s, p, kind) {
    if (kind !== 'up' || s.pointer.moved) return;
    var b = uiHit(s, p.x, p.y);
    if (!b) return;
    s.api.sfx().tap();
    if (b.id === 'claw' || b.id === 'explore') {
      if (s.api.view().clawOff) return;
    }
    if (b.id === 'claw') {
      if (s.api.view().award) nav(s, 'ceremony');
      else { setExplore(s, false); nav(s, 'claw'); }
    } else if (b.id === 'nursery') nav(s, 'nursery');
    else if (b.id === 'garden') nav(s, 'garden');
    else if (b.id === 'explore') {
      setExplore(s, true);
      nav(s, 'claw');
    }
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
        c.markX = landingX(c);
        c.markY = (c.verdict.index >= 0 && c.caps[c.verdict.index]) ? c.caps[c.verdict.index].y : (c.caps[0] ? c.caps[0].y : 0);
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
    if (les.step === 2 && L.trace && !L.trace.skipped && root.NMQTrace) {
      var lay = root.NMQTrace.layoutWord(les.w, s.box && s.box.letterBox ? s.box.letterBox : { x: 0, y: 0, w: 400, h: 200 });
      if (!lay.cells.length) {
        L.trace.skipped = true;
        s.api.markStar('traceStar');
        s.api.setStep(3, false);
      }
    }
    return L;
  }

  function makeTrace(les) {
    return { points: [], drawing: false, done: false, armSpell: false, said: false, pop: 0, flags: [], ratio: 0, skipped: false, id: les && les.id };
  }

  function traceDown(s, p) {
    var tr = s.lesson.trace;
    var box = s.box.letterBox;
    if (!tr || !box || tr.done) return;
    tr.drawing = true;
    if (!tr.said) {
      tr.said = true;
      var word = s.api.word(s.lesson.id);
      if (word) s.api.speakWord(word);
      s.api.sfx().tap();
    }
    pushTrace(tr, p);
    traceCheck(s, 'down');
  }

  function traceMove(s, p) {
    var tr = s.lesson && s.lesson.trace;
    if (!tr || !tr.drawing || tr.done) return;
    pushTrace(tr, p);
    traceCheck(s, 'move');
  }

  function pushTrace(tr, p) {
    var last = tr.points[tr.points.length - 1];
    if (last && Math.abs(last.x - p.x) < 4 && Math.abs(last.y - p.y) < 4) return;
    tr.points.push({ x: p.x, y: p.y });
    if (tr.points.length > 700) tr.points.splice(0, tr.points.length - 700);
  }

  function traceCheck(s, how) {
    var tr = s.lesson.trace;
    var les = s.api.view().lesson;
    if (!tr || !les || !s.box.letterBox || !root.NMQTrace || tr.done) return;
    var lay = root.NMQTrace.layoutWord(les.w, s.box.letterBox);
    var res = root.NMQTrace.traceReady(lay, tr.points);
    tr.layout = lay;
    tr.flags = res.flags;
    tr.ratio = res.ratio;
    if (!res.done) return;
    tr.done = true;
    tr.drawing = false;
    tr.pop = 0.7;
    s.api.sfx().reward();
    if (s.api.confetti) s.api.confetti(s.reduced ? 8 : 22);
    var box = s.box.letterBox;
    root.NMQDraw.burst(s.parts, box.x + box.w / 2, box.y + box.h / 2, ['#fde68a', '#86efac', '#f9a8d4', '#fff'], s.reduced ? 8 : 22, s.reduced);
    if (how === 'down') {
      s.api.markStar('traceStar');
      s.api.setStep(3, true);
    } else tr.armSpell = true;
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

  /* ---------- 3D stage + HUD ---------- */

  function bootGL(s) {
    var T = root.THREE;
    if (!T) return;
    var renderer = new T.WebGLRenderer({ canvas: s.canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x8fd4ff, 1);
    if (T.SRGBColorSpace) renderer.outputColorSpace = T.SRGBColorSpace;
    s.renderer = renderer;
    s.scene3 = new T.Scene();
    s.camera = new T.PerspectiveCamera(36, 1, 0.05, 80);
    s.world = new T.Group();
    s.scene3.add(s.world);
    s.scene3.add(new T.HemisphereLight(0xfff6de, 0x68c978, 0.82));
    s.scene3.add(new T.AmbientLight(0xffffff, 0.42));
    var dir = new T.DirectionalLight(0xfff7ed, 1.05);
    dir.position.set(5, 9, 7);
    s.scene3.add(dir);
    s.raycaster = new T.Raycaster();
    s._ndc = new T.Vector2();
    s._plane = new T.Plane(new T.Vector3(0, 0, 1), 0);
    s._hit = new T.Vector3();
    s._a = new T.Vector3();
    s._b = new T.Vector3();
    s._up = new T.Vector3(0, 1, 0);
    s._dir = new T.Vector3();
    s._home = new T.Vector3();
    s._look = new T.Vector3();
    s._sz = new T.Vector2();
    s.refs = {};
    s.viewKey = '';
  }

  function clay(hex) {
    var m = new root.THREE.MeshLambertMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.42 });
    m.userData.base = hex;
    return m;
  }
  function basic(hex, opacity) {
    var opt = { color: hex };
    if (opacity != null && opacity < 1) {
      opt.transparent = true;
      opt.opacity = opacity;
      opt.depthWrite = false;
    }
    return new root.THREE.MeshBasicMaterial(opt);
  }
  function texOf(canvas) {
    var t = new root.THREE.CanvasTexture(canvas);
    if (root.THREE.SRGBColorSpace) t.colorSpace = root.THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }
  function roundFill(ctx, x, y, w, h, r, color) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  function labelTex(title, sub, bg) {
    var c = document.createElement('canvas');
    c.width = 512;
    c.height = 280;
    var ctx = c.getContext('2d');
    roundFill(ctx, 12, 12, 488, 256, 48, bg || '#3b82f6');
    ctx.fillStyle = '#fffdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 86px ui-rounded, Arial Rounded MT Bold, Trebuchet MS, sans-serif';
    ctx.fillText(String(title || ''), 256, sub ? 118 : 140);
    if (sub) {
      ctx.font = '700 44px ui-rounded, Arial Rounded MT Bold, Trebuchet MS, sans-serif';
      ctx.fillText(String(sub), 256, 196);
    }
    return texOf(c);
  }
  function wordTex(word) {
    var c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    var ctx = c.getContext('2d');
    roundFill(ctx, 16, 36, 480, 184, 64, '#fffdf8');
    ctx.fillStyle = '#3b2760';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var size = String(word).length > 8 ? 64 : String(word).length > 5 ? 84 : 120;
    ctx.font = '800 ' + size + 'px ui-rounded, Arial Rounded MT Bold, Trebuchet MS, sans-serif';
    ctx.fillText(String(word || ''), 256, 132);
    return texOf(c);
  }

  function atPixel(s, px, py, z, out) {
    out = out || s._hit;
    s._ndc.set((px / s.W) * 2 - 1, -(py / s.H) * 2 + 1);
    s.raycaster.setFromCamera(s._ndc, s.camera);
    s._plane.normal.set(0, 0, 1);
    s._plane.constant = -z;
    if (!s.raycaster.ray.intersectPlane(s._plane, out)) out.set(0, 0, z);
    return out;
  }
  function pixelSpan(s, px, py, z, pixels) {
    var a = atPixel(s, px, py, z, s._a).clone();
    var b = atPixel(s, px + pixels, py, z, s._b);
    return Math.max(0.001, a.distanceTo(b));
  }
  function faceCamera(s, mesh) {
    mesh.quaternion.copy(s.camera.quaternion);
    mesh.rotateY(Math.PI);
  }
  function stick(mesh, a, b, thick) {
    var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
    mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    mesh.scale.set(thick, len, thick);
    if (!mesh.userData.up) mesh.userData.up = new root.THREE.Vector3(0, 1, 0);
    if (!mesh.userData.dir) mesh.userData.dir = new root.THREE.Vector3();
    mesh.userData.dir.set(dx / len, dy / len, dz / len);
    mesh.quaternion.setFromUnitVectors(mesh.userData.up, mesh.userData.dir);
  }
  function quad(a, b, c, d, color) {
    var T = root.THREE;
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array([
      a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
      a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z
    ]), 3));
    geo.computeVertexNormals();
    var m = new T.Mesh(geo, clay(color));
    m.material.side = T.DoubleSide;
    return m;
  }
  function clearWorld(s) {
    var g = s.world;
    if (!g) return;
    var i, c;
    for (i = g.children.length - 1; i >= 0; i--) {
      c = g.children[i];
      g.remove(c);
      c.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (!o.material) return;
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function (m) {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      });
    }
    s.refs = {};
  }

  function addDiorama(s) {
    var T = root.THREE;
    var sun = new T.Mesh(new T.SphereGeometry(0.55, 18, 12), basic(0xfde047));
    sun.position.set(-5.2, 3.6, -4);
    var blush = new T.Mesh(new T.SphereGeometry(0.62, 16, 10), basic(0xfbcfe8, 0.35));
    blush.position.copy(sun.position);
    s.world.add(sun, blush);
    [[-3.2, 3.1, -3.2, 0.7], [1.4, 3.4, -3.6, 0.5], [4.2, 2.8, -3, 0.85]].forEach(function (c) {
      var cloud = new T.Mesh(new T.SphereGeometry(c[3], 12, 8), clay(0xffffff));
      cloud.position.set(c[0], c[1], c[2]);
      var puff = new T.Mesh(new T.SphereGeometry(c[3] * 0.7, 10, 8), clay(0xffffff));
      puff.position.set(c[0] + 0.5, c[1] + 0.15, c[2]);
      s.world.add(cloud, puff);
    });
    var hill = new T.Mesh(new T.SphereGeometry(2.4, 18, 12), clay(0x4ade80));
    hill.position.set(-4.5, -2.3, -2);
    var hill2 = new T.Mesh(new T.SphereGeometry(1.7, 16, 10), clay(0x22c55e));
    hill2.position.set(4.8, -2.1, -2.4);
    s.world.add(hill, hill2);
  }

  var FLOWER_COLOR = {
    daisy: 0xfffdf8, tulip: 0xf472b6, poppy: 0xef4444, bluebell: 0x60a5fa,
    orchid: 0xc084fc, lantern: 0xfbbf24, 'rainbow-rose': 0xfb7185, 'crystal-lotus': 0xa5f3fc
  };

  function makeFlower(kind) {
    var T = root.THREE;
    var g = new T.Group();
    var col = FLOWER_COLOR[kind] || 0xf472b6;
    var stem = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 0.7, 8), clay(0x16a34a));
    stem.position.y = 0.35;
    var leaf = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), clay(0x4ade80));
    leaf.scale.set(1.4, 0.45, 0.7);
    leaf.position.set(0.16, 0.32, 0);
    var head = new T.Group();
    head.position.y = 0.78;
    var n = kind === 'tulip' || kind === 'bluebell' ? 4 : 6;
    var i, petal, a;
    for (i = 0; i < n; i++) {
      petal = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), clay(col));
      a = (i / n) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.2, 0.02, Math.sin(a) * 0.2);
      petal.scale.set(1, 0.65, 0.8);
      head.add(petal);
    }
    var center = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), clay(kind === 'daisy' ? 0xfde047 : 0xfef3c7));
    head.add(center);
    g.add(stem, leaf, head);
    g.userData.head = head;
    return g;
  }
  function makePot() {
    var T = root.THREE;
    var g = new T.Group();
    var body = new T.Mesh(new T.CylinderGeometry(0.42, 0.32, 0.5, 16), clay(0xd0894f));
    body.position.y = 0.25;
    var rim = new T.Mesh(new T.TorusGeometry(0.42, 0.06, 8, 16), clay(0xe7b07a));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.5;
    var soil = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.08, 14), clay(0x6b3a22));
    soil.position.y = 0.46;
    g.add(body, rim, soil);
    return g;
  }
  function makeSeed() {
    var T = root.THREE;
    var g = new T.Group();
    var body = new T.Mesh(new T.SphereGeometry(0.28, 16, 12), clay(0x4ade80));
    var shine = new T.Mesh(new T.SphereGeometry(0.1, 8, 6), basic(0xecfccb));
    shine.position.set(-0.08, 0.1, 0.18);
    var eye = new T.Mesh(new T.SphereGeometry(0.045, 8, 6), clay(0x1e1b4b));
    eye.position.set(-0.08, 0.06, 0.24);
    var eye2 = new T.Mesh(new T.SphereGeometry(0.045, 8, 6), clay(0x1e1b4b));
    eye2.position.set(0.08, 0.06, 0.24);
    g.add(body, shine, eye, eye2);
    return g;
  }
  function makeCan() {
    var T = root.THREE;
    var g = new T.Group();
    var body = new T.Mesh(new T.CylinderGeometry(0.28, 0.32, 0.42, 14), clay(0x38bdf8));
    body.position.y = 0.2;
    var handle = new T.Mesh(new T.TorusGeometry(0.2, 0.04, 6, 12), clay(0x0ea5e9));
    handle.position.set(0, 0.42, 0);
    var spout = new T.Mesh(new T.CylinderGeometry(0.05, 0.08, 0.36, 8), clay(0x7dd3fc));
    spout.rotation.z = -0.9;
    spout.position.set(0.32, 0.28, 0);
    g.add(body, handle, spout);
    g.userData.spout = spout;
    return g;
  }
  function makeCritter(id) {
    var T = root.THREE;
    var g = new T.Group();
    if (id === 'bunny') {
      var body = new T.Mesh(new T.SphereGeometry(0.28, 12, 10), clay(0xfffdf8));
      var ear = new T.Mesh(new T.CapsuleGeometry(0.06, 0.22, 4, 8), clay(0xfffdf8));
      ear.position.set(-0.1, 0.4, 0);
      var ear2 = new T.Mesh(new T.CapsuleGeometry(0.06, 0.22, 4, 8), clay(0xfffdf8));
      ear2.position.set(0.1, 0.4, 0);
      g.add(body, ear, ear2);
    } else if (id === 'kitty') {
      g.add(new T.Mesh(new T.SphereGeometry(0.28, 12, 10), clay(0xfb923c)));
      var earK = new T.Mesh(new T.ConeGeometry(0.1, 0.16, 8), clay(0xfb923c));
      earK.position.set(-0.14, 0.28, 0);
      g.add(earK);
    } else if (id === 'butterfly') {
      var wing = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), clay(0xf9a8d4));
      wing.scale.set(1.3, 0.9, 0.3);
      wing.position.x = 0.18;
      var wing2 = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), clay(0xc4b5fd));
      wing2.scale.set(1.3, 0.9, 0.3);
      wing2.position.x = -0.18;
      g.add(wing, wing2, new T.Mesh(new T.CapsuleGeometry(0.04, 0.2, 3, 6), clay(0x3b2760)));
      g.userData.flap = [wing, wing2];
    } else if (id === 'fence') {
      for (var i = 0; i < 3; i++) {
        var post = new T.Mesh(new T.BoxGeometry(0.08, 0.4, 0.08), clay(0xfde68a));
        post.position.set((i - 1) * 0.22, 0.2, 0);
        g.add(post);
      }
    } else if (id === 'hat') {
      var brim = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 0.06, 14), clay(0xfbbf24));
      var top = new T.Mesh(new T.CylinderGeometry(0.16, 0.18, 0.22, 12), clay(0xf59e0b));
      top.position.y = 0.14;
      g.add(brim, top);
    } else if (id === 'can') {
      return makeCan();
    } else {
      var chick = new T.Mesh(new T.SphereGeometry(0.26, 12, 10), clay(0xfde047));
      var beak = new T.Mesh(new T.ConeGeometry(0.07, 0.12, 8), clay(0xf97316));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.02, 0.24);
      g.add(chick, beak);
    }
    return g;
  }

  function placeGroup(s, mesh, px, py, z, pxSize) {
    mesh.position.copy(atPixel(s, px, py, z, s._hit));
    var unit = pixelSpan(s, px, py, z, pxSize);
    mesh.scale.setScalar(unit);
    return mesh;
  }

  function frameCamera(s) {
    var cam = s.camera;
    if (!cam) return;
    /* Low and close so the front of the cabinet is big and the back row shrinks. */
    if (s.scene === 'claw') { s._home.set(0.55, 1.85, 3.15); s._look.set(0, -0.72, -0.15); cam.fov = 50; }
    else if (s.scene === 'lesson') { s._home.set(0, 2.2, 7.2); s._look.set(0, 0.05, 0); cam.fov = 40; }
    else if (s.scene === 'ceremony') { s._home.set(0, 2.4, 7.4); s._look.set(0, -0.05, 0); cam.fov = 40; }
    else { s._home.set(0.2, 2.9, 8.4); s._look.set(0, 0.1, 0); cam.fov = 40; }
    cam.position.copy(s._home);
    cam.lookAt(s._look);
    cam.aspect = s.W / Math.max(1, s.H);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  }

  function viewKey(s) {
    var v = s.api.view();
    var extra = '';
    if (s.scene === 'hub') extra = (v.explore ? '1' : '0') + ':' + ((v.due || []).length) + ':' + (v.award ? 'a' : '');
    if (s.scene === 'claw') extra = s.claw && s.claw.due ? s.claw.due.map(function (w) { return w.id; }).join(',') : '';
    if (s.scene === 'lesson') extra = v.lesson ? v.lesson.id + ':' + v.lesson.step : 'x';
    if (s.scene === 'nursery') extra = (v.nursery || []).map(function (n) { return n.id + n.step; }).join(',');
    if (s.scene === 'garden') extra = (v.garden || []).map(function (n) { return n.id; }).join(',') + '|' + (v.owned || []).join(',');
    if (s.scene === 'ceremony') {
      extra = v.award ? (v.award.phase + (v.award.flower || '') + (v.award.rarity || '')) : (s.ceremony && s.ceremony.watered ? 'grown' : 'done');
    }
    return s.scene + ':' + (s.H > s.W * 1.05 ? 'p' : 'l') + ':' + Math.round(s.W) + 'x' + Math.round(s.H) + ':' + extra;
  }

  function draw(s, reduced) {
    s.reduced = reduced;
    if (!s.renderer || !s.hud) {
      return;
    }
    if (s.scene === 'ceremony') ensureCeremony(s, s.api.view());
    frameCamera(s);
    var key = viewKey(s);
    if (key !== s.viewKey) {
      s.viewKey = key;
      clearWorld(s);
      rebuild(s);
    }
    pose(s);
    if (s.shake > 0.4 && !reduced) {
      s.camera.position.x += Math.sin(s.time * 52) * 0.012 * s.shake;
      s.camera.position.y += Math.cos(s.time * 46) * 0.008 * s.shake;
    }
    s.shake *= 0.88;
    s.renderer.render(s.scene3, s.camera);
    paintHud(s);
    mirror(s);
  }

  function rebuild(s) {
    addDiorama(s);
    if (s.scene === 'hub') buildHub(s);
    else if (s.scene === 'claw') buildClaw(s);
    else if (s.scene === 'lesson') buildLesson(s);
    else if (s.scene === 'ceremony') buildCeremony(s);
    else if (s.scene === 'nursery') buildNursery(s);
    else if (s.scene === 'garden') buildGarden(s);
  }

  function buildHub(s) {
    /* The illustrated room is painted on the HUD. This floor keeps the WebGL clear from flashing through. */
    var room = s.box.room;
    if (!room) return;
    var T = root.THREE;
    var floor = new T.Mesh(new T.BoxGeometry(1, 1, 1), clay(0xffd6ea));
    placeGroup(s, floor, room.x + room.w / 2, room.y + room.h / 2, -0.4, room.w);
    floor.scale.y = pixelSpan(s, room.x, room.y, -0.4, room.h);
    s.world.add(floor);
    s.refs.buildings = [];
  }

  function makeBuilding(s, rect, color, title, sub, icon) {
    var T = root.THREE;
    var g = new T.Group();
    var cx = rect.x + rect.w / 2;
    var cy = rect.y + rect.h * 0.48;
    var z = 0.2;
    var w = pixelSpan(s, cx, cy, z, rect.w * 0.78);
    var h = pixelSpan(s, cx, cy + 8, z, rect.h * 0.62);
    var body = new T.Mesh(new T.BoxGeometry(w, h, w * 0.78), clay(color));
    var roof = new T.Mesh(new T.BoxGeometry(w * 1.12, h * 0.22, w * 0.9), clay(0xfffdf8));
    roof.position.y = h * 0.52;
    var door = new T.Mesh(new T.BoxGeometry(w * 0.26, h * 0.36, w * 0.12), clay(0xfde68a));
    door.position.set(0, -h * 0.22, w * 0.4);
    var sign = new T.Mesh(new T.PlaneGeometry(w * 0.86, h * 0.36), new T.MeshBasicMaterial({ map: labelTex(title, sub, '#' + color.toString(16).padStart(6, '0')) }));
    sign.position.set(0, h * 0.05, w * 0.41);
    g.add(body, roof, door, sign);
    if (icon === 'flower') g.add(miniFlower(w));
    if (icon === 'pot') {
      var pot = makePot();
      pot.scale.setScalar(w * 0.55);
      pot.position.set(0, h * 0.15, w * 0.2);
      g.add(pot);
    }
    if (icon === 'claw') {
      var ball = new T.Mesh(new T.SphereGeometry(w * 0.12, 10, 8), clay(0xef4444));
      ball.position.set(0, h * 0.22, w * 0.35);
      g.add(ball);
    }
    g.position.copy(atPixel(s, cx, cy, z, s._hit));
    g.userData.baseY = g.position.y;
    s.world.add(g);
    return g;
  }
  function miniFlower(w) {
    var T = root.THREE;
    var g = new T.Group();
    var stem = new T.Mesh(new T.CylinderGeometry(w * 0.03, w * 0.04, w * 0.35, 6), clay(0x16a34a));
    stem.position.y = w * 0.2;
    var head = new T.Mesh(new T.SphereGeometry(w * 0.12, 8, 6), clay(0xfde047));
    head.position.y = w * 0.42;
    g.add(stem, head);
    g.position.set(0, w * 0.15, w * 0.2);
    return g;
  }
  function makePip() {
    var T = root.THREE;
    var g = new T.Group();
    var body = new T.Mesh(new T.SphereGeometry(0.34, 16, 12), clay(0x7dd3fc));
    var head = new T.Mesh(new T.SphereGeometry(0.28, 16, 12), clay(0xfde68a));
    head.position.y = 0.42;
    var e1 = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), clay(0x1e1b4b));
    e1.position.set(-0.09, 0.48, 0.22);
    var e2 = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), clay(0x1e1b4b));
    e2.position.set(0.09, 0.48, 0.22);
    var cheek = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), basic(0xfb7185, 0.7));
    cheek.position.set(0.16, 0.38, 0.18);
    g.add(body, head, e1, e2, cheek);
    return g;
  }

  /* Both rows stay in front of the floor. The front row is closer, so it reads bigger. */
  function capDepth(row) { return row ? 0.2 : 1.15; }

  function buildClaw(s) {
    var T = root.THREE;
    var g = s.box.glass;
    var cab = s.box.cab;
    /* One floor depth. A nearer quad was hiding the back row under the teal. */
    var zFloor = -0.85, zBack = -1.35, zF = 1.45;
    var farY = g.y + g.h * 0.08;
    var frontY = g.y + g.h - 6;
    var P = function (x, y, z) { return atPixel(s, x, y, z, s._hit).clone(); };
    var backL = g.x + g.w * 0.24, backR = g.x + g.w * 0.76;
    s.world.add(quad(P(g.x + 8, frontY, zFloor), P(g.x + g.w - 8, frontY, zFloor), P(backR, farY, zFloor), P(backL, farY, zFloor), 0x14b8a6));
    s.world.add(quad(P(backL, farY - g.h * 0.2, zBack), P(backR, farY - g.h * 0.2, zBack), P(backR, farY, zBack), P(backL, farY, zBack), 0xfff7ed));
    s.world.add(quad(P(g.x - 2, g.y + 18, 0.4), P(g.x + 6, frontY, zFloor), P(backL, farY, zFloor), P(backL - 4, farY - g.h * 0.16, zBack), 0xfb923c));
    s.world.add(quad(P(g.x + g.w + 2, g.y + 18, 0.4), P(backR + 4, farY - g.h * 0.16, zBack), P(backR, farY, zFloor), P(g.x + g.w - 6, frontY, zFloor), 0xfb923c));
    /* Front lip: the near edge of the bin, so the floor reads as a hole you look into. */
    var lip = new T.Mesh(new T.BoxGeometry(1, 0.22, 0.28), clay(0xf97316));
    var lipL = P(g.x + 18, frontY + 8, zF);
    var lipR = P(g.x + g.w - 18, frontY + 8, zF);
    stick(lip, lipL, lipR, pixelSpan(s, g.x, frontY, zF, 28));
    s.world.add(lip);
    addPost(s, cab.x + 16, cab.y + 8, cab.y + cab.h - 8, 0xea580c);
    addPost(s, cab.x + cab.w - 16, cab.y + 8, cab.y + cab.h - 8, 0xea580c);
    var railZ = -0.35;
    var railL = atPixel(s, g.x + 36, s.box.railY, railZ).clone();
    var railR = atPixel(s, g.x + g.w - 36, s.box.railY, railZ).clone();
    var rail = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 1, 12), clay(0xfacc15));
    stick(rail, railL, railR, pixelSpan(s, g.x, s.box.railY, 0.15, 22));
    s.world.add(rail);
    var sign = new T.Mesh(new T.PlaneGeometry(1, 0.38), new T.MeshBasicMaterial({ map: labelTex('RED WORDS', 'aim the ring', '#ef4444') }));
    placeGroup(s, sign, cab.x + cab.w / 2, cab.y + 28, 1.05, Math.min(cab.w * 0.42, 340));
    faceCamera(s, sign);
    s.world.add(sign);
    var bulbs = [];
    var n = 8, i;
    for (i = 0; i < n; i++) {
      var bulb = new T.Mesh(new T.SphereGeometry(0.5, 10, 8), clay(0xfef9c3));
      var bx = cab.x + 40 + (cab.w - 80) * (i / (n - 1));
      placeGroup(s, bulb, bx, cab.y + 68, 0.6, 14);
      bulb.userData.i = i;
      s.world.add(bulb);
      bulbs.push(bulb);
    }
    var claw = new T.Group();
    var head = new T.Mesh(new T.SphereGeometry(0.34, 16, 12), clay(0xef4444));
    claw.add(head);
    var prongs = [];
    for (i = 0; i < 3; i++) {
      var pivot = new T.Group();
      var prong = new T.Mesh(new T.BoxGeometry(0.16, 0.7, 0.16), clay(0xfffdf8));
      prong.position.y = -0.42;
      var tipm = new T.Mesh(new T.SphereGeometry(0.12, 10, 8), clay(0xfacc15));
      tipm.position.y = -0.8;
      pivot.add(prong, tipm);
      claw.add(pivot);
      prongs.push(pivot);
    }
    s.world.add(claw);
    var rope = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 1, 8), clay(0xfacc15));
    s.world.add(rope);
    var trolley = new T.Mesh(new T.BoxGeometry(0.7, 0.28, 0.45), clay(0xef4444));
    s.world.add(trolley);
    var discMat = basic(0x4ade80, 0.9);
    var disc = new T.Mesh(new T.CircleGeometry(0.5, 28), discMat);
    var ring = new T.Mesh(new T.RingGeometry(0.62, 0.82, 28), basic(0xffffff, 0.95));
    s.world.add(disc, ring);
    var beamMat = basic(0x4ade80, 0.28);
    var beam = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 1, 8), beamMat);
    s.world.add(beam);
    var drawer = new T.Mesh(new T.BoxGeometry(1, 0.7, 0.7), clay(0xfde68a));
    s.world.add(drawer);
    var caps = (s.claw && s.claw.caps ? s.claw.caps : []).map(function (cap, idx) {
      var colors = [0xfda4af, 0xfde68a, 0x86efac, 0x93c5fd, 0xd8b4fe, 0xfdba74];
      var mat = clay(colors[idx % colors.length]);
      var group = new T.Group();
      var body = new T.Mesh(new T.CapsuleGeometry(0.36, 0.42, 6, 12), mat);
      var plate = new T.Mesh(new T.CircleGeometry(0.4, 24), new T.MeshBasicMaterial({ map: wordTex(cap.w) }));
      plate.position.set(0, 0.02, 0.38);
      var eye = new T.Mesh(new T.SphereGeometry(0.055, 8, 6), clay(0x1e1b4b));
      eye.position.set(-0.11, 0.2, 0.3);
      var eye2 = new T.Mesh(new T.SphereGeometry(0.055, 8, 6), clay(0x1e1b4b));
      eye2.position.set(0.11, 0.2, 0.3);
      group.add(body, plate, eye, eye2);
      s.world.add(group);
      return { mesh: group, mat: mat, plate: plate, i: idx };
    });
    s.refs.claw = {
      claw: claw, prongs: prongs, rope: rope, trolley: trolley,
      disc: disc, discMat: discMat, ring: ring, beam: beam, beamMat: beamMat,
      drawer: drawer, bulbs: bulbs, caps: caps, sign: sign
    };
  }
  function addPost(s, x, y0, y1, color) {
    var a = atPixel(s, x, y0, 0.5).clone();
    var b = atPixel(s, x, y1, 0.5).clone();
    var mesh = new root.THREE.Mesh(new root.THREE.CylinderGeometry(0.5, 0.5, 1, 10), clay(color));
    stick(mesh, a, b, pixelSpan(s, x, (y0 + y1) / 2, 0.5, 22));
    s.world.add(mesh);
  }

  function buildLesson(s) {
    var T = root.THREE;
    var desk = new T.Mesh(new T.BoxGeometry(1, 1, 1), clay(0xf6d7a8));
    placeGroup(s, desk, s.W / 2, s.H * 0.78, 0.3, s.W * 0.8);
    desk.scale.y = pixelSpan(s, s.W / 2, s.H * 0.78, 0.3, s.H * 0.22);
    desk.scale.z = desk.scale.x * 0.55;
    s.world.add(desk);
    var wall = new T.Mesh(new T.BoxGeometry(1, 1, 1), clay(0xffe4e6));
    placeGroup(s, wall, s.W / 2, s.H * 0.22, -1.4, s.W * 0.7);
    wall.scale.y = pixelSpan(s, s.W / 2, s.H * 0.22, -1.4, s.H * 0.28);
    s.world.add(wall);
    var plant = makeFlower('daisy');
    placeGroup(s, plant, s.W * 0.12, s.H * 0.62, 0.4, 90);
    s.world.add(plant);
    var pot = makePot();
    placeGroup(s, pot, s.W * 0.88, s.H * 0.66, 0.35, 80);
    s.world.add(pot);
  }

  function buildCeremony(s) {
    var T = root.THREE;
    var v = s.api.view();
    var phase = v.award ? v.award.phase : (s.ceremony && s.ceremony.watered ? 'grown' : 'done');
    if (phase === 'wheel' && s.box.wheel) {
      var rig = new T.Group();
      var spin = new T.Group();
      var slots = (v.wheel || ['common', 'rare', 'epic', 'mythic', 'common', 'rare', 'epic', 'mythic']);
      var cols = { common: 0x86efac, rare: 0x93c5fd, epic: 0xd8b4fe, mythic: 0xfde68a };
      var i;
      for (i = 0; i < slots.length; i++) {
        var shape = wedgeShape(i, slots.length);
        var geo = new T.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 1 });
        var wedge = new T.Mesh(geo, clay(cols[slots[i]] || 0xffffff));
        spin.add(wedge);
        var pip = new T.Mesh(new T.SphereGeometry(0.08, 8, 6), clay(0x3b2760));
        var ang = Math.PI / 2 - i * (Math.PI * 2 / slots.length);
        pip.position.set(Math.cos(ang) * 0.62, Math.sin(ang) * 0.62, 0.2);
        spin.add(pip);
      }
      var hub = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.2, 16), clay(0xfffdf8));
      hub.rotation.x = Math.PI / 2;
      spin.add(hub);
      var nose = new T.Mesh(new T.ConeGeometry(0.12, 0.28, 10), clay(0x7c3aed));
      nose.position.set(0, 1.08, 0.2);
      rig.add(spin, nose);
      s.world.add(rig);
      s.refs.wheel = rig;
      s.refs.wheelSpin = spin;
    } else if (s.box.pot) {
      var pot = makePot();
      s.world.add(pot);
      var flower = makeFlower((v.award && v.award.flower) || (s.ceremony && s.ceremony.memory && s.ceremony.memory.flower) || 'daisy');
      s.world.add(flower);
      var seed = makeSeed();
      s.world.add(seed);
      var can = makeCan();
      s.world.add(can);
      var packet = new T.Mesh(new T.BoxGeometry(1, 1.25, 0.2), clay(0xfde68a));
      s.world.add(packet);
      s.refs.pot = pot;
      s.refs.flower = flower;
      s.refs.seed = seed;
      s.refs.can = can;
      s.refs.packet = packet;
    }
  }
  function wedgeShape(i, n) {
    var T = root.THREE;
    var step = Math.PI * 2 / n;
    var center = Math.PI / 2 - i * step;
    var a0 = center - step / 2;
    var a1 = center + step / 2;
    var shape = new T.Shape();
    shape.moveTo(Math.cos(a0) * 0.18, Math.sin(a0) * 0.18);
    shape.absarc(0, 0, 1, a0, a1, false);
    shape.lineTo(Math.cos(a1) * 0.18, Math.sin(a1) * 0.18);
    shape.absarc(0, 0, 0.18, a1, a0, true);
    return shape;
  }

  function buildNursery(s) {
    var T = root.THREE;
    var shelf = s.box.shelf;
    var board = new T.Mesh(new T.BoxGeometry(1, 1, 1), clay(0xf6d7a8));
    placeGroup(s, board, shelf.x + shelf.w / 2, shelf.y + shelf.h * 0.72, 0.15, shelf.w);
    board.scale.y = pixelSpan(s, shelf.x, shelf.y, 0.15, 18);
    s.world.add(board);
    s.refs.pots = (s.box.pots || []).map(function (p) {
      var g = new T.Group();
      var pot = makePot();
      g.add(pot);
      var flower = makeFlower(p.item.flower || 'daisy');
      flower.position.y = 0.45;
      g.add(flower);
      s.world.add(g);
      return { mesh: g, flower: flower, i: p.i };
    });
    s.refs.pip = makePip();
    s.world.add(s.refs.pip);
  }

  function buildGarden(s) {
    var bed = s.box.bed;
    var lawn = new root.THREE.Mesh(new root.THREE.BoxGeometry(1, 1, 1), clay(0x4ade80));
    placeGroup(s, lawn, bed.x + bed.w / 2, bed.y + bed.h * 0.62, 0.1, bed.w);
    lawn.scale.y = pixelSpan(s, bed.x, bed.y, 0.1, bed.h * 0.7);
    lawn.scale.z = lawn.scale.x * 0.45;
    s.world.add(lawn);
    s.refs.blooms = (s.box.flowers || []).map(function (f, i) {
      var g = new root.THREE.Group();
      var flower = makeFlower(f.item.flower || 'daisy');
      g.add(flower);
      var drop = new root.THREE.Mesh(new root.THREE.SphereGeometry(0.12, 8, 6), basic(0x38bdf8));
      drop.position.y = 1.15;
      drop.scale.set(0.7, 1.1, 0.7);
      g.add(drop);
      s.world.add(g);
      return { mesh: g, flower: flower, drop: drop, i: i };
    });
    var v = s.api.view();
    s.refs.pets = (v.owned || []).map(function (id, i) {
      var pet = makeCritter(id);
      s.world.add(pet);
      pet.userData.slot = i;
      pet.userData.kind = id;
      return pet;
    });
    s.refs.pip = makePip();
    s.world.add(s.refs.pip);
  }

  function pose(s) {
    if (s.scene === 'hub') poseHub(s);
    else if (s.scene === 'claw') poseClaw(s);
    else if (s.scene === 'ceremony') poseCeremony(s);
    else if (s.scene === 'nursery') poseNursery(s);
    else if (s.scene === 'garden') poseGarden(s);
    if (s.refs.pip && s.box) {
      var pip = s.box.pip || { x: 74, y: s.H - 46 };
      var hop = s.reduced ? 0 : (s.pip && s.pip.hop) || 0;
      placeGroup(s, s.refs.pip, pip.x, pip.y - hop, 0.85, 78);
      faceCamera(s, s.refs.pip);
    }
  }
  function poseHub() {}
  function poseClaw(s) {
    var R = s.refs.claw;
    var c = s.claw;
    if (!R || !c) return;
    prepClaw(s);
    var alive = !!(c.due && c.due.length);
    R.claw.visible = R.rope.visible = R.trolley.visible = R.beam.visible = alive;
    R.disc.visible = R.ring.visible = R.drawer.visible = alive;
    if (!alive) return;
    /* Scale is measured on a middle plane, then the mesh is pushed forward or back.
       Closer toys grow. Farther toys shrink. Screen centers stay on the aim spots. */
    var zRail = -0.35, zClaw = 1.72, zRef = 0.15;
    if (c.due && c.due.length) {
      var trolleyP = atPixel(s, c.x, c.railY, zRail, s._hit).clone();
      R.trolley.position.copy(trolleyP);
      var tScale = pixelSpan(s, c.x, c.railY, zRef, 52);
      R.trolley.scale.set(tScale, tScale * 0.7, tScale);
      var tip = tipOf(c);
      var tipP = atPixel(s, tip.x, tip.y, zClaw, s._hit).clone();
      var ropeThick = pixelSpan(s, c.x, c.railY, zRef, 16);
      stick(R.rope, trolleyP, tipP, ropeThick);
      var clawScale = pixelSpan(s, tip.x, tip.y, zRef, 78);
      R.claw.position.copy(tipP);
      R.claw.scale.setScalar(clawScale);
      R.claw.quaternion.setFromUnitVectors(s._up, s._dir.copy(trolleyP).sub(tipP).normalize());
      var spread = 0.22 + c.open * 0.85;
      R.prongs[0].rotation.z = spread;
      R.prongs[1].rotation.z = -spread;
      R.prongs[2].rotation.x = spread;
      var preview = c.phase === 'aim' ? judgeGrab(landingX(c), c.caps, c.theta, c.omega) : c.verdict;
      var aimX = c.phase === 'aim' ? landingX(c) : (c.markX || landingX(c));
      var aimY = s.box.floorY;
      if (c.phase === 'aim' && preview && preview.index >= 0 && c.caps[preview.index]) aimY = c.caps[preview.index].y;
      else if (c.markY) aimY = c.markY;
      var aimRow = (preview && preview.index >= 0 && c.caps[preview.index]) ? c.caps[preview.index].row : 0;
      var aimZ = capDepth(aimRow) - 0.08;
      var aimP = atPixel(s, aimX, aimY, aimZ, s._hit).clone();
      var show = c.phase === 'aim' || c.phase === 'drop' || c.phase === 'close';
      R.disc.visible = R.ring.visible = R.beam.visible = show && !!c.due.length;
      var hex = !preview || preview.result === 'miss' ? 0xcbd5e1 : (preview.result === 'clean' ? 0x4ade80 : 0xfb923c);
      R.discMat.color.setHex(hex);
      R.beamMat.color.setHex(hex);
      var rr = pixelSpan(s, aimX, aimY, zRef, 86) * (preview && preview.result === 'clean' && !s.reduced ? 1 + Math.sin(s.time * 7) * 0.06 : 1);
      R.disc.position.copy(aimP);
      R.ring.position.copy(aimP);
      R.ring.position.z += 0.02;
      faceCamera(s, R.disc);
      faceCamera(s, R.ring);
      R.disc.scale.setScalar(rr);
      R.ring.scale.setScalar(rr);
      var beamThick = pixelSpan(s, aimX, aimY, zRef, 12);
      stick(R.beam, tipP, aimP, beamThick);
      R.caps.forEach(function (ref) {
        var cap = c.caps[ref.i];
        if (!cap) return;
        var riding = c.held === cap.i || (c.fallCap === cap.i && (c.phase === 'fall' || c.phase === 'drawer' || c.phase === 'crack'));
        var cz = riding ? zClaw : capDepth(cap.row);
        ref.mesh.visible = !(c.phase === 'crack' && cap.i === c.fallCap && c.phaseT > 0.2);
        ref.mesh.position.copy(atPixel(s, cap.x, cap.y, cz, s._hit));
        var sc = pixelSpan(s, cap.x, cap.y, zRef, cap.r * 2.65);
        if (ref.plate) faceCamera(s, ref.plate);
        var hot = preview && preview.index === cap.i && (c.phase === 'aim' || c.phase === 'drop' || c.phase === 'close');
        ref.mat.emissive.setHex(hot ? (preview.result === 'clean' ? 0x86efac : 0xfdba74) : (ref.mat.userData.base || 0xffffff));
        ref.mat.emissiveIntensity = hot ? 0.72 : 0.42;
        ref.mesh.scale.set(sc * (cap.sx || 1), sc * (cap.sy || 1), sc);
        if (c.phase === 'crack' && cap.i === c.fallCap) {
          ref.mesh.scale.x = sc * (1 + c.phaseT * 2);
        }
      });
      if (c.chuteX) {
        placeGroup(s, R.drawer, c.chuteX, c.drawerY, 0.7, 86);
        R.drawer.visible = c.phase === 'fall' || c.phase === 'drawer' || c.phase === 'crack';
      }
    }
    (R.bulbs || []).forEach(function (bulb) {
      var on = !s.reduced && Math.floor(s.time * 6) % R.bulbs.length === bulb.userData.i;
      bulb.material.emissive.setHex(on ? 0xfde047 : 0x000000);
      bulb.material.emissiveIntensity = on ? 0.8 : 0;
    });
  }
  function poseCeremony(s) {
    var c = s.ceremony;
    var w = s.box.wheel;
    if (s.refs.wheel && w && c) {
      var unit = pixelSpan(s, w.x, w.y, 0.25, w.r);
      s.refs.wheel.position.copy(atPixel(s, w.x, w.y, 0.25, s._hit));
      s.refs.wheel.scale.setScalar(unit);
      faceCamera(s, s.refs.wheel);
      s.refs.wheelSpin.rotation.z = -c.angle * Math.PI / 180;
    }
    if (!s.refs.pot || !c) return;
    var pot = s.box.pot;
    var award = s.api.view().award || c.memory || {};
    if (pot) {
      placeGroup(s, s.refs.pot, pot.x, pot.y, 0.3, (s.box.potR || 90) * 1.3);
    }
    var phase = s.api.view().award ? s.api.view().award.phase : (c.watered ? 'grown' : 'done');
    var growth = phase === 'water' || phase === 'grown' || c.watered
      ? (award.kind === 'thirst' ? 0.75 + 0.25 * c.pour : c.pour)
      : 0;
    if (s.refs.flower && pot) {
      s.refs.flower.visible = growth > 0.04;
      placeGroup(s, s.refs.flower, pot.x, pot.y - 10, 0.45, (s.box.potR || 90) * Math.max(0.2, growth));
      if (s.refs.flower.userData.head) {
        s.refs.flower.userData.head.rotation.z = award.kind === 'thirst' ? (1 - c.pour) * 0.7 : Math.sin(s.time * 1.5) * 0.05;
      }
    }
    if (s.refs.seed && c.seed) {
      s.refs.seed.visible = c.open >= 1 && !c.seed.planted;
      placeGroup(s, s.refs.seed, c.seed.x, c.seed.y, 0.8, 64);
    } else if (s.refs.seed) s.refs.seed.visible = false;
    if (s.refs.can && c.can && (phase === 'water' || phase === 'grown')) {
      s.refs.can.visible = phase === 'water' && !c.watered;
      placeGroup(s, s.refs.can, c.can.x, c.can.y, 0.85, 120);
      s.refs.can.rotation.z = c.can.tilt || 0;
    } else if (s.refs.can) s.refs.can.visible = false;
    if (s.refs.packet && s.box.packet) {
      var pk = s.box.packet;
      s.refs.packet.visible = phase === 'packet';
      placeGroup(s, s.refs.packet, pk.x + pk.w / 2, pk.y + pk.h / 2, 0.4, pk.w);
      s.refs.packet.scale.y = pixelSpan(s, pk.x, pk.y, 0.4, pk.h);
      if (c.open >= 1) s.refs.packet.rotation.x = -0.7;
      else s.refs.packet.rotation.x = 0;
    }
  }
  function poseNursery(s) {
    (s.refs.pots || []).forEach(function (ref) {
      var p = (s.box.pots || [])[ref.i];
      if (!p) return;
      var growth = p.item.step >= 3 ? 0.85 : p.item.step === 2 ? 0.5 : 0.22;
      placeGroup(s, ref.mesh, p.x + p.w / 2, p.y + 130, 0.3, p.w * 0.85);
      ref.flower.scale.setScalar(growth);
      ref.flower.visible = p.item.step >= 1 && !p.item.flower;
      if (ref.flower.userData.head && !s.reduced) ref.flower.userData.head.rotation.z = Math.sin(s.time * 1.3 + ref.i) * 0.08;
    });
  }
  function poseGarden(s) {
    (s.refs.blooms || []).forEach(function (b) {
      var f = (s.box.flowers || [])[b.i];
      if (!f) return;
      var px = f.x + f.w / 2, py = f.y + f.h - 20;
      placeGroup(s, b.mesh, px, py, 0.25, 100);
      if (b.flower) b.flower.visible = false;
      b.drop.visible = !!f.item.thirsty && !s.reduced;
      if (b.drop.visible) b.drop.position.y = 1.2 + Math.sin(s.time * 4 + b.i) * 0.08;
      if (b.flower.userData.head) b.flower.userData.head.rotation.z = f.item.thirsty ? 0.65 : (s.reduced ? 0 : Math.sin(s.time * 1.2 + b.i) * 0.06);
    });
    var bed = s.box.bed;
    (s.refs.pets || []).forEach(function (pet) {
      if (!bed) return;
      var x = bed.x + 50 + pet.userData.slot * 70;
      var y = bed.y + bed.h - 36;
      placeGroup(s, pet, x, y, 0.6, 64);
      if (pet.userData.flap && !s.reduced) {
        var flap = Math.sin(s.time * 8) * 0.4;
        pet.userData.flap[0].rotation.y = flap;
        pet.userData.flap[1].rotation.y = -flap;
      }
    });
  }

  function paintHud(s) {
    var ctx = s.hud.getContext('2d');
    var D = root.NMQDraw;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.W, s.H);
    s.ui = [];
    if (s.scene === 'hub') paintHub(ctx, s, D);
    else if (s.scene === 'claw') paintClaw(ctx, s, D);
    else if (s.scene === 'lesson') paintLesson(ctx, s, D);
    else if (s.scene === 'ceremony') paintCeremony(ctx, s, D);
    else if (s.scene === 'nursery') paintNursery(ctx, s, D);
    else if (s.scene === 'garden') paintGarden(ctx, s, D);
    s.ui.forEach(function (b) {
      if (b.ghost) return;
      var pressed = s.pointer.down && s.pointer.x >= b.x && s.pointer.x <= b.x + b.w && s.pointer.y >= b.y && s.pointer.y <= b.y + b.h;
      D.button(ctx, b, pressed);
    });
    if (s.pip && s.pip.line && s.scene !== 'hub' && (s.scene === 'nursery' || s.scene === 'garden')) {
      var px = s.box.pip ? s.box.pip.x : 74;
      var py = s.box.pip ? s.box.pip.y : s.H - 40;
      D.bubble(ctx, px + 28, py - 78, s.pip.line, Math.min(320, s.W * 0.55));
    }
    D.drawParts(ctx, s.parts);
    if (s.spin) paintSpin(ctx, s, D);
  }
  function pushBtn(s, b) { s.ui.push(b); return b; }
  function padStars(s) { return { x: s.box.pad + 10, y: s.box.pad + 8 }; }
  function drawStars(ctx, s, at, a, b, c) {
    var D = root.NMQDraw;
    [a, b, c].forEach(function (on, i) {
      var x = at.x + 16 + i * 36;
      if (on) D.star(ctx, x, at.y + 16, 16, '#fbbf24', true);
      else D.star(ctx, x, at.y + 16, 16, '#d6d3d1', false);
    });
  }

  function paintHub(ctx, s, D) {
    var box = s.box, room = box.room, doors = box.doors;
    if (!room || !doors) return;
    ctx.save();
    D.roundRect(ctx, 0, 0, s.W, s.H, 0);
    ctx.fillStyle = '#ffd0e8';
    ctx.fill();
    var wallH = room.y + room.h * 0.62;
    var wall = ctx.createLinearGradient(0, 0, 0, wallH);
    wall.addColorStop(0, '#ffe8f6');
    wall.addColorStop(1, '#ffc4e4');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, s.W, wallH);
    var dot;
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (dot = 0; dot < 18; dot++) {
      ctx.beginPath();
      ctx.arc((dot * 97) % s.W, 28 + (dot * 53) % Math.max(40, wallH - 40), 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f6c98a';
    ctx.fillRect(0, wallH, s.W, s.H - wallH);
    ctx.strokeStyle = 'rgba(180,110,40,.25)';
    ctx.lineWidth = 3;
    var plank;
    for (plank = wallH + 18; plank < s.H; plank += 22) {
      ctx.beginPath();
      ctx.moveTo(0, plank);
      ctx.lineTo(s.W, plank);
      ctx.stroke();
    }
    D.roundRect(ctx, room.x + room.w * 0.28, wallH - 8, room.w * 0.44, Math.min(36, room.h * 0.08), 18);
    ctx.fillStyle = '#fff3c4';
    ctx.fill();
    ctx.restore();
    drawRoomDoor(ctx, s, D, doors.nursery, 'Nursery', 'seedling');
    drawRoomDoor(ctx, s, D, doors.garden, 'Garden', 'garden');
    drawStarPicture(ctx, s, D, doors.explore);
    drawRoomClaw(ctx, s, D, doors.claw);
    var clawOff = !!(s.api && s.api.view && s.api.view().clawOff);
    var targets = [['nursery', doors.nursery], ['garden', doors.garden]];
    if (!clawOff) targets.push(['claw', doors.claw], ['explore', doors.explore]);
    targets.forEach(function (pair) {
      var rect = pair[1];
      pushBtn(s, { id: pair[0], x: rect.x, y: rect.y, w: rect.w, h: rect.h, ghost: true, label: pair[0] });
    });
    if (box.strip && box.donePools && box.donePools.length) {
      var count = box.donePools.length;
      var gap = 10;
      var width = (s.W - box.pad * 2 - gap * (count - 1)) / count;
      box.donePools.forEach(function (pool, i) {
        var label = '★ ' + pool.title + ' complete!';
        pushBtn(s, {
          id: 'pool-' + pool.id,
          x: box.pad + i * (width + gap),
          y: 8,
          w: width,
          h: Math.max(52, box.strip - 14),
          label: label,
          fill: '#fde68a',
          edge: '#d97706',
          color: '#7c2d12',
          size: Math.max(20, Math.min(36, width / (label.length * 0.56)))
        });
      });
    }
    box.banners.forEach(function (b) {
      var label = b.id === 'award' ? 'Your seed is waiting' : 'Daily spin!';
      var fill = b.id === 'award' ? '#bbf7d0' : '#ddd6fe';
      pushBtn(s, { id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, label: label, fill: fill, edge: '#7c3aed', color: '#3b2760', size: 16 });
    });
  }

  function drawRoomDoor(ctx, s, D, rect, name, kind) {
    D.panel(ctx, rect.x, rect.y, rect.w, rect.h, { fill: '#fffdf8', edge: '#f9a8d4', r: 28, lip: 8 });
    D.roundRect(ctx, rect.x + 14, rect.y + 14, rect.w - 28, rect.h - 58, 22);
    ctx.fillStyle = kind === 'garden' ? '#dcfce7' : '#ecfccb';
    ctx.fill();
    var cx = rect.x + rect.w / 2;
    var iconY = rect.y + rect.h * 0.46;
    if (kind === 'seedling') {
      D.pot(ctx, cx, iconY + 8, Math.min(rect.w, rect.h) / 280, { mood: 'happy' });
      D.flower(ctx, cx, iconY - 6, 'daisy', { growth: 0.28, scale: Math.min(rect.w, rect.h) / 220 });
    } else {
      D.flower(ctx, cx, iconY + 18, 'tulip', { growth: 0.85, scale: Math.min(rect.w, rect.h) / 160 });
      D.flower(ctx, cx - rect.w * 0.18, iconY + 28, 'daisy', { growth: 0.7, scale: Math.min(rect.w, rect.h) / 240 });
      D.flower(ctx, cx + rect.w * 0.18, iconY + 26, 'poppy', { growth: 0.7, scale: Math.min(rect.w, rect.h) / 240 });
    }
    D.label(ctx, name, cx, rect.y + rect.h - 24, Math.max(18, Math.min(28, rect.w * 0.16)), '#3b2760', '#fff');
  }

  function drawStarPicture(ctx, s, D, rect) {
    D.panel(ctx, rect.x, rect.y, rect.w, rect.h, { fill: '#fff7ed', edge: '#fbbf24', r: 18, lip: 6 });
    D.roundRect(ctx, rect.x + 12, rect.y + 12, rect.w - 24, rect.h - 46, 14);
    ctx.fillStyle = '#1e1b4b';
    ctx.fill();
    var cx = rect.x + rect.w * 0.62;
    var cy = rect.y + (rect.h - 46) * 0.48;
    ctx.save();
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.w * 0.18, rect.y + rect.h * 0.62);
    ctx.lineTo(cx - 8, cy + 6);
    ctx.stroke();
    ctx.restore();
    D.star(ctx, cx, cy, Math.min(rect.w, rect.h) * 0.16, '#fde047', true);
    D.label(ctx, 'Explore New Words', rect.x + rect.w / 2, rect.y + rect.h - 18, Math.max(13, Math.min(20, rect.w * 0.09)), '#7c3aed', '#fff');
  }

  function drawRoomClaw(ctx, s, D, rect) {
    var x = rect.x, y = rect.y, w = rect.w, h = rect.h;
    var clawOff = false;
    try { clawOff = !!(s.api && s.api.view && s.api.view().clawOff); } catch (err) { clawOff = false; }
    ctx.save();
    if (clawOff) ctx.globalAlpha = 0.4;
    var u = Math.min(w, h);
    var bodyX = x + w * 0.08;
    var bodyW = w * 0.84;
    var bodyY = y + h * 0.02;
    var bodyH = h * 0.76;
    function capsule(cx, cy, scale, color) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      D.roundRect(ctx, -15, -26, 30, 52, 15);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.fillRect(-15, -5, 30, 9);
      ctx.fillStyle = '#3b2760';
      ctx.beginPath();
      ctx.arc(-6, -12, 2.3, 0, Math.PI * 2);
      ctx.arc(6, -12, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3b2760';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, -6, 4, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = 'rgba(120, 40, 70, 0.18)';
    D.ellipse(ctx, x + w * 0.5, bodyY + bodyH + u * 0.02, bodyW * 0.42, Math.max(6, u * 0.035));
    ctx.fill();
    ctx.restore();
    var legW = Math.max(12, u * 0.055);
    var legH = Math.max(16, bodyH * 0.1);
    [0.22, 0.78].forEach(function (t) {
      D.roundRect(ctx, bodyX + bodyW * t - legW / 2, bodyY + bodyH - legH * 0.35, legW, legH, legW * 0.45);
      ctx.fillStyle = '#fb7185';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    });
    D.panel(ctx, bodyX, bodyY + bodyH * 0.78, bodyW, bodyH * 0.24, {
      fill: '#fda4af', edge: '#e11d48', r: Math.max(16, u * 0.07), lip: Math.max(5, u * 0.03), gloss: false
    });
    D.panel(ctx, bodyX + bodyW * 0.05, bodyY + bodyH * 0.1, bodyW * 0.9, bodyH * 0.74, {
      fill: '#fb7185', edge: '#be123c', r: Math.max(18, u * 0.08), lip: Math.max(6, u * 0.035)
    });
    D.roundRect(ctx, bodyX, bodyY, bodyW, bodyH * 0.18, Math.max(16, u * 0.07));
    ctx.fillStyle = '#e11d48';
    ctx.fill();
    D.roundRect(ctx, bodyX, bodyY, bodyW, bodyH * 0.15, Math.max(16, u * 0.07));
    ctx.fillStyle = '#fb7185';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(3, u * 0.012);
    ctx.stroke();
    var signW = bodyW * 0.46;
    var signH = Math.max(22, bodyH * 0.09);
    D.roundRect(ctx, bodyX + (bodyW - signW) / 2, bodyY + bodyH * 0.025, signW, signH, 10);
    ctx.fillStyle = '#fff7ed';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fb7185';
    ctx.stroke();
    D.text(ctx, 'Red Words', bodyX + bodyW / 2, bodyY + bodyH * 0.025 + signH / 2, Math.max(13, Math.min(22, u * 0.065)), '#3b2760');
    var gx = bodyX + bodyW * 0.14;
    var gy = bodyY + bodyH * 0.18;
    var gw = bodyW * 0.72;
    var gh = bodyH * 0.58;
    D.roundRect(ctx, gx, gy, gw, gh, Math.max(12, u * 0.05));
    ctx.fillStyle = '#ddd6fe';
    ctx.fill();
    ctx.save();
    D.roundRect(ctx, gx, gy, gw, gh, Math.max(12, u * 0.05));
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    var dot;
    for (dot = 0; dot < 16; dot++) {
      ctx.beginPath();
      ctx.arc(gx + 12 + (dot * 37) % Math.max(20, gw - 16), gy + 14 + (dot * 29) % Math.max(20, gh * 0.55), Math.max(3, u * 0.012), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#86efac';
    ctx.fillRect(gx, gy + gh * 0.62, gw, gh * 0.4);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (dot = 0; dot < 8; dot++) {
      ctx.beginPath();
      ctx.arc(gx + 16 + (dot * 29) % Math.max(20, gw - 20), gy + gh * 0.72 + (dot % 3) * 8, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    var toy = Math.max(0.72, Math.min(1.05, u / 340));
    capsule(gx + gw * 0.24, gy + gh * 0.78, toy * 0.9, '#fb7185');
    capsule(gx + gw * 0.42, gy + gh * 0.74, toy, '#38bdf8');
    capsule(gx + gw * 0.58, gy + gh * 0.8, toy * 0.82, '#fde047');
    ctx.beginPath();
    ctx.ellipse(gx + gw * 0.8, gy + gh * 0.86, Math.max(16, u * 0.07), Math.max(8, u * 0.032), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#312e81';
    ctx.fill();
    ctx.lineWidth = Math.max(4, u * 0.016);
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
    D.roundRect(ctx, gx, gy, gw, gh, Math.max(12, u * 0.05));
    ctx.lineWidth = Math.max(5, u * 0.028);
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    var clawX = gx + gw * 0.5;
    var clawY = gy + gh * 0.36;
    var head = Math.max(11, u * 0.05);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(5, u * 0.02);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(gx + 12, gy + gh * 0.16);
    ctx.lineTo(gx + gw - 12, gy + gh * 0.16);
    ctx.stroke();
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = Math.max(4, u * 0.016);
    ctx.beginPath();
    ctx.moveTo(clawX, gy + gh * 0.16);
    ctx.lineTo(clawX, clawY - head);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(clawX, clawY, head, 0, Math.PI * 2);
    ctx.fillStyle = '#fde68a';
    ctx.fill();
    ctx.lineWidth = Math.max(3, u * 0.012);
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = Math.max(5, u * 0.02);
    ctx.lineCap = 'round';
    [[-1, 1.15], [0, 1.45], [1, 1.15]].forEach(function (prong) {
      ctx.beginPath();
      ctx.moveTo(clawX + prong[0] * head * 0.35, clawY + head * 0.35);
      ctx.quadraticCurveTo(
        clawX + prong[0] * head * 1.1,
        clawY + head * 0.9,
        clawX + prong[0] * head * prong[1],
        clawY + head * 1.7
      );
      ctx.stroke();
    });
    D.label(ctx, 'Red Words', x + w / 2, y + h - 16, Math.max(16, Math.min(26, w * 0.1)), '#fff', '#9f1239');
    ctx.restore();
    if (clawOff) {
      D.label(ctx, 'All done!', x + w / 2, y + h * 0.52, Math.max(22, Math.min(40, w * 0.12)), '#7c2d12', '#fff');
    }
  }

  function paintClaw(ctx, s, D) {
    var c = s.claw, box = s.box;
    if (!c) return;
    if (!c.due.length) {
      D.label(ctx, 'All empty!', s.W / 2, s.H / 2, 36, '#1e3a8a', '#fff');
      pushBtn(s, { id: 'garden', x: s.W / 2 - 120, y: box.drop.y, w: 240, h: box.drop.h, label: 'Garden', fill: '#f472b6', edge: '#9d174d', color: '#fff' });
      return;
    }
    if (c.hint && c.hintT > 0) D.label(ctx, c.hint, s.W / 2, box.drop.y - 28, 24, '#1e3a8a', '#fff');
    if (c.phase === 'crack') {
      var capc = c.caps[c.fallCap];
      if (capc) {
        D.label(ctx, capc.w, s.W / 2, s.H * 0.46, 64, '#be123c', '#fff');
      }
    }
    if (c.phase === 'aim') {
      var prev = judgeGrab(landingX(c), c.caps, c.theta, c.omega);
      var label = prev.result === 'clean' ? 'DROP!' : (prev.result === 'slip' && prev.hint.indexOf('still') >= 0 ? 'WAIT' : (prev.result === 'slip' ? 'NUDGE' : 'SLIDE'));
      var fill = prev.result === 'clean' ? '#4ade80' : (label === 'WAIT' ? '#fdba74' : '#fde68a');
      pushBtn(s, { id: 'drop', x: box.drop.x, y: box.drop.y, w: box.drop.w, h: box.drop.h, label: label, fill: fill, edge: '#166534', color: '#14532d', size: 34 });
    } else {
      pushBtn(s, { id: 'busy', x: box.drop.x, y: box.drop.y, w: box.drop.w, h: box.drop.h, label: c.phase === 'drawer' ? 'Tap it' : '…', fill: '#e5e7eb', edge: '#9ca3af', color: '#374151', size: 28 });
    }
  }

  function paintLesson(ctx, s, D) {
    var v = s.api.view(), les = v.lesson, box = s.box;
    if (!les) {
      D.label(ctx, 'All done', s.W / 2, s.H / 2, 36, '#3b2760', '#fff');
      pushBtn(s, { id: 'hub', x: s.W / 2 - 110, y: s.H / 2 + 24, w: 220, h: 72, label: 'Garden', fill: '#fde68a', edge: '#b45309', color: '#3b2600' });
      return;
    }
    ensureLesson(s, les);
    drawStars(ctx, s, padStars(s), !!(les.letterStar || les.step >= 2), !!(les.traceStar || les.step >= 3), false);
    if (les.step < 3) pushBtn(s, box.hear);
    var tr = s.lesson && s.lesson.trace;
    var prompt = les.step < 2 ? 'Tap each letter' : (les.step === 2 ? (tr && tr.done ? 'You wrote it!' : 'Trace the whole word') : (les.mode === 'review' ? 'This flower is thirsty. Spell it.' : 'Spell it from memory'));
    D.label(ctx, prompt, s.W / 2, box.promptY, 28, '#3b2760', '#fff');
    if (les.step < 2) drawTapLetters(ctx, s, les, D);
    else if (les.step === 2) drawWordTrace(ctx, s, les, D);
    else drawSpell(ctx, s, les, D);
  }

  function drawTapLetters(ctx, s, les, D) {
    var L = s.lesson;
    var expect = nextIndex(les.w, L.tapAt);
    (s.box.letters || []).forEach(function (tile) {
      var done = tile.i < L.tapAt || !isLetter(tile.ch);
      var hot = (les.tricky || []).indexOf(tile.i) >= 0;
      var wig = L.wiggle === tile.i && L.wiggleT > 0 ? Math.sin(s.time * 40) * 4 : 0;
      var squ = L.squ === tile.i ? 1.08 : 1;
      ctx.save();
      ctx.translate(tile.x + tile.w / 2 + wig, tile.y + tile.h / 2);
      ctx.scale(squ, 1 / squ);
      D.roundRect(ctx, -tile.w / 2, -tile.h / 2, tile.w, tile.h, 22);
      ctx.fillStyle = done ? (hot ? '#fecdd3' : '#bbf7d0') : (hot ? '#ffe4e6' : '#fff');
      ctx.fill();
      ctx.lineWidth = expect === tile.i ? 7 : 4;
      ctx.strokeStyle = expect === tile.i ? '#fbbf24' : '#e9d5ff';
      ctx.stroke();
      D.text(ctx, tile.ch, 0, 4, Math.min(72, tile.w * 0.52), hot ? '#be123c' : '#3b2760');
      if (hot) D.heart(ctx, tile.w * 0.28, -tile.h * 0.28, Math.max(10, tile.w * 0.09), '#fb7185');
      ctx.restore();
    });
  }

  function drawWordTrace(ctx, s, les, D) {
    var tr = s.lesson.trace, box = s.box.letterBox;
    if (!tr || !box || !root.NMQTrace) return;
    var lay = root.NMQTrace.layoutWord(les.w, box);
    tr.layout = lay;
    D.roundRect(ctx, box.x - 8, box.y - 8, box.w + 16, box.h + 16, 32);
    ctx.fillStyle = 'rgba(255,253,248,.92)';
    ctx.fill();
    if (lay.cells.length) {
      var lane = lay.cells[0];
      var last = lay.cells[lay.cells.length - 1];
      D.roundRect(ctx, lane.x - 8, lane.cy - lane.h * 0.28, (last.x + last.w) - lane.x + 16, lane.h * 0.56, lane.h * 0.28);
      ctx.fillStyle = 'rgba(251, 207, 232, .55)';
      ctx.fill();
    }
    if (tr.points && tr.points.length) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = tr.done ? '#fbbf24' : 'rgba(244,114,182,.9)';
      ctx.lineWidth = Math.max(28, (lay.cells[0] ? lay.cells[0].w : 80) * 0.34);
      ctx.beginPath();
      tr.points.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
    }
    var pop = tr.pop > 0 ? 1 + Math.min(0.2, tr.pop) * 0.8 : 1;
    lay.cells.forEach(function (cell, i) {
      var hot = (les.tricky || []).indexOf(cell.i) >= 0;
      var on = tr.flags && tr.flags[i];
      ctx.save();
      ctx.translate(cell.cx, cell.cy);
      ctx.scale(pop, pop);
      D.text(ctx, cell.ch, 0, 0, cell.h * 0.62, on ? '#14532d' : (hot ? '#be123c' : 'rgba(59,39,96,.45)'));
      if (hot) D.heart(ctx, cell.w * 0.32, -cell.h * 0.32, Math.max(12, cell.w * 0.1), '#fb7185');
      ctx.restore();
      if (i < lay.cells.length - 1) {
        var between = les.w.slice(cell.i + 1, lay.cells[i + 1].i);
        if (between) D.text(ctx, between, (cell.cx + lay.cells[i + 1].cx) / 2, cell.cy, cell.h * 0.4, '#3b2760');
      }
    });
  }

  function drawSpell(ctx, s, les, D) {
    var L = s.lesson, sp = L.spell;
    if (!sp) return;
    var show = sp.reveal > 0;
    if (s.box.slots) {
      s.box.slots.forEach(function (slot, i) {
        if (!show) return;
        var hot = (les.tricky || []).indexOf(i) >= 0;
        D.text(ctx, les.w.charAt(i), slot.x + slot.w / 2, slot.y - slot.h * 0.7, slot.h * 0.55, hot ? '#be123c' : '#3b2760');
        if (hot) D.heart(ctx, slot.x + slot.w - 8, slot.y - slot.h * 0.95, 10, '#fb7185');
      });
      if (!show && s.box.slots[0]) {
        ctx.globalAlpha = sp.leaf;
        var leafY = s.box.slots[0].y - s.box.slots[0].h * 0.7;
        D.ellipse(ctx, s.W / 2, leafY, Math.min(s.W * 0.42, 300), 40);
        ctx.fillStyle = '#4ade80';
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      var built = les.built || '';
      s.box.slots.forEach(function (slot, i) {
        D.roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 18);
        ctx.fillStyle = '#f5f3ff';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ddd6fe';
        ctx.stroke();
        if (built.charAt(i)) D.text(ctx, built.charAt(i), slot.x + slot.w / 2, slot.y + slot.h / 2, slot.h * 0.52, '#3b2760');
      });
    }
    (s.box.tiles || []).forEach(function (tile) {
      if (sp.used[tile.i]) return;
      if (L.dragTile && L.dragTile.i === tile.i) return;
      D.panel(ctx, tile.x, tile.y, tile.w, tile.h, { fill: '#fff', r: 18, lip: 6, edge: '#86efac' });
      D.text(ctx, tile.ch, tile.x + tile.w / 2, tile.y + tile.h / 2, tile.h * 0.48, '#3b2760');
    });
    if (L.dragTile) {
      D.panel(ctx, L.dragTile.x - 36, L.dragTile.y - 36, 72, 72, { fill: '#fff', r: 18, lip: 5, edge: '#4ade80' });
      D.text(ctx, L.dragTile.ch, L.dragTile.x, L.dragTile.y, 32, '#14532d');
    }
  }

  function paintCeremony(ctx, s, D) {
    var v = s.api.view();
    ensureCeremony(s, v);
    var c = s.ceremony;
    var award = v.award || (c && c.memory) || null;
    var phase = v.award ? v.award.phase : (c && c.watered ? 'done' : 'done');
    if (v.lastPlay) {
      drawStars(ctx, s, { x: s.box.pad, y: s.box.pad }, !!v.lastPlay.letters, !!v.lastPlay.trace, !!v.lastPlay.first);
      if (v.lastPlay.clean) D.label(ctx, 'Clean grab!', s.W / 2, s.box.pad + 18, 22, '#b45309', '#fff');
    }
    if (!v.award && !(c && c.watered)) {
      D.label(ctx, 'All planted', s.W / 2, s.H / 2 - 20, 40, '#3b2760', '#fff');
      pushBtn(s, { id: 'hub', x: s.W / 2 - 120, y: s.H / 2 + 24, w: 240, h: 74, label: 'Garden', fill: '#fde68a', edge: '#b45309', color: '#3b2600' });
      return;
    }
    if (phase === 'wheel') D.label(ctx, 'Flick the wheel', s.W / 2, s.H - s.box.pad - 24, 28, '#3b2760', '#fff');
    if (phase === 'packet' && c && c.open < 1) D.label(ctx, 'Tap the packet', s.W / 2, s.box.pad + 64, 28, '#3b2760', '#fff');
    if (phase === 'packet' && c && c.open >= 1) D.label(ctx, 'Drag the seed into the pot', s.W / 2, s.box.pad + 64, 26, '#3b2760', '#fff');
    if (phase === 'water' && c && !c.pouring && c.pour <= 0) D.label(ctx, 'Pour on the pot', s.W / 2, s.box.pad + 64, 28, '#3b2760', '#fff');
    if (c && c.watered) {
      var next = c.next === 'garden' ? 'See the garden' : 'To the nursery';
      s.box.done.label = next;
      pushBtn(s, s.box.done);
      var tag = (award && award.rarity ? award.rarity + ' ' : '') + pretty(award && award.flower);
      D.label(ctx, tag, s.W / 2, s.box.done.y - 28, 24, '#3b2760', '#fff');
    }
  }
  function pretty(name) { return String(name || 'flower').replace(/-/g, ' '); }

  var flowerPics = {};
  function flowerPic(id) {
    var Flowers = root.GardenFlowers;
    var key = String(id || 'daisy');
    if (Flowers && Flowers.NAMES && !Flowers.NAMES[key]) key = 'daisy';
    if (!flowerPics[key]) {
      var img = new root.Image();
      img.alt = '';
      img.src = Flowers ? Flowers.src(key) : ('media/flowers/' + key + '.svg');
      flowerPics[key] = img;
    }
    return flowerPics[key];
  }
  function paintFlowerPic(ctx, id, x, y, w, h) {
    var img = flowerPic(id);
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, x, y, w, h);
      return true;
    }
    return false;
  }

  function paintNursery(ctx, s, D) {
    var v = s.api.view(), box = s.box;
    D.label(ctx, 'Nursery', s.W / 2, 40, 32, '#166534', '#fff');
    if (!(v.nursery || []).length) D.label(ctx, 'Grab a capsule in the claw', s.W / 2, box.shelf.y + 80, 24, '#166534', '#fff');
    (box.pots || []).forEach(function (p) {
      if (p.item.flower) {
        var ih = p.h * 0.7;
        paintFlowerPic(ctx, p.item.flower, p.x + p.w * 0.12, p.y - 10, p.w * 0.76, ih);
      }
      D.label(ctx, p.item.w, p.x + p.w / 2, p.y + p.h - 6, 26, '#14532d', '#fff');
      D.text(ctx, p.item.stage, p.x + p.w / 2, p.y + p.h + 16, 16, '#166534');
    });
  }

  function paintGarden(ctx, s, D) {
    var v = s.api.view(), box = s.box;
    D.label(ctx, 'My garden', box.bed.x + 80, box.pad + 28, 28, '#166534', '#fff');
    if (!(v.garden || []).length) D.label(ctx, 'Master a word to plant it', box.bed.x + box.bed.w / 2, box.bed.y + 48, 22, '#166534', '#fff');
    (box.flowers || []).forEach(function (f) {
      var drew = paintFlowerPic(ctx, f.item.flower || 'daisy', f.x + 8, f.y - 16, f.w - 16, f.h);
      if (!drew) D.flower(ctx, f.x + f.w / 2, f.y + f.h * 0.72, f.item.flower || 'daisy', { growth: 0.55, scale: 0.85 });
      if (f.item.thirsty) D.label(ctx, 'thirsty', f.x + f.w / 2, f.y + 8, 16, '#0369a1', '#fff');
      D.label(ctx, f.item.w, f.x + f.w / 2, f.y + f.h + 4, 18, '#14532d', '#fff');
    });
    D.panel(ctx, box.shopPanel.x, box.shopPanel.y, box.shopPanel.w, box.shopPanel.h, { fill: '#fff7ed', edge: '#d97706', r: 22, lip: 8 });
    D.text(ctx, 'Stall  ' + v.coins, box.shopPanel.x + box.shopPanel.w / 2, box.shopPanel.y + 22, 20, '#9a3412');
    (box.shop || []).forEach(function (b) {
      var it = b.item;
      pushBtn(s, {
        id: b.id, x: b.x, y: b.y, w: b.w, h: b.h,
        label: it.owned ? it.name : it.name + '  ' + it.cost,
        fill: it.owned ? '#e5e7eb' : '#bbf7d0', edge: '#166534', color: '#14532d', size: 16
      });
    });
    if (box.spinBtn) pushBtn(s, box.spinBtn);
  }

  function paintSpin(ctx, s, D) {
    var sp = s.spin;
    ctx.fillStyle = 'rgba(30,27,75,.4)';
    ctx.fillRect(0, 0, s.W, s.H);
    var cx = s.W / 2, cy = s.H / 2 - 10, r = Math.min(s.W, s.H) * 0.28;
    var cols = ['#fde68a', '#86efac', '#c4b5fd'];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sp.angle * Math.PI / 180);
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, -Math.PI / 2 + i * Math.PI * 2 / 3, -Math.PI / 2 + (i + 1) * Math.PI * 2 / 3);
      ctx.closePath();
      ctx.fillStyle = cols[i];
      ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - r - 8);
    ctx.lineTo(cx + 14, cy - r - 8);
    ctx.lineTo(cx, cy - r + 22);
    ctx.fillStyle = '#fff';
    ctx.fill();
    D.label(ctx, 'Daily spin', cx, cy - r - 36, 28, '#fff', '#3b2760');
    if (sp.done) D.label(ctx, sp.label, cx, cy + r + 28, 26, '#3b2760', '#fff');
    pushBtn(s, { id: 'spin-go', x: cx - 100, y: cy + r + 48, w: 200, h: 68, label: sp.done ? 'Yay' : 'Spin', fill: '#fbbf24', edge: '#b45309', color: '#3b2600' });
    pushBtn(s, { id: 'spin-close', x: s.W - 130, y: 16, w: 108, h: 56, label: 'Close', fill: '#fff', edge: '#9ca3af', color: '#374151', size: 20 });
  }

  function mirror(s) {
    var v = s.api.view();
    var text = 'Word garden';
    if (s.scene === 'claw') text = s.claw && s.claw.hint ? s.claw.hint : 'Claw';
    if (s.scene === 'lesson' && v.lesson) text = v.lesson.step === 2 ? 'Trace ' + v.lesson.w : v.lesson.w;
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
