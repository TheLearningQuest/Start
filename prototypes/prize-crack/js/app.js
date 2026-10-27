/* Prize room. The drawer, the crack, and the heart word.
   Sounds are Web Audio oscillators. The word is speechSynthesis
   until a clip path is listed in PrizeSpeech.CLIPS. */
(function () {
  'use strict';

  var hintEl = document.getElementById('hint');
  var calmBtn = document.getElementById('calm');
  var soundBtn = document.getElementById('sound');
  var lobby = document.getElementById('lobby');
  var room = document.getElementById('room');
  var reveal = document.getElementById('reveal');
  var prizeBtn = document.getElementById('prize');
  var wordEl = document.getElementById('word');
  var sentenceEl = document.getElementById('sentence');
  var hearBtn = document.getElementById('hear');
  var againBtn = document.getElementById('again');
  var liveEl = document.getElementById('live');
  var burstEl = document.getElementById('burst');
  var heartShape = document.getElementById('heart-shape');
  var arts = prizeBtn.querySelectorAll('.art');
  var packEl = prizeBtn.querySelector('.pack');

  var soundOn = true;
  var primed = false;
  var audioCtx = null;
  var raf = 0;
  var last = 0;
  var justOpened = false;
  var justTimer = 0;
  var wordDrawn = '';
  var moved = false;
  var suppressClick = false;
  var downY = 0;

  var params = new URLSearchParams(window.location.search);
  var reduced = false;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) reduced = true;
  if (params.get('calm') === '1') reduced = true;

  var state = PrizeOpen.createState({
    reduced: reduced,
    wordCount: PrizeWords.DEMO.length
  });
  PrizeOpen.launch(state, {
    won: params.get('won') || '',
    word: params.get('word') || '',
    crack: params.get('crack') || '',
    open: params.get('open') === '1',
    ready: params.get('ready') === '1',
    calm: params.get('calm') === '1'
  }, PrizeWords.DEMO);

  if (params.get('still') === '1') document.body.classList.add('still');

  var shell = params.get('shell') === '1';
  if (shell) {
    document.body.classList.add('shell');
    var gradeQ = params.get('grade') || '';
    if (gradeQ === 'k' || gradeQ === '1' || gradeQ === '2') {
      document.body.setAttribute('data-grade', gradeQ);
    }
    var prizeTag = document.querySelector('.tag');
    if (prizeTag) prizeTag.textContent = 'Prize';
    if (state.phase === 'lobby') PrizeOpen.win(state, 'toy');
  }

  function currentWord() {
    var list = PrizeWords.DEMO;
    var i = state.wordIndex;
    if (i < 0 || i >= list.length) i = 0;
    return list[i];
  }

  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }

  function readVoices() {
    var s = window.speechSynthesis;
    if (!s || !s.getVoices) return [];
    try { return s.getVoices() || []; } catch (e) { return []; }
  }

  function onVoices() { readVoices(); }

  if (window.speechSynthesis) {
    if (window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', onVoices);
    else window.speechSynthesis.onvoiceschanged = onVoices;
    onVoices();
  }

  function primeSpeech() {
    if (primed) return;
    var s = window.speechSynthesis;
    if (!s || !window.SpeechSynthesisUtterance) return;
    try {
      s.cancel();
      s.speak(new window.SpeechSynthesisUtterance(''));
      primed = true;
    } catch (e) { /* the next tap still tries */ }
  }

  function say(word) {
    if (!word) return;
    PrizeSpeech.playClip(PrizeSpeech.clipPath(word.id), word.w, {
      clips: PrizeSpeech.CLIPS,
      synth: window.speechSynthesis,
      Utterance: window.SpeechSynthesisUtterance,
      voices: readVoices(),
      Audio: window.Audio,
      rate: 0.85,
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
      try { audioCtx.resume(); } catch (e2) { /* ignore */ }
    }
    return audioCtx;
  }

  function tone(freq, delay, dur, type, gain) {
    var ac = ensureAudio();
    if (!ac) return;
    try {
      var t = ac.currentTime + (delay || 0);
      var o = ac.createOscillator();
      var g = ac.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(ac.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* a missing audio device stays quiet */ }
  }

  function blip() { tone(520, 0, 0.07, 'sine', 0.045); }

  function pop() {
    tone(340, 0, 0.07, 'triangle', 0.05);
    tone(180, 0.02, 0.09, 'sine', 0.04);
  }

  function cheer() {
    tone(523, 0, 0.12, 'sine', 0.05);
    tone(659, 0.09, 0.13, 'sine', 0.05);
    tone(784, 0.18, 0.2, 'sine', 0.055);
  }

  function rustle() {
    var ac = ensureAudio();
    if (!ac) return;
    try {
      var n = Math.floor(0.12 * ac.sampleRate);
      var buf = ac.createBuffer(1, n, ac.sampleRate);
      var data = buf.getChannelData(0);
      var i;
      for (i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = ac.createBufferSource();
      src.buffer = buf;
      var filter = ac.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 900;
      var g = ac.createGain();
      g.gain.value = 0.045;
      src.connect(filter);
      filter.connect(g);
      g.connect(ac.destination);
      src.start();
    } catch (e) { /* ignore */ }
  }

  function burst() {
    burstEl.textContent = '';
    var i;
    for (i = 0; i < 14; i++) {
      var bit = document.createElement('i');
      bit.className = 'bit ' + (i % 2 ? 'heartbit' : 'starbit');
      bit.style.left = (16 + (i * 5.1) % 68) + '%';
      var dir = i % 2 ? 1 : -1;
      bit.style.setProperty('--dx', (dir * (36 + (i * 13) % 110)) + 'px');
      bit.style.setProperty('--rot', ((i * 47) % 180) + 'deg');
      bit.style.animationDelay = ((i % 5) * 0.03) + 's';
      burstEl.appendChild(bit);
    }
  }

  function heartNode() {
    var node = heartShape.cloneNode(true);
    node.removeAttribute('id');
    node.removeAttribute('hidden');
    node.setAttribute('class', 'mark');
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  function drawWord(word) {
    wordEl.textContent = '';
    wordEl.setAttribute('aria-label', word.w);
    var i;
    for (i = 0; i < word.runs.length; i++) {
      var run = word.runs[i];
      var span = document.createElement('span');
      span.className = run.heart ? 'run heart' : 'run';
      var glyphs = document.createElement('span');
      glyphs.className = 'glyphs';
      glyphs.textContent = run.text;
      span.appendChild(glyphs);
      if (run.heart) span.appendChild(heartNode());
      wordEl.appendChild(span);
    }
    setText(sentenceEl, word.sentence);
  }

  function fitWord() {
    if (reveal.hidden) return;
    var width = reveal.clientWidth;
    var height = reveal.clientHeight;
    if (width < 40 || height < 40) return;
    var size = Math.min(200, Math.floor(width * 0.23), Math.floor(height * 0.3));
    if (size < 72) size = 72;
    wordEl.style.fontSize = size + 'px';
    var guard = 0;
    while (wordEl.scrollWidth > width - 72 && size > 44 && guard < 60) {
      size -= 3;
      wordEl.style.fontSize = size + 'px';
      guard++;
    }
  }

  function ariaPrize() {
    var prize = PrizeOpen.PRIZES[state.prize];
    if (state.phase === 'opening' && prize.gesture === 'tap' && state.taps > 0) {
      return prize.name + '. ' + state.taps + ' of ' + prize.taps + ' taps.';
    }
    return prize.name + '. ' + prize.idleHint;
  }

  function boop() {
    if (state.reduced || document.body.classList.contains('still')) return;
    var i;
    for (i = 0; i < arts.length; i++) {
      if (arts[i].classList.contains('live')) {
        var art = arts[i];
        art.classList.remove('boop');
        void art.offsetWidth;
        art.classList.add('boop');
        return;
      }
    }
  }

  function openedNow() {
    justOpened = !state.reduced && !document.body.classList.contains('still');
    if (justTimer) window.clearTimeout(justTimer);
    if (justOpened) {
      justTimer = window.setTimeout(function () {
        justOpened = false;
        document.body.classList.remove('just-opened');
      }, 720);
    }
    if (!state.reduced && !document.body.classList.contains('still')) burst();
    cheer();
    say(currentWord());
  }

  function render() {
    document.body.classList.toggle('calm', !!state.reduced);
    document.body.classList.toggle('dragging', !!state.dragging);
    document.body.classList.toggle('just-opened', !!justOpened);
    document.body.setAttribute('data-phase', state.phase);
    document.body.setAttribute('data-prize', state.prize);

    setText(hintEl, shellHint() || PrizeOpen.hint(state));
    calmBtn.setAttribute('aria-pressed', state.reduced ? 'true' : 'false');
    setText(calmBtn, state.reduced ? 'Calm on' : 'Calm');
    soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    setText(soundBtn, soundOn ? 'Sound' : 'Muted');

    var roomOn = state.phase === 'arrive' || state.phase === 'closed' || state.phase === 'opening';
    var revealOn = state.phase === 'revealed';
    lobby.hidden = state.phase !== 'lobby';
    room.hidden = !roomOn;
    reveal.hidden = !revealOn;

    var level = PrizeOpen.crackLevel(state);
    prizeBtn.classList.toggle('crack-1', level === 1);
    prizeBtn.classList.toggle('crack-2', level === 2);
    var label = ariaPrize();
    if (prizeBtn.getAttribute('aria-label') !== label) prizeBtn.setAttribute('aria-label', label);

    var i;
    for (i = 0; i < arts.length; i++) {
      var on = arts[i].getAttribute('data-kind') === state.prize;
      arts[i].hidden = !on;
      arts[i].classList.toggle('live', on);
    }
    if (state.prize === 'packet') packEl.style.setProperty('--peel', String(state.progress));
    else packEl.style.setProperty('--peel', '0');

    if (shell && revealOn) setText(againBtn, 'Next');

    if (revealOn) {
      var word = currentWord();
      if (wordDrawn !== word.id) {
        drawWord(word);
        wordDrawn = word.id;
        if (justOpened) wordEl.classList.add('pop');
        else wordEl.classList.remove('pop');
        setText(liveEl, word.w);
      }
      fitWord();
    } else if (wordDrawn) {
      wordDrawn = '';
      setText(liveEl, '');
    }
  }

  function shellHint() {
    if (!shell || state.phase === 'lobby' || state.phase === 'revealed') return '';
    if (state.phase === 'arrive') return 'Your capsule!';
    if (!state.taps) return 'Tilt the present open.';
    if (state.taps === 1) return 'It tipped! Tap again.';
    return 'One more tap!';
  }

  function postReveal() {
    if (!window.parent || window.parent === window) return;
    try {
      window.parent.postMessage({
        source: 'lesson-shell',
        step: 'reveal',
        done: true
      }, window.location.origin);
    } catch (err) { /* the shell is gone */ }
  }

  function kick() {
    if (raf) return;
    last = 0;
    raf = window.requestAnimationFrame(loop);
  }

  function loop(now) {
    raf = 0;
    var dt = last ? (now - last) / 1000 : 1 / 60;
    last = now;
    var before = state.phase + ':' + state.progress.toFixed(3) + ':' + (state.springing ? 1 : 0);
    PrizeOpen.step(state, dt);
    var after = state.phase + ':' + state.progress.toFixed(3) + ':' + (state.springing ? 1 : 0);
    if (before !== after) render();
    if (state.phase === 'arrive' || state.springing) kick();
  }

  document.getElementById('win-capsule').addEventListener('click', function () { onWin('capsule'); });
  document.getElementById('win-packet').addEventListener('click', function () { onWin('packet'); });
  document.getElementById('win-toy').addEventListener('click', function () { onWin('toy'); });

  function onWin(id) {
    primeSpeech();
    blip();
    justOpened = false;
    PrizeOpen.win(state, id);
    render();
    kick();
    try { prizeBtn.focus({ preventScroll: true }); } catch (e) { prizeBtn.focus(); }
  }

  prizeBtn.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    suppressClick = false;
    moved = false;
    downY = e.clientY;
    if (prizeBtn.setPointerCapture) {
      try { prizeBtn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    PrizeOpen.pointerDown(state, e.clientY);
    render();
  });

  prizeBtn.addEventListener('pointermove', function (e) {
    if (!state.dragging) return;
    if (Math.abs(e.clientY - downY) > 12) moved = true;
    PrizeOpen.pointerMove(state, e.clientY);
    if (e.cancelable) e.preventDefault();
    render();
  });

  function endDrag() {
    if (!state.dragging) return;
    var wasDragging = state.dragging;
    PrizeOpen.pointerUp(state);
    if (moved) suppressClick = true;
    if (wasDragging && state.opened) openedNow();
    else if (wasDragging && moved) rustle();
    moved = false;
    render();
    kick();
  }

  prizeBtn.addEventListener('pointerup', endDrag);
  prizeBtn.addEventListener('pointercancel', endDrag);

  prizeBtn.addEventListener('click', function () {
    if (suppressClick) { suppressClick = false; return; }
    var was = state.opened;
    PrizeOpen.press(state);
    boop();
    if (!was && state.opened) openedNow();
    else pop();
    render();
  });

  prizeBtn.addEventListener('animationend', function (e) {
    if (e.target && e.target.classList) e.target.classList.remove('boop');
  });

  hearBtn.addEventListener('click', function () {
    primeSpeech();
    say(currentWord());
  });

  againBtn.addEventListener('click', function () {
    if (shell) {
      if (state.phase !== 'revealed') return;
      againBtn.disabled = true;
      postReveal();
      return;
    }
    blip();
    justOpened = false;
    PrizeOpen.again(state);
    render();
  });

  calmBtn.addEventListener('click', function () {
    state.reduced = !state.reduced;
    render();
  });

  soundBtn.addEventListener('click', function () {
    soundOn = !soundOn;
    render();
    if (soundOn) ensureAudio();
  });

  window.addEventListener('resize', function () {
    if (state.phase === 'revealed') fitWord();
  });

  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  render();
  if (state.phase === 'arrive' || state.springing) kick();
})();
