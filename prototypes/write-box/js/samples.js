/* Sample ink for tests and for the grown-up demo links.

   wordStrokes lays the print skeletons in a row with a gap between letters.
   askStrokes keeps that word, but the first a or o is a bowl with a short
   stem: long enough to suggest a, short enough to still look like o.
   MUDDY_STEM is that stem length, in the 100×140 letter box.

   formWord swaps in a named kid shape (a dash-dot i, a stem that starts
   a little high, a w whose corners do not meet, a y with a short tail).
   kidStrokes uses the a and i shapes for ?demo=kid. wideStrokes uses the
   gapped w and the short-tailed y for ?demo=wide. careStrokes places the
   iPad shapes from the said and they screenshots, for ?demo=care. */
(function (root) {
  'use strict';

  var Letters = root.WriteLetters;
  if (!Letters && typeof require === 'function') Letters = require('./letters.js');

  /* Tuned so come's muddy letter ranks a, then o, inside ASK_MARGIN.
     The chips are came and come. The stem runs most of the right side,
     so the close call is visible, and it still touches the bowl. */
  var MUDDY_STEM = 32;
  var ASK_WORD = 'come';

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

  function muddyShape(stem) {
    var bowl = Letters.circle(44, 88, 20);
    /* Grows down the right side from the upper bowl, so a longer stem
       is visible past the middle and still touches the bowl. */
    var top = 70;
    var side = Letters.line(63, top, 63, top + stem, 8);
    return [bowl, side];
  }

  /* Shapes that used to come back as the wrong letter. 100×140, y downward. */
  var FORMS = {
    'i-dash': [Letters.line(50, 70, 52, 108, 8), [[44, 50], [56, 48]]],
    'i-tiny': [Letters.line(50, 72, 50, 108, 8), Letters.circle(50, 48, 2.2)],
    'i-tap': [Letters.line(50, 74, 50, 108, 7), [[48, 50], [52, 49]]],
    'i-short': [Letters.line(50, 74, 50, 108, 8)],
    'i-talldot': [Letters.line(50, 36, 50, 108, 10), Letters.circle(50, 22, 4)],
    'l-tall': [Letters.line(50, 28, 50, 108, 12)],
    'a-kid': [
      Letters.arc(40, 90, 18, 0.55, Math.PI * 2 + 0.15, 16),
      Letters.line(58, 70, 60, 110, 8)
    ],
    'a-high': [Letters.circle(40, 90, 18), Letters.line(58, 52, 58, 108, 8)],
    'a-over': [Letters.circle(40, 86, 18), Letters.line(58, 66, 58, 118, 8)],
    'a-open': [
      Letters.arc(42, 90, 18, 0.7, Math.PI * 2 - 0.1, 14),
      Letters.line(60, 72, 62, 110, 8)
    ],
    'o-round': [Letters.oval(50, 88, 22, 24, 20)],
    'd-asc': [Letters.circle(40, 88, 18), Letters.line(58, 30, 60, 108, 12)],
    'p-desc': [Letters.line(32, 66, 32, 132, 12), Letters.circle(52, 84, 18)],
    'q-desc': [Letters.circle(42, 80, 18), Letters.line(60, 66, 62, 132, 10)],
    /* Four strokes, a small gap at each corner. Not the stored template. */
    'w-gap': [
      Letters.line(10, 66, 26, 108, 5),
      Letters.line(34, 108, 48, 78, 5),
      Letters.line(58, 78, 72, 108, 5),
      Letters.line(80, 108, 96, 66, 5)
    ],
    'w-flat': [
      Letters.line(12, 66, 30, 108, 5),
      Letters.line(36, 108, 66, 108, 4),
      Letters.line(72, 108, 92, 66, 5)
    ],
    'w-round': [
      Letters.line(12, 66, 12, 96, 4),
      Letters.arc(28, 96, 16, Math.PI, 0, 10),
      Letters.line(44, 96, 44, 70, 4),
      Letters.line(52, 70, 52, 96, 4),
      Letters.arc(68, 96, 16, Math.PI, 0, 10),
      Letters.line(84, 96, 84, 66, 4)
    ],
    'w-zig': [
      Letters.line(10, 66, 28, 106, 5),
      Letters.join([
        Letters.line(36, 106, 52, 74, 4),
        Letters.line(52, 74, 68, 106, 4)
      ]),
      Letters.line(76, 106, 94, 66, 5)
    ],
    'y-short': [
      Letters.line(28, 66, 50, 102, 5),
      Letters.line(74, 66, 46, 118, 6)
    ],
    /* A little off the stored short-tail y, so the tail cue has to help. */
    'y-off': [
      Letters.line(24, 64, 48, 100, 5),
      Letters.line(78, 64, 44, 120, 6)
    ],
    'y-gap': [
      Letters.line(16, 66, 40, 98, 5),
      Letters.line(84, 66, 58, 98, 5),
      Letters.line(48, 104, 40, 134, 5)
    ],
    'y-fork': [
      Letters.line(22, 66, 46, 100, 5),
      Letters.line(80, 66, 54, 100, 5),
      Letters.line(50, 108, 42, 132, 5)
    ],
    'v-point': [
      Letters.line(26, 66, 50, 108, 6),
      Letters.line(76, 66, 50, 108, 6)
    ],
    'v-gap': [
      Letters.line(24, 66, 46, 104, 5),
      Letters.line(62, 104, 80, 66, 5)
    ],
    'u-cup': [
      Letters.line(28, 66, 28, 96, 5),
      Letters.arc(50, 96, 22, Math.PI, 0, 10),
      Letters.line(72, 96, 72, 66, 5)
    ],
    'm-gap': [
      Letters.line(16, 66, 18, 108, 5),
      Letters.join([
        Letters.arc(40, 80, 14, Math.PI, Math.PI * 2, 8),
        Letters.line(54, 80, 54, 108, 4)
      ]),
      Letters.join([
        Letters.arc(72, 80, 14, Math.PI, Math.PI * 2, 8),
        Letters.line(86, 80, 86, 108, 4)
      ])
    ]
  };

  function wordStrokes(word, box, opts) {
    opts = opts || {};
    box = box || { w: 900, h: 420 };
    word = String(word || '');
    var chars = word.split('');
    var n = Math.max(1, chars.length);
    var pad = box.pad == null ? Math.max(18, Math.min(box.w, box.h) * 0.06) : box.pad;
    var innerW = Math.max(40, box.w - pad * 2);
    var innerH = Math.max(40, box.h - pad * 2);
    var slot = innerW / n;
    var scale = Math.min(innerH * 0.84 / 140, slot * 0.62 / 100);
    if (!(scale > 0)) scale = 0.4;
    var muddyAt = -1;
    if (opts.muddy) {
      var a = word.indexOf('a');
      var o = word.indexOf('o');
      if (o >= 0 && (a < 0 || o < a)) muddyAt = o;
      else if (a >= 0) muddyAt = a;
    }
    var rng = opts.wobble ? mulberry32(opts.seed || 1) : null;
    var wobble = opts.wobble || 0;
    var strokes = [];
    var i;
    for (i = 0; i < chars.length; i++) {
      var shape = Letters.get(chars[i]);
      if (opts.forms && opts.forms[i] && FORMS[opts.forms[i]]) shape = FORMS[opts.forms[i]];
      else if (i === muddyAt) shape = muddyShape(opts.stem == null ? MUDDY_STEM : opts.stem);
      var lw = 100 * scale;
      var lh = 140 * scale;
      var ox = pad + i * slot + (slot - lw) / 2;
      var oy = pad + (innerH - lh) / 2;
      var s;
      for (s = 0; s < shape.length; s++) {
        var stroke = [];
        var p;
        for (p = 0; p < shape[s].length; p++) {
          var x = ox + shape[s][p][0] * scale;
          var y = oy + shape[s][p][1] * scale;
          if (rng) {
            x += (rng() - 0.5) * wobble;
            y += (rng() - 0.5) * wobble;
          }
          stroke.push({ x: x, y: y });
        }
        strokes.push(stroke);
      }
    }
    return strokes;
  }

  function askStrokes(word, box, opts) {
    opts = opts || {};
    opts.muddy = true;
    if (opts.stem == null) opts.stem = MUDDY_STEM;
    return wordStrokes(word, box, opts);
  }

  function formWord(word, box, forms) {
    return wordStrokes(word, box, { forms: forms || {} });
  }

  /* The a starts a little high (it used to read as d). The i is a stem
     plus a short dash (it used to read as l). */
  function kidStrokes(word, box) {
    var forms = {};
    var i;
    word = String(word || '');
    for (i = 0; i < word.length; i++) {
      if (word.charAt(i) === 'a') forms[i] = 'a-high';
      else if (word.charAt(i) === 'i') forms[i] = 'i-dash';
    }
    return formWord(word, box, forms);
  }

  function ellipse(cx, cy, rx, ry, a0, a1, n) {
    var pts = [];
    var i;
    var a;
    n = n || 16;
    for (i = 0; i <= n; i++) {
      a = a0 + (a1 - a0) * (i / n);
      pts.push([Math.round((cx + Math.cos(a) * rx) * 10) / 10, Math.round((cy + Math.sin(a) * ry) * 10) / 10]);
    }
    return pts;
  }

  /* said, traced from the iPad screenshot. The a is one stroke: the bowl
     continues down the right side onto the same baseline as s. The d's
     stem rises, but not by a full ascender, and hooks a little right at
     the baseline. The i dot sits just left of the stem. */
  function photoSaid() {
    var a = ellipse(580, 1700, 90, 70, -1.15, Math.PI * 2 + 0.35, 28);
    var dStem = Letters.line(1188, 1548, 1184, 1765, 10).concat(Letters.line(1184, 1765, 1236, 1856, 6));
    return []
      .concat(placeShape(Letters.get('s'), 190, 1620, 370, 1820))
      .concat([a.concat(Letters.line(668, 1748, 700, 1830, 8))])
      .concat([Letters.line(798, 1496, 822, 1504, 4), Letters.line(848, 1640, 862, 1784, 8)])
      .concat([ellipse(1095, 1702, 82, 62, 0, Math.PI * 2, 24), dStem]);
  }

  /* they, traced from the iPad screenshot. The letters sit close together,
     and the y descender makes the word taller than the x-height. h is an
     open low arch. e is an upper curve, a middle bar, and a bottom bar,
     open on the lower right. y's right arm starts below the left one, and
     the tail hooks left. */
  function photoThey() {
    var arch = []
      .concat(Letters.line(492, 1740, 640, 1710, 6))
      .concat(Letters.line(640, 1710, 742, 1760, 6))
      .concat(Letters.line(742, 1760, 758, 1910, 8))
      .concat(Letters.line(758, 1910, 728, 1900, 3));
    var eBody = ellipse(970, 1768, 105, 72, -2.6, 0.35, 16)
      .concat(Letters.line(860, 1810, 855, 1900, 6))
      .concat(Letters.line(855, 1900, 1050, 1904, 7));
    var yTail = Letters.line(1162, 1712, 1230, 1850, 8).concat(Letters.line(1230, 1850, 1168, 2054, 10));
    return [
      Letters.line(250, 1562, 250, 1855, 12),
      Letters.line(128, 1718, 402, 1724, 8),
      Letters.line(490, 1560, 492, 1848, 14),
      arch,
      eBody,
      Letters.line(868, 1784, 1035, 1792, 6),
      yTail,
      Letters.line(1324, 1748, 1250, 1852, 8)
    ];
  }

  /* Uniform scale into the paper, so the gaps stay in proportion. */
  function fitStrokes(raw, box) {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    var s;
    var i;
    var p;
    var x;
    var y;
    box = box || { w: 980, h: 480, pad: 28 };
    for (s = 0; s < raw.length; s++) {
      for (i = 0; i < raw[s].length; i++) {
        p = raw[s][i];
        x = p.x != null ? p.x : p[0];
        y = p.y != null ? p.y : p[1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    var pad = box.pad == null ? 28 : box.pad;
    var bw = Math.max(40, box.w - pad * 2);
    var bh = Math.max(40, box.h - pad * 2);
    var scale = Math.min(bw / Math.max(1, maxX - minX), bh / Math.max(1, maxY - minY));
    var ox = pad + (bw - (maxX - minX) * scale) / 2;
    var oy = pad + (bh - (maxY - minY) * scale) / 2;
    var out = [];
    for (s = 0; s < raw.length; s++) {
      var stroke = [];
      for (i = 0; i < raw[s].length; i++) {
        p = raw[s][i];
        x = p.x != null ? p.x : p[0];
        y = p.y != null ? p.y : p[1];
        stroke.push({ x: ox + (x - minX) * scale, y: oy + (y - minY) * scale });
      }
      out.push(stroke);
    }
    return out;
  }

  function placeShape(shape, x0, y0, x1, y1) {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    var s;
    var i;
    var sc;
    for (s = 0; s < shape.length; s++) {
      for (i = 0; i < shape[s].length; i++) {
        if (shape[s][i][0] < minX) minX = shape[s][i][0];
        if (shape[s][i][0] > maxX) maxX = shape[s][i][0];
        if (shape[s][i][1] < minY) minY = shape[s][i][1];
        if (shape[s][i][1] > maxY) maxY = shape[s][i][1];
      }
    }
    sc = Math.min((x1 - x0) / Math.max(1, maxX - minX), (y1 - y0) / Math.max(1, maxY - minY));
    var out = [];
    for (s = 0; s < shape.length; s++) {
      var stroke = [];
      for (i = 0; i < shape[s].length; i++) {
        stroke.push([
          Math.round((x0 + (shape[s][i][0] - minX) * sc) * 10) / 10,
          Math.round((y0 + (shape[s][i][1] - minY) * sc) * 10) / 10
        ]);
      }
      out.push(stroke);
    }
    return out;
  }

  /* The iPad ink for said and they. Other words fall back to said's page. */
  function careStrokes(word, box) {
    var raw = String(word || '') === 'they' ? photoThey() : photoSaid();
    return fitStrokes(raw, box);
  }

  /* A w in four strokes and a y whose tail is a bit short. */
  function wideStrokes(word, box) {
    var forms = {};
    var i;
    word = String(word || '');
    for (i = 0; i < word.length; i++) {
      if (word.charAt(i) === 'w') forms[i] = 'w-gap';
      else if (word.charAt(i) === 'y') forms[i] = 'y-short';
    }
    return formWord(word, box, forms);
  }

  var api = {
    MUDDY_STEM: MUDDY_STEM,
    ASK_WORD: ASK_WORD,
    FORMS: FORMS,
    muddyShape: muddyShape,
    wordStrokes: wordStrokes,
    askStrokes: askStrokes,
    formWord: formWord,
    kidStrokes: kidStrokes,
    wideStrokes: wideStrokes,
    careStrokes: careStrokes,
    photoSaid: photoSaid,
    photoThey: photoThey
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WriteSamples = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
