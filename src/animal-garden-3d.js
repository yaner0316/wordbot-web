import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const COLOR = {
  grass: 0x8ccf68,
  grassDark: 0x4f9a54,
  hill: 0xb6df7c,
  pet: 0xffe7b8,
  petLight: 0xfff4d6,
  petShadow: 0xd6ad63,
  dragonOrange: 0xf79a35,
  dragonLight: 0xffbd63,
  dragonCream: 0xffe4ad,
  eye: 0x463522,
  cheek: 0xf2a3a0,
  flowerPink: 0xf38eaf,
  flowerYellow: 0xffdf67,
  bowl: 0xd77b45,
  feed: 0xf1b84b,
  blue: 0x5d7fe5,
  blueDark: 0x344da5,
  berry: 0xc9495a,
  gold: 0xf7c84d,
  straw: 0xe4c56d,
  leaf: 0x5fad66,
  visitorBlue: 0xaad8f0,
  visitorCream: 0xf8d8a8,
  visitorViolet: 0xc8b4ec,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalizeGardenOutfit(outfit) {
  return ({ '红围巾': '莓果领结', '星星背包': '星星挎包' }[outfit] || outfit || '草帽');
}

function makeMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.02,
    flatShading: options.flatShading ?? false,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
  });
}

function makeMesh(geometry, color, options = {}) {
  const mesh = new THREE.Mesh(geometry, makeMaterial(color, options));
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? false;
  return mesh;
}

function createOval(radius, color, scale = [1, 1, 1], segments = 24, options = {}) {
  const mesh = makeMesh(new THREE.SphereGeometry(radius, segments, Math.max(12, segments / 2)), color, options);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  return mesh;
}

function createCheek(side) {
  const cheek = createOval(0.068, COLOR.cheek, [1.55, 0.72, 0.2], 14, { flatShading: false });
  cheek.name = side < 0 ? 'dragon-cheek-left' : 'dragon-cheek-right';
  return cheek;
}

function createDragonHorn(side) {
  const horn = new THREE.Group();
  horn.name = side < 0 ? 'dragon-horn-left' : 'dragon-horn-right';
  const base = makeMesh(new THREE.ConeGeometry(0.075, 0.24, 8), 0xffdf8a, { flatShading: false });
  base.position.set(0.28 + side * 0.22, 0.9, 0.18);
  base.rotation.set(0.22, side * -0.12, side * -0.22);
  const tip = makeMesh(new THREE.SphereGeometry(0.048, 12, 8), COLOR.gold, { metalness: 0.06, roughness: 0.44, flatShading: false });
  tip.scale.set(0.9, 0.75, 0.9);
  tip.position.set(0.28 + side * 0.25, 1.04, 0.21);
  horn.add(base, tip);
  return horn;
}

function createDragonWing(side) {
  const wing = new THREE.Group();
  wing.name = side < 0 ? 'dragon-wing-left' : 'dragon-wing-right';
  const membrane = makeMesh(new THREE.ConeGeometry(0.34, 0.5, 4), 0xffb24d, { side: THREE.DoubleSide, flatShading: false });
  membrane.name = side < 0 ? 'dragon-wing-membrane-left' : 'dragon-wing-membrane-right';
  membrane.scale.set(0.92, 1.1, 0.18);
  membrane.position.set(side * 0.58, 0.18, -0.12);
  membrane.rotation.set(0.35, side * 0.66, side * -0.78);
  const rib = makeMesh(new THREE.CylinderGeometry(0.018, 0.024, 0.46, 10), 0xde7835, { flatShading: false });
  rib.position.set(side * 0.5, 0.18, 0.0);
  rib.rotation.set(0.52, side * 0.54, side * -0.68);
  const tip = createOval(0.045, 0xffc56a, [1.15, 0.7, 0.55], 10, { flatShading: false });
  tip.position.set(side * 0.76, 0.38, -0.16);
  wing.add(membrane, rib, tip);
  return wing;
}

function createDragonTail() {
  const tail = new THREE.Group();
  tail.name = 'dragon-tail';
  const segments = [
    { x: -0.52, y: -0.24, z: -0.18, r: 0.19, s: [1.38, 0.62, 0.72], rot: 0.24 },
    { x: -0.82, y: -0.21, z: -0.24, r: 0.145, s: [1.28, 0.56, 0.62], rot: 0.36 },
    { x: -1.06, y: -0.13, z: -0.22, r: 0.105, s: [1.18, 0.48, 0.54], rot: 0.52 },
  ];
  segments.forEach((segment, index) => {
    const piece = createOval(segment.r, index ? COLOR.dragonLight : COLOR.dragonOrange, segment.s, 16, { flatShading: false });
    piece.name = `dragon-tail-segment-${index + 1}`;
    piece.position.set(segment.x, segment.y, segment.z);
    piece.rotation.z = segment.rot;
    tail.add(piece);
  });
  const tip = makeMesh(new THREE.ConeGeometry(0.095, 0.17, 8), 0xffa13f, { flatShading: false });
  tip.name = 'dragon-tail-heart-tip';
  tip.position.set(-1.18, -0.07, -0.2);
  tip.rotation.set(0, 0, -0.92);
  tail.add(tip);
  return tail;
}

function createDragonSpikes() {
  const spikes = new THREE.Group();
  spikes.name = 'dragon-spine-crest';
  [
    { x: 0.24, y: 0.82, z: -0.27, s: 0.075 },
    { x: 0.1, y: 0.58, z: -0.36, s: 0.085 },
    { x: -0.04, y: 0.34, z: -0.43, s: 0.078 },
    { x: -0.22, y: 0.08, z: -0.47, s: 0.068 },
  ].forEach((item, index) => {
    const spike = makeMesh(new THREE.ConeGeometry(item.s, item.s * 1.8, 6), 0xffc04f, { flatShading: false });
    spike.name = `dragon-spine-spike-${index + 1}`;
    spike.position.set(item.x, item.y, item.z);
    spike.rotation.x = -0.58;
    spikes.add(spike);
  });
  return spikes;
}

function createDragonClaw(side, front = true) {
  const claw = createOval(front ? 0.11 : 0.13, 0xffc36a, front ? [1.18, 0.62, 0.72] : [1.28, 0.62, 0.78], 12, { flatShading: false });
  claw.name = front
    ? (side < 0 ? 'dragon-fore-claw-left' : 'dragon-fore-claw-right')
    : (side < 0 ? 'dragon-back-claw-left' : 'dragon-back-claw-right');
  claw.position.set(side * (front ? 0.34 : 0.48), front ? -0.21 : -0.43, front ? 0.56 : 0.08);
  claw.rotation.z = side * (front ? -0.2 : -0.1);
  const nail = makeMesh(new THREE.ConeGeometry(0.028, 0.07, 6), 0x7c4a2e, { flatShading: false });
  nail.position.set(side * 0.035, -0.005, 0.075);
  nail.rotation.x = Math.PI / 2;
  claw.add(nail);
  return claw;
}

function createDragonMouth() {
  const mouth = new THREE.Group();
  mouth.name = 'dragon-mouth';
  const open = createOval(0.128, 0x7c3829, [1.18, 0.84, 0.35], 18, { side: THREE.DoubleSide, flatShading: false });
  open.name = 'dragon-open-mouth';
  open.position.set(0.41, 0.22, 0.82);
  const tongue = createOval(0.06, 0xf28b84, [1.45, 0.58, 0.28], 12, { flatShading: false });
  tongue.name = 'dragon-mouth-tongue';
  tongue.position.set(0.41, 0.16, 0.88);
  const toothLeft = makeMesh(new THREE.ConeGeometry(0.026, 0.075, 5), 0xfff4df, { flatShading: false });
  toothLeft.name = 'dragon-tooth-left';
  toothLeft.position.set(0.34, 0.28, 0.89);
  toothLeft.rotation.x = Math.PI;
  const toothRight = toothLeft.clone();
  toothRight.name = 'dragon-tooth-right';
  toothRight.position.x = 0.48;
  mouth.add(open, tongue, toothLeft, toothRight);
  return mouth;
}

function createGardenDragon(garden = {}) {
  const dragon = new THREE.Group();
  dragon.name = 'garden-dragon-3d';

  const body = createOval(0.62, COLOR.dragonOrange, [1.16, 0.88, 0.78], 32, { flatShading: false });
  body.name = 'dragon-rounded-body';
  body.position.set(-0.04, -0.04, 0.04);
  body.rotation.z = -0.06;

  const belly = createOval(0.36, COLOR.dragonCream, [1.06, 1.34, 0.2], 24, { flatShading: false });
  belly.name = 'dragon-belly-panel';
  belly.position.set(0.05, -0.1, 0.64);
  belly.rotation.z = -0.04;

  const head = createOval(0.48, COLOR.dragonLight, [1.2, 0.9, 0.88], 34, { flatShading: false });
  head.name = 'dragon-big-head';
  head.position.set(0.28, 0.52, 0.18);
  head.rotation.z = -0.06;

  const snout = createOval(0.2, COLOR.dragonCream, [1.95, 0.8, 0.6], 20, { flatShading: false });
  snout.name = 'dragon-soft-snout';
  snout.position.set(0.39, 0.34, 0.66);

  const noseLeft = createOval(0.023, 0x7b4727, [1, 0.8, 0.35], 8, { flatShading: false });
  noseLeft.name = 'dragon-nostril-left';
  noseLeft.position.set(0.31, 0.4, 0.84);
  const noseRight = noseLeft.clone();
  noseRight.name = 'dragon-nostril-right';
  noseRight.position.x = 0.47;

  const eyeLeft = createOval(0.075, 0x4a1f16, [0.88, 1.22, 0.34], 16, { flatShading: false });
  eyeLeft.name = 'dragon-eye-left';
  eyeLeft.position.set(0.07, 0.62, 0.56);
  const eyeRight = eyeLeft.clone();
  eyeRight.name = 'dragon-eye-right';
  eyeRight.position.x = 0.46;

  const sparkle = createOval(0.02, 0xffffff, [1, 1, 0.2], 8, { flatShading: false });
  sparkle.name = 'dragon-eye-spark-left';
  sparkle.position.set(0.095, 0.65, 0.59);
  const sparkleRight = sparkle.clone();
  sparkleRight.name = 'dragon-eye-spark-right';
  sparkleRight.position.x = 0.485;

  const cheekLeft = createCheek(-1);
  cheekLeft.position.set(0.02, 0.31, 0.66);
  const cheekRight = createCheek(1);
  cheekRight.position.set(0.58, 0.31, 0.66);

  dragon.add(
    createDragonTail(),
    createDragonWing(-1),
    createDragonWing(1),
    body,
    belly,
    createDragonSpikes(),
    head,
    snout,
    createDragonHorn(-1),
    createDragonHorn(1),
    eyeLeft,
    eyeRight,
    sparkle,
    sparkleRight,
    noseLeft,
    noseRight,
    createDragonMouth(),
    cheekLeft,
    cheekRight,
    createDragonClaw(-1, true),
    createDragonClaw(1, true),
    createDragonClaw(-1, false),
    createDragonClaw(1, false),
  );
  dragon.add(createGardenOutfit(normalizeGardenOutfit(garden.outfit)));
  dragon.scale.setScalar(0.92);
  dragon.position.set(-0.08, 0.78, 0.28);
  dragon.userData.baseY = dragon.position.y;
  dragon.userData.spinSeed = (garden.hearts || 0) * 0.03;
  return dragon;
}
function createGardenPet(garden = {}) {
  return createGardenDragon(garden);
}

function createGardenOutfit(outfit = '草帽') {
  const group = new THREE.Group();
  group.name = 'garden-outfit-3d';
  switch (normalizeGardenOutfit(outfit)) {
    case '莓果领结': {
      const knot = createOval(0.062, COLOR.berry, [1.08, 0.9, 0.38], 12, { flatShading: false });
      knot.position.set(0.22, -0.02, 0.74);
      const left = makeMesh(new THREE.ConeGeometry(0.12, 0.15, 5), COLOR.berry, { flatShading: false });
      left.position.set(0.1, -0.03, 0.72);
      left.rotation.set(0, 0, Math.PI / 4);
      const right = left.clone();
      right.position.x = 0.34;
      right.rotation.z = -Math.PI / 4;
      group.add(left, right, knot);
      break;
    }
    case '星星挎包': {
      const strap = makeMesh(new THREE.TorusGeometry(0.31, 0.011, 8, 36, Math.PI * 0.72), 0x3d58a7, { flatShading: false });
      strap.name = 'dragon-side-satchel-strap';
      strap.position.set(0.42, -0.03, 0.46);
      strap.rotation.set(0.08, -0.7, -0.78);
      const bag = makeMesh(new THREE.BoxGeometry(0.23, 0.2, 0.1), COLOR.blue, { flatShading: false });
      bag.name = 'dragon-side-star-satchel';
      bag.position.set(0.72, -0.24, 0.38);
      bag.rotation.set(0.04, -0.2, -0.04);
      const flap = makeMesh(new THREE.BoxGeometry(0.19, 0.07, 0.105), 0x6f91f4, { flatShading: false });
      flap.position.set(0.72, -0.17, 0.44);
      flap.rotation.copy(bag.rotation);
      const ribbon = makeMesh(new THREE.CylinderGeometry(0.011, 0.011, 0.25, 8), COLOR.gold, { flatShading: false });
      ribbon.position.set(0.72, -0.24, 0.455);
      ribbon.rotation.z = Math.PI / 2;
      const star = makeMesh(new THREE.ConeGeometry(0.05, 0.025, 5), COLOR.gold, { metalness: 0.08, roughness: 0.42, flatShading: false });
      star.name = 'satchel-star-badge';
      star.position.set(0.72, -0.27, 0.455);
      star.rotation.set(Math.PI / 2, 0, Math.PI / 5);
      group.add(strap, bag, flap, ribbon, star);
      break;
    }
    case '探险铃': {
      const collar = makeMesh(new THREE.TorusGeometry(0.25, 0.018, 8, 36, Math.PI), COLOR.leaf, { flatShading: false });
      collar.position.set(0.22, 0.04, 0.73);
      collar.rotation.set(Math.PI / 2, 0, 0);
      const bell = makeMesh(new THREE.SphereGeometry(0.062, 16, 10), COLOR.gold, { metalness: 0.08, roughness: 0.48, flatShading: false });
      bell.scale.set(1, 0.9, 0.82);
      bell.position.set(0.22, -0.08, 0.78);
      const slit = makeMesh(new THREE.BoxGeometry(0.07, 0.008, 0.008), 0x8f651d, { flatShading: false });
      slit.position.set(0.22, -0.09, 0.84);
      group.add(collar, bell, slit);
      break;
    }
    case '草帽':
    default: {
      const brim = makeMesh(new THREE.CylinderGeometry(0.36, 0.42, 0.045, 32), COLOR.straw, { flatShading: false });
      brim.position.set(0.28, 0.95, 0.14);
      brim.rotation.z = -0.04;
      const crown = makeMesh(new THREE.CylinderGeometry(0.19, 0.27, 0.17, 24), 0xf2d98a, { flatShading: false });
      crown.position.set(0.28, 1.04, 0.14);
      crown.rotation.z = -0.04;
      const ribbon = makeMesh(new THREE.TorusGeometry(0.235, 0.014, 8, 32), 0x8ab16d, { flatShading: false });
      ribbon.position.set(0.28, 0.98, 0.14);
      ribbon.rotation.set(Math.PI / 2, 0, -0.04);
      group.add(brim, crown, ribbon);
      break;
    }
  }
  return group;
}
function createGardenFoodBowl(garden = {}) {
  const group = new THREE.Group();
  group.name = 'garden-food-bowl-3d';
  const base = makeMesh(new THREE.CylinderGeometry(0.32, 0.24, 0.18, 28), COLOR.bowl);
  base.scale.z = 0.72;
  base.position.set(0, 0.09, 0);
  const rim = makeMesh(new THREE.TorusGeometry(0.31, 0.035, 8, 32), 0xf3b06c);
  rim.position.set(0, 0.2, 0);
  rim.rotation.x = Math.PI / 2;
  group.add(base, rim);

  const pelletCount = clamp(Math.ceil((garden.feed || 0) / 4), 1, 6);
  for (let i = 0; i < pelletCount; i += 1) {
    const pellet = createOval(0.045, COLOR.feed, [1.2, 0.85, 1.0], 10);
    const angle = i * 1.42;
    pellet.position.set(Math.cos(angle) * 0.12, 0.24 + (i % 2) * 0.018, Math.sin(angle) * 0.07);
    group.add(pellet);
  }
  group.position.set(-1.55, 0.08, 0.55);
  return group;
}

function createFlowerStem(height, flowerColor) {
  const group = new THREE.Group();
  const stem = makeMesh(new THREE.CylinderGeometry(0.018, 0.026, height, 8), COLOR.grassDark);
  stem.position.y = height / 2;
  const leaf = createOval(0.06, 0x73bd61, [1.35, 0.4, 0.18], 10);
  leaf.position.set(0.055, height * 0.42, 0);
  leaf.rotation.z = -0.5;
  const center = createOval(0.045, COLOR.flowerYellow, [1, 1, 0.5], 10);
  center.position.y = height + 0.035;
  for (let i = 0; i < 5; i += 1) {
    const petal = createOval(0.045, flowerColor, [0.7, 1.05, 0.3], 10);
    const angle = i / 5 * Math.PI * 2;
    petal.position.set(Math.cos(angle) * 0.06, height + 0.035 + Math.sin(angle) * 0.06, 0.012);
    petal.rotation.z = angle;
    group.add(petal);
  }
  group.add(stem, leaf, center);
  return group;
}

function createGardenPlants(garden = {}) {
  const group = new THREE.Group();
  group.name = 'garden-plants-3d';
  const flowerCount = clamp(Math.floor((garden.hearts || 0) / 4) + 2, 2, 7);
  for (let i = 0; i < flowerCount; i += 1) {
    const flower = createFlowerStem(0.22 + (i % 3) * 0.05, i % 2 ? 0xffa0bd : COLOR.flowerPink);
    flower.position.set(-0.22 + i * 0.095, 0, (i % 2) * 0.08);
    flower.rotation.y = -0.2 + i * 0.08;
    group.add(flower);
  }
  const bush = createOval(0.22, 0x72bc62, [1.7, 0.6, 1.0], 14);
  bush.position.set(0.04, 0.08, -0.05);
  group.add(bush);
  group.position.set(1.35, 0.06, 0.45);
  return group;
}

function createVisitorBody(color, accent, ears = 'round') {
  const group = new THREE.Group();
  const body = createOval(0.23, color, [1, 0.9, 0.78], 16);
  body.position.y = 0.18;
  const head = createOval(0.2, color, [1, 0.95, 0.8], 16);
  head.position.set(0, 0.43, 0.02);
  const belly = createOval(0.11, accent, [1.25, 0.9, 0.25], 12);
  belly.position.set(0, 0.14, 0.18);
  const eyeL = createOval(0.025, COLOR.eye, [1, 1, 0.4], 8);
  eyeL.position.set(-0.07, 0.45, 0.21);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.07;
  group.add(body, head, belly, eyeL, eyeR);
  if (ears === 'long') {
    const l = createOval(0.08, color, [0.55, 1.3, 0.35], 10);
    l.position.set(-0.12, 0.61, 0.02);
    l.rotation.z = 0.2;
    const r = l.clone();
    r.position.x = 0.12;
    r.rotation.z = -0.2;
    group.add(l, r);
  } else if (ears === 'point') {
    const l = makeMesh(new THREE.ConeGeometry(0.08, 0.18, 4), color);
    l.position.set(-0.12, 0.61, 0.02);
    l.rotation.z = 0.58;
    const r = l.clone();
    r.position.x = 0.12;
    r.rotation.z = -0.58;
    group.add(l, r);
  } else {
    const l = createOval(0.075, color, [0.85, 1, 0.4], 10);
    l.position.set(-0.15, 0.55, 0.02);
    const r = l.clone();
    r.position.x = 0.15;
    group.add(l, r);
  }
  return group;
}

function createVisitorGroup(garden = {}) {
  const group = new THREE.Group();
  group.name = 'garden-visitors-3d';
  const count = clamp(Math.ceil((garden.visits || 0) / 4), 1, 5);
  const specs = [
    { color: COLOR.visitorCream, accent: 0xfff2d7, ears: 'long', x: -2.35, z: -0.32, s: 0.82 },
    { color: COLOR.visitorBlue, accent: 0xe9f8ff, ears: 'round', x: 2.35, z: -0.42, s: 0.78 },
    { color: COLOR.visitorViolet, accent: 0xf1eaff, ears: 'point', x: -1.92, z: -0.98, s: 0.62 },
    { color: 0xf5b989, accent: 0xffedda, ears: 'point', x: 1.9, z: -1.04, s: 0.62 },
    { color: 0xd7e6a5, accent: 0xf8ffd8, ears: 'round', x: 0, z: -1.26, s: 0.58 },
  ];
  specs.slice(0, count).forEach((spec, index) => {
    const visitor = createVisitorBody(spec.color, spec.accent, spec.ears);
    visitor.position.set(spec.x, 0.06, spec.z);
    visitor.scale.setScalar(spec.s);
    visitor.rotation.y = spec.x < 0 ? 0.38 : -0.38;
    visitor.userData.baseY = visitor.position.y;
    visitor.userData.idleOffset = index * 0.74;
    group.add(visitor);
  });
  return group;
}

function createWorld(garden = {}) {
  const world = new THREE.Group();
  const ground = makeMesh(new THREE.CylinderGeometry(2.85, 2.45, 0.18, 48), COLOR.grass, { receiveShadow: true, castShadow: false });
  ground.position.y = -0.02;
  ground.scale.z = 0.72;
  const hill = makeMesh(new THREE.SphereGeometry(1.8, 24, 12), COLOR.hill, { receiveShadow: true, castShadow: false });
  hill.scale.set(1.2, 0.16, 0.28);
  hill.position.set(0.3, 0.02, -1.55);
  const path = makeMesh(new THREE.CylinderGeometry(0.72, 0.52, 0.012, 32), 0xeecf95, { receiveShadow: true, castShadow: false });
  path.scale.z = 1.45;
  path.position.set(0, 0.08, 0.32);
  world.add(ground, hill, path, createGardenFoodBowl(garden), createGardenPlants(garden), createVisitorGroup(garden), createGardenDragon(garden));
  return world;
}

function createRewardDrops(garden = {}) {
  const action = garden.lastAction || 'idle';
  const group = new THREE.Group();
  group.name = 'garden-reward-drops-3d';
  if (action === 'idle') return group;
  const specs = action === 'care'
    ? [COLOR.gold, COLOR.gold, COLOR.gold].map((color, index) => ({ color, shape: 'star', index }))
    : action === 'collect'
      ? [0xf2994a, 0xdb6b5f, 0xffd166].map((color, index) => ({ color, shape: 'feed', index }))
      : [0xf7d15f, 0xff9bc1, 0x91d6ff].map((color, index) => ({ color, shape: 'spark', index }));

  specs.forEach((spec, i) => {
    let drop;
    if (spec.shape === 'star') {
      drop = makeMesh(new THREE.ConeGeometry(0.095, 0.045, 5), spec.color, { metalness: 0.08, roughness: 0.42 });
      drop.rotation.x = Math.PI / 2;
    } else if (spec.shape === 'feed') {
      drop = createOval(0.08, spec.color, [1.25, 0.86, 0.72], 12);
    } else {
      drop = makeMesh(new THREE.OctahedronGeometry(0.085, 0), spec.color, { metalness: 0.08, roughness: 0.44 });
    }
    drop.position.set((i - 1) * 0.32, 2.15 + i * 0.12, 0.36 - i * 0.04);
    drop.userData.velocity = new THREE.Vector3((i - 1) * 0.003, -0.018 - i * 0.003, 0.002);
    drop.userData.spin = 0.055 + i * 0.018;
    drop.userData.delay = i * 7;
    group.add(drop);
  });
  return group;
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
      else child.material.dispose();
    }
  });
}

function mountAnimalGarden3D(container, gardenState = {}) {
  if (!container) return null;
  if (container.__animalGarden3DCleanup) container.__animalGarden3DCleanup();
  container.textContent = '';

  const garden = { hearts: 0, feed: 0, visits: 0, outfit: '草帽', lastAction: 'idle', ...gardenState };
  const width = Math.max(container.clientWidth || 360, 280);
  const height = Math.max(container.clientHeight || 320, 260);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe9f8ff, 5.2, 9.5);

  const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
  camera.position.set(0, 2.05, 5.35);
  camera.lookAt(0, 0.62, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', '3D 动物花园');
  renderer.domElement.className = 'garden-3d-canvas';
  container.appendChild(renderer.domElement);

  const ambient = new THREE.HemisphereLight(0xffffff, 0xa2c77d, 1.8);
  const key = new THREE.DirectionalLight(0xffffff, 1.55);
  key.position.set(-2.8, 4.2, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.width = 1024;
  key.shadow.mapSize.height = 1024;
  const fill = new THREE.DirectionalLight(0xfff0d0, 0.75);
  fill.position.set(2.5, 2.2, 2.6);
  scene.add(ambient, key, fill);

  const world = createWorld(garden);
  const drops = createRewardDrops(garden);
  scene.add(world, drops);

  let frame = 0;
  let raf = 0;
  let disposed = false;
  const render = () => {
    if (disposed) return;
    frame += 1;
    const t = frame / 60;
    const pet = world.getObjectByName('garden-dragon-3d');
    if (pet) {
      pet.position.y = pet.userData.baseY + Math.sin(t * 2.2) * 0.035;
      pet.rotation.y = Math.sin(t * 1.25 + pet.userData.spinSeed) * 0.08;
      pet.rotation.z = Math.sin(t * 1.8) * 0.018;
    }
    const visitors = world.getObjectByName('garden-visitors-3d');
    if (visitors) {
      visitors.children.forEach((visitor) => {
        visitor.position.y = visitor.userData.baseY + Math.sin(t * 2 + visitor.userData.idleOffset) * 0.018;
      });
    }
    drops.children.forEach((drop) => {
      if (frame > drop.userData.delay) {
        drop.position.add(drop.userData.velocity);
        drop.rotation.x += drop.userData.spin;
        drop.rotation.y += drop.userData.spin * 0.8;
        if (drop.position.y < 0.55) drop.material.opacity = Math.max(0, drop.material.opacity - 0.025);
      }
    });
    world.rotation.y = Math.sin(t * 0.35) * 0.018;
    renderer.render(scene, camera);
    raf = window.requestAnimationFrame(render);
  };

  const resize = () => {
    const nextWidth = Math.max(container.clientWidth || width, 280);
    const nextHeight = Math.max(container.clientHeight || height, 260);
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight, false);
    renderer.render(scene, camera);
  };
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(container);
  resize();
  render();

  const cleanup = () => {
    disposed = true;
    window.cancelAnimationFrame(raf);
    if (observer) observer.disconnect();
    disposeObject(scene);
    renderer.dispose();
    renderer.forceContextLoss?.();
    if (renderer.domElement.parentNode === container) renderer.domElement.remove();
    if (container.__animalGarden3DCleanup === cleanup) delete container.__animalGarden3DCleanup;
  };
  container.__animalGarden3DCleanup = cleanup;
  window.__animalGarden3DLastRender = {
    action: garden.lastAction || 'idle',
    outfit: normalizeGardenOutfit(garden.outfit),
    hearts: garden.hearts || 0,
    feed: garden.feed || 0,
    visits: garden.visits || 0,
    objects: world.children.length + drops.children.length,
  };
  return cleanup;
}

window.mountAnimalGarden3D = mountAnimalGarden3D;
window.dispatchEvent(new CustomEvent('animal-garden-3d-ready'));

export {
  createGardenFoodBowl,
  createGardenOutfit,
  createGardenDragon,
  createGardenPet,
  createGardenPlants,
  createRewardDrops,
  createVisitorGroup,
  mountAnimalGarden3D,
};
