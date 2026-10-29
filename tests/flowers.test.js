/* Shared mid-stage flower pictures for the garden and the seed reveal. */
'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const Flowers = require('../media/flowers.js');

test('each garden flower has one middle-growth picture', function () {
  const ids = Object.keys(Flowers.NAMES);
  assert.deepEqual(ids.sort(), [
    'bluebell', 'crystal-lotus', 'daisy', 'lantern', 'orchid', 'poppy', 'rainbow-rose', 'tulip'
  ]);
  ids.forEach(function (id) {
    const file = path.join(root, 'media', 'flowers', id + '.svg');
    assert.equal(fs.existsSync(file), true, id);
    const svg = fs.readFileSync(file, 'utf8');
    assert.match(svg, /<svg/);
    assert.equal(Flowers.src(id), 'media/flowers/' + id + '.svg');
    assert.equal(Flowers.src(id, '../../'), '../../media/flowers/' + id + '.svg');
  });
  assert.match(Flowers.line('daisy'), /daisy/i);
  assert.match(Flowers.line('orchid'), /^It grows into an orchid\./);
  assert.equal(Flowers.flowerFor('rw-k-said', 'common'), Flowers.flowerFor('rw-k-said', 'common'));
  assert.ok(Flowers.BANDS[Flowers.gardenBand('legendary')].indexOf(Flowers.flowerFor('rw-2-because', Flowers.gardenBand('legendary'))) >= 0);
});

test('the live hub is a room and the lesson drops the old chrome', function () {
  const world = fs.readFileSync(path.join(root, 'red-words', 'world.js'), 'utf8');
  const live = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const shellHtml = fs.readFileSync(path.join(root, 'prototypes', 'red-words-shell', 'index.html'), 'utf8');
  const shellCss = fs.readFileSync(path.join(root, 'prototypes', 'red-words-shell', 'style.css'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'prototypes', 'red-words-shell', 'js', 'shell.js'), 'utf8');
  const claw = fs.readFileSync(path.join(root, 'prototypes', 'claw-machine', 'js', 'game.js'), 'utf8');
  const clawHtml = fs.readFileSync(path.join(root, 'prototypes', 'claw-machine', 'index.html'), 'utf8');
  const prize = fs.readFileSync(path.join(root, 'prototypes', 'prize-crack', 'js', 'app.js'), 'utf8');
  const write = fs.readFileSync(path.join(root, 'prototypes', 'write-box-myscript', 'js', 'app.js'), 'utf8');
  const writeHtml = fs.readFileSync(path.join(root, 'prototypes', 'write-box-myscript', 'index.html'), 'utf8');

  assert.equal(world.includes('Pick a place'), false);
  assert.equal(world.includes('Words I already know'), false);
  assert.match(world, /Explore New Words/);
  assert.match(world, /drawRoomClaw/);
  assert.match(world, /function capsule\(cx, cy, scale, color\)/);
  assert.match(world, /paintFlowerPic/);
  assert.match(live, /src="media\/flowers\.js"/);
  assert.match(live, /img-src 'self' data: blob:/);

  assert.match(shellCss, /#brand,\s*#trail,\s*#legend,\s*#now \{ display: none/);
  assert.match(shellHtml, /id="seed-flower"/);
  assert.match(shellCss, /body\[data-step="done"\] #seed-flower \{\s*grid-column: 1;/);
  assert.match(shellCss, /width: 340px;\s*height: 184px;\s*aspect-ratio: 340 \/ 184;/);
  assert.match(shellCss, /translate\(263px, 7px\)/);
  assert.equal(shellCss.includes('height: min(200px, 28vh)'), false);
  assert.match(shellHtml, /media\/flowers\.js/);
  assert.match(shell, /Flowers\.line\(flowerId\(\)\)/);
  assert.match(shellHtml, /id="hearts"/);
  assert.match(shellHtml, /id="restart"/);

  assert.match(claw, /Red Words/);
  assert.equal(claw.includes('TOY CLAW'), false);
  assert.equal(claw.includes('Prizes '), false);
  assert.match(claw, /-0\.95/);
  assert.equal(clawHtml.includes('id="wins"'), false);
  assert.equal(clawHtml.includes('id="calm"'), false);
  assert.equal(clawHtml.includes('id="refill"'), false);

  assert.match(prize, /saySentence\(word\)/);
  assert.match(prize, /word\.sentence/);
  assert.equal(fs.readFileSync(path.join(root, 'prototypes', 'prize-crack', 'index.html'), 'utf8').includes('id="calm"'), false);
  assert.equal(fs.readFileSync(path.join(root, 'prototypes', 'jumble-spell', 'index.html'), 'utf8').includes('id="sound"'), false);

  assert.match(write, /sayWordThenSentence/);
  assert.match(write, /promptEl\.hidden = writing/);
  assert.equal(write.includes('Keys saved'), false);
  assert.match(writeHtml, /id="check"/);
  assert.equal(writeHtml.includes('id="key-saved"'), false);
  assert.equal(writeHtml.includes('id="calm"'), false);
  assert.equal(writeHtml.includes('id="sound"'), false);
});
