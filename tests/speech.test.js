/* Spoken fallback: missing clips must not open the network. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function loadBlock(startMark, endMark) {
  const start = html.indexOf(startMark);
  const end = html.indexOf(endMark);
  assert.ok(start !== -1 && end > start, startMark);
  const context = { module: { exports: {} }, window: {}, console: console };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context, { filename: startMark + '.js' });
  return context.module.exports;
}

const Speech = loadBlock('/* NMQ_SPEECH_MODULE_START', '/* NMQ_SPEECH_MODULE_END */');

test('an empty clip list speaks immediately and a listed file is played', function () {
  assert.equal(Speech.CLIPS.length, 0);
  assert.equal(Speech.clipPath('word', 'rw-k-said'), 'audio/words/rw-k-said.m4a');
  assert.equal(Speech.clipPath('letter', 'A'), 'audio/letters/a.m4a');
  assert.equal(Speech.clipPath('sound', 'pop'), 'audio/sounds/pop.m4a');
  const missing = Speech.plan('audio/words/rw-k-said.m4a');
  assert.equal(missing.mode, 'speech');
  assert.equal(missing.src, '');
  assert.equal(Speech.plan('').mode, 'speech');
  assert.equal(Speech.hasClip('audio/letters/a.m4a'), false);
  const listed = ['audio/words/rw-k-said.m4a'];
  const hit = Speech.plan('audio/words/rw-k-said.m4a', listed);
  assert.equal(hit.mode, 'clip');
  assert.equal(hit.src, 'audio/words/rw-k-said.m4a');
  assert.equal(Speech.plan('audio/letters/a.m4a', listed).mode, 'speech');
  assert.equal(Speech.CLIPS.length, 0);
});

test('the tap handler speaks before it would build an audio element', function () {
  const start = html.indexOf('function playClip');
  const body = html.slice(start, html.indexOf('function sayWord'));
  assert.ok(body.indexOf('NMQSpeech.plan') < body.indexOf('new Audio'));
  assert.match(body, /choice\.mode !== 'clip'/);
  assert.match(body, /p\.catch\(fallback\)/);
  assert.match(html, /new window\.SpeechSynthesisUtterance\(''\)/);
  assert.match(html, /s\.cancel\(\)/);
  assert.match(html, /voiceschanged/);
  assert.match(html, /data-act="rp-test-voice"/);
  assert.match(html, /Can you hear me\?/);
  assert.match(html, /connect-src 'none'/);
});
