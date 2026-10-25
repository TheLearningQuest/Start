/* NMQDraw — chunky Canvas 2D helpers for the word garden.
   No network, no assets. Loaded as a same-origin script. */
(function (root) {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function panel(ctx, x, y, w, h, opt) {
    opt = opt || {};
    var r = opt.r == null ? 28 : opt.r;
    var lip = opt.lip == null ? 10 : opt.lip;
    ctx.save();
    roundRect(ctx, x, y + lip, w, h, r);
    ctx.fillStyle = opt.edge || 'rgba(30,27,75,.22)';
    ctx.fill();
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = opt.fill || '#fff';
    ctx.fill();
    if (opt.gloss !== false) {
      ctx.save();
      roundRect(ctx, x + 8, y + 8, w - 16, Math.max(12, h * 0.28), Math.max(8, r * 0.6));
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  }

  function font(size, weight) {
    return (weight || 800) + ' ' + Math.round(size) + 'px ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
  }

  function text(ctx, str, x, y, size, color, align) {
    ctx.fillStyle = color || '#3b2760';
    ctx.font = font(size);
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function label(ctx, str, x, y, size, fill, stroke) {
    ctx.font = font(size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.16);
    ctx.strokeStyle = stroke || '#fffdf8';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = fill || '#3b2760';
    ctx.fillText(str, x, y);
  }

  function face(ctx, x, y, r, mood) {
    mood = mood || 'happy';
    var eye = Math.max(2.2, r * 0.16);
    ctx.save();
    ctx.fillStyle = 'rgba(255,150,170,.55)';
    ellipse(ctx, x - r * 0.42, y + r * 0.12, r * 0.22, r * 0.12);
    ctx.fill();
    ellipse(ctx, x + r * 0.42, y + r * 0.12, r * 0.22, r * 0.12);
    ctx.fill();
    ctx.fillStyle = '#3b2760';
    if (mood === 'sleepy') {
      ctx.lineWidth = Math.max(2, r * 0.1);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#3b2760';
      ctx.beginPath();
      ctx.arc(x - r * 0.32, y - r * 0.05, eye * 1.3, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + r * 0.32, y - r * 0.05, eye * 1.3, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (mood === 'wow') {
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.08, eye * 1.35, 0, Math.PI * 2);
      ctx.arc(x + r * 0.3, y - r * 0.08, eye * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - r * 0.24, y - r * 0.16, eye * 0.45, 0, Math.PI * 2);
      ctx.arc(x + r * 0.36, y - r * 0.16, eye * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x - r * 0.28, y - r * 0.08, eye, 0, Math.PI * 2);
      ctx.arc(x + r * 0.28, y - r * 0.08, eye, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - r * 0.22, y - r * 0.14, eye * 0.38, 0, Math.PI * 2);
      ctx.arc(x + r * 0.34, y - r * 0.14, eye * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#3b2760';
    ctx.lineWidth = Math.max(2, r * 0.09);
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'oops') {
      ctx.arc(x, y + r * 0.42, r * 0.22, Math.PI * 1.15, Math.PI * 1.85);
    } else if (mood === 'wow') {
      ctx.arc(x, y + r * 0.28, r * 0.16, 0, Math.PI * 2);
    } else {
      ctx.arc(x, y + r * 0.08, r * 0.34, 0.15 * Math.PI, 0.85 * Math.PI);
    }
    ctx.stroke();
    ctx.restore();
  }

  function heart(ctx, x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, 0.35);
    ctx.bezierCurveTo(-0.05, -0.15, -1.05, -0.15, -1.05, 0.35);
    ctx.bezierCurveTo(-1.05, 0.85, -0.15, 1.15, 0, 1.55);
    ctx.bezierCurveTo(0.15, 1.15, 1.05, 0.85, 1.05, 0.35);
    ctx.bezierCurveTo(1.05, -0.15, 0.05, -0.15, 0, 0.35);
    ctx.fillStyle = color || '#fb7185';
    ctx.fill();
    ctx.restore();
  }

  function star(ctx, x, y, r, color, filled) {
    ctx.save();
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      var b = a + Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(b) * r * 0.46, y + Math.sin(b) * r * 0.46);
    }
    ctx.closePath();
    if (filled === false) {
      ctx.strokeStyle = color || '#fbbf24';
      ctx.lineWidth = Math.max(3, r * 0.16);
      ctx.stroke();
    } else {
      ctx.fillStyle = color || '#fbbf24';
      ctx.fill();
    }
    ctx.restore();
  }

  function button(ctx, b, pressed) {
    var lip = b.lip == null ? 8 : b.lip;
    var y = b.y + (pressed ? lip : 0);
    var r = b.r || Math.min(26, b.h * 0.35);
    if (!pressed) {
      roundRect(ctx, b.x, b.y + lip, b.w, b.h, r);
      ctx.fillStyle = b.edge || '#b45309';
      ctx.fill();
    }
    roundRect(ctx, b.x, y, b.w, b.h, r);
    ctx.fillStyle = b.fill || '#ffd15c';
    ctx.fill();
    ctx.save();
    roundRect(ctx, b.x + 8, y + 6, b.w - 16, Math.max(8, b.h * 0.32), r * 0.5);
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.fill();
    ctx.restore();
    text(ctx, b.label, b.x + b.w / 2, y + b.h / 2 + 1, b.size || Math.min(32, b.h * 0.38), b.color || '#3b2600');
  }

  function capsule(ctx, x, y, r, opt) {
    opt = opt || {};
    var pal = opt.color || ['#fb7185', '#60a5fa', '#fbbf24', '#a78bfa', '#34d399'][opt.i % 5 || 0];
    ctx.save();
    ctx.translate(x, y);
    var sx = opt.sx || 1, sy = opt.sy || 1;
    ctx.scale(sx, sy);
    ctx.beginPath();
    ctx.arc(0, 6, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30,27,75,.15)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.35, pal);
    g.addColorStop(1, pal);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = Math.max(3, r * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.92, r * 0.22, 0, 0, Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (opt.shiny) {
      ctx.strokeStyle = '#fff7ad';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    face(ctx, 0, r * 0.02, r * 0.72, opt.mood || (opt.i % 4 === 2 ? 'sleepy' : 'happy'));
    ctx.restore();
  }

  function clawGrip(ctx, x, y, open, scale) {
    scale = scale || 1;
    var spread = lerp(0.15, 0.85, clamp(open, 0, 1));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    roundRect(ctx, -16, -18, 32, 22, 8);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 3;
    ctx.stroke();
    function prong(side) {
      ctx.save();
      ctx.rotate(side * spread);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * 26, 18, side * 18, 42);
      ctx.quadraticCurveTo(side * 8, 36, side * 4, 8);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    prong(-1);
    prong(1);
    ctx.restore();
  }

  function bloom(ctx, name) {
    name = name || 'daisy';
    function petals(n, rx, ry, col, rad) {
      for (var i = 0; i < n; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * i) / n);
        ellipse(ctx, 0, -rad, rx, ry);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.restore();
      }
    }
    if (name === 'tulip') {
      ctx.fillStyle = '#fb7185';
      ellipse(ctx, 0, -6, 16, 22);
      ctx.fill();
      ellipse(ctx, -12, -2, 10, 16);
      ctx.fill();
      ellipse(ctx, 12, -2, 10, 16);
      ctx.fill();
    } else if (name === 'poppy') {
      petals(4, 14, 18, '#ef4444', 12);
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#1e1b4b';
      ctx.fill();
    } else if (name === 'bluebell') {
      for (var b = -1; b <= 1; b++) {
        ctx.save();
        ctx.translate(b * 14, 16);
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.moveTo(-8, -10);
        ctx.quadraticCurveTo(-10, 12, 0, 16);
        ctx.quadraticCurveTo(10, 12, 8, -10);
        ctx.fill();
        ctx.restore();
      }
    } else if (name === 'orchid') {
      ellipse(ctx, -16, -4, 12, 8);
      ctx.fillStyle = '#e879f9';
      ctx.fill();
      ellipse(ctx, 16, -4, 12, 8);
      ctx.fill();
      ellipse(ctx, 0, 10, 8, 14);
      ctx.fillStyle = '#f0abfc';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -6, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fde68a';
      ctx.fill();
    } else if (name === 'lantern') {
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251,191,36,.35)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
    } else if (name === 'rainbow-rose') {
      var cols = ['#fb7185', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc'];
      for (var k = 0; k < 5; k++) petals(6, 8, 14 - k, cols[k], 16 - k * 2);
    } else if (name === 'crystal-lotus') {
      ctx.fillStyle = '#22d3ee';
      for (var p = 0; p < 6; p++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * p) / 6);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-8, -22);
        ctx.lineTo(0, -30);
        ctx.lineTo(8, -22);
        ctx.fill();
        ctx.restore();
      }
    } else {
      petals(8, 8, 16, '#fffdf8', 14);
    }
    if (name !== 'poppy' && name !== 'bluebell') {
      ctx.beginPath();
      ctx.arc(0, 0, name === 'crystal-lotus' ? 6 : 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fde68a';
      ctx.fill();
      face(ctx, 0, 0, 7, 'happy');
    }
  }

  function flower(ctx, x, y, name, opt) {
    opt = opt || {};
    var growth = opt.growth == null ? 1 : clamp(opt.growth, 0, 1);
    var level = opt.level || 1;
    var sc = (opt.scale || 1) * (0.82 + Math.min(6, level) * 0.05);
    ctx.save();
    ctx.translate(x, y);
    if (opt.thirsty) ctx.rotate(0.45 * (1 - growth * 0 + (opt.perk == null ? 1 : (1 - opt.perk))));
    if (opt.droop) ctx.rotate(opt.droop);
    ctx.scale(sc, sc);
    var stem = 78 * Math.max(0.15, growth);
    roundRect(ctx, -5, -stem, 10, stem, 5);
    ctx.fillStyle = '#16a34a';
    ctx.fill();
    if (growth > 0.35) {
      ellipse(ctx, -18, -stem * 0.45, 14, 8);
      ctx.fillStyle = '#4ade80';
      ctx.fill();
      ellipse(ctx, 18, -stem * 0.55, 14, 8);
      ctx.fill();
    }
    if (growth > 0.2) {
      ctx.save();
      ctx.translate(0, -stem);
      ctx.scale(growth, growth);
      bloom(ctx, name);
      ctx.restore();
    }
    if (opt.shiny) {
      star(ctx, 24, -stem - 8, 8, '#fff7ad', true);
    }
    ctx.restore();
  }

  function pot(ctx, x, y, s, opt) {
    opt = opt || {};
    s = s || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (opt.glow) {
      ctx.beginPath();
      ctx.arc(0, 10, 78, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250,204,21,.35)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-52, -10);
    ctx.lineTo(-40, 58);
    ctx.quadraticCurveTo(0, 74, 40, 58);
    ctx.lineTo(52, -10);
    ctx.closePath();
    ctx.fillStyle = '#fb923c';
    ctx.fill();
    ctx.strokeStyle = '#c2410c';
    ctx.lineWidth = 4;
    ctx.stroke();
    roundRect(ctx, -58, -24, 116, 22, 10);
    ctx.fillStyle = '#fdba74';
    ctx.fill();
    ellipse(ctx, 0, -6, 40, 12);
    ctx.fillStyle = '#92400e';
    ctx.fill();
    if (opt.mound) {
      ellipse(ctx, 0, -12, 16, 10);
      ctx.fillStyle = '#166534';
      ctx.fill();
    }
    face(ctx, 0, 28, 18, opt.mood || 'happy');
    ctx.restore();
  }

  function seed(ctx, x, y, s, opt) {
    opt = opt || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(opt.rot || 0);
    ctx.scale((opt.sx || 1) * s, (opt.sy || 1) * s);
    ctx.beginPath();
    ctx.ellipse(0, 8, 28, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30,27,75,.12)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 38, 0, 0, Math.PI * 2);
    var g = ctx.createRadialGradient(-10, -16, 4, 0, 0, 40);
    g.addColorStop(0, '#fef9c3');
    g.addColorStop(0.55, '#4ade80');
    g.addColorStop(1, '#166534');
    ctx.fillStyle = g;
    ctx.fill();
    face(ctx, 0, 4, 18, opt.mood || 'happy');
    ctx.restore();
  }

  function packet(ctx, x, y, w, h, opt) {
    opt = opt || {};
    var stripe = { common: '#4ade80', rare: '#60a5fa', epic: '#c084fc', mythic: '#fbbf24' }[opt.rarity] || '#4ade80';
    panel(ctx, x, y, w, h, { fill: '#fffdf8', edge: stripe, r: 26, lip: 12 });
    ctx.save();
    roundRect(ctx, x, y, w, 22, 12);
    ctx.fillStyle = stripe;
    ctx.fill();
    ctx.restore();
    if (opt.open > 0.2) {
      ctx.save();
      ctx.translate(x + w / 2, y + 8);
      ctx.rotate(-0.2);
      roundRect(ctx, -w * 0.36, -18, w * 0.42, 28, 8);
      ctx.fillStyle = stripe;
      ctx.fill();
      ctx.restore();
    }
    flower(ctx, x + w / 2, y + h * 0.62, opt.flower || 'daisy', { growth: 0.85, scale: Math.min(w, h) / 160 });
  }

  function can(ctx, x, y, s, tilt, opt) {
    opt = opt || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    ctx.scale(s || 1, s || 1);
    roundRect(ctx, -46, -28, 92, 62, 22);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.strokeStyle = '#0369a1';
    ctx.lineWidth = 5;
    ctx.stroke();
    roundRect(ctx, -30, -42, 60, 20, 10);
    ctx.fillStyle = '#0ea5e9';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(46, -4);
    ctx.lineTo(78, -16);
    ctx.lineTo(84, -4);
    ctx.lineTo(46, 12);
    ctx.fillStyle = '#7dd3fc';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(78, 18, 16, -0.4, Math.PI * 0.7);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 8;
    ctx.stroke();
    face(ctx, -4, 2, 18, opt.mood || 'happy');
    ctx.restore();
  }

  function pip(ctx, x, y, s, mood, hop) {
    s = s || 1;
    ctx.save();
    ctx.translate(x, y - (hop || 0));
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(30,27,75,.12)';
    ellipse(ctx, 0, 46, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#4ade80';
    ellipse(ctx, -26, 8, 20, 12);
    ctx.fill();
    ellipse(ctx, 26, 4, 20, 12);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 10, 32, 36, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#86efac';
    ctx.fill();
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 4;
    ctx.stroke();
    roundRect(ctx, -6, -34, 12, 22, 6);
    ctx.fillStyle = '#16a34a';
    ctx.fill();
    face(ctx, 0, 12, 20, mood || 'happy');
    ctx.restore();
  }

  function critter(ctx, id, x, y, s) {
    s = s || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (id === 'bunny') {
      ellipse(ctx, -12, -28, 7, 18);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ellipse(ctx, 12, -28, 7, 18);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      face(ctx, 0, 2, 14, 'happy');
    } else if (id === 'kitty') {
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.moveTo(-16, -6);
      ctx.lineTo(-22, -28);
      ctx.lineTo(-4, -10);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(16, -6);
      ctx.lineTo(22, -28);
      ctx.lineTo(4, -10);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 4, 22, 0, Math.PI * 2);
      ctx.fill();
      face(ctx, 0, 6, 14, 'happy');
    } else if (id === 'butterfly') {
      ellipse(ctx, -16, 0, 16, 22);
      ctx.fillStyle = '#c4b5fd';
      ctx.fill();
      ellipse(ctx, 16, 0, 16, 22);
      ctx.fillStyle = '#f9a8d4';
      ctx.fill();
      roundRect(ctx, -4, -16, 8, 36, 4);
      ctx.fillStyle = '#7c3aed';
      ctx.fill();
      face(ctx, 0, -2, 8, 'happy');
    } else if (id === 'fence') {
      ctx.fillStyle = '#d97706';
      roundRect(ctx, -28, -20, 10, 44, 3);
      ctx.fill();
      roundRect(ctx, -6, -28, 10, 52, 3);
      ctx.fill();
      roundRect(ctx, 16, -20, 10, 44, 3);
      ctx.fill();
      roundRect(ctx, -32, -6, 62, 8, 3);
      ctx.fill();
    } else if (id === 'hat') {
      ellipse(ctx, 0, 10, 34, 10);
      ctx.fillStyle = '#f472b6';
      ctx.fill();
      roundRect(ctx, -18, -22, 36, 28, 14);
      ctx.fillStyle = '#ec4899';
      ctx.fill();
    } else if (id === 'can') {
      can(ctx, 0, 0, 0.55, -0.2, {});
    } else {
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(0, 4, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(28, 6);
      ctx.lineTo(12, 12);
      ctx.fillStyle = '#f97316';
      ctx.fill();
      face(ctx, -2, 4, 12, 'happy');
    }
    ctx.restore();
  }

  function cloud(ctx, x, y, s) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ellipse(ctx, x, y, 28 * s, 16 * s);
    ctx.fill();
    ellipse(ctx, x + 22 * s, y + 4 * s, 20 * s, 14 * s);
    ctx.fill();
    ellipse(ctx, x - 20 * s, y + 6 * s, 18 * s, 12 * s);
    ctx.fill();
    ctx.restore();
  }

  function sun(ctx, x, y, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fde047';
    ctx.fill();
    face(ctx, x, y, r * 0.7, 'happy');
    ctx.restore();
  }

  function burst(list, x, y, colors, n, reduced) {
    n = reduced ? Math.min(n, 6) : n;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 90 + Math.random() * 260;
      list.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        life: 0.45 + Math.random() * 0.45, age: 0,
        color: colors[i % colors.length], r: 4 + Math.random() * 7, g: 520
      });
    }
  }

  function stepParts(list, dt) {
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      p.age += dt;
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.age >= p.life) list.splice(i, 1);
    }
  }

  function drawParts(ctx, list) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var k = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.6 + k), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function bubble(ctx, x, y, textStr, maxW) {
    ctx.font = font(22);
    var w = Math.min(maxW || 280, Math.max(80, ctx.measureText(textStr).width + 36));
    var h = 48;
    panel(ctx, x - w / 2, y - h, w, h, { fill: '#fff', r: 18, lip: 0, gloss: false });
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x, y + 12);
    ctx.fillStyle = '#fff';
    ctx.fill();
    text(ctx, textStr, x, y - h / 2, 20, '#3b2760');
  }

  var api = {
    clamp: clamp, lerp: lerp, roundRect: roundRect, panel: panel, ellipse: ellipse,
    text: text, label: label, font: font, face: face, heart: heart, star: star, button: button,
    capsule: capsule, clawGrip: clawGrip, flower: flower, pot: pot, seed: seed, packet: packet,
    can: can, pip: pip, critter: critter, cloud: cloud, sun: sun,
    burst: burst, stepParts: stepParts, drawParts: drawParts, bubble: bubble
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NMQDraw = api;
})(typeof window !== 'undefined' ? window : globalThis);
