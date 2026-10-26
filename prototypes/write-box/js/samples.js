/* Sample ink for tests and for the grown-up demo links.

   wordStrokes lays the print skeletons in a row with a gap between letters.
   askStrokes keeps that word, but the first a or o is a bowl with a short
   stem: long enough to suggest a, short enough to still look like o.
   MUDDY_STEM is that stem length, in the 100×140 letter box. */
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
      var shape = (i === muddyAt) ? muddyShape(opts.stem == null ? MUDDY_STEM : opts.stem) : Letters.get(chars[i]);
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

  var api = {
    MUDDY_STEM: MUDDY_STEM,
    ASK_WORD: ASK_WORD,
    muddyShape: muddyShape,
    wordStrokes: wordStrokes,
    askStrokes: askStrokes
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WriteSamples = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
