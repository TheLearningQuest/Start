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
  var TIERS = ['common', 'uncommon', 'rare', 'legendary'];
  /* Out of 100. Harder grade years land on rare and legendary more often. */
  var TIER_WEIGHTS = {
    k: [55, 28, 13, 4],
    '1': [40, 32, 20, 8],
    '2': [28, 30, 28, 14]
  };
  var TIER_NAMES = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    legendary: 'Legendary'
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /* A garden word can ride in the saved pile even when it is not one of the eight demo capsules. */
  function usable(item) {
    return !!(item && item.w && item.runs && item.letters);
  }

  function sameId(item, id) {
    if (!item || id == null || id === '') return false;
    var want = String(id).toLowerCase();
    return String(item.id || '').toLowerCase() === want || String(item.w || '').toLowerCase() === want;
  }

  function adopt(id, dataWord, pile) {
    var key = id || (dataWord && (dataWord.id || dataWord.w));
    var found = key ? words.find(key) : null;
    if (found) return found;
    var i, item;
    pile = pile || [];
    for (i = 0; i < pile.length; i++) {
      item = pile[i];
      if (sameId(item, key) && usable(item)) return item;
    }
    if (usable(dataWord) && (!key || sameId(dataWord, key))) return dataWord;
    return null;
  }

  function keepPile(data) {
    var src = data && data.pile;
    if (!src || !src.length) return null;
    var kept = [];
    var i, item, adopted;
    for (i = 0; i < src.length; i++) {
      item = src[i];
      adopted = adopt(item && (item.id || item.w), item, null);
      if (adopted) kept.push(adopted);
    }
    return kept.length ? kept : null;
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
      word: null,
      tier: TIERS.indexOf(data.tier) >= 0 ? data.tier : ''
    };
    var pile = keepPile(data);
    if (pile) session.pile = pile;
    var pool = keepPile({ pile: data.pool });
    if (pool) session.pool = pool;
    if (data.word) {
      var found = adopt(data.word.id || data.word.w, data.word, pile);
      if (found) session.word = found;
    }
    if (session.step !== 'claw' && !session.word) session.word = (pile && pile[0]) || words.pile()[0];
    return session;
  }

  function applyQuery(session, q) {
    q = q || {};
    var next = q.fresh === '1' ? blankSession() : clone(session || blankSession());
    if (q.step && STEPS.indexOf(q.step) >= 0) next.step = q.step;
    if (q.stage === '2' || q.stage === 2) next.jumbleStage = 2;
    if (q.word) {
      var found = words.find(q.word) || adopt(q.word, null, next.pile);
      if (found) next.word = found;
    }
    if (q.tier && TIERS.indexOf(q.tier) >= 0) next.tier = q.tier;
    if (next.step !== 'claw' && !next.word) next.word = (next.pile && next.pile[0]) || words.pile()[0];
    return next;
  }

  function withPile(session) {
    var copy = clone(session || blankSession());
    if (!copy.pile || !copy.pile.length) copy.pile = words.pile();
    if (!copy.pool || !copy.pool.length) copy.pool = copy.pile.slice();
    copy.v = 1;
    return copy;
  }

  function applyMessage(session, msg) {
    var next = clone(session || blankSession());
    if (!msg || msg.source !== SOURCE) return next;
    if (msg.step === 'claw' && next.step === 'claw' && msg.done) {
      next.word = adopt(msg.wordId, null, next.pile) || words.pile()[0];
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

  function rollTier(grade, rng) {
    var weights = TIER_WEIGHTS[grade] || TIER_WEIGHTS.k;
    var sample = typeof rng === 'function' ? rng() : Math.random();
    if (!(sample >= 0)) sample = 0;
    var roll = sample * 100;
    if (roll >= 100) roll = 99.999;
    var acc = 0;
    var i;
    for (i = 0; i < TIERS.length; i++) {
      acc += weights[i];
      if (roll < acc) return TIERS[i];
    }
    return 'legendary';
  }

  function ensureTier(session, rng) {
    var next = clone(session || blankSession());
    if (TIERS.indexOf(next.tier) >= 0) return next;
    var grade = next.word && next.word.grade;
    next.tier = rollTier(grade, rng);
    return next;
  }

  function tierName(id) {
    return TIER_NAMES[id] || TIER_NAMES.common;
  }

  function tierLine(id) {
    var name = tierName(id);
    if (id === 'legendary') return 'Legendary seed!';
    if (id === 'rare') return 'A rare seed!';
    if (id === 'uncommon') return 'An uncommon seed!';
    return 'A common seed!';
  }

  function hatchScript(tier) {
    var land = TIERS.indexOf(tier);
    if (land < 0) land = 0;
    var steps = [];
    var i;
  for (i = 0; i < TIERS.length; i++) steps.push({ tier: TIERS[i], ms: 320 + i * 80 });
  var cursor = TIERS.length - 1;
  var delay = 420;
    var hops = 0;
    while (hops < 6 && (cursor !== land || hops < 2)) {
      if (cursor > land) cursor -= 1;
      else if (cursor < land) cursor += 1;
      steps.push({ tier: TIERS[cursor], ms: delay });
      delay += 80;
      hops += 1;
    }
    steps.push({ tier: TIERS[land], hold: true });
    return steps;
  }

  function createHatch(tier, opts) {
    var script = hatchScript(tier);
    var state = {
      tier: TIERS.indexOf(tier) >= 0 ? tier : 'common',
      script: script,
      index: 0,
      elapsed: 0,
      shown: script[0].tier,
      done: false,
      reduced: !!(opts && opts.reduced)
    };
    if (state.reduced) {
      state.done = true;
      state.shown = state.tier;
      state.index = script.length - 1;
    }
    return state;
  }

  function hatchStep(state, dt) {
    if (!state || state.done) return state;
    var ms = (dt > 0 ? dt : 0) * 1000;
    if (ms > 50) ms = 50;
    state.elapsed += ms;
    var step = state.script[state.index];
    while (step && !step.hold && state.elapsed >= step.ms) {
      state.elapsed -= step.ms;
      state.index += 1;
      step = state.script[state.index];
      if (step) state.shown = step.tier;
    }
    if (!step || step.hold) {
      state.done = true;
      state.shown = state.tier;
    }
    return state;
  }

  function finishSeed(session) {
    var next = clone(session || blankSession());
    if (next.step !== 'seed') return next;
    next.step = 'done';
    next.hearts = (next.hearts || 0) + 1;
    if (TIERS.indexOf(next.tier) < 0) next.tier = 'common';
    return next;
  }

  function shuffle(list, rng) {
    var out = (list || []).slice();
    var random = typeof rng === 'function' ? rng : Math.random;
    var i, j, sample, tmp;
    for (i = out.length - 1; i > 0; i--) {
      sample = random();
      if (!(sample >= 0) || sample >= 1) sample = 0;
      j = Math.floor(sample * (i + 1));
      tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function sameWord(item, word) {
    if (!item || !word) return false;
    if (word.id && sameId(item, word.id)) return true;
    if (word.w && sameId(item, word.w)) return true;
    return false;
  }

  /* Drop the word she just finished. Shuffle whatever is left.
     When that pile is empty, the original pool comes back, shuffled,
     so a word waits until every capsule in the pool has been won. */
  function anotherWord(session, rng) {
    var hearts = session && session.hearts > 0 ? session.hearts : 0;
    var source = session && session.pile && session.pile.length ? session.pile : words.pile();
    var pool = session && session.pool && session.pool.length ? session.pool : source;
    var won = session && session.word;
    var left = [];
    var i;
    for (i = 0; i < source.length; i++) {
      if (!sameWord(source[i], won)) left.push(source[i]);
    }
    if (!left.length) left = pool.slice();
    return {
      v: 1,
      step: 'claw',
      jumbleStage: 1,
      hearts: hearts,
      word: null,
      pile: shuffle(left, rng),
      pool: pool.slice()
    };
  }

  /* Every claw visit reshuffles the capsules already in the machine. */
  function shuffleClaw(session, rng) {
    var next = clone(session || blankSession());
    if (!next.pile || !next.pile.length) next.pile = words.pile();
    if (!next.pool || !next.pool.length) next.pool = next.pile.slice();
    if (next.step === 'claw') next.pile = shuffle(next.pile, rng);
    return next;
  }

  function packQuery(word) {
    if (!word || !word.w) return '';
    try { return '&pack=' + encodeURIComponent(JSON.stringify(word)); }
    catch (err) { return ''; }
  }

  function framePath(session) {
    var word = session && session.word;
    var spelling = word && word.w ? encodeURIComponent(word.w) : '';
    var grade = word && word.grade ? encodeURIComponent(String(word.grade)) : '';
    var pack = packQuery(word);
    var step = session && session.step;
    if (step === 'reveal') return '../prize-crack/?shell=1&won=capsule&word=' + spelling + '&grade=' + grade + pack;
    if (step === 'jumble') {
      var stage = session.jumbleStage === 2 ? '2' : '1';
      return '../jumble-spell/?shell=1&word=' + spelling + '&stage=' + stage + pack;
    }
    if (step === 'write') return '../write-box-myscript/?shell=1&word=' + spelling + pack;
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
    TIERS: TIERS,
    blankSession: blankSession,
    normalize: normalize,
    applyQuery: applyQuery,
    withPile: withPile,
    applyMessage: applyMessage,
    rollTier: rollTier,
    ensureTier: ensureTier,
    tierName: tierName,
    tierLine: tierLine,
    createHatch: createHatch,
    hatchStep: hatchStep,
    finishSeed: finishSeed,
    anotherWord: anotherWord,
    shuffleClaw: shuffleClaw,
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
