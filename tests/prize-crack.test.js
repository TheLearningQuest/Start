/* Prize crack: heart parts, the open, and the speech plan. No browser. */
'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const W = require('../prototypes/prize-crack/js/words.js');
const S = require('../prototypes/prize-crack/js/speech.js');
const O = require('../prototypes/prize-crack/js/open.js');

const root = path.join(__dirname, '..');
const proto = path.join(root, 'prototypes', 'prize-crack');

function frames(state, n) {
  for (let i = 0; i < n; i++) O.step(state, 1 / 60);
}

test('demo heart parts follow the bracket spec', function () {
  assert.deepEqual(W.DEMO.map(function (w) { return w.w; }), [
    'said', 'the', 'because', 'was', 'they', 'friend', 'come', 'one'
  ]);
  assert.deepEqual(W.heartParts(W.find('said')), ['ai']);
  assert.deepEqual(W.heartParts(W.find('the')), ['e']);
  assert.deepEqual(W.heartParts(W.find('because')), ['au', 'e']);
  assert.deepEqual(W.heartParts(W.find('was')), ['a']);
  assert.deepEqual(W.heartParts(W.find('they')), ['ey']);
  assert.deepEqual(W.heartParts(W.find('friend')), ['ie']);
  assert.deepEqual(W.heartParts(W.find('come')), ['o', 'e']);
  assert.deepEqual(W.heartParts(W.find('one')), ['one']);

  const because = W.find('because');
  assert.deepEqual(because.letters.map(function (l) { return l.ch; }), ['b', 'e', 'c', 'a', 'u', 's', 'e']);
  assert.deepEqual(because.letters.map(function (l) { return l.red; }), [false, false, false, true, true, false, true]);
  assert.equal(because.parts[1].sound, '');
  assert.equal(because.parts[0].sound, 'u');
  assert.deepEqual(because.runs.map(function (r) { return r.text; }), ['bec', 'au', 's', 'e']);

  assert.equal(W.soundsLike(W.find('said')), 'sed');
  assert.equal(W.soundsLike(W.find('the')), 'thu');
  assert.equal(W.soundsLike(W.find('because')), 'becus');
  assert.equal(W.soundsLike(W.find('one')), 'wun');
  assert.equal(W.soundsLike(W.find('come')), 'cum');

  W.DEMO.forEach(function (word) {
    assert.ok(word.sentence.toLowerCase().includes(word.w), word.w);
    assert.ok(word.parts.length >= 1);
  });

  assert.deepEqual(W.heartParts({ runs: W.runsFrom(W.parseSpec('cat')) }), []);
  assert.throws(function () { W.parseSpec('s[ai:e'); }, /bad spec/);
});

test('an empty clip list speaks, and a listed file is a clip', function () {
  assert.equal(S.CLIPS.length, 0);
  assert.equal(S.clipPath('rw-k-said'), 'audio/words/rw-k-said.m4a');
  assert.equal(S.clipPath('RW-K-THE'), 'audio/words/rw-k-the.m4a');
  const missing = S.plan('audio/words/rw-k-said.m4a');
  assert.equal(missing.mode, 'speech');
  assert.equal(missing.src, '');
  assert.equal(S.plan('').mode, 'speech');
  const listed = ['audio/words/rw-k-said.m4a'];
  const hit = S.plan('audio/words/rw-k-said.m4a', listed);
  assert.equal(hit.mode, 'clip');
  assert.equal(hit.src, 'audio/words/rw-k-said.m4a');
  assert.equal(S.plan('audio/words/rw-k-the.m4a', listed).mode, 'speech');
  assert.equal(S.CLIPS.length, 0);
});

test('Zoe is used when she is installed, otherwise the iPad default', function () {
  assert.equal(S.baseName('Zoey (Enhanced)'), 'zoe');
  assert.equal(S.baseName('Zoe Premium'), 'zoe');
  const zoe = S.pickReader([
    { name: 'Samantha', lang: 'en-US' },
    { name: 'Zoe', lang: 'en-US' }
  ]);
  assert.equal(zoe.name, 'Zoe');
  const best = S.pickReader([
    { name: 'Zoe', lang: 'en-GB' },
    { name: 'Zoey (Enhanced)', lang: 'en-US', voiceURI: 'com.apple.zoey.enhanced' }
  ]);
  assert.equal(best.name, 'Zoey (Enhanced)');
  assert.equal(S.pickReader([{ name: 'Samantha', lang: 'en-US' }]), null);
  assert.equal(S.pickReader([]), null);

  function Utter(text) { this.text = text; }
  const log = [];
  const synth = {
    cancel: function () { log.push('cancel'); },
    speak: function (u) { log.push(u); },
    paused: true,
    resume: function () { log.push('resume'); }
  };
  assert.equal(S.speak('said', {
    synth: synth,
    Utterance: Utter,
    voices: [{ name: 'Samantha', lang: 'en-US' }],
    rate: 0.85
  }), true);
  assert.equal(log[0], 'cancel');
  assert.equal(log[1].text, 'said');
  assert.equal(log[1].voice, undefined);
  assert.equal(log[1].lang, 'en-US');
  assert.equal(log[1].rate, 0.85);
  assert.equal(log[2], 'resume');

  S.speak('the', {
    synth: synth,
    Utterance: Utter,
    voices: [{ name: 'Zoe', lang: 'en-US', voiceURI: 'zoe' }]
  });
  assert.equal(log[4].voice.name, 'Zoe');
  assert.equal(log[4].lang, 'en-US');
  assert.equal(S.speak('', { synth: synth, Utterance: Utter }), false);
  assert.equal(S.speak('hi', {}), false);
});

test('playClip asks the plan before it builds an audio element', async function () {
  const speech = fs.readFileSync(path.join(proto, 'js', 'speech.js'), 'utf8');
  const body = speech.slice(speech.indexOf('function playClip'), speech.indexOf('var api'));
  assert.ok(body.indexOf('plan(') < body.indexOf('new AudioCtor'));
  assert.equal(body.includes('new Audio('), false);

  let built = 0;
  let spoken = '';
  function Utter(text) { this.text = text; }
  const synth = {
    cancel: function () {},
    speak: function (u) { spoken = u.text; }
  };
  const missing = S.playClip('audio/words/rw-k-said.m4a', 'said', {
    Audio: function () { built += 1; },
    synth: synth,
    Utterance: Utter,
    voices: []
  });
  assert.equal(built, 0);
  assert.equal(missing.mode, 'speech');
  assert.equal(spoken, 'said');

  spoken = '';
  let audio = null;
  function OkAudio() {
    audio = this;
    this.play = function () { return Promise.resolve(); };
    this.addEventListener = function () {};
  }
  const played = S.playClip('audio/words/rw-k-said.m4a', 'said', {
    clips: ['audio/words/rw-k-said.m4a'],
    Audio: OkAudio,
    synth: synth,
    Utterance: Utter,
    voices: []
  });
  assert.equal(played.mode, 'clip');
  assert.equal(audio.src, 'audio/words/rw-k-said.m4a');
  await Promise.resolve();
  assert.equal(spoken, '');

  function BadAudio() {
    this.play = function () { return Promise.reject(new Error('blocked')); };
    this.addEventListener = function () {};
  }
  S.playClip('audio/words/rw-k-the.m4a', 'the', {
    clips: ['audio/words/rw-k-the.m4a'],
    Audio: BadAudio,
    synth: synth,
    Utterance: Utter,
    voices: []
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(spoken, 'the');

  spoken = '';
  const noCtor = S.playClip('audio/words/rw-k-the.m4a', 'the', {
    clips: ['audio/words/rw-k-the.m4a'],
    synth: synth,
    Utterance: Utter,
    voices: []
  });
  assert.equal(noCtor.fallback, true);
  assert.equal(spoken, 'the');
});

test('three taps crack a capsule, a short peel springs shut, a long peel opens', function () {
  const capsule = O.createState({ wordCount: 8, wordIndex: 2 });
  assert.equal(O.hint(capsule), 'Pick the prize you won.');
  O.press(capsule);
  assert.equal(capsule.phase, 'lobby');

  O.win(capsule, 'capsule');
  assert.equal(capsule.phase, 'arrive');
  assert.equal(capsule.wordIndex, 2);
  assert.equal(O.hint(capsule), 'Tap the capsule to crack it.');
  frames(capsule, 20);
  assert.equal(capsule.phase, 'arrive');
  frames(capsule, 30);
  assert.equal(capsule.phase, 'closed');

  O.press(capsule);
  assert.equal(capsule.taps, 1);
  assert.equal(capsule.phase, 'opening');
  assert.equal(O.crackLevel(capsule), 1);
  assert.equal(O.hint(capsule), 'Crack! Tap it again.');
  O.press(capsule);
  assert.equal(capsule.opened, false);
  assert.equal(O.crackLevel(capsule), 2);
  assert.equal(O.hint(capsule), 'One more tap!');
  O.press(capsule);
  assert.equal(capsule.phase, 'revealed');
  assert.equal(capsule.progress, 1);
  assert.equal(O.hint(capsule), 'The tricky letters have a heart.');
  assert.equal(capsule.wordIndex, 2);
  O.press(capsule);
  assert.equal(capsule.taps, 3);

  const early = O.createState({ wordCount: 8 });
  O.win(early, 'capsule');
  O.press(early);
  assert.equal(early.taps, 1);
  frames(early, 60);
  assert.equal(early.phase, 'opening');
  assert.equal(early.taps, 1);

  const calm = O.createState({ wordCount: 8, reduced: true });
  O.win(calm, 'toy');
  frames(calm, 3);
  assert.equal(calm.phase, 'closed');
  O.press(calm);
  assert.equal(O.hint(calm), 'The bow wiggled! Tap it again.');

  const ignored = O.createState({ wordCount: 8, peelPx: 160 });
  O.win(ignored, 'capsule');
  ignored.phase = 'closed';
  O.pointerDown(ignored, 0);
  O.pointerMove(ignored, 200);
  assert.equal(ignored.dragging, false);
  assert.equal(ignored.progress, 0);

  const packet = O.createState({ wordCount: 8, peelPx: 160 });

  O.win(packet, 'packet');
  packet.phase = 'closed';
  O.pointerDown(packet, 10);
  O.pointerMove(packet, 70);
  O.pointerUp(packet);
  assert.equal(packet.phase, 'opening');
  assert.ok(packet.springing);
  assert.ok(packet.progress < O.PEEL_DONE);
  assert.equal(O.hint(packet), 'Peel the seal downward.');
  frames(packet, 90);
  assert.equal(packet.progress, 0);
  assert.equal(packet.phase, 'closed');
  assert.equal(packet.springing, false);

  const snap = O.createState({ wordCount: 8, reduced: true, prize: 'packet' });
  snap.phase = 'closed';
  O.pointerDown(snap, 0);
  O.pointerMove(snap, 40);
  O.pointerUp(snap);
  O.step(snap, 1 / 60);
  assert.equal(snap.progress, 0);
  assert.equal(snap.phase, 'closed');

  const peel = O.createState({ wordCount: 8, peelPx: 160 });
  O.win(peel, 'packet');
  peel.phase = 'closed';
  O.pointerDown(peel, 0);
  O.pointerMove(peel, -30);
  assert.equal(peel.progress, 0);
  O.pointerMove(peel, 150);
  assert.ok(peel.progress >= O.PEEL_DONE);
  assert.equal(peel.opened, false);
  O.pointerUp(peel);
  assert.equal(peel.phase, 'revealed');

  const tugs = O.createState({ wordCount: 8 });
  O.win(tugs, 'packet');
  tugs.phase = 'closed';
  O.press(tugs);
  O.press(tugs);
  assert.equal(tugs.opened, false);
  assert.ok(Math.abs(tugs.progress - 2 / 3) < 1e-9);
  assert.equal(O.hint(tugs), 'Keep peeling!');
  O.press(tugs);
  assert.equal(tugs.phase, 'revealed');

  const next = O.createState({ wordCount: 8, wordIndex: 7 });
  O.again(next);
  assert.equal(next.phase, 'lobby');
  assert.equal(next.wordIndex, 0);
  assert.equal(next.opened, false);
});

test('a launch link can open on a closed prize, a crack, or a word', function () {
  const words = W.DEMO;
  const closed = O.createState({ wordCount: words.length });
  O.launch(closed, { won: 'capsule', ready: '1', word: 'because' }, words);
  assert.equal(closed.phase, 'closed');
  assert.equal(closed.prize, 'capsule');
  assert.equal(words[closed.wordIndex].w, 'because');

  const mid = O.createState({ wordCount: words.length });
  O.launch(mid, { won: 'capsule', crack: '2', word: 'said' }, words);
  assert.equal(mid.phase, 'opening');
  assert.equal(mid.taps, 2);
  assert.equal(O.crackLevel(mid), 2);
  assert.equal(mid.opened, false);

  const shown = O.createState({ wordCount: words.length });
  O.launch(shown, { won: 'capsule', open: '1', word: 'rw-k-the' }, words);
  assert.equal(shown.phase, 'revealed');
  assert.equal(words[shown.wordIndex].w, 'the');

  const drop = O.createState({ wordCount: words.length });
  O.launch(drop, { won: 'capsule' }, words);
  assert.equal(drop.phase, 'arrive');

  const seeded = O.createState({ wordCount: words.length });
  O.launch(seeded, { won: 'packet', crack: '2' }, words);
  assert.equal(seeded.prize, 'packet');
  assert.equal(seeded.progress, 0.62);
  assert.equal(seeded.phase, 'opening');

  const unknown = O.createState({ wordCount: words.length, wordIndex: 1 });
  O.launch(unknown, { word: 'nope' }, words);
  assert.equal(unknown.phase, 'lobby');
  assert.equal(unknown.wordIndex, 1);

  O.win(unknown, 'nope');
  assert.equal(unknown.prize, 'capsule');
});

test('the page is a self-contained offline prize room', function () {
  const html = fs.readFileSync(path.join(proto, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(proto, 'style.css'), 'utf8');
  const app = fs.readFileSync(path.join(proto, 'js', 'app.js'), 'utf8');
  const words = fs.readFileSync(path.join(proto, 'js', 'words.js'), 'utf8');
  const speech = fs.readFileSync(path.join(proto, 'js', 'speech.js'), 'utf8');
  const open = fs.readFileSync(path.join(proto, 'js', 'open.js'), 'utf8');
  const font = fs.readFileSync(path.join(proto, 'fonts', 'fredoka-latin.woff2'));

  assert.equal(font.slice(0, 4).toString(), 'wOF2');
  assert.ok(font.length > 1000);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /style-src 'self'/);
  assert.match(html, /font-src 'self'/);
  assert.match(html, /media-src 'self'/);
  assert.equal(html.includes('unsafe-inline'), false);
  assert.equal(html.includes('wasm-unsafe-eval'), false);
  assert.match(html, /I won a capsule/);
  assert.match(html, /I won a seed packet/);
  assert.match(html, /I won a toy/);
  assert.match(html, /id="hear"/);
  assert.match(html, /js\/words\.js/);
  assert.match(html, /js\/speech\.js/);
  assert.match(html, /js\/open\.js/);
  assert.match(html, /js\/app\.js/);
  assert.match(css, /font-family: Fredoka/);
  assert.match(css, /fonts\/fredoka-latin\.woff2/);
  assert.match(app, /speechSynthesis/);
  assert.match(app, /voiceschanged/);
  assert.match(app, /new window\.SpeechSynthesisUtterance\(''\)/);
  assert.match(app, /PrizeSpeech\.playClip\(/);
  assert.match(app, /var floor = 28/);
  assert.match(app, /guard < 80 && size > floor && sentenceCrowded\(\)/);
  assert.match(app, /prefers-reduced-motion/);
  assert.equal(app.includes('new Audio'), false);
  assert.match(speech, /var CLIPS = \[\]/);

  [html, css, app, words, speech, open].forEach(function (src) {
    assert.equal(src.includes('https://'), false);
    assert.equal(src.includes('http://'), false);
    assert.equal(src.includes('localStorage'), false);
    assert.equal(src.includes('eval('), false);
    assert.equal(src.includes('new Function'), false);
    assert.equal(src.includes('fetch('), false);
    assert.equal(src.includes('XMLHttpRequest'), false);
    assert.equal(src.includes('WebSocket'), false);
    assert.equal(src.includes('indexedDB'), false);
    assert.equal(src.includes('three.min.js'), false);
    assert.equal(src.includes('../'), false);
  });
});
