/* Compare a MyScript text/plain result with the heart word.

   Capitals and punctuation do not count. The target word is not
   sent to the recognizer; this only looks at the text that came back.
   No DOM and no network. */
(function (root) {
  'use strict';

  var MISSING_KEYS = 'Add MyScript keys, then tap Save.';
  var STORAGE_KEY = 'write-box-myscript.keys';

  function letters(s) {
    return String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  }

  function textOf(raw) {
    if (raw == null) return '';
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && typeof raw.label === 'string') return raw.label;
    return '';
  }

  function preview(raw) {
    var s = textOf(raw).replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.length > 40) return s.slice(0, 39) + '\u2026';
    return s;
  }

  function judge(raw, target) {
    var got = letters(textOf(raw));
    var want = letters(target);
    return {
      got: got,
      want: want,
      empty: got.length === 0,
      match: got.length > 0 && want.length > 0 && got === want
    };
  }

  function keysReady(cfg) {
    var app = cfg && cfg.applicationKey != null ? String(cfg.applicationKey).trim() : '';
    var hmac = cfg && cfg.hmacKey != null ? String(cfg.hmacKey).trim() : '';
    if (!app || !hmac) return false;
    if (/paste|changeme|your[-_ ]?(application|hmac)|todo/i.test(app + ' ' + hmac)) return false;
    return true;
  }

  function pairFrom(cfg) {
    return {
      applicationKey: String(cfg.applicationKey).trim(),
      hmacKey: String(cfg.hmacKey).trim()
    };
  }

  /* Saved keys win over config.local.js when both are present. */
  function chooseKeys(stored, fileCfg) {
    if (keysReady(stored)) {
      var saved = pairFrom(stored);
      saved.source = 'storage';
      return saved;
    }
    if (keysReady(fileCfg)) {
      var file = pairFrom(fileCfg);
      file.source = 'file';
      return file;
    }
    return null;
  }

  function readStored(storage) {
    if (!storage || !storage.getItem) return null;
    var raw;
    try { raw = storage.getItem(STORAGE_KEY); }
    catch (e) { return null; }
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (!keysReady(parsed)) return null;
      return pairFrom(parsed);
    } catch (err) {
      return null;
    }
  }

  function writeStored(storage, cfg) {
    if (!storage || !storage.setItem) throw new Error('no storage');
    if (!keysReady(cfg)) return false;
    var pair = pairFrom(cfg);
    storage.setItem(STORAGE_KEY, JSON.stringify(pair));
    return true;
  }

  function clearStored(storage) {
    if (!storage || !storage.removeItem) return;
    storage.removeItem(STORAGE_KEY);
  }

  /* Last four characters only, and only once the key is long enough. */
  function maskKey(value) {
    var s = String(value || '').trim();
    if (!s) return '';
    if (s.length < 8) return '\u2022\u2022\u2022\u2022';
    return '\u2022\u2022\u2022\u2022' + s.slice(-4);
  }

  var api = {
    MISSING_KEYS: MISSING_KEYS,
    STORAGE_KEY: STORAGE_KEY,
    letters: letters,
    textOf: textOf,
    preview: preview,
    judge: judge,
    keysReady: keysReady,
    chooseKeys: chooseKeys,
    readStored: readStored,
    writeStored: writeStored,
    clearStored: clearStored,
    maskKey: maskKey
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WriteCheck = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
