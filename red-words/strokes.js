/* NMQStrokes — heart-word paths in a 100×140 box.
   Formations follow Handwriting Without Tears: magic c, divers, dots.
   The finger game traces these polylines. No assets. */
(function (root) {
  'use strict';

  function rnum(n) { return Math.round(n * 10) / 10; }

  function arc(cx, cy, rad, a0, a1, n) {
    var pts = [], i, a;
    n = n || 18;
    for (i = 0; i <= n; i++) {
      a = a0 + (a1 - a0) * (i / n);
      pts.push([rnum(cx + Math.cos(a) * rad), rnum(cy + Math.sin(a) * rad)]);
    }
    return pts;
  }

  function line(x0, y0, x1, y1, n) {
    var pts = [], i, t;
    n = n || 8;
    for (i = 0; i <= n; i++) {
      t = i / n;
      pts.push([rnum(x0 + (x1 - x0) * t), rnum(y0 + (y1 - y0) * t)]);
    }
    return pts;
  }

  function join(parts) {
    var out = [], i, j, p;
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      for (j = 0; j < p.length; j++) {
        if (out.length && j === 0) {
          var last = out[out.length - 1];
          if (Math.abs(last[0] - p[j][0]) < 0.6 && Math.abs(last[1] - p[j][1]) < 0.6) continue;
        }
        out.push(p[j]);
      }
    }
    return out;
  }

  /* 2 o'clock is -30°; magic c travels the long way to 4 o'clock (counterclockwise on a clock). */
  function magicC(cx, cy, rad) {
    var a0 = -Math.PI / 6;
    return arc(cx, cy, rad, a0, a0 - (300 * Math.PI / 180), 22);
  }

  function magicO(cx, cy, rad) {
    var a0 = -Math.PI / 6;
    return arc(cx, cy, rad, a0, a0 - Math.PI * 2, 26);
  }

  /* Canvas y grows downward, so a hump runs from 9 o'clock through 12 to 3. */
  function hump(cx, cy, rad) {
    return arc(cx, cy, rad, Math.PI, Math.PI * 2, 12);
  }

  function stroke(cue, pts, dot) {
    return { cue: cue, pts: pts, dot: !!dot };
  }

  var BOWL_X = 46, BOWL_Y = 80, BOWL_R = 26;
  var BASE = 112, XTOP = 50, ASC = 16, DESC = 132, RIGHT = 70;

  function magicThenDown(topY, botY, cue) {
    var c = magicC(BOWL_X, BOWL_Y, BOWL_R);
    var end = c[c.length - 1];
    return stroke(cue, join([
      c,
      line(end[0], end[1], RIGHT, topY, 6),
      line(RIGHT, topY, RIGHT, botY, 8)
    ]));
  }

  function dive(startY, endY, humps, tail) {
    var pts = join([
      line(32, startY, 32, endY, 8),
      line(32, endY, 32, XTOP, 8)
    ]);
    var i, hx = 54;
    for (i = 0; i < humps; i++) {
      var h = hump(hx, 80, 20);
      pts = join([pts, h, line(hx + 20, 80, hx + 20, BASE, 6)]);
      if (i < humps - 1) pts = join([pts, line(hx + 20, BASE, hx + 20, XTOP, 6)]);
      hx += 28;
    }
    if (tail) pts = join([pts, tail]);
    return pts;
  }

  var S = {};

  S.a = [magicThenDown(XTOP, BASE, 'Magic c, up, down')];
  S.b = [stroke('Dive down, up, over', (function () {
    var down = join([line(34, ASC, 34, BASE, 8), line(34, BASE, 34, 58, 6)]);
    var bowl = magicC(52, 84, 22);
    return join([down, bowl]);
  })())];
  S.c = [stroke('Magic c', magicC(50, 78, 30))];
  S.d = [magicThenDown(ASC, BASE, 'Magic c, up, down')];
  S.e = [
    stroke('Little line', line(38, 78, 78, 78, 5)),
    stroke('Magic c', magicC(50, 80, 28))
  ];
  S.f = [
    stroke('Tall line', join([
      arc(58, 36, 18, Math.PI, Math.PI * 1.7, 6),
      line(42, 28, 42, BASE, 10)
    ])),
    stroke('Little line', line(24, 62, 64, 62, 5))
  ];
  S.g = [stroke('Magic c, up, down', (function () {
    var base = magicThenDown(XTOP, DESC, '');
    var hook = arc(RIGHT - 8, DESC - 6, 14, 0, Math.PI * 0.8, 6);
    return join([base.pts, hook]);
  })())];
  S.h = [stroke('Dive down, up, over', dive(ASC, BASE, 1))];
  S.i = [
    stroke('Little line', line(50, XTOP, 50, BASE, 8)),
    stroke('Dot', [[50, 26]], true)
  ];
  S.j = [
    stroke('Dive down', join([
      line(58, XTOP, 58, DESC - 8, 10),
      arc(44, DESC - 8, 14, 0, Math.PI * 0.85, 6)
    ])),
    stroke('Dot', [[58, 26]], true)
  ];
  S.k = [
    stroke('Tall line', line(36, ASC, 36, BASE, 10)),
    stroke('Kick', join([
      line(70, 48, 36, 78, 6),
      line(36, 78, 74, BASE, 6)
    ]))
  ];
  S.l = [stroke('Tall line', line(50, ASC, 50, BASE, 10))];
  S.m = [stroke('Dive down, up, over, over', dive(XTOP, BASE, 2))];
  S.n = [stroke('Dive down, up, over', dive(XTOP, BASE, 1))];
  S.o = [stroke('Magic c', magicO(50, 80, 30))];
  S.p = [stroke('Dive down, up, over', (function () {
    var down = join([line(34, XTOP, 34, DESC, 10), line(34, DESC, 34, 64, 8)]);
    return join([down, magicC(54, 82, 22)]);
  })())];
  S.q = [stroke('Magic c, up, down', (function () {
    var base = magicThenDown(XTOP, DESC, '');
    return join([base.pts, line(RIGHT, DESC, RIGHT + 16, DESC + 4, 3)]);
  })())];
  S.r = [stroke('Dive down, up, over', join([
    line(36, XTOP, 36, BASE, 8),
    line(36, BASE, 36, XTOP, 8),
    arc(52, 62, 18, Math.PI * 0.85, Math.PI * 1.7, 8)
  ]))];
  S.s = [stroke('Little curve', join([
    arc(58, 62, 20, Math.PI * 0.15, Math.PI * 1.15, 10),
    arc(42, 98, 20, Math.PI * 1.15, Math.PI * 2.05, 10)
  ]))];
  S.t = [
    stroke('Tall line', line(48, 22, 48, BASE, 10)),
    stroke('Little line', line(26, 58, 72, 58, 5))
  ];
  S.u = [stroke('Down, up, over', join([
    line(30, XTOP, 30, 100, 6),
    arc(50, 100, 20, Math.PI, Math.PI * 2, 10),
    line(70, 100, 70, XTOP, 6)
  ]))];
  S.v = [stroke('Slide down, up', join([
    line(22, XTOP, 50, BASE, 8),
    line(50, BASE, 78, XTOP, 8)
  ]))];
  S.w = [stroke('Down, up, down, up', join([
    line(16, XTOP, 32, BASE, 6),
    line(32, BASE, 50, 70, 6),
    line(50, 70, 68, BASE, 6),
    line(68, BASE, 86, XTOP, 6)
  ]))];
  S.x = [
    stroke('Slide down', line(24, XTOP, 76, BASE, 8)),
    stroke('Slide across', line(76, XTOP, 24, BASE, 8))
  ];
  S.y = [
    stroke('Slide down', line(28, XTOP, 50, 88, 6)),
    stroke('Slide down', join([
      line(74, XTOP, 42, DESC, 8),
      arc(30, DESC - 4, 12, 0.2, Math.PI * 0.9, 5)
    ]))
  ];
  S.z = [
    stroke('Across, slide, across', join([
      line(24, XTOP, 76, XTOP, 6),
      line(76, XTOP, 24, BASE, 8),
      line(24, BASE, 78, BASE, 6)
    ]))
  ];
  S.I = [
    stroke('Big line', line(50, 18, 50, 124, 10)),
    stroke('Little line', line(26, 18, 74, 18, 5)),
    stroke('Little line', line(26, 124, 74, 124, 5))
  ];

  function get(ch) {
    if (!ch) return null;
    if (ch === 'I') return S.I;
    return S[String(ch).toLowerCase()] || null;
  }

  var api = { get: get, all: S, magicC: magicC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NMQStrokes = api;
})(typeof window !== 'undefined' ? window : globalThis);
