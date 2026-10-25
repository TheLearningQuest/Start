/* NMQTrace — whole-word tracing.
   The act of drawing a finger across the word matters. The exact path does not.
   A wide ribbon around each letter and a minimum travel stop a single tap from finishing. */
(function (root) {
  'use strict';

  function isLetter(ch) {
    if (ch === 'I') return true;
    var c = String(ch || '').toLowerCase();
    return c >= 'a' && c <= 'z';
  }

  function layoutWord(word, box) {
    box = box || { x: 0, y: 0, w: 320, h: 180 };
    var raw = String(word || '');
    var letters = [];
    var i;
    for (i = 0; i < raw.length; i++) {
      if (!isLetter(raw.charAt(i))) continue;
      letters.push({ i: i, ch: raw.charAt(i) });
    }
    var n = letters.length;
    if (!n) return { cells: [], width: 0, height: 0, box: box };
    var gap = Math.min(18, Math.max(8, box.w * 0.03));
    var cellW = Math.min(box.h * 0.78, (box.w - gap * (n - 1)) / n);
    var cellH = Math.min(box.h * 0.9, cellW * 1.2);
    cellW = Math.min(cellW, cellH / 1.05);
    if (!(cellW > 8)) cellW = 8;
    if (!(cellH > 8)) cellH = cellW;
    var total = n * cellW + (n - 1) * gap;
    var x0 = box.x + Math.max(0, (box.w - total) / 2);
    var y0 = box.y + Math.max(0, (box.h - cellH) / 2);
    var cells = letters.map(function (L, k) {
      var x = x0 + k * (cellW + gap);
      var y = y0;
      return { i: L.i, ch: L.ch, x: x, y: y, w: cellW, h: cellH, cx: x + cellW / 2, cy: y + cellH / 2 };
    });
    return { cells: cells, width: total, height: cellH, box: box };
  }

  function pathLength(points) {
    var n = 0, i, dx, dy;
    points = points || [];
    for (i = 1; i < points.length; i++) {
      dx = points[i].x - points[i - 1].x;
      dy = points[i].y - points[i - 1].y;
      n += Math.sqrt(dx * dx + dy * dy);
    }
    return n;
  }

  /* A fast finger sends only a few points. Sample the segments so the ribbon still fills. */
  function samplesOf(points) {
    var out = [], i, a, b, d, steps, k, t;
    points = points || [];
    if (!points.length) return out;
    out.push(points[0]);
    for (i = 1; i < points.length; i++) {
      a = points[i - 1];
      b = points[i];
      d = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
      steps = Math.max(1, Math.ceil(d / 8));
      for (k = 1; k <= steps; k++) {
        t = k / steps;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    return out;
  }

  function padFor(cell, pad) {
    if (pad != null) return pad;
    return Math.max(22, (cell.w || 40) * 0.4);
  }

  function coverWord(cells, points, pad) {
    var samples = samplesOf(points);
    var flags = [];
    var covered = 0;
    var i, s, cell, padv, px, py, hit;
    cells = cells || [];
    for (i = 0; i < cells.length; i++) {
      cell = cells[i];
      padv = padFor(cell, pad);
      hit = false;
      for (s = 0; s < samples.length; s++) {
        px = samples[s].x;
        py = samples[s].y;
        if (px >= cell.x - padv && px <= cell.x + cell.w + padv && py >= cell.y - padv && py <= cell.y + cell.h + padv) {
          hit = true;
          break;
        }
      }
      flags.push(hit);
      if (hit) covered++;
    }
    return {
      covered: covered,
      total: cells.length,
      ratio: cells.length ? covered / cells.length : 0,
      length: pathLength(points),
      flags: flags
    };
  }

  /* One letter: the finger has to actually cross it.
     Longer words: cross most of the word and cover about three quarters of the letters. */
  function traceReady(layout, points, pad) {
    var cells = (layout && layout.cells) || [];
    var c = coverWord(cells, points, pad);
    var span, need;
    if (!cells.length) {
      c.need = 1;
      c.done = false;
      return c;
    }
    if (cells.length === 1) {
      span = cells[0].w;
      need = span * 0.45;
    } else {
      span = cells[cells.length - 1].cx - cells[0].cx;
      need = Math.max(span * 0.72, cells[0].w * 0.5);
    }
    c.need = need;
    c.done = c.ratio + 1e-9 >= 0.75 && c.length + 1e-6 >= need;
    return c;
  }

  var api = { layoutWord: layoutWord, coverWord: coverWord, pathLength: pathLength, traceReady: traceReady };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NMQTrace = api;
})(typeof window !== 'undefined' ? window : globalThis);
