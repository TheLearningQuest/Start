/* Voice picking tests. The app is one HTML file (CSP forbids external scripts),
   so the pure module is the marked block in index.html — the same source the page runs. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function loadVoice() {
  const start = html.indexOf('/* NMQ_VOICE_MODULE_START');
  const end = html.indexOf('/* NMQ_VOICE_MODULE_END */');
  assert.ok(start !== -1 && end > start, 'voice module markers missing');
  const context = { module: { exports: {} }, window: {}, console: console };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context, { filename: 'nmq-voice.js' });
  const api = context.module.exports;
  assert.equal(typeof api.pickVoice, 'function');
  return api;
}

const V = loadVoice();

function voice(name, lang, uri, extra) {
  const v = { name: name, lang: lang, voiceURI: uri || name };
  if (extra) Object.keys(extra).forEach(function (k) { v[k] = extra[k]; });
  return v;
}

test('inline scripts all parse', function () {
  const re = /<script>([\s\S]*?)<\/script>/g;
  let match, n = 0;
  while ((match = re.exec(html))) {
    n++;
    new vm.Script(match[1], { filename: 'inline-' + n + '.js' });
  }
  assert.ok(n >= 7, 'expected the voice module plus the existing script blocks');
});

test('base names ignore case, Enhanced/Premium, and Zoe/Zoey', function () {
  assert.equal(V.baseName('Zoey (Enhanced)'), 'zoe');
  assert.equal(V.baseName('ZOE (premium)'), 'zoe');
  assert.equal(V.baseName('Zoe - Enhanced'), 'zoe');
  assert.equal(V.baseName('Samantha'), 'samantha');
  assert.equal(V.baseName(''), '');
});

test('dropdown order is en-US, then other English, then everyone else', function () {
  const sorted = V.sortVoices([
    voice('Thomas', 'fr-FR'),
    voice('Daniel', 'en-GB'),
    voice('Zoe (Enhanced)', 'en-US'),
    voice('Samantha', 'en_US'),
    voice('Amelie', 'fr-CA')
  ]);
  assert.deepEqual(Array.from(sorted, function (v) { return v.name; }), [
    'Samantha', 'Zoe (Enhanced)', 'Daniel', 'Amelie', 'Thomas'
  ]);
});

test('labels show the name, the language, and a visible Enhanced/Premium mark', function () {
  const enhanced = V.labelFor(voice('Zoe (Enhanced)', 'en-US', 'zoe-e'));
  assert.match(enhanced, /Zoe \(Enhanced\)/);
  assert.match(enhanced, /en-US/);
  assert.match(enhanced, /\u2726/);
  assert.equal((enhanced.match(/Enhanced/g) || []).length, 1);

  const premium = V.labelFor(voice('Fred', 'en-GB', 'com.apple.voice.premium.en-GB.Fred'));
  assert.match(premium, /\u2726 Fred \(Premium\)/);
  assert.match(premium, /en-GB/);

  const plain = V.labelFor(voice('Samantha', 'en-US', 'sam'));
  assert.equal(plain.indexOf('\u2726'), -1);
  assert.match(plain, /Samantha · en-US/);
});

test('nothing chosen yet prefers Zoe (Enhanced), including Zoey', function () {
  const list = [
    voice('Samantha', 'en-US', 'sam', { localService: true }),
    voice('Zoe', 'en-US', 'zoe', { localService: true }),
    voice('Zoe (Enhanced)', 'en-US', 'zoe-e', { localService: false }),
    voice('Zoey (Premium)', 'en-GB', 'zoey-p')
  ];
  assert.equal(V.pickVoice(list, null).voiceURI, 'zoe-e');
  assert.equal(V.pickVoice(list, {}).voiceURI, 'zoe-e');
  assert.equal(V.pickVoice(list, { voiceURI: '', voiceName: '' }).voiceURI, 'zoe-e');
  assert.equal(V.pickVoice([
    voice('Samantha (Enhanced)', 'en-US', 'sam-e'),
    voice('Zoey (Enhanced)', 'en-US', 'zoey-e')
  ], null).voiceURI, 'zoey-e');
});

test('an explicit choice wins, matched leniently, and a missing voice falls back', function () {
  const list = [
    voice('Samantha', 'en-US', 'sam'),
    voice('Samantha (Enhanced)', 'en-US', 'sam-e'),
    voice('Alex (Premium)', 'en-US', 'alex-p'),
    voice('Daniel (Enhanced)', 'en-GB', 'dan-e'),
    voice('Thomas', 'fr-FR', 'th'),
    voice('Zoe (Enhanced)', 'en-US', 'zoe-e')
  ];
  assert.equal(V.pickVoice(list, { voiceURI: 'th', voiceName: 'Zoe' }).voiceURI, 'th');
  assert.equal(V.pickVoice(list, { voiceName: 'samantha (enhanced)' }).voiceURI, 'sam-e');
  assert.equal(V.pickVoice(list, { voiceName: 'Zoey (Enhanced)' }).voiceURI, 'zoe-e');
  assert.equal(V.matchSaved(list, { voiceURI: 'missing', voiceName: 'Nope' }), null);
  const fallback = V.pickVoice([
    voice('Samantha', 'en-US', 'sam'),
    voice('Alex (Premium)', 'en-US', 'alex-p'),
    voice('Daniel (Enhanced)', 'en-GB', 'dan-e'),
    voice('Thomas', 'fr-FR', 'th')
  ], { voiceURI: 'gone', voiceName: 'Nope' });
  assert.equal(fallback.voiceURI, 'alex-p');
});

test('empty or broken voice lists do not throw and do not invent a voice', function () {
  assert.equal(V.pickVoice([], null), null);
  assert.equal(V.pickVoice(null, { voiceName: 'Zoe' }), null);
  assert.equal(V.pickVoice([null, undefined, {}], { voiceName: 'Zoey (Enhanced)' }), null);
  assert.doesNotThrow(function () {
    V.sortVoices([null, { name: null, lang: null, voiceURI: 'x' }]);
    V.labelFor({});
    V.pickVoice([{ voiceURI: 'only-uri', lang: 'en-US' }], undefined);
  });
});

test('the page saves voiceURI and voiceName inside the existing settings backup', function () {
  assert.match(html, /voiceURI:\s*'',\s*voiceName:\s*''/);
  assert.match(html, /JSON\.stringify\(S,\s*null,\s*1\)/);
  assert.match(html, /NMQVoice\.pickVoice\(this\.rawVoices\(\),\s*voiceSettings\(\)\)/);
  assert.match(html, /data-rchange="voice-pick"/);
  assert.match(html, /id="rp-voice"/);
  assert.match(html, /data-act="rp-test-voice"/);
  assert.match(html, /voiceschanged/);
  assert.match(html, /armVoicePoll/);
  assert.deepEqual(html.match(/https?:\/\/[^"'\s)]+/g), [
    'http://www.w3.org/2000/svg',
    'http://www.w3.org/2000/svg'
  ]);
});
