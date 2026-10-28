/* Live Word Garden lesson: one heart-word list, then the shell route. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const Heart = require('../lesson/words.js');
const flow = require('../prototypes/red-words-shell/js/flow.js');

function loadBlock(startMark, endMark) {
  const start = html.indexOf(startMark);
  const end = html.indexOf(endMark);
  assert.ok(start !== -1 && end > start, startMark);
  const context = { module: { exports: {} }, window: {}, console: console };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context, { filename: startMark + '.js' });
  return context.module.exports;
}

const Garden = loadBlock('/* NMQ_GARDEN_MODULE_START', '/* NMQ_GARDEN_MODULE_END */');

function boundary(sentence, word) {
  const needle = String(word).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-z])' + needle + '([^a-z]|$)', 'i').test(sentence);
}

test('every garden word becomes one heart-letter word', function () {
  const all = Garden.catalog([]);
  assert.equal(all.length, 140);
  all.forEach(function (word) {
    const heart = Heart.fromGarden(word);
    assert.equal(heart.id, word.id);
    assert.equal(heart.w.toLowerCase(), String(word.w).toLowerCase());
    assert.ok(heart.runs.length > 0, word.id);
    assert.ok(boundary(heart.sentence, heart.w), heart.sentence + ' / ' + heart.w);
    assert.ok(heart.color === Heart.COLORS.k || heart.color === Heart.COLORS['1'] || heart.color === Heart.COLORS['2']);
  });
  const said = Heart.fromGarden(Garden.byId('rw-k-said', []));
  assert.deepEqual(said.runs.filter(function (run) { return run.heart; }).map(function (run) { return run.text; }), ['ai']);
  assert.equal(said.grade, 'k');
  assert.equal(said.color, 0xff4d88);
  const friend = Heart.fromGarden(Garden.byId('rw-1-friend', []));
  assert.equal(friend.grade, '1');
  assert.deepEqual(friend.runs.filter(function (run) { return run.heart; }).map(function (run) { return run.text; }), ['ie']);
  const because = Heart.fromGarden(Garden.byId('rw-2-because', []));
  assert.equal(because.grade, '2');
  assert.equal(because.color, 0x3d8bff);
  assert.deepEqual(because.runs.filter(function (run) { return run.heart; }).map(function (run) { return run.text; }), ['au', 'e']);
});

test('the claw keeps a garden pile that is not the eight demo words', function () {
  const and = Heart.fromGarden(Garden.byId('rw-k-and', []));
  const where = Heart.fromGarden(Garden.byId('rw-k-where', []));
  const pile = Heart.orderPile([and, where]);
  const saved = flow.withPile({ v: 1, step: 'claw', jumbleStage: 1, hearts: 4, word: null, pile: pile });
  const back = flow.normalize(JSON.parse(JSON.stringify(saved)));
  assert.equal(back.pile.length, 2);
  assert.equal(back.hearts, 4);
  const grabbed = flow.applyMessage(back, {
    source: flow.SOURCE, step: 'claw', done: true, wordId: 'rw-k-where'
  });
  assert.equal(grabbed.step, 'reveal');
  assert.equal(grabbed.word.w, 'where');
  const framed = flow.framePath(grabbed);
  assert.ok(framed.indexOf('../prize-crack/?shell=1&won=capsule&word=where&grade=k&pack=') === 0);
  const packed = JSON.parse(decodeURIComponent(framed.split('pack=')[1]));
  assert.equal(packed.id, 'rw-k-where');
  assert.ok(packed.runs.some(function (run) { return run.heart && run.text === 'ere'; }));
  const again = flow.anotherWord(grabbed);
  assert.equal(again.step, 'claw');
  assert.equal(again.pile[0].w, pile[0].w);
  assert.equal(flow.framePath(again), '../claw-machine/?shell=1');
});

test('the live page frames the shell and does not carry MyScript secrets', function () {
  assert.match(html, /src="lesson\/words\.js"/);
  assert.match(html, /lesson-frame/);
  assert.match(html, /prototypes\/red-words-shell\/index\.html\?live=1/);
  assert.match(html, /frame-src 'self'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /openLesson\(/);
  assert.equal(html.includes('https://'), false);
  assert.equal(html.includes('applicationKey'), false);
  assert.equal(html.includes('hmacKey'), false);
  assert.equal(html.includes('letter-play'), false);
  assert.equal(html.includes('rw-slots'), false);
  assert.equal(html.includes('rw-tiles'), false);
  const shell = fs.readFileSync(path.join(root, 'prototypes', 'red-words-shell', 'js', 'shell.js'), 'utf8');
  assert.match(shell, /live'\) === '1'/);
  assert.match(shell, /step: 'done'/);
});
