/* Grade gardens — a row of three toy dioramas.
   The camera stays on a tilted stand. Swiping slides it from room to room.
   Near flowers move faster than the fence, hills, and sky (that is the parallax).
   Empty pebble rings are placeholders. Nothing is saved. */
(function () {
  'use strict';

  var SPAN = 13.6;
  var LAWN_W = 12.55;
  var LAWN_D = 9.2;
  var HALF_W = 7.55;
  var LOOK_DIST = 15.0;
  var PITCH = 0.42;
  var LOOK_Y = 0.95;
  var LOOK_Z = 0.1;
  var SKY_Z = -9;
  var SKY_Y = 9.2;
  var SKY_H = 34;
  var SKY_W = 150;

  var SKY_TOP = [0x9fd9ff, 0x8ed0ff, 0xffc98a];
  var THEME_HEX = ['#ffd56a', '#8fd4f2', '#ffb15e'];

  var canvas = document.getElementById('view');
  var gradeEl = document.getElementById('grade');
  var lineEl = document.getElementById('line');
  var calmBtn = document.getElementById('calm');
  var soundBtn = document.getElementById('sound');
  var prevBtn = document.getElementById('prev');
  var nextBtn = document.getElementById('next');
  var failEl = document.getElementById('fail');
  var themeMeta = document.getElementById('theme');

  function showFail() {
    if (failEl) failEl.hidden = false;
  }

  if (!canvas || !window.THREE || !window.GardensPager) {
    showFail();
    return;
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
  } catch (err) {
    showFail();
    return;
  }
  if (!renderer.getContext()) {
    showFail();
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(36, 1, 0.08, 80);
  var camDist = LOOK_DIST;
  var camPitch = PITCH;

  var SPHERE = new THREE.SphereGeometry(1, 24, 16);
  var DISC = new THREE.CylinderGeometry(0.5, 0.5, 1, 36);
  var GRASS = new THREE.ConeGeometry(0.5, 1, 5);
  var MATS = {};
  var GEO = {};

  function clay(hex, rough) {
    var key = String(hex) + '/' + rough;
    if (!MATS[key]) {
      MATS[key] = new THREE.MeshStandardMaterial({
        color: hex,
        roughness: rough,
        metalness: 0.02
      });
    }
    return MATS[key];
  }

  function rbox(w, h, d, r) {
    var key = w + 'x' + h + 'x' + d + 'x' + r;
    if (!GEO[key]) GEO[key] = roundedBox(w, h, d, r);
    return GEO[key];
  }

  function roundedBox(width, height, depth, radius) {
    var rad = Math.min(radius, width / 2, height / 2, depth / 2);
    var hw = Math.max(0.001, (width - 2 * rad) / 2);
    var hh = Math.max(0.001, (height - 2 * rad) / 2);
    var shape = new THREE.Shape();
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.closePath();
    var g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.001, depth - 2 * rad),
      bevelEnabled: true,
      bevelThickness: rad,
      bevelSize: rad,
      bevelSegments: 2,
      curveSegments: 1
    });
    g.computeBoundingBox();
    var c = g.boundingBox.getCenter(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z);
    g.computeVertexNormals();
    return g;
  }

  function finishTex(tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  function M(geo, mat, x, y, z, shade) {
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    var on = shade !== false;
    mesh.castShadow = on;
    mesh.receiveShadow = on;
    return mesh;
  }

  var mats = {
    stem: clay(0x3aa84a, 0.76),
    leaf: clay(0x3cba4e, 0.78),
    leafDark: clay(0x2f9a3e, 0.8),
    petal: clay(0xfffdf8, 0.58),
    gold: clay(0xffc53d, 0.48),
    soil: clay(0x8d5434, 0.96),
    soilDark: clay(0x5c341c, 1),
    hole: clay(0x4a2914, 1),
    pebble: clay(0xf4e7d2, 0.94),
    stone: clay(0xf3e0c2, 0.95),
    stoneGray: clay(0xd4d0c8, 0.95),
    wood: clay(0xe0a24b, 0.74),
    woodDark: clay(0xc4843c, 0.8),
    cream: clay(0xfff6ea, 0.68),
    trunk: clay(0xc17a45, 0.86),
    signPost: clay(0xd3924a, 0.76),
    seed: clay(0x7a431f, 0.88),
    sunflower: clay(0xffc107, 0.52),
    water: new THREE.MeshStandardMaterial({
      color: 0x3ec8e6,
      roughness: 0.16,
      metalness: 0.05,
      emissive: 0x127a96,
      emissiveIntensity: 0.16
    })
  };

  var BLOB = new THREE.MeshBasicMaterial({
    color: 0x3d6b34,
    transparent: true,
    opacity: 0.16,
    depthWrite: false
  });

  var glowMat = new THREE.MeshBasicMaterial({
    map: glowTexture(),
    transparent: true,
    depthWrite: false
  });

  function glowTexture() {
    var c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    var g = c.getContext('2d');
    var rg = g.createRadialGradient(128, 128, 8, 128, 128, 122);
    rg.addColorStop(0, 'rgba(255, 244, 200, 0.9)');
    rg.addColorStop(0.45, 'rgba(255, 226, 150, 0.28)');
    rg.addColorStop(1, 'rgba(255, 226, 150, 0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 256, 256);
    return finishTex(new THREE.CanvasTexture(c));
  }

  function signTexture(text) {
    var c = document.createElement('canvas');
    c.width = 512;
    c.height = 320;
    var g = c.getContext('2d');
    g.clearRect(0, 0, 512, 320);
    g.fillStyle = '#5c3a24';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '800 168px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    g.fillText(text, 256, 168);
    return finishTex(new THREE.CanvasTexture(c));
  }

  function skyTexture() {
    var w = 768;
    var h = 384;
    var tops = ['#9fd9ff', '#8ed0ff', '#ffc98a'];
    var bots = ['#fff3c4', '#e7fff4', '#ffd0ea'];
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var g = c.getContext('2d');
    var rgb = tops.map(function (hex, i) {
      return { top: hexRgb(hex), bot: hexRgb(bots[i]) };
    });
    var x;
    for (x = 0; x < w; x++) {
      var u = (x + 0.5) / w;
      var gp = u * 3 - 0.5;
      var i0 = Math.floor(gp);
      var f = gp - i0;
      if (i0 < 0) { i0 = 0; f = 0; }
      if (i0 > 1) { i0 = 1; f = 1; }
      var sm = f * f * (3 - 2 * f);
      var top = mixRgb(rgb[i0].top, rgb[i0 + 1].top, sm);
      var bot = mixRgb(rgb[i0].bot, rgb[i0 + 1].bot, sm);
      var grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, top);
      grd.addColorStop(0.62, top);
      grd.addColorStop(1, bot);
      g.fillStyle = grd;
      g.fillRect(x, 0, 1, h);
    }
    return finishTex(new THREE.CanvasTexture(c));
  }

  function hexRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ];
  }

  function mixRgb(a, b, t) {
    function ch(i) { return Math.round(a[i] + (b[i] - a[i]) * t); }
    return 'rgb(' + ch(0) + ',' + ch(1) + ',' + ch(2) + ')';
  }

  var swayers = [];
  var drifters = [];
  var flyers = [];
  var bobbers = [];
  var bouncers = [];
  var pulses = [];
  var signs = [];

  function finishPlant(g, pivot, phase, amp) {
    if (!g.userData.baseScale) g.userData.baseScale = g.scale.x || 1;
    g.userData.kind = 'flower';
    bouncers.push(g);
    swayers.push({ obj: pivot, phase: phase || 0, amp: amp });
    return g;
  }

  function addLawn(parent, sideHex, topHex) {
    var base = M(DISC, clay(sideHex, 0.94), 0, 0.22, 0);
    base.scale.set(LAWN_W, 0.44, LAWN_D);
    parent.add(base);
    var cap = M(DISC, clay(topHex, 0.86), 0, 0.48, 0, false);
    cap.receiveShadow = true;
    cap.scale.set(LAWN_W - 0.55, 0.1, LAWN_D - 0.48);
    parent.add(cap);
    return 0.53;
  }

  function addBed(parent, x, z, w, d, surface) {
    var wall = M(DISC, clay(0xc4845a, 0.9), x, surface + 0.16, z);
    wall.scale.set(w, 0.32, d);
    parent.add(wall);
    var top = M(DISC, mats.soil, x, surface + 0.34, z, false);
    top.receiveShadow = true;
    top.scale.set(w * 0.9, 0.08, d * 0.9);
    parent.add(top);
    return surface + 0.38;
  }

  function addBlob(parent, x, z, y, rx, rz) {
    var m = M(DISC, BLOB, x, y, z, false);
    m.scale.set(rx, 0.02, rz);
    parent.add(m);
  }

  function addDaisy(parent, x, z, soilY, scale, phase) {
    var g = new THREE.Group();
    g.position.set(x, soilY, z);
    g.scale.setScalar(scale || 1);
    var pivot = new THREE.Group();
    g.add(pivot);
    var stem = M(DISC, mats.stem, 0, 0.42, 0);
    stem.scale.set(0.07, 0.84, 0.07);
    pivot.add(stem);
    var leaf = M(SPHERE, mats.leaf, 0.14, 0.28, 0);
    leaf.scale.set(0.24, 0.08, 0.12);
    leaf.rotation.z = -0.7;
    pivot.add(leaf);
    var head = new THREE.Group();
    head.position.y = 0.9;
    var i;
    for (i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      var petal = M(SPHERE, mats.petal, Math.cos(a) * 0.26, 0.04, Math.sin(a) * 0.26, false);
      petal.scale.set(0.2, 0.09, 0.15);
      head.add(petal);
    }
    var center = M(SPHERE, mats.gold, 0, 0.08, 0, false);
    center.scale.setScalar(0.16);
    head.add(center);
    pivot.add(head);
    parent.add(g);
    return finishPlant(g, pivot, phase, 0.045);
  }

  function addTulip(parent, x, z, soilY, color, scale, phase) {
    var g = new THREE.Group();
    g.position.set(x, soilY, z);
    g.scale.setScalar(scale || 1);
    g.rotation.y = (phase || 0) * 0.4;
    var pivot = new THREE.Group();
    g.add(pivot);
    var stem = M(DISC, mats.stem, 0, 0.5, 0);
    stem.scale.set(0.065, 1, 0.065);
    pivot.add(stem);
    var leaf = M(SPHERE, mats.leaf, 0.16, 0.38, 0);
    leaf.scale.set(0.28, 0.08, 0.1);
    leaf.rotation.z = -0.85;
    pivot.add(leaf);
    var petalMat = clay(color, 0.5);
    var head = new THREE.Group();
    head.position.y = 1.05;
    var i;
    for (i = 0; i < 5; i++) {
      var a = (i / 5) * Math.PI * 2;
      var petal = M(SPHERE, petalMat, Math.cos(a) * 0.1, 0.18, Math.sin(a) * 0.1);
      petal.scale.set(0.13, 0.3, 0.1);
      petal.rotation.z = Math.cos(a) * 0.4;
      petal.rotation.x = -Math.sin(a) * 0.4;
      head.add(petal);
    }
    pivot.add(head);
    parent.add(g);
    return finishPlant(g, pivot, (phase || 0) + 0.6, 0.04);
  }

  function addSunflower(parent, x, z, soilY, phase) {
    var g = new THREE.Group();
    g.position.set(x, soilY, z);
    var pivot = new THREE.Group();
    g.add(pivot);
    var stem = M(DISC, mats.stem, 0, 0.85, 0);
    stem.scale.set(0.09, 1.7, 0.09);
    pivot.add(stem);
    var leaf = M(SPHERE, mats.leaf, 0.24, 0.72, 0);
    leaf.scale.set(0.42, 0.1, 0.18);
    leaf.rotation.z = -0.55;
    pivot.add(leaf);
    var leaf2 = M(SPHERE, mats.leafDark, -0.2, 0.48, 0.04);
    leaf2.scale.set(0.34, 0.08, 0.14);
    leaf2.rotation.z = 0.7;
    pivot.add(leaf2);
    var head = new THREE.Group();
    head.position.y = 1.78;
    head.rotation.x = -0.62;
    var disc = M(DISC, mats.seed, 0, 0.02, 0);
    disc.scale.set(0.64, 0.12, 0.64);
    head.add(disc);
    var i;
    for (i = 0; i < 14; i++) {
      var a = (i / 14) * Math.PI * 2;
      var petal = M(SPHERE, mats.sunflower, Math.cos(a) * 0.44, 0.06, Math.sin(a) * 0.44, false);
      petal.scale.set(0.2, 0.11, 0.3);
      head.add(petal);
    }
    pivot.add(head);
    parent.add(g);
    return finishPlant(g, pivot, phase, 0.028);
  }

  function addSprout(parent, x, z, soilY, phase) {
    var g = new THREE.Group();
    g.position.set(x, soilY, z);
    var pivot = new THREE.Group();
    g.add(pivot);
    var stem = M(DISC, mats.stem, 0, 0.2, 0);
    stem.scale.set(0.05, 0.4, 0.05);
    pivot.add(stem);
    var l1 = M(SPHERE, mats.leaf, 0.1, 0.4, 0);
    l1.scale.set(0.16, 0.07, 0.06);
    l1.rotation.z = -0.8;
    var l2 = M(SPHERE, mats.leafDark, -0.1, 0.38, 0);
    l2.scale.set(0.15, 0.065, 0.06);
    l2.rotation.z = 0.85;
    pivot.add(l1);
    pivot.add(l2);
    parent.add(g);
    return finishPlant(g, pivot, phase, 0.06);
  }

  function addEmpty(parent, x, z, soilY, scale) {
    var g = new THREE.Group();
    g.position.set(x, soilY, z);
    g.scale.setScalar(scale || 1);
    var disc = M(DISC, mats.soilDark, 0, 0.03, 0, false);
    disc.scale.set(0.7, 0.05, 0.7);
    disc.receiveShadow = true;
    g.add(disc);
    var hole = M(DISC, mats.hole, 0, 0.045, 0, false);
    hole.scale.set(0.3, 0.04, 0.3);
    g.add(hole);
    var i;
    for (i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      var pebble = M(SPHERE, mats.pebble, Math.cos(a) * 0.38, 0.05, Math.sin(a) * 0.38, false);
      pebble.scale.set(0.075, 0.045, 0.06);
      g.add(pebble);
    }
    var stake = M(DISC, mats.wood, 0.18, 0.24, 0.06);
    stake.scale.set(0.04, 0.46, 0.04);
    stake.rotation.z = 0.1;
    g.add(stake);
    var flag = M(rbox(0.18, 0.14, 0.03, 0.04), mats.cream, 0.3, 0.44, 0.06, false);
    g.add(flag);
    parent.add(g);
    g.userData.kind = 'empty';
    g.userData.baseScale = scale || 1;
    bouncers.push(g);
    return g;
  }

  function addPot(parent, x, z, surface, color, kind, petal) {
    var g = new THREE.Group();
    g.position.set(x, surface, z);
    var body = M(new THREE.CylinderGeometry(0.34, 0.26, 0.42, 18), clay(color, 0.58), 0, 0.21, 0);
    g.add(body);
    var rim = M(new THREE.TorusGeometry(0.34, 0.055, 8, 18), clay(color, 0.5), 0, 0.42, 0, false);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    var soil = M(DISC, mats.soil, 0, 0.38, 0, false);
    soil.scale.set(0.6, 0.06, 0.6);
    soil.receiveShadow = true;
    g.add(soil);
    var saucer = M(DISC, clay(color, 0.64), 0, 0.04, 0, false);
    saucer.scale.set(0.86, 0.07, 0.86);
    saucer.receiveShadow = true;
    g.add(saucer);
    parent.add(g);
    addBlob(parent, x, z, surface + 0.02, 0.9, 0.7);
    if (kind === 'tulip') addTulip(parent, x, z, surface + 0.42, petal || 0xff7a9a, 0.78, x);
    else if (kind === 'daisy') addDaisy(parent, x, z, surface + 0.42, 0.75, z);
    else addEmpty(parent, x, z, surface + 0.4, 0.62);
    return g;
  }

  function addFence(parent, x0, z0, x1, z1, surface, color, postH) {
    var dx = x1 - x0;
    var dz = z1 - z0;
    var len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.05) return;
    var n = Math.max(1, Math.round(len / 0.58));
    var mat = clay(color, 0.66);
    var i;
    for (i = 0; i <= n; i++) {
      var t = i / n;
      var x = x0 + dx * t;
      var z = z0 + dz * t;
      var post = M(DISC, mat, x, surface + postH / 2, z);
      post.scale.set(0.12, postH, 0.12);
      parent.add(post);
      var cap = M(SPHERE, mat, x, surface + postH + 0.03, z, false);
      cap.scale.setScalar(0.085);
      parent.add(cap);
    }
    addRail(parent, x0, surface + postH * 0.68, z0, x1, surface + postH * 0.68, z1, 0.075, mat);
    addRail(parent, x0, surface + postH * 0.36, z0, x1, surface + postH * 0.36, z1, 0.065, mat);
  }

  function addRail(parent, x0, y0, z0, x1, y1, z1, thick, mat) {
    var mesh = M(DISC, mat, 0, 0, 0);
    var dir = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0);
    var railLen = dir.length();
    mesh.scale.set(thick, railLen, thick);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    if (railLen > 0.001) {
      dir.multiplyScalar(1 / railLen);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    parent.add(mesh);
    return mesh;
  }

  function addTree(parent, x, z, baseY, leafA, leafB, scale) {
    var g = new THREE.Group();
    g.position.set(x, baseY, z);
    g.scale.setScalar(scale || 1);
    var trunk = M(new THREE.CylinderGeometry(0.16, 0.26, 1.05, 12), mats.trunk, 0, 0.52, 0);
    g.add(trunk);
    var sway = new THREE.Group();
    sway.position.y = 1.02;
    g.add(sway);
    var puffs = [
      [0, 0.38, 0, 0.78, leafA],
      [-0.5, 0.12, 0.1, 0.52, leafB],
      [0.52, 0.08, -0.06, 0.5, leafA],
      [0.06, 0.72, 0.04, 0.46, leafB],
      [-0.18, 0.22, -0.32, 0.4, leafB]
    ];
    var i;
    for (i = 0; i < puffs.length; i++) {
      var p = puffs[i];
      var m = M(SPHERE, clay(p[4], 0.72), p[0], p[1], p[2]);
      m.scale.setScalar(p[3]);
      sway.add(m);
    }
    parent.add(g);
    swayers.push({ obj: sway, phase: x, amp: 0.02 });
    addBlob(parent, x, z, baseY + 0.02, 1.1 * (scale || 1), 0.85 * (scale || 1));
    return g;
  }

  function addCloud(parent, x, y, z, s, mat) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    var parts = [[0, 0, 0, 0.55], [-0.48, -0.08, 0.05, 0.38], [0.5, -0.06, 0, 0.42], [0.12, 0.2, -0.04, 0.34]];
    var i;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      var m = M(SPHERE, mat, p[0] * s, p[1] * s, p[2] * s, false);
      m.scale.setScalar(p[3] * s);
      g.add(m);
    }
    parent.add(g);
    drifters.push({ obj: g, baseX: x, phase: x + z, amp: 0.32 });
    return g;
  }

  function addSun(parent, x, y, z, r, color) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    var sunMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.4,
      roughness: 0.42
    });
    var sun = M(SPHERE, sunMat, 0, 0, 0, false);
    sun.scale.setScalar(r);
    g.add(sun);
    var eye = new THREE.MeshBasicMaterial({ color: 0x3a2a28 });
    var e1 = M(SPHERE, eye, -r * 0.28, r * 0.14, r * 0.9, false);
    e1.scale.setScalar(r * 0.09);
    var e2 = M(SPHERE, eye, r * 0.28, r * 0.14, r * 0.9, false);
    e2.scale.setScalar(r * 0.09);
    g.add(e1);
    g.add(e2);
    var smile = M(new THREE.TorusGeometry(r * 0.32, r * 0.05, 8, 16, Math.PI), new THREE.MeshBasicMaterial({ color: 0xc46a3a }), 0, -r * 0.18, r * 0.88, false);
    smile.rotation.z = Math.PI;
    g.add(smile);
    var glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
    glow.scale.setScalar(r * 4.6);
    glow.position.z = -0.08;
    g.add(glow);
    parent.add(g);
    return g;
  }

  function addMushroom(parent, x, z, surface, s) {
    var g = new THREE.Group();
    g.position.set(x, surface, z);
    g.scale.setScalar(s || 1);
    var stem = M(DISC, clay(0xfff6ea, 0.7), 0, 0.18, 0);
    stem.scale.set(0.18, 0.36, 0.18);
    var cap = M(SPHERE, clay(0xff4d4d, 0.5), 0, 0.4, 0);
    cap.scale.set(0.32, 0.22, 0.32);
    g.add(stem);
    g.add(cap);
    var spots = [[-0.1, 0.5, 0.12, 0.07], [0.12, 0.48, 0.08, 0.055], [0.02, 0.52, -0.06, 0.045]];
    var i;
    for (i = 0; i < spots.length; i++) {
      var sp = M(SPHERE, clay(0xfffaf6, 0.45), spots[i][0], spots[i][1], spots[i][2], false);
      sp.scale.setScalar(spots[i][3]);
      g.add(sp);
    }
    parent.add(g);
    addBlob(parent, x, z, surface + 0.02, 0.4 * (s || 1), 0.32 * (s || 1));
  }

  function addButterfly(parent, x, y, z, color) {
    var g = new THREE.Group();
    var body = M(SPHERE, clay(0x3a2e2c, 0.7), 0, 0, 0, false);
    body.scale.set(0.24, 0.08, 0.08);
    g.add(body);
    var wingMat = clay(color, 0.55);
    var wingL = new THREE.Group();
    var wingR = new THREE.Group();
    var topL = M(SPHERE, wingMat, 0.2, 0.08, 0, false);
    topL.scale.set(0.18, 0.26, 0.05);
    var botL = M(SPHERE, wingMat, 0.14, -0.14, 0, false);
    botL.scale.set(0.13, 0.18, 0.045);
    wingL.add(topL);
    wingL.add(botL);
    var topR = M(SPHERE, wingMat, -0.2, 0.08, 0, false);
    topR.scale.set(0.18, 0.26, 0.05);
    var botR = M(SPHERE, wingMat, -0.14, -0.14, 0, false);
    botR.scale.set(0.13, 0.18, 0.045);
    wingR.add(topR);
    wingR.add(botR);
    g.add(wingL);
    g.add(wingR);
    parent.add(g);
    flyers.push({
      obj: g, wingL: wingL, wingR: wingR,
      cx: x, cy: y, cz: z, rx: 1.2, ry: 0.22, rz: 0.75,
      phase: x + z, speed: 0.62, flap: 10
    });
  }

  function addBee(parent, x, y, z) {
    var g = new THREE.Group();
    var yellow = clay(0xffd23a, 0.5);
    var dark = clay(0x2a2826, 0.6);
    var body = M(SPHERE, yellow, 0, 0, 0, false);
    body.scale.set(0.22, 0.15, 0.15);
    var stripe = M(SPHERE, dark, 0.02, 0, 0, false);
    stripe.scale.set(0.08, 0.16, 0.16);
    var head = M(SPHERE, dark, 0.2, 0.02, 0, false);
    head.scale.setScalar(0.1);
    var wingL = M(SPHERE, clay(0xf7fbff, 0.35), 0, 0.1, 0.12, false);
    wingL.scale.set(0.14, 0.04, 0.08);
    var wingR = M(SPHERE, clay(0xf7fbff, 0.35), 0, 0.1, -0.12, false);
    wingR.scale.set(0.14, 0.04, 0.08);
    g.add(body);
    g.add(stripe);
    g.add(head);
    g.add(wingL);
    g.add(wingR);
    parent.add(g);
    flyers.push({
      obj: g, wingL: null, wingR: null,
      cx: x, cy: y, cz: z, rx: 0.95, ry: 0.16, rz: 0.55,
      phase: 1.4, speed: 0.85, flap: 0
    });
  }

  function addBird(parent, x, y, z, color) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    var body = M(SPHERE, clay(color, 0.6), 0, 0, 0, false);
    body.scale.set(0.22, 0.16, 0.16);
    var head = M(SPHERE, clay(color, 0.6), 0.18, 0.07, 0, false);
    head.scale.setScalar(0.12);
    var beak = M(GRASS, clay(0xffb703, 0.5), 0.32, 0.07, 0, false);
    beak.scale.set(0.08, 0.14, 0.08);
    beak.rotation.z = -Math.PI / 2;
    var eye = M(SPHERE, new THREE.MeshBasicMaterial({ color: 0x2b2422 }), 0.22, 0.11, 0.07, false);
    eye.scale.setScalar(0.03);
    var wing = M(SPHERE, clay(color, 0.64), -0.02, 0.02, 0.12, false);
    wing.scale.set(0.12, 0.05, 0.09);
    g.add(body);
    g.add(head);
    g.add(beak);
    g.add(eye);
    g.add(wing);
    parent.add(g);
    bobbers.push({ obj: g, baseY: y, phase: x * 1.7, amp: 0.055 });
    return g;
  }

  function addStone(parent, x, z, y, s, mat) {
    var m = M(SPHERE, mat, x, y + 0.045 * s, z, false);
    m.scale.set(0.38 * s, 0.12 * s, 0.3 * s);
    m.receiveShadow = true;
    parent.add(m);
  }

  function addTuft(parent, x, z, surface, h, color) {
    var g = new THREE.Group();
    g.position.set(x, surface, z);
    var i;
    for (i = 0; i < 3; i++) {
      var blade = M(GRASS, clay(color, 0.86), (i - 1) * 0.07, h / 2, 0, false);
      blade.scale.set(0.16, h, 0.12);
      blade.rotation.z = (i - 1) * 0.2;
      g.add(blade);
    }
    parent.add(g);
  }

  function addTufts(parent, surface, color, shift) {
    var spots = [
      [-5.1, 2.6], [-3.2, 3.55], [-0.8, 3.9], [1.5, 3.85], [3.6, 3.3], [5.0, 2.3],
      [-5.5, 0.4], [5.45, 0.2], [-4.6, -0.8], [4.9, -1.1]
    ];
    var i;
    for (i = 0; i < spots.length; i++) {
      addTuft(parent, spots[i][0] + shift, spots[i][1], surface, 0.28 + (i % 3) * 0.06, color);
    }
  }

  function addSign(parent, x, z, surface, text, yaw, boardW) {
    var g = new THREE.Group();
    g.position.set(x, surface, z);
    g.rotation.y = yaw || 0;
    var post = M(DISC, mats.signPost, 0, 0.62, 0);
    post.scale.set(0.12, 1.24, 0.12);
    g.add(post);
    var w = boardW || 1.6;
    var board = M(rbox(w, 1.1, 0.16, 0.18), mats.cream, 0, 1.46, 0);
    g.add(board);
    var face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.28, 0.8), new THREE.MeshBasicMaterial({
      map: signTexture(text),
      transparent: true,
      depthWrite: false
    }));
    face.position.set(0, 1.48, 0.1);
    g.add(face);
    parent.add(g);
    g.userData.baseScale = 1;
    return g;
  }

  function addBucket(parent, x, z, surface) {
    var g = new THREE.Group();
    g.position.set(x, surface, z);
    var body = M(new THREE.CylinderGeometry(0.28, 0.22, 0.34, 16), mats.wood, 0, 0.18, 0);
    g.add(body);
    var rim = M(new THREE.TorusGeometry(0.28, 0.045, 6, 16), mats.woodDark, 0, 0.35, 0, false);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    parent.add(g);
    addBlob(parent, x, z, surface + 0.02, 0.55, 0.45);
  }

  function addCan(parent, x, z, surface) {
    var g = new THREE.Group();
    g.position.set(x, surface, z);
    g.rotation.y = -0.7;
    var body = M(SPHERE, clay(0xff5468, 0.46), 0, 0.32, 0);
    body.scale.set(0.36, 0.3, 0.34);
    g.add(body);
    var neck = M(DISC, clay(0xff5468, 0.46), 0, 0.52, 0);
    neck.scale.set(0.24, 0.12, 0.24);
    g.add(neck);
    var handle = M(new THREE.TorusGeometry(0.18, 0.04, 8, 14, Math.PI), clay(0xff5468, 0.46), -0.18, 0.48, 0, false);
    handle.rotation.z = Math.PI / 2;
    g.add(handle);
    var spout = M(DISC, clay(0xff5468, 0.46), 0.32, 0.46, 0);
    spout.scale.set(0.09, 0.42, 0.09);
    spout.rotation.z = -1.15;
    g.add(spout);
    var rose = M(DISC, clay(0xffd5d8, 0.4), 0.52, 0.58, 0, false);
    rose.scale.set(0.16, 0.06, 0.16);
    rose.rotation.z = 1.2;
    g.add(rose);
    parent.add(g);
    addBlob(parent, x, z, surface + 0.02, 0.7, 0.55);
  }

  function addBench(parent, x, z, surface, yaw) {
    var g = new THREE.Group();
    g.position.set(x, surface, z);
    g.rotation.y = yaw || 0;
    var seat = M(rbox(1.3, 0.1, 0.48, 0.06), mats.wood, 0, 0.48, 0);
    g.add(seat);
    var back = M(rbox(1.3, 0.48, 0.09, 0.05), mats.wood, 0, 0.78, -0.18);
    g.add(back);
    var legs = [[-0.5, -0.15], [0.5, -0.15], [-0.5, 0.15], [0.5, 0.15]];
    var i;
    for (i = 0; i < legs.length; i++) {
      var leg = M(DISC, mats.woodDark, legs[i][0], 0.22, legs[i][1]);
      leg.scale.set(0.08, 0.44, 0.08);
      g.add(leg);
    }
    parent.add(g);
    addBlob(parent, x, z, surface + 0.02, 1.15, 0.7);
  }

  function addStump(parent, x, z, surface) {
    var body = M(DISC, mats.trunk, x, surface + 0.2, z);
    body.scale.set(0.82, 0.4, 0.82);
    parent.add(body);
    var top = M(DISC, clay(0xe7c48a, 0.9), x, surface + 0.42, z, false);
    top.scale.set(0.7, 0.06, 0.7);
    top.receiveShadow = true;
    parent.add(top);
    addBlob(parent, x, z, surface + 0.02, 0.7, 0.55);
  }

  function addPond(parent, x, z, surface, radius) {
    var bank = M(DISC, clay(0xe6c898, 0.96), x, surface - 0.01, z, false);
    bank.scale.set(radius * 2.45, 0.08, radius * 2.05);
    bank.receiveShadow = true;
    parent.add(bank);
    var deep = M(DISC, clay(0x1498b8, 0.32), x, surface + 0.03, z, false);
    deep.scale.set(radius * 2.05, 0.06, radius * 1.7);
    parent.add(deep);
    var water = M(DISC, mats.water, x, surface + 0.07, z, false);
    water.scale.set(radius * 1.88, 0.045, radius * 1.55);
    parent.add(water);
    var shine = M(DISC, new THREE.MeshBasicMaterial({ color: 0xf4fdff }), x - radius * 0.25, surface + 0.11, z + radius * 0.12, false);
    shine.scale.set(radius * 0.5, 0.02, radius * 0.26);
    parent.add(shine);
    pulses.push(shine);
  }

  function addPad(parent, x, z, y, s) {
    var pad = M(DISC, clay(0x3cb86a, 0.72), x, y, z, false);
    pad.scale.set(0.72 * s, 0.035, 0.72 * s);
    parent.add(pad);
  }

  function addCattail(parent, x, z, surface) {
    var stem = M(DISC, mats.leaf, x, surface + 0.55, z);
    stem.scale.set(0.045, 1.1, 0.045);
    parent.add(stem);
    var head = M(SPHERE, clay(0x8a5430, 0.8), x, surface + 1.18, z);
    head.scale.set(0.1, 0.24, 0.1);
    parent.add(head);
  }

  function addLavender(parent, x, z, surface) {
    var i;
    for (i = 0; i < 3; i++) {
      var ox = (i - 1) * 0.14;
      var stem = M(DISC, mats.stem, x + ox, surface + 0.28, z);
      stem.scale.set(0.035, 0.56, 0.035);
      parent.add(stem);
      var tip = M(GRASS, clay(0xb497e8, 0.58), x + ox, surface + 0.7, z);
      tip.scale.set(0.12, 0.32, 0.12);
      parent.add(tip);
    }
  }

  function addBunting(parent, x0, y0, z0, x1, y1, z1, colors) {
    addRail(parent, x0, y0, z0, x1, y1, z1, 0.035, mats.cream);
    var i;
    for (i = 0; i < colors.length; i++) {
      var t = (i + 0.5) / colors.length;
      var flag = M(rbox(0.26, 0.34, 0.045, 0.07), clay(colors[i], 0.58), x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 0.24, z0 + (z1 - z0) * t, false);
      parent.add(flag);
    }
  }

  function addThreshold(parent) {
    addStone(parent, SPAN * 0.5 - 0.02, 0.35, 0.02, 1.15, mats.stone);
    addStone(parent, SPAN * 0.5 + 0.06, -0.6, 0.02, 0.85, mats.pebble);
    addStone(parent, SPAN * 0.5 - 0.08, 1.3, 0.02, 0.7, mats.stone);
  }

  function buildK(parent) {
    var surface = addLawn(parent, 0x62b848, 0x8ed85c);
    addHill(parent, -2.2, 0.15, -4.7, 3.4, 1.5, 2.2, 0xc6e99a);
    addHill(parent, 3.4, -0.1, -4.9, 2.8, 1.25, 1.8, 0xd5f0a8);
    addFence(parent, -5.3, -3.35, 5.3, -3.35, surface, 0xfffaf4, 0.78);
    addFence(parent, -5.45, -3.2, -5.45, 0.4, surface, 0xfffaf4, 0.7);
    addFence(parent, 5.45, -3.2, 5.45, 0.15, surface, 0xfffaf4, 0.7);
    addTree(parent, -4.15, -1.55, surface, 0xff9ec4, 0xff7eae, 1.18);
    addMushroom(parent, -3.15, 1.45, surface, 1);
    addMushroom(parent, -2.55, 2.0, surface, 0.72);
    var bed = addBed(parent, -1.05, -0.2, 4.4, 2.55, surface);
    addDaisy(parent, -2.15, -0.45, bed, 1, 0.4);
    addEmpty(parent, -0.95, 0.25, bed, 1);
    addTulip(parent, 0.15, -0.5, bed, 0xff6f9d, 1, 0.8);
    var bed2 = addBed(parent, 2.85, -1.45, 3.3, 2.15, surface);
    addDaisy(parent, 2.25, -1.6, bed2, 0.92, 1.2);
    addEmpty(parent, 3.45, -1.2, bed2, 0.95);
    addPot(parent, 3.55, 1.65, surface, 0xff7a5c, 'tulip', 0xff8f6b);
    addPot(parent, 4.9, 2.25, surface, 0xf0a06a, 'empty');
    addCan(parent, 4.65, 0.55, surface);
    signs[0] = addSign(parent, -3.05, 1.15, surface, 'K', 0.35, 1.45);
    addStone(parent, -0.15, 3.15, surface, 1.05, mats.stone);
    addStone(parent, 0.2, 2.35, surface, 0.9, mats.pebble);
    addStone(parent, -0.35, 1.6, surface, 0.8, mats.stone);
    addStone(parent, -0.85, 0.95, surface, 0.75, mats.pebble);
    addButterfly(parent, 1.1, 2.55, 0.2, 0xff8eb8);
    addSun(parent, -3.5, 4.55, -4.55, 0.74, 0xffe56a);
    addCloud(parent, 1.6, 4.35, -4.7, 1, clay(0xffffff, 1));
    addCloud(parent, 4.4, 3.85, -4.35, 0.75, clay(0xffffff, 1));
    addTufts(parent, surface, 0x4eaf45, 0);
    addThreshold(parent);
  }

  function addHill(parent, x, y, z, sx, sy, sz, color) {
    var m = M(SPHERE, clay(color, 1), x, y, z, false);
    m.scale.set(sx, sy, sz);
    parent.add(m);
  }

  function buildFirst(parent) {
    var surface = addLawn(parent, 0x4eae58, 0x6ed460);
    addHill(parent, 0.4, 0.05, -4.8, 4.2, 1.35, 2.1, 0xb7e38e);
    addHill(parent, -4.2, -0.05, -4.6, 2.4, 1.15, 1.7, 0xc8ebb0);
    addFence(parent, -5.2, -3.4, 5.2, -3.25, surface, 0xe2a84b, 0.7);
    addFence(parent, -5.4, -3.2, -5.4, 0.2, surface, 0xe2a84b, 0.64);
    addFence(parent, 5.4, -3.1, 5.4, 0.5, surface, 0xe2a84b, 0.64);
    addPond(parent, -1.25, 0.25, surface, 1.48);
    addPad(parent, -1.7, 0.55, surface + 0.13, 1);
    addPad(parent, -0.55, -0.15, surface + 0.13, 0.8);
    addDaisy(parent, -1.65, 0.58, surface + 0.16, 0.48, 0.2);
    addCattail(parent, -2.7, -0.85, surface);
    addCattail(parent, -2.4, -0.25, surface);
    addBucket(parent, -5.0, 1.45, surface);
    var bed = addBed(parent, 2.45, -0.15, 4.5, 2.6, surface);
    addTulip(parent, 1.45, -0.45, bed, 0xff7a59, 1.05, 0.3);
    addTulip(parent, 2.55, -0.1, bed, 0xb07bff, 1, 1.1);
    addEmpty(parent, 3.6, -0.4, bed, 1);
    addTulip(parent, 2.05, 0.5, bed, 0xfff2c9, 0.95, 1.8);
    var back = addBed(parent, -0.15, -2.25, 3.5, 1.7, surface);
    addSprout(parent, -0.85, -2.3, back, 0.4);
    addSprout(parent, 0.05, -2.15, back, 1.1);
    addEmpty(parent, 0.85, -2.35, back, 0.85);
    addBench(parent, 3.85, 2.05, surface, -0.45);
    signs[1] = addSign(parent, -4.15, 2.2, surface, '1st', 0.4, 1.85);
    addStone(parent, 0.4, 2.6, surface, 0.9, mats.stoneGray);
    addStone(parent, -0.15, 1.85, surface, 0.75, mats.pebble);
    addStone(parent, 0.7, 1.15, surface, 0.7, mats.stone);
    addBee(parent, 2.3, 2.05, 0.2);
    addSun(parent, -2.4, 4.7, -4.6, 0.58, 0xfff0a8);
    addCloud(parent, 2.2, 4.4, -4.65, 0.95, clay(0xffffff, 1));
    addCloud(parent, -4.6, 4.0, -4.4, 0.7, clay(0xffffff, 1));
    addTufts(parent, surface, 0x3ea84c, 0.15);
    addThreshold(parent);
  }

  function buildSecond(parent) {
    var surface = addLawn(parent, 0x78b84c, 0xc6d45e);
    var hill = M(SPHERE, clay(0xd7e7a4, 1), -3.25, surface + 0.2, -1.15, false);
    hill.scale.set(2.7, 1.2, 2.15);
    parent.add(hill);
    addHill(parent, 2.8, 0.1, -4.7, 3.2, 1.4, 2, 0xe4dead);
    addTree(parent, -3.35, -1.05, surface + 0.78, 0x58c45a, 0x3eaa48, 1.05);
    var bed = addBed(parent, 2.2, -0.25, 4.7, 2.85, surface);
    addSunflower(parent, 1.15, -0.45, bed, 0.5);
    addEmpty(parent, 2.25, 0.35, bed, 1);
    addSunflower(parent, 3.3, -0.35, bed, 1.4);
    addEmpty(parent, 3.45, 0.7, bed, 0.95);
    addLavender(parent, 0.15, 1.65, surface);
    addLavender(parent, -0.35, 2.05, surface);
    addStump(parent, -0.95, 2.4, surface);
    addBird(parent, -0.95, surface + 0.62, 2.4, 0x7eb6e8);
    addDaisy(parent, -1.7, 0.85, surface, 0.8, 0.9);
    addBunting(parent, -1.4, 2.55, -3.25, 3.6, 2.35, -3.4, [0xff8f8f, 0xffd56a, 0x9ee6c5, 0xffb0d4]);
    signs[2] = addSign(parent, 4.55, 1.7, surface, '2nd', -0.45, 2.05);
    addStone(parent, 0.2, 3.2, surface, 1, mats.stoneGray);
    addStone(parent, 0.7, 2.4, surface, 0.85, mats.stoneGray);
    addStone(parent, 1.15, 1.6, surface, 0.75, mats.pebble);
    addStone(parent, 1.5, 0.85, surface, 0.7, mats.stoneGray);
    addButterfly(parent, -0.2, 2.5, 0.3, 0xffd56a);
    addSun(parent, 3.7, 3.55, -4.15, 0.86, 0xffb15a);
    addCloud(parent, -1.2, 4.15, -4.6, 1.05, clay(0xfff3e8, 1));
    addCloud(parent, 1.5, 4.55, -4.8, 0.8, clay(0xfff6ee, 1));
    var bush = M(SPHERE, clay(0x6fbf55, 0.84), -5.35, surface + 0.4, -0.4);
    bush.scale.set(0.7, 0.55, 0.6);
    parent.add(bush);
    addTufts(parent, surface, 0x6aaa40, -0.1);
  }

  var skyTex = skyTexture();
  var span3 = SPAN * 3;
  skyTex.repeat.set(SKY_W / span3, 1);
  skyTex.offset.set((1.5 * SPAN - SKY_W / 2) / span3, 0);
  skyTex.needsUpdate = true;
  var skyMat = new THREE.MeshBasicMaterial({ map: skyTex });
  var sky = new THREE.Mesh(new THREE.PlaneGeometry(SKY_W, SKY_H), skyMat);
  sky.position.set(SPAN, SKY_Y, SKY_Z);
  scene.add(sky);

  var meadow = new THREE.Mesh(
    new THREE.PlaneGeometry(96, 50),
    new THREE.MeshStandardMaterial({ color: 0xd4f0ae, roughness: 1 })
  );
  meadow.rotation.x = -Math.PI / 2;
  meadow.receiveShadow = true;
  scene.add(meadow);

  var hemi = new THREE.HemisphereLight(0xfff6de, 0x8ec56a, 0.84);
  scene.add(hemi);
  var key = new THREE.DirectionalLight(0xfff3d8, 1.22);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 4;
  key.shadow.camera.far = 38;
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  scene.add(key.target);
  var fill = new THREE.DirectionalLight(0xfff8ee, 0.4);
  fill.position.set(2, 8, 18);
  scene.add(fill);
  scene.add(fill.target);
  fill.target.position.set(0, 1.2, 0);

  var rooms = [];
  function buildRooms() {
    var makers = [buildK, buildFirst, buildSecond];
    var i;
    for (i = 0; i < makers.length; i++) {
      var g = new THREE.Group();
      g.position.x = i * SPAN;
      scene.add(g);
      makers[i](g);
      rooms.push(g);
    }
  }

  try {
    buildRooms();
  } catch (errBuild) {
    if (window.console && console.error) console.error(errBuild);
    showFail();
    return;
  }

  function openingIndex() {
    var search = window.location && window.location.search ? window.location.search : '';
    var match = /[?&]garden=([^&]+)/.exec(search);
    if (!match) return 0;
    var v = match[1];
    try { v = decodeURIComponent(v); } catch (errDec) { v = match[1]; }
    v = String(v).toLowerCase();
    if (v === '1' || v === '1st' || v === 'first') return 1;
    if (v === '2' || v === '2nd' || v === 'second') return 2;
    return 0;
  }

  var state = GardensPager.createState({
    index: openingIndex(),
    width: window.innerWidth || 1024
  });
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (motionQuery && motionQuery.matches) state.reduced = true;

  var soundOn = true;
  var audioCtx = null;
  var lineOverride = '';
  var lineHold = 0;
  var chromeKey = '';
  var wasArrived = true;
  var settled = state.target;
  var pointerId = null;
  var downX = 0;
  var downY = 0;
  var wheelLock = 0;
  var time = 0;
  var last = 0;
  var ready = false;

  var skyColor = new THREE.Color();
  var skyA = new THREE.Color();
  var skyB = new THREE.Color();
  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();

  function blendSky(t) {
    if (t <= 0) return skyColor.setHex(SKY_TOP[0]);
    if (t >= SKY_TOP.length - 1) return skyColor.setHex(SKY_TOP[SKY_TOP.length - 1]);
    var i = Math.floor(t);
    skyA.setHex(SKY_TOP[i]);
    skyB.setHex(SKY_TOP[i + 1]);
    return skyColor.copy(skyA).lerp(skyB, t - i);
  }

  function frameFor(aspect) {
    var dist = LOOK_DIST;
    var half = aspect < 0.95 ? 6.15 : HALF_W;
    var maxV = (aspect < 0.95 ? 64 : 50) * Math.PI / 180;
    var hFov = 2 * Math.atan(half / dist);
    var vFov = 2 * Math.atan(Math.tan(hFov / 2) / Math.max(0.45, aspect));
    if (vFov > maxV) {
      vFov = maxV;
      hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      dist = half / Math.tan(hFov / 2);
    }
    return { fov: vFov * 180 / Math.PI, dist: dist, half: half };
  }

  function resize() {
    var w = canvas.clientWidth || window.innerWidth || 1;
    var h = canvas.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h, false);
    state.width = window.innerWidth || w;
    var aspect = w / h;
    var frame = frameFor(aspect);
    camDist = frame.dist;
    camPitch = aspect < 0.95 ? 0.64 : PITCH;
    camera.fov = frame.fov;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function placeCamera() {
    var dist = camDist;
    var slip = Math.abs(state.offset - Math.round(state.offset));
    if (slip > 0.5) slip = 0.5;
    if (!state.reduced) dist += slip * 0.75;
    var cx = state.offset * SPAN;
    var roll = 0;
    var lookAhead = 0;
    if (!state.reduced) {
      roll = -state.velocity * 0.012;
      if (roll > 0.03) roll = 0.03;
      if (roll < -0.03) roll = -0.03;
      lookAhead = -state.velocity * 0.28;
      if (lookAhead > 0.45) lookAhead = 0.45;
      if (lookAhead < -0.45) lookAhead = -0.45;
    }
    camera.position.set(cx, LOOK_Y + Math.sin(camPitch) * dist, LOOK_Z + Math.cos(camPitch) * dist);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(cx + lookAhead, LOOK_Y, LOOK_Z);
    key.position.set(cx - 5.2, 13.2, 9);
    key.target.position.set(cx, 0.2, -0.4);
    key.shadow.camera.updateProjectionMatrix();
    renderer.setClearColor(blendSky(state.offset), 1);
  }

  function paintChrome() {
    var i = GardensPager.nearest(state);
    var g = GardensPager.GARDENS[i];
    var line = lineOverride || (g.line + ' · swipe sideways');
    var prevOff = state.target <= 0;
    var nextOff = state.target >= state.count - 1;
    var key = i + '|' + (prevOff ? '1' : '0') + (nextOff ? '1' : '0') + '|' + line;
    if (key === chromeKey) return;
    chromeKey = key;
    if (gradeEl.getAttribute('data-i') !== String(i)) {
      gradeEl.textContent = g.title;
      gradeEl.setAttribute('data-i', String(i));
      document.title = g.title + ' · Gardens';
      document.body.setAttribute('data-garden', g.id);
      document.body.classList.remove('g-k', 'g-1', 'g-2');
      document.body.classList.add('g-' + g.id);
      if (themeMeta) themeMeta.setAttribute('content', THEME_HEX[i]);
    }
    lineEl.textContent = line;
    prevBtn.disabled = prevOff;
    nextBtn.disabled = nextOff;
    var chips = document.querySelectorAll('#pager button');
    var c;
    for (c = 0; c < chips.length; c++) {
      if (Number(chips[c].getAttribute('data-i')) === i) chips[c].setAttribute('aria-current', 'true');
      else chips[c].removeAttribute('aria-current');
    }
  }

  function sayLine(text) {
    lineOverride = text;
    lineHold = 2.3;
    chromeKey = '';
    paintChrome();
  }

  function unlockAudio() {
    if (!soundOn) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function tone(freq, when, dur, gain) {
    if (!audioCtx || !soundOn) return;
    var osc = audioCtx.createOscillator();
    var amp = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, when);
    amp.gain.setValueAtTime(gain, when);
    amp.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    osc.connect(amp);
    amp.connect(audioCtx.destination);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  function chime() {
    if (!audioCtx || !soundOn) return;
    var t = audioCtx.currentTime;
    tone(523, t, 0.12, 0.03);
    tone(784, t + 0.09, 0.18, 0.024);
  }

  function blip() {
    if (!audioCtx || !soundOn) return;
    tone(660, audioCtx.currentTime, 0.08, 0.02);
  }

  function watchArrival() {
    if (state.arrived && !wasArrived && state.target !== settled) {
      settled = state.target;
      chime();
      if (!state.reduced && signs[state.target]) signs[state.target].userData.pop = 0.001;
    }
    if (state.arrived) settled = state.target;
    wasArrived = state.arrived;
  }

  function kindOwner(obj) {
    var node = obj;
    while (node) {
      if (node.userData && node.userData.kind) return node;
      node = node.parent;
    }
    return null;
  }

  function pick(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    var hits = raycaster.intersectObjects(scene.children, true);
    var i;
    for (i = 0; i < hits.length; i++) {
      var owner = kindOwner(hits[i].object);
      if (!owner) continue;
      owner.userData.bounce = 0.001;
      if (owner.userData.kind === 'flower') {
        blip();
        return;
      }
      if (owner.userData.kind === 'empty') {
        sayLine('An empty spot for another flower');
        return;
      }
    }
  }

  function fromButton(node) {
    while (node) {
      if (node.tagName === 'BUTTON') return true;
      node = node.parentNode;
    }
    return false;
  }

  function jump(index) {
    pointerId = null;
    GardensPager.goTo(state, index);
  }

  function onDown(e) {
    if (pointerId !== null) return;
    if (fromButton(e.target)) return;
    pointerId = e.pointerId;
    downX = e.clientX;
    downY = e.clientY;
    state.width = window.innerWidth || 1;
    GardensPager.pointerDown(state, e.clientX, e.timeStamp / 1000);
    unlockAudio();
    if (e.cancelable) e.preventDefault();
  }

  function onMove(e) {
    if (e.pointerId !== pointerId) return;
    GardensPager.pointerMove(state, e.clientX, e.timeStamp / 1000);
    if (e.cancelable) e.preventDefault();
  }

  function onUp(e) {
    if (e.pointerId !== pointerId) return;
    var dx = e.clientX - downX;
    var dy = e.clientY - downY;
    var tap = dx * dx + dy * dy < 22 * 22;
    GardensPager.pointerUp(state, e.clientX, e.timeStamp / 1000);
    pointerId = null;
    if (tap) pick(e.clientX, e.clientY);
  }

  window.addEventListener('pointerdown', onDown, { passive: false });
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  prevBtn.addEventListener('click', function () { unlockAudio(); jump(state.target - 1); });
  nextBtn.addEventListener('click', function () { unlockAudio(); jump(state.target + 1); });
  var chipButtons = document.querySelectorAll('#pager button');
  var bi;
  for (bi = 0; bi < chipButtons.length; bi++) {
    chipButtons[bi].addEventListener('click', function (e) {
      unlockAudio();
      jump(Number(e.currentTarget.getAttribute('data-i')));
    });
  }
  calmBtn.addEventListener('click', function () {
    state.reduced = !state.reduced;
    calmBtn.setAttribute('aria-pressed', state.reduced ? 'true' : 'false');
    document.body.classList.toggle('calm', state.reduced);
  });
  soundBtn.addEventListener('click', function () {
    soundOn = !soundOn;
    soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    if (soundOn) unlockAudio();
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { jump(state.target + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { jump(state.target - 1); e.preventDefault(); }
    else if (e.key === 'Home') { jump(0); e.preventDefault(); }
    else if (e.key === 'End') { jump(state.count - 1); e.preventDefault(); }
  });
  window.addEventListener('wheel', function (e) {
    if (e.cancelable) e.preventDefault();
    var now = window.performance ? performance.now() : 0;
    if (now < wheelLock) return;
    var dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(dx) < 8) return;
    wheelLock = now + 450;
    jump(state.target + (dx > 0 ? 1 : -1));
  }, { passive: false });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () { last = 0; });

  if (state.reduced) {
    calmBtn.setAttribute('aria-pressed', 'true');
    document.body.classList.add('calm');
  }

  function animateLife(dt) {
    time += state.reduced ? 0 : dt;
    var i;
    for (i = 0; i < swayers.length; i++) {
      var s = swayers[i];
      s.obj.rotation.z = state.reduced ? 0 : Math.sin(time * 1.5 + s.phase) * s.amp;
    }
    for (i = 0; i < drifters.length; i++) {
      var d = drifters[i];
      d.obj.position.x = state.reduced ? d.baseX : d.baseX + Math.sin(time * 0.12 + d.phase) * d.amp;
    }
    for (i = 0; i < bobbers.length; i++) {
      var b = bobbers[i];
      b.obj.position.y = state.reduced ? b.baseY : b.baseY + Math.sin(time * 2 + b.phase) * b.amp;
    }
    for (i = 0; i < flyers.length; i++) {
      var f = flyers[i];
      if (state.reduced) {
        f.obj.position.set(f.cx, f.cy, f.cz);
      } else {
        var u = time * f.speed + f.phase;
        f.obj.position.set(
          f.cx + Math.sin(u) * f.rx,
          f.cy + Math.sin(u * 1.7) * f.ry,
          f.cz + Math.cos(u * 0.85) * f.rz
        );
        f.obj.rotation.y = Math.sin(u * 0.7) * 0.4;
        if (f.wingL) {
          var flap = Math.sin(time * f.flap + f.phase) * 0.65;
          f.wingL.rotation.z = 0.35 + flap;
          f.wingR.rotation.z = -0.35 - flap;
        }
      }
    }
    for (i = 0; i < pulses.length; i++) {
      var shine = pulses[i];
      var beat = state.reduced ? 1 : 1 + Math.sin(time * 1.4 + i) * 0.06;
      shine.scale.x = shine.userData.bx * beat;
      shine.scale.z = shine.userData.bz * beat;
    }
    for (i = 0; i < bouncers.length; i++) {
      var o = bouncers[i];
      if (!o.userData.bounce) continue;
      if (state.reduced) {
        o.userData.bounce = 0;
        o.scale.setScalar(o.userData.baseScale || 1);
        continue;
      }
      o.userData.bounce += dt;
      var uB = o.userData.bounce / 0.32;
      var base = o.userData.baseScale || 1;
      if (uB >= 1) {
        o.userData.bounce = 0;
        o.scale.setScalar(base);
      } else {
        var k = Math.sin(uB * Math.PI) * 0.14;
        o.scale.set(base * (1 + k), base * (1 - k * 1.35), base * (1 + k));
      }
    }
    for (i = 0; i < signs.length; i++) {
      var sign = signs[i];
      if (!sign || !sign.userData.pop) continue;
      if (state.reduced) {
        sign.userData.pop = 0;
        sign.scale.setScalar(1);
        continue;
      }
      sign.userData.pop += dt;
      var uS = sign.userData.pop / 0.36;
      if (uS >= 1) {
        sign.userData.pop = 0;
        sign.scale.setScalar(1);
      } else {
        sign.scale.setScalar(1 + Math.sin(uS * Math.PI) * 0.08);
      }
    }
  }

  var pi;
  for (pi = 0; pi < pulses.length; pi++) {
    pulses[pi].userData.bx = pulses[pi].scale.x;
    pulses[pi].userData.bz = pulses[pi].scale.z;
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (!last) last = now;
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (!(dt > 0)) dt = 0;
    GardensPager.step(state, dt);
    if (lineHold > 0) {
      lineHold -= dt;
      if (lineHold <= 0) {
        lineOverride = '';
        chromeKey = '';
      }
    }
    animateLife(dt);
    placeCamera();
    paintChrome();
    watchArrival();
    document.body.classList.toggle('dragging', !!state.dragging);
    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      document.body.setAttribute('data-ready', '1');
    }
  }

  resize();
  placeCamera();
  paintChrome();
  requestAnimationFrame(loop);
})();
