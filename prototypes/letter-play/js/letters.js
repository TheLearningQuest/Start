/* Rounded print skeletons in a 100×140 box. y grows downward.

   Each letter is a set of ribbons, not a recipe. A child may paint
   them in any order, backwards, or in pieces. Nothing here is a
   required stroke. Dots are a single point. */
(function (root) {
  'use strict';

  var ASC = 30;
  var XT = 56;
  var BASE = 104;
  var DESC = 126;

  function rnum(n) { return Math.round(n * 10) / 10; }

  function arc(cx, cy, rad, a0, a1, n) {
    var pts = [];
    var i;
    var a;
    n = n || 16;
    for (i = 0; i <= n; i++) {
      a = a0 + (a1 - a0) * (i / n);
      pts.push([rnum(cx + Math.cos(a) * rad), rnum(cy + Math.sin(a) * rad)]);
    }
    return pts;
  }

  function line(x0, y0, x1, y1, n) {
    var pts = [];
    var i;
    var t;
    n = n || 6;
    for (i = 0; i <= n; i++) {
      t = i / n;
      pts.push([rnum(x0 + (x1 - x0) * t), rnum(y0 + (y1 - y0) * t)]);
    }
    return pts;
  }

  function join(parts) {
    var out = [];
    var i;
    var j;
    var p;
    var last;
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      for (j = 0; j < p.length; j++) {
        if (out.length && j === 0) {
          last = out[out.length - 1];
          if (Math.abs(last[0] - p[j][0]) < 0.8 && Math.abs(last[1] - p[j][1]) < 0.8) continue;
        }
        out.push(p[j]);
      }
    }
    return out;
  }

  function circle(cx, cy, rad) {
    return arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2, 24);
  }

  /* Print c: opening on the right, terminals toward 1 o'clock and 5 o'clock. */
  function openC(cx, cy, rad) {
    var a0 = -0.9;
    return arc(cx, cy, rad, a0, a0 - (Math.PI * 2 - 1.8), 18);
  }

  /* Arch that starts on the left and ends on the right, over the top. */
  function hump(cx, cy, rad) {
    return arc(cx, cy, rad, Math.PI, Math.PI * 2, 12);
  }

  /* Cup that starts on the left, dips under, and ends on the right. */
  function cup(cx, cy, rad) {
    return arc(cx, cy, rad, Math.PI, 0, 12);
  }

  function smooth(points, n) {
    var pts = [points[0]].concat(points, [points[points.length - 1]]);
    var out = [];
    var i;
    var j;
    var t;
    var t2;
    var t3;
    var p0;
    var p1;
    var p2;
    var p3;
    var x;
    var y;
    n = n || 8;
    for (i = 1; i < pts.length - 2; i++) {
      p0 = pts[i - 1];
      p1 = pts[i];
      p2 = pts[i + 1];
      p3 = pts[i + 2];
      for (j = 0; j < n; j++) {
        t = j / n;
        t2 = t * t;
        t3 = t2 * t;
        x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        out.push([rnum(x), rnum(y)]);
      }
    }
    out.push(points[points.length - 1]);
    return out;
  }

  var F = {};

  F.a = [
    circle(40, 86, 18),
    line(55, 58, 55, BASE, 7)
  ];
  F.b = [
    line(34, ASC, 34, BASE, 10),
    circle(54, 84, 20)
  ];
  F.c = [openC(50, 82, 26)];
  F.d = [
    circle(40, 84, 20),
    line(60, ASC, 60, BASE, 10)
  ];
  F.e = [
    openC(50, 82, 26),
    line(26, 82, 54, 82, 5)
  ];
  F.f = [
    join([
      arc(46, 44, 16, 0.25, -Math.PI, 10),
      line(30, 44, 30, BASE, 8)
    ]),
    line(16, 68, 52, 68, 4)
  ];
  F.g = [
    circle(42, 78, 18),
    join([
      line(60, 78, 60, 116, 6),
      arc(46, 116, 14, 0, Math.PI * 0.85, 6)
    ])
  ];
  F.h = [
    line(34, ASC, 34, BASE, 10),
    join([
      hump(52, 84, 18),
      line(70, 84, 70, BASE, 4)
    ])
  ];
  F.i = [
    line(50, 70, 50, BASE, 6),
    [[50, 48]]
  ];
  F.j = [
    join([
      line(56, 70, 56, 116, 8),
      arc(42, 116, 14, 0, Math.PI * 0.9, 6)
    ]),
    [[56, 48]]
  ];
  F.k = [
    line(36, ASC, 36, BASE, 10),
    join([
      line(64, 62, 38, 84, 4),
      line(38, 84, 68, BASE, 4)
    ])
  ];
  F.l = [line(50, 26, 50, BASE, 10)];
  F.m = [
    line(22, 64, 22, BASE, 6),
    join([
      hump(38, 86, 16),
      line(54, 86, 54, BASE, 4)
    ]),
    join([
      hump(70, 86, 16),
      line(86, 86, 86, BASE, 4)
    ])
  ];
  F.n = [
    line(34, 64, 34, BASE, 6),
    join([
      hump(54, 84, 20),
      line(74, 84, 74, BASE, 4)
    ])
  ];
  F.o = [circle(50, 82, 26)];
  F.p = [
    line(36, 62, 36, DESC, 10),
    circle(56, 82, 20)
  ];
  F.q = [
    circle(44, 82, 20),
    join([
      line(64, 62, 64, DESC, 8),
      line(64, DESC, 76, DESC + 6, 2)
    ])
  ];
  F.r = [
    line(38, 62, 38, BASE, 6),
    arc(54, 80, 16, Math.PI, Math.PI * 2 - 0.85, 8)
  ];
  F.s = [smooth([
    [70, 68], [62, 54], [44, 52], [32, 64], [30, 78],
    [40, 88], [56, 92], [68, 102], [64, 114], [48, 118], [34, 110]
  ], 7)];
  F.t = [
    line(50, 34, 50, BASE + 4, 10),
    line(36, 52, 64, 52, 4)
  ];
  F.u = [join([
    line(32, 60, 32, 90, 5),
    cup(50, 90, 18),
    line(68, 90, 68, 60, 5)
  ])];
  F.v = [join([
    line(28, 58, 50, BASE + 2, 6),
    line(50, BASE + 2, 74, 58, 6)
  ])];
  F.w = [join([
    line(16, 58, 32, BASE + 2, 5),
    line(32, BASE + 2, 50, 72, 5),
    line(50, 72, 68, BASE + 2, 5),
    line(68, BASE + 2, 86, 58, 5)
  ])];
  F.x = [
    line(30, 58, 72, BASE, 6),
    line(72, 58, 30, BASE, 6)
  ];
  F.y = [
    line(30, 56, 52, 92, 5),
    line(74, 56, 40, DESC, 8)
  ];
  F.z = [join([
    line(28, 60, 74, 60, 5),
    line(74, 60, 30, BASE, 6),
    line(30, BASE, 76, BASE, 5)
  ])];

  var FALLBACK = [line(50, 36, 50, BASE, 8)];

  function get(ch) {
    var key = String(ch || '');
    if (key === 'I') return F.l;
    key = key.toLowerCase();
    return F[key] || FALLBACK;
  }

  var api = { get: get, forms: F, box: { w: 100, h: 140 } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LetterForms = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
