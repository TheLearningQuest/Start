/* Thin lesson shell. One word rides in localStorage.
   Each step is its own page, framed here, until the seed. */
(function () {
  'use strict';

  var words = window.RedWordsShell;
  var flow = window.RedWordsFlow;

  var frame = document.getElementById('frame');
  var celebrate = document.getElementById('celebrate');
  var trail = document.getElementById('trail');
  var spellLabel = document.getElementById('spell-label');
  var heartsEl = document.getElementById('hearts');
  var legend = document.getElementById('legend');
  var nowEl = document.getElementById('now');
  var restartBtn = document.getElementById('restart');
  var seedHint = document.getElementById('seed-hint');
  var seedWord = document.getElementById('seed-word');
  var seedSentence = document.getElementById('seed-sentence');
  var seedYay = document.getElementById('seed-yay');
  var pouch = document.getElementById('pouch');
  var anotherBtn = document.getElementById('another');
  var live = document.getElementById('live');

  var reduced = false;
  try {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (err) { reduced = false; }
  if (reduced) document.body.classList.add('calm');

  var session = flow.blankSession();
  var tear = flow.createTear({ reduced: reduced });
  var celebrated = false;
  var moved = false;
  var suppress = false;
  var downX = 0;
  var raf = 0;
  var last = 0;
  var audioCtx = null;
  var primed = false;

  function loadRaw() {
    try {
      var raw = window.localStorage.getItem(flow.STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function save(next) {
    var copy = flow.withPile(next);
    try { window.localStorage.setItem(flow.STORAGE_KEY, JSON.stringify(copy)); }
    catch (err) { /* private mode keeps the word in memory */ }
    return copy;
  }

  function queryMap() {
    var out = {};
    var params = new URLSearchParams(window.location.search);
    params.forEach(function (value, key) { out[key] = value; });
    return out;
  }

  function primeSpeech() {
    if (primed) return;
    var synth = window.speechSynthesis;
    if (!synth || !window.SpeechSynthesisUtterance) return;
    try {
      synth.cancel();
      synth.speak(new window.SpeechSynthesisUtterance(''));
      primed = true;
    } catch (err) { /* the next tap still tries */ }
  }

  function say(text) {
    var synth = window.speechSynthesis;
    if (!synth || !window.SpeechSynthesisUtterance || !text) return;
    try {
      primeSpeech();
      synth.cancel();
      var utter = new window.SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = 0.9;
      synth.speak(utter);
    } catch (err) { /* the pop still plays */ }
  }

  function ac() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) {
      try { audioCtx = new AC(); } catch (err) { return null; }
    }
    if (audioCtx.state === 'suspended' && audioCtx.resume) {
      try { audioCtx.resume(); } catch (err2) { /* ignore */ }
    }
    return audioCtx;
  }

  function tone(freq, delay, dur) {
    var ctx = ac();
    if (!ctx) return;
    var t = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function cheer() {
    tone(523, 0, 0.12);
    tone(659, 0.1, 0.14);
    tone(784, 0.2, 0.18);
    tone(1046, 0.32, 0.22);
  }

  function fillRuns(el, word) {
    while (el.firstChild) el.removeChild(el.firstChild);
    var runs = word && word.runs ? word.runs : [];
    var i, run, span;
    for (i = 0; i < runs.length; i++) {
      run = runs[i];
      span = document.createElement('span');
      span.textContent = run.text;
      if (run.heart) span.className = 'heart';
      el.appendChild(span);
    }
  }

  function updateChrome() {
    var order = ['claw', 'reveal', 'jumble', 'write', 'seed'];
    var current = session.step === 'done' ? 'seed' : session.step;
    var currentIndex = order.indexOf(current);
    var items = trail.querySelectorAll('li');
    var i, li, step, index;
    for (i = 0; i < items.length; i++) {
      li = items[i];
      step = li.getAttribute('data-step');
      index = order.indexOf(step);
      li.classList.toggle('done', index >= 0 && index < currentIndex);
      if (step === current) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    }
    if (session.step === 'jumble') spellLabel.textContent = session.jumbleStage === 2 ? 'Spell 2' : 'Spell 1';
    else spellLabel.textContent = 'Spell';
    var n = session.hearts > 0 ? session.hearts : 0;
    heartsEl.textContent = '♥ ' + n;
    heartsEl.setAttribute('aria-label', n + (n === 1 ? ' heart word finished' : ' heart words finished'));
    legend.hidden = session.step !== 'claw';
    if (session.word) {
      nowEl.hidden = false;
      nowEl.textContent = session.word.w;
    } else {
      nowEl.hidden = true;
      nowEl.textContent = '';
    }
    document.body.setAttribute('data-step', session.step);
  }

  function paintTear() {
    var n = Math.round(tear.progress * 10);
    if (n < 0) n = 0;
    if (n > 10) n = 10;
    var open = !!tear.open || session.step === 'done';
    pouch.setAttribute('data-tear', open ? '10' : String(n));
    pouch.classList.toggle('open', open);
    var line = 'Tear the pouch sideways.';
    if (open) line = 'A seed!';
    else if (tear.progress > 0.08) line = 'Keep tearing!';
    if (seedHint.textContent !== line) seedHint.textContent = line;
    seedYay.hidden = !open;
    if (live.textContent !== line) live.textContent = line;
  }

  function paintWord() {
    fillRuns(seedWord, session.word);
    seedSentence.textContent = session.word ? session.word.sentence : '';
  }

  function showStep() {
    celebrate.hidden = true;
    frame.hidden = false;
    var titles = {
      claw: 'Claw',
      reveal: 'Open the prize',
      jumble: 'Jumble spell',
      write: 'Write the word'
    };
    frame.title = titles[session.step] || 'Lesson';
    var path = flow.framePath(session);
    var join = path.indexOf('?') >= 0 ? '&' : '?';
    frame.src = path + join + 'r=' + String(Date.now());
  }

  function showCelebrate() {
    frame.hidden = true;
    frame.src = 'rest.html';
    celebrate.hidden = false;
    paintWord();
    if (session.step === 'done') {
      tear = flow.createTear({ reduced: reduced });
      tear.open = true;
      tear.progress = 1;
      pouch.classList.add('settled');
      anotherBtn.hidden = false;
      celebrated = true;
    } else {
      tear = flow.createTear({ reduced: reduced });
      pouch.classList.remove('open', 'settled');
      anotherBtn.hidden = true;
      celebrated = false;
    }
    paintTear();
  }

  function render() {
    session = save(session);
    updateChrome();
    if (session.step === 'seed' || session.step === 'done') showCelebrate();
    else showStep();
  }

  function opened() {
    if (celebrated || session.step !== 'seed') return;
    celebrated = true;
    session = save(flow.finishSeed(session));
    pouch.classList.add('open');
    pouch.classList.remove('settled');
    anotherBtn.hidden = false;
    updateChrome();
    paintTear();
    cheer();
    say('A seed!');
  }

  function kick() {
    if (raf) return;
    last = 0;
    raf = window.requestAnimationFrame(loop);
  }

  function loop(now) {
    raf = 0;
    var dt = last ? (now - last) / 1000 : 0.016;
    last = now;
    var before = tear.progress;
    flow.tearStep(tear, dt);
    if (tear.progress !== before) paintTear();
    if (tear.springing) kick();
  }

  function endDrag() {
    if (!tear.dragging) return;
    flow.tearUp(tear);
    if (moved) suppress = true;
    paintTear();
    if (tear.open) opened();
    else if (tear.springing) kick();
  }

  pouch.addEventListener('pointerdown', function (e) {
    if (session.step === 'done' || tear.open) return;
    if (e.button !== undefined && e.button !== 0) return;
    moved = false;
    suppress = false;
    downX = e.clientX;
    ac();
    primeSpeech();
    flow.tearDown(tear, e.clientX);
    if (pouch.setPointerCapture) {
      try { pouch.setPointerCapture(e.pointerId); } catch (err) { /* mouse still follows */ }
    }
    paintTear();
  });

  pouch.addEventListener('pointermove', function (e) {
    if (!tear.dragging) return;
    if (Math.abs(e.clientX - downX) > 12) moved = true;
    flow.tearMove(tear, e.clientX);
    if (e.cancelable) e.preventDefault();
    paintTear();
  });

  pouch.addEventListener('pointerup', endDrag);
  pouch.addEventListener('pointercancel', endDrag);

  pouch.addEventListener('click', function () {
    if (suppress) { suppress = false; return; }
    if (session.step === 'done' || tear.open) return;
    ac();
    flow.tearTap(tear);
    paintTear();
    if (tear.open) opened();
  });

  anotherBtn.addEventListener('click', function () {
    session = flow.anotherWord(session);
    render();
  });

  restartBtn.addEventListener('click', function () {
    session = flow.blankSession();
    render();
  });

  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin) return;
    var msg = e.data;
    if (!msg || typeof msg !== 'object' || msg.source !== flow.SOURCE) return;
    var before = session.step;
    var stage = session.jumbleStage;
    session = flow.applyMessage(session, msg);
    if (session.step !== before) render();
    else if (session.jumbleStage !== stage) {
      session = save(session);
      updateChrome();
    }
  });

  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  session = flow.applyQuery(flow.normalize(loadRaw()), queryMap());
  render();
})();
