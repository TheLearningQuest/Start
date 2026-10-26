/* Prize opening. No DOM and no network.

   A capsule or a toy opens in three taps.
   A seed packet peels with a downward drag. A short drag springs shut.
   Three taps, or a drag past the line, reveals the word.
   Calm skips the wait on the landing and snaps a short peel shut. */
(function (root) {
  'use strict';

  var PEEL_DONE = 0.82;
  var TUG = 1 / 3;
  var PEEL_PX = 160;

  var PRIZES = {
    capsule: {
      id: 'capsule',
      name: 'Capsule',
      gesture: 'tap',
      taps: 3,
      idleHint: 'Tap the capsule to crack it.',
      againHint: 'Crack! Tap it again.',
      moreHint: 'One more tap!'
    },
    packet: {
      id: 'packet',
      name: 'Seed packet',
      gesture: 'peel',
      taps: 3,
      idleHint: 'Peel the seal downward.',
      againHint: 'Keep peeling!',
      moreHint: 'Keep peeling!'
    },
    toy: {
      id: 'toy',
      name: 'Toy',
      gesture: 'tap',
      taps: 3,
      idleHint: 'Tap the bow to open it.',
      againHint: 'The bow wiggled! Tap it again.',
      moreHint: 'One more tap!'
    }
  };

  function clamp01(v) {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  function createState(opts) {
    opts = opts || {};
    var phases = { lobby: 1, arrive: 1, closed: 1, opening: 1, revealed: 1 };
    var phase = phases[opts.phase] ? opts.phase : 'lobby';
    var prize = PRIZES[opts.prize] ? opts.prize : 'capsule';
    var count = opts.wordCount > 0 ? opts.wordCount : 1;
    var index = opts.wordIndex > 0 ? opts.wordIndex : 0;
    if (index >= count) index = 0;
    var progress = typeof opts.progress === 'number' ? clamp01(opts.progress) : 0;
    if (phase === 'revealed') progress = 1;
    return {
      phase: phase,
      prize: prize,
      wordIndex: index,
      wordCount: count,
      progress: progress,
      taps: opts.taps > 0 ? opts.taps : 0,
      dragging: false,
      dragOrigin: progress,
      pointerY: 0,
      peelPx: opts.peelPx > 0 ? opts.peelPx : PEEL_PX,
      springing: false,
      reduced: !!opts.reduced,
      arriveT: phase === 'arrive' ? 0 : 1,
      opened: phase === 'revealed'
    };
  }

  function win(state, prizeId) {
    if (!PRIZES[prizeId]) prizeId = 'capsule';
    state.prize = prizeId;
    state.phase = 'arrive';
    state.progress = 0;
    state.taps = 0;
    state.dragging = false;
    state.springing = false;
    state.opened = false;
    state.arriveT = 0;
    return state;
  }

  function markRevealed(state) {
    state.phase = 'revealed';
    state.progress = 1;
    state.dragging = false;
    state.springing = false;
    state.opened = true;
    return state;
  }

  function canHandle(state) {
    return state.phase === 'arrive' || state.phase === 'closed' || state.phase === 'opening';
  }

  function press(state) {
    if (!canHandle(state) || state.opened) return state;
    var prize = PRIZES[state.prize];
    state.springing = false;
    state.phase = 'opening';
    if (prize.gesture === 'tap') {
      state.taps += 1;
      state.progress = clamp01(state.taps / prize.taps);
      if (state.taps >= prize.taps) markRevealed(state);
      return state;
    }
    state.progress = clamp01(state.progress + TUG);
    if (state.progress >= PEEL_DONE) markRevealed(state);
    return state;
  }

  function pointerDown(state, y) {
    if (!PRIZES[state.prize] || PRIZES[state.prize].gesture !== 'peel') return state;
    if (!canHandle(state) || state.opened) return state;
    state.dragging = true;
    state.springing = false;
    state.pointerY = y;
    state.dragOrigin = state.progress;
    state.phase = 'opening';
    return state;
  }

  function pointerMove(state, y) {
    if (!state.dragging) return state;
    var delta = (y - state.pointerY) / (state.peelPx || PEEL_PX);
    state.progress = clamp01(state.dragOrigin + delta);
    return state;
  }

  function pointerUp(state) {
    if (!state.dragging) return state;
    state.dragging = false;
    if (state.progress >= PEEL_DONE) markRevealed(state);
    else state.springing = true;
    return state;
  }

  function step(state, dt) {
    var h = dt;
    if (!(h > 0)) return state;
    if (h > 0.05) h = 0.05;
    if (state.phase === 'arrive') {
      state.arriveT += h;
      var need = state.reduced ? 0.02 : 0.7;
      if (state.arriveT >= need) state.phase = 'closed';
    }
    if (state.springing && !state.dragging && state.phase === 'opening') {
      if (state.reduced) {
        state.progress = 0;
        state.springing = false;
        state.phase = 'closed';
      } else {
        state.progress += (0 - state.progress) * Math.min(1, h * 10);
        if (state.progress < 0.012) {
          state.progress = 0;
          state.springing = false;
          state.phase = 'closed';
        }
      }
    }
    return state;
  }

  function again(state) {
    var count = state.wordCount > 0 ? state.wordCount : 1;
    state.wordIndex = (state.wordIndex + 1) % count;
    state.phase = 'lobby';
    state.progress = 0;
    state.taps = 0;
    state.dragging = false;
    state.springing = false;
    state.opened = false;
    state.arriveT = 0;
    return state;
  }

  function crackLevel(state) {
    if (!state || state.opened || state.phase === 'revealed' || state.progress >= 1) return 3;
    var prize = PRIZES[state.prize] || PRIZES.capsule;
    if (prize.gesture === 'tap') {
      var n = state.taps || 0;
      if (n < 0) n = 0;
      if (n > 2) n = 2;
      return n;
    }
    if (state.progress < 0.12) return 0;
    if (state.progress < 0.45) return 1;
    return 2;
  }

  function hint(state) {
    if (!state || state.phase === 'lobby') return 'Pick the prize you won.';
    if (state.phase === 'revealed') return 'The tricky letters have a heart.';
    var prize = PRIZES[state.prize] || PRIZES.capsule;
    if (prize.gesture === 'tap') {
      if (!state.taps) return prize.idleHint;
      if (state.taps === 1) return prize.againHint;
      return prize.moreHint;
    }
    if (state.springing || state.progress < 0.08) return prize.idleHint;
    return 'Keep peeling!';
  }

  function truthy(v) {
    return v === true || v === '1' || v === 1;
  }

  function launch(state, q, words) {
    q = q || {};
    if (truthy(q.calm)) state.reduced = true;
    if (q.word && words && words.length) {
      var want = String(q.word).toLowerCase();
      var i;
      for (i = 0; i < words.length; i++) {
        if (words[i].w === want || String(words[i].id).toLowerCase() === want) {
          state.wordIndex = i;
          break;
        }
      }
    }
    var prize = q.won && PRIZES[q.won] ? q.won : '';
    if (!prize && (truthy(q.open) || q.crack)) prize = state.prize || 'capsule';
    if (!prize) return state;
    win(state, prize);
    if (truthy(q.ready) || q.crack || truthy(q.open)) {
      state.phase = 'closed';
      state.arriveT = 1;
    }
    if (q.crack) {
      var n = parseInt(q.crack, 10);
      if (n > 0) {
        if (n > 2) n = 2;
        var spec = PRIZES[state.prize];
        if (spec.gesture === 'tap') {
          state.taps = n;
          state.progress = n / spec.taps;
          state.phase = 'opening';
          state.opened = false;
        } else {
          state.taps = 0;
          state.progress = n === 1 ? 0.34 : 0.62;
          state.phase = 'opening';
          state.opened = false;
        }
      }
    }
    if (truthy(q.open)) markRevealed(state);
    return state;
  }

  var api = {
    PEEL_DONE: PEEL_DONE,
    TUG: TUG,
    PEEL_PX: PEEL_PX,
    PRIZES: PRIZES,
    createState: createState,
    win: win,
    press: press,
    pointerDown: pointerDown,
    pointerMove: pointerMove,
    pointerUp: pointerUp,
    step: step,
    again: again,
    crackLevel: crackLevel,
    hint: hint,
    launch: launch
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PrizeOpen = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
