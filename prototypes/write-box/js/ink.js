/* Offline print reader for one written word.

   Strokes stay on the device. Nothing is fetched.
   Letters are matched with $P (Vatavu, Anthony, and Wobbrock, 2012):
   resample each stroke to a point cloud, scale it into a box,
   and greedily match it to the print skeletons and kid-print forms
   in letters.js. Stroke order and direction do not matter.

   A careful w is often four short strokes whose corners do not quite
   touch. Those ends are joined into one letter before matching.
   A hole wider than the strokes themselves stays a space between letters.

   $P alone ties i with l (the dot is a few points), a with o, d, p, q
   (a bowl plus a stem), w with v, u, and m, and y with v, g, q, and j.
   After the cloud rank, a small geometric pass may overturn a close pair:
   - i vs l: a detached dot or short dash above the stem, or a stick
     that is short next to a taller letter in the same word.
   - a vs o, d, p, q: a closed or open bowl, a right-side stem, and
     whether that stem rises above the bowl or drops below it.
   - w vs v, u, m: two low feet and a wide zig-zag, not one point or a cup.
   - y vs v, g, q, j: a fork with a narrow tail, and no bowl or dot.
   The cue has to be clear. A half stem stays a question, not a grade.

   Uncertainty, so a close call does not become a miss:
   - SURE_DIST (0.22): a letter is crisp when its best distance is under this.
   - SURE_MARGIN (0.06): and the runner-up is at least this much worse.
   - ASK_MARGIN (0.06): a runner-up inside this gap becomes a choice chip.
     Same number as SURE_MARGIN, so any close second means "ask", not "grade".
   - READABLE_DIST (0.42): a best distance above this is not a letter.
   - CHIP_MAX (4): at most four chips.
   - PAIR_WINDOW (0.22): a strong dot or stem cue may pass $P inside this gap.
   - PRIOR_REACH (0.14): after the ink is read, the demo word's letter may
     lean forward when it is already this close, the ink is readable, and
     the call is neither crisp nor a toss-up. A crisp other letter stays.

   Chips are the best spelling, then one chip per unsure letter with that
   letter swapped to its runner-up (left to right). When exactly two letters
   are unsure, one more chip swaps both, if there is room. If the demo word
   itself is already one of those close readings, it is included too.
   The target is not pasted in over a crisp other word.

   Nothing is saved, and a close call is not graded. miss is true only for a crisp other
   word (every letter under SURE_DIST, no close runner-up), or for a chip
   that is not the target. An ask, a fuzzy reading, an empty box, a tiny
   mark, and an unreadable mark all have miss false. */
(function (root) {
  'use strict';

  var Letters = root.WriteLetters;
  if (!Letters && typeof require === 'function') Letters = require('./letters.js');

  var N = 24;
  var ORIENT_W = 0.25;
  var ASPECT_W = 0.14;
  var ASPECT_DEAD = 0.22;
  var SURE_DIST = 0.22;
  var SURE_MARGIN = 0.06;
  var ASK_MARGIN = 0.06;
  var READABLE_DIST = 0.42;
  var CHIP_MAX = 4;
  /* Strokes whose boxes sit closer than this fraction of the ink height
     are the same letter (a dot over i, the cross of t, a broken bowl). */
  var GAP_RATIO = 0.10;
  /* A lifted pen at a corner (w, y, v, m) still joins when the stroke
     ends are this close, as a fraction of the shorter stroke's height. */
  var JOIN_RATIO = 0.65;
  /* The x-hole may be a bit wider than a steep leg. Wider than that,
     next to a skinny stroke, is a space between letters (two l's). */
  var HOLE_RATIO = 1.65;
  /* Never bridge more than this fraction of the whole ink height. */
  var JOIN_CAP = 0.50;
  /* A speck is ink much smaller than the whole word. A dot above a stem stays
     even when it is smaller than this. */
  var SPECK_RATIO = 0.045;
  var TINY = 18;
  var SHEAR = 0.12;
  /* Strong geometry (a dot, a full stem, a clear height) may overturn $P
     when the two letters are at most this far apart. */
  var PAIR_WINDOW = 0.22;
  /* The demo letter may lean forward when it is already within this of the
     best reading. Wider than ASK_MARGIN, so a real toss-up still asks. */
  var PRIOR_REACH = 0.14;
  /* Stem must rise this many bowl-heights above the bowl to count as d. */
  var ASCENDER_RATIO = 0.85;
  /* And drop this far below the bowl to count as q or p. */
  var DESCENDER_RATIO = 0.55;
  /* A full a-stem covers at least this much of the bowl, top to bottom. */
  var STEM_SPAN = 0.90;
  /* Tallest letter vs the median. Above this, the word has ascenders. */
  var HEIGHT_CONTRAST = 1.32;
  /* A stick this short beside a taller letter reads as i, not l. */
  var SHORT_RATIO = 0.78;
  /* A stick this tall, with no dot, reads as l. */
  var TALL_RATIO = 0.90;
  /* A tail at least this much of the letter, under a wide fork, is y not v. */
  var TAIL_RATIO = 0.20;
  /* Two low feet with a real peak between them, this wide, are w not v or u. */
  var WIDE_RATIO = 1.40;

  var PROMPT_EMPTY = 'Write the word, then tap Submit.';
  var PROMPT_TINY = 'Write it a little bigger, then tap Submit.';
  var PROMPT_UNREADABLE = "I couldn't quite read that. Try again.";
  var PROMPT_MISMATCH = "Let's try that once more.";
  var PROMPT_WIN = 'You wrote it!';
  var PROMPT_MANY = 'Almost — which word did you write?';
  var PROMPT_SOFT = "Almost — let's try that once more.";

  function dist(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function mdist(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    var du = a.u - b.u;
    var dv = a.v - b.v;
    return Math.sqrt(dx * dx + dy * dy + ORIENT_W * ORIENT_W * (du * du + dv * dv));
  }

  function toPoints(strokes) {
    var pts = [];
    var s;
    var i;
    for (s = 0; s < strokes.length; s++) {
      var stroke = strokes[s] || [];
      for (i = 0; i < stroke.length; i++) {
        var p = stroke[i];
        pts.push({ x: p.x != null ? p.x : p[0], y: p.y != null ? p.y : p[1], id: s });
      }
    }
    return pts;
  }

  function pathLength(pts) {
    var d = 0;
    var i;
    for (i = 1; i < pts.length; i++) {
      if (pts[i].id === pts[i - 1].id) d += dist(pts[i - 1], pts[i]);
    }
    return d;
  }

  function resample(pts, n) {
    var I = pathLength(pts) / (n - 1);
    var D = 0;
    var out = [{ x: pts[0].x, y: pts[0].y, id: pts[0].id }];
    var i;
    var d;
    var t;
    var q;
    if (!(I > 0) || !pts.length) {
      while (out.length < n) out.push({ x: pts[0].x, y: pts[0].y, id: pts[0].id });
      return out;
    }
    pts = pts.slice();
    for (i = 1; i < pts.length && out.length < n; i++) {
      if (pts[i].id !== pts[i - 1].id) continue;
      d = dist(pts[i - 1], pts[i]);
      if (D + d >= I && d > 0) {
        t = (I - D) / d;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        q = {
          x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x),
          y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y),
          id: pts[i].id
        };
        out.push(q);
        pts.splice(i, 0, q);
        D = 0;
      } else D += d;
    }
    while (out.length < n) {
      q = pts[pts.length - 1];
      out.push({ x: q.x, y: q.y, id: q.id });
    }
    return out.slice(0, n);
  }

  function bbox(pts) {
    var b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    var i;
    for (i = 0; i < pts.length; i++) {
      var p = pts[i];
      var x = p.x != null ? p.x : p[0];
      var y = p.y != null ? p.y : p[1];
      if (x < b.minX) b.minX = x;
      if (x > b.maxX) b.maxX = x;
      if (y < b.minY) b.minY = y;
      if (y > b.maxY) b.maxY = y;
    }
    return b;
  }

  function aspectOf(strokes) {
    var pts = toPoints(strokes);
    if (!pts.length) return 1;
    var b = bbox(pts);
    var w = b.maxX - b.minX;
    var h = b.maxY - b.minY;
    if (h < 1e-6 && w < 1e-6) return 1;
    if (h < 1e-6) return 8;
    return Math.max(w, h * 0.07) / h;
  }

  function normalize(pts) {
    var minX = Infinity;
    var maxX = -Infinity;
    var minY = Infinity;
    var maxY = -Infinity;
    var i;
    for (i = 0; i < pts.length; i++) {
      if (pts[i].x < minX) minX = pts[i].x;
      if (pts[i].x > maxX) maxX = pts[i].x;
      if (pts[i].y < minY) minY = pts[i].y;
      if (pts[i].y > maxY) maxY = pts[i].y;
    }
    var s = Math.max(maxX - minX, maxY - minY) || 1;
    var cx = 0;
    var cy = 0;
    var out = [];
    for (i = 0; i < pts.length; i++) {
      out.push({ x: (pts[i].x - minX) / s, y: (pts[i].y - minY) / s, id: pts[i].id });
    }
    for (i = 0; i < out.length; i++) {
      cx += out[i].x;
      cy += out[i].y;
    }
    cx /= out.length;
    cy /= out.length;
    for (i = 0; i < out.length; i++) {
      out[i].x -= cx;
      out[i].y -= cy;
    }
    for (i = 0; i < out.length; i++) {
      var a = out[i - 1] && out[i - 1].id === out[i].id ? out[i - 1] : out[i];
      var b = out[i + 1] && out[i + 1].id === out[i].id ? out[i + 1] : out[i];
      var th = Math.atan2(b.y - a.y, b.x - a.x);
      var len = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
      out[i].u = len > 1e-6 ? Math.cos(2 * th) : 0;
      out[i].v = len > 1e-6 ? Math.sin(2 * th) : 0;
    }
    return out;
  }

  function cloudDistance(a, b, start) {
    var n = a.length;
    var matched = [];
    var sum = 0;
    var i = start;
    var j;
    var k;
    for (k = 0; k < n; k++) matched.push(false);
    do {
      var min = Infinity;
      var idx = 0;
      for (j = 0; j < n; j++) {
        if (matched[j]) continue;
        var d = mdist(a[i], b[j]);
        if (d < min) {
          min = d;
          idx = j;
        }
      }
      matched[idx] = true;
      var weight = 1 - ((i - start + n) % n) / n;
      sum += weight * min;
      i = (i + 1) % n;
    } while (i !== start);
    return sum;
  }

  function greedy(a, b) {
    var n = a.length;
    var step = Math.max(1, Math.floor(Math.sqrt(n)));
    var min = Infinity;
    var i;
    for (i = 0; i < n; i += step) {
      var d1 = cloudDistance(a, b, i);
      var d2 = cloudDistance(b, a, i);
      if (d1 < min) min = d1;
      if (d2 < min) min = d2;
    }
    return min;
  }

  function prep(strokes) {
    var pts = toPoints(strokes);
    if (!pts.length) return [];
    return normalize(resample(pts, N));
  }

  function shear(strokes, k) {
    var out = [];
    var s;
    var i;
    for (s = 0; s < strokes.length; s++) {
      var stroke = [];
      for (i = 0; i < strokes[s].length; i++) {
        var p = strokes[s][i];
        var x = p[0];
        var y = p[1];
        stroke.push([x + (y - 80) * k, y]);
      }
      out.push(stroke);
    }
    return out;
  }

  var TEMPLATES = [];
  var LETTERS = 'abcdefghijklmnopqrstuvwxyz';
  var li;
  for (li = 0; li < LETTERS.length; li++) {
    var ch = LETTERS.charAt(li);
    /* Primary print, slanted both ways, then kid-print forms unslanted.
       Slant on every kid form made near letters tie. */
    var forms = Letters.variants ? Letters.variants(ch) : [Letters.get(ch)];
    var v;
    for (v = 0; v < forms.length; v++) {
      var slants = v === 0 ? [0, SHEAR, -SHEAR] : [0];
      var s;
      for (s = 0; s < slants.length; s++) {
        var shaped = slants[s] ? shear(forms[v], slants[s]) : forms[v];
        TEMPLATES.push({
          ch: ch,
          cloud: prep(shaped),
          aspect: aspectOf(shaped)
        });
      }
    }
  }

  function diagOf(b) {
    return Math.sqrt((b.maxX - b.minX) * (b.maxX - b.minX) + (b.maxY - b.minY) * (b.maxY - b.minY));
  }

  function unionBox(a, b) {
    return {
      minX: Math.min(a.minX, b.minX),
      maxX: Math.max(a.maxX, b.maxX),
      minY: Math.min(a.minY, b.minY),
      maxY: Math.max(a.maxY, b.maxY)
    };
  }

  /* gap is negative when the boxes overlap in x. */
  function xGap(a, b) {
    return Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX);
  }

  /* A small mark sitting just above a taller stroke: the dot on i or j,
     including a short dash. A crossbar cuts through the stem, so it is not one. */
  function isTittleBox(small, tall) {
    var sh = small.maxY - small.minY;
    var sw = small.maxX - small.minX;
    var bh = Math.max(1, tall.maxY - tall.minY);
    var gap = tall.minY - small.maxY;
    var scy = (small.minY + small.maxY) / 2;
    if (sh > bh * 0.48) return false;
    if (sw > bh * 0.75) return false;
    if (gap < -Math.max(2, bh * 0.08)) return false;
    if (scy > tall.minY + bh * 0.02) return false;
    if (small.maxX < tall.minX - bh * 0.35) return false;
    if (small.minX > tall.maxX + bh * 0.35) return false;
    return true;
  }

  function keepStroke(item, items, H) {
    var i;
    if (diagOf(item.b) >= SPECK_RATIO * H) return true;
    for (i = 0; i < items.length; i++) {
      if (items[i] === item) continue;
      var bh = items[i].b.maxY - items[i].b.minY;
      if (bh < H * 0.22) continue;
      if (isTittleBox(item.b, items[i].b)) return true;
    }
    return false;
  }

  function strokeEnds(stroke) {
    var a;
    var b;
    if (!stroke || !stroke.length) return [];
    a = stroke[0];
    b = stroke[stroke.length - 1];
    return [
      { x: a.x != null ? a.x : a[0], y: a.y != null ? a.y : a[1] },
      { x: b.x != null ? b.x : b[0], y: b.y != null ? b.y : b[1] }
    ];
  }

  /* Closest pair of stroke ends. A broken corner of w or y is small.
     The facing sides of two letters usually are not stroke ends. */
  function endpointGap(a, b) {
    var best = Infinity;
    var ae = [];
    var be = [];
    var s;
    var i;
    var j;
    var dx;
    var dy;
    var d;
    for (s = 0; s < a.strokes.length; s++) ae = ae.concat(strokeEnds(a.strokes[s]));
    for (s = 0; s < b.strokes.length; s++) be = be.concat(strokeEnds(b.strokes[s]));
    for (i = 0; i < ae.length; i++) {
      for (j = 0; j < be.length; j++) {
        dx = ae[i].x - be[j].x;
        dy = ae[i].y - be[j].y;
        d = dx * dx + dy * dy;
        if (d < best) best = d;
      }
    }
    return Math.sqrt(best);
  }

  /* A flat bar (the middle of a 3-stroke w) is wide and has no height.
     A tall leg is measured by its height, so two skinny l's do not qualify. */
  function strokeReach(box) {
    var w = Math.max(1, box.maxX - box.minX);
    var h = Math.max(1, box.maxY - box.minY);
    if (h < w * 0.35) return w;
    return h;
  }

  function shouldMerge(a, b, H) {
    var gap = xGap(a.b, b.b);
    var ha;
    var hb;
    var wa;
    var wb;
    var hole;
    var reach;
    var wide;
    var near;
    if (gap < GAP_RATIO * H) return true;
    ha = strokeReach(a.b);
    hb = strokeReach(b.b);
    wa = Math.max(1, a.b.maxX - a.b.minX);
    wb = Math.max(1, b.b.maxX - b.b.minX);
    hole = Math.max(0, gap);
    reach = Math.min(ha, hb);
    wide = Math.max(wa, wb);
    /* A hole wider than the strokes is a space, not a missed corner. */
    if (hole > HOLE_RATIO * wide) return false;
    if (hole > JOIN_CAP * H) return false;
    near = endpointGap(a, b);
    return near < JOIN_RATIO * reach && near < JOIN_CAP * H;
  }

  function segment(strokes) {
    var items = [];
    var s;
    var i;
    strokes = strokes || [];
    for (s = 0; s < strokes.length; s++) {
      if (!strokes[s] || !strokes[s].length) continue;
      var pts = [];
      for (i = 0; i < strokes[s].length; i++) {
        var p = strokes[s][i];
        pts.push({ x: p.x != null ? p.x : p[0], y: p.y != null ? p.y : p[1] });
      }
      items.push({ strokes: [strokes[s]], b: bbox(pts) });
    }
    if (!items.length) return [];
    var all = items[0].b;
    for (i = 1; i < items.length; i++) all = unionBox(all, items[i].b);
    var H = Math.max(1, all.maxY - all.minY);
    var W = Math.max(1, all.maxX - all.minX);
    if (Math.max(H, W) >= TINY) {
      var big = [];
      for (i = 0; i < items.length; i++) {
        if (keepStroke(items[i], items, H)) big.push(items[i]);
      }
      if (big.length) items = big;
    }
    var merged = true;
    var guard = 0;
    while (merged && guard < 80) {
      merged = false;
      guard++;
      for (i = 0; i < items.length && !merged; i++) {
        var j;
        for (j = i + 1; j < items.length && !merged; j++) {
          if (!shouldMerge(items[i], items[j], H)) continue;
          items[i].strokes = items[i].strokes.concat(items[j].strokes);
          items[i].b = unionBox(items[i].b, items[j].b);
          items.splice(j, 1);
          merged = true;
        }
      }
    }
    items.sort(function (a, b) { return a.b.minX - b.b.minX; });
    return items;
  }

  function strokePoints(stroke) {
    var pts = [];
    var i;
    var p;
    stroke = stroke || [];
    for (i = 0; i < stroke.length; i++) {
      p = stroke[i];
      pts.push({ x: p.x != null ? p.x : p[0], y: p.y != null ? p.y : p[1] });
    }
    return pts;
  }

  function hasHook(pts, box) {
    var h;
    var yCut;
    var minX = Infinity;
    var maxX = -Infinity;
    var minU = Infinity;
    var maxU = -Infinity;
    var n = 0;
    var i;
    if (!pts || pts.length < 5) return false;
    h = Math.max(1, box.maxY - box.minY);
    yCut = box.minY + h * 0.68;
    for (i = 0; i < pts.length; i++) {
      if (pts[i].y >= yCut) {
        if (pts[i].x < minX) minX = pts[i].x;
        if (pts[i].x > maxX) maxX = pts[i].x;
        n++;
      } else if (pts[i].y < box.minY + h * 0.45) {
        if (pts[i].x < minU) minU = pts[i].x;
        if (pts[i].x > maxU) maxU = pts[i].x;
      }
    }
    if (n < 2 || !isFinite(minX)) return false;
    var bottomW = maxX - minX;
    var upperW = isFinite(minU) ? (maxU - minU) : 0;
    return bottomW > h * 0.18 && bottomW > upperW + h * 0.08;
  }

  function closureOf(pts) {
    var cx = 0;
    var cy = 0;
    var bins = [];
    var i;
    var occupied = 0;
    var emptyRight = 0;
    if (!pts || pts.length < 8) return { closed: false, occupied: 0 };
    for (i = 0; i < pts.length; i++) {
      cx += pts[i].x;
      cy += pts[i].y;
    }
    cx /= pts.length;
    cy /= pts.length;
    for (i = 0; i < 16; i++) bins.push(0);
    for (i = 0; i < pts.length; i++) {
      var ang = Math.atan2(pts[i].y - cy, pts[i].x - cx);
      var bi = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16) % 16;
      bins[bi]++;
    }
    for (i = 0; i < 16; i++) if (bins[i] > 0) occupied++;
    for (i = 6; i <= 10; i++) if (!bins[i]) emptyRight++;
    return {
      closed: occupied >= 12 && emptyRight <= 1,
      occupied: occupied
    };
  }

  /* Right and left contours, as a fraction of width. A stem makes one side flat. */
  function contourRange(pts, box) {
    var rows = 12;
    var right = [];
    var left = [];
    var cnt = [];
    var r;
    var i;
    var H = Math.max(1, box.maxY - box.minY);
    var W = Math.max(1, box.maxX - box.minX);
    for (r = 0; r < rows; r++) {
      right.push(-Infinity);
      left.push(Infinity);
      cnt.push(0);
    }
    for (i = 0; i < pts.length; i++) {
      var ri = Math.floor(((pts[i].y - box.minY) / H) * rows);
      if (ri < 0) ri = 0;
      if (ri >= rows) ri = rows - 1;
      if (pts[i].x > right[ri]) right[ri] = pts[i].x;
      if (pts[i].x < left[ri]) left[ri] = pts[i].x;
      cnt[ri]++;
    }
    function span(arr) {
      var lo = Infinity;
      var hi = -Infinity;
      var n = 0;
      var k;
      for (k = 0; k < arr.length; k++) {
        if (!cnt[k] || !isFinite(arr[k])) continue;
        if (arr[k] < lo) lo = arr[k];
        if (arr[k] > hi) hi = arr[k];
        n++;
      }
      if (n < 4) return 1;
      return (hi - lo) / W;
    }
    return { right: span(right), left: span(left) };
  }

  function geometry(strokes) {
    var stats = [];
    var i;
    strokes = strokes || [];
    for (i = 0; i < strokes.length; i++) {
      var pts = strokePoints(strokes[i]);
      if (!pts.length) continue;
      var b = bbox(pts);
      stats.push({
        pts: pts,
        b: b,
        w: Math.max(0, b.maxX - b.minX),
        h: Math.max(0, b.maxY - b.minY),
        cx: (b.minX + b.maxX) / 2,
        cy: (b.minY + b.maxY) / 2
      });
    }
    if (!stats.length) return { tittle: false, stick: false, hook: false, bowlReal: false, closed: false, occupied: 0, aspect: 1, stem: null };
    var all = stats[0].b;
    for (i = 1; i < stats.length; i++) all = unionBox(all, stats[i].b);
    var H = Math.max(1, all.maxY - all.minY);
    var W = Math.max(1, all.maxX - all.minX);
    var tallest = stats[0];
    for (i = 1; i < stats.length; i++) if (stats[i].h > tallest.h) tallest = stats[i];
    var tittles = [];
    var body = [];
    for (i = 0; i < stats.length; i++) {
      var s = stats[i];
      if (s !== tallest && isTittleBox(s.b, tallest.b)) tittles.push(s);
      else body.push(s);
    }
    if (!body.length) body = stats.slice();
    var bodyBox = body[0].b;
    for (i = 1; i < body.length; i++) bodyBox = unionBox(bodyBox, body[i].b);
    var bodyH = Math.max(1, bodyBox.maxY - bodyBox.minY);
    var bodyW = Math.max(0.001, bodyBox.maxX - bodyBox.minX);
    var stems = [];
    var bowls = [];
    for (i = 0; i < body.length; i++) {
      var st = body[i];
      var skinny = st.h >= st.w * 2.4 && st.h >= bodyH * 0.55 && st.w <= Math.max(bodyW * 0.45, H * 0.18);
      if (skinny) stems.push(st);
      else bowls.push(st);
    }
    var bowlBox = null;
    if (bowls.length) {
      bowlBox = bowls[0].b;
      for (i = 1; i < bowls.length; i++) bowlBox = unionBox(bowlBox, bowls[i].b);
    }
    var bowlH = bowlBox ? Math.max(0, bowlBox.maxY - bowlBox.minY) : 0;
    var bowlW = bowlBox ? Math.max(0, bowlBox.maxX - bowlBox.minX) : 0;
    var bowlReal = !!(bowlBox && bowlH >= H * 0.32 && bowlW >= H * 0.22);
    var stem = null;
    for (i = 0; i < stems.length; i++) {
      var ref = bowlReal ? bowlBox : bodyBox;
      var bh = Math.max(1, ref.maxY - ref.minY);
      var above = (ref.minY - stems[i].b.minY) / bh;
      var below = (stems[i].b.maxY - ref.maxY) / bh;
      var overlapTop = Math.max(stems[i].b.minY, ref.minY);
      var overlapBot = Math.min(stems[i].b.maxY, ref.maxY);
      var span = overlapBot > overlapTop ? (overlapBot - overlapTop) / bh : 0;
      var side = 'right';
      if (bowlReal) side = stems[i].cx <= (bowlBox.minX + bowlBox.maxX) / 2 ? 'left' : 'right';
      var reach = span + Math.max(0, above) + Math.max(0, below);
      var prev = stem ? stem.span + Math.max(0, stem.above) + Math.max(0, stem.below) : -1;
      if (reach > prev) stem = { side: side, above: above, below: below, span: span };
    }
    var hook = false;
    for (i = 0; i < body.length; i++) {
      if (hasHook(body[i].pts, body[i].b)) hook = true;
    }
    var bowlPts = [];
    for (i = 0; i < bowls.length; i++) bowlPts = bowlPts.concat(bowls[i].pts);
    var close = bowlReal ? closureOf(bowlPts) : { closed: false, occupied: 0 };
    var allPts = [];
    for (i = 0; i < stats.length; i++) allPts = allPts.concat(stats[i].pts);
    var edge = contourRange(allPts, all);
    return {
      tittle: tittles.length > 0,
      stick: bowls.length === 0,
      hook: hook,
      bowlReal: bowlReal,
      closed: close.closed,
      occupied: close.occupied,
      aspect: W / H,
      stem: stem,
      edge: edge,
      profile: profileOf(allPts, all)
    };
  }

  /* Feet, the rise between them, and a narrow tail under a wide top.
     y grows downward, so a foot is a low (large y) column. */
  function profileOf(pts, box) {
    var cols = 9;
    var rows = 14;
    var W = Math.max(1, box.maxX - box.minX);
    var H = Math.max(1, box.maxY - box.minY);
    var bottom = [];
    var top = [];
    var cnt = [];
    var rowN = [];
    var rowMin = [];
    var rowMax = [];
    var c;
    var r;
    var i;
    var ci;
    var ri;
    var empty = {
      feet: 0, footRise: 0, peak: false, tail: 0, wideTop: false, cup: false,
      footSpan: 0, footMid: 0.5
    };
    if (!pts || !pts.length) return empty;
    for (c = 0; c < cols; c++) {
      bottom.push(-Infinity);
      top.push(Infinity);
      cnt.push(0);
    }
    for (r = 0; r < rows; r++) {
      rowN.push(0);
      rowMin.push(Infinity);
      rowMax.push(-Infinity);
    }
    for (i = 0; i < pts.length; i++) {
      ci = Math.floor(((pts[i].x - box.minX) / W) * cols);
      if (ci < 0) ci = 0;
      if (ci >= cols) ci = cols - 1;
      if (pts[i].y > bottom[ci]) bottom[ci] = pts[i].y;
      if (pts[i].y < top[ci]) top[ci] = pts[i].y;
      cnt[ci]++;
      ri = Math.floor(((pts[i].y - box.minY) / H) * rows);
      if (ri < 0) ri = 0;
      if (ri >= rows) ri = rows - 1;
      rowN[ri]++;
      if (pts[i].x < rowMin[ri]) rowMin[ri] = pts[i].x;
      if (pts[i].x > rowMax[ri]) rowMax[ri] = pts[i].x;
    }
    var low = -Infinity;
    for (c = 0; c < cols; c++) if (cnt[c] && bottom[c] > low) low = bottom[c];
    var band = H * 0.16;
    var lowCol = [];
    for (c = 0; c < cols; c++) lowCol.push(!!(cnt[c] && bottom[c] >= low - band));
    var feet = 0;
    var inRun = false;
    var first = -1;
    var last = -1;
    var lowN = 0;
    for (c = 0; c < cols; c++) {
      if (lowCol[c]) {
        lowN++;
        if (!inRun) {
          feet++;
          inRun = true;
        }
        if (first < 0) first = c;
        last = c;
      } else inRun = false;
    }
    var rise = 0;
    var peak = false;
    if (first >= 0 && last > first) {
      var highest = Infinity;
      var topmost = Infinity;
      var seen = false;
      for (c = first + 1; c <= last - 1; c++) {
        if (!lowCol[c] && cnt[c]) {
          seen = true;
          if (bottom[c] < highest) highest = bottom[c];
          if (top[c] < topmost) topmost = top[c];
        }
      }
      if (seen && isFinite(highest)) rise = (low - highest) / H;
      if (seen && isFinite(topmost) && topmost <= box.minY + H * 0.55) peak = true;
    }
    var tailRows = 0;
    var wideTop = false;
    var span;
    for (r = rows - 1; r >= 0; r--) {
      if (!rowN[r]) continue;
      span = rowMax[r] - rowMin[r];
      if (span > W * 0.32) break;
      tailRows++;
    }
    for (r = 0; r < rows * 0.62; r++) {
      if (!rowN[r]) continue;
      if ((rowMax[r] - rowMin[r]) >= W * 0.62) wideTop = true;
    }
    return {
      feet: feet,
      footRise: rise,
      peak: peak,
      tail: tailRows / rows,
      wideTop: wideTop,
      cup: feet === 1 && lowN >= cols * 0.45,
      /* 0 = one column, 1 = feet at both outer edges (an x, not a v). */
      footSpan: first < 0 ? 0 : (last - first) / (cols - 1),
      footMid: first < 0 ? 0.5 : ((first + last) / 2) / (cols - 1)
    };
  }

  /* i, l, and j. A dot wins. Without one, height next to the rest of the word does. */
  function pickStick(g, ctx) {
    var narrow = g.aspect < 0.45;
    if (!(g.stick || (g.tittle && narrow))) return null;
    if (g.tittle && g.hook) return 'j';
    if (g.tittle && !g.hook) return 'i';
    if (g.hook) return null;
    if (ctx && ctx.contrast && ctx.rel <= SHORT_RATIO) return 'i';
    if (ctx && ctx.contrast && ctx.rel >= TALL_RATIO) return 'l';
    return null;
  }

  /* a, o, d, p, q. A partial stem (the muddy o) returns null on purpose. */
  function pickBowl(g) {
    var s;
    if (!g.bowlReal) return null;
    s = g.stem;
    if (s && s.side === 'right') {
      if (s.above >= ASCENDER_RATIO && s.below < 0.45 && g.closed) return 'd';
      if (s.below >= DESCENDER_RATIO && s.above < 0.45 && g.closed) return 'q';
      if (s.above < 0.75 && s.below < 0.50 && s.span >= STEM_SPAN && s.below >= -0.10 && s.above >= -0.15) return 'a';
      return null;
    }
    if (s && s.side === 'left') {
      if (s.below >= DESCENDER_RATIO && s.above < 0.45 && g.closed) return 'p';
      return null;
    }
    if (!s && g.closed && g.occupied >= 15 && g.aspect > 0.8 && g.aspect < 1.25) {
      if (g.edge && g.edge.right < 0.55 && g.edge.left < 0.55 && Math.abs(g.edge.right - g.edge.left) < 0.18) return 'o';
    }
    return null;
  }

  var STICK_FAMILY = { i: 1, l: 1, j: 1 };
  var BOWL_FAMILY = { a: 1, o: 1, d: 1, p: 1, q: 1, b: 1, g: 1 };
  var W_FAMILY = { w: 1, v: 1, u: 1, m: 1, n: 1 };
  var Y_FAMILY = { y: 1, v: 1, u: 1, g: 1, q: 1, j: 1, x: 1 };

  /* w, m, and y. A bowl or a dot stays with the other checks. */
  function pickFork(g) {
    var p = g.profile;
    if (!p || g.tittle) return null;
    /* closed is a real bowl (o, g, q). A pair of diagonals is not one. */
    if (p.tail >= TAIL_RATIO && p.wideTop && g.aspect >= 0.48 && g.aspect < 1.42 && p.feet <= 2 && !g.closed) return 'y';
    if (p.feet >= 3 && g.aspect >= 1.15 && p.tail < TAIL_RATIO && p.footRise >= 0.18 && p.peak) return 'm';
    if (p.feet === 2 && g.aspect >= WIDE_RATIO && p.tail < TAIL_RATIO && p.footRise >= 0.22 && p.peak && !p.cup) return 'w';
    /* A v is one low point. A gap at that point is still one point, not a w:
       the feet stay near the middle and nothing rises between them. */
    if (p.tail < 0.16 && p.wideTop && !g.closed && !p.peak && !p.cup &&
        g.aspect >= 0.85 && g.aspect < 1.70 && p.feet >= 1 && p.feet <= 2 &&
        p.footSpan <= 0.40 && p.footMid > 0.28 && p.footMid < 0.72) return 'v';
    return null;
  }

  function findRank(ranked, ch) {
    var i;
    for (i = 0; i < ranked.length; i++) if (ranked[i].ch === ch) return i;
    return -1;
  }

  /* Move ch to the front when $P already had it nearby, and separate the
     runner-up so a clear dot or stem is not offered as a toss-up. */
  function prefer(ranked, ch) {
    var idx = findRank(ranked, ch);
    var item;
    var k;
    var need;
    if (idx < 0) return ranked;
    item = ranked[idx];
    if (idx !== 0) {
      if (item.d - ranked[0].d > PAIR_WINDOW) return ranked;
      if (item.d > READABLE_DIST) return ranked;
      ranked.splice(idx, 1);
      ranked.unshift(item);
    }
    for (k = 1; k < ranked.length; k++) {
      need = ranked[0].d + SURE_MARGIN + 0.01;
      if (ranked[k].d < need) ranked[k].d = need + (k - 1) * 0.001;
    }
    ranked.sort(function (a, b) { return a.d - b.d; });
    return ranked;
  }

  function discriminate(ranked, strokes, ctx) {
    var g;
    var stickPick;
    var bowlPick;
    var forkPick;
    if (!ranked.length) return ranked;
    g = geometry(strokes);
    stickPick = pickStick(g, ctx);
    bowlPick = pickBowl(g);
    forkPick = pickFork(g);
    if (stickPick && STICK_FAMILY[ranked[0].ch]) prefer(ranked, stickPick);
    else if (bowlPick && BOWL_FAMILY[ranked[0].ch]) prefer(ranked, bowlPick);
    else if (forkPick === 'y' && Y_FAMILY[ranked[0].ch]) prefer(ranked, forkPick);
    else if ((forkPick === 'w' || forkPick === 'm') && W_FAMILY[ranked[0].ch]) prefer(ranked, forkPick);
    else if (forkPick === 'v' && (Y_FAMILY[ranked[0].ch] || ranked[0].ch === 'w')) prefer(ranked, forkPick);
    return ranked;
  }

  function classify(strokes, ctx) {
    var cloud = prep(strokes);
    var asp = aspectOf(strokes);
    var best = {};
    var t;
    if (!cloud.length) {
      return { ch: '', dist: 1, margin: 0, ranked: [] };
    }
    for (t = 0; t < TEMPLATES.length; t++) {
      var tmpl = TEMPLATES[t];
      var d = greedy(cloud, tmpl.cloud) / (N / 2);
      if (asp > 0 && tmpl.aspect > 0) {
        var logd = Math.abs(Math.log(asp / tmpl.aspect));
        d += ASPECT_W * Math.max(0, logd - ASPECT_DEAD);
      }
      if (best[tmpl.ch] == null || d < best[tmpl.ch]) best[tmpl.ch] = d;
    }
    var ranked = [];
    var key;
    for (key in best) {
      if (Object.prototype.hasOwnProperty.call(best, key)) ranked.push({ ch: key, d: best[key] });
    }
    ranked.sort(function (a, b) { return a.d - b.d; });
    discriminate(ranked, strokes, ctx || null);
    var top = ranked[0];
    var second = ranked[1];
    return {
      ch: top.ch,
      dist: top.d,
      margin: second ? second.d - top.d : 1,
      ranked: ranked.slice(0, 5)
    };
  }

  function wordCue(groups) {
    var hs = [];
    var i;
    var maxH = 0;
    for (i = 0; i < groups.length; i++) {
      var h = groups[i].b.maxY - groups[i].b.minY;
      hs.push(h);
      if (h > maxH) maxH = h;
    }
    var sorted = hs.slice().sort(function (a, b) { return a - b; });
    var median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0;
    return {
      maxH: Math.max(1, maxH),
      contrast: groups.length >= 2 && median > 0 && maxH >= median * HEIGHT_CONTRAST
    };
  }

  function read(strokes) {
    var groups = segment(strokes);
    if (!groups.length) return { text: '', letters: [], reason: 'empty' };
    var all = groups[0].b;
    var i;
    for (i = 1; i < groups.length; i++) all = unionBox(all, groups[i].b);
    var H = all.maxY - all.minY;
    var W = all.maxX - all.minX;
    if (Math.max(H, W) < TINY) return { text: '', letters: [], reason: 'tiny' };
    var cue = wordCue(groups);
    var letters = [];
    for (i = 0; i < groups.length; i++) {
      var h = groups[i].b.maxY - groups[i].b.minY;
      var c = classify(groups[i].strokes, { rel: h / cue.maxH, contrast: cue.contrast });
      c.box = groups[i].b;
      letters.push(c);
    }
    var text = '';
    for (i = 0; i < letters.length; i++) text += letters[i].ch;
    return { text: text, letters: letters, reason: '' };
  }

  function letterUnreadable(letter) {
    if (!letter || !letter.ranked || !letter.ranked.length) return true;
    return !(letter.ranked[0].d <= READABLE_DIST);
  }

  function letterUnsure(letter) {
    var ranked = letter && letter.ranked;
    if (!ranked || ranked.length < 2) return false;
    if (ranked[0].d > READABLE_DIST) return false;
    if (ranked[1].d > READABLE_DIST) return false;
    return (ranked[1].d - ranked[0].d) < ASK_MARGIN;
  }

  function marginOf(letter) {
    var ranked = letter && letter.ranked;
    if (!ranked || ranked.length < 2) return 1;
    return ranked[1].d - ranked[0].d;
  }

  function letterSure(letter) {
    if (!letter || !letter.ranked || !letter.ranked.length) return false;
    if (!(letter.ranked[0].d < SURE_DIST)) return false;
    return marginOf(letter) >= SURE_MARGIN;
  }

  function buildChoices(letters) {
    var chars = [];
    var unsure = [];
    var i;
    letters = letters || [];
    for (i = 0; i < letters.length; i++) {
      var ranked = letters[i].ranked || [];
      chars.push(ranked.length ? ranked[0].ch : (letters[i].ch || ''));
      if (letterUnsure(letters[i])) unsure.push(i);
    }
    var out = [chars.join('')];
    function push(arr) {
      var s = arr.join('');
      if (out.indexOf(s) === -1) out.push(s);
    }
    for (i = 0; i < unsure.length; i++) {
      if (out.length >= CHIP_MAX) break;
      var alt = chars.slice();
      alt[unsure[i]] = letters[unsure[i]].ranked[1].ch;
      push(alt);
    }
    if (unsure.length === 2 && out.length < CHIP_MAX) {
      var both = chars.slice();
      both[unsure[0]] = letters[unsure[0]].ranked[1].ch;
      both[unsure[1]] = letters[unsure[1]].ranked[1].ch;
      push(both);
    }
    return out.slice(0, CHIP_MAX);
  }

  function askPrompt(choices) {
    if (choices.length === 2) return 'Almost — was it ' + choices[0] + ' or ' + choices[1] + '?';
    return PROMPT_MANY;
  }

  function finish(action, reason, choices, reading) {
    var prompt = PROMPT_EMPTY;
    if (action === 'celebrate') prompt = PROMPT_WIN;
    else if (action === 'ask') prompt = askPrompt(choices);
    else if (reason === 'tiny') prompt = PROMPT_TINY;
    else if (reason === 'unreadable') prompt = PROMPT_UNREADABLE;
    else if (reason === 'soft') prompt = PROMPT_SOFT;
    else if (reason === 'mismatch' || reason === 'choice') prompt = PROMPT_MISMATCH;
    else if (reason === 'empty') prompt = PROMPT_EMPTY;
    var miss = action === 'retry' && (reason === 'mismatch' || reason === 'choice');
    return {
      action: action,
      reason: reason,
      choices: choices || [],
      reading: reading || '',
      prompt: prompt,
      miss: miss
    };
  }

  function copyLetter(letter) {
    var ranked = [];
    var src = (letter && letter.ranked) || [];
    var i;
    for (i = 0; i < src.length; i++) ranked.push({ ch: src[i].ch, d: src[i].d });
    return {
      ch: letter.ch,
      dist: letter.dist,
      margin: letter.margin,
      ranked: ranked,
      box: letter.box
    };
  }

  /* Lean toward the demo letter only when the ink already put it close,
     and the reading is neither crisp nor a genuine toss-up. */
  function nudgeLetter(letter, ch) {
    var ranked = letter.ranked;
    var idx;
    var best;
    var hit;
    var gap;
    var old;
    if (!ranked || !ranked.length || !ch) return;
    if (ranked[0].ch === ch) return;
    if (letterSure(letter)) return;
    idx = findRank(ranked, ch);
    if (idx < 0) return;
    best = ranked[0];
    hit = ranked[idx];
    if (hit.d > READABLE_DIST || best.d > READABLE_DIST) return;
    gap = hit.d - best.d;
    if (gap < ASK_MARGIN) return;
    if (gap > PRIOR_REACH) return;
    old = best.d;
    hit.d = old;
    best.d = old + gap;
    ranked.sort(function (a, b) { return a.d - b.d; });
    letter.ch = ranked[0].ch;
    letter.dist = ranked[0].d;
    letter.margin = ranked.length > 1 ? ranked[1].d - ranked[0].d : 1;
  }

  function applyPrior(letters, target) {
    var out = [];
    var i;
    for (i = 0; i < letters.length; i++) {
      var letter = copyLetter(letters[i]);
      if (target && i < target.length) nudgeLetter(letter, target.charAt(i));
      out.push(letter);
    }
    return out;
  }

  /* The demo word joins the chips when every letter that differs is already
     a close, readable candidate. A crisp other letter blocks it. */
  function includeTarget(choices, letters, target) {
    var chars;
    var alt;
    var i;
    var k;
    var changed = false;
    if (!target || !choices.length || target.length !== letters.length) return choices;
    if (choices.indexOf(target) !== -1) return choices;
    chars = choices[0].split('');
    if (chars.length !== target.length) return choices;
    alt = chars.slice();
    for (i = 0; i < letters.length; i++) {
      var ranked;
      var hit = null;
      if (alt[i] === target.charAt(i)) continue;
      ranked = letters[i].ranked || [];
      if (!ranked.length) return choices;
      for (k = 0; k < ranked.length; k++) {
        if (ranked[k].ch === target.charAt(i)) hit = ranked[k];
      }
      if (!hit || !(hit.d <= READABLE_DIST)) return choices;
      if (hit.d - ranked[0].d >= ASK_MARGIN) return choices;
      alt[i] = target.charAt(i);
      changed = true;
    }
    if (!changed) return choices;
    if (choices.indexOf(alt.join('')) === -1 && choices.length < CHIP_MAX) choices.push(alt.join(''));
    return choices;
  }

  function planWrite(readResult, target) {
    var res = readResult || {};
    var letters = res.letters || [];
    target = String(target == null ? '' : target).toLowerCase();
    if (!letters.length) {
      var why = res.reason === 'tiny' ? 'tiny' : 'empty';
      return finish(why === 'tiny' ? 'retry' : 'empty', why, [], '');
    }
    var i;
    for (i = 0; i < letters.length; i++) {
      if (letterUnreadable(letters[i])) return finish('retry', 'unreadable', [], res.text || '');
    }
    letters = applyPrior(letters, target);
    var choices = includeTarget(buildChoices(letters), letters, target);
    var primary = choices[0] || '';
    var sure = true;
    for (i = 0; i < letters.length; i++) {
      if (!letterSure(letters[i])) sure = false;
    }
    if (sure && primary === target) return finish('celebrate', 'clear', [], primary);
    if (choices.length >= 2) return finish('ask', 'ambiguous', choices, primary);
    if (primary === target) return finish('celebrate', 'likely', [], primary);
    if (sure) return finish('retry', 'mismatch', [], primary);
    return finish('retry', 'soft', [], primary);
  }

  function judgeChoice(choice, target) {
    var picked = String(choice == null ? '' : choice).toLowerCase();
    var want = String(target == null ? '' : target).toLowerCase();
    if (picked && picked === want) return finish('celebrate', 'choice', [], picked);
    return finish('retry', 'choice', [], picked);
  }

  var api = {
    N: N,
    SURE_DIST: SURE_DIST,
    SURE_MARGIN: SURE_MARGIN,
    ASK_MARGIN: ASK_MARGIN,
    READABLE_DIST: READABLE_DIST,
    CHIP_MAX: CHIP_MAX,
    GAP_RATIO: GAP_RATIO,
    JOIN_RATIO: JOIN_RATIO,
    HOLE_RATIO: HOLE_RATIO,
    JOIN_CAP: JOIN_CAP,
    SPECK_RATIO: SPECK_RATIO,
    TINY: TINY,
    PAIR_WINDOW: PAIR_WINDOW,
    PRIOR_REACH: PRIOR_REACH,
    ASCENDER_RATIO: ASCENDER_RATIO,
    DESCENDER_RATIO: DESCENDER_RATIO,
    STEM_SPAN: STEM_SPAN,
    HEIGHT_CONTRAST: HEIGHT_CONTRAST,
    SHORT_RATIO: SHORT_RATIO,
    TALL_RATIO: TALL_RATIO,
    TAIL_RATIO: TAIL_RATIO,
    WIDE_RATIO: WIDE_RATIO,
    TEMPLATES: TEMPLATES,
    segment: segment,
    classify: classify,
    read: read,
    buildChoices: buildChoices,
    planWrite: planWrite,
    judgeChoice: judgeChoice,
    letterSure: letterSure,
    letterUnsure: letterUnsure
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WriteInk = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
