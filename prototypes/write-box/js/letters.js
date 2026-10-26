/* Print skeletons for the write-box matcher. A 100×140 box, y grows downward.

   These are not a tracing lesson. They are the shapes the recognizer
   compares against. A child may stroke them in any order. */
(function (root) {
  'use strict';

  var BASE = 108;
  var ASC = 28;
  var XT = 66;

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
    return arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2, 22);
  }

  /* Opening faces right. Terminals sit near 1 o'clock and 5 o'clock. */
  function openC(cx, cy, rad) {
    var a0 = -0.85;
    return arc(cx, cy, rad, a0, a0 - (Math.PI * 2 - 2.05), 18);
  }

  function hump(cx, cy, rad) {
    return arc(cx, cy, rad, Math.PI, Math.PI * 2, 12);
  }

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
    n = n || 6;
    for (i = 1; i < pts.length - 2; i++) {
      p0 = pts[i - 1];
      p1 = pts[i];
      p2 = pts[i + 1];
      p3 = pts[i + 2];
      for (j = 0; j < n; j++) {
        t = j / n;
        t2 = t * t;
        t3 = t2 * t;
        out.push([
          rnum(0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)),
          rnum(0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3))
        ]);
      }
    }
    out.push(points[points.length - 1]);
    return out;
  }

  var F = {};

  /* Single-story a: bowl plus a full stem, so it does not collapse into o. */
  F.a = [
    circle(40, 88, 18),
    line(58, 68, 58, BASE, 8)
  ];
  F.b = [
    line(32, ASC, 32, BASE, 12),
    circle(54, 88, 18)
  ];
  F.c = [openC(50, 88, 24)];
  F.d = [
    circle(40, 88, 18),
    line(60, ASC, 60, BASE, 12)
  ];
  F.e = [
    openC(50, 88, 24),
    line(28, 88, 70, 88, 6)
  ];
  F.f = [
    join([
      arc(46, 46, 16, 0.3, -Math.PI, 10),
      line(30, 46, 30, BASE, 8)
    ]),
    line(14, 70, 52, 70, 5)
  ];
  F.g = [
    circle(42, 84, 18),
    join([
      line(60, 70, 60, 122, 7),
      arc(46, 122, 14, 0, Math.PI * 0.9, 7)
    ])
  ];
  F.h = [
    line(32, ASC, 32, BASE, 12),
    join([
      hump(52, 86, 18),
      line(70, 86, 70, BASE, 5)
    ])
  ];
  F.i = [
    line(50, 74, 50, BASE, 6),
    circle(50, 54, 4.5)
  ];
  F.j = [
    join([
      line(56, 74, 56, 122, 8),
      arc(42, 122, 14, 0, Math.PI * 0.9, 6)
    ]),
    circle(56, 54, 4.5)
  ];
  F.k = [
    line(34, ASC, 34, BASE, 12),
    line(34, 78, 66, 58, 5),
    line(42, 76, 68, BASE, 5)
  ];
  F.l = [line(50, ASC, 50, BASE, 12)];
  F.m = [
    line(18, XT, 18, BASE, 6),
    join([
      hump(36, 88, 16),
      line(52, 88, 52, BASE, 4)
    ]),
    join([
      hump(68, 88, 16),
      line(84, 88, 84, BASE, 4)
    ])
  ];
  F.n = [
    line(32, XT, 32, BASE, 6),
    join([
      hump(52, 86, 20),
      line(72, 86, 72, BASE, 5)
    ])
  ];
  F.o = [circle(50, 88, 24)];
  F.p = [
    line(34, XT, 34, 132, 12),
    circle(54, 86, 18)
  ];
  F.q = [
    circle(44, 86, 18),
    join([
      line(62, XT, 62, 132, 8),
      line(62, 132, 76, 140, 3)
    ])
  ];
  F.r = [
    line(36, XT, 36, BASE, 6),
    arc(52, 82, 16, Math.PI, Math.PI * 1.72, 8)
  ];
  F.s = [smooth([
    [72, 70], [60, 58], [42, 58], [30, 70], [28, 82],
    [40, 92], [58, 98], [70, 110], [62, 122], [44, 122], [32, 112]
  ], 5)];
  F.t = [
    line(50, 40, 50, BASE + 2, 10),
    line(30, 68, 72, 68, 5)
  ];
  F.u = [join([
    line(30, XT, 30, 92, 5),
    cup(50, 92, 20),
    line(70, 92, 70, XT, 5)
  ])];
  F.v = [join([
    line(26, XT, 50, BASE, 6),
    line(50, BASE, 76, XT, 6)
  ])];
  F.w = [join([
    line(12, XT, 30, BASE, 5),
    line(30, BASE, 50, 74, 5),
    line(50, 74, 70, BASE, 5),
    line(70, BASE, 90, XT, 5)
  ])];
  F.x = [
    line(28, XT, 74, BASE, 6),
    line(74, XT, 28, BASE, 6)
  ];
  F.y = [
    line(28, XT, 50, 96, 5),
    line(74, XT, 38, 132, 8)
  ];
  F.z = [join([
    line(26, XT, 76, XT, 5),
    line(76, XT, 28, BASE, 6),
    line(28, BASE, 78, BASE, 5)
  ])];

  function get(ch) {
    var key = String(ch || '').toLowerCase();
    return F[key] || [line(50, 36, 50, BASE, 8)];
  }

  var api = {
    get: get,
    shapes: F,
    arc: arc,
    line: line,
    circle: circle,
    join: join
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WriteLetters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
