/* Shared flower pictures for the garden and the seed reveal.
   Each file in media/flowers/ is that flower at its middle growth stage.
   The same path is used by the Word Garden canvas and the lesson seed screen. */
(function (root) {
  'use strict';

  var BANDS = {
    common: ['daisy', 'tulip'],
    rare: ['poppy', 'bluebell'],
    epic: ['orchid', 'lantern'],
    mythic: ['rainbow-rose', 'crystal-lotus']
  };
  var NAMES = {
    daisy: 'Daisy',
    tulip: 'Tulip',
    poppy: 'Poppy',
    bluebell: 'Bluebell',
    orchid: 'Orchid',
    lantern: 'Lantern',
    'rainbow-rose': 'Rainbow rose',
    'crystal-lotus': 'Crystal lotus'
  };
  var TIER_BAND = { common: 'common', uncommon: 'rare', rare: 'epic', legendary: 'mythic' };

  function flowerFor(id, band) {
    var list = BANDS[band] || BANDS.common;
    var n = 0;
    var i;
    id = String(id || '');
    for (i = 0; i < id.length; i++) n += id.charCodeAt(i);
    return list[n % list.length];
  }

  function gardenBand(tier) {
    return TIER_BAND[tier] || 'common';
  }

  function known(id) {
    return Object.prototype.hasOwnProperty.call(NAMES, id) ? id : 'daisy';
  }

  function nameOf(id) {
    return NAMES[known(id)];
  }

  /* base is '' from the site root, or a relative prefix such as '../../'. */
  function src(id, base) {
    return (base || '') + 'media/flowers/' + known(id) + '.svg';
  }

  function line(id) {
    var name = nameOf(id).toLowerCase();
    var article = /^[aeiou]/.test(name) ? 'an' : 'a';
    return 'It grows into ' + article + ' ' + name + '.';
  }

  var api = {
    BANDS: BANDS,
    NAMES: NAMES,
    TIER_BAND: TIER_BAND,
    MID: 'middle',
    flowerFor: flowerFor,
    gardenBand: gardenBand,
    nameOf: nameOf,
    src: src,
    line: line
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GardenFlowers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
