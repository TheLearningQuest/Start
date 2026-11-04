/* MyScript write-box trial: the compare, and that keys stay out of the repo. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const proto = path.join(root, 'prototypes', 'write-box-myscript');
const check = require(path.join(proto, 'js', 'check.js'));
const words = require(path.join(proto, 'js', 'words.js'));

const MISSING = 'Add MyScript keys, then tap Save.';

function memoryStorage() {
  const map = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem: function (k, v) { map[k] = String(v); },
    removeItem: function (k) { delete map[k]; }
  };
}

test('letters ignore case and punctuation', function () {
  assert.equal(check.judge('Said', 'said').match, true);
  assert.equal(check.judge('SAID!', 'said').match, true);
  assert.equal(check.judge('  said. ', 'said').match, true);
  assert.equal(check.judge('They', 'they').match, true);
  assert.equal(check.judge('soid', 'said').match, false);
  assert.equal(check.judge('the said', 'said').match, false);
  assert.equal(check.judge('', 'said').empty, true);
  assert.equal(check.judge('!!!', 'said').empty, true);
  assert.equal(check.judge({ label: 'Was' }, 'was').match, true);
  assert.equal(check.preview('  Hello   there '), 'Hello there');
  assert.equal(check.MISSING_KEYS, MISSING);
});

test('placeholder keys are not treated as real', function () {
  assert.equal(check.keysReady(undefined), false);
  assert.equal(check.keysReady({ applicationKey: '', hmacKey: '' }), false);
  assert.equal(check.keysReady({ applicationKey: 'abc', hmacKey: '' }), false);
  assert.equal(check.keysReady({ applicationKey: 'paste-the-application-key', hmacKey: 'secret' }), false);
  assert.equal(check.keysReady({ applicationKey: 'app-key', hmacKey: 'hmac-key' }), true);
});

test('saved iPad keys win, and the page only keeps a mask', function () {
  const store = memoryStorage();
  const file = { applicationKey: 'file-app-key', hmacKey: 'file-hmac-key' };
  const saved = { applicationKey: 'stored-app-key-1234', hmacKey: 'stored-hmac-key-5678' };
  assert.equal(check.writeStored(store, saved), true);
  assert.equal(check.STORAGE_KEY, 'write-box-myscript.keys');
  const raw = store.getItem(check.STORAGE_KEY);
  assert.equal(JSON.parse(raw).applicationKey, 'stored-app-key-1234');
  assert.deepEqual(check.readStored(store), {
    applicationKey: 'stored-app-key-1234',
    hmacKey: 'stored-hmac-key-5678'
  });
  const chosen = check.chooseKeys(check.readStored(store), file);
  assert.equal(chosen.source, 'storage');
  assert.equal(chosen.applicationKey, 'stored-app-key-1234');
  assert.equal(check.chooseKeys(null, file).source, 'file');
  assert.equal(check.maskKey(saved.applicationKey), '••••1234');
  assert.equal(check.maskKey('short'), '••••');
  assert.equal(check.maskKey(saved.applicationKey).includes('stored-app-key'), false);
  check.clearStored(store);
  assert.equal(store.getItem(check.STORAGE_KEY), null);
  assert.equal(check.readStored(store), null);
  assert.equal(check.chooseKeys(check.readStored(store), file).source, 'file');
  store.setItem(check.STORAGE_KEY, '{not json');
  assert.equal(check.readStored(store), null);
  assert.equal(check.writeStored(store, { applicationKey: '', hmacKey: 'hmac-key' }), false);
});

test('the heart words are the short red-word list', function () {
  assert.deepEqual(words.DEMO.map(function (w) { return w.w; }), [
    'said', 'the', 'because', 'was', 'they', 'friend', 'come', 'one'
  ]);
  assert.equal(words.find('said').w, 'said');
  assert.equal(words.find('rw-k-was').w, 'was');
});

test('the page asks for one text/plain export and keeps keys local', function () {
  const html = fs.readFileSync(path.join(proto, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(proto, 'js', 'app.js'), 'utf8');
  const example = fs.readFileSync(path.join(proto, 'config.example.js'), 'utf8');
  const ignore = fs.readFileSync(path.join(proto, '.gitignore'), 'utf8');
  const readme = fs.readFileSync(path.join(proto, 'README.md'), 'utf8');

  assert.match(html, /id="key-app"/);
  assert.match(html, /id="key-hmac"/);
  assert.match(html, /id="key-save"/);
  assert.match(html, /id="clear-keys"/);
  assert.match(html, /Add MyScript keys/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /connect-src https:\/\/cloud\.myscript\.com wss:\/\/cloud\.myscript\.com/);
  assert.match(html, /style-src 'self' 'unsafe-inline'/);
  assert.match(html, /worker-src 'none'/);
  assert.doesNotMatch(html, /unsafe-eval/);
  assert.match(html, /config\.local\.js/);
  assert.match(html, /vendor\/iink\.min\.js/);

  assert.match(app, /INK_V2/);
  assert.match(app, /exportContent:\s*'DEMAND'/);
  assert.match(app, /mimeTypes:\s*\['text\/plain'\]/);
  assert.match(app, /export\(\['text\/plain'\]\)/);
  assert.match(app, /cloud\.myscript\.com/);
  assert.match(app, /write-box-myscript\.keys|check\.STORAGE_KEY|readStored|writeStored/);
  assert.doesNotMatch(app, /console\.log/);
  assert.doesNotMatch(app, /applicationKey:\s*'[^']+'/);
  assert.doesNotMatch(app, /hmacKey:\s*'[^']+'/);

  assert.match(example, /applicationKey:\s*""/);
  assert.match(example, /hmacKey:\s*""/);
  assert.match(ignore, /config\.local\.js/);
  assert.match(readme, /2,000/);
  assert.match(readme, /developer\.myscript\.com/);
  assert.match(readme, /thelearningquest\.github\.io\/Start\/prototypes\/write-box-myscript/);
  assert.match(readme, /localStorage/);
  assert.match(readme, /write-box-myscript\.keys/);
  assert.match(readme, /Clear keys/);
});

test('after a successful write recognition, Clear does not revoke the win', function () {
  const said = check.judge('Said!', 'said');
  assert.equal(said.match, true);
  const won = check.clearEffect({ phase: said.match ? 'done' : 'retry', won: true });
  assert.equal(won.keepWin, true);
  assert.equal(won.won, true);
  assert.equal(won.phase, 'done');
  assert.equal(won.clearInk, true);
  assert.equal(won.advance, true);

  const fromPhase = check.clearEffect({ phase: 'done' });
  assert.equal(fromPhase.keepWin, true);
  assert.equal(fromPhase.advance, true);
  assert.equal(fromPhase.phase, 'done');

  const miss = check.judge('soid', 'said');
  assert.equal(miss.match, false);
  const retry = check.clearEffect({ phase: 'retry', won: false });
  assert.equal(retry.keepWin, false);
  assert.equal(retry.won, false);
  assert.equal(retry.phase, 'write');
  assert.equal(retry.clearInk, true);
  assert.equal(retry.advance, false);

  const writing = check.clearEffect({ phase: 'write', won: false });
  assert.equal(writing.keepWin, false);
  assert.equal(writing.phase, 'write');
  assert.equal(writing.advance, false);

  const picking = check.clearEffect({ phase: 'pick', won: false });
  assert.equal(picking.phase, 'pick');
  assert.equal(picking.clearInk, false);
  assert.equal(picking.advance, false);

  const app = fs.readFileSync(path.join(proto, 'js', 'app.js'), 'utf8');
  const clearAt = app.indexOf("clearBtn.addEventListener('click'");
  const nextAt = app.indexOf("nextBtn.addEventListener('click'", clearAt);
  const handler = app.slice(clearAt, nextAt);
  assert.match(handler, /check\.clearEffect\(\{\s*phase:\s*phase,\s*won:\s*won\s*\}\)/);
  assert.match(handler, /if \(effect\.keepWin\)/);
  assert.match(handler, /clearCanvas\(\)/);
  assert.equal(handler.includes("setPhase('write')"), false);
  assert.equal(handler.includes('WRITE_HINT') && handler.indexOf('WRITE_HINT') > handler.indexOf('keepWin'), true);
  assert.match(app, /function finished\(\) \{\s*return won \|\| phase === 'done';/);
  assert.match(app, /nextBtn\.hidden = !finished\(\)/);
  assert.match(app, /if \(shell && finished\(\)\)/);
  assert.match(app, /if \(finished\(\)\) return;/);
  assert.match(app, /if \(!current \|\| phase === 'pick' \|\| finished\(\) \|\| busy\) return;/);
});

function classList() {
  const names = {};
  return {
    add: function (name) { names[name] = true; },
    remove: function (name) { delete names[name]; },
    toggle: function (name, on) {
      if (on === undefined) names[name] = !names[name];
      else if (on) names[name] = true;
      else delete names[name];
    }
  };
}

function makeEl() {
  const children = [];
  const listeners = {};
  const node = {
    hidden: false,
    open: false,
    disabled: false,
    textContent: '',
    className: '',
    value: '',
    style: {},
    clientWidth: 800,
    clientHeight: 480,
    children: children,
    classList: classList(),
    setAttribute: function () {},
    removeAttribute: function () {},
    appendChild: function (child) { children.push(child); return child; },
    removeChild: function (child) {
      const at = children.indexOf(child);
      if (at >= 0) children.splice(at, 1);
      return child;
    },
    addEventListener: function (type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    cloneNode: function () { return makeEl(); },
    fire: function (type, ev) {
      (listeners[type] || []).forEach(function (fn) { fn(ev || {}); });
    }
  };
  Object.defineProperty(node, 'firstChild', {
    get: function () { return children[0] || null; }
  });
  return node;
}

function bootWritePage(search, readText) {
  const ids = [
    'pick', 'play', 'word-grid', 'show', 'sentence', 'ink', 'ghost', 'burst', 'cloud', 'hint',
    'key-panel', 'key-summary', 'key-form', 'key-app', 'key-hmac', 'key-error', 'clear-keys',
    'prompt', 'words', 'hear', 'clear', 'next', 'check', 'heart-shape'
  ];
  const els = {};
  ids.forEach(function (id) { els[id] = makeEl(); });
  const attrs = {};
  const body = makeEl();
  body.setAttribute = function (key, value) { attrs[key] = value; };
  body.getAttribute = function (key) { return attrs[key]; };
  const messages = [];
  const strokes = [{}];
  const canvas = {
    model: { strokes: strokes },
    export: function () {
      return Promise.resolve({ 'text/plain': readText });
    },
    clear: function () {
      strokes.splice(0, strokes.length);
      return Promise.resolve();
    },
    resize: function () { return Promise.resolve(); },
    destroy: function () { return Promise.resolve(); }
  };
  const context = {
    console: console,
    Promise: Promise,
    URLSearchParams: URLSearchParams,
    decodeURIComponent: decodeURIComponent,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  context.window = context;
  context.globalThis = context;
  context.parent = {
    postMessage: function (msg) { messages.push(msg); }
  };
  context.location = { search: search, origin: 'https://lesson.test' };
  context.document = {
    body: body,
    getElementById: function (id) { return els[id] || null; },
    createElement: function () { return makeEl(); },
    addEventListener: function (type, fn) { body.addEventListener(type, fn); }
  };
  context.addEventListener = function () {};
  context.matchMedia = function () {
    return { matches: false, addEventListener: function () {} };
  };
  context.localStorage = memoryStorage();
  context.MyScriptWriteConfig = { applicationKey: 'app-key', hmacKey: 'hmac-key' };
  context.iink = {
    Canvas: {
      load: function () { return Promise.resolve(canvas); }
    }
  };
  vm.createContext(context);
  ['js/words.js', 'js/speech.js', 'js/check.js', 'js/app.js'].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(proto, file), 'utf8'), context, { filename: file });
  });
  return { els: els, body: body, canvas: canvas, messages: messages };
}

function flush() {
  return new Promise(function (resolve) { setImmediate(resolve); });
}

test('tapping Clear after a recognized word keeps Next unlocked', async function () {
  const page = bootWritePage('?shell=1&word=said', 'said');
  for (let i = 0; i < 8; i++) await flush();
  assert.equal(page.body.getAttribute('data-phase'), 'write');
  assert.equal(page.els.next.hidden, true);

  page.els.check.fire('click');
  for (let i = 0; i < 8; i++) await flush();
  assert.equal(page.els.hint.textContent, 'You wrote it!');
  assert.equal(page.body.getAttribute('data-phase'), 'done');
  assert.equal(page.els.next.hidden, false);
  assert.equal(page.els.check.hidden, true);
  assert.ok(page.els.burst.children.length > 0);
  const hearts = page.els.burst.children.length;

  page.canvas.model.strokes.push({});
  page.els.clear.fire('click');
  for (let i = 0; i < 4; i++) await flush();
  assert.equal(page.canvas.model.strokes.length, 0);
  assert.equal(page.els.hint.textContent, 'You wrote it!');
  assert.equal(page.body.getAttribute('data-phase'), 'done');
  assert.equal(page.els.next.hidden, false);
  assert.equal(page.els.check.hidden, true);
  assert.equal(page.els.burst.children.length, hearts);

  page.els.ink.fire('pointerdown');
  page.els.check.fire('click');
  assert.equal(page.body.getAttribute('data-phase'), 'done');
  assert.equal(page.els.hint.textContent, 'You wrote it!');
  assert.equal(page.els.next.hidden, false);

  page.els.next.fire('click');
  assert.equal(page.messages.length, 1);
  assert.equal(page.messages[0].source, 'lesson-shell');
  assert.equal(page.messages[0].step, 'write');
  assert.equal(page.messages[0].done, true);
  assert.equal(page.messages[0].wordId, 'rw-k-said');

  const miss = bootWritePage('?shell=1&word=said', 'soid');
  for (let i = 0; i < 8; i++) await flush();
  miss.els.check.fire('click');
  for (let i = 0; i < 8; i++) await flush();
  assert.equal(miss.body.getAttribute('data-phase'), 'retry');
  assert.equal(miss.els.next.hidden, true);
  miss.els.clear.fire('click');
  assert.equal(miss.body.getAttribute('data-phase'), 'write');
  assert.equal(miss.els.hint.textContent, 'Write it in the box, then tap Check.');
  assert.equal(miss.els.next.hidden, true);
  assert.equal(miss.messages.length, 0);
});

test('the offline write box still refuses the network', function () {
  const html = fs.readFileSync(path.join(root, 'prototypes', 'write-box', 'index.html'), 'utf8');
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'self'/);
});
