/* Jumble spell. Pick a heart word, watch the letters mix, drag them home.

   This folder does not open the word garden, the claw, the gardens,
   the prize room, letter play, or Cole. Nothing is saved. */
(function () {
  'use strict';

  var words = window.JumbleWords;
  var table = window.JumbleTable;
  var speech = window.JumbleSpeech;

  var pick = document.getElementById('pick');
  var grid = document.getElementById('word-grid');
  var board = document.getElementById('board');
  var slotsEl = document.getElementById('slots');
  var cardsEl = document.getElementById('cards');
  var burst = document.getElementById('burst');
  var hint = document.getElementById('hint');
  var live = document.getElementById('live');
  var wordsBtn = document.getElementById('words');
  var hearBtn = document.getElementById('hear');
  var anotherBtn = document.getElementById('another');
  var calmBtn = document.getElementById('calm');
  var soundBtn = document.getElementById('sound');
  var heartShape = document.getElementById('heart-shape');

  var state = null;
  var current = null;
  var wordIndex = 0;
  var picked = null;
  var calm = false;
  var soundOn = true;
  var reduce = false;
  var primed = false;
  var celebrated = false;
  var pendingStart = null;
  var pointerId = null;
  var active = null;
  var audioCtx = null;
  var voices = [];
  var lastBox = { w: 0, h: 0 };
  var last = 0;
  var holdStill = false;
  var shell = false;
  var jumbleStage = 1;

  function motionOn() {
    return !calm && !reduce;
  }

  function heartMark() {
    var node = heartShape.cloneNode(true);
    node.removeAttribute('hidden');
    node.removeAttribute('id');
    node.setAttribute('aria-hidden', 'true');
    node.classList.add('mark');
    return node;
  }

  function fillRuns(el, word) {
    var i, run, span;
    for (i = 0; i < word.runs.length; i++) {
      run = word.runs[i];
      span = document.createElement('span');
      span.className = 'run' + (run.heart ? ' heart' : '');
      span.textContent = run.text;
      if (run.heart) span.appendChild(heartMark());
      el.appendChild(span);
    }
  }

  function clearKids(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function boardBox() {
    return { w: board.clientWidth, h: board.clientHeight };
  }

  function setCalm(on) {
    calm = !!on;
    calmBtn.setAttribute('aria-pressed', calm ? 'true' : 'false');
    document.body.classList.toggle('calm', calm);
  }

  function setSound(on) {
    soundOn = !!on;
    soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
  }

  function sayLive(text) {
    live.textContent = '';
    window.setTimeout(function () { live.textContent = text; }, 30);
  }

  function hintText() {
    if (!state || !current) return 'Pick a heart word.';
    if (shell && jumbleStage >= 2) {
      if (state.phase === 'deal') return 'No letter clues. The letters fly in.';
      if (state.phase === 'done') return 'You spelled ' + state.w + '!';
      return 'Empty slots. Drag the letters back.';
    }
    if (shell) {
      if (state.phase === 'deal') return 'Letters in the dotted slots, then they jumble.';
      if (state.phase === 'done') return 'You spelled ' + state.w + '! Spell it again with no clues.';
      return 'The dotted slots show the letters.';
    }
    if (state.phase === 'deal') return 'The letters are jumbling.';
    if (state.phase === 'done') return 'You spelled ' + state.w + '!';
    return 'Drag the letters onto the dotted word.';
  }

  function applyShellStage() {
    document.body.classList.toggle('shell', shell);
    document.body.classList.toggle('stage-blank', shell && jumbleStage >= 2);
  }

  function postJumble(done) {
    if (!shell || !window.parent || window.parent === window) return;
    try {
      window.parent.postMessage({
        source: 'lesson-shell',
        step: 'jumble',
        done: !!done,
        stage: jumbleStage
      }, window.location.origin);
    } catch (err) { /* the shell is gone */ }
  }

  function syncChrome() {
    document.body.setAttribute('data-phase', state ? state.phase : 'pick');
    hint.textContent = hintText();
    var playing = !!state;
    wordsBtn.hidden = !playing;
    hearBtn.hidden = !playing;
    anotherBtn.hidden = !playing;
    pick.hidden = playing;
    board.hidden = !playing;
    if (shell) {
      wordsBtn.hidden = true;
      if (!state || state.phase !== 'done') anotherBtn.hidden = true;
      else {
        anotherBtn.hidden = false;
        anotherBtn.disabled = false;
        anotherBtn.textContent = jumbleStage < 2 ? 'Spell it again' : 'Next';
      }
    } else {
      anotherBtn.textContent = 'Another word';
    }
  }

  function readVoices() {
    try { voices = window.speechSynthesis ? (window.speechSynthesis.getVoices() || []) : []; }
    catch (e) { voices = []; }
    return voices;
  }

  function primeSpeech() {
    if (primed) return;
    var synth = window.speechSynthesis;
    if (!synth || !window.SpeechSynthesisUtterance) return;
    try {
      synth.cancel();
      synth.speak(new window.SpeechSynthesisUtterance(''));
      primed = true;
    } catch (e) { /* the next tap still tries */ }
  }

  function say(word) {
    if (!word) return;
    speech.speak(word.w, {
      synth: window.speechSynthesis,
      Utterance: window.SpeechSynthesisUtterance,
      voices: readVoices(),
      rate: 0.86,
      pitch: 1.08
    });
  }

  function ensureAudio() {
    if (!soundOn) return null;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) {
      try { audioCtx = new AC(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended' && audioCtx.resume) {
      try { audioCtx.resume(); } catch (e2) { /* the beep can wait */ }
    }
    return audioCtx;
  }

  function tone(freq, delay, dur, type, gain) {
    var ctx = ensureAudio();
    if (!ctx) return;
    var t = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    var amp = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain || 0.04, t + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + (dur || 0.12) + 0.02);
  }

  function chime() {
    tone(523, 0, 0.12, 'triangle', 0.05);
    tone(659, 0.1, 0.14, 'triangle', 0.05);
    tone(784, 0.2, 0.18, 'sine', 0.04);
  }

  function clearCelebrate() {
    celebrated = false;
    clearKids(burst);
  }

  function celebrate() {
    if (celebrated || !state) return;
    celebrated = true;
    clearKids(burst);
    if (!motionOn() && !holdStill) return;
    var row = state.slots;
    if (!row.length) return;
    var left = row[0].x;
    var right = row[row.length - 1].x + row[row.length - 1].w;
    var above = Math.max(28, row[0].y * 0.42);
    var below = Math.min(state.box.h - 28, row[0].y + row[0].h + (state.box.h - (row[0].y + row[0].h)) * 0.48);
    var spots = [];
    var i;
    for (i = 0; i < 5; i++) {
      spots.push({ x: left + (right - left) * ((i + 0.5) / 5), y: above });
      spots.push({ x: left + (right - left) * ((i + 0.5) / 5), y: below });
    }
    for (i = 0; i < spots.length; i++) {
      var bit = document.createElement('div');
      bit.className = 'bit' + (motionOn() && !holdStill ? ' fly' : '');
      bit.style.left = spots[i].x + 'px';
      bit.style.top = spots[i].y + 'px';
      bit.appendChild(heartMark());
      burst.appendChild(bit);
    }
  }

  function onDone() {
    celebrate();
    chime();
    if (current) say(current);
    sayLive('You spelled ' + state.w + '!');
  }

  function buildPieces() {
    clearKids(slotsEl);
    clearKids(cardsEl);
    clearCelebrate();
    var i, slot, el, ghost, tile, btn, face, glyph;
    for (i = 0; i < state.slots.length; i++) {
      slot = state.slots[i];
      el = document.createElement('div');
      el.className = 'slot' + (slot.heart ? ' heart' : '');
      ghost = document.createElement('span');
      ghost.className = 'ghost';
      ghost.textContent = slot.ch;
      el.appendChild(ghost);
      if (slot.heart) {
        var mini = heartMark();
        mini.classList.add('mini');
        el.appendChild(mini);
      }
      slotsEl.appendChild(el);
    }
    for (i = 0; i < state.tiles.length; i++) {
      tile = state.tiles[i];
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card' + (tile.heart ? ' heart' : '');
      btn.dataset.id = tile.id;
      btn.draggable = false;
      face = document.createElement('span');
      face.className = 'face';
      glyph = document.createElement('span');
      glyph.className = 'glyph';
      glyph.textContent = tile.ch;
      face.appendChild(glyph);
      if (tile.heart) face.appendChild(heartMark());
      btn.appendChild(face);
      cardsEl.appendChild(btn);
    }
  }

  function render() {
    if (!state) return;
    var i, slot, el, shake, tile, btn, p, scale, label;
    for (i = 0; i < state.slots.length; i++) {
      slot = state.slots[i];
      el = slotsEl.children[i];
      if (!el) continue;
      shake = table.shakeOffset(slot);
      el.style.left = slot.x + 'px';
      el.style.top = slot.y + 'px';
      el.style.width = slot.w + 'px';
      el.style.height = slot.h + 'px';
      el.style.fontSize = Math.round(slot.w * 0.5) + 'px';
      el.style.transform = 'translate(' + shake.toFixed(2) + 'px,0)';
      el.classList.toggle('filled', !!slot.tile);
      el.classList.toggle('heart', !!slot.heart);
      el.classList.toggle('ready', false);
    }
    var drag = null;
    for (i = 0; i < state.tiles.length; i++) if (state.tiles[i].dragging) drag = state.tiles[i];
    var glow = table.preview(state, drag);
    if (glow && glow.ok && slotsEl.children[glow.index]) {
      slotsEl.children[glow.index].classList.add('ready');
    }
    for (i = 0; i < state.tiles.length; i++) {
      tile = state.tiles[i];
      btn = cardsEl.children[i];
      if (!btn) continue;
      p = table.pose(state, tile);
      scale = p.scale;
      if (picked === tile.id && !tile.dragging && !tile.armed) scale = Math.max(scale, 1.08);
      btn.style.left = p.x + 'px';
      btn.style.top = p.y + 'px';
      btn.style.width = tile.w + 'px';
      btn.style.height = tile.h + 'px';
      btn.style.zIndex = String(p.z);
      btn.style.fontSize = Math.round(tile.w * 0.56) + 'px';
      btn.style.transform = 'translate(-50%, -50%) rotate(' + p.rot.toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ')';
      btn.classList.toggle('up', !!(p.up || picked === tile.id));
      btn.classList.toggle('in', tile.slot != null && !tile.dragging);
      btn.classList.toggle('picked', picked === tile.id && !tile.dragging);
      label = (tile.heart ? 'Heart letter ' : 'Letter ') + tile.ch;
      if (tile.slot != null) label += ', in place';
      btn.setAttribute('aria-label', label);
    }
  }

  function mount(word, opts, box) {
    current = word;
    picked = null;
    state = table.create(word, box, {
      seed: opts.seed,
      decoys: opts.decoys,
      still: !!opts.still || !motionOn(),
      filled: !!opts.filled,
      blank: !!opts.blank
    });
    lastBox = { w: box.w, h: box.h };
    buildPieces();
    render();
    syncChrome();
    if (state.phase === 'done') onDone();
    else {
      say(word);
      sayLive(word.w + '. Drag the letters onto the dotted word.');
    }
  }

  function startWord(word, opts) {
    opts = opts || {};
    current = word;
    syncPlayShell();
    var box = boardBox();
    if (box.w < 80 || box.h < 80) {
      pendingStart = { word: word, opts: opts };
      return;
    }
    pendingStart = null;
    mount(word, opts, box);
  }

  function syncPlayShell() {
    pick.hidden = true;
    board.hidden = false;
    wordsBtn.hidden = false;
    hearBtn.hidden = false;
    anotherBtn.hidden = false;
  }

  function showPick() {
    state = null;
    current = null;
    picked = null;
    pendingStart = null;
    clearCelebrate();
    pick.hidden = false;
    board.hidden = true;
    syncChrome();
    sayLive('Pick a heart word.');
  }

  function buildGrid() {
    clearKids(grid);
    words.DEMO.forEach(function (word, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'word';
      var line = document.createElement('span');
      line.className = 'word-line';
      fillRuns(line, word);
      btn.appendChild(line);
      var sentence = document.createElement('span');
      sentence.className = 'sentence';
      sentence.textContent = word.sentence;
      btn.appendChild(sentence);
      btn.addEventListener('click', function () {
        primeSpeech();
        ensureAudio();
        wordIndex = index;
        startWord(word, {});
      });
      grid.appendChild(btn);
    });
  }

  function localPoint(e) {
    var rect = board.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function react(result) {
    if (!result) {
      syncChrome();
      return;
    }
    if (result.kind === 'snap') {
      tone(640, 0, 0.07, 'triangle', 0.05);
      tone(880, 0.08, 0.11, 'sine', 0.04);
      sayLive(result.ch + ' is in place.');
      if (result.done) onDone();
    } else if (result.kind === 'miss') {
      tone(230, 0, 0.1, 'sine', 0.028);
      sayLive('It bounced back.');
    } else if (result.kind === 'park') {
      tone(420, 0, 0.05, 'sine', 0.02);
    }
    syncChrome();
  }

  function onDown(e) {
    if (pointerId !== null) return;
    if (!state || state.phase === 'deal') return;
    if (e.button != null && e.button !== 0) return;
    primeSpeech();
    ensureAudio();
    var pt = localPoint(e);
    var id = table.hit(state, pt.x, pt.y);
    pointerId = e.pointerId;
    active = { id: id, x: pt.x, y: pt.y, moved: false };
    if (id) table.pointerDown(state, id, pt.x, pt.y);
    try { board.setPointerCapture(e.pointerId); } catch (err) { /* mouse still follows */ }
    e.preventDefault();
  }

  function onMove(e) {
    if (!active || e.pointerId !== pointerId) return;
    var pt = localPoint(e);
    var dx = pt.x - active.x;
    var dy = pt.y - active.y;
    if (dx * dx + dy * dy > 64) active.moved = true;
    if (active.id) table.pointerMove(state, pt.x, pt.y);
    e.preventDefault();
  }

  function onUp(e) {
    if (!active || e.pointerId !== pointerId) return;
    var pt = localPoint(e);
    var dx = pt.x - active.x;
    var dy = pt.y - active.y;
    var moved = active.moved || dx * dx + dy * dy > 64;
    var id = active.id;
    var result = null;
    if (id) result = table.pointerUp(state, pt.x, pt.y);
    if (!moved) {
      if (id && result && result.kind === 'tap') {
        picked = picked === id ? null : id;
        tone(540, 0, 0.05, 'sine', 0.03);
      } else if (!id && picked) {
        var slot = table.hitSlot(state, pt.x, pt.y);
        if (slot) {
          result = table.dropOn(state, picked, slot.cx, slot.cy);
          if (result && result.kind === 'snap') picked = null;
        } else {
          picked = null;
        }
      }
    } else {
      picked = null;
    }
    active = null;
    pointerId = null;
    react(result);
    e.preventDefault();
  }

  function maybeResize() {
    if (!state) return;
    var box = boardBox();
    if (box.w < 80 || box.h < 80) return;
    if (Math.abs(box.w - lastBox.w) < 2 && Math.abs(box.h - lastBox.h) < 2) return;
    table.resize(state, box);
    lastBox = box;
  }

  function frame(now) {
    window.requestAnimationFrame(frame);
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (pendingStart) {
      var box = boardBox();
      if (box.w >= 80 && box.h >= 80) {
        var job = pendingStart;
        pendingStart = null;
        mount(job.word, job.opts, box);
      }
    }
    if (!state) return;
    var wasDone = celebrated;
    table.step(state, dt);
    if (state.phase !== 'done' && wasDone) clearCelebrate();
    if (state.phase === 'done' && !celebrated) onDone();
    maybeResize();
    render();
    if (state.phase === 'deal' || state.phase === 'done' || state.phase === 'play') {
      var next = hintText();
      if (hint.textContent !== next) hint.textContent = next;
      document.body.setAttribute('data-phase', state.phase);
    }
  }

  function boot() {
    reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var q = new URLSearchParams(window.location.search);
    if (q.get('calm') === '1' || reduce) setCalm(true);
    holdStill = q.get('still') === '1';
    shell = q.get('shell') === '1';
    jumbleStage = q.get('stage') === '2' ? 2 : 1;
    applyShellStage();
    if (q.get('sound') === '0') setSound(false);
    buildGrid();
    var named = q.get('word');
    var jump = named || q.get('still') || q.get('filled');
    if (jump) {
      var word = words.find(named || 'said') || words.DEMO[0];
      wordIndex = words.DEMO.indexOf(word);
      if (wordIndex < 0) wordIndex = 0;
      syncPlayShell();
      pendingStart = {
        word: word,
        opts: {
          still: q.get('still') === '1',
          filled: q.get('filled') === '1',
          decoys: q.get('decoys'),
          seed: q.get('seed'),
          blank: q.get('stage') === '2'
        }
      };
    } else {
      showPick();
    }
    window.requestAnimationFrame(frame);
  }

  wordsBtn.addEventListener('click', function () {
    primeSpeech();
    showPick();
  });
  anotherBtn.addEventListener('click', function () {
    primeSpeech();
    ensureAudio();
    if (shell && state && state.phase === 'done' && jumbleStage < 2) {
      jumbleStage = 2;
      applyShellStage();
      postJumble(false);
      startWord(current, { blank: true, seed: String(((state.seed || 1) + 17) >>> 0) });
      return;
    }
    if (shell && state && state.phase === 'done') {
      anotherBtn.disabled = true;
      postJumble(true);
      return;
    }
    wordIndex = (wordIndex + 1) % words.DEMO.length;
    startWord(words.DEMO[wordIndex], {});
  });
  hearBtn.addEventListener('click', function () {
    primeSpeech();
    if (current) say(current);
  });
  calmBtn.addEventListener('click', function () {
    setCalm(!calm);
    if (calm && state && state.phase === 'deal') table.finishDeal(state);
  });
  soundBtn.addEventListener('click', function () {
    setSound(!soundOn);
  });

  board.addEventListener('pointerdown', onDown);
  board.addEventListener('pointermove', onMove);
  board.addEventListener('pointerup', onUp);
  board.addEventListener('pointercancel', onUp);
  board.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  board.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  if (window.speechSynthesis) {
    if (window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', readVoices);
    } else {
      window.speechSynthesis.onvoiceschanged = readVoices;
    }
    readVoices();
  }

  window.addEventListener('resize', maybeResize);
  boot();
})();
