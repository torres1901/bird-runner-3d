import * as THREE from 'three';

window.__skyFinchBooted = true;

const canvas = document.getElementById('gameCanvas');
const ui = {
  score: document.getElementById('scoreValue'),
  combo: document.getElementById('comboValue'),
  speed: document.getElementById('speedValue'),
  panel: document.getElementById('messagePanel'),
  startBtn: document.getElementById('startBtn'),
  restartBtn: document.getElementById('restartBtn'),
  pauseBtn: document.getElementById('pauseBtn')
};

const BIRD_Z = 2;
const START_Y = 1.3;
const MIN_Y = -2.35;
const MAX_Y = 5.25;
const MAX_X = 4.35;
const SPAWN_Z = -92;
const DESPAWN_Z = 12;
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpColor = new THREE.Color();
const tmpVector = new THREE.Vector3();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x80d7ff, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87d9ff);
scene.fog = new THREE.Fog(0x8fdcf5, 26, 118);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 180);
camera.position.set(0, 3.35, 10.8);

const state = {
  mode: 'intro',
  score: 0,
  combo: 1,
  best: Number(localStorage.getItem('sky-finch-best') || 0),
  distance: 0,
  speed: 18,
  difficulty: 1,
  spawnTimer: 0.4,
  time: 0,
  targetX: 0,
  flapQueued: false,
  pointerActive: false,
  lastPointerX: 0,
  keyboardX: 0,
  hitFlash: 0
};

const player = {
  x: 0,
  y: START_Y,
  vy: 0,
  roll: 0,
  invincible: 0
};

const world = {
  obstacles: [],
  pickups: [],
  scenery: [],
  rails: [],
  clouds: null
};

const palette = {
  body: 0xffdf66,
  belly: 0xfff3b8,
  wing: 0xff7a9a,
  cyan: 0x62f7ff,
  mint: 0x82ffbd,
  rose: 0xff5d91,
  violet: 0x8d7cff,
  peach: 0xffb36b,
  cloud: 0xffffff,
  cloudShadow: 0xb6ebff,
  trunk: 0x3e4f8c,
  berry: 0xffe86f
};

const materials = {
  birdBody: new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.55, metalness: 0.02 }),
  birdBelly: new THREE.MeshStandardMaterial({ color: palette.belly, roughness: 0.7 }),
  birdWing: new THREE.MeshStandardMaterial({ color: palette.wing, roughness: 0.6 }),
  beak: new THREE.MeshStandardMaterial({ color: palette.peach, roughness: 0.5 }),
  eye: new THREE.MeshBasicMaterial({ color: 0x16213c }),
  ring: new THREE.MeshStandardMaterial({
    color: palette.cyan,
    emissive: palette.cyan,
    emissiveIntensity: 0.85,
    roughness: 0.28
  }),
  ringHot: new THREE.MeshStandardMaterial({
    color: palette.rose,
    emissive: palette.rose,
    emissiveIntensity: 1,
    roughness: 0.25
  }),
  cloud: new THREE.MeshStandardMaterial({ color: palette.cloud, roughness: 0.86 }),
  cloudBlue: new THREE.MeshStandardMaterial({ color: palette.cloudShadow, roughness: 0.9 }),
  storm: new THREE.MeshStandardMaterial({
    color: palette.rose,
    emissive: palette.rose,
    emissiveIntensity: 0.75,
    roughness: 0.42
  }),
  berry: new THREE.MeshStandardMaterial({
    color: palette.berry,
    emissive: palette.berry,
    emissiveIntensity: 0.4,
    roughness: 0.34
  }),
  rail: new THREE.MeshStandardMaterial({
    color: 0xffcf70,
    emissive: 0xff8f4e,
    emissiveIntensity: 0.22,
    roughness: 0.55
  }),
  meadow: new THREE.MeshStandardMaterial({ color: 0x38c796, roughness: 0.95 }),
  particle: new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true })
};

const geometries = {
  sphere: new THREE.SphereGeometry(1, 18, 14),
  smallSphere: new THREE.SphereGeometry(1, 12, 8),
  berry: new THREE.IcosahedronGeometry(0.34, 1),
  storm: new THREE.IcosahedronGeometry(0.68, 1),
  torus: new THREE.TorusGeometry(1, 0.052, 8, 48),
  cloudBlob: new THREE.SphereGeometry(0.72, 12, 8),
  rail: new THREE.BoxGeometry(0.08, 0.08, 18),
  meadow: new THREE.BoxGeometry(26, 0.18, 18),
  particle: new THREE.TetrahedronGeometry(0.18, 0),
  wing: new THREE.ConeGeometry(0.42, 1.36, 3),
  beak: new THREE.ConeGeometry(0.16, 0.48, 4)
};

const bird = createBird();
scene.add(bird.group);

const particles = new ParticlePool(520);
scene.add(particles.mesh);

setupLighting();
createWorld();
resize();
resetGame(false);
showPanel('Sky Finch Runner', '穿过发光风门，收集星莓，避开云柱和风暴球。难度会随飞行距离逐步提升。', false);

const clock = new THREE.Clock();
renderer.setAnimationLoop(tick);

function setupLighting() {
  const hemi = new THREE.HemisphereLight(0xfaf0c8, 0x30517e, 2.15);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe0a0, 2.4);
  sun.position.set(-6, 10, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 34;
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x69f5ff, 1.5);
  rim.position.set(8, 4, -8);
  scene.add(rim);
}

function createBird() {
  const group = new THREE.Group();
  group.position.set(0, START_Y, BIRD_Z);

  const body = new THREE.Mesh(geometries.sphere, materials.birdBody);
  body.scale.set(0.62, 0.5, 0.78);
  body.castShadow = true;
  group.add(body);

  const belly = new THREE.Mesh(geometries.sphere, materials.birdBelly);
  belly.position.set(0, -0.14, 0.22);
  belly.scale.set(0.36, 0.28, 0.32);
  group.add(belly);

  const leftWing = new THREE.Mesh(geometries.wing, materials.birdWing);
  leftWing.position.set(-0.58, 0.02, 0.02);
  leftWing.rotation.set(0.14, 0, Math.PI * 0.55);
  leftWing.scale.set(0.9, 1, 0.56);
  leftWing.castShadow = true;
  group.add(leftWing);

  const rightWing = new THREE.Mesh(geometries.wing, materials.birdWing);
  rightWing.position.set(0.58, 0.02, 0.02);
  rightWing.rotation.set(0.14, 0, -Math.PI * 0.55);
  rightWing.scale.set(0.9, 1, 0.56);
  rightWing.castShadow = true;
  group.add(rightWing);

  const beak = new THREE.Mesh(geometries.beak, materials.beak);
  beak.position.set(0, 0.03, -0.72);
  beak.rotation.x = -Math.PI * 0.5;
  beak.scale.set(1, 1.2, 1);
  group.add(beak);

  const leftEye = new THREE.Mesh(geometries.smallSphere, materials.eye);
  leftEye.position.set(-0.18, 0.2, -0.48);
  leftEye.scale.setScalar(0.055);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(geometries.smallSphere, materials.eye);
  rightEye.position.set(0.18, 0.2, -0.48);
  rightEye.scale.setScalar(0.055);
  group.add(rightEye);

  const tail = new THREE.Mesh(geometries.wing, materials.birdWing);
  tail.position.set(0, -0.02, 0.78);
  tail.rotation.x = Math.PI * 0.5;
  tail.scale.set(0.55, 0.62, 0.48);
  group.add(tail);

  return { group, leftWing, rightWing, tail };
}

function createWorld() {
  const meadowPositions = [-54, -36, -18, 0, 18];
  meadowPositions.forEach((z, index) => {
    const meadow = new THREE.Mesh(geometries.meadow, materials.meadow);
    meadow.position.set(0, -3.18, z);
    meadow.receiveShadow = true;
    meadow.userData.baseZ = z;
    scene.add(meadow);
    world.scenery.push(meadow);

    const leftRail = new THREE.Mesh(geometries.rail, materials.rail);
    leftRail.position.set(-4.9, -2.74, z);
    leftRail.userData.baseZ = z;
    scene.add(leftRail);
    world.rails.push(leftRail);

    const rightRail = new THREE.Mesh(geometries.rail, materials.rail);
    rightRail.position.set(4.9, -2.74, z);
    rightRail.userData.baseZ = z;
    scene.add(rightRail);
    world.rails.push(rightRail);

    if (index % 2 === 0) {
      const arch = createCloudCluster(0, 4.5, z - 6, 1.25, materials.cloudBlue);
      scene.add(arch);
      world.scenery.push(arch);
    }
  });

  world.clouds = createCloudField(78);
  scene.add(world.clouds);
}

function createCloudField(count) {
  const mesh = new THREE.InstancedMesh(geometries.cloudBlob, materials.cloud, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.userData.items = [];

  for (let i = 0; i < count; i++) {
    const item = {
      x: randomRange(-13, 13),
      y: randomRange(2.5, 8.2),
      z: randomRange(-112, 8),
      s: randomRange(0.32, 1.26),
      drift: randomRange(0.25, 0.68)
    };
    mesh.userData.items.push(item);
    writeCloudInstance(mesh, i, item);
  }

  return mesh;
}

function writeCloudInstance(mesh, index, item) {
  tmpMatrix.compose(
    tmpVector.set(item.x, item.y, item.z),
    tmpQuat,
    tmpScale.set(item.s * 1.65, item.s * 0.62, item.s)
  );
  mesh.setMatrixAt(index, tmpMatrix);
}

function createCloudCluster(x, y, z, scale = 1, material = materials.cloud) {
  const group = new THREE.Group();
  const offsets = [
    [-1.4, 0, 0, 1.2],
    [-0.55, 0.18, 0.08, 1.05],
    [0.35, 0.05, -0.08, 1.34],
    [1.24, -0.08, 0.03, 0.92]
  ];
  offsets.forEach(([ox, oy, oz, s]) => {
    const blob = new THREE.Mesh(geometries.cloudBlob, material);
    blob.position.set(ox * scale, oy * scale, oz * scale);
    blob.scale.set(scale * s * 1.2, scale * s * 0.56, scale * s * 0.82);
    blob.castShadow = true;
    group.add(blob);
  });
  group.position.set(x, y, z);
  return group;
}

function spawnPattern() {
  const difficulty = state.difficulty;
  const roll = Math.random();
  if (roll < 0.58) {
    spawnGate(difficulty);
    spawnBerryLine(SPAWN_Z - 8, difficulty);
  } else if (roll < 0.82) {
    spawnStormPair(difficulty);
  } else {
    spawnBerryArc(SPAWN_Z, difficulty);
    spawnGate(difficulty * 0.92);
  }
}

function spawnGate(difficulty) {
  const radius = THREE.MathUtils.clamp(2.25 - difficulty * 0.08, 1.45, 2.25);
  const x = randomRange(-2.7, 2.7);
  const y = randomRange(-0.35, 3.35);
  const group = new THREE.Group();
  group.position.set(x, y, SPAWN_Z);

  const ring = new THREE.Mesh(geometries.torus, materials.ring);
  ring.scale.setScalar(radius);
  ring.castShadow = true;
  group.add(ring);

  const hotRing = new THREE.Mesh(geometries.torus, materials.ringHot);
  hotRing.scale.setScalar(radius + 0.22);
  hotRing.rotation.z = Math.PI * 0.125;
  group.add(hotRing);

  const topCloud = createCloudCluster(0, radius + 1.15, 0, 0.9 + difficulty * 0.035, materials.cloud);
  const bottomCloud = createCloudCluster(0, -radius - 1.15, 0, 0.95 + difficulty * 0.04, materials.cloudBlue);
  const leftCloud = createCloudCluster(-radius - 1.48, 0, 0, 0.76 + difficulty * 0.035, materials.cloudBlue);
  const rightCloud = createCloudCluster(radius + 1.48, 0, 0, 0.76 + difficulty * 0.035, materials.cloud);
  group.add(topCloud, bottomCloud, leftCloud, rightCloud);

  scene.add(group);
  world.obstacles.push({
    kind: 'gate',
    group,
    radius,
    scored: false,
    spin: randomRange(-1.2, 1.2)
  });
}

function spawnStormPair(difficulty) {
  const count = difficulty > 4.5 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const storm = new THREE.Mesh(geometries.storm, materials.storm);
    storm.position.set(randomRange(-3.6, 3.6), randomRange(-1.1, 4.1), SPAWN_Z - i * randomRange(5.5, 9));
    storm.scale.setScalar(randomRange(0.75, 1.08));
    storm.castShadow = true;
    scene.add(storm);
    world.obstacles.push({
      kind: 'storm',
      group: storm,
      radius: storm.scale.x * 0.78,
      scored: false,
      spin: randomRange(-2.6, 2.6)
    });
  }
  spawnBerryLine(SPAWN_Z - 13, difficulty);
}

function spawnBerryLine(z, difficulty) {
  const count = THREE.MathUtils.clamp(Math.floor(3 + difficulty * 0.45), 3, 7);
  const x = randomRange(-2.8, 2.8);
  const y = randomRange(0.2, 3.7);
  for (let i = 0; i < count; i++) {
    spawnBerry(x + Math.sin(i * 0.8) * 0.5, y + i * 0.18, z - i * 2.1);
  }
}

function spawnBerryArc(z, difficulty) {
  const count = THREE.MathUtils.clamp(Math.floor(5 + difficulty * 0.35), 5, 8);
  const centerX = randomRange(-1.8, 1.8);
  const centerY = randomRange(0.7, 2.9);
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const x = centerX + (t - 0.5) * 4.8;
    const y = centerY + Math.sin(t * Math.PI) * 1.35;
    spawnBerry(x, y, z - i * 2.6);
  }
}

function spawnBerry(x, y, z) {
  const berry = new THREE.Mesh(geometries.berry, materials.berry);
  berry.position.set(x, y, z);
  berry.castShadow = true;
  scene.add(berry);
  world.pickups.push({ group: berry, radius: 0.52, collected: false, spin: randomRange(2, 4.4) });
}

function resetGame(clearEntities = true) {
  state.mode = state.mode === 'intro' ? 'intro' : 'ready';
  state.score = 0;
  state.combo = 1;
  state.distance = 0;
  state.speed = 18;
  state.difficulty = 1;
  state.spawnTimer = 0.25;
  state.time = 0;
  state.targetX = 0;
  state.keyboardX = 0;
  state.flapQueued = false;
  state.hitFlash = 0;
  player.x = 0;
  player.y = START_Y;
  player.vy = 0;
  player.roll = 0;
  player.invincible = 0;
  bird.group.position.set(0, START_Y, BIRD_Z);
  bird.group.rotation.set(0, 0, 0);
  updateHud();

  if (clearEntities) {
    clearDynamicEntities();
  }
}

function clearDynamicEntities() {
  world.obstacles.forEach((item) => scene.remove(item.group));
  world.pickups.forEach((item) => scene.remove(item.group));
  world.obstacles.length = 0;
  world.pickups.length = 0;
  particles.clear();
}

function startGame() {
  resetGame(true);
  state.mode = 'playing';
  hidePanel();
}

function pauseGame() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    ui.pauseBtn.textContent = '▶';
    showPanel('已暂停', '继续飞行时，速度和障碍会从当前位置恢复。', false, '继续飞行');
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
    ui.pauseBtn.textContent = 'Ⅱ';
    hidePanel();
  }
}

function endGame() {
  if (state.mode === 'over') {
    return;
  }
  state.mode = 'over';
  particles.burst(bird.group.position, 0xff6b9e, 54, 1.2);
  state.best = Math.max(state.best, Math.floor(state.score));
  localStorage.setItem('sky-finch-best', String(state.best));
  ui.pauseBtn.textContent = '▶';
  showPanel(
    '飞行结束',
    `本次 ${Math.floor(state.score).toLocaleString()} 分，最佳 ${state.best.toLocaleString()} 分。再来一局可以从低速重新起飞。`,
    true,
    '重新开始'
  );
}

function tick() {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.033);
  state.time += dt;

  if (state.mode === 'playing') {
    updateGame(dt);
  } else if (state.mode === 'intro' || state.mode === 'ready') {
    updateIdle(dt);
  }

  particles.update(dt);
  animateBird(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}

function updateGame(dt) {
  state.distance += state.speed * dt;
  state.difficulty = 1 + state.distance / 260;
  state.speed = THREE.MathUtils.clamp(18 + state.distance * 0.026, 18, 42);
  state.score += dt * state.speed * 4.8 * state.combo;
  state.spawnTimer -= dt;
  state.hitFlash = Math.max(0, state.hitFlash - dt * 2.5);

  const interval = THREE.MathUtils.clamp(1.28 - state.difficulty * 0.055, 0.62, 1.28);
  if (state.spawnTimer <= 0) {
    spawnPattern();
    state.spawnTimer = interval + randomRange(-0.12, 0.2);
  }

  updatePlayer(dt);
  updateMovingWorld(dt);
  updatePickups(dt);
  updateObstacles(dt);
  updateCloudField(dt);
  updateHud();
}

function updateIdle(dt) {
  const floatY = START_Y + Math.sin(state.time * 1.7) * 0.18;
  player.y = THREE.MathUtils.damp(player.y, floatY, 4, dt);
  player.x = THREE.MathUtils.damp(player.x, Math.sin(state.time * 0.65) * 0.42, 3, dt);
  bird.group.position.set(player.x, player.y, BIRD_Z);
  updateMovingWorld(dt * 0.16, true);
  updateCloudField(dt * 0.5);
}

function updatePlayer(dt) {
  if (state.flapQueued) {
    player.vy = 7.45;
    state.flapQueued = false;
    particles.trail(bird.group.position, 0xffe66d, 8);
  }

  const keyTarget = state.targetX + state.keyboardX * 3.2;
  state.targetX = THREE.MathUtils.clamp(state.targetX, -MAX_X, MAX_X);
  player.x = THREE.MathUtils.damp(player.x, THREE.MathUtils.clamp(keyTarget, -MAX_X, MAX_X), 9.5, dt);
  player.vy += -14.2 * dt;
  player.vy = THREE.MathUtils.clamp(player.vy, -10.6, 9);
  player.y += player.vy * dt;

  if (player.y < MIN_Y || player.y > MAX_Y) {
    endGame();
    return;
  }

  player.y = THREE.MathUtils.clamp(player.y, MIN_Y, MAX_Y);
  player.roll = THREE.MathUtils.damp(player.roll, -state.keyboardX * 0.42 - (player.x - state.targetX) * 0.08, 8, dt);
  bird.group.position.set(player.x, player.y, BIRD_Z);
  bird.group.rotation.z = player.roll;
  bird.group.rotation.x = THREE.MathUtils.damp(bird.group.rotation.x, -player.vy * 0.025, 8, dt);

  particles.trail(bird.group.position, state.combo >= 3 ? 0x65f7ff : 0xffffff, 1);
}

function updateMovingWorld(dt, idle = false) {
  const travel = state.speed * dt;
  world.scenery.forEach((item) => {
    item.position.z += idle ? travel * 0.18 : travel * 0.55;
    if (item.position.z > 24) {
      item.position.z -= 90;
    }
  });
  world.rails.forEach((item) => {
    item.position.z += idle ? travel * 0.22 : travel * 0.72;
    if (item.position.z > 24) {
      item.position.z -= 90;
    }
  });
}

function updateCloudField(dt) {
  if (!world.clouds) {
    return;
  }
  const items = world.clouds.userData.items;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    item.z += state.speed * dt * item.drift;
    item.x += Math.sin(state.time * 0.25 + i) * dt * 0.03;
    if (item.z > 16) {
      item.z = randomRange(-118, -92);
      item.x = randomRange(-13, 13);
      item.y = randomRange(2.5, 8.2);
    }
    writeCloudInstance(world.clouds, i, item);
  }
  world.clouds.instanceMatrix.needsUpdate = true;
}

function updatePickups(dt) {
  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const item = world.pickups[i];
    item.group.position.z += state.speed * dt;
    item.group.rotation.y += item.spin * dt;
    item.group.rotation.x += item.spin * 0.5 * dt;

    if (!item.collected && distanceToBird(item.group.position) < item.radius + 0.42) {
      item.collected = true;
      state.combo = Math.min(9, state.combo + 0.25);
      state.score += 120 * state.combo;
      particles.burst(item.group.position, palette.berry, 18, 0.68);
      scene.remove(item.group);
      world.pickups.splice(i, 1);
      continue;
    }

    if (item.group.position.z > DESPAWN_Z) {
      scene.remove(item.group);
      world.pickups.splice(i, 1);
    }
  }
}

function updateObstacles(dt) {
  for (let i = world.obstacles.length - 1; i >= 0; i--) {
    const item = world.obstacles[i];
    item.group.position.z += state.speed * dt;
    item.group.rotation.z += item.spin * dt * 0.28;

    if (item.kind === 'gate') {
      const dz = item.group.position.z - BIRD_Z;
      if (!item.scored && dz > 0) {
        item.scored = true;
        const dx = player.x - item.group.position.x;
        const dy = player.y - item.group.position.y;
        const normalized = Math.sqrt((dx / (item.radius * 1.18)) ** 2 + (dy / item.radius) ** 2);
        if (normalized > 1) {
          endGame();
          return;
        }
        state.combo = Math.min(9, state.combo + 0.5);
        state.score += 260 * state.combo;
        particles.burst(item.group.position, palette.cyan, 30, 0.9);
      }
    } else if (item.kind === 'storm') {
      if (distanceToBird(item.group.position) < item.radius + 0.46) {
        endGame();
        return;
      }
      if (!item.scored && item.group.position.z > BIRD_Z + 0.8) {
        item.scored = true;
        state.score += 80 * state.combo;
      }
    }

    if (item.group.position.z > DESPAWN_Z) {
      scene.remove(item.group);
      world.obstacles.splice(i, 1);
    }
  }
}

function animateBird(dt) {
  const flapRate = state.mode === 'playing' ? 12 + Math.abs(player.vy) * 0.42 : 5;
  const wing = Math.sin(state.time * flapRate) * 0.54;
  bird.leftWing.rotation.z = Math.PI * 0.55 + wing;
  bird.rightWing.rotation.z = -Math.PI * 0.55 - wing;
  bird.tail.rotation.y = Math.sin(state.time * 4.2) * 0.16;
}

function updateCamera(dt) {
  const targetX = player.x * 0.24;
  const targetY = 3.15 + player.y * 0.18;
  camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 2.8, dt);
  camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 2.6, dt);
  camera.position.z = THREE.MathUtils.damp(camera.position.z, 10.8 + Math.min(2.2, state.difficulty * 0.16), 2, dt);
  camera.lookAt(player.x * 0.16, 1.35 + player.y * 0.12, -8.5);
}

function distanceToBird(position) {
  const dx = position.x - player.x;
  const dy = position.y - player.y;
  const dz = position.z - BIRD_Z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function updateHud() {
  ui.score.textContent = Math.floor(state.score).toLocaleString();
  ui.combo.textContent = `x${Math.max(1, state.combo).toFixed(state.combo % 1 === 0 ? 0 : 1)}`;
  ui.speed.textContent = (state.speed / 18).toFixed(1);
}

function showPanel(title, copy, showRestart, primaryLabel = '开始飞行') {
  ui.panel.querySelector('h1').textContent = title;
  ui.panel.querySelector('p:not(.eyebrow)').textContent = copy;
  ui.restartBtn.classList.toggle('is-hidden', !showRestart);
  ui.startBtn.classList.toggle('is-hidden', showRestart);
  ui.startBtn.textContent = primaryLabel;
  ui.panel.classList.add('is-visible');
}

function hidePanel() {
  ui.panel.classList.remove('is-visible');
  ui.pauseBtn.textContent = 'Ⅱ';
}

function flap() {
  if (state.mode === 'paused') {
    pauseGame();
    return;
  }

  if (state.mode === 'over') {
    startGame();
    return;
  }

  if (state.mode === 'intro' || state.mode === 'ready') {
    startGame();
  }

  if (state.mode === 'playing') {
    state.flapQueued = true;
  }
}

function setTargetFromClientX(clientX) {
  const normalized = clientX / Math.max(1, window.innerWidth);
  state.targetX = THREE.MathUtils.clamp((normalized - 0.5) * MAX_X * 2.16, -MAX_X, MAX_X);
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.fov = width < 700 ? 63 : 55;
  camera.updateProjectionMatrix();
}

class ParticlePool {
  constructor(max) {
    this.max = max;
    this.cursor = 0;
    this.items = Array.from({ length: max }, () => ({
      active: false,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      color: new THREE.Color(),
      life: 0,
      ttl: 1,
      size: 1
    }));
    this.mesh = new THREE.InstancedMesh(geometries.particle, materials.particle, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, tmpMatrix.makeScale(0, 0, 0));
      this.mesh.setColorAt(i, tmpColor.setHex(0xffffff));
    }
  }

  clear() {
    for (let i = 0; i < this.max; i++) {
      this.items[i].active = false;
      this.mesh.setMatrixAt(i, tmpMatrix.makeScale(0, 0, 0));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  spawn(position, color, velocity, ttl = 0.72, size = 1) {
    const item = this.items[this.cursor];
    const index = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    item.active = true;
    item.position.copy(position);
    item.velocity.copy(velocity);
    item.color.setHex(color);
    item.life = ttl;
    item.ttl = ttl;
    item.size = size;
    this.mesh.setColorAt(index, item.color);
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  trail(position, color, amount) {
    for (let i = 0; i < amount; i++) {
      this.spawn(
        tmpVector.set(
          position.x + randomRange(-0.18, 0.18),
          position.y + randomRange(-0.12, 0.12),
          position.z + 0.42 + randomRange(-0.08, 0.18)
        ),
        color,
        new THREE.Vector3(randomRange(-0.6, 0.6), randomRange(-0.2, 0.45), randomRange(2.6, 5.2)),
        randomRange(0.3, 0.62),
        randomRange(0.35, 0.75)
      );
    }
  }

  burst(position, color, count, force) {
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(
        randomRange(-1, 1),
        randomRange(-0.8, 1.1),
        randomRange(-0.8, 1.8)
      ).normalize();
      this.spawn(
        position,
        color,
        dir.multiplyScalar(randomRange(2.6, 7.6) * force),
        randomRange(0.45, 0.95),
        randomRange(0.6, 1.35)
      );
    }
  }

  update(dt) {
    let dirtyColor = false;
    for (let i = 0; i < this.max; i++) {
      const item = this.items[i];
      if (!item.active) {
        continue;
      }
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        this.mesh.setMatrixAt(i, tmpMatrix.makeScale(0, 0, 0));
        continue;
      }
      item.velocity.y -= 2.1 * dt;
      item.position.addScaledVector(item.velocity, dt);
      const t = item.life / item.ttl;
      const scale = item.size * t;
      tmpMatrix.compose(item.position, tmpQuat, tmpScale.set(scale, scale, scale));
      this.mesh.setMatrixAt(i, tmpMatrix);
      tmpColor.copy(item.color).offsetHSL(0, 0, (1 - t) * 0.28);
      this.mesh.setColorAt(i, tmpColor);
      dirtyColor = true;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (dirtyColor && this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }
}

ui.startBtn.addEventListener('click', () => {
  if (state.mode === 'paused') {
    pauseGame();
    return;
  }
  startGame();
});
ui.restartBtn.addEventListener('click', startGame);
ui.pauseBtn.addEventListener('click', pauseGame);
window.addEventListener('resize', resize);

window.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) {
    return;
  }
  state.pointerActive = true;
  state.lastPointerX = event.clientX;
  setTargetFromClientX(event.clientX);
  flap();
});

window.addEventListener('pointermove', (event) => {
  if (!state.pointerActive) {
    return;
  }
  setTargetFromClientX(event.clientX);
  state.lastPointerX = event.clientX;
});

window.addEventListener('pointerup', () => {
  state.pointerActive = false;
});

window.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
    event.preventDefault();
    flap();
  } else if (['ArrowLeft', 'KeyA'].includes(event.code)) {
    event.preventDefault();
    state.keyboardX = -1;
  } else if (['ArrowRight', 'KeyD'].includes(event.code)) {
    event.preventDefault();
    state.keyboardX = 1;
  } else if (event.code === 'Escape') {
    pauseGame();
  }
});

window.addEventListener('keyup', (event) => {
  if ((['ArrowLeft', 'KeyA'].includes(event.code) && state.keyboardX < 0)
    || (['ArrowRight', 'KeyD'].includes(event.code) && state.keyboardX > 0)) {
    state.keyboardX = 0;
  }
});
