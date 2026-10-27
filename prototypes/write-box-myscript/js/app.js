/* MyScript write box. Hear a heart word, write it, tap Check.

   Ink stays in the browser until Check. Check asks iinkTS (INK_V2)
   for one TEXT read from MyScript Cloud. Strokes do not call the cloud.
   This folder does not open the word garden or the offline write box.
   Nothing is saved. */
(function () {
  'use strict';

  var words = window.WriteWords;
  var speech = window.WriteSpeech;
  var check = window.WriteCheck;

  var pick = document.getElementById('pick');
  var play = document.getElementById('play');
  var grid = document.getElementById('word-grid');
  var show = document.getElementById('show');
  var sentence = document.getElementById('sentence');
  var inkEl = document.getElementById('ink');
  var ghost = document.getElementById('ghost');
  var burst = document.getElementById('burst');
  var cloud = document.getElementById('cloud');
  var hint = document.getElementById('hint');
  var keyPanel = document.getElementById('key-panel');
  var keySummary = document.getElementById('key-summary');
  var keyForm = document.getElementById('key-form');
  var keyApp = document.getElementById('key-app');
  var keyHmac = document.getElementById('key-hmac');
  var keyError = document.getElementById('key-error');
  var keySaved = document.getElementById('key-saved');
  var keyMask = document.getElementById('key-mask');
  var clearKeysBtn = document.getElementById('clear-keys');
  var wordsBtn = document.getElementById('words');
  var hearBtn = document.getElementById('hear');
  var clearBtn = document.getElementById('clear');
  var nextBtn = document.getElementById('next');
  var calmBtn = document.getElementById('calm');
  var soundBtn = document.getElementById('sound');
  var checkBtn = document.getElementById('check');
  var heartShape = document.getElementById('heart-shape');

  var WRITE_HINT = 'Write it in the box, then tap Check.';
  var MISSING = check.MISSING_KEYS;
  var keysOn = false;
  var canvasGen = 0;
  var current = null;
  var wordIndex = 0;
  var phase = 'pick';
  var calm = false;
  var soundOn = true;
  var reduce = false;
  var audioCtx = null;
  var voices = [];
  var canvas = null;
  var booting = null;
  var busy = false;
  var shell = false;

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
    syncChrome();
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
    if (shell) {
      wordsBtn.hidden = true;
      nextBtn.hidden = phase !== 'done';
    }
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

  function hideCloud() {
    cloud.hidden = true;
    cloud.textContent = '';
  }

  function showCloud(text) {
    cloud.hidden = false;
    cloud.textContent = text;
  }

  function strokeCount() {
    if (!canvas || !canvas.model || !canvas.model.strokes) return 0;
    return canvas.model.strokes.length;
  }

  function storage() {
    try { return window.localStorage; }
    catch (e) { return null; }
  }

  function currentKeys() {
    return check.chooseKeys(check.readStored(storage()), window.MyScriptWriteConfig);
  }

  function refreshKeys() {
    var chosen = currentKeys();
    keysOn = !!chosen;
    if (!chosen) {
      keyPanel.hidden = false;
      keyPanel.open = true;
      keyForm.hidden = false;
      keySaved.hidden = true;
      keySummary.textContent = 'Add MyScript keys';
      keyMask.textContent = '';
    } else if (chosen.source === 'storage') {
      keyPanel.hidden = false;
      keyPanel.open = false;
      keyForm.hidden = true;
      keySaved.hidden = false;
      keySummary.textContent = 'Keys saved';
      keyMask.textContent = 'Saved on this iPad. ' + check.maskKey(chosen.applicationKey) + ' and ' + check.maskKey(chosen.hmacKey) + '.';
    } else {
      keyPanel.hidden = true;
      keyMask.textContent = '';
    }
    syncGhost();
  }

  function syncGhost() {
    if (!keysOn) {
      ghost.hidden = false;
      ghost.textContent = MISSING;
      return;
    }
    ghost.textContent = 'Write here';
    ghost.hidden = strokeCount() > 0;
  }

  function setBusy(on) {
    busy = !!on;
    checkBtn.disabled = busy;
    clearBtn.disabled = busy;
    nextBtn.disabled = busy;
    wordsBtn.disabled = busy;
    checkBtn.textContent = busy ? 'Reading\u2026' : 'Check';
    inkEl.style.pointerEvents = busy ? 'none' : '';
  }

  function whenPaperReady(fn) {
    function tick(left) {
      if (inkEl.clientWidth > 40 && inkEl.clientHeight > 40) fn();
      else if (left > 0) window.requestAnimationFrame(function () { tick(left - 1); });
      else fn();
    }
    tick(30);
  }

  function canvasOptions() {
    var cfg = currentKeys() || {};
    return {
      configuration: {
        server: {
          scheme: 'https',
          host: 'cloud.myscript.com',
          applicationKey: String(cfg.applicationKey || '').trim(),
          hmacKey: String(cfg.hmacKey || '').trim()
        },
        recognition: {
          type: 'TEXT',
          lang: 'en_US',
          text: {
            mimeTypes: ['text/plain']
          }
        },
        rendering: {
          minWidth: 100,
          minHeight: 100,
          guides: { enable: false }
        },
        triggers: {
          exportContent: 'DEMAND'
        },
        penStyle: {
          color: '#3a46c8',
          width: 4
        },
        ui: {
          showConnectionState: false
        }
      }
    };
  }

  function dropCanvas() {
    canvasGen += 1;
    var dying = canvas;
    canvas = null;
    booting = null;
    if (dying && dying.destroy) {
      return Promise.resolve(dying.destroy()).catch(function () {});
    }
    return Promise.resolve();
  }

  function ensureCanvas() {
    if (!keysOn) return Promise.resolve(null);
    if (canvas) return Promise.resolve(canvas);
    if (booting) return booting;
    if (!window.iink || !window.iink.Canvas || !window.iink.Canvas.load) {
      return Promise.reject(new Error('MyScript iink did not load.'));
    }
    var gen = canvasGen;
    booting = new Promise(function (resolve, reject) {
      whenPaperReady(function () {
        if (gen !== canvasGen) {
          resolve(null);
          return;
        }
        Promise.resolve(window.iink.Canvas.load(inkEl, 'INK_V2', canvasOptions())).then(function (next) {
          if (gen !== canvasGen) {
            if (next && next.destroy) Promise.resolve(next.destroy()).catch(function () {});
            resolve(null);
            return;
          }
          canvas = next;
          booting = null;
          resolve(next);
        }).catch(function (err) {
          if (gen === canvasGen) booting = null;
          reject(err);
        });
      });
    });
    return booting;
  }

  function errorLine(err) {
    var msg = err && err.message ? String(err.message) : 'The handwriting cloud did not answer.';
    msg = msg.replace(/\s+/g, ' ').trim();
    if (msg.length > 140) msg = msg.slice(0, 139) + '\u2026';
    return msg;
  }

  function failCloud(err) {
    setPhase('retry');
    hint.textContent = 'The handwriting cloud did not answer. Try again.';
    showCloud(errorLine(err));
    clearBurst();
    beep('retry');
  }

  function applyVerdict(raw) {
    var verdict = check.judge(raw, current.w);
    var seen = check.preview(raw);
    if (verdict.match) {
      hideCloud();
      setPhase('done');
      hint.textContent = 'You wrote it!';
      showHearts();
      beep('win');
      return;
    }
    clearBurst();
    setPhase('retry');
    if (verdict.empty) {
      hint.textContent = 'I couldn\'t quite read that. Try again.';
      hideCloud();
    } else {
      hint.textContent = 'Let\'s try that once more.';
      showCloud('I read "' + (seen || verdict.got) + '".');
    }
    beep('retry');
  }

  function runCheck() {
    if (!current || phase === 'pick' || busy) return;
    ensureAudio();
    if (!keysOn) {
      hint.textContent = MISSING;
      refreshKeys();
      return;
    }
    setBusy(true);
    hint.textContent = 'Reading your word\u2026';
    hideCloud();
    ensureCanvas().then(function (box) {
      if (!box) {
        setBusy(false);
        hint.textContent = MISSING;
        return;
      }
      if (!strokeCount()) {
        setBusy(false);
        setPhase('write');
        hint.textContent = 'Write it in the box, then tap Check.';
        syncGhost();
        return;
      }
      /* One mime type, so HTTPClientV2 posts once to /api/v4.0/iink/recognize.
         DEMAND means pen-up did not already export. */
      return Promise.resolve(box.export(['text/plain'])).then(function (result) {
        var raw = result && result['text/plain'];
        setBusy(false);
        applyVerdict(raw);
        syncGhost();
      });
    }).catch(function (err) {
      setBusy(false);
      failCloud(err);
      syncGhost();
    });
  }

  function wipeInk() {
    hideCloud();
    clearBurst();
    if (canvas && canvas.clear) {
      try { Promise.resolve(canvas.clear()).catch(function () {}); }
      catch (e) { /* a local clear can fail closed */ }
    }
    syncGhost();
  }

  function openWord(word, opts) {
    opts = opts || {};
    current = word;
    wordIndex = 0;
    var i;
    for (i = 0; i < words.DEMO.length; i++) {
      if (words.DEMO[i].w === word.w) wordIndex = i;
    }
    clearKids(show);
    fillRuns(show, word);
    sentence.textContent = word.sentence;
    setPhase('write');
    hint.textContent = WRITE_HINT;
    syncChrome();
    wipeInk();
    if (keysOn) {
      ensureCanvas().then(function (box) {
        if (box && box.resize) return box.resize();
      }).catch(function (err) {
        failCloud(err);
      });
    }
    if (opts.speak) say(word.w);
  }

  function showPick() {
    current = null;
    wipeInk();
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

  function postWrite() {
    if (!shell || !window.parent || window.parent === window) return;
    try {
      window.parent.postMessage({
        source: 'lesson-shell',
        step: 'write',
        done: true,
        wordId: current ? current.id : ''
      }, window.location.origin);
    } catch (err) { /* the shell is gone */ }
  }

  function boot() {
    var q = params();
    shell = q.shell === '1';
    if (shell) document.body.classList.add('shell');
    var want = q.word || '';
    var word;
    refreshKeys();
    renderGrid();
    syncGhost();
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
    if (want) {
      word = words.find(want) || words.DEMO[0];
      openWord(word, { speak: false });
    } else {
      showPick();
    }
  }

  wordsBtn.addEventListener('click', function () {
    if (busy) return;
    ensureAudio();
    showPick();
  });
  hearBtn.addEventListener('click', function () {
    ensureAudio();
    if (current) say(current.w);
  });
  clearBtn.addEventListener('click', function () {
    if (busy) return;
    ensureAudio();
    beep('tap');
    setPhase('write');
    hint.textContent = WRITE_HINT;
    wipeInk();
  });
  nextBtn.addEventListener('click', function () {
    if (busy) return;
    if (shell && phase === 'done') {
      nextBtn.disabled = true;
      postWrite();
      return;
    }
    ensureAudio();
    beep('tap');
    wordIndex = (wordIndex + 1) % words.DEMO.length;
    openWord(words.DEMO[wordIndex], { speak: true });
  });
  calmBtn.addEventListener('click', function () { setCalm(!calm); });
  soundBtn.addEventListener('click', function () { setSound(!soundOn); });
  checkBtn.addEventListener('click', function () { runCheck(); });

  inkEl.addEventListener('pointerdown', function () {
    if (!keysOn || busy) return;
    ghost.hidden = true;
    if (phase === 'done' || phase === 'retry') {
      clearBurst();
      hideCloud();
      setPhase('write');
      hint.textContent = WRITE_HINT;
    }
  });
  inkEl.addEventListener('pointerup', syncGhost);
  inkEl.addEventListener('pointercancel', syncGhost);

  function blankKeyFields() {
    keyApp.value = '';
    keyHmac.value = '';
  }

  function saveKeys(event) {
    if (event) event.preventDefault();
    var app = keyApp.value;
    var hmac = keyHmac.value;
    if (!check.keysReady({ applicationKey: app, hmacKey: hmac })) {
      keyError.hidden = false;
      keyError.textContent = 'Paste both keys, then tap Save.';
      return;
    }
    try {
      check.writeStored(storage(), { applicationKey: app, hmacKey: hmac });
    } catch (err) {
      keyError.hidden = false;
      keyError.textContent = 'This iPad could not store the keys.';
      return;
    }
    blankKeyFields();
    keyError.hidden = true;
    refreshKeys();
    dropCanvas().then(function () {
      if (phase === 'pick') {
        hint.textContent = 'Keys saved. Pick a heart word.';
        return;
      }
      hint.textContent = WRITE_HINT;
      return ensureCanvas();
    }).catch(function (err) {
      failCloud(err);
    });
  }

  function wipeSavedKeys() {
    try { check.clearStored(storage()); }
    catch (err) { /* a blocked store is already empty */ }
    blankKeyFields();
    keyError.hidden = true;
    dropCanvas().then(function () {
      refreshKeys();
      if (keysOn && phase !== 'pick') {
        hint.textContent = WRITE_HINT;
        return ensureCanvas();
      }
      if (!keysOn && phase !== 'pick') hint.textContent = MISSING;
      if (!keysOn && phase === 'pick') hint.textContent = 'Pick a heart word.';
    });
  }

  keyForm.addEventListener('submit', saveKeys);
  clearKeysBtn.addEventListener('click', wipeSavedKeys);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.repeat || phase === 'pick') return;
    var tag = e.target && e.target.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SUMMARY') return;
    e.preventDefault();
    runCheck();
  });

  window.addEventListener('resize', function () {
    if (canvas && canvas.resize) {
      try { canvas.resize(); } catch (e) { /* the library also watches size */ }
    }
  });

  boot();
})();
