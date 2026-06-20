import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const COLOR = {
  grass: 0x8ccf68,
  grassDark: 0x4f9a54,
  hill: 0xb6df7c,
  pet: 0xffe7b8,
  petLight: 0xfff4d6,
  petShadow: 0xd6ad63,
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
    flatShading: options.flatShading ?? true,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

function makeMesh(geometry, color, options = {}) {
  const mesh = new THREE.Mesh(geometry, makeMaterial(color, options));
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? false;
  return mesh;
}

function createOval(radius, color, scale = [1, 1, 1], segments = 24) {
  const mesh = makeMesh(new THREE.SphereGeometry(radius, segments, Math.max(12, segments / 2)), color);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  return mesh;
}

function createEar(side) {
  const ear = new THREE.Group();
  const outer = createOval(0.26, COLOR.pet, [0.58, 1.35, 0.36], 18);
  outer.rotation.z = side * -0.22;
  outer.position.set(side * 0.33, 0.82, 0.02);
  const inner = createOval(0.18, 0xf7c7af, [0.48, 1.08, 0.16], 16);
  inner.rotation.z = outer.rotation.z;
  inner.position.set(side * 0.33, 0.82, 0.18);
  ear.add(outer, inner);
  return ear;
}

function createEye(side) {
  const eye = createOval(0.055, COLOR.eye, [1, 1.15, 0.45], 12);
  eye.position.set(side * 0.22, 0.18, 0.52);
  return eye;
}

function createCheek(side) {
  const cheek = createOval(0.06, COLOR.cheek, [1.6, 0.7, 0.22], 12);
  cheek.position.set(side * 0.34, 0.03, 0.51);
  return cheek;
}

function createGardenPet(garden = {}) {
  const pet = new THREE.Group();
  pet.name = 'garden-pet-3d';

  const body = createOval(0.62, COLOR.pet, [0.95, 1.02, 0.78], 28);
  body.position.y = 0.02;
  const belly = createOval(0.34, COLOR.petLight, [1.05, 0.9, 0.22], 20);
  belly.position.set(0, -0.17, 0.53);
  const head = createOval(0.48, COLOR.petLight, [1.03, 0.92, 0.86], 28);
  head.position.set(0, 0.46, 0.05);

  const muzzle = createOval(0.15, 0xfff8e4, [1.5, 0.85, 0.38], 16);
  muzzle.position.set(0, 0.09, 0.56);
  const nose = createOval(0.035, COLOR.eye, [1.25, 0.7, 0.4], 10);
  nose.position.set(0, 0.16, 0.66);

  const leftPaw = createOval(0.16, COLOR.petLight, [1.12, 0.68, 0.8], 16);
  leftPaw.position.set(-0.34, -0.48, 0.18);
  leftPaw.rotation.z = 0.2;
  const rightPaw = leftPaw.clone();
  rightPaw.position.x = 0.34;
  rightPaw.rotation.z = -0.2;

  pet.add(body, belly, head, createEar(-1), createEar(1), createEye(-1), createEye(1), createCheek(-1), createCheek(1), muzzle, nose, leftPaw, rightPaw);
  pet.add(createGardenOutfit(normalizeGardenOutfit(garden.outfit)));
  pet.position.set(0, 0.78, 0.15);
  pet.userData.baseY = pet.position.y;
  pet.userData.spinSeed = (garden.hearts || 0) * 0.03;
  return pet;
}

function createGardenOutfit(outfit = '草帽') {
  const group = new THREE.Group();
  group.name = 'garden-outfit-3d';
  switch (normalizeGardenOutfit(outfit)) {
    case '莓果领结': {
      const knot = createOval(0.075, COLOR.berry, [1.1, 0.9, 0.45], 12);
      knot.position.set(0, 0.0, 0.72);
      const left = makeMesh(new THREE.ConeGeometry(0.15, 0.18, 4), COLOR.berry);
      left.position.set(-0.14, -0.01, 0.7);
      left.rotation.set(0, 0, Math.PI / 4);
      const right = left.clone();
      right.position.x = 0.14;
      right.rotation.z = -Math.PI / 4;
      group.add(left, right, knot);
      break;
    }
    case '星星挎包': {
      const strap = makeMesh(new THREE.TorusGeometry(0.48, 0.018, 8, 36, Math.PI * 1.1), COLOR.blueDark);
      strap.position.set(-0.06, 0.08, 0.67);
      strap.rotation.set(0.25, 0.03, -0.75);
      const bag = makeMesh(new THREE.BoxGeometry(0.28, 0.24, 0.12), COLOR.blue);
      bag.position.set(0.43, -0.25, 0.53);
      bag.rotation.z = -0.08;
      const star = makeMesh(new THREE.ConeGeometry(0.065, 0.035, 5), COLOR.gold);
      star.position.set(0.43, -0.25, 0.61);
      star.rotation.set(Math.PI / 2, 0, Math.PI / 5);
      group.add(strap, bag, star);
      break;
    }
    case '探险铃': {
      const collar = makeMesh(new THREE.TorusGeometry(0.31, 0.025, 8, 36, Math.PI), COLOR.leaf);
      collar.position.set(0, -0.03, 0.67);
      collar.rotation.set(Math.PI / 2, 0, 0);
      const bell = makeMesh(new THREE.SphereGeometry(0.075, 14, 10), COLOR.gold, { metalness: 0.08, roughness: 0.48 });
      bell.scale.set(1, 0.9, 0.82);
      bell.position.set(0, -0.16, 0.7);
      const slit = makeMesh(new THREE.BoxGeometry(0.09, 0.01, 0.01), 0x8f651d);
      slit.position.set(0, -0.17, 0.765);
      group.add(collar, bell, slit);
      break;
    }
    case '草帽':
    default: {
      const brim = makeMesh(new THREE.CylinderGeometry(0.46, 0.52, 0.055, 32), COLOR.straw);
      brim.position.set(0, 0.92, 0.03);
      brim.rotation.z = -0.04;
      const crown = makeMesh(new THREE.CylinderGeometry(0.24, 0.31, 0.2, 24), 0xf2d98a);
      crown.position.set(0, 1.03, 0.02);
      crown.rotation.z = -0.04;
      const ribbon = makeMesh(new THREE.TorusGeometry(0.285, 0.018, 8, 32), 0x8ab16d);
      ribbon.position.set(0, 0.96, 0.02);
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
  world.add(ground, hill, path, createGardenFoodBowl(garden), createGardenPlants(garden), createVisitorGroup(garden), createGardenPet(garden));
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
    const pet = world.getObjectByName('garden-pet-3d');
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
  createGardenPet,
  createGardenPlants,
  createRewardDrops,
  createVisitorGroup,
  mountAnimalGarden3D,
};
