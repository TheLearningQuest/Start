/* Handwriting timing and confidence. The reader is the marked block in index.html. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function loadInk() {
  const start = html.indexOf('/* NMQ_INK_MODULE_START');
  const end = html.indexOf('/* NMQ_INK_MODULE_END */');
  assert.ok(start !== -1 && end > start, 'ink module markers missing');
  const context = { module: { exports: {} }, console: console };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context, { filename: 'nmq-ink.js' });
  return context.module.exports;
}

const Ink = loadInk();

function digitRead(text, top, second, ok) {
  const ranked = [{ digit: top[0], d: top[1] }];
  if (second) ranked.push({ digit: second[0], d: second[1] });
  return {
    text: String(text),
    ok: ok !== false,
    reason: ok === false ? 'unsure' : '',
    digits: [{ digit: top[0], ranked: ranked }]
  };
}

test('a confident correct read is accepted right away', function () {
  const plan = Ink.planInk(digitRead('8', [8, 0.08], [0, 0.3]), 8, false);
  assert.equal(plan.action, 'accept');
  assert.equal(plan.reason, 'match');
  assert.equal(plan.waitMs, Ink.ACCEPT_NOW_MS);
  assert.ok(plan.waitMs < 200);
  assert.deepEqual(Array.from(plan.choices), []);
});

test('a mismatch waits about a second longer for another stroke', function () {
  const plan = Ink.planInk(digitRead('6', [6, 0.1], [0, 0.28]), 8, false);
  assert.equal(plan.action, 'wait');
  assert.equal(plan.reason, 'mismatch');
  assert.equal(plan.waitMs, Ink.WAIT_MORE_MS);
  assert.ok(plan.waitMs >= Ink.ACCEPT_NOW_MS + 1000);
  const judged = Ink.planInk(digitRead('6', [6, 0.1], [0, 0.28]), 8, true);
  assert.equal(judged.action, 'submit');
  assert.equal(judged.reason, 'mismatch');
});

test('a correct prefix waits for the rest of a multi-digit answer', function () {
  const plan = Ink.planInk(digitRead('1', [1, 0.08], [7, 0.26]), 18, false);
  assert.equal(plan.action, 'wait');
  assert.equal(plan.reason, 'prefix');
  assert.equal(plan.prompt, 'Keep going…');
  assert.equal(plan.waitMs, Ink.WAIT_MORE_MS);
  const judged = Ink.planInk(digitRead('1', [1, 0.08], [7, 0.26]), 18, true);
  assert.equal(judged.action, 'submit');
  assert.equal(judged.reason, 'prefix');
});

test('a close 9 versus 4 asks instead of guessing', function () {
  const shaky = digitRead('9', [9, 0.12], [4, 0.18]);
  const early = Ink.planInk(shaky, 9, false);
  assert.equal(early.action, 'wait');
  assert.equal(early.reason, 'ambiguous');
  const plan = Ink.planInk(shaky, 9, true);
  assert.equal(plan.action, 'ask');
  assert.deepEqual(Array.from(plan.choices), ['9', '4']);
  assert.equal(plan.prompt, 'Did you mean 9 or 4?');
});

test('a close 1 versus 7 asks, and a wide margin does not', function () {
  const close = Ink.planInk(digitRead('1', [1, 0.1], [7, 0.19]), 7, true);
  assert.equal(close.action, 'ask');
  assert.deepEqual(Array.from(close.choices), ['1', '7']);
  assert.equal(close.prompt, 'Did you mean 1 or 7?');

  const sure = Ink.planInk(digitRead('1', [1, 0.08], [7, 0.24]), 1, false);
  assert.equal(sure.action, 'accept');
  const other = Ink.planInk(digitRead('1', [1, 0.08], [7, 0.24]), 3, true);
  assert.equal(other.action, 'submit');
});

test('unreadable ink is a retry and does not become an answer', function () {
  const early = Ink.planInk({ text: '', ok: false, reason: 'tiny', digits: [] }, 4, false);
  assert.equal(early.action, 'ignore');
  const judged = Ink.planInk({ text: '', ok: false, reason: 'tiny', digits: [] }, 4, true);
  assert.equal(judged.action, 'retry');
  const scribble = Ink.planInk({ text: '2', ok: false, reason: 'unsure', digits: [{ digit: 2, ranked: [{ digit: 2, d: 0.5 }, { digit: 3, d: 0.55 }] }] }, 4, true);
  assert.equal(scribble.action, 'retry');
  assert.equal(scribble.reason, 'unsure');
});

test('a saved handwriting sample becomes an extra template', function () {
  const sample = [];
  for (let i = 0; i <= 16; i++) sample.push([20 + i * 4, 30 + (i % 3)]);
  const strokes = [sample.map(function (p) { return { x: p[0], y: p[1] }; })];
  const before = Ink.TEMPLATES.filter(function (t) { return t.personal; }).length;
  Ink.loadPersonal([{ d: 4, s: [sample] }]);
  assert.equal(Ink.TEMPLATES.filter(function (t) { return t.personal; }).length, before + 1);
  const found = Ink.classify(strokes);
  assert.equal(found.digit, 4);
  assert.ok(found.ranked[0].d < found.ranked[1].d);
  Ink.loadPersonal([]);
  assert.equal(Ink.TEMPLATES.filter(function (t) { return t.personal; }).length, 0);
});

test('a plain upright stroke still reads as 1', function () {
  const stroke = [];
  for (let i = 0; i <= 20; i++) stroke.push({ x: 40, y: 10 + i * 7 });
  const read = Ink.read([stroke], 3);
  assert.equal(read.text, '1');
  assert.equal(read.ok, true);
  const plan = Ink.planInk(read, 1, false);
  assert.equal(plan.action, 'accept');
});
