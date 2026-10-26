/* Write box. Hear a heart word, write it, tap Submit.

   This folder is its own toy. It does not open the word garden,
   Cole, or the lesson. Nothing is saved. */
(function () {
  'use strict';

  var words = window.WriteWords;
  var ink = window.WriteInk;
  var samples = window.WriteSamples;
  var speech = window.WriteSpeech;

  var pick = document.getElementById('pick');
  var play = document.getElementById('play');
  var grid = document.getElementById('word-grid');
  var show = document.getElementById('show');
  var sentence = document.getElementById('sentence');
  var pad = document.getElementById('pad');
  var ghost = document.getElementById('ghost');
  var burst = document.getElementById('burst');
  var choices = document.getElementById('choices');
  var hint = document.getElementById('hint');
  var wordsBtn = document.getElementById('words');
  var hearBtn = document.getElementById('hear');
  var clearBtn = document.getElementById('clear');
  var nextBtn = document.getElementById('next');
  var calmBtn = document.getElementById('calm');
  var soundBtn = document.getElementById('sound');
  var submitBtn = document.getElementById('submit');
  var heartShape = document.getElementById('heart-shape');

  var current = null;
  var wordIndex = 0;
  var strokes = [];
  var phase = 'pick';
  var calm = false;
  var soundOn = true;
  var reduce = false;
  var drawing = null;
  var audioCtx = null;
  var voices = [];
  var WRITE_HINT = 'Write it in the box, then tap Submit.';

  function motionOn() {
    return !calm && !reduce;
  }

  function syncQuiet() {
    document.body.classList.toggle('quiet', !motionOn());
  }

  function heartMark() {
    var node = heartShape.cloneNode(true);
    node.removeAttribute('hidden');
    node.removeAttribute('id');
    node.setAttribute('aria-hidden', 'true');
    node.classList.add('mark');
    return node;
  }

  function clearKids(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function fillRuns(el, word) {
    var i;
    var run;
    var span;
    for (i = 0; i < word.runs.length; i++) {
      run = word.runs[i];
      span = document.createElement('span');
      span.className = 'run' + (run.heart ? ' heart' : '');
      span.textContent = run.text;
      if (run.heart) span.appendChild(heartMark());
      el.appendChild(span);
    }
  }

  function params() {
    var out = {};
    var q = String(window.location.search || '').replace(/^\?/, '');
    if (!q) return out;
    q.split('&').forEach(function (pair) {
      var i = pair.indexOf('=');
      var k = decodeURIComponent(i < 0 ? pair : pair.slice(0, i));
      var v = decodeURIComponent((i < 0 ? '' : pair.slice(i + 1)).replace(/\+/g, ' '));
      if (k) out[k] = v;
    });
    return out;
  }

  function setPhase(next) {
    phase = next;
    document.body.setAttribute('data-phase', next);
  }

  function setCalm(on) {
    calm = !!on;
    calmBtn.setAttribute('aria-pressed', calm ? 'true' : 'false');
    syncQuiet();
  }

  function setSound(on) {
    soundOn = !!on;
    soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
  }

  function readVoices() {
    try { voices = window.speechSynthesis ? (window.speechSynthesis.getVoices() || []) : []; }
    catch (e) { voices = []; }
    return voices;
  }

  function say(text) {
    if (!soundOn || !text) return;
    speech.speak(text, {
      synth: window.speechSynthesis,
      Utterance: window.SpeechSynthesisUtterance,
      voices: readVoices(),
      rate: 0.86,
      pitch: 1.08
    });
  }

  function ensureAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) {
      try { audioCtx = new AC(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') {
      try { audioCtx.resume(); } catch (e2) { /* the beep can wait */ }
    }
    return audioCtx;
  }

  function tone(ctx, freq, t, dur, gain) {
    var now = ctx.currentTime;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, now + t);
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.exponentialRampToValueAtTime(gain, now + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(now + t);
    o.stop(now + t + dur + 0.02);
  }

  function beep(kind) {
    if (!soundOn) return;
    var ctx = ensureAudio();
    if (!ctx) return;
    if (kind === 'win') {
      tone(ctx, 523, 0, 0.14, 0.07);
      tone(ctx, 659, 0.1, 0.16, 0.07);
      tone(ctx, 784, 0.2, 0.22, 0.06);
    } else if (kind === 'ask') {
      tone(ctx, 440, 0, 0.12, 0.05);
      tone(ctx, 554, 0.12, 0.14, 0.05);
    } else if (kind === 'tap') {
      tone(ctx, 620, 0, 0.06, 0.035);
    } else {
      tone(ctx, 247, 0, 0.16, 0.035);
    }
  }

  function syncChrome() {
    var playing = phase !== 'pick';
    wordsBtn.hidden = !playing;
    hearBtn.hidden = !playing;
    clearBtn.hidden = !playing;
    nextBtn.hidden = !playing;
    pick.hidden = playing;
    play.hidden = !playing;
  }

  function clearChoices() {
    clearKids(choices);
    choices.hidden = true;
  }

  function clearBurst() {
    clearKids(burst);
  }

  function showHearts() {
    var i;
    var bit;
    clearBurst();
    for (i = 0; i < 7; i++) {
      bit = document.createElement('span');
      bit.className = 'bit p' + i + (motionOn() ? ' fly' : ' sit');
      bit.appendChild(heartMark());
      burst.appendChild(bit);
    }
  }

  function renderChoices(list) {
    clearKids(choices);
    choices.hidden = false;
    list.forEach(function (word) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = word;
      btn.addEventListener('click', function () {
        ensureAudio();
        applyResult(ink.judgeChoice(word, current.w));
      });
      choices.appendChild(btn);
    });
  }

  function applyResult(result) {
    hint.textContent = result.prompt;
    if (result.action === 'celebrate') {
      clearChoices();
      setPhase('done');
      showHearts();
      beep('win');
    } else if (result.action === 'ask') {
      setPhase('ask');
      clearBurst();
      renderChoices(result.choices);
      beep('ask');
    } else if (result.action === 'empty') {
      clearChoices();
      clearBurst();
      setPhase('write');
    } else {
      clearChoices();
      clearBurst();
      setPhase('retry');
      beep('retry');
    }
    syncChrome();
  }

  function paperBox() {
    return { w: pad.clientWidth, h: pad.clientHeight, pad: Math.max(18, Math.min(pad.clientWidth, pad.clientHeight) * 0.06) };
  }

  function redraw() {
    var w = pad.clientWidth;
    var h = pad.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var ctx;
    var width;
    var s;
    if (w < 2 || h < 2) return;
    pad.width = Math.max(1, Math.round(w * dpr));
    pad.height = Math.max(1, Math.round(h * dpr));
    ctx = pad.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    width = Math.max(8, Math.min(18, Math.min(w, h) * 0.03));
    ctx.strokeStyle = '#3a46c8';
    ctx.fillStyle = '#3a46c8';
    for (s = 0; s < strokes.length; s++) drawStroke(ctx, strokes[s], width);
    ghost.hidden = strokes.some(function (stroke) { return stroke && stroke.length; });
  }

  function drawStroke(ctx, stroke, width) {
    var i;
    if (!stroke || !stroke.length) return;
    ctx.lineWidth = width;
    if (stroke.length === 1) {
      ctx.beginPath();
      ctx.arc(stroke[0].x, stroke[0].y, width * 0.55, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
    ctx.stroke();
  }

  function pointOf(e) {
    var r = pad.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function beginStroke(e) {
    var p;
    if (drawing != null) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    try { pad.setPointerCapture(e.pointerId); } catch (err) { /* a mouse can live without capture */ }
    drawing = e.pointerId;
    ensureAudio();
    if (phase === 'ask' || phase === 'done' || phase === 'retry') {
      clearChoices();
      clearBurst();
      setPhase('write');
      hint.textContent = WRITE_HINT;
    }
    p = pointOf(e);
    strokes.push([p]);
    redraw();
  }

  function extendStroke(e) {
    var list;
    var stroke;
    var i;
    var p;
    var last;
    var dx;
    var dy;
    if (drawing !== e.pointerId) return;
    e.preventDefault();
    list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    stroke = strokes[strokes.length - 1];
    if (!stroke) return;
    for (i = 0; i < list.length; i++) {
      p = pointOf(list[i]);
      last = stroke[stroke.length - 1];
      dx = p.x - last.x;
      dy = p.y - last.y;
      if (dx * dx + dy * dy < 2.25) continue;
      stroke.push(p);
    }
    redraw();
  }

  function endStroke(e) {
    if (drawing == null) return;
    if (e && e.pointerId != null && drawing !== e.pointerId) return;
    drawing = null;
    redraw();
  }

  function submit() {
    if (!current || phase === 'pick') return;
    ensureAudio();
    applyResult(ink.planWrite(ink.read(strokes), current.w));
  }

  function wipe() {
    strokes = [];
    drawing = null;
    clearChoices();
    clearBurst();
    setPhase('write');
    hint.textContent = WRITE_HINT;
    redraw();
  }

  function openWord(word, opts) {
    opts = opts || {};
    current = word;
    wordIndex = 0;
    var i;
    for (i = 0; i < words.DEMO.length; i++) {
      if (words.DEMO[i].w === word.w) wordIndex = i;
    }
    strokes = [];
    drawing = null;
    clearChoices();
    clearBurst();
    clearKids(show);
    fillRuns(show, word);
    sentence.textContent = word.sentence;
    setPhase('write');
    hint.textContent = WRITE_HINT;
    syncChrome();
    if (opts.speak) say(word.w);
    window.requestAnimationFrame(redraw);
  }

  function showPick() {
    current = null;
    strokes = [];
    clearChoices();
    clearBurst();
    setPhase('pick');
    hint.textContent = 'Pick a heart word.';
    syncChrome();
  }

  function renderGrid() {
    clearKids(grid);
    words.DEMO.forEach(function (word) {
      var btn = document.createElement('button');
      var line = document.createElement('span');
      var sent = document.createElement('span');
      btn.type = 'button';
      btn.className = 'word';
      line.className = 'word-line';
      sent.className = 'sentence';
      sent.textContent = word.sentence;
      fillRuns(line, word);
      btn.appendChild(line);
      btn.appendChild(sent);
      btn.addEventListener('click', function () {
        ensureAudio();
        beep('tap');
        openWord(word, { speak: true });
      });
      grid.appendChild(btn);
    });
  }

  function whenPaperReady(fn) {
    function tick(left) {
      if (pad.clientWidth > 40 && pad.clientHeight > 40) fn();
      else if (left > 0) window.requestAnimationFrame(function () { tick(left - 1); });
    }
    tick(20);
  }

  function paintSample(kind, word) {
    whenPaperReady(function () {
      var box = paperBox();
      var askInk = kind === 'ask' || kind === 'demo-ask';
      strokes = askInk ? samples.askStrokes(word.w, box) : samples.wordStrokes(word.w, box);
      redraw();
      if (kind === 'demo-clear' || kind === 'demo-ask') submit();
    });
  }

  function boot() {
    var q = params();
    var sample = q.sample || '';
    var demo = q.demo || '';
    var want = q.word || '';
    var asking = sample === 'ask' || demo === 'ask';
    var word;
    renderGrid();
    try {
      var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      reduce = !!(mq && mq.matches);
      if (mq && mq.addEventListener) {
        mq.addEventListener('change', function () {
          reduce = !!mq.matches;
          syncQuiet();
        });
      }
    } catch (e) { reduce = false; }
    if (q.calm === '1') calm = true;
    if (q.sound === '0') soundOn = false;
    setCalm(calm);
    setSound(soundOn);
    readVoices();
    if (window.speechSynthesis && window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', readVoices);
    }
    if (asking && !want) want = samples.ASK_WORD;
    if (want || sample || demo) {
      word = words.find(want) || words.DEMO[0];
      if (asking && word.w.indexOf('a') < 0 && word.w.indexOf('o') < 0) word = words.find(samples.ASK_WORD);
      openWord(word, { speak: false });
      if (sample === 'clear' || demo === 'clear') paintSample(demo === 'clear' ? 'demo-clear' : 'clear', word);
      else if (asking) paintSample(demo === 'ask' ? 'demo-ask' : 'ask', word);
    } else {
      showPick();
    }
  }

  wordsBtn.addEventListener('click', function () {
    ensureAudio();
    showPick();
  });
  hearBtn.addEventListener('click', function () {
    ensureAudio();
    if (current) say(current.w);
  });
  clearBtn.addEventListener('click', function () {
    ensureAudio();
    beep('tap');
    wipe();
  });
  nextBtn.addEventListener('click', function () {
    ensureAudio();
    beep('tap');
    wordIndex = (wordIndex + 1) % words.DEMO.length;
    openWord(words.DEMO[wordIndex], { speak: true });
  });
  calmBtn.addEventListener('click', function () { setCalm(!calm); });
  soundBtn.addEventListener('click', function () { setSound(!soundOn); });
  submitBtn.addEventListener('click', function () { submit(); });

  pad.addEventListener('pointerdown', beginStroke);
  pad.addEventListener('pointermove', extendStroke);
  pad.addEventListener('pointerup', endStroke);
  pad.addEventListener('pointercancel', endStroke);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.repeat || phase === 'pick') return;
    if (e.target && e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    submit();
  });

  window.addEventListener('resize', redraw);
  boot();
})();
