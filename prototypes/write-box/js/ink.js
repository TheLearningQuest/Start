/* Offline print reader for one written word.

   Strokes stay on the device. Nothing is fetched.
   Letters are matched with $P (Vatavu, Anthony, and Wobbrock, 2012):
   resample each stroke to a point cloud, scale it into a box,
   and greedily match it to hand-made print templates in letters.js.
   Stroke order and direction do not matter.

   Uncertainty, so a close call does not become a miss:
   - SURE_DIST (0.22): a letter is crisp when its best distance is under this.
   - SURE_MARGIN (0.06): and the runner-up is at least this much worse.
   - ASK_MARGIN (0.06): a runner-up inside this gap becomes a choice chip.
     Same number as SURE_MARGIN, so any close second means "ask", not "grade".
   - READABLE_DIST (0.42): a best distance above this is not a letter.
   - CHIP_MAX (4): at most four chips.

   Chips are the best spelling, then one chip per unsure letter with that
   letter swapped to its runner-up (left to right). When exactly two letters
   are unsure, one more chip swaps both, if there is room.
   The target word is not pasted in. A chip appears only if the ink produced it.

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
  /* A speck is ink much smaller than the whole word. Dots on i and j stay. */
  var SPECK_RATIO = 0.045;
  var TINY = 18;
  var SHEAR = 0.12;

  var PROMPT_EMPTY = 'Write the word, then tap Submit.';
  var PROMPT_TINY = 'Write it a little bigger, then tap Submit.';
  var PROMPT_UNREADABLE = "I couldn't quite read that. Try again.";
  var PROMPT_MISMATCH = "Let's try that once more.";
  var PROMPT_WIN = 'You wrote it!';
  var PROMPT_MANY = 'Which word did you write?';

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
    var base = Letters.get(ch);
    var variants = [base, shear(base, SHEAR), shear(base, -SHEAR)];
    var v;
    for (v = 0; v < variants.length; v++) {
      TEMPLATES.push({
        ch: ch,
        cloud: prep(variants[v]),
        aspect: aspectOf(variants[v])
      });
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

  function shouldMerge(a, b, H) {
    return xGap(a, b) < GAP_RATIO * H;
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
        if (diagOf(items[i].b) >= SPECK_RATIO * H) big.push(items[i]);
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
          if (!shouldMerge(items[i].b, items[j].b, H)) continue;
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

  function classify(strokes) {
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
    var top = ranked[0];
    var second = ranked[1];
    var margin = second ? second.d - top.d : 1;
    return {
      ch: top.ch,
      dist: top.d,
      margin: margin,
      ranked: ranked.slice(0, 3)
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
    var letters = [];
    for (i = 0; i < groups.length; i++) {
      var c = classify(groups[i].strokes);
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
    if (choices.length === 2) return 'Did you mean ' + choices[0] + ' or ' + choices[1] + '?';
    return PROMPT_MANY;
  }

  function finish(action, reason, choices, reading) {
    var prompt = PROMPT_EMPTY;
    if (action === 'celebrate') prompt = PROMPT_WIN;
    else if (action === 'ask') prompt = askPrompt(choices);
    else if (reason === 'tiny') prompt = PROMPT_TINY;
    else if (reason === 'unreadable') prompt = PROMPT_UNREADABLE;
    else if (reason === 'mismatch' || reason === 'choice' || reason === 'soft') prompt = PROMPT_MISMATCH;
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
    var choices = buildChoices(letters);
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
    SPECK_RATIO: SPECK_RATIO,
    TINY: TINY,
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
