/* Lesson route. No DOM.

   The shell saves a session, frames one step, and moves on
   when that step posts { source: 'lesson-shell', step, done }.
   A sideways tear opens the seed pouch after the write step. */
(function (root) {
  'use strict';

  var words = root.RedWordsShell;
  if (!words && typeof require === 'function') words = require('./words.js');

  var SOURCE = 'lesson-shell';
  var STORAGE_KEY = 'red-words-shell.session';
  var STEPS = ['claw', 'reveal', 'jumble', 'write', 'seed', 'done'];
  var TEAR_DONE = 0.82;
  var TEAR_PX = 180;
  var TUG = 1 / 3;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function blankSession() {
    return { v: 1, step: 'claw', jumbleStage: 1, hearts: 0, word: null };
  }

  function normalize(data) {
    if (!data || typeof data !== 'object' || data.v !== 1) return blankSession();
    if (STEPS.indexOf(data.step) < 0) return blankSession();
    var hearts = Number(data.hearts);
    if (!(hearts > 0)) hearts = 0;
    hearts = Math.round(hearts);
    if (hearts > 99) hearts = 99;
    var session = {
      v: 1,
      step: data.step,
      jumbleStage: data.jumbleStage === 2 ? 2 : 1,
      hearts: hearts,
      word: null
    };
    if (data.word) {
      var found = words.find(data.word.id || data.word.w);
      if (found) session.word = found;
    }
    if (session.step !== 'claw' && !session.word) session.word = words.pile()[0];
    return session;
  }

  function applyQuery(session, q) {
    q = q || {};
    var next = q.fresh === '1' ? blankSession() : clone(session || blankSession());
    if (q.step && STEPS.indexOf(q.step) >= 0) next.step = q.step;
    if (q.stage === '2' || q.stage === 2) next.jumbleStage = 2;
    if (q.word) {
      var found = words.find(q.word);
      if (found) next.word = found;
    }
    if (next.step !== 'claw' && !next.word) next.word = words.pile()[0];
    return next;
  }

  function withPile(session) {
    var copy = clone(session || blankSession());
    copy.pile = words.pile();
    copy.v = 1;
    return copy;
  }

  function applyMessage(session, msg) {
    var next = clone(session || blankSession());
    if (!msg || msg.source !== SOURCE) return next;
    if (msg.step === 'claw' && next.step === 'claw' && msg.done) {
      next.word = words.find(msg.wordId) || words.pile()[0];
      next.step = 'reveal';
      next.jumbleStage = 1;
      return next;
    }
    if (msg.step === 'reveal' && next.step === 'reveal' && msg.done && next.word) {
      next.step = 'jumble';
      next.jumbleStage = 1;
      return next;
    }
    if (msg.step === 'jumble' && next.step === 'jumble') {
      if (msg.done) {
        next.jumbleStage = 2;
        next.step = 'write';
        return next;
      }
      if (Number(msg.stage) === 2) next.jumbleStage = 2;
      return next;
    }
    if (msg.step === 'write' && next.step === 'write' && msg.done && next.word) {
      next.step = 'seed';
      return next;
    }
    return next;
  }

  function finishSeed(session) {
    var next = clone(session || blankSession());
    if (next.step !== 'seed') return next;
    next.step = 'done';
    next.hearts = (next.hearts || 0) + 1;
    return next;
  }

  function anotherWord(session) {
    var hearts = session && session.hearts > 0 ? session.hearts : 0;
    return { v: 1, step: 'claw', jumbleStage: 1, hearts: hearts, word: null };
  }

  function framePath(session) {
    var word = session && session.word;
    var spelling = word && word.w ? encodeURIComponent(word.w) : '';
    var grade = word && word.grade ? encodeURIComponent(String(word.grade)) : '';
    var step = session && session.step;
    if (step === 'reveal') return '../prize-crack/?shell=1&won=toy&word=' + spelling + '&grade=' + grade;
    if (step === 'jumble') {
      var stage = session.jumbleStage === 2 ? '2' : '1';
      return '../jumble-spell/?shell=1&word=' + spelling + '&stage=' + stage;
    }
    if (step === 'write') return '../write-box-myscript/?shell=1&word=' + spelling;
    return '../claw-machine/?shell=1';
  }

  function clamp01(v) {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  function createTear(opts) {
    return {
      progress: 0,
      dragging: false,
      pointerX: 0,
      origin: 0,
      springing: false,
      open: false,
      reduced: !!(opts && opts.reduced)
    };
  }

  function markOpen(state) {
    state.open = true;
    state.progress = 1;
    state.dragging = false;
    state.springing = false;
    return state;
  }

  function tearDown(state, x) {
    if (!state || state.open) return state;
    state.dragging = true;
    state.springing = false;
    state.pointerX = x;
    state.origin = state.progress;
    return state;
  }

  function tearMove(state, x) {
    if (!state || !state.dragging || state.open) return state;
    state.progress = clamp01(state.origin + (x - state.pointerX) / TEAR_PX);
    return state;
  }

  function tearUp(state) {
    if (!state || !state.dragging) return state;
    state.dragging = false;
    if (state.progress >= TEAR_DONE) markOpen(state);
    else state.springing = true;
    return state;
  }

  function tearTap(state) {
    if (!state || state.open) return state;
    state.springing = false;
    state.progress = clamp01(state.progress + TUG);
    if (state.progress >= TEAR_DONE) markOpen(state);
    return state;
  }

  function tearStep(state, dt) {
    if (!state || !state.springing || state.dragging || state.open) return state;
    if (state.reduced) {
      state.progress = 0;
      state.springing = false;
      return state;
    }
    var h = dt > 0 ? dt : 0;
    if (h > 0.05) h = 0.05;
    state.progress += (0 - state.progress) * Math.min(1, h * 10);
    if (state.progress < 0.012) {
      state.progress = 0;
      state.springing = false;
    }
    return state;
  }

  var api = {
    SOURCE: SOURCE,
    STORAGE_KEY: STORAGE_KEY,
    STEPS: STEPS,
    TEAR_DONE: TEAR_DONE,
    TEAR_PX: TEAR_PX,
    TUG: TUG,
    blankSession: blankSession,
    normalize: normalize,
    applyQuery: applyQuery,
    withPile: withPile,
    applyMessage: applyMessage,
    finishSeed: finishSeed,
    anotherWord: anotherWord,
    framePath: framePath,
    createTear: createTear,
    tearDown: tearDown,
    tearMove: tearMove,
    tearUp: tearUp,
    tearTap: tearTap,
    tearStep: tearStep
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RedWordsFlow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
