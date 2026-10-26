/* Write box: heart words, the offline reader, and the ask-don't-grade rule. */
'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const Words = require('../prototypes/write-box/js/words.js');
const Ink = require('../prototypes/write-box/js/ink.js');
const Samples = require('../prototypes/write-box/js/samples.js');
const Speech = require('../prototypes/write-box/js/speech.js');

const root = path.join(__dirname, '..');
const proto = path.join(root, 'prototypes', 'write-box');
const BOX = { w: 980, h: 480, pad: 28 };

function fake(top, d0, second, d1) {
  return {
    ch: top,
    dist: d0,
    margin: d1 - d0,
    ranked: [{ ch: top, d: d0 }, { ch: second, d: d1 }]
  };
}

function readWord(word, opts) {
  return Ink.read(Samples.wordStrokes(word, BOX, opts));
}

test('demo specs use the bracket heart parts', function () {
  const want = {
    said: ['ai'],
    the: ['e'],
    because: ['au', 'e'],
    was: ['a'],
    they: ['ey'],
    friend: ['ie'],
    come: ['o', 'e'],
    one: ['one']
  };
  assert.deepEqual(Words.DEMO.map(function (w) { return w.w; }), Object.keys(want));
  Words.DEMO.forEach(function (word) {
    assert.deepEqual(Words.heartParts(word), want[word.w]);
    assert.equal(Words.find(word.w).id, word.id);
    assert.equal(Words.find(word.id).spec, word.spec);
    assert.ok(word.sentence.toLowerCase().includes(word.w), word.w);
  });
  const said = Words.find('said');
  assert.equal(said.spec, 's[ai:e]d');
  assert.equal(said.parts[0].sound, 'e');
  assert.equal(said.runs[1].heart, true);
  const because = Words.find('because');
  assert.equal(because.spec, 'bec[au:u]s[e:]');
  assert.equal(because.parts[0].sound, 'u');
  assert.equal(because.parts[1].sound, '');
  assert.equal(because.letters.filter(function (L) { return L.red; }).map(function (L) { return L.ch; }).join(''), 'aue');
  const one = Words.find('one');
  assert.equal(one.parts[0].sound, 'wun');
});

test('a neat demo word is a clear win and not a miss', function () {
  Words.DEMO.forEach(function (word) {
    const read = readWord(word.w);
    const plan = Ink.planWrite(read, word.w);
    assert.equal(read.text, word.w, word.w);
    assert.equal(read.letters.length, word.w.length, word.w);
    assert.equal(plan.action, 'celebrate', word.w);
    assert.equal(plan.reason, 'clear', word.w);
    assert.equal(plan.miss, false, word.w);
    assert.deepEqual(plan.choices, []);
    assert.equal(plan.prompt, 'You wrote it!');
    read.letters.forEach(function (letter, i) {
      assert.equal(letter.ch, word.w.charAt(i));
      assert.ok(letter.dist < Ink.SURE_DIST, word.w + ' ' + letter.ch);
      assert.ok(letter.margin >= Ink.SURE_MARGIN, word.w + ' ' + letter.ch + ' ' + letter.margin);
      assert.equal(Ink.letterSure(letter), true);
    });
  });
});

test('the dot on i and the cross on t stay with their letters', function () {
  const friend = Ink.segment(Samples.wordStrokes('friend', BOX));
  assert.equal(friend.length, 6);
  assert.equal(friend[2].strokes.length, 2);
  const the = Ink.segment(Samples.wordStrokes('the', BOX));
  assert.equal(the.length, 3);
  assert.equal(the[0].strokes.length, 2);
});

test('a short stem on the o in come asks come or came and is not a miss', function () {
  const read = Ink.read(Samples.askStrokes('come', BOX));
  const plan = Ink.planWrite(read, 'come');
  assert.equal(read.letters.length, 4);
  assert.equal(read.letters[1].ch, 'a');
  assert.ok(read.letters[1].margin < Ink.ASK_MARGIN);
  assert.ok(Ink.letterUnsure(read.letters[1]));
  assert.equal(plan.action, 'ask');
  assert.equal(plan.reason, 'ambiguous');
  assert.equal(plan.miss, false);
  assert.deepEqual(plan.choices, ['came', 'come']);
  assert.equal(plan.prompt, 'Did you mean came or come?');
  const meant = Ink.judgeChoice(plan.choices[1], 'come');
  assert.equal(meant.action, 'celebrate');
  assert.equal(meant.reason, 'choice');
  assert.equal(meant.miss, false);
  const other = Ink.judgeChoice(plan.choices[0], 'come');
  assert.equal(other.action, 'retry');
  assert.equal(other.reason, 'choice');
  assert.equal(other.miss, true);
  assert.equal(other.prompt, "Let's try that once more.");
});

test('said with a muddy a asks, and picking said still wins', function () {
  const plan = Ink.planWrite(Ink.read(Samples.askStrokes('said', BOX)), 'said');
  assert.equal(plan.action, 'ask');
  assert.equal(plan.miss, false);
  assert.deepEqual(plan.choices, ['said', 'soid']);
  assert.equal(plan.prompt, 'Did you mean said or soid?');
  assert.equal(Ink.judgeChoice('said', 'said').action, 'celebrate');
  assert.equal(Ink.judgeChoice('said', 'said').miss, false);
  assert.equal(Ink.judgeChoice('soid', 'said').action, 'retry');
});

test('a stem long enough to be a clear a is a gentle mismatch, not a chip', function () {
  const plan = Ink.planWrite(Ink.read(Samples.askStrokes('come', BOX, { stem: 40 })), 'come');
  assert.equal(plan.action, 'retry');
  assert.equal(plan.reason, 'mismatch');
  assert.equal(plan.miss, true);
  assert.deepEqual(plan.choices, []);
  assert.equal(plan.prompt, "Let's try that once more.");
  assert.equal(plan.reading, 'came');
});

test('a crisp other word does not offer the target as a free chip', function () {
  const plan = Ink.planWrite(readWord('the'), 'said');
  assert.equal(plan.action, 'retry');
  assert.equal(plan.reason, 'mismatch');
  assert.equal(plan.miss, true);
  assert.equal(plan.reading, 'the');
  assert.deepEqual(plan.choices, []);
});

test('empty ink and a tiny mark are not misses', function () {
  const empty = Ink.planWrite(Ink.read([]), 'said');
  assert.equal(empty.action, 'empty');
  assert.equal(empty.miss, false);
  assert.equal(empty.prompt, 'Write the word, then tap Submit.');
  const tiny = Ink.planWrite(Ink.read([[{ x: 2, y: 2 }, { x: 5, y: 6 }]]), 'said');
  assert.equal(tiny.action, 'retry');
  assert.equal(tiny.reason, 'tiny');
  assert.equal(tiny.miss, false);
  assert.equal(tiny.prompt, 'Write it a little bigger, then tap Submit.');
});

test('uncertainty rules: ask, likely, soft, and unreadable', function () {
  assert.equal(Ink.SURE_MARGIN, Ink.ASK_MARGIN);
  assert.ok(Ink.SURE_DIST < Ink.READABLE_DIST);
  assert.equal(Ink.CHIP_MAX, 4);

  const crisp = [fake('s', 0.05, 'c', 0.25), fake('a', 0.04, 'o', 0.24), fake('i', 0.05, 'l', 0.22), fake('d', 0.04, 'a', 0.26)];
  const win = Ink.planWrite({ text: 'said', letters: crisp }, 'said');
  assert.equal(win.action, 'celebrate');
  assert.equal(win.reason, 'clear');
  assert.equal(win.miss, false);
  assert.deepEqual(win.choices, []);

  const close = [fake('c', 0.05, 'e', 0.2), fake('o', 0.08, 'a', 0.08 + Ink.ASK_MARGIN - 0.01), fake('m', 0.04, 'n', 0.3), fake('e', 0.04, 'c', 0.3)];
  const ask = Ink.planWrite({ text: 'come', letters: close }, 'come');
  assert.equal(ask.action, 'ask');
  assert.equal(ask.miss, false);
  assert.deepEqual(ask.choices, ['come', 'came']);
  assert.equal(ask.prompt, 'Did you mean come or came?');

  const edge = fake('o', 0.1, 'a', 0.1 + Ink.ASK_MARGIN);
  assert.equal(Ink.letterUnsure(edge), false);
  assert.equal(Ink.letterSure(fake('a', Ink.SURE_DIST - 0.001, 'o', Ink.SURE_DIST - 0.001 + Ink.SURE_MARGIN)), true);
  assert.equal(Ink.letterSure(fake('a', Ink.SURE_DIST, 'o', Ink.SURE_DIST + 0.2)), false);

  const fuzzy = [fake('c', 0.3, 'e', 0.42), fake('o', 0.28, 'a', 0.4), fake('m', 0.3, 'n', 0.42), fake('e', 0.29, 'c', 0.41)];
  const likely = Ink.planWrite({ text: 'come', letters: fuzzy }, 'come');
  assert.equal(likely.action, 'celebrate');
  assert.equal(likely.reason, 'likely');
  assert.equal(likely.miss, false);

  const soft = Ink.planWrite({ text: 'come', letters: fuzzy }, 'said');
  assert.equal(soft.action, 'retry');
  assert.equal(soft.reason, 'soft');
  assert.equal(soft.miss, false);
  assert.deepEqual(soft.choices, []);

  const bad = [fake('c', 0.5, 'e', 0.7), fake('o', 0.1, 'a', 0.3)];
  const unread = Ink.planWrite({ text: 'co', letters: bad }, 'come');
  assert.equal(unread.action, 'retry');
  assert.equal(unread.reason, 'unreadable');
  assert.equal(unread.miss, false);
  assert.equal(unread.prompt, "I couldn't quite read that. Try again.");

  const fork = Ink.planWrite({
    text: 'cat',
    letters: [fake('c', 0.05, 'e', 0.3), fake('a', 0.05, 'o', 0.09), fake('t', 0.04, 'l', 0.3)]
  }, 'said');
  assert.equal(fork.action, 'ask');
  assert.deepEqual(fork.choices, ['cat', 'cot']);
  assert.equal(fork.choices.includes('said'), false);
  assert.equal(fork.miss, false);
});

test('chips swap one unsure letter, and a double swap only when exactly two are unsure', function () {
  const two = [
    fake('c', 0.05, 'e', 0.08),
    fake('o', 0.05, 'a', 0.08),
    fake('m', 0.04, 'n', 0.3),
    fake('e', 0.04, 'c', 0.3)
  ];
  assert.deepEqual(Ink.buildChoices(two), ['come', 'eome', 'came', 'eame']);

  const many = 'friend'.split('').map(function (ch) { return fake(ch, 0.05, 'x', 0.07); });
  const capped = Ink.buildChoices(many);
  assert.equal(capped.length, Ink.CHIP_MAX);
  assert.deepEqual(capped, ['friend', 'xriend', 'fxiend', 'frxend']);

  const three = Ink.planWrite({ text: 'cat', letters: [fake('c', 0.05, 'o', 0.08), fake('a', 0.05, 'u', 0.09), fake('t', 0.05, 'l', 0.08)] }, 'cat');
  assert.equal(three.action, 'ask');
  assert.equal(three.prompt, 'Which word did you write?');
  assert.equal(three.choices.length, 4);
});

test('judgeChoice matches the word she meant, in any case', function () {
  assert.equal(Ink.judgeChoice('Come', 'come').action, 'celebrate');
  assert.equal(Ink.judgeChoice('came', 'come').miss, true);
  assert.equal(Ink.judgeChoice('', 'come').action, 'retry');
});

test('speech picks Zoe and never builds an audio element', function () {
  const zoe = { name: 'Zoe (Enhanced)', lang: 'en-US', voiceURI: 'com.apple.voice.enhanced.en-US.Zoe' };
  const plain = { name: 'Zoe', lang: 'en-GB', voiceURI: 'Zoe' };
  const other = { name: 'Samantha', lang: 'en-US', voiceURI: 'Samantha' };
  assert.equal(Speech.pickReader([other, plain, zoe]), zoe);
  assert.equal(Speech.pickReader([other]), null);
  assert.equal(Speech.baseName('Zoey (Premium)'), 'zoe');
  const calls = [];
  const ok = Speech.speak('said', {
    synth: {
      cancel: function () {},
      speak: function (u) { calls.push(u); },
      paused: false
    },
    Utterance: function (text) { this.text = text; },
    voices: [other, zoe]
  });
  assert.equal(ok, true);
  assert.equal(calls[0].text, 'said');
  assert.equal(calls[0].voice, zoe);
  assert.equal(calls[0].lang, 'en-US');
  assert.equal(Speech.speak('', { synth: {}, Utterance: function () {} }), false);
  const src = fs.readFileSync(path.join(proto, 'js', 'speech.js'), 'utf8');
  assert.equal(src.includes('fetch('), false);
  assert.equal(src.includes('new Audio'), false);
  assert.equal(src.includes('XMLHttpRequest'), false);
});

test('the page is self-contained, ungraded, and kept off the main app', function () {
  const html = fs.readFileSync(path.join(proto, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(proto, 'style.css'), 'utf8');
  const app = fs.readFileSync(path.join(proto, 'js', 'app.js'), 'utf8');
  const ink = fs.readFileSync(path.join(proto, 'js', 'ink.js'), 'utf8');
  const readme = fs.readFileSync(path.join(proto, 'README.md'), 'utf8');
  const rootHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const files = ['index.html', 'style.css', 'js/words.js', 'js/letters.js', 'js/ink.js', 'js/samples.js', 'js/speech.js', 'js/app.js'];

  assert.match(html, /script-src 'self'/);
  assert.match(html, /style-src 'self'/);
  assert.match(html, /font-src 'self'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /media-src 'none'/);
  assert.doesNotMatch(html, /unsafe-inline/);
  assert.doesNotMatch(html, /<style/);
  assert.doesNotMatch(html, /\sstyle="/);
  assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)/);
  assert.match(html, /src="js\/words.js"/);
  assert.match(html, /src="js\/ink.js"/);
  assert.match(html, /src="js\/app.js"/);
  assert.match(html, /href="style.css"/);
  assert.match(css, /fonts\/fredoka-latin\.woff2/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.equal(fs.existsSync(path.join(proto, 'fonts', 'fredoka-latin.woff2')), true);
  assert.equal(fs.existsSync(path.join(proto, 'fonts', 'OFL.txt')), true);

  files.forEach(function (name) {
    const blob = fs.readFileSync(path.join(proto, name), 'utf8');
    assert.equal(/https?:\/\//.test(blob), false, name);
    assert.equal(blob.includes('jumble-spell'), false, name);
    assert.equal(blob.includes('letter-play'), false, name);
    assert.equal(blob.includes('prize-crack'), false, name);
    assert.equal(blob.includes('red-words'), false, name);
    assert.equal(blob.includes('cole/'), false, name);
    assert.equal(blob.includes('localStorage'), false, name);
    assert.equal(blob.includes('indexedDB'), false, name);
    assert.equal(blob.includes('fetch('), false, name);
  });
  assert.doesNotMatch(app, /leitner|streak|score|accuracy|percent|wrong/i);
  assert.doesNotMatch(ink, /leitner|streak|score|accuracy|percent|wrong/i);
  assert.match(html, />Submit</);
  assert.match(ink, /You wrote it!/);
  assert.match(ink, /Let's try that once more/);
  assert.match(ink, /SURE_DIST = 0\.22/);
  assert.match(ink, /ASK_MARGIN = 0\.06/);
  assert.match(ink, /READABLE_DIST = 0\.42/);
  assert.match(ink, /CHIP_MAX = 4/);
  assert.match(ink, /GAP_RATIO = 0\.10/);
  assert.match(readme, /https:\/\/thelearningquest\.github\.io\/Start\/prototypes\/write-box\//);
  assert.match(readme, /s\[ai:e\]d/);
  assert.match(readme, /SURE_DIST/);
  assert.match(readme, /0\.22/);
  assert.match(readme, /ASK_MARGIN/);
  assert.match(readme, /0\.06/);
  assert.match(readme, /READABLE_DIST/);
  assert.match(readme, /0\.42/);
  assert.match(readme, /CHIP_MAX/);
  assert.match(readme, /MUDDY_STEM/);
  assert.match(readme, /`MUDDY_STEM` is \*\*32\*\*/);
  assert.match(readme, /came or come/);
  assert.equal(rootHtml.includes('write-box'), false);
  assert.equal(Samples.MUDDY_STEM, 32);
  assert.equal(Samples.ASK_WORD, 'come');
});
