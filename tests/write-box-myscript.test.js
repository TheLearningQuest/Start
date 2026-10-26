/* MyScript write-box trial: the compare, and that keys stay out of the repo. */
'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const proto = path.join(root, 'prototypes', 'write-box-myscript');
const check = require(path.join(proto, 'js', 'check.js'));
const words = require(path.join(proto, 'js', 'words.js'));

const MISSING = 'Add MyScript keys to config.local.js';

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

  assert.match(html, /Add MyScript keys to config\.local\.js/);
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
  assert.doesNotMatch(app, /applicationKey:\s*'[^']+'/);
  assert.doesNotMatch(app, /hmacKey:\s*'[^']+'/);

  assert.match(example, /applicationKey:\s*""/);
  assert.match(example, /hmacKey:\s*""/);
  assert.match(ignore, /config\.local\.js/);
  assert.match(readme, /2,000/);
  assert.match(readme, /developer\.myscript\.com/);
  assert.match(readme, /thelearningquest\.github\.io\/Start\/prototypes\/write-box-myscript/);
});

test('the offline write box still refuses the network', function () {
  const html = fs.readFileSync(path.join(root, 'prototypes', 'write-box', 'index.html'), 'utf8');
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'self'/);
});
