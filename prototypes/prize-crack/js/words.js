/* Heart-word specs for the prize reveal. No DOM and no network.

   Plain letters are written as themselves.
   Irregular letters sit in [brackets]. One bracket is one heart part.
   Inside a bracket, ":sound" is how that part is spoken
   (s[ai:e]d is said, and ai says e).
   An empty sound ([e:]) means those letters are silent. */
(function (root) {
  'use strict';

  var ROWS = [
    { id: 'rw-k-said', spec: 's[ai:e]d', sentence: 'Mom said, "Time for bed!"' },
    { id: 'rw-k-the', spec: 'th[e:u]', sentence: 'The cat naps on the mat.' },
    { id: 'rw-2-because', spec: 'bec[au:u]s[e:]', sentence: 'I smile because I am happy.' },
    { id: 'rw-k-was', spec: 'w[a:u]s', sentence: 'The puppy was so fluffy.' },
    { id: 'rw-k-they', spec: 'th[ey:ay]', sentence: 'They play in the park.' },
    { id: 'rw-1-friend', spec: 'fr[ie:e]nd', sentence: 'My friend draws unicorns.' },
    { id: 'rw-k-come', spec: 'c[o:u]m[e:]', sentence: 'Come and see my drawing!' },
    { id: 'rw-k-one', spec: '[one:wun]', sentence: 'I have one pet bunny.' }
  ];

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

  function soundsLike(word) {
    var out = '';
    var i;
    for (i = 0; i < word.letters.length; i++) {
      var L = word.letters[i];
      if (!L.red) { out += L.ch; continue; }
      var part = word.parts[L.part];
      if (i === part.start) out += part.sound == null ? part.text : part.sound;
    }
    return out;
  }

  function heartParts(word) {
    var out = [];
    var i;
    for (i = 0; i < word.runs.length; i++) if (word.runs[i].heart) out.push(word.runs[i].text);
    return out;
  }

  function build(row) {
    var parsed = parseSpec(row.spec);
    return {
      id: row.id,
      w: parsed.w,
      spec: row.spec,
      sentence: row.sentence,
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

  /* Whole-word match. -1 when the spelling is not its own word in the sentence. */
  function wordAt(sentence, spelling) {
    var raw = String(sentence || '');
    var needle = String(spelling || '');
    if (!raw || !needle) return -1;
    var lower = raw.toLowerCase();
    var want = needle.toLowerCase();
    var from = 0;
    var at;
    while (from <= lower.length) {
      at = lower.indexOf(want, from);
      if (at < 0) return -1;
      var before = at === 0 || !/[a-z]/i.test(raw.charAt(at - 1));
      var after = at + want.length >= raw.length || !/[a-z]/i.test(raw.charAt(at + want.length));
      if (before && after) return at;
      from = at + 1;
    }
    return -1;
  }

  function leadsSentence(sentence, spelling) {
    var at = wordAt(sentence, spelling);
    if (at < 0) return false;
    return !/[a-z]/i.test(String(sentence || '').slice(0, at));
  }

  function capitalLead(text) {
    text = String(text || '');
    if (!text) return text;
    var upper = text.charAt(0).toUpperCase();
    if (upper === text.charAt(0)) return text;
    return upper + text.slice(1);
  }

  /* The sentence she hears and reads. A word that opens it keeps a capital. */
  function spokenSentence(sentence, spelling) {
    var raw = String(sentence || '');
    if (!leadsSentence(raw, spelling)) return raw;
    var at = wordAt(raw, spelling);
    var upper = raw.charAt(at).toUpperCase();
    if (upper === raw.charAt(at)) return raw;
    return raw.slice(0, at) + upper + raw.slice(at + 1);
  }

  var api = {
    DEMO: DEMO,
    parseSpec: parseSpec,
    runsFrom: runsFrom,
    soundsLike: soundsLike,
    heartParts: heartParts,
    find: find,
    leadsSentence: leadsSentence,
    capitalLead: capitalLead,
    spokenSentence: spokenSentence
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PrizeWords = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
