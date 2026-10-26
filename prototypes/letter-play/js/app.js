/* Letter play. See a heart word, then paint it.

   The ribbon is a guide, not a grade. Paint stays. Misses are the same
   marker as hits. Calm and Reduce Motion skip the wiggle and the confetti. */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var osReduce = false;
  try {
    osReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { osReduce = false; }

  var state = {
    phase: 'pick',
    index: 0,
    mode: 'letter',
    at: 0,
    strokes: [],
    sheet: null,
    celebrated: false,
    reduced: params.get('calm') === '1' || osReduce,
    osReduce: osReduce,
    still: params.get('still') === '1',
    sound: params.get('sound') !== '0',
    pointer: null,
    voices: []
  };

  var stage = document.getElementById('stage');
  var hintEl = document.getElementById('hint');
  var liveEl = document.getElementById('live');
  var calmBtn = document.getElementById('calm');
  var soundBtn = document.getElementById('sound');
  var wordsBtn = document.getElementById('words');
  var pickEl = document.getElementById('pick');
  var gridEl = document.getElementById('word-grid');
  var lookEl = document.getElementById('look');
  var lookWordEl = document.getElementById('look-word');
  var sentenceEl = document.getElementById('sentence');
  var paintEl = document.getElementById('paint');
  var bannerEl = document.getElementById('banner');
  var paperEl = document.getElementById('paper');
  var slate = document.getElementById('slate');
  var hearLookBtn = document.getElementById('hear-look');
  var paintLettersBtn = document.getElementById('paint-letters');
  var paintWordBtn = document.getElementById('paint-word');
  var anotherBtn = document.getElementById('another');
  var hearBtn = document.getElementById('hear');
  var backBtn = document.getElementById('back');
  var nextBtn = document.getElementById('next');
  var modeLetterBtn = document.getElementById('mode-letter');
  var modeWordBtn = document.getElementById('mode-word');
  var burstEl = document.getElementById('burst');
  var heartShape = document.getElementById('heart-shape');
  var ctx = slate.getContext('2d');
  var raf = 0;
  var primed = false;
  var audioCtx = null;
  var lastSize = '';

  function current() {
    return LetterWords.DEMO[state.index] || LetterWords.DEMO[0];
  }

  function motionOn() {
    return !state.reduced && !state.osReduce && !state.still;
  }

  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }

  function heartNode() {
    var node = heartShape.cloneNode(true);
    node.removeAttribute('id');
    node.removeAttribute('hidden');
    node.setAttribute('class', 'mark');
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  function fillWord(el, word, active) {
    el.textContent = '';
    el.setAttribute('aria-label', word.w);
    var n = 0;
    var i;
    var run;
    var span;
    var glyphs;
    var k;
    var ch;
    for (i = 0; i < word.runs.length; i++) {
      run = word.runs[i];
      span = document.createElement('span');
      span.className = 'run' + (run.heart ? ' heart' : '');
      glyphs = document.createElement('span');
      glyphs.className = 'glyphs';
      for (k = 0; k < run.text.length; k++) {
        ch = document.createElement('span');
        ch.className = 'ch' + (n === active ? ' now' : '');
        ch.textContent = run.text.charAt(k);
        glyphs.appendChild(ch);
        n++;
      }
      span.appendChild(glyphs);
      if (run.heart) span.appendChild(heartNode());
      el.appendChild(span);
    }
  }

  function applyChrome() {
    document.body.classList.toggle('calm', !motionOn());
    document.body.classList.toggle('still', !!state.still);
    document.body.classList.toggle('celebrate', !!state.celebrated);
    document.body.setAttribute('data-phase', state.phase);
    calmBtn.setAttribute('aria-pressed', state.reduced || state.osReduce ? 'true' : 'false');
    setText(calmBtn, state.reduced || state.osReduce ? 'Calm on' : 'Calm');
    soundBtn.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
    setText(soundBtn, state.sound ? 'Sound' : 'Sound off');
    wordsBtn.hidden = state.phase === 'pick';
    pickEl.hidden = state.phase !== 'pick';
    lookEl.hidden = state.phase !== 'look';
    paintEl.hidden = state.phase !== 'paint';
    if (state.phase === 'paint') {
      modeLetterBtn.setAttribute('aria-pressed', state.mode === 'letter' ? 'true' : 'false');
      modeWordBtn.setAttribute('aria-pressed', state.mode === 'word' ? 'true' : 'false');
      if (state.mode === 'word') setText(nextBtn, 'Paint again');
      else if (state.at >= current().letters.length - 1) setText(nextBtn, 'Whole word');
      else setText(nextBtn, 'Next letter');
      setText(backBtn, state.mode === 'letter' && state.at === 0 ? 'See the word' : 'Back');
    }
  }

  function hintFor() {
    var word = current();
    if (state.phase === 'pick') return 'Pick a heart word.';
    if (state.phase === 'look') return word.w + '. The pink letters have hearts.';
    if (state.celebrated) {
      return state.mode === 'word' ? 'You painted the word!' : 'You painted it!';
    }
    if (state.mode === 'word') return 'Paint the whole word.';
    var L = word.letters[state.at];
    if (L && L.red) return 'Paint this pink heart letter.';
    return 'Paint this letter.';
  }

  function updateHint() {
    var text = hintFor();
    setText(hintEl, text);
  }

  function show(phase) {
    state.phase = phase;
    if (phase !== 'paint') state.celebrated = false;
    applyChrome();
    updateHint();
    if (phase === 'look') {
      var word = current();
      fillWord(lookWordEl, word, -1);
      setText(sentenceEl, word.sentence);
      setText(liveEl, word.w + '. The pink letters have hearts.');
    }
    if (phase === 'paint') {
      fillWord(bannerEl, current(), state.mode === 'letter' ? state.at : -1);
      requestAnimationFrame(function () { rebuild(true); });
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function itemsFor() {
    var word = current();
    if (state.mode === 'letter') {
      var L = word.letters[state.at] || word.letters[0];
      return [{ ch: L.ch, heart: !!L.red }];
    }
    return word.letters.map(function (L) {
      return { ch: L.ch, heart: !!L.red };
    });
  }

  function fitCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, paperEl.clientWidth);
    var h = Math.max(1, paperEl.clientHeight);
    var key = w + 'x' + h + '@' + dpr;
    if (key !== lastSize) {
      lastSize = key;
      slate.width = Math.round(w * dpr);
      slate.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h };
  }

  function rebuild(keepInk) {
    if (state.phase !== 'paint') return;
    var size = fitCanvas();
    if (!keepInk) state.strokes = [];
    state.sheet = LetterRibbon.layout(itemsFor(), { x: 0, y: 0, w: size.w, h: size.h });
    var i;
    for (i = 0; i < state.strokes.length; i++) LetterRibbon.paint(state.sheet, state.strokes[i]);
    if (state.sheet.done && !state.celebrated) celebrate();
    applyChrome();
    updateHint();
    requestDraw();
  }

  function freshLetter() {
    state.strokes = [];
    state.celebrated = false;
    burstEl.textContent = '';
    fillWord(bannerEl, current(), state.mode === 'letter' ? state.at : -1);
    var spoken = current().letters[state.at];
    if (state.mode === 'letter' && spoken) {
      setText(liveEl, 'Paint ' + spoken.ch + '.');
      slate.setAttribute('aria-label', 'Paint the letter ' + spoken.ch);
    }
    if (state.mode === 'word') {
      setText(liveEl, 'Paint the whole word.');
      slate.setAttribute('aria-label', 'Paint the word ' + current().w);
    }
    rebuild(false);
  }

  function readVoices() {
    var synth = window.speechSynthesis;
    if (!synth || !synth.getVoices) return state.voices;
    try { state.voices = synth.getVoices() || []; } catch (e) { state.voices = []; }
    return state.voices;
  }

  function sayCurrent() {
    var word = current();
    if (!word || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    LetterSpeech.speak(word.w, {
      synth: window.speechSynthesis,
      Utterance: window.SpeechSynthesisUtterance,
      voices: readVoices(),
      rate: 0.86,
      pitch: 1.08
    });
  }

  function audio() {
    if (!state.sound) return null;
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
    var ac = audio();
    if (!ac) return;
    var t = ac.currentTime + delay;
    var o = ac.createOscillator();
    var g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function pop() {
    tone(520, 0, 0.07, 'sine', 0.045);
  }

  function chime() {
    if (!state.sound) return;
    tone(523, 0, 0.16, 'triangle', 0.05);
    tone(659, 0.07, 0.16, 'triangle', 0.05);
    tone(784, 0.14, 0.18, 'triangle', 0.05);
    tone(1046, 0.21, 0.22, 'triangle', 0.045);
  }

  function burst() {
    if (!motionOn()) return;
    burstEl.textContent = '';
    var i;
    var bit;
    for (i = 0; i < 12; i++) {
      bit = document.createElement('i');
      bit.className = 'bit ' + (i % 2 ? 'heartbit' : 'starbit');
      burstEl.appendChild(bit);
    }
  }

  function celebrate() {
    if (state.celebrated || !state.sheet || !state.sheet.done) return;
    state.celebrated = true;
    var line = state.mode === 'word' ? 'You painted the word!' : 'You painted it!';
    setText(liveEl, line);
    applyChrome();
    updateHint();
    burst();
    chime();
  }

  function colorAt(x, y) {
    var letters = state.sheet ? state.sheet.letters : [];
    var best = letters[0];
    var bestD = Infinity;
    var i;
    var L;
    var cx;
    var cy;
    var d;
    for (i = 0; i < letters.length; i++) {
      L = letters[i];
      cx = L.cell.x + L.cell.w / 2;
      cy = L.cell.y + L.cell.h / 2;
      d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d < bestD) {
        bestD = d;
        best = L;
      }
    }
    if (best && best.heart) return '#e21870';
    return '#1f86f0';
  }

  function strokePoly(g, pts, width, color, ox, oy) {
    if (!pts || !pts.length) return;
    g.beginPath();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = width;
    g.strokeStyle = color;
    if (pts.length === 1) {
      g.fillStyle = color;
      g.arc(pts[0].x + ox, pts[0].y + oy, width / 2, 0, Math.PI * 2);
      g.fill();
      return;
    }
    g.moveTo(pts[0].x + ox, pts[0].y + oy);
    var i;
    for (i = 1; i < pts.length; i++) g.lineTo(pts[i].x + ox, pts[i].y + oy);
    var a = pts[0];
    var b = pts[pts.length - 1];
    if ((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) < 9) g.closePath();
    g.stroke();
  }

  function glyphBox(letter) {
    var top = Infinity;
    var left = Infinity;
    var right = -Infinity;
    var i;
    var j;
    var p;
    for (i = 0; i < letter.polys.length; i++) {
      for (j = 0; j < letter.polys[i].length; j++) {
        p = letter.polys[i][j];
        if (p.y < top) top = p.y;
        if (p.x < left) left = p.x;
        if (p.x > right) right = p.x;
      }
    }
    return { top: top, mid: (left + right) / 2 };
  }

  /* x,y is the bottom center, so the heart sits on the letter. */
  function drawHeart(g, x, y, size) {
    g.save();
    g.translate(x, y);
    g.scale(size / 24, size / 22);
    g.translate(-12, -20);
    g.beginPath();
    g.moveTo(12, 20.4);
    g.bezierCurveTo(8.4, 17.2, 2.2, 13.1, 2.2, 8.2);
    g.bezierCurveTo(2.2, 5.1, 4.5, 3.1, 7, 3.5);
    g.bezierCurveTo(8.7, 3.7, 9.9, 4.8, 10.6, 6);
    g.bezierCurveTo(11.2, 4.5, 12.6, 3.4, 14.4, 3.4);
    g.bezierCurveTo(17.1, 3.4, 19.4, 5.3, 19.4, 8.5);
    g.bezierCurveTo(19.4, 13.4, 14, 17.3, 12, 20.4);
    g.closePath();
    g.fillStyle = '#ff3d84';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.8;
    g.lineJoin = 'round';
    g.stroke();
    g.fill();
    g.restore();
  }

  function drawInk(g) {
    var sheet = state.sheet;
    if (!sheet || !sheet.letters.length) return;
    var width = Math.max(16, LetterRibbon.TUBE * 2 * sheet.letters[0].scale * 0.96);
    var s;
    var pts;
    var i;
    var a;
    var b;
    for (s = 0; s < state.strokes.length; s++) {
      pts = state.strokes[s];
      if (!pts.length) continue;
      if (pts.length === 1) {
        g.beginPath();
        g.fillStyle = colorAt(pts[0].x, pts[0].y);
        g.arc(pts[0].x, pts[0].y, width / 2, 0, Math.PI * 2);
        g.fill();
        continue;
      }
      for (i = 1; i < pts.length; i++) {
        a = pts[i - 1];
        b = pts[i];
        g.beginPath();
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.lineWidth = width;
        g.strokeStyle = colorAt((a.x + b.x) / 2, (a.y + b.y) / 2);
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
      }
      g.beginPath();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.lineWidth = width * 0.33;
      g.strokeStyle = 'rgba(255,255,255,0.42)';
      g.moveTo(pts[0].x, pts[0].y - width * 0.1);
      for (i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y - width * 0.1);
      g.stroke();
    }
  }

  function draw(now) {
    var size = fitCanvas();
    ctx.clearRect(0, 0, size.w, size.h);
    var sheet = state.sheet;
    if (!sheet) return;
    var bob = 0;
    if (motionOn()) bob = Math.sin((now || 0) / 420) * 3;
    var i;
    var L;
    var w;
    var heart;
    for (i = 0; i < sheet.letters.length; i++) {
      L = sheet.letters[i];
      w = Math.max(14, LetterRibbon.TUBE * 2 * L.scale);
      var pi;
      for (pi = 0; pi < L.polys.length; pi++) strokePoly(ctx, L.polys[pi], w + 7, 'rgba(80, 40, 70, 0.10)', 0, 4);
      for (pi = 0; pi < L.polys.length; pi++) {
        strokePoly(ctx, L.polys[pi], w + 2, L.heart ? '#ff78b3' : '#7ec8f8', 0, 0);
        strokePoly(ctx, L.polys[pi], w * 0.62, L.heart ? '#ffe0ef' : '#f3fbff', 0, 0);
      }
    }
    drawInk(ctx);
    for (i = 0; i < sheet.letters.length; i++) {
      L = sheet.letters[i];
      if (!L.heart) continue;
      var box = glyphBox(L);
      heart = Math.max(16, Math.min(42, L.scale * 28));
      var hy = box.top - LetterRibbon.TUBE * L.scale - 2 + bob;
      if (hy < heart * 0.2) hy = heart * 0.2;
      drawHeart(ctx, box.mid, hy, heart);
    }
  }

  function requestDraw() {
    if (motionOn() && state.phase === 'paint') {
      if (!raf) raf = requestAnimationFrame(frame);
      return;
    }
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    draw(0);
  }

  function frame(now) {
    raf = 0;
    draw(now);
    if (motionOn() && state.phase === 'paint') raf = requestAnimationFrame(frame);
  }

  function localPoint(e) {
    var r = slate.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function pushPoint(stroke, p) {
    var last = stroke[stroke.length - 1];
    if (last) {
      var dx = p.x - last.x;
      var dy = p.y - last.y;
      if (dx * dx + dy * dy < 1.4) return null;
    }
    stroke.push(p);
    return last ? [last, p] : [p];
  }

  function onDown(e) {
    if (state.phase !== 'paint') return;
    if (e.button != null && e.button !== 0) return;
    if (state.pointer != null) return;
    e.preventDefault();
    state.pointer = e.pointerId;
    if (slate.setPointerCapture) {
      try { slate.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    var stroke = [];
    state.strokes.push(stroke);
    var bit = pushPoint(stroke, localPoint(e));
    if (bit && state.sheet) LetterRibbon.paint(state.sheet, bit);
    requestDraw();
  }

  function onMove(e) {
    if (e.pointerId !== state.pointer) return;
    e.preventDefault();
    var stroke = state.strokes[state.strokes.length - 1];
    if (!stroke) return;
    var list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    var i;
    var added;
    var any = false;
    var finished = false;
    for (i = 0; i < list.length; i++) {
      added = pushPoint(stroke, localPoint(list[i]));
      if (added && state.sheet) {
        LetterRibbon.paint(state.sheet, added);
        if (state.sheet.justDone) finished = true;
        any = true;
      }
    }
    if (!any) return;
    if (finished) celebrate();
    requestDraw();
  }

  function onUp(e) {
    if (e.pointerId !== state.pointer) return;
    state.pointer = null;
    if (state.sheet && state.sheet.justDone) celebrate();
    requestDraw();
  }

  function choose(index) {
    state.index = index;
    state.at = 0;
    state.mode = 'letter';
    state.strokes = [];
    state.celebrated = false;
    show('look');
    sayCurrent();
  }

  function startPaint(mode) {
    state.mode = mode;
    state.at = 0;
    state.strokes = [];
    state.celebrated = false;
    show('paint');
  }

  function onNext() {
    pop();
    var word = current();
    if (state.mode === 'word') {
      state.strokes = [];
      state.celebrated = false;
      burstEl.textContent = '';
      freshLetter();
      return;
    }
    if (state.at >= word.letters.length - 1) {
      state.mode = 'word';
      state.strokes = [];
      state.celebrated = false;
      freshLetter();
      return;
    }
    state.at += 1;
    freshLetter();
  }

  function onBack() {
    pop();
    if (state.mode === 'word') {
      state.mode = 'letter';
      state.at = current().letters.length - 1;
      freshLetter();
      return;
    }
    if (state.at > 0) {
      state.at -= 1;
      freshLetter();
      return;
    }
    show('look');
  }

  function buildGrid() {
    var i;
    var btn;
    for (i = 0; i < LetterWords.DEMO.length; i++) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tile';
      fillWord(btn, LetterWords.DEMO[i], -1);
      btn.addEventListener('click', (function (index) {
        return function () {
          pop();
          choose(index);
        };
      })(i));
      gridEl.appendChild(btn);
    }
  }

  function bootWord() {
    var wanted = params.get('word');
    if (!wanted) return;
    var found = LetterWords.find(wanted);
    if (!found) return;
    var i;
    for (i = 0; i < LetterWords.DEMO.length; i++) {
      if (LetterWords.DEMO[i].id === found.id) state.index = i;
    }
    var at = parseInt(params.get('at') || '0', 10);
    if (isNaN(at) || at < 0) at = 0;
    if (at >= found.letters.length) at = found.letters.length - 1;
    state.at = at;
    var play = params.get('play') || 'look';
    if (play === 'letter' || play === 'letters') {
      state.mode = 'letter';
      show('paint');
    } else if (play === 'word') {
      state.mode = 'word';
      show('paint');
    } else {
      show('look');
    }
  }

  buildGrid();
  calmBtn.addEventListener('click', function () {
    pop();
    if (state.osReduce) {
      state.reduced = true;
    } else {
      state.reduced = !state.reduced;
    }
    applyChrome();
    requestDraw();
  });
  soundBtn.addEventListener('click', function () {
    state.sound = !state.sound;
    applyChrome();
    if (state.sound) pop();
  });
  wordsBtn.addEventListener('click', function () {
    pop();
    show('pick');
  });
  hearLookBtn.addEventListener('click', function () {
    pop();
    sayCurrent();
  });
  hearBtn.addEventListener('click', function () {
    pop();
    sayCurrent();
  });
  paintLettersBtn.addEventListener('click', function () {
    pop();
    startPaint('letter');
  });
  paintWordBtn.addEventListener('click', function () {
    pop();
    startPaint('word');
  });
  anotherBtn.addEventListener('click', function () {
    pop();
    show('pick');
  });
  backBtn.addEventListener('click', onBack);
  nextBtn.addEventListener('click', onNext);
  modeLetterBtn.addEventListener('click', function () {
    if (state.mode === 'letter') return;
    pop();
    state.mode = 'letter';
    state.at = 0;
    freshLetter();
  });
  modeWordBtn.addEventListener('click', function () {
    if (state.mode === 'word') return;
    pop();
    state.mode = 'word';
    freshLetter();
  });

  slate.addEventListener('pointerdown', onDown);
  slate.addEventListener('pointermove', onMove);
  slate.addEventListener('pointerup', onUp);
  slate.addEventListener('pointercancel', onUp);
  slate.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  slate.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  document.addEventListener('keydown', function (e) {
    if (state.phase !== 'paint') return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onBack();
    }
  });

  if (window.speechSynthesis) {
    readVoices();
    if (window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', readVoices);
    } else {
      window.speechSynthesis.onvoiceschanged = readVoices;
    }
  }

  try {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var onMq = function () {
      state.osReduce = !!mq.matches;
      if (state.osReduce) state.reduced = true;
      applyChrome();
      requestDraw();
    };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
  } catch (err) { /* ignore */ }

  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      if (state.phase === 'paint') rebuild(true);
    }).observe(paperEl);
  } else {
    window.addEventListener('resize', function () {
      if (state.phase === 'paint') rebuild(true);
    });
  }

  stage.addEventListener('pointerdown', function () { audio(); }, { passive: true });

  show('pick');
  bootWord();
})();
