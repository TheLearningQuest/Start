/* Says a word with the iPad voice. No audio files and no network.

   Zoe or Zoey is used when that voice is installed.
   Otherwise the utterance leaves voice unset (the iPad default)
   and sets lang to en-US. */
(function (root) {
  'use strict';

  function baseName(name) {
    var s = String(name || '').toLowerCase();
    s = s.replace(/\((?:enhanced|premium)\)/g, ' ');
    s = s.replace(/\b(?:enhanced|premium)\b/g, ' ');
    s = s.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/\bzoey\b/g, 'zoe');
    return s;
  }

  function qualityRank(voice) {
    var blob = String((voice && voice.name) || '') + ' ' + String((voice && voice.voiceURI) || '');
    if (/enhanced/i.test(blob)) return 2;
    if (/premium/i.test(blob)) return 1;
    return 0;
  }

  function langGroup(voice) {
    var lang = String((voice && voice.lang) || '').replace(/_/g, '-').toLowerCase();
    if (lang === 'en-us') return 0;
    if (lang.indexOf('en') === 0) return 1;
    return 2;
  }

  /* null means "do not set utterance.voice". */
  function pickReader(voices) {
    var hits = [];
    var i;
    for (i = 0; i < (voices ? voices.length : 0); i++) {
      var v = voices[i];
      if (v && baseName(v.name) === 'zoe') hits.push(v);
    }
    if (!hits.length) return null;
    hits.sort(function (a, b) {
      var g = langGroup(a) - langGroup(b);
      if (g) return g;
      return qualityRank(b) - qualityRank(a);
    });
    return hits[0];
  }

  function speak(text, io) {
    io = io || {};
    var synth = io.synth;
    if (!synth || !text || !io.Utterance) return false;
    var voice = pickReader(io.voices || []);
    try {
      if (synth.cancel) synth.cancel();
      var u = new io.Utterance(text);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang || 'en-US';
      } else {
        u.lang = 'en-US';
      }
      u.rate = io.rate || 0.86;
      u.pitch = io.pitch == null ? 1.08 : io.pitch;
      synth.speak(u);
      if (synth.paused && synth.resume) {
        try { synth.resume(); } catch (e) { /* iOS sometimes starts paused */ }
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  var api = { baseName: baseName, pickReader: pickReader, speak: speak };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LetterSpeech = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
