/* Compare a MyScript text/plain result with the heart word.

   Capitals and punctuation do not count. The target word is not
   sent to the recognizer; this only looks at the text that came back.
   No DOM and no network. */
(function (root) {
  'use strict';

  var MISSING_KEYS = 'Add MyScript keys to config.local.js';

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

  var api = {
    MISSING_KEYS: MISSING_KEYS,
    letters: letters,
    textOf: textOf,
    preview: preview,
    judge: judge,
    keysReady: keysReady
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WriteCheck = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
