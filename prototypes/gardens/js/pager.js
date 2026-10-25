/* Grade-garden pager. No rendering and no network.
   offset is in gardens: 0 kindergarten, 1 first grade, 2 second grade.
   One viewport width of sideways finger travel equals one garden.
   A flick commits even before the midpoint. A slow drag commits at the
   halfway point. Past either end the view stretches and springs back. */
(function (root) {
  'use strict';

  var FLICK = 0.8;

  var GARDENS = [
    { id: 'k', short: 'K', title: 'Kindergarten', line: 'Sunny patch' },
    { id: '1', short: '1st', title: '1st grade', line: 'Tulip pond' },
    { id: '2', short: '2nd', title: '2nd grade', line: 'Sunflower hill' }
  ];

  function clamp(v, a, b) {
    if (v < a) return a;
    if (v > b) return b;
    return v;
  }

  function createState(opts) {
    var start = 0;
    if (opts && typeof opts.index === 'number') start = opts.index;
    start = clamp(start, 0, GARDENS.length - 1);
    return {
      count: GARDENS.length,
      offset: start,
      velocity: 0,
      target: start,
      origin: start,
      dragging: false,
      startX: 0,
      startOffset: start,
      prevLogical: start,
      hasMove: false,
      lastT: 0,
      reduced: !!(opts && opts.reduced),
      width: (opts && opts.width) || 1024,
      arrived: true
    };
  }

  function rubberStretch(over) {
    if (over <= 0) return 0;
    return 0.42 * (1 - 1 / (1 + over * 1.4));
  }

  function rubberOffset(offset, count) {
    var max = count - 1;
    if (offset < 0) return -rubberStretch(-offset);
    if (offset > max) return max + rubberStretch(offset - max);
    return offset;
  }

  function logicalFromDrag(startOffset, startX, x, width) {
    var w = width > 1 ? width : 1;
    return startOffset + (startX - x) / w;
  }

  function settleTarget(offset, velocity, origin, count) {
    var target;
    if (velocity > FLICK) target = Math.max(origin + 1, Math.round(offset));
    else if (velocity < -FLICK) target = Math.min(origin - 1, Math.round(offset));
    else target = Math.round(offset);
    return clamp(target, 0, count - 1);
  }

  function pointerDown(state, x, t) {
    state.dragging = true;
    state.startX = x;
    state.startOffset = state.offset;
    state.origin = clamp(Math.round(state.offset), 0, state.count - 1);
    state.prevLogical = state.offset;
    state.hasMove = false;
    state.lastT = t;
    state.velocity = 0;
    state.arrived = false;
    return state;
  }

  function pointerMove(state, x, t) {
    if (!state.dragging) return state;
    var logical = logicalFromDrag(state.startOffset, state.startX, x, state.width);
    var dt = t - state.lastT;
    if (state.hasMove && dt > 0.001 && dt < 0.12) {
      var inst = (logical - state.prevLogical) / dt;
      state.velocity = state.velocity * 0.45 + inst * 0.55;
    }
    state.prevLogical = logical;
    state.hasMove = true;
    state.lastT = t;
    state.offset = rubberOffset(logical, state.count);
    state.arrived = false;
    return state;
  }

  function pointerUp(state, x, t) {
    if (!state.dragging) return state;
    var logical = state.hasMove ? state.prevLogical : state.startOffset;
    if (!state.hasMove || (t - state.lastT) > 0.09) state.velocity = 0;
    state.target = settleTarget(logical, state.velocity, state.origin, state.count);
    state.dragging = false;
    state.hasMove = false;
    return state;
  }

  function goTo(state, index) {
    state.dragging = false;
    state.hasMove = false;
    state.target = clamp(index, 0, state.count - 1);
    state.origin = state.target;
    state.arrived = state.offset === state.target && state.velocity === 0;
    return state;
  }

  function step(state, dt) {
    if (!state || state.dragging) return state;
    var h = dt;
    if (!(h > 0)) return state;
    if (h > 0.05) h = 0.05;
    var stiff = state.reduced ? 240 : 92;
    var damp = state.reduced ? 34 : 19.4;
    var acc = (state.target - state.offset) * stiff - state.velocity * damp;
    state.velocity += acc * h;
    state.offset += state.velocity * h;
    if (Math.abs(state.target - state.offset) < 0.004 && Math.abs(state.velocity) < 0.08) {
      state.offset = state.target;
      state.velocity = 0;
      state.arrived = true;
    } else {
      state.arrived = false;
    }
    return state;
  }

  function nearest(state) {
    return clamp(Math.round(state.offset), 0, state.count - 1);
  }

  var api = {
    FLICK: FLICK,
    GARDENS: GARDENS,
    createState: createState,
    rubberStretch: rubberStretch,
    rubberOffset: rubberOffset,
    logicalFromDrag: logicalFromDrag,
    settleTarget: settleTarget,
    pointerDown: pointerDown,
    pointerMove: pointerMove,
    pointerUp: pointerUp,
    goTo: goTo,
    step: step,
    nearest: nearest
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GardensPager = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
