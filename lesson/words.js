/* Shared heart-letter words for the live Word Garden lesson.

   One list. The claw, the capsule, jumble, and the write box all
   read the word this file builds. Grade colors match the lesson shell:
   kindergarten pink, 1st gold, 2nd blue.

   A known bracket spec wins over the garden's tricky-letter indexes.
   Words without a spec grow a spec from those indexes.
   No DOM and no network. */
(function (root) {
  'use strict';

  var COLORS = { k: 0xff4d88, '1': 0xffb020, '2': 0x3d8bff };

  /* Same bracket specs as the lesson prototypes and the heart-word lists. */
  var SPECS = {
    I: 'I',
    a: '[a:]',
    as: 'a[s:z]',
    by: 'b[y:ie]',
    the: 'th[e:u]',
    of: '[o:u][f:v]',
    said: 's[ai:e]d',
    was: 'w[a:u]s',
    to: 't[o:oo]',
    do: 'd[o:oo]',
    you: 'y[ou:oo]',
    your: 'y[our:or]',
    are: 'ar[e:]',
    they: 'th[ey:ay]',
    where: 'wh[ere:air]',
    come: 'c[o:u]m[e:]',
    some: 's[o:u]m[e:]',
    one: '[one:wun]',
    once: '[o:wu]nce',
    from: 'fr[o:u]m',
    have: 'hav[e:]',
    give: 'giv[e:]',
    live: 'liv[e:]',
    love: 'l[o:u]v[e:]',
    who: '[who:hoo]',
    two: 't[wo:oo]',
    put: 'p[u:oo]t',
    push: 'p[u:oo]sh',
    want: 'w[a:o]nt',
    other: '[o:u]ther',
    again: 'ag[ai:e]n',
    could: 'c[oul:oo]d',
    would: 'w[oul:oo]d',
    should: 'sh[oul:oo]d',
    friend: 'fr[ie:e]nd',
    laugh: 'l[augh:af]',
    people: 'p[eo:ee]ple',
    because: 'bec[au:u]s[e:]',
    does: 'd[oe:u]s',
    done: 'd[o:u]n[e:]',
    many: 'm[a:e]ny',
    any: '[a:e]ny',
    water: 'w[a:o]ter',
    word: 'w[or:er]d',
    work: 'w[or:er]k',
    great: 'gr[ea:ay]t',
    only: '[o:oa]nly',
    enough: 'en[ough:uf]',
    though: 'th[ough:oa]',
    thought: 'th[ough:aw]t',
    sure: '[s:sh]ure',
    touch: 't[ou:u]ch',
    through: 'thr[ough:oo]',
    buy: 'b[uy:igh]',
    hour: '[hour:our]',
    heard: 'h[ear:er]d',
    often: '[o:o]ften',
    these: 'th[e:ee]se',
    those: 'th[o:oa]se',
    together: 't[o:oo]gether',
    very: 'v[e:e]ry',
    watch: 'w[a:o]tch',
    world: 'w[or:er]ld',
    "don't": 'd[o:oa]n\'t',
    both: 'b[o:oa]th',
    been: 'b[ee:e]n',
    knew: '[k:n]new',
    know: '[k:n]now',
    their: 'th[eir:air]',
    there: 'th[ere:air]',
    were: 'w[ere:er]',
    why: 'wh[y:ie]',
    what: 'wh[a:u]t',
    says: 's[ay:e]s',
    new: 'n[ew:oo]',
    now: 'n[ow:ou]',
    off: '[o:o]ff'
  };

  var SENTENCES = {
    I: 'I can read.',
    the: 'The cat naps on the mat.',
    of: 'I want a cup of cocoa.',
    said: 'Mom said, "Time for bed!"',
    was: 'The puppy was so fluffy.',
    to: 'We went to the zoo.',
    do: 'What do you want to draw?',
    you: 'I like you a lot!',
    your: 'Is this your kitten?',
    are: 'We are best friends.',
    as: 'We sit as the cat naps.',
    by: 'Sit by the bunny.',
    they: 'They play in the park.',
    where: 'Where is my paintbrush?',
    come: 'Come and see my drawing!',
    some: 'Can I have some milk?',
    one: 'I have one pet bunny.',
    once: 'Once upon a time, there was a bunny.',
    from: 'This card is from me.',
    have: 'I have a pink bike.',
    give: 'Can you give me a hug?',
    live: 'Fish live in the sea.',
    love: 'I love my kitty.',
    who: 'Who ate my cookie?',
    two: 'I have two cats.',
    put: 'Put on your shoes.',
    push: 'Push me on the swing!',
    want: 'I want a puppy!',
    other: 'Pet the other bunny.',
    again: 'Let\'s play again!',
    could: 'I could see the stars.',
    would: 'Would you like a snack?',
    should: 'You should pet the puppy gently.',
    friend: 'My friend draws unicorns.',
    laugh: 'Silly jokes make me laugh.',
    people: 'Lots of people came to the show.',
    because: 'I smile because I am happy.',
    does: 'Does your dog do tricks?',
    done: 'I am done with my picture.',
    many: 'I have many stickers.',
    any: 'Do you have any gum?',
    water: 'Ducks swim in the water.',
    word: 'Spell the word cat.',
    work: 'Dad goes to work.',
    great: 'You did a great job!',
    only: 'I only have a little paint left.',
    enough: 'We have enough paint.',
    though: 'I like rain, though I like sun more.',
    thought: 'I thought about kittens.',
    sure: 'Are you sure?',
    touch: 'Do not touch the wet paint!',
    through: 'The cat ran through the grass.',
    buy: 'Let\'s buy a gift.',
    there: 'There is a frog in the pond.',
    were: 'We were at the beach.',
    what: 'What is your cat\'s name?',
    says: 'The sign says stop.'
  };

  function gradeOf(grade) {
    var g = String(grade || 'k');
    if (g === '1') return '1';
    if (g === '2' || g === '2w') return '2';
    return 'k';
  }

  function gradeColor(grade) {
    return COLORS[gradeOf(grade)] || COLORS.k;
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

  function specFromTricky(spelling, tricky) {
    var set = {};
    var list = tricky || [];
    var n;
    for (n = 0; n < list.length; n++) set[list[n]] = 1;
    var spec = '';
    var open = false;
    var i;
    for (i = 0; i < spelling.length; i++) {
      var heart = !!set[i];
      if (heart && !open) { spec += '['; open = true; }
      if (!heart && open) { spec += ']'; open = false; }
      spec += spelling.charAt(i);
    }
    if (open) spec += ']';
    return spec || spelling;
  }

  function sentenceFor(spelling) {
    var key = spelling === 'I' ? 'I' : String(spelling).toLowerCase();
    if (SENTENCES[key]) return SENTENCES[key];
    if (spelling === 'I') return 'I can read.';
    return 'I can read ' + key + '.';
  }

  function build(row) {
    var parsed = parseSpec(row.spec);
    var grade = gradeOf(row.grade);
    return {
      id: row.id,
      w: parsed.w,
      spec: row.spec,
      sentence: row.sentence,
      grade: grade,
      color: gradeColor(grade),
      letters: parsed.letters,
      parts: parsed.parts,
      runs: runsFrom(parsed)
    };
  }

  function fromGarden(entry) {
    if (!entry || typeof entry.w !== 'string' || !entry.w) return null;
    var spelling = entry.w === 'I' ? 'I' : entry.w;
    var key = spelling === 'I' ? 'I' : String(spelling).toLowerCase();
    var spec = SPECS[key] || specFromTricky(spelling, entry.tricky);
    var word;
    try {
      word = build({
        id: entry.id || ('rw-' + key),
        spec: spec,
        sentence: sentenceFor(spelling),
        grade: entry.grade
      });
    } catch (err) {
      word = build({
        id: entry.id || ('rw-' + key),
        spec: specFromTricky(spelling, []),
        sentence: sentenceFor(spelling),
        grade: entry.grade
      });
    }
    if (word.w.toLowerCase() !== spelling.toLowerCase()) {
      word = build({
        id: entry.id || ('rw-' + key),
        spec: specFromTricky(spelling, entry.tricky),
        sentence: sentenceFor(spelling),
        grade: entry.grade
      });
    }
    return word;
  }

  function orderPile(list) {
    var rest = (list || []).slice();
    var first = [];
    var grades = ['2', 'k', '1'];
    var g, i;
    for (g = 0; g < grades.length; g++) {
      for (i = 0; i < rest.length; i++) {
        if (rest[i] && rest[i].grade === grades[g]) {
          first.push(rest.splice(i, 1)[0]);
          break;
        }
      }
    }
    return first.concat(rest);
  }

  var api = {
    COLORS: COLORS,
    gradeColor: gradeColor,
    parseSpec: parseSpec,
    fromGarden: fromGarden,
    orderPile: orderPile,
    sentenceFor: sentenceFor
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HeartWords = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
