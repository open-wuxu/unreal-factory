import * as THREE from "three";
import { LAYOUT, WORLD } from "../config.js";
import { createGlowTexture, seededRandom } from "../utils/textures.js";
import { mergeMeshes, stoneMaterial, woodMaterial } from "./materials.js";

/**
 * 江岸、河床、远山与码头。
 *
 * 近岸（z > 34）是枫桥、枫树与客船所在的南岸；北岸（z < -34）
 * 逐渐抬升为寒山寺所在的山坡。更远处是三层低矮山脊，被夜雾
 * 一层层吃掉，形成水墨式的空间纵深。
 */

function gaussian(x, z, cx, cz, sx, sz) {
  const dx = (x - cx) / sx;
  const dz = (z - cz) / sz;
  return Math.exp(-(dx * dx + dz * dz));
}

function smoothstep(a, b, value) {
  const t = Math.min(1, Math.max(0, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 北岸地形高度（供寺院、树木、石阶对齐地面）。 */
export function farBankHeight(x, z) {
  const shore = smoothstep(-34, -62, z);
  const templeHill = gaussian(x, z, LAYOUT.temple.x, LAYOUT.temple.z, 96, 58);
  const ridge =
    smoothstep(-70, -220, z) *
    (0.55 + 0.45 * Math.sin(x * 0.014 + 1.2) + 0.18 * Math.sin(x * 0.041));
  const undulation =
    Math.sin(x * 0.036 + z * 0.025) * 0.5 +
    Math.sin(x * 0.011 - z * 0.018) * 0.35;

  let height =
    WORLD.landLevel +
    shore * 2.4 +
    templeHill * (WORLD.templeBase - WORLD.landLevel) +
    ridge * 16 +
    undulation * shore;

  const pad = gaussian(x, z, LAYOUT.temple.x, LAYOUT.temple.z, 34, 28);
  height = THREE.MathUtils.lerp(height, WORLD.templeBase - 0.15, pad * 0.92);
  return height;
}

/** 近岸地面。 */
function createNearBank() {
  const geometry = new THREE.PlaneGeometry(520, 220, 100, 48);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, 144);

  const position = geometry.attributes.position;
  const colors = [];
  const rand = seededRandom(91);
  const base = new THREE.Color(0x343b30);
  const dry = new THREE.Color(0x4a4c3c);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const edge = smoothstep(34, 46, z);
    const rise = smoothstep(60, 190, z) * 2.6;
    const undulation =
      Math.sin(x * 0.045 + z * 0.03) * 0.22 +
      Math.sin(x * 0.017 - z * 0.021) * 0.16;
    position.setY(
      i,
      WORLD.landLevel + (undulation + rise) * edge + (rand() - 0.5) * 0.05,
    );

    const mix = Math.min(1, Math.max(0, 0.35 + rand() * 0.4 + rise * 0.08));
    const color = base.clone().lerp(dry, mix);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3),
  );
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.25,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

/** 北岸山坡（寒山寺坐落其上）。 */
function createFarBank() {
  const geometry = new THREE.PlaneGeometry(620, 300, 130, 74);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -184);

  const position = geometry.attributes.position;
  const colors = [];
  const rand = seededRandom(117);
  const deep = new THREE.Color(0x25302a);
  const forest = new THREE.Color(0x2d382f);
  const rock = new THREE.Color(0x3a3c36);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);

    let height = farBankHeight(x, z);

    position.setY(i, height + (rand() - 0.5) * 0.12);

    const templeHill = gaussian(x, z, LAYOUT.temple.x, LAYOUT.temple.z, 96, 58);
    const shade = 0.35 + rand() * 0.5;
    const color = deep
      .clone()
      .lerp(forest, shade * 0.7)
      .lerp(rock, Math.max(0, templeHill - 0.35) * 0.35 + rand() * 0.08);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3),
  );
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

/** 河床，避免从低角度看到水面以下的空间。 */
function createRiverbed() {
  const geometry = new THREE.PlaneGeometry(600, 90, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x070c12,
      roughness: 1,
      metalness: 0,
    }),
  );
  mesh.position.y = -4.2;
  return mesh;
}

/** 石砌护岸。 */
function createEmbankments() {
  const group = new THREE.Group();
  const material = stoneMaterial(0xa79f90, { map: "stone", repeat: [10, 0.7] });

  for (const side of [1, -1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(560, 4.2, 1.4), material);
    wall.position.set(0, WORLD.waterLevel - 0.9, side * (WORLD.riverHalfWidth + 0.6));
    wall.receiveShadow = true;
    wall.castShadow = true;
    group.add(wall);

    // 压顶石
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(560, 0.32, 2.1),
      stoneMaterial(0xb4ab9a, { map: "stoneFine", repeat: [16, 0.25] }),
    );
    cap.position.set(0, WORLD.landLevel + 0.08, side * (WORLD.riverHalfWidth + 0.5));
    cap.receiveShadow = true;
    group.add(cap);
  }

  return group;
}

/** 三层远山剪影。 */
function createDistantMountains() {
  const group = new THREE.Group();
  const layers = [
    { z: -330, height: 30, color: 0x1a2433, opacity: 1, seed: 3 },
    { z: -470, height: 46, color: 0x1c2738, opacity: 0.95, seed: 7 },
    { z: -640, height: 66, color: 0x202c3d, opacity: 0.85, seed: 11 },
  ];

  for (const layer of layers) {
    const rand = seededRandom(layer.seed);
    const points = [];
    const width = 1500;
    const segments = 90;
    for (let i = 0; i <= segments; i++) {
      const x = -width / 2 + (i / segments) * width;
      const n =
        Math.sin(i * 0.42 + layer.seed) * 0.35 +
        Math.sin(i * 0.17 + layer.seed * 2.1) * 0.45 +
        (rand() - 0.5) * 0.4;
      const envelope = 0.45 + 0.55 * Math.sin((i / segments) * Math.PI);
      points.push({ x, y: layer.height * (0.35 + n * 0.65) * envelope });
    }

    const positions = [];
    const indices = [];
    for (let i = 0; i <= segments; i++) {
      const p = points[i];
      positions.push(p.x, -8, 0);
      positions.push(p.x, p.y, 0);
      if (i < segments) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    const material = new THREE.MeshBasicMaterial({
      color: layer.color,
      fog: true,
      transparent: layer.opacity < 1,
      opacity: layer.opacity,
      depthWrite: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, layer.z);
    group.add(mesh);
  }

  return group;
}

/** 岸边的低矮山石。 */
function createBankRocks() {
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0x3a3b36,
    roughness: 0.95,
    metalness: 0.02,
    flatShading: true,
  });
  const count = 90;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  const rand = seededRandom(71);

  for (let i = 0; i < count; i++) {
    const side = i % 3 === 0 ? -1 : 1;
    const x = (rand() - 0.5) * 420;
    const z = side * (WORLD.riverHalfWidth + 1.5 + rand() * 7);
    const scale = 0.4 + rand() * 1.5;
    dummy.position.set(x, WORLD.landLevel + scale * 0.25, z);
    dummy.rotation.set(rand() * 2.2, rand() * 6.28, rand() * 2.2);
    dummy.scale.set(scale * (0.9 + rand() * 0.8), scale * (0.5 + rand() * 0.5), scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** 水边芦苇。 */
function createReeds() {
  const group = new THREE.Group();
  const rand = seededRandom(133);
  const bladeGeometry = new THREE.PlaneGeometry(0.12, 1.5, 1, 3);
  bladeGeometry.translate(0, 0.75, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0x2c3026,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    alphaTest: 0.1,
  });
  const count = 420;
  const mesh = new THREE.InstancedMesh(bladeGeometry, material, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const side = i % 5 === 0 ? -1 : 1;
    const x = (rand() - 0.5) * 400;
    const z = side * (WORLD.riverHalfWidth - 1.2 - rand() * 5);
    const scale = 0.5 + rand() * 1.1;
    dummy.position.set(x, WORLD.waterLevel - 0.1, z);
    dummy.rotation.set((rand() - 0.5) * 0.18, rand() * 6.28, (rand() - 0.5) * 0.22);
    dummy.scale.set(1, scale, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
  return group;
}

/** 近岸的木质码头与石阶。 */
function createLanding() {
  const group = new THREE.Group();
  const wood = woodMaterial(0x5c4430, { map: "woodFine", repeat: [2, 1] });
  const stone = stoneMaterial(0x716a5c, { map: "stone", repeat: [1.5, 0.6] });

  // 码头平台：从岸上伸向水面
  const platform = new THREE.Mesh(new THREE.BoxGeometry(13, 0.3, 9), wood);
  platform.position.set(14, 1.18, 30.2);
  platform.castShadow = true;
  platform.receiveShadow = true;
  group.add(platform);

  // 木板缝的阴影
  const plankLines = new THREE.Group();
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0x080604,
    transparent: true,
    opacity: 0.55,
  });
  for (let i = -6; i <= 6; i++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.02, 9),
      lineMaterial,
    );
    line.position.set(14 + i, 1.34, 30.2);
    plankLines.add(line);
  }
  group.add(plankLines);

  // 木桩
  for (const x of [8.2, 14, 19.8]) {
    for (const z of [26.2, 34.2]) {
      const pile = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.24, 2.2, 7),
        wood,
      );
      pile.position.set(x, 0.25, z);
      pile.castShadow = true;
      group.add(pile);
    }
  }

  // 系船桩
  for (const [x, z] of [
    [7.6, 33.6],
    [20.4, 33.6],
    [7.6, 27.2],
  ]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.2, 1.3, 7),
      wood,
    );
    post.position.set(x, 1.75, z);
    post.rotation.z = (x - 14) * 0.006;
    post.castShadow = true;
    group.add(post);
  }

  // 石阶：从岸上缓步下到水边
  const steps = [];
  for (let i = 0; i < 7; i++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.24, 0.72),
      stone,
    );
    step.position.set(-24, WORLD.landLevel + 0.02 - i * 0.17, 33.2 + i * 0.66);
    step.receiveShadow = true;
    steps.push(step);
  }
  group.add(mergeMeshes(steps, stone));

  // 码头尽头的风灯
  const dockLantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffab5e, transparent: true, opacity: 0.92 }),
  );
  dockLantern.position.set(20.4, 2.55, 27.2);
  group.add(dockLantern);

  const dockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 1.55, 6),
    wood,
  );
  dockPole.position.set(20.4, 1.8, 27.2);
  group.add(dockPole);

  const dockGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture({ size: 128, power: 2.4 }),
      color: 0xff9a42,
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  dockGlow.scale.setScalar(2.0);
  dockGlow.position.copy(dockLantern.position);
  group.add(dockGlow);

  const dockLight = new THREE.PointLight(0xff9a4a, 3.0, 11, 2);
  dockLight.position.copy(dockLantern.position);
  group.add(dockLight);

  // 岸边的石板小径
  const pathMaterial = stoneMaterial(0xa79f90, {
    map: "stoneFine",
    repeat: [8, 0.7],
  });
  const path = new THREE.Mesh(new THREE.BoxGeometry(120, 0.08, 2.4), pathMaterial);
  path.position.set(-6, WORLD.landLevel + 0.05, 38.5);
  path.rotation.y = -0.015;
  path.receiveShadow = true;
  group.add(path);

  group.userData.dockLantern = dockLantern.position.clone();
  return group;
}

export function createTerrain() {
  const group = new THREE.Group();
  group.name = "Terrain";
  const landing = createLanding();
  group.add(
    createNearBank(),
    createFarBank(),
    createRiverbed(),
    createEmbankments(),
    createDistantMountains(),
    createBankRocks(),
    createReeds(),
    landing,
  );
  return {
    group,
    heightAt: farBankHeight,
    dockLantern: landing.userData.dockLantern,
  };
}
