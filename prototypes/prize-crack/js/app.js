/* Prize room. The drawer, the crack, and the heart word.
   Sounds are Web Audio oscillators. The word is speechSynthesis
   until a clip path is listed in PrizeSpeech.CLIPS. */
(function () {
  'use strict';

  var hintEl = document.getElementById('hint');
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
  var shellBeat = 'word';
  var splitting = false;
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
    if (state.phase === 'lobby') PrizeOpen.win(state, 'capsule');
  }

  function packedWord() {
    var raw = params.get('pack');
    if (!raw) return null;
    try {
      var word = JSON.parse(raw);
      if (word && word.w && word.letters && word.runs) return word;
    } catch (err) { return null; }
    return null;
  }

  function currentWord() {
    if (shell) {
      var packed = packedWord();
      if (packed) return packed;
    }
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
      if (shell && run.heart) {
        span.setAttribute('role', 'button');
        span.tabIndex = 0;
        span.setAttribute('aria-label', 'Red letters ' + run.text);
      }
      wordEl.appendChild(span);
    }
    if (shell) {
      shellBeat = 'word';
      sentenceEl.textContent = '';
      sentenceEl.hidden = true;
      if (!wordEl.querySelector('.run.heart')) showSentence(word);
    } else {
      sentenceEl.hidden = false;
      setText(sentenceEl, word.sentence);
    }
  }

  function sentenceSplit(word) {
    var raw = word.sentence || '';
    var needle = String(word.w || '');
    var lower = raw.toLowerCase();
    var want = needle.toLowerCase();
    var start = -1;
    var from = 0;
    while (want && from < lower.length) {
      var at = lower.indexOf(want, from);
      if (at < 0) break;
      var before = at === 0 || !/[a-z]/i.test(raw.charAt(at - 1));
      var after = at + want.length >= raw.length || !/[a-z]/i.test(raw.charAt(at + want.length));
      if (before && after) { start = at; break; }
      from = at + 1;
    }
    if (start < 0) return { before: raw, after: '' };
    return { before: raw.slice(0, start), after: raw.slice(start + needle.length) };
  }

  function showSentence(word) {
    if (shellBeat === 'sentence' && sentenceEl.contains(wordEl)) return;
    shellBeat = 'sentence';
    var parts = sentenceSplit(word);
    sentenceEl.textContent = '';
    if (parts.before) {
      var lead = document.createElement('span');
      lead.className = 'side';
      lead.textContent = parts.before;
      sentenceEl.appendChild(lead);
    }
    sentenceEl.appendChild(wordEl);
    if (parts.after) {
      var tail = document.createElement('span');
      tail.className = 'side';
      tail.textContent = parts.after;
      sentenceEl.appendChild(tail);
    }
    sentenceEl.hidden = false;
  }

  function tapHeart(run) {
    if (!shell || state.phase !== 'revealed' || shellBeat === 'sentence') return;
    if (!run || !run.classList.contains('heart') || run.classList.contains('found')) return;
    run.classList.add('found');
    run.removeAttribute('role');
    run.removeAttribute('tabindex');
    var mark = run.querySelector('.mark');
    if (mark && mark.parentNode) mark.parentNode.removeChild(mark);
    blip();
    if (!wordEl.querySelector('.run.heart:not(.found)')) showSentence(currentWord());
    render();
  }

  function fitWord() {
    if (reveal.hidden) return;
    if (shell && shellBeat === 'sentence') {
      fitSentence();
      return;
    }
    var width = reveal.clientWidth;
    var height = reveal.clientHeight;
    if (width < 40 || height < 40) return;
    var size = Math.min(200, Math.floor(width * 0.23), Math.floor(height * 0.3));
    if (size < 56) size = 56;
    wordEl.style.fontSize = size + 'px';
    var guard = 0;
    while (wordEl.scrollWidth > width - 72 && size > 44 && guard < 60) {
      size -= 3;
      wordEl.style.fontSize = size + 'px';
      guard++;
    }
    if (shell) wordEl.setAttribute('data-open-size', String(size));
  }

  function fitSentence() {
    var width = reveal.clientWidth;
    var height = reveal.clientHeight;
    if (width < 40 || height < 40) return;
    var openSize = parseFloat(wordEl.getAttribute('data-open-size'));
    if (!(openSize > 20)) {
      openSize = Math.min(200, Math.floor(width * 0.22), Math.floor(height * 0.34));
    }
    var size = Math.floor(openSize * 0.94);
    var floor = Math.max(64, Math.floor(openSize * 0.78));
    wordEl.style.fontSize = '1em';
    sentenceEl.style.fontSize = size + 'px';
    var guard = 0;
    while (guard < 24 && size > floor && sentenceCrowded()) {
      size -= 4;
      sentenceEl.style.fontSize = size + 'px';
      guard++;
    }
  }

  function sentenceCrowded() {
    var sentenceBox = sentenceEl.getBoundingClientRect();
    var revealBox = reveal.getBoundingClientRect();
    var actions = document.querySelector('.actions');
    var actionsBox = actions.getBoundingClientRect();
    var hitsButtons = actionsBox.height > 0 && sentenceBox.bottom > actionsBox.top - 8;
    var pastBottom = actionsBox.bottom > Math.min(revealBox.bottom, window.innerHeight) - 12;
    var pastSides = sentenceBox.left < revealBox.left - 2 || sentenceBox.right > revealBox.right - 2;
    return hitsButtons || pastBottom || pastSides;
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

    var roomOn = state.phase === 'arrive' || state.phase === 'closed' || state.phase === 'opening';
    var revealOn = state.phase === 'revealed';
    var holdSplit = shell && splitting && revealOn;
    lobby.hidden = state.phase !== 'lobby';
    room.hidden = holdSplit ? false : !roomOn;
    reveal.hidden = holdSplit ? true : !revealOn;
    prizeBtn.classList.toggle('split', holdSplit);

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

    document.body.classList.toggle('beat-word', shell && revealOn && !holdSplit && shellBeat !== 'sentence');
    document.body.classList.toggle('beat-sentence', shell && revealOn && !holdSplit && shellBeat === 'sentence');

    if (revealOn && !holdSplit) {
      var word = currentWord();
      if (wordDrawn !== word.id) {
        drawWord(word);
        wordDrawn = word.id;
        if (justOpened) wordEl.classList.add('pop');
        else wordEl.classList.remove('pop');
        setText(liveEl, word.w);
      }
      fitWord();
    } else if (!revealOn && wordDrawn) {
      wordDrawn = '';
      shellBeat = 'word';
      setText(liveEl, '');
    }
    if (shell && revealOn) {
      setText(hintEl, shellHint());
      setText(againBtn, 'Next');
      againBtn.hidden = shellBeat !== 'sentence';
    }
  }

  function shellHint() {
    if (!shell || state.phase === 'lobby') return '';
    if (state.phase === 'revealed') {
      if (splitting) return 'It opened!';
      if (shellBeat === 'sentence') return 'Read the sentence out loud.';
      if (wordEl.querySelector('.run.heart.found') && wordEl.querySelector('.run.heart:not(.found)')) {
        return 'Tap the other red letters.';
      }
      return 'Tap the red letters.';
    }
    if (state.phase === 'arrive') return 'Your capsule!';
    if (!state.taps) return 'Open the capsule.';
    if (state.taps === 1) return 'The top half tipped! Tap again.';
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
    if (splitting) return;
    if (suppressClick) { suppressClick = false; return; }
    var was = state.opened;
    PrizeOpen.press(state);
    boop();
    if (!was && state.opened && shell && state.prize === 'capsule' && !state.reduced && !document.body.classList.contains('still')) {
      splitting = true;
      openedNow();
      render();
      window.setTimeout(function () {
        splitting = false;
        render();
      }, 560);
      return;
    }
    if (!was && state.opened) openedNow();
    else pop();
    render();
  });

  wordEl.addEventListener('click', function (e) {
    var run = e.target.closest ? e.target.closest('.run') : null;
    tapHeart(run);
  });

  wordEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var run = e.target.closest ? e.target.closest('.run') : null;
    if (!run) return;
    e.preventDefault();
    tapHeart(run);
  });

  prizeBtn.addEventListener('animationend', function (e) {
    if (e.target && e.target.classList) e.target.classList.remove('boop');
  });

  function saySentence(word) {
    if (!word || !word.sentence) return;
    PrizeSpeech.speak(word.sentence, {
      synth: window.speechSynthesis,
      Utterance: window.SpeechSynthesisUtterance,
      voices: readVoices(),
      rate: 0.85,
      pitch: 1.08
    });
  }

  hearBtn.addEventListener('click', function () {
    primeSpeech();
    var word = currentWord();
    if (shell && shellBeat === 'sentence') saySentence(word);
    else say(word);
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

  window.addEventListener('resize', function () {
    if (state.phase === 'revealed') fitWord();
  });

  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  render();
  if (state.phase === 'arrive' || state.springing) kick();
})();
