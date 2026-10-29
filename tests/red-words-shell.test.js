/* Red-words lesson shell: the route, the capsule colors, and the seed tear. */
'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const words = require('../prototypes/red-words-shell/js/words.js');
const flow = require('../prototypes/red-words-shell/js/flow.js');
const Physics = require('../prototypes/claw-machine/js/physics.js');
const Table = require('../prototypes/jumble-spell/js/table.js');
const JumbleWords = require('../prototypes/jumble-spell/js/words.js');

const root = path.join(__dirname, '..');
const shell = path.join(root, 'prototypes', 'red-words-shell');
const IPAD = { w: 1024, h: 768 };

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('the demo pile has one color for each grade', function () {
  assert.equal(words.DEMO.length, 8);
  assert.equal(words.COLORS.k, 0xff4d88);
  assert.equal(words.COLORS['1'], 0xffb020);
  assert.equal(words.COLORS['2'], 0x3d8bff);
  assert.equal(new Set([words.COLORS.k, words.COLORS['1'], words.COLORS['2']]).size, 3);
  assert.deepEqual(words.DEMO.slice(0, 3).map(function (w) { return w.grade; }), ['2', 'k', '1']);
  assert.equal(words.find('because').grade, '2');
  assert.equal(words.find('rw-1-friend').grade, '1');
  assert.equal(words.find('said').grade, 'k');
  assert.equal(words.find('said').color, words.COLORS.k);
  const hearts = words.find('because').runs.filter(function (run) { return run.heart; });
  assert.deepEqual(hearts.map(function (run) { return run.text; }), ['au', 'e']);
  assert.equal(words.pile().length, 8);
  assert.equal(words.find('nope'), null);
});

test('a shell catalog is capsules, and the toy mix stays the default', function () {
  const catalog = words.pile().map(function (word) {
    return { kind: 'capsule', color: word.color, wordId: word.id, grade: word.grade };
  });
  const s = Physics.createState({ catalog: catalog });
  assert.equal(s.prizes.length, Physics.WORLD.slots.length);
  s.prizes.forEach(function (prize, i) {
    assert.equal(prize.kind, 'capsule');
    assert.equal(prize.color, catalog[i].color);
    assert.equal(prize.wordId, catalog[i].wordId);
    assert.equal(prize.grade, catalog[i].grade);
  });
  const plain = Physics.createState();
  assert.equal(plain.prizes[0].kind, 'bear');
  assert.equal(plain.prizes[0].wordId, '');
  assert.notEqual(plain.prizes[0].kind, plain.prizes[1].kind);
  s.wins = 2;
  assert.equal(Physics.refillPile(s), true);
  assert.equal(s.wins, 2);
  assert.equal(s.prizes[0].kind, 'capsule');
  assert.equal(s.prizes[0].wordId, 'rw-2-because');
  const physics = read('prototypes/claw-machine/js/physics.js');
  assert.match(physics, /wordId: prize\.wordId/);
});

test('stage one starts in the slots and stage two starts off the mat', function () {
  const shown = Table.create(JumbleWords.find('said'), IPAD, { seed: 3, decoys: 2 });
  assert.equal(shown.tiles[0].from.x, shown.slots[0].cx);
  assert.equal(shown.tiles[0].from.y, shown.slots[0].cy);

  const blank = Table.create(JumbleWords.find('said'), IPAD, { seed: 3, decoys: 2, blank: true });
  assert.equal(blank.phase, 'deal');
  blank.slots.forEach(function (slot) { assert.equal(slot.tile, null); });
  blank.tiles.forEach(function (tile) {
    if (tile.decoy) return;
    const from = tile.from;
    assert.ok(from.x < 0 || from.x > IPAD.w || from.y < 0 || from.y > IPAD.h);
  });
});

test('the shell walks claw, present, both spells, write, then the seed', function () {
  const start = flow.blankSession();
  const clawed = flow.applyMessage(start, {
    source: flow.SOURCE, step: 'claw', done: true, wordId: 'rw-k-said'
  });
  assert.equal(start.step, 'claw');
  assert.equal(clawed.step, 'reveal');
  assert.equal(clawed.word.w, 'said');
  assert.equal(clawed.word.grade, 'k');
  assert.ok(flow.framePath(clawed).indexOf('../prize-crack/?shell=1&won=capsule&word=said&grade=k&pack=') === 0);
  assert.equal(JSON.parse(decodeURIComponent(flow.framePath(clawed).split('pack=')[1])).w, 'said');

  const opened = flow.applyMessage(clawed, { source: flow.SOURCE, step: 'reveal', done: true });
  assert.equal(opened.step, 'jumble');
  assert.equal(opened.jumbleStage, 1);
  assert.ok(flow.framePath(opened).indexOf('../jumble-spell/?shell=1&word=said&stage=1&pack=') === 0);

  const harder = flow.applyMessage(opened, { source: flow.SOURCE, step: 'jumble', done: false, stage: 2 });
  assert.equal(harder.step, 'jumble');
  assert.equal(harder.jumbleStage, 2);
  assert.ok(flow.framePath(harder).indexOf('../jumble-spell/?shell=1&word=said&stage=2&pack=') === 0);

  const spelled = flow.applyMessage(harder, { source: flow.SOURCE, step: 'jumble', done: true, stage: 2 });
  assert.equal(spelled.step, 'write');
  assert.ok(flow.framePath(spelled).indexOf('../write-box-myscript/?shell=1&word=said&pack=') === 0);

  const wrote = flow.applyMessage(spelled, { source: flow.SOURCE, step: 'write', done: true });
  assert.equal(wrote.step, 'seed');
  const done = flow.finishSeed(wrote);
  assert.equal(done.step, 'done');
  assert.equal(done.hearts, 1);
  assert.equal(flow.finishSeed(done).hearts, 1);

  const again = flow.anotherWord(done);
  assert.equal(again.step, 'claw');
  assert.equal(again.word, null);
  assert.equal(again.hearts, 1);
  assert.equal(again.pile.some(function (item) { return item.w === 'said'; }), false);
  assert.equal(again.pile.length, 7);
  assert.equal(flow.framePath(again), '../claw-machine/?shell=1');

  const stale = flow.applyMessage(wrote, { source: flow.SOURCE, step: 'claw', done: true, wordId: 'the' });
  assert.equal(stale.step, 'seed');
  assert.equal(stale.word.w, 'said');
  const stranger = flow.applyMessage(start, { source: 'other', step: 'claw', done: true });
  assert.equal(stranger.step, 'claw');
});

test('a short sideways tear springs shut and a long one opens', function () {
  const tap = flow.createTear();
  flow.tearTap(tap);
  flow.tearTap(tap);
  assert.equal(tap.open, false);
  flow.tearTap(tap);
  assert.equal(tap.open, true);
  assert.equal(tap.progress, 1);

  const short = flow.createTear();
  flow.tearDown(short, 0);
  flow.tearMove(short, 40);
  flow.tearUp(short);
  assert.equal(short.open, false);
  assert.equal(short.springing, true);
  for (let i = 0; i < 40; i++) flow.tearStep(short, 0.05);
  assert.equal(short.progress, 0);
  assert.equal(short.springing, false);

  const left = flow.createTear();
  flow.tearDown(left, 100);
  flow.tearMove(left, 20);
  flow.tearUp(left);
  assert.equal(left.open, false);
  assert.equal(left.progress, 0);

  const torn = flow.createTear();
  flow.tearDown(torn, 0);
  flow.tearMove(torn, flow.TEAR_PX);
  flow.tearUp(torn);
  assert.equal(torn.open, true);

  const calm = flow.createTear({ reduced: true });
  flow.tearDown(calm, 0);
  flow.tearMove(calm, 30);
  flow.tearUp(calm);
  flow.tearStep(calm, 0.016);
  assert.equal(calm.progress, 0);
  assert.equal(calm.springing, false);
});

test('harder grades roll rarer seeds, and the hatch climbs before it lands', function () {
  assert.deepEqual(flow.TIERS, ['common', 'uncommon', 'rare', 'legendary']);
  assert.equal(flow.rollTier('k', function () { return 0; }), 'common');
  assert.equal(flow.rollTier('k', function () { return 0.5; }), 'common');
  assert.equal(flow.rollTier('k', function () { return 0.7; }), 'uncommon');
  assert.equal(flow.rollTier('2', function () { return 0.7; }), 'rare');
  assert.equal(flow.rollTier('2', function () { return 0.9; }), 'legendary');
  assert.equal(flow.rollTier('k', function () { return 0.9; }), 'rare');

  const kept = flow.ensureTier({ v: 1, step: 'seed', tier: 'legendary', word: words.find('said') }, function () { return 0; });
  assert.equal(kept.tier, 'legendary');
  const rolled = flow.ensureTier({ v: 1, step: 'seed', word: words.find('because') }, function () { return 0.7; });
  assert.equal(rolled.tier, 'rare');

  function watch(tier) {
    const hatch = flow.createHatch(tier);
    const seen = {};
    let n = 0;
    while (!hatch.done && n < 400) {
      seen[hatch.shown] = true;
      flow.hatchStep(hatch, 0.05);
      n += 1;
    }
    assert.equal(hatch.done, true);
    assert.equal(hatch.shown, tier);
    assert.equal(seen.common, true);
    assert.equal(seen.legendary, true);
    return n;
  }
  assert.ok(watch('common') > 4);
  assert.ok(watch('legendary') > 4);
  const calm = flow.createHatch('rare', { reduced: true });
  assert.equal(calm.done, true);
  assert.equal(calm.shown, 'rare');
  assert.equal(flow.tierLine('legendary'), 'Legendary seed!');
  assert.equal(flow.tierName('uncommon'), 'Uncommon');
});

test('a grown-up link can open one step, and fresh clears the round', function () {
  const saved = flow.normalize({
    v: 1,
    step: 'write',
    jumbleStage: 2,
    hearts: 3,
    word: { id: 'rw-k-was', w: 'was' }
  });
  assert.equal(saved.step, 'write');
  assert.equal(saved.word.w, 'was');
  assert.equal(saved.hearts, 3);
  assert.equal(flow.normalize({ v: 2, step: 'write' }).step, 'claw');
  assert.equal(flow.normalize(null).hearts, 0);

  const jumped = flow.applyQuery(saved, { step: 'seed', word: 'friend', tier: 'legendary' });
  assert.equal(jumped.step, 'seed');
  assert.equal(jumped.word.w, 'friend');
  assert.equal(jumped.word.grade, '1');
  assert.equal(jumped.hearts, 3);
  assert.equal(jumped.tier, 'legendary');
  const done = flow.finishSeed(jumped);
  assert.equal(done.tier, 'legendary');
  assert.equal(done.step, 'done');

  const fresh = flow.applyQuery(saved, { fresh: '1' });
  assert.equal(fresh.step, 'claw');
  assert.equal(fresh.hearts, 0);
  assert.equal(fresh.word, null);

  const pile = flow.withPile(fresh);
  assert.equal(pile.pile[0].id, 'rw-2-because');
  assert.equal(pile.pile[0].color, words.COLORS['2']);
});

test('the shell page frames the steps and keeps secrets out of git', function () {
  const html = read('prototypes/red-words-shell/index.html');
  const css = read('prototypes/red-words-shell/style.css');
  const app = read('prototypes/red-words-shell/js/shell.js');
  const readme = read('prototypes/red-words-shell/README.md');
  const game = read('prototypes/claw-machine/js/game.js');
  const prize = read('prototypes/prize-crack/js/app.js');
  const jumble = read('prototypes/jumble-spell/js/app.js');
  const jumbleCss = read('prototypes/jumble-spell/style.css');
  const write = read('prototypes/write-box-myscript/js/app.js');
  const live = read('index.html');

  assert.match(html, /frame-src 'self'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /js\/shell\.js/);
  assert.match(html, /id="frame"/);
  assert.match(html, /id="pouch"/);
  assert.equal(html.includes('unsafe-eval'), false);
  assert.equal(html.includes('applicationKey'), false);
  assert.equal(html.includes('hmacKey'), false);
  assert.equal(app.includes('applicationKey'), false);
  assert.equal(app.includes('hmacKey'), false);
  const route = read('prototypes/red-words-shell/js/flow.js');
  assert.match(route, /lesson-shell/);
  assert.match(route, /red-words-shell\.session/);
  assert.match(app, /flow\.SOURCE/);
  assert.match(app, /flow\.STORAGE_KEY/);
  assert.match(css, /prize-crack\/fonts\/fredoka-latin\.woff2/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.equal(fs.existsSync(path.join(root, 'prototypes', 'prize-crack', 'fonts', 'fredoka-latin.woff2')), true);
  assert.equal(fs.existsSync(path.join(shell, 'rest.html')), true);

  assert.match(game, /lesson-shell/);
  assert.match(game, /red-words-shell\.session/);
  assert.match(game, /0xff4d88/);
  assert.match(game, /0xffb020/);
  assert.match(game, /0x3d8bff/);
  assert.match(game, /kind: 'capsule'/);
  assert.match(prize, /lesson-shell/);
  assert.match(prize, /Open the capsule/);
  assert.match(prize, /Tap the red letters/);
  assert.match(prize, /Read the sentence out loud/);
  assert.match(prize, /sentenceEl\.hidden = true/);
  assert.match(prize, /sentenceEl\.appendChild\(wordEl\)/);
  assert.match(prize, /prizeBtn\.classList\.toggle\('split'/);
  const prizeCss = read('prototypes/prize-crack/style.css');
  assert.match(prizeCss, /beat-sentence/);
  assert.match(prizeCss, /\.found \.mark/);
  assert.match(prizeCss, /#prize\.split \.half\.top/);
  assert.match(prizeCss, /font-size: 1em/);
  assert.match(app, /createHatch/);
  assert.match(app, /data-tier/);
  assert.match(css, /data-tier="legendary"/);
  assert.match(jumble, /lesson-shell/);
  assert.match(jumble, /blank: true/);
  assert.match(jumbleCss, /stage-blank/);
  assert.equal(jumble.includes('red-words'), false);
  assert.equal(jumble.includes('localStorage'), false);
  assert.match(write, /lesson-shell/);
  assert.match(write, /write-box-myscript\.keys|check\.STORAGE_KEY|readStored/);

  assert.match(readme, /https:\/\/thelearningquest\.github\.io\/Start\/prototypes\/red-words-shell\//);
  assert.match(readme, /write-box-myscript\.keys/);
  assert.match(readme, /localStorage/);
  assert.match(live, /prototypes\/red-words-shell\/index\.html\?live=1/);
  assert.match(live, /lesson\/words\.js/);
  assert.match(live, /frame-src 'self'/);
  assert.match(live, /connect-src 'none'/);
  assert.match(live, /lesson-shell/);
  assert.equal(live.includes('https://'), false);
  assert.equal(live.includes('applicationKey'), false);
  assert.equal(live.includes('hmacKey'), false);
  assert.equal(live.includes('letter-play'), false);
});
