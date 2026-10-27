/* Demo heart words for the lesson shell. No DOM and no network.

   Same bracket specs as the other heart-word prototypes.
   grade colors the capsule in the claw: k, 1, or 2.
   This list is not the live app's spaced-repetition deck.
   Every word here is due each time she plays. */
(function (root) {
  'use strict';

  var COLORS = { k: 0xff4d88, '1': 0xffb020, '2': 0x3d8bff };

  /* First three slots are one of each grade so the cabinet shows all three colors. */
  var ROWS = [
    { id: 'rw-2-because', spec: 'bec[au:u]s[e:]', sentence: 'I smile because I am happy.', grade: '2' },
    { id: 'rw-k-said', spec: 's[ai:e]d', sentence: 'Mom said, "Time for bed!"', grade: 'k' },
    { id: 'rw-1-friend', spec: 'fr[ie:e]nd', sentence: 'My friend draws unicorns.', grade: '1' },
    { id: 'rw-k-the', spec: 'th[e:u]', sentence: 'The cat naps on the mat.', grade: 'k' },
    { id: 'rw-k-was', spec: 'w[a:u]s', sentence: 'The puppy was so fluffy.', grade: 'k' },
    { id: 'rw-k-they', spec: 'th[ey:ay]', sentence: 'They play in the park.', grade: 'k' },
    { id: 'rw-k-come', spec: 'c[o:u]m[e:]', sentence: 'Come and see my drawing!', grade: 'k' },
    { id: 'rw-k-one', spec: '[one:wun]', sentence: 'I have one pet bunny.', grade: 'k' }
  ];

  function gradeColor(grade) {
    return COLORS[String(grade)] || COLORS.k;
  }

  function parseSpec(spec) {
    var letters = [];
    var parts = [];
    var i = 0;
    spec = String(spec || '');
    while (i < spec.length) {
      var c = spec.charAt(i);
      if (c === '[') {
        var j = spec.indexOf(']', i);
        if (j < 0) throw new Error('bad spec ' + spec);
        var inner = spec.slice(i + 1, j);
        var k = inner.indexOf(':');
        var txt = k >= 0 ? inner.slice(0, k) : inner;
        var snd = k >= 0 ? inner.slice(k + 1) : null;
        var part = { start: letters.length, len: txt.length, text: txt, sound: snd };
        var a;
        for (a = 0; a < txt.length; a++) letters.push({ ch: txt.charAt(a), red: true, part: parts.length });
        parts.push(part);
        i = j + 1;
      } else {
        letters.push({ ch: c, red: false, part: -1 });
        i++;
      }
    }
    var w = '';
    for (i = 0; i < letters.length; i++) w += letters[i].ch;
    return { w: w, letters: letters, parts: parts };
  }

  function runsFrom(parsed) {
    var out = [];
    var letters = parsed.letters;
    var i = 0;
    while (i < letters.length) {
      if (!letters[i].red) {
        var text = '';
        while (i < letters.length && !letters[i].red) {
          text += letters[i].ch;
          i++;
        }
        out.push({ text: text, heart: false, sound: null });
      } else {
        var part = parsed.parts[letters[i].part];
        out.push({ text: part.text, heart: true, sound: part.sound });
        i += part.len || 1;
      }
    }
    return out;
  }

  function build(row) {
    var parsed = parseSpec(row.spec);
    return {
      id: row.id,
      w: parsed.w,
      spec: row.spec,
      sentence: row.sentence,
      grade: row.grade,
      color: gradeColor(row.grade),
      letters: parsed.letters,
      parts: parsed.parts,
      runs: runsFrom(parsed)
    };
  }

  var DEMO = [];
  var i;
  for (i = 0; i < ROWS.length; i++) DEMO.push(build(ROWS[i]));

  function find(id) {
    var want = String(id || '').toLowerCase();
    var n;
    for (n = 0; n < DEMO.length; n++) {
      if (DEMO[n].id === want || DEMO[n].w === want) return DEMO[n];
    }
    return null;
  }

  function pile() {
    var out = [];
    var n;
    for (n = 0; n < DEMO.length; n++) out.push(DEMO[n]);
    return out;
  }

  var api = {
    COLORS: COLORS,
    DEMO: DEMO,
    gradeColor: gradeColor,
    parseSpec: parseSpec,
    find: find,
    pile: pile
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RedWordsShell = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
