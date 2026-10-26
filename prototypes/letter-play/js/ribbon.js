/* Paint-on-ribbon coverage. No DOM and no network.

   The letter is a fat candy ribbon. Soft spots sit along the middle.
   A spot turns painted when the finger comes within the ribbon plus
   one fingertip. Order, direction, and extra swipes do not matter.
   Paint only turns spots on. It never turns them off.

   A letter is done when about half of its spots are painted and the
   finger has actually moved. A whole word also asks for a small swipe
   on every letter, so a blank letter stays blank. There is no score. */
(function (root) {
  'use strict';

  var Forms = null;
  if (typeof module !== 'undefined' && module.exports) Forms = require('./letters.js');

  var COVER = 0.5;
  var FLOOR = 0.18;
  var TRAVEL = 0.33;
  var TUBE = 8;
  var STEP = 8;
  var FINGER = 32;
  var INSET = 12;
  var BOX_W = 100;
  var BOX_H = 140;

  function library() {
    return Forms || root.LetterForms;
  }

  function polyLength(pts) {
    var n = 0;
    var i;
    var dx;
    var dy;
    pts = pts || [];
    for (i = 1; i < pts.length; i++) {
      dx = pts[i].x - pts[i - 1].x;
      dy = pts[i].y - pts[i - 1].y;
      n += Math.sqrt(dx * dx + dy * dy);
    }
    return n;
  }

  function stampsOnPoly(poly, step, tube) {
    var stamps = [];
    if (!poly || !poly.length) return stamps;
    function push(x, y) {
      stamps.push({ x: x, y: y, r: tube, hit: false });
    }
    push(poly[0][0], poly[0][1]);
    if (poly.length === 1) return stamps;
    var acc = 0;
    var i;
    var ax = poly[0][0];
    var ay = poly[0][1];
    var bx;
    var by;
    var dx;
    var dy;
    var dist;
    var traveled;
    var need;
    var t;
    for (i = 1; i < poly.length; i++) {
      bx = poly[i][0];
      by = poly[i][1];
      dx = bx - ax;
      dy = by - ay;
      dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1e-8) continue;
      traveled = 0;
      while (acc + (dist - traveled) >= step - 1e-8) {
        need = step - acc;
        traveled += need;
        t = traveled / dist;
        push(ax + dx * t, ay + dy * t);
        acc = 0;
      }
      acc += dist - traveled;
      ax = bx;
      ay = by;
    }
    var last = poly[poly.length - 1];
    var s = stamps[stamps.length - 1];
    var ex = s.x - last[0];
    var ey = s.y - last[1];
    if (ex * ex + ey * ey > (step * 0.35) * (step * 0.35)) push(last[0], last[1]);
    return stamps;
  }

  function emptySheet(box) {
    return {
      letters: [],
      stamps: [],
      covered: 0,
      total: 0,
      ratio: 0,
      length: 0,
      guide: 0,
      need: 32,
      brush: FINGER,
      done: false,
      justDone: false,
      box: box || { x: 0, y: 0, w: 0, h: 0 }
    };
  }

  function layout(items, box) {
    items = items || [];
    box = box || { x: 0, y: 0, w: 0, h: 0 };
    if (!items.length || !(box.w > 20) || !(box.h > 20)) return emptySheet(box);
    var forms = library();
    var n = items.length;
    var padX = 8;
    var padTop = n === 1 ? 54 : 36;
    var padBot = 14;
    var innerW = Math.max(40, box.w - padX * 2);
    var innerH = Math.max(40, box.h - padTop - padBot);
    var gap = n > 1 ? Math.min(12, Math.max(4, innerW * 0.008)) : 0;
    var cellW = (innerW - gap * (n - 1)) / n;
    var cellH = innerH;
    var letters = [];
    var flat = [];
    var guide = 0;
    var i;
    var it;
    var cell;
    var fit;
    var scale;
    var ox;
    var oy;
    var form;
    var pi;
    var si;
    var src;
    var placed;
    var raw;
    var stamp;
    for (i = 0; i < n; i++) {
      it = items[i] || {};
      cell = {
        x: box.x + padX + i * (cellW + gap),
        y: box.y + padTop,
        w: cellW,
        h: cellH
      };
      fit = Math.min(cell.w / BOX_W, cell.h / BOX_H);
      if (!(fit > 0)) fit = 0.2;
      scale = fit * ((BOX_W - 2 * INSET) / BOX_W);
      ox = cell.x + (cell.w - BOX_W * scale) / 2;
      oy = cell.y + (cell.h - BOX_H * scale) / 2;
      form = forms.get(it.ch);
      var polys = [];
      var stamps = [];
      for (pi = 0; pi < form.length; pi++) {
        src = form[pi];
        placed = [];
        for (si = 0; si < src.length; si++) {
          placed.push({ x: ox + src[si][0] * scale, y: oy + src[si][1] * scale });
        }
        polys.push(placed);
        guide += polyLength(placed);
        raw = stampsOnPoly(src, STEP, TUBE);
        for (si = 0; si < raw.length; si++) {
          stamp = {
            x: ox + raw[si].x * scale,
            y: oy + raw[si].y * scale,
            r: raw[si].r * scale,
            hit: false
          };
          stamps.push(stamp);
          flat.push(stamp);
        }
      }
      letters.push({
        ch: it.ch || '',
        heart: !!it.heart,
        cell: cell,
        scale: scale,
        polys: polys,
        stamps: stamps,
        hit: 0,
        stampCount: stamps.length,
        ratio: 0
      });
    }
    var sheet = {
      letters: letters,
      stamps: flat,
      covered: 0,
      total: flat.length,
      ratio: 0,
      length: 0,
      guide: guide,
      need: Math.max(32, guide * TRAVEL),
      brush: FINGER,
      done: false,
      justDone: false,
      box: box
    };
    return sheet;
  }

  /* floorOk defaults to true so a one-letter sheet is only the half-ribbon rule. */
  function judge(state) {
    state = state || {};
    var total = state.total || 0;
    var ratio = total ? state.covered / total : 0;
    var letters = state.letters || [];
    var floorOk = true;
    var i;
    if (letters.length > 1) {
      for (i = 0; i < letters.length; i++) {
        if ((letters[i].ratio || 0) + 1e-9 < FLOOR) floorOk = false;
      }
    }
    var done = !!(total && ratio + 1e-9 >= COVER && (state.length || 0) + 1e-6 >= (state.need || 0) && floorOk);
    return {
      covered: state.covered || 0,
      total: total,
      ratio: ratio,
      length: state.length || 0,
      need: state.need || 0,
      floorOk: floorOk,
      done: done
    };
  }

  function sync(sheet) {
    var covered = 0;
    var total = 0;
    var stats = [];
    var i;
    var L;
    var hit;
    var k;
    for (i = 0; i < sheet.letters.length; i++) {
      L = sheet.letters[i];
      hit = 0;
      for (k = 0; k < L.stamps.length; k++) if (L.stamps[k].hit) hit++;
      L.hit = hit;
      L.stampCount = L.stamps.length;
      L.ratio = L.stampCount ? hit / L.stampCount : 0;
      covered += hit;
      total += L.stampCount;
      stats.push({ ratio: L.ratio });
    }
    sheet.covered = covered;
    sheet.total = total;
    var was = !!sheet.done;
    var result = judge({
      covered: covered,
      total: total,
      length: sheet.length,
      need: sheet.need,
      letters: stats
    });
    sheet.ratio = result.ratio;
    sheet.done = result.done;
    sheet.justDone = result.done && !was;
    return sheet;
  }

  function markAt(stamps, x, y, brush) {
    var i;
    var s;
    var dx;
    var dy;
    var reach;
    for (i = 0; i < stamps.length; i++) {
      s = stamps[i];
      if (s.hit) continue;
      dx = s.x - x;
      dy = s.y - y;
      reach = s.r + brush;
      if (dx * dx + dy * dy <= reach * reach) s.hit = true;
    }
  }

  /* points are page pixels. Spots only turn on. Length only grows. */
  function paint(sheet, points) {
    if (!sheet || !points || !points.length) return sheet;
    var brush = sheet.brush;
    var stamps = sheet.stamps;
    var i;
    var a;
    var b;
    var dx;
    var dy;
    var dist;
    var steps;
    var k;
    var t;
    if (points.length === 1) markAt(stamps, points[0].x, points[0].y, brush);
    for (i = 1; i < points.length; i++) {
      a = points[i - 1];
      b = points[i];
      dx = b.x - a.x;
      dy = b.y - a.y;
      dist = Math.sqrt(dx * dx + dy * dy);
      sheet.length += dist;
      steps = Math.max(1, Math.ceil(dist / 6));
      for (k = 0; k <= steps; k++) {
        t = k / steps;
        markAt(stamps, a.x + dx * t, a.y + dy * t, brush);
      }
    }
    return sync(sheet);
  }

  var api = {
    COVER: COVER,
    FLOOR: FLOOR,
    TRAVEL: TRAVEL,
    TUBE: TUBE,
    STEP: STEP,
    FINGER: FINGER,
    INSET: INSET,
    layout: layout,
    paint: paint,
    judge: judge,
    polyLength: polyLength
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LetterRibbon = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
