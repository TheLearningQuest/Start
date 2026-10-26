/* Sample ink for tests and for the grown-up demo links.

   wordStrokes lays the print skeletons in a row with a gap between letters.
   askStrokes keeps that word, but the first a or o is a bowl with a short
   stem: long enough to suggest a, short enough to still look like o.
   MUDDY_STEM is that stem length, in the 100×140 letter box.

   formWord swaps in a named kid shape (a dash-dot i, a stem that starts
   a little high, a w whose corners do not meet, a y with a short tail).
   kidStrokes uses the a and i shapes for ?demo=kid. wideStrokes uses the
   gapped w and the short-tailed y for ?demo=wide. */
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
    wideStrokes: wideStrokes
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WriteSamples = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
