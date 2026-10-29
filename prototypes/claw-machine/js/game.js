/* Toy Claw — cabinet, claw, and touch controls.
   Three.js r160 is loaded first. Physics lives in physics.js.
   No network. Sounds are Web Audio oscillators. */
(function () {
  'use strict';

  var W = ClawPhysics.WORLD;
  var B = W.bounds;
  var reduced = false;
  var soundOn = true;
  var dropQueued = false;
  var shake = 0;
  var punch = 0;
  var drawerShown = 0;
  var drawerTarget = 0;
  var drawerHold = 0;
  var prizeSlots = 0;
  var seenGen = 0;
  var time = 0;

  var canvas = document.getElementById('view');
  var hintEl = document.getElementById('hint');
  var dropBtn = document.getElementById('drop');
  var joy = document.getElementById('joystick');
  var stickEl = document.getElementById('stick');
  var failEl = document.getElementById('fail');

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
  } catch (err) {
    failEl.hidden = false;
    return;
  }
  if (!renderer.getContext()) {
    failEl.hidden = false;
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, 1, 0.06, 40);
  var camPos = new THREE.Vector3();
  var look = new THREE.Vector3();
  var baseDesired = new THREE.Vector3();
  var baseLook = new THREE.Vector3();
  var baseFov = 38;
  var camReady = false;
  var desired = new THREE.Vector3();
  var UP = new THREE.Vector3(0, 1, 0);
  var scratch = new THREE.Vector3();
  var scratchB = new THREE.Vector3();
  var scratchC = new THREE.Vector3();

  var GEOS = {};
  function geo(key, build) {
    if (!GEOS[key]) GEOS[key] = build();
    return GEOS[key];
  }

  var MATS = {};
  function plastic(color, rough) {
    var key = String(color) + '/' + rough;
    if (!MATS[key]) {
      MATS[key] = new THREE.MeshStandardMaterial({
        color: color,
        roughness: rough,
        metalness: 0.03,
        envMapIntensity: 0.28
      });
    }
    return MATS[key];
  }

  function glossy(color) {
    var key = 'g/' + color;
    if (!MATS[key]) {
      MATS[key] = new THREE.MeshPhysicalMaterial({
        color: color,
        roughness: 0.32,
        metalness: 0.04,
        clearcoat: 0.55,
        clearcoatRoughness: 0.28,
        envMapIntensity: 0.4
      });
    }
    return MATS[key];
  }

  function roundedBox(width, height, depth, radius) {
    var r = Math.min(radius, width / 2, height / 2, depth / 2);
    var hw = Math.max(0.001, (width - 2 * r) / 2);
    var hh = Math.max(0.001, (height - 2 * r) / 2);
    var shape = new THREE.Shape();
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.closePath();
    var g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.001, depth - 2 * r),
      bevelEnabled: true,
      bevelThickness: r,
      bevelSize: r,
      bevelSegments: 2,
      curveSegments: 1
    });
    g.computeBoundingBox();
    var c = g.boundingBox.getCenter(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z);
    g.computeVertexNormals();
    return g;
  }

  function rbox(w, h, d, r) {
    return geo('rb' + w + 'x' + h + 'x' + d + 'x' + r, function () {
      return roundedBox(w, h, d, r);
    });
  }

  function addMesh(geometry, material, cast) {
    var m = new THREE.Mesh(geometry, material);
    m.castShadow = cast !== false;
    m.receiveShadow = true;
    return m;
  }

  function canvasTex(draw) {
    var c = document.createElement('canvas');
    draw(c);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function roundPath(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  var floorTex = canvasTex(function (c) {
    c.width = 512;
    c.height = 512;
    var g = c.getContext('2d');
    g.fillStyle = '#2faf86';
    g.fillRect(0, 0, 512, 512);
    var x, y, n = 0;
    for (y = 28; y < 512; y += 56) {
      for (x = 28; x < 512; x += 56) {
        g.fillStyle = n % 2 ? '#d8fff0' : '#3fbf96';
        g.beginPath();
        g.arc(x, y, 9, 0, Math.PI * 2);
        g.fill();
        n++;
      }
    }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(2.2, 2.2);

  var wallTex = canvasTex(function (c) {
    c.width = 512;
    c.height = 512;
    var g = c.getContext('2d');
    g.fillStyle = '#8d6ad8';
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#ff6d9a';
    var y, x, shift;
    for (y = 40; y < 512; y += 80) {
      shift = ((y / 80) % 2) * 40;
      for (x = 40 + shift; x < 512; x += 80) {
        g.beginPath();
        g.arc(x, y, 16, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(1.6, 1.3);

  var shadowTex = canvasTex(function (c) {
    c.width = 128;
    c.height = 128;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(64, 64, 8, 64, 64, 60);
    grd.addColorStop(0, 'rgba(48, 28, 72, 0.45)');
    grd.addColorStop(1, 'rgba(48, 28, 72, 0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  });

  var signTex = canvasTex(function (c) {
    c.width = 1024;
    c.height = 320;
    var g = c.getContext('2d');
    g.clearRect(0, 0, 1024, 320);
    g.fillStyle = '#ff7b93';
    roundPath(g, 20, 20, 984, 280, 56);
    g.fill();
    g.fillStyle = '#fff6ea';
    roundPath(g, 48, 48, 928, 224, 40);
    g.fill();
    g.fillStyle = '#3a2b55';
    g.font = '800 120px "Trebuchet MS", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Red Words', 512, 168);
  });

  function present(inner) {
    var box = new THREE.Box3().setFromObject(inner);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    inner.position.sub(center);
    var maxDim = Math.max(size.x, size.y, size.z, 0.001);
    var wrap = new THREE.Group();
    wrap.add(inner);
    wrap.scale.setScalar((W.prizeR * 1.96) / maxDim);
    wrap.traverse(function (o) {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return wrap;
  }

  function sphere(r, seg) {
    return geo('s' + r + 'x' + (seg || 18), function () {
      return new THREE.SphereGeometry(r, seg || 18, Math.max(10, (seg || 18) - 4));
    });
  }

  function eyes(g, y, z, sep, s) {
    var white = plastic(0xfffaf3, 0.3);
    var pupil = plastic(0x2c2444, 0.4);
    var i, side, e, p;
    for (i = 0; i < 2; i++) {
      side = i ? 1 : -1;
      e = new THREE.Mesh(sphere(0.018 * s, 12), white);
      e.position.set(side * sep, y, z);
      p = new THREE.Mesh(sphere(0.009 * s, 10), pupil);
      p.position.set(side * sep, y, z + 0.012 * s);
      g.add(e, p);
    }
  }

  function cheeks(g, y, z, sep) {
    var mat = plastic(0xffb3c7, 0.55);
    var a = new THREE.Mesh(sphere(0.012, 10), mat);
    var b = a.clone();
    a.position.set(-sep, y, z);
    b.position.set(sep, y, z);
    g.add(a, b);
  }

  function smile(g, y, z, s) {
    var m = new THREE.Mesh(
      geo('smile', function () { return new THREE.TorusGeometry(0.028, 0.006, 6, 14, Math.PI); }),
      plastic(0x2c2444, 0.45)
    );
    m.scale.setScalar(s);
    m.position.set(0, y, z);
    m.rotation.z = Math.PI;
    g.add(m);
  }

  function bear(color) {
    var g = new THREE.Group();
    var fur = plastic(color, 0.68);
    var body = new THREE.Mesh(sphere(0.1, 22), fur);
    body.scale.set(1, 0.9, 0.92);
    body.position.y = -0.02;
    var head = new THREE.Mesh(sphere(0.072, 22), fur);
    head.position.set(0, 0.078, 0.012);
    var earL = new THREE.Mesh(sphere(0.028, 14), fur);
    var earR = earL.clone();
    earL.position.set(-0.048, 0.132, 0);
    earR.position.set(0.048, 0.132, 0);
    var inL = new THREE.Mesh(sphere(0.014, 10), plastic(0xffc2d4, 0.5));
    var inR = inL.clone();
    inL.position.set(-0.048, 0.13, 0.012);
    inR.position.set(0.048, 0.13, 0.012);
    var snout = new THREE.Mesh(sphere(0.028, 14), plastic(0xfff1e4, 0.55));
    snout.scale.set(1, 0.8, 0.75);
    snout.position.set(0, 0.062, 0.06);
    var nose = new THREE.Mesh(sphere(0.012, 10), plastic(0x2c2444, 0.4));
    nose.position.set(0, 0.068, 0.084);
    g.add(body, head, earL, earR, inL, inR, snout, nose);
    eyes(g, 0.086, 0.07, 0.028, 1);
    cheeks(g, 0.07, 0.072, 0.04);
    return present(g);
  }

  function duck(color) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(sphere(0.095, 22), plastic(color, 0.5));
    body.scale.set(1.05, 0.82, 0.9);
    body.position.y = -0.02;
    var head = new THREE.Mesh(sphere(0.055, 18), plastic(color, 0.5));
    head.position.set(0, 0.07, 0.04);
    var beak = new THREE.Mesh(geo('beak', function () { return new THREE.ConeGeometry(0.03, 0.07, 10); }), plastic(0xff8a3d, 0.45));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.062, 0.1);
    g.add(body, head, beak);
    eyes(g, 0.082, 0.086, 0.022, 0.9);
    return present(g);
  }

  function car(color) {
    var g = new THREE.Group();
    var body = addMesh(rbox(0.2, 0.07, 0.12, 0.02), plastic(color, 0.38));
    body.position.y = 0.015;
    var cabin = addMesh(rbox(0.1, 0.055, 0.1, 0.018), plastic(0xf7fbff, 0.22));
    cabin.position.set(-0.015, 0.068, 0);
    var wheelGeo = geo('wheel', function () {
      var w = new THREE.CylinderGeometry(0.032, 0.032, 0.028, 14);
      w.rotateX(Math.PI / 2);
      return w;
    });
    var hubGeo = geo('hub', function () { return new THREE.CylinderGeometry(0.014, 0.014, 0.03, 10); });
    var xi, zi, w, h;
    for (xi = 0; xi < 2; xi++) {
      for (zi = 0; zi < 2; zi++) {
        w = new THREE.Mesh(wheelGeo, plastic(0x2c2444, 0.55));
        w.position.set(xi ? 0.062 : -0.062, -0.012, zi ? 0.055 : -0.055);
        h = new THREE.Mesh(hubGeo, plastic(0xfff6ea, 0.35));
        h.rotation.x = Math.PI / 2;
        h.position.copy(w.position);
        g.add(w, h);
      }
    }
    var lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe08a, emissiveIntensity: 0.9, roughness: 0.35 });
    var l1 = new THREE.Mesh(sphere(0.014, 10), lampMat);
    var l2 = l1.clone();
    l1.position.set(0.09, 0.02, 0.03);
    l2.position.set(0.09, 0.02, -0.03);
    g.add(body, cabin, l1, l2);
    eyes(g, 0.08, 0.055, 0.025, 0.7);
    return present(g);
  }

  function starGeo() {
    return geo('star', function () {
      var shape = new THREE.Shape();
      var i, r, a, x, y;
      for (i = 0; i < 10; i++) {
        r = i % 2 === 0 ? 0.12 : 0.052;
        a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        x = Math.cos(a) * r;
        y = Math.sin(a) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
      var g = new THREE.ExtrudeGeometry(shape, {
        depth: 0.055,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.008,
        bevelSegments: 1
      });
      g.center();
      return g;
    });
  }

  function star(color) {
    var g = new THREE.Group();
    var m = new THREE.Mesh(starGeo(), glossy(color));
    g.add(m);
    eyes(g, 0.012, 0.04, 0.028, 0.8);
    smile(g, -0.02, 0.04, 0.7);
    return present(g);
  }

  function heartGeo() {
    return geo('heart', function () {
      var s = new THREE.Shape();
      s.moveTo(0, -0.09);
      s.bezierCurveTo(0, -0.05, -0.095, -0.045, -0.095, 0.02);
      s.bezierCurveTo(-0.095, 0.075, -0.04, 0.085, 0, 0.04);
      s.bezierCurveTo(0.04, 0.085, 0.095, 0.075, 0.095, 0.02);
      s.bezierCurveTo(0.095, -0.045, 0, -0.05, 0, -0.09);
      var g = new THREE.ExtrudeGeometry(s, {
        depth: 0.06,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.008,
        bevelSegments: 1
      });
      g.center();
      return g;
    });
  }

  function heart(color) {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(heartGeo(), glossy(color)));
    return present(g);
  }

  function blob(color) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(sphere(0.1, 22), plastic(color, 0.5));
    body.scale.set(1, 0.92, 0.95);
    var armGeo = geo('arm', function () { return new THREE.CapsuleGeometry(0.018, 0.05, 3, 8); });
    var a1 = new THREE.Mesh(armGeo, plastic(color, 0.5));
    var a2 = a1.clone();
    a1.position.set(-0.1, -0.01, 0.02);
    a1.rotation.z = 0.8;
    a2.position.set(0.1, -0.01, 0.02);
    a2.rotation.z = -0.8;
    g.add(body, a1, a2);
    eyes(g, 0.03, 0.08, 0.032, 1.15);
    cheeks(g, 0.005, 0.085, 0.045);
    smile(g, -0.025, 0.09, 0.9);
    return present(g);
  }

  function capsuleToy(color) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      geo('cap', function () { return new THREE.CapsuleGeometry(0.07, 0.08, 6, 12); }),
      glossy(color)
    );
    var band = new THREE.Mesh(
      geo('band', function () { return new THREE.CylinderGeometry(0.072, 0.072, 0.03, 16); }),
      plastic(0xfffaf3, 0.35)
    );
    g.add(body, band);
    eyes(g, 0.03, 0.062, 0.025, 0.75);
    return present(g);
  }

  function rocket(color) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      geo('rbody', function () { return new THREE.CylinderGeometry(0.045, 0.05, 0.14, 14); }),
      plastic(0xfff6ea, 0.4)
    );
    var nose = new THREE.Mesh(
      geo('nose', function () { return new THREE.ConeGeometry(0.048, 0.08, 14); }),
      plastic(color, 0.4)
    );
    nose.position.y = 0.1;
    var finGeo = geo('fin', function () { return new THREE.BoxGeometry(0.01, 0.05, 0.04); });
    var i, fin;
    for (i = 0; i < 3; i++) {
      fin = new THREE.Mesh(finGeo, plastic(color, 0.4));
      fin.position.y = -0.05;
      fin.position.x = Math.cos(i * Math.PI * 2 / 3) * 0.05;
      fin.position.z = Math.sin(i * Math.PI * 2 / 3) * 0.05;
      g.add(fin);
    }
    var win = new THREE.Mesh(sphere(0.02, 12), plastic(0x8fd4ff, 0.2));
    win.position.set(0, 0.02, 0.04);
    g.add(body, nose, win);
    return present(g);
  }

  function ring(color) {
    var g = new THREE.Group();
    var donut = new THREE.Mesh(
      geo('donut', function () { return new THREE.TorusGeometry(0.075, 0.032, 12, 24); }),
      glossy(color)
    );
    donut.rotation.x = Math.PI / 2;
    g.add(donut);
    var sprinkle = [0xff5d8f, 0xffd24a, 0x4aa3ff, 0x3ddec0, 0xfffaf3];
    var i, bit, a;
    for (i = 0; i < 5; i++) {
      bit = new THREE.Mesh(geo('spr' + i, function () { return new THREE.SphereGeometry(0.012, 8, 6); }), plastic(sprinkle[i], 0.4));
      a = i / 5 * Math.PI * 2;
      bit.position.set(Math.cos(a) * 0.075, 0.03, Math.sin(a) * 0.075);
      g.add(bit);
    }
    return present(g);
  }

  var builders = {
    bear: bear,
    duck: duck,
    car: car,
    star: star,
    heart: heart,
    blob: blob,
    capsule: capsuleToy,
    rocket: rocket,
    ring: ring
  };

  function buildToy(kind, color) {
    return (builders[kind] || star)(color);
  }

  var coral = plastic(0xff7b93, 0.52);
  var coralDeep = plastic(0xf25d7c, 0.48);
  var cream = plastic(0xfff6ea, 0.6);
  var ink = plastic(0x3a2b55, 0.45);
  var railMat = glossy(0x6d5bd0);

  var floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0,
    envMapIntensity: 0.25
  });
  var wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0,
    envMapIntensity: 0.3
  });

  var innerW = B.x1 - B.x0;
  var innerD = B.z1 - B.z0;
  var midZ = (B.z0 + B.z1) / 2;

  var floor = addMesh(new THREE.BoxGeometry(innerW - 0.04, 0.08, innerD - 0.06), floorMat, false);
  floor.position.set(0, -0.02, midZ);
  floor.castShadow = false;
  scene.add(floor);

  var frontZ = B.z1 + 0.34;
  var backZ = B.z0 - 0.12;
  var base = addMesh(rbox(innerW + 0.32, 0.3, frontZ - backZ, 0.1), coral);
  base.position.set(0, -0.2, (frontZ + backZ) / 2);
  scene.add(base);

  var skirt = addMesh(rbox(innerW + 0.02, 0.06, 0.14, 0.03), cream, false);
  skirt.position.set(0, 0.05, B.z1 + 0.05);
  scene.add(skirt);

  function post(x, z) {
    var p = addMesh(geo('post', function () { return new THREE.CapsuleGeometry(0.07, 1.28, 4, 12); }), coralDeep);
    p.position.set(x, 0.78, z);
    scene.add(p);
  }
  post(B.x0 - 0.02, B.z0);
  post(B.x1 + 0.02, B.z0);
  post(B.x0 - 0.02, B.z1);
  post(B.x1 + 0.02, B.z1);

  var back = addMesh(new THREE.BoxGeometry(innerW, 1.36, 0.08), wallMat, false);
  back.position.set(0, 0.78, B.z0 - 0.04);
  scene.add(back);

  function sidePanel(x, rot) {
    var p = addMesh(new THREE.BoxGeometry(innerD * 0.72, 0.42, 0.06), coral, false);
    p.position.set(x, 0.32, midZ - 0.05);
    p.rotation.y = Math.PI / 2;
    scene.add(p);
  }
  sidePanel(B.x0 - 0.04);
  sidePanel(B.x1 + 0.04);

  var roof = addMesh(rbox(innerW + 0.28, 0.1, innerD + 0.16, 0.04), coral);
  roof.position.set(0, 1.54, midZ);
  scene.add(roof);

  var sign = new THREE.Group();
  var signBox = addMesh(rbox(1.22, 0.34, 0.14, 0.05), coralDeep);
  var signFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.12, 0.3),
    new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false })
  );
  signFace.position.z = 0.08;
  sign.add(signBox, signFace);
  sign.position.set(0, 1.28, B.z1 - 0.08);
  sign.scale.setScalar(0.82);
  scene.add(sign);

  var bulbColors = [0xff5d8f, 0xffd24a, 0x7af0a8, 0x8fd4ff, 0xb794f6, 0xff8a3d];
  var bulbs = [];
  var bi;
  for (bi = 0; bi < 6; bi++) {
    var bulb = new THREE.Mesh(
      sphere(0.035, 12),
      new THREE.MeshStandardMaterial({
        color: bulbColors[bi],
        emissive: bulbColors[bi],
        emissiveIntensity: 0.7,
        roughness: 0.4
      })
    );
    bulb.position.set(-0.42 + bi * 0.17, 1.5, B.z1 + 0.02);
    bulb.castShadow = false;
    scene.add(bulb);
    bulbs.push(bulb);
  }

  var glassMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { uTint: { value: new THREE.Color('#d7f6ff') } },
    vertexShader: [
      'varying vec3 vN;',
      'varying vec3 vW;',
      'void main() {',
      '  vec4 w = modelMatrix * vec4(position, 1.0);',
      '  vW = w.xyz;',
      '  vN = normalize(mat3(modelMatrix) * normal);',
      '  gl_Position = projectionMatrix * viewMatrix * w;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vN;',
      'varying vec3 vW;',
      'uniform vec3 uTint;',
      'void main() {',
      '  vec3 V = normalize(cameraPosition - vW);',
      '  float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.3);',
      '  float alpha = 0.045 + fres * 0.4;',
      '  vec3 col = mix(uTint, vec3(1.0), fres * 0.9);',
      '  gl_FragColor = vec4(col, alpha);',
      '}'
    ].join('\n')
  });

  var glassH = 1.16;
  var gFront = new THREE.Mesh(new THREE.PlaneGeometry(innerW - 0.16, glassH), glassMat);
  gFront.position.set(0, 0.86, B.z1 + 0.02);
  gFront.renderOrder = 6;
  scene.add(gFront);
  var gSideGeo = new THREE.PlaneGeometry(innerD - 0.2, glassH);
  var gLeft = new THREE.Mesh(gSideGeo, glassMat);
  gLeft.position.set(B.x0 - 0.02, 0.86, midZ);
  gLeft.rotation.y = Math.PI / 2;
  gLeft.renderOrder = 6;
  var gRight = new THREE.Mesh(gSideGeo, glassMat);
  gRight.position.set(B.x1 + 0.02, 0.86, midZ);
  gRight.rotation.y = -Math.PI / 2;
  gRight.renderOrder = 6;
  scene.add(gLeft, gRight);

  function bar(w, h, d, x, y, z) {
    var m = addMesh(rbox(w, h, d, 0.02), cream, false);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }
  bar(innerW + 0.02, 0.055, 0.055, 0, 1.42, B.z1 + 0.03);
  bar(innerW + 0.02, 0.05, 0.05, 0, 0.2, B.z1 + 0.045);

  var tube = new THREE.Mesh(
    new THREE.CylinderGeometry(W.chute.r * 0.78, W.chute.r * 0.55, 0.42, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x241833, roughness: 0.9, side: THREE.DoubleSide })
  );
  tube.position.set(W.chute.x, -0.2, W.chute.z);
  scene.add(tube);
  var hole = new THREE.Mesh(
    new THREE.CircleGeometry(W.chute.r * 0.86, 24),
    new THREE.MeshBasicMaterial({ color: 0x1b142c, toneMapped: false })
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(W.chute.x, 0.025, W.chute.z);
  scene.add(hole);
  var chuteRing = new THREE.Mesh(
    new THREE.TorusGeometry(W.chute.r * 1.02, 0.028, 12, 32),
    new THREE.MeshStandardMaterial({
      color: 0xd8fff6,
      emissive: 0x5dffe8,
      emissiveIntensity: 0.85,
      roughness: 0.35
    })
  );
  chuteRing.rotation.x = Math.PI / 2;
  chuteRing.position.set(W.chute.x, 0.045, W.chute.z);
  scene.add(chuteRing);
  var holeStar = new THREE.Mesh(
    starGeo(),
    new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffd15c, emissiveIntensity: 0.65, roughness: 0.4 })
  );
  holeStar.position.set(W.chute.x, -0.08, W.chute.z);
  holeStar.rotation.x = -Math.PI / 2;
  holeStar.scale.setScalar(0.85);
  scene.add(holeStar);

  var reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.078, 0.108, 36),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false
    })
  );
  reticle.rotation.x = -Math.PI / 2;
  reticle.position.y = 0.026;
  reticle.renderOrder = 3;
  scene.add(reticle);

  var railLen = W.trolleyLim.x1 - W.trolleyLim.x0 + 0.08;
  var railGeo = geo('rail', function () {
    var g = new THREE.CylinderGeometry(0.022, 0.022, railLen, 12);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  var railA = new THREE.Mesh(railGeo, railMat);
  var railB = new THREE.Mesh(railGeo, railMat);
  railA.position.set(0, W.railY + 0.06, W.trolleyLim.z0);
  railB.position.set(0, W.railY + 0.06, W.trolleyLim.z1);
  railA.castShadow = railB.castShadow = true;
  scene.add(railA, railB);

  var beamLen = W.trolleyLim.z1 - W.trolleyLim.z0 + 0.12;
  var beam = addMesh(rbox(0.09, 0.055, beamLen, 0.02), cream);
  beam.position.y = W.railY + 0.02;
  scene.add(beam);
  var carriage = addMesh(rbox(0.18, 0.1, 0.16, 0.03), glossy(0xffd34d));
  scene.add(carriage);

  var claw = new THREE.Group();
  var clawMat = glossy(0xffd34d);
  var tipMat = plastic(0xff8a3d, 0.38);
  var head = new THREE.Mesh(sphere(0.078, 24), clawMat);
  var collar = new THREE.Mesh(geo('collar', function () { return new THREE.CylinderGeometry(0.03, 0.05, 0.07, 16); }), clawMat);
  collar.position.y = 0.06;
  var palm = new THREE.Mesh(sphere(0.055, 18), clawMat);
  palm.scale.set(1, 0.62, 1);
  palm.position.y = -0.02;
  claw.add(head, collar, palm);
  var hinges = [];
  var hi;
  for (hi = 0; hi < 3; hi++) {
    var pivot = new THREE.Group();
    pivot.rotation.y = hi * Math.PI * 2 / 3;
    var hinge = new THREE.Group();
    var prong = new THREE.Mesh(geo('prong', function () { return new THREE.CapsuleGeometry(0.022, 0.13, 4, 10); }), clawMat);
    prong.position.y = -0.095;
    var tip = new THREE.Mesh(sphere(0.034, 14), tipMat);
    tip.position.y = -0.175;
    hinge.add(prong, tip);
    pivot.add(hinge);
    claw.add(pivot);
    hinges.push(hinge);
  }
  claw.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(claw);
  var rope = new THREE.Mesh(
    geo('rope', function () { return new THREE.CylinderGeometry(0.016, 0.016, 1, 10); }),
    plastic(0x5b4db8, 0.45)
  );
  rope.castShadow = true;
  scene.add(rope);

  var drawer = new THREE.Group();
  var drawerBody = addMesh(rbox(0.92, 0.16, 0.36, 0.05), cream);
  var knob = new THREE.Mesh(sphere(0.045, 16), coral);
  knob.position.set(0, 0.01, 0.18);
  knob.castShadow = true;
  drawer.add(drawerBody, knob);
  var drawerHomeZ = B.z1 + 0.16;
  drawer.position.set(0, 0.02, drawerHomeZ);
  drawer.visible = false;
  scene.add(drawer);

  var ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 40),
    new THREE.ShadowMaterial({ opacity: 0.2 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.34;
  ground.receiveShadow = true;
  scene.add(ground);

  var feetGeo = sphere(0.075, 16);
  [[-0.62, backZ + 0.12], [0.62, backZ + 0.12], [-0.62, frontZ - 0.12], [0.62, frontZ - 0.12]].forEach(function (p) {
    var f = new THREE.Mesh(feetGeo, coralDeep);
    f.position.set(p[0], -0.42, p[1]);
    f.castShadow = true;
    scene.add(f);
  });

  var hemi = new THREE.HemisphereLight(0xfff3e4, 0xc9b6ef, 0.95);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xfff8ef, 2.35);
  sun.position.set(1.8, 3.6, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.4;
  sun.shadow.camera.far = 9;
  sun.shadow.camera.left = -2.4;
  sun.shadow.camera.right = 2.4;
  sun.shadow.camera.top = 2.4;
  sun.shadow.camera.bottom = -2.4;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.028;
  scene.add(sun);
  var fill = new THREE.PointLight(0xffd0e4, 5, 7, 2);
  fill.position.set(-0.55, 1.05, 0.35);
  scene.add(fill);
  var warm = new THREE.PointLight(0xffefb8, 4, 6, 2);
  warm.position.set(0.65, 0.95, -0.25);
  scene.add(warm);

  try {
    var envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(
      new THREE.SphereGeometry(8, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff1e4, side: THREE.BackSide })
    ));
    function envPanel(color, x, y, z, rx, ry) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ color: color }));
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, 0);
      envScene.add(m);
    }
    envPanel(0xffd5e6, 0, 0, -6, 0, 0);
    envPanel(0xd9f2ff, 0, 0, 6, 0, Math.PI);
    envPanel(0xfff4cc, 0, 6, 0, Math.PI / 2, 0);
    envPanel(0xe4d6ff, 0, -6, 0, -Math.PI / 2, 0);
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
  } catch (err) {
    scene.environment = null;
  }

  var PCOUNT = 42;
  var bits = [];
  var confetti = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.045, 0.06, 0.02),
    new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0 }),
    PCOUNT
  );
  confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  var candy = [0xff5d8f, 0xffd24a, 0x4aa3ff, 0x3ddec0, 0xb794f6, 0xff8a3d, 0xfffaf3];
  var pi;
  for (pi = 0; pi < PCOUNT; pi++) {
    bits.push({ life: 0, x: 0, y: -4, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, spin: 0 });
    confetti.setColorAt(pi, new THREE.Color(candy[pi % candy.length]));
  }
  confetti.instanceColor.needsUpdate = true;
  confetti.castShadow = false;
  scene.add(confetti);
  var dummy = new THREE.Object3D();

  function burst(x, y, z, n, speed, up) {
    if (reduced) return;
    var left = n;
    var i, b, a, sp;
    for (i = 0; i < PCOUNT && left > 0; i++) {
      b = bits[i];
      if (b.life > 0) continue;
      b.life = 0.65 + Math.random() * 0.35;
      b.x = x; b.y = y; b.z = z;
      a = Math.random() * Math.PI * 2;
      sp = speed * (0.45 + Math.random() * 0.7);
      b.vx = Math.cos(a) * sp;
      b.vz = Math.sin(a) * sp;
      b.vy = up * (0.45 + Math.random());
      b.spin = 2 + Math.random() * 5;
      b.rx = Math.random() * 6;
      b.ry = Math.random() * 6;
      b.rz = Math.random() * 6;
      confetti.setColorAt(i, new THREE.Color(candy[(Math.random() * candy.length) | 0]));
      left--;
    }
    if (confetti.instanceColor) confetti.instanceColor.needsUpdate = true;
  }

  function updateBits(dt) {
    var i, b;
    for (i = 0; i < PCOUNT; i++) {
      b = bits[i];
      if (b.life > 0) {
        b.life -= dt;
        b.vy -= 5.5 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        b.rx += b.spin * dt;
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(b.rx, b.ry, b.rz);
        dummy.scale.setScalar(b.life > 0 ? 1 : 0);
      } else {
        dummy.position.set(0, -4, 0);
        dummy.scale.setScalar(0);
        dummy.rotation.set(0, 0, 0);
      }
      dummy.updateMatrix();
      confetti.setMatrixAt(i, dummy.matrix);
    }
    confetti.instanceMatrix.needsUpdate = true;
  }

  var shadowMatProto = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    toneMapped: false
  });
  var views = new Map();

  function makeShadow() {
    var m = new THREE.Mesh(new THREE.CircleGeometry(W.prizeR * 0.9, 18), shadowMatProto.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.016;
    m.renderOrder = 1;
    return m;
  }

  function clearViews() {
    views.forEach(function (v) {
      scene.remove(v.group);
      scene.remove(v.shadow);
    });
    views.clear();
  }

  function slotWorld(index, out) {
    var col = index % 4;
    var row = Math.min(1, Math.floor(index / 4));
    out.set(-0.24 + col * 0.16, 0.13, 0.12 - row * 0.07);
    drawer.updateMatrixWorld(true);
    return drawer.localToWorld(out);
  }

  function addMini(kind, color) {
    if (prizeSlots >= 8) {
      prizeSlots++;
      return;
    }
    var m = buildToy(kind, color);
    var i = prizeSlots++;
    var col = i % 4;
    var row = Math.min(1, Math.floor(i / 4));
    m.scale.multiplyScalar(0.5);
    m.position.set(-0.24 + col * 0.16, 0.13, 0.12 - row * 0.07);
    m.rotation.y = i * 0.6;
    m.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
    drawer.add(m);
  }

  function syncPrizes(dt) {
    if (state.generation !== seenGen) {
      seenGen = state.generation;
      clearViews();
    }
    var i, p, v, lift, sc, f, k, end;
    for (i = 0; i < state.prizes.length; i++) {
      p = state.prizes[i];
      v = views.get(p.id);
      if (!v) {
        v = {
          group: buildToy(p.kind, p.color),
          shadow: makeShadow(),
          flying: null,
          done: false
        };
        v.base = v.group.scale.x;
        v.group.rotation.y = p.yaw;
        scene.add(v.group);
        scene.add(v.shadow);
        views.set(p.id, v);
      }
      if (!p.alive) {
        if (!v.flying && !v.done) {
          v.shadow.visible = false;
          v.flying = { t: 0, from: v.group.position.clone(), kind: p.kind, color: p.color };
        }
        if (v.flying && !v.done) {
          f = v.flying;
          f.t += dt;
          k = Math.min(1, Math.max(0, f.t / 0.72));
          var slide = Math.min(1, k * 1.35);
          v.group.position.set(
            f.from.x + (W.chute.x - f.from.x) * slide,
            f.from.y + (-0.95 - f.from.y) * k,
            f.from.z + (W.chute.z - f.from.z) * slide
          );
          v.group.scale.setScalar(v.base * (1 - 0.28 * k));
          v.group.rotation.y += dt * 2.2;
          if (k >= 1) {
            v.done = true;
            v.group.visible = false;
          }
        }
        continue;
      }
      v.group.visible = true;
      v.group.position.set(p.x, p.y, p.z);
      if (!p.held) v.group.rotation.y += dt * (p.sleep ? 0.28 : 1.4);
      if (!p.held && !p.sleep) {
        v.group.rotation.z = Math.max(-0.5, Math.min(0.5, -p.vx * 0.35));
        v.group.rotation.x = Math.max(-0.5, Math.min(0.5, p.vz * 0.35));
      } else if (!p.held) {
        v.group.rotation.z *= 0.9;
        v.group.rotation.x *= 0.9;
      } else {
        v.group.rotation.z = 0;
        v.group.rotation.x = 0;
      }
      v.shadow.visible = true;
      v.shadow.position.x = p.x;
      v.shadow.position.z = p.z;
      lift = Math.max(0, p.y - p.r);
      sc = 1 / (1 + lift * 1.5);
      v.shadow.scale.setScalar(sc);
      v.shadow.material.opacity = 0.4 * sc;
    }
  }

  /* shell=1 is the lesson shell. Capsules replace the toy mix.
     The pile is the session the shell saved. Standalone play is unchanged. */
  function readShellCatalog() {
    var q = new URLSearchParams(window.location.search);
    if (q.get('shell') !== '1') return null;
    var colors = { k: 0xff4d88, '1': 0xffb020, '2': 0x3d8bff };
    var pile = [];
    try {
      var raw = window.localStorage.getItem('red-words-shell.session');
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.pile && data.pile.length) pile = data.pile;
      }
    } catch (err) {
      pile = [];
    }
    var list = [];
    var i, item, grade, color;
    for (i = 0; i < pile.length; i++) {
      item = pile[i] || {};
      grade = String(item.grade || 'k');
      color = typeof item.color === 'number' ? (item.color >>> 0) : (colors[grade] || colors.k);
      list.push({
        kind: 'capsule',
        color: color,
        wordId: item.id || '',
        grade: grade
      });
    }
    if (!list.length) {
      if (data && data.exhausted) return [];
      var cycle = ['k', '1', '2'];
      for (i = 0; i < 8; i++) {
        grade = cycle[i % 3];
        list.push({ kind: 'capsule', color: colors[grade], wordId: '', grade: grade });
      }
    }
    return list;
  }

  var shellOn = false;
  var shellSent = false;
  var shellList = readShellCatalog();
  var shellQuiet = Array.isArray(shellList) && !shellList.length;
  shellOn = !!shellList;
  var state = ClawPhysics.createState(shellList && shellList.length ? { catalog: shellList } : undefined);
  if (shellQuiet) {
    shellOn = true;
    state.prizes = [];
    state.pendingSpawns = 0;
    state.spawned = true;
  }

  function poseClaw() {
    var headP = ClawPhysics.headPoint(state);
    var bite = ClawPhysics.bitePoint(state);
    claw.position.set(headP.x, headP.y, headP.z);
    scratch.set(state.trolley.x - headP.x, W.railY - headP.y, state.trolley.z - headP.z);
    if (scratch.lengthSq() > 1e-6) {
      scratch.normalize();
      claw.quaternion.setFromUnitVectors(UP, scratch);
    }
    var length = Math.hypot(state.trolley.x - headP.x, W.railY - headP.y, state.trolley.z - headP.z);
    rope.scale.y = Math.max(0.05, length);
    rope.position.set(
      (state.trolley.x + headP.x) / 2,
      (W.railY + headP.y) / 2,
      (state.trolley.z + headP.z) / 2
    );
    rope.quaternion.copy(claw.quaternion);
    var open = 0.4 - state.jaws * 1.12;
    for (hi = 0; hi < hinges.length; hi++) hinges[hi].rotation.x = open;
    beam.position.x = state.trolley.x;
    beam.position.z = (W.trolleyLim.z0 + W.trolleyLim.z1) / 2;
    carriage.position.set(state.trolley.x, W.railY + 0.01, state.trolley.z);
    reticle.position.x = bite.x;
    reticle.position.z = bite.z;
    var aim = state.aim;
    reticle.material.color.set(aim === 'ready' ? 0x39e07a : aim === 'close' ? 0xffcf5a : 0xffffff);
    reticle.material.opacity = aim === 'off' ? 0.55 : 0.95;
    var pulse = reduced ? 1 : 1 + Math.sin(time * 5) * (aim === 'ready' ? 0.08 : 0.03);
    reticle.scale.setScalar(pulse);
  }

  var audio = { ctx: null, bus: null, noise: null };
  function ac() {
    if (!soundOn) return null;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audio.ctx) audio.ctx = new AC();
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    if (!audio.bus) {
      audio.bus = audio.ctx.createGain();
      audio.bus.gain.value = 0.09;
      audio.bus.connect(audio.ctx.destination);
    }
    return audio.ctx;
  }
  function tone(freq, dur, type, peak, slide) {
    var ctx = ac();
    if (!ctx) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(audio.bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function chord(freqs) {
    var i;
    for (i = 0; i < freqs.length; i++) tone(freqs[i], 0.18, 'sine', 0.35);
  }
  function knockNoise() {
    var ctx = ac();
    if (!ctx) return;
    if (!audio.noise) {
      var len = Math.floor(ctx.sampleRate * 0.07);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      var i;
      for (i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      audio.noise = buf;
    }
    var src = ctx.createBufferSource();
    src.buffer = audio.noise;
    var g = ctx.createGain();
    var t = ctx.currentTime;
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    src.connect(f);
    f.connect(g);
    g.connect(audio.bus);
    src.start(t);
  }

  function onEvent(ev) {
    var b = ClawPhysics.bitePoint(state);
    if (ev.type === 'down') {
      tone(520, 0.22, 'sine', 0.28, 170);
      if (!reduced) shake = Math.max(shake, 0.025);
    } else if (ev.type === 'home') {
      tone(392, 0.1, 'sine', 0.22);
      setTimeout(function () { tone(523, 0.16, 'sine', 0.2); }, 110);
    } else if (ev.type === 'grab') {
      tone(523, 0.12, 'triangle', 0.4);
      setTimeout(function () { tone(659, 0.12, 'triangle', 0.35); }, 90);
      setTimeout(function () { tone(784, 0.16, 'triangle', 0.32); }, 180);
      burst(b.x, b.y, b.z, 12, 0.9, 1.6);
      shake = Math.max(shake, reduced ? 0 : 0.05);
    } else if (ev.type === 'slip') {
      tone(320, 0.12, 'triangle', 0.3, 180);
      burst(b.x, b.y + 0.05, b.z, 8, 0.7, 1.1);
      shake = Math.max(shake, reduced ? 0 : 0.06);
    } else if (ev.type === 'miss') {
      tone(196, 0.14, 'sine', 0.22);
    } else if (ev.type === 'knock') {
      knockNoise();
      shake = Math.max(shake, reduced ? 0 : 0.035);
    } else if (ev.type === 'win') {
      tone(523, 0.14, 'triangle', 0.4);
      setTimeout(function () { tone(659, 0.14, 'triangle', 0.38); }, 110);
      setTimeout(function () { tone(784, 0.14, 'triangle', 0.36); }, 210);
      setTimeout(function () { tone(1046, 0.28, 'triangle', 0.34); }, 320);
      burst(W.chute.x, 0.35, W.chute.z, 26, 1.5, 2.6);
      shake = reduced ? 0 : 0.12;
      punch = reduced ? 0 : 1;
      drawerTarget = 0;
      drawerHold = 0;
      if (shellOn && !shellSent && window.parent && window.parent !== window) {
        shellSent = true;
        state.pendingSpawns = 0;
        var wonId = ev.wordId || '';
        window.setTimeout(function () {
          try {
            window.parent.postMessage({
              source: 'lesson-shell',
              step: 'claw',
              done: true,
              wordId: wonId
            }, window.location.origin);
          } catch (err) { /* the shell is gone */ }
        }, 900);
      }
    } else if (ev.type === 'release') {
      tone(280, 0.12, 'sine', 0.2, 160);
    }
  }

  var pad = { ax: 0, az: 0 };
  var keys = {};
  function setStick(ax, az) {
    pad.ax = ax;
    pad.az = az;
    var max = 40;
    stickEl.style.transform = 'translate(' + (ax * max) + 'px,' + (az * max) + 'px)';
  }
  function pointerStick(el, e) {
    var r = el.getBoundingClientRect();
    var dx = e.clientX - (r.left + r.width / 2);
    var dy = e.clientY - (r.top + r.height / 2);
    var limit = el === joy ? r.width * 0.36 : 78;
    var mag = Math.hypot(dx, dy);
    if (mag > limit && mag > 0) {
      dx = dx / mag * limit;
      dy = dy / mag * limit;
    }
    setStick(dx / limit, dy / limit);
  }

  joy.addEventListener('pointerdown', function (e) {
    joy.setPointerCapture(e.pointerId);
    pointerStick(joy, e);
    ac();
    e.preventDefault();
  });
  joy.addEventListener('pointermove', function (e) {
    if (joy.hasPointerCapture(e.pointerId)) pointerStick(joy, e);
  });
  function joyEnd(e) {
    if (joy.hasPointerCapture(e.pointerId)) joy.releasePointerCapture(e.pointerId);
    setStick(0, 0);
  }
  joy.addEventListener('pointerup', joyEnd);
  joy.addEventListener('pointercancel', joyEnd);

  var drag = null;
  canvas.addEventListener('pointerdown', function (e) {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    ac();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x;
    var dy = e.clientY - drag.y;
    var limit = 80;
    var mag = Math.hypot(dx, dy);
    if (mag > limit && mag > 0) {
      dx = dx / mag * limit;
      dy = dy / mag * limit;
    }
    setStick(mag ? dx / limit : 0, mag ? dy / limit : 0);
  });
  function dragEnd(e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    setStick(0, 0);
  }
  canvas.addEventListener('pointerup', dragEnd);
  canvas.addEventListener('pointercancel', dragEnd);

  window.addEventListener('keydown', function (e) {
    keys[e.key.toLowerCase()] = true;
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      queueDrop();
    }
  });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });

  function queueDrop() {
    dropQueued = true;
    ac();
  }
  dropBtn.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropBtn.classList.add('down');
    queueDrop();
  });
  window.addEventListener('pointerup', function () { dropBtn.classList.remove('down'); });

  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduced = !!motionQuery.matches;
  document.body.classList.toggle('calm', reduced);
  if (motionQuery.addEventListener) {
    motionQuery.addEventListener('change', function () {
      reduced = !!motionQuery.matches;
      document.body.classList.toggle('calm', reduced);
    });
  }

  function sample() {
    var ax = pad.ax;
    var az = pad.az;
    if (keys.arrowleft || keys.a) ax -= 1;
    if (keys.arrowright || keys.d) ax += 1;
    if (keys.arrowup || keys.w) az -= 1;
    if (keys.arrowdown || keys.s) az += 1;
    if (ax < -1) ax = -1;
    if (ax > 1) ax = 1;
    if (az < -1) az = -1;
    if (az > 1) az = 1;
    var drop = dropQueued;
    dropQueued = false;
    return { ax: ax, az: az, drop: drop, reduced: reduced };
  }

  function updateHud() {
    hintEl.textContent = state.hint;
    var label = 'DROP';
    if (state.phase === 'celebrate') label = 'YAY';
    else if (state.phase !== 'idle') label = '···';
    dropBtn.textContent = label;
    var busy = state.phase === 'drop' || state.phase === 'close' || state.phase === 'rise' || state.phase === 'home' || state.phase === 'celebrate';
    dropBtn.disabled = busy;
    dropBtn.classList.toggle('ready', state.aim === 'ready' && !busy);
  }

  function frameCamera(aspect) {
    if (aspect < 0.9) {
      baseFov = 42;
      baseDesired.set(0, 1.95, 4.7);
      baseLook.set(0, 0.55, 0.05);
    } else if (aspect > 1.5) {
      baseFov = 32;
      baseDesired.set(0.2, 1.7, 4.15);
      baseLook.set(0, 0.55, 0.04);
    } else {
      baseFov = 36;
      baseDesired.set(0.05, 1.78, 4.35);
      baseLook.set(0, 0.55, 0.06);
    }
    camera.fov = baseFov;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    if (!camReady) {
      camPos.copy(baseDesired);
      look.copy(baseLook);
      camReady = true;
    }
  }

  function resize() {
    var w = canvas.clientWidth || window.innerWidth;
    var h = canvas.clientHeight || window.innerHeight;
    if (w < 2 || h < 2) return;
    renderer.setSize(w, h, false);
    frameCamera(w / h);
  }
  window.addEventListener('resize', resize);
  resize();

  function updateCamera(dt) {
    var follow = reduced ? 0.04 : 0.1;
    desired.copy(baseDesired);
    desired.x += state.trolley.x * follow;
    look.copy(baseLook);
    look.x += state.trolley.x * follow;
    if (!reduced && shake > 0.001) {
      desired.x += Math.sin(time * 46) * shake;
      desired.y += Math.cos(time * 38) * shake * 0.55;
      shake *= Math.exp(-3.4 * dt);
    } else {
      shake = 0;
    }
    var k = 1 - Math.exp(-3.4 * dt);
    camPos.lerp(desired, k);
    camera.position.copy(camPos);
    camera.lookAt(look);
    if (!reduced && punch > 0.01) {
      camera.fov = baseFov - punch * 3.2;
      punch *= Math.exp(-2.6 * dt);
    } else {
      camera.fov = baseFov;
      punch = 0;
    }
    camera.updateProjectionMatrix();
  }

  var acc = 0;
  var last = performance.now();
  var debugEl = null;
  if (location.search.indexOf('debug') !== -1) {
    debugEl = document.createElement('pre');
    debugEl.style.cssText = 'position:absolute;left:12px;bottom:160px;margin:0;padding:8px;background:rgba(255,246,234,.9);font:12px monospace;z-index:3;pointer-events:none';
    document.getElementById('stage').appendChild(debugEl);
  }

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    acc += dt;
    var input = sample();
    if (input.drop) acc = Math.max(acc, 1 / 60);
    var guard = 0;
    while (acc >= 1 / 60 && guard++ < 5) {
      ClawPhysics.step(state, 1 / 60, input);
      input.drop = false;
      var ei;
      for (ei = 0; ei < state.events.length; ei++) onEvent(state.events[ei]);
      acc -= 1 / 60;
    }
    if (guard >= 5) acc = 0;
    syncPrizes(dt);
    poseClaw();
    if (drawerHold > 0) {
      drawerHold -= dt;
      if (drawerHold <= 0) drawerTarget = state.wins > 0 ? 0.85 : 0;
    }
    drawerShown += (drawerTarget - drawerShown) * (1 - Math.exp(-7 * dt));
    drawer.position.z = drawerHomeZ + drawerShown * 0.52;
    var glow = 0.7 + (reduced ? 0 : Math.sin(time * 3) * 0.25);
    if (state.phase === 'home') glow = 1.2 + (reduced ? 0 : Math.sin(time * 6) * 0.28);
    chuteRing.material.emissiveIntensity = glow;
    holeStar.rotation.z += reduced ? 0 : dt * 0.8;
    var b;
    for (b = 0; b < bulbs.length; b++) {
      bulbs[b].material.emissiveIntensity = reduced ? 0.55 : 0.45 + Math.sin(time * 2.2 + b) * 0.35;
    }
    updateBits(dt);
    updateHud();
    updateCamera(dt);
    if (debugEl) {
      var st = ClawPhysics.stability(state);
      debugEl.textContent = state.phase + ' ' + state.aim + ' tilt ' + st.tilt.toFixed(3) + ' speed ' + st.speed.toFixed(2);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.CLAW = {
    get state() { return state; },
    physics: ClawPhysics,
    drop: queueDrop,
    nudge: setStick,
    renderer: renderer,
    scene: scene
  };
})();
