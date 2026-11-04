import * as THREE from "three";
import { WORLD } from "../config.js";
import {
  createBankWallGeometry,
  createRibbonGeometry,
  river,
} from "./river.js";
import { createGlowTexture, seededRandom } from "../utils/textures.js";
import { emissiveMaterial, metalMaterial, stoneMaterial } from "./materials.js";

const L = WORLD.landLevel;
const ROAD = WORLD.roadLevel;

/* ------------------------------------------------------------------ */
/* 城市地面贴图                                                        */
/* ------------------------------------------------------------------ */

/**
 * 程序化城市肌理：街区 / 屋顶 / 绿化 / 街道。
 * 一张贴图覆盖约 600m × 600m，平铺后形成连续的城市底图。
 */
function createCityGroundTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const rand = seededRandom(9137);

  // 深色城市底图：低对比、偏冷灰，让灯光和体量主导画面
  ctx.fillStyle = "#14171b";
  ctx.fillRect(0, 0, size, size);

  const blocks = 16;
  const cell = size / blocks;
  const roofs = [
    "#23272d",
    "#1e2228",
    "#282d33",
    "#1b1f24",
    "#2d3136",
    "#20242a",
    "#252a2f",
    "#1d2126",
  ];

  for (let row = 0; row < blocks; row++) {
    for (let col = 0; col < blocks; col++) {
      const margin = cell * (0.16 + rand() * 0.08);
      const x = col * cell + margin;
      const y = row * cell + margin;
      const w = cell - margin * 2;
      const h = cell - margin * 2;

      if (rand() < 0.1) {
        ctx.fillStyle = rand() < 0.5 ? "#1b241f" : "#1e2822";
        ctx.fillRect(x, y, w, h);
        continue;
      }

      ctx.fillStyle = roofs[Math.floor(rand() * roofs.length)];
      ctx.fillRect(x, y, w, h);

      // 极轻的屋面受光边，避免整片地面死黑
      ctx.fillStyle = "rgba(180,195,210,0.035)";
      ctx.fillRect(x, y, w, Math.max(1.5, h * 0.1));
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(x, y + h - Math.max(2, h * 0.12), w, Math.max(2, h * 0.12));

      const units = 1 + Math.floor(rand() * 2);
      for (let i = 0; i < units; i++) {
        const uw = w * (0.14 + rand() * 0.2);
        const uh = h * (0.12 + rand() * 0.18);
        ctx.fillStyle =
          rand() < 0.55 ? "rgba(10,12,14,0.4)" : "rgba(140,150,160,0.06)";
        ctx.fillRect(x + rand() * (w - uw), y + rand() * (h - uh), uw, uh);
      }
    }
  }

  // 大尺度明暗斑块，减弱平铺规律感
  for (let i = 0; i < 26; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const radius = 90 + rand() * 220;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    const shade = rand() < 0.5 ? "0,0,0" : "160,175,190";
    gradient.addColorStop(0, `rgba(${shade},${0.05 + rand() * 0.06})`);
    gradient.addColorStop(1, `rgba(${shade},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.repeat.set(1 / 900, 1 / 900);
  return texture;
}

/* ------------------------------------------------------------------ */
/* 河岸与陆地                                                          */
/* ------------------------------------------------------------------ */

function createLand() {
  const [left, right] = river.waterPolygon(0);

  const shape = new THREE.Shape();
  const yMin = -WORLD.maxZ;
  const yMax = -WORLD.minZ;
  shape.moveTo(WORLD.minX, yMin);
  shape.lineTo(WORLD.maxX, yMin);
  shape.lineTo(WORLD.maxX, yMax);
  shape.lineTo(WORLD.minX, yMax);
  shape.closePath();

  const points = [];
  for (const [x, z] of left) points.push(new THREE.Vector2(x, -z));
  for (let i = right.length - 1; i >= 0; i--) {
    points.push(new THREE.Vector2(right[i][0], -right[i][1]));
  }
  shape.holes.push(new THREE.Path(points));

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    map: createCityGroundTexture(),
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.02,
  });

  const land = new THREE.Mesh(geometry, material);
  land.position.y = L;
  land.receiveShadow = true;
  land.name = "Land";
  return land;
}

function createBankWalls() {
  const group = new THREE.Group();
  group.name = "RiverBanks";

  const wallMaterial = stoneMaterial(0x8b8375, 0.92);
  wallMaterial.side = THREE.DoubleSide;

  const parapetMaterial = stoneMaterial(0x9c9384, 0.88);
  parapetMaterial.side = THREE.DoubleSide;

  const copingMaterial = stoneMaterial(0xb3aa98, 0.85);

  for (const side of [1, -1]) {
    const wall = new THREE.Mesh(
      createBankWallGeometry({
        side,
        topY: L + 0.02,
        bottomY: WORLD.riverBed,
        extra: 0,
        step: 2,
      }),
      wallMaterial,
    );
    wall.receiveShadow = true;
    group.add(wall);

    // 防洪墙顶部的低矮护栏
    const parapet = new THREE.Mesh(
      createBankWallGeometry({
        side,
        topY: L + 1.05,
        bottomY: L - 0.4,
        extra: 1.1,
        step: 3,
      }),
      parapetMaterial,
    );
    parapet.castShadow = true;
    parapet.receiveShadow = true;
    group.add(parapet);

    // 压顶石
    const coping = new THREE.Mesh(
      createRibbonGeometry({
        offsetA: (u) => side * (river.halfWidthAt(u) + 0.6),
        offsetB: (u) => side * (river.halfWidthAt(u) + 2.6),
        y: L + 1.12,
        step: 3,
        uvScale: 0.1,
      }),
      copingMaterial,
    );
    coping.receiveShadow = true;
    group.add(coping);
  }

  return group;
}

/* ------------------------------------------------------------------ */
/* 滨江步道                                                            */
/* ------------------------------------------------------------------ */

function createPavingTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const rand = seededRandom(808);

  ctx.fillStyle = "#6f6559";
  ctx.fillRect(0, 0, size, size);

  const cell = size / 8;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const lightness = 118 + Math.floor(rand() * 38);
      ctx.fillStyle = `rgb(${lightness}, ${lightness - 8}, ${lightness - 20})`;
      ctx.fillRect(col * cell + 1.5, row * cell + 1.5, cell - 3, cell - 3);
      for (let i = 0; i < 12; i++) {
        const shade = lightness - 18 + Math.floor(rand() * 30);
        ctx.fillStyle = `rgba(${shade}, ${shade - 6}, ${shade - 14}, 0.35)`;
        ctx.fillRect(
          col * cell + 3 + rand() * (cell - 8),
          row * cell + 3 + rand() * (cell - 8),
          1 + rand() * 2,
          1 + rand() * 2,
        );
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createPromenade() {
  const group = new THREE.Group();
  group.name = "Promenade";

  const texture = createPavingTexture();
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xd9d2c6,
    roughness: 0.92,
    metalness: 0.02,
  });

  for (const side of [1, -1]) {
    const promenade = new THREE.Mesh(
      createRibbonGeometry({
        offsetA: (u) => side * (river.halfWidthAt(u) + 2.6),
        offsetB: (u) => side * (river.halfWidthAt(u) + 33),
        y: L + 0.14,
        step: 3,
        uvScale: 0.09,
        vRepeat: 3,
      }),
      material,
    );
    promenade.receiveShadow = true;
    group.add(promenade);
  }

  return group;
}

/* ------------------------------------------------------------------ */
/* 滨江道路与车流                                                      */
/* ------------------------------------------------------------------ */

function createRoads() {
  const group = new THREE.Group();
  group.name = "RiversideRoads";

  const roadMaterial = new THREE.MeshStandardMaterial({
    color: 0x1b1d20,
    roughness: 0.9,
    metalness: 0.05,
  });

  const shoulderMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3d40,
    roughness: 0.92,
    metalness: 0.03,
  });

  for (const side of [1, -1]) {
    const road = new THREE.Mesh(
      createRibbonGeometry({
        offsetA: (u) => side * (river.halfWidthAt(u) + 37),
        offsetB: (u) => side * (river.halfWidthAt(u) + 67),
        y: ROAD,
        step: 3,
        uvScale: 0.05,
      }),
      roadMaterial,
    );
    road.receiveShadow = true;
    group.add(road);

    const shoulder = new THREE.Mesh(
      createRibbonGeometry({
        offsetA: (u) => side * (river.halfWidthAt(u) + 67),
        offsetB: (u) => side * (river.halfWidthAt(u) + 75),
        y: ROAD + 0.04,
        step: 4,
        uvScale: 0.05,
      }),
      shoulderMaterial,
    );
    shoulder.receiveShadow = true;
    group.add(shoulder);
  }

  // 车道虚线
  const dashGeometry = new THREE.BoxGeometry(0.3, 0.04, 5);
  const dashMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8d2c2,
    emissive: 0xbdb6a4,
    emissiveIntensity: 0.12,
    roughness: 0.7,
  });

  const transforms = [];
  const dummy = new THREE.Object3D();
  const total = river.length;
  const spacing = 30;
  const startU = 0.055;
  const endU = 0.945;
  const count = Math.floor(((endU - startU) * total) / spacing);
  for (const side of [1, -1]) {
    for (let i = 0; i < count; i++) {
      const u = startU + ((endU - startU) * i) / count;
      const p = river.pointAt(u);
      const n = river.normalAt(u);
      const t = river.tangentAt(u);
      const hw = river.halfWidthAt(u);
      const offset = side * (hw + 52);
      transforms.push({
        x: p.x + n.x * offset,
        z: p.z + n.z * offset,
        yaw: Math.atan2(t.x, t.z),
      });
    }
  }

  const dashes = new THREE.InstancedMesh(
    dashGeometry,
    dashMaterial,
    transforms.length,
  );
  transforms.forEach((transform, index) => {
    dummy.position.set(transform.x, ROAD + 0.05, transform.z);
    dummy.rotation.set(0, transform.yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    dashes.setMatrixAt(index, dummy.matrix);
  });
  dashes.instanceMatrix.needsUpdate = true;
  group.add(dashes);

  return group;
}

function createCars() {
  const group = new THREE.Group();
  group.name = "Cars";
  const rand = seededRandom(606);

  const lanes = [];
  for (const side of [1, -1]) {
    // 靠江一侧为同向，靠城一侧为对向
    lanes.push({ side, extra: 42, dir: 1 });
    lanes.push({ side, extra: 48, dir: 1 });
    lanes.push({ side, extra: 56, dir: -1 });
    lanes.push({ side, extra: 62, dir: -1 });
  }

  const cars = [];
  for (const lane of lanes) {
    const count = 11;
    for (let i = 0; i < count; i++) {
      cars.push({
        ...lane,
        u: rand(),
        speed: 9 + rand() * 8,
        phase: rand() * Math.PI * 2,
      });
    }
  }

  const bodyGeometry = new THREE.BoxGeometry(1.9, 1.35, 4.4);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.55,
    roughness: 0.32,
  });

  const bodies = new THREE.InstancedMesh(
    bodyGeometry,
    bodyMaterial,
    cars.length,
  );
  bodies.castShadow = false;

  const palette = [
    0xd7d9dd, 0x2d3138, 0x8e939a, 0x1e2a44, 0x6b1f27, 0xe6e1d4, 0x2c3a32,
  ];
  const color = new THREE.Color();
  cars.forEach((car, index) => {
    bodies.setColorAt(
      index,
      color.setHex(palette[Math.floor(rand() * palette.length)]),
    );
  });
  bodies.instanceColor.needsUpdate = true;

  const headMaterial = emissiveMaterial(0xfff2cc, {
    type: "car",
    base: 1.4,
    baseColor: 0x1d1a12,
    roughness: 0.3,
  });
  const tailMaterial = emissiveMaterial(0xff2a1a, {
    type: "car",
    base: 1.15,
    baseColor: 0x1c0806,
    roughness: 0.3,
  });

  const lightGeometry = new THREE.BoxGeometry(0.42, 0.26, 0.22);
  const headlights = new THREE.InstancedMesh(
    lightGeometry,
    headMaterial,
    cars.length * 2,
  );
  const taillights = new THREE.InstancedMesh(
    lightGeometry,
    tailMaterial,
    cars.length * 2,
  );

  const dummy = new THREE.Object3D();
  const carMatrix = new THREE.Matrix4();
  const offsetMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const t = new THREE.Vector3();

  function updateMatrices() {
    cars.forEach((car, index) => {
      const hw = river.halfWidthAt(car.u);
      river.pointAt(car.u, p);
      river.normalAt(car.u, n);
      river.tangentAt(car.u, t);
      const offset = car.side * (hw + car.extra);
      const x = p.x + n.x * offset;
      const z = p.z + n.z * offset;
      const y = ROAD + 0.7;
      const yaw = Math.atan2(t.x * car.dir, t.z * car.dir);

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      carMatrix.copy(dummy.matrix);
      bodies.setMatrixAt(index, carMatrix);

      for (const side of [-0.62, 0.62]) {
        for (const front of [2.2, -2.2]) {
          const lightIndex =
            index * 2 + (side > 0 ? 1 : 0);
          offsetMatrix.makeTranslation(side, 0, front);
          dummy.matrix.multiplyMatrices(carMatrix, offsetMatrix);
          dummy.matrix.decompose(position, dummy.quaternion, dummy.scale);
          dummy.position.copy(position);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          if (front > 0) headlights.setMatrixAt(lightIndex, dummy.matrix);
          else taillights.setMatrixAt(lightIndex, dummy.matrix);
        }
      }
    });
    bodies.instanceMatrix.needsUpdate = true;
    headlights.instanceMatrix.needsUpdate = true;
    taillights.instanceMatrix.needsUpdate = true;
  }

  updateMatrices();
  group.add(bodies, headlights, taillights);

  return {
    group,
    update(delta) {
      for (const car of cars) {
        car.u += (car.dir * car.speed * delta) / river.length;
        if (car.u > 1) car.u -= 1;
        if (car.u < 0) car.u += 1;
      }
      updateMatrices();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 路灯 / 行道树                                                       */
/* ------------------------------------------------------------------ */

function createLamps() {
  const group = new THREE.Group();
  group.name = "RiversideLamps";

  const lampMaterial = emissiveMaterial(0xffe2ac, {
    type: "lamp",
    base: 1.6,
    baseColor: 0x2a2418,
    roughness: 0.55,
  });
  const postMaterial = metalMaterial(0x2f3438, 0.5, 0.8);

  const postGeometry = new THREE.CylinderGeometry(0.13, 0.2, 7, 8);
  const headGeometry = new THREE.SphereGeometry(0.6, 10, 8);
  const glowGeometry = new THREE.PlaneGeometry(13, 13);

  const spacing = 88;
  const startU = 0.045;
  const endU = 0.955;
  const countPerSide =
    Math.floor(((endU - startU) * river.length) / spacing) + 1;

  const glowMaterial = new THREE.MeshBasicMaterial({
    map: createGlowTexture(
      "rgba(255,226,170,0.9)",
      "rgba(255,196,110,0.28)",
      "rgba(255,180,90,0)",
    ),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const total = countPerSide * 2;
  const posts = new THREE.InstancedMesh(postGeometry, postMaterial, total);
  const heads = new THREE.InstancedMesh(headGeometry, lampMaterial, total);
  const glows = new THREE.InstancedMesh(glowGeometry, glowMaterial, total);
  const dummy = new THREE.Object3D();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const t = new THREE.Vector3();

  let index = 0;
  for (const side of [1, -1]) {
    for (let i = 0; i < countPerSide; i++) {
      const u = startU + ((endU - startU) * i) / (countPerSide - 1);
      const hw = river.halfWidthAt(u);
      river.pointAt(u, p);
      river.normalAt(u, n);
      river.tangentAt(u, t);
      const offset = side * (hw + 9);
      const x = p.x + n.x * offset;
      const z = p.z + n.z * offset;
      const yaw = Math.atan2(t.x, t.z);

      dummy.position.set(x, L + 3.6, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      posts.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, L + 7.3, z);
      dummy.updateMatrix();
      heads.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, L + 0.2, z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      glows.setMatrixAt(index, dummy.matrix);
      index++;
    }
  }

  posts.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  glows.instanceMatrix.needsUpdate = true;
  posts.castShadow = false;
  group.add(posts, heads, glows);

  return {
    group,
    glowMaterial,
    update(elapsed, state) {
      glowMaterial.opacity = Math.min(0.4, state.lampIntensity * 0.22);
    },
  };
}

function createTrees() {
  const group = new THREE.Group();
  group.name = "RiversideTrees";
  const rand = seededRandom(2027);

  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3729,
    roughness: 0.95,
  });
  const treeMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f4a33,
    roughness: 0.92,
    metalness: 0.02,
  });

  const trunkGeometry = new THREE.CylinderGeometry(0.36, 0.55, 5.6, 7);
  const canopyGeometry = new THREE.IcosahedronGeometry(4.8, 1);

  const spacing = 96;
  const startU = 0.05;
  const endU = 0.95;
  const countPerSide =
    Math.floor(((endU - startU) * river.length) / spacing) + 1;
  const total = countPerSide * 2;

  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, total);
  const canopies = new THREE.InstancedMesh(
    canopyGeometry,
    treeMaterial,
    total,
  );

  const dummy = new THREE.Object3D();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const color = new THREE.Color();

  let index = 0;
  for (const side of [1, -1]) {
    for (let i = 0; i < countPerSide; i++) {
      const u = startU + ((endU - startU) * i) / (countPerSide - 1);
      const hw = river.halfWidthAt(u);
      river.pointAt(u, p);
      river.normalAt(u, n);
      const offset = side * (hw + 25);
      const x = p.x + n.x * offset + (rand() - 0.5) * 4;
      const z = p.z + n.z * offset + (rand() - 0.5) * 4;
      const scale = 0.8 + rand() * 0.5;

      dummy.position.set(x, L + 2.8 * scale, z);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, L + 8.4 * scale, z);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.updateMatrix();
      canopies.setMatrixAt(index, dummy.matrix);
      canopies.setColorAt(
        index,
        color.setHSL(0.3 + rand() * 0.05, 0.26 + rand() * 0.12, 0.2 + rand() * 0.08),
      );
      index++;
    }
  }

  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  canopies.instanceColor.needsUpdate = true;
  trunks.castShadow = true;
  canopies.castShadow = true;
  group.add(trunks, canopies);
  return group;
}

/* ------------------------------------------------------------------ */
/* 码头                                                                */
/* ------------------------------------------------------------------ */

function createPiers() {
  const group = new THREE.Group();
  group.name = "Piers";

  const definitions = [
    { u: 0.275, side: 1 },
    { u: 0.315, side: 1 },
    { u: 0.44, side: -1 },
    { u: 0.5, side: -1 },
    { u: 0.56, side: -1 },
    { u: 0.6, side: 1 },
    { u: 0.7, side: 1 },
    { u: 0.74, side: -1 },
    { u: 0.84, side: 1 },
  ];

  const deckGeometry = new THREE.BoxGeometry(16, 2.6, 76);
  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x5c5b56,
    roughness: 0.9,
    metalness: 0.04,
  });

  const pileGeometry = new THREE.CylinderGeometry(0.7, 0.7, 14, 6);
  const pileMaterial = stoneMaterial(0x6b675e, 0.95);

  const lampMaterial = emissiveMaterial(0xbfe4ff, {
    type: "lamp",
    base: 1.2,
    baseColor: 0x101820,
    roughness: 0.4,
  });
  const lampGeometry = new THREE.SphereGeometry(0.45, 8, 6);

  const decks = new THREE.InstancedMesh(
    deckGeometry,
    deckMaterial,
    definitions.length,
  );
  const piles = new THREE.InstancedMesh(
    pileGeometry,
    pileMaterial,
    definitions.length * 6,
  );
  const lamps = new THREE.InstancedMesh(
    lampGeometry,
    lampMaterial,
    definitions.length * 2,
  );

  const dummy = new THREE.Object3D();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();

  definitions.forEach((definition, index) => {
    const { u, side } = definition;
    const hw = river.halfWidthAt(u);
    river.pointAt(u, p);
    river.normalAt(u, n);

    // 从岸边伸向江心
    const dirX = -side * n.x;
    const dirZ = -side * n.z;
    const bankX = p.x + n.x * side * hw;
    const bankZ = p.z + n.z * side * hw;
    const centerX = bankX + dirX * 34;
    const centerZ = bankZ + dirZ * 34;
    const yaw = Math.atan2(dirX, dirZ);

    dummy.position.set(centerX, WORLD.waterLevel + 3.2, centerZ);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    decks.setMatrixAt(index, dummy.matrix);

    for (let i = 0; i < 6; i++) {
      const along = -28 + i * 11;
      const px = bankX + dirX * (34 + along);
      const pz = bankZ + dirZ * (34 + along);
      const sideOffset = i % 2 === 0 ? -6 : 6;
      dummy.position.set(
        px + -dirZ * sideOffset,
        WORLD.waterLevel - 2.5,
        pz + dirX * sideOffset,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      piles.setMatrixAt(index * 6 + i, dummy.matrix);
    }

    for (let i = 0; i < 2; i++) {
      const along = i === 0 ? -22 : 22;
      dummy.position.set(
        bankX + dirX * (34 + along),
        WORLD.waterLevel + 7.4,
        bankZ + dirZ * (34 + along),
      );
      dummy.updateMatrix();
      lamps.setMatrixAt(index * 2 + i, dummy.matrix);
    }
  });

  decks.instanceMatrix.needsUpdate = true;
  piles.instanceMatrix.needsUpdate = true;
  lamps.instanceMatrix.needsUpdate = true;
  decks.castShadow = true;
  group.add(decks, piles, lamps);

  return group;
}

/* ------------------------------------------------------------------ */
/* 桥梁                                                                */
/* ------------------------------------------------------------------ */

function createCableStayedBridge(u) {
  const group = new THREE.Group();
  group.name = "CableStayedBridge";

  const p = river.pointAt(u);
  const n = river.normalAt(u);
  const hw = river.halfWidthAt(u);
  const halfSpan = hw + 300;
  const deckY = 47;

  group.position.set(p.x, 0, p.z);
  group.rotation.y = Math.atan2(-n.z, n.x);

  const concrete = stoneMaterial(0xb4afa4, 0.85);
  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c2e31,
    roughness: 0.85,
    metalness: 0.08,
  });
  const railMaterial = metalMaterial(0x777d84, 0.45, 0.7);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(halfSpan * 2, 3.4, 32),
    deckMaterial,
  );
  deck.position.y = deckY;
  deck.castShadow = true;
  group.add(deck);

  for (const z of [-16, 16]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(halfSpan * 2, 1.6, 0.5),
      railMaterial,
    );
    rail.position.set(0, deckY + 2.4, z);
    group.add(rail);
  }

  // 引桥
  for (const direction of [-1, 1]) {
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(460, 4, 28),
      deckMaterial,
    );
    ramp.position.set(direction * (halfSpan + 220), deckY * 0.5 + 1.5, 0);
    ramp.rotation.z = direction * -0.095;
    group.add(ramp);
  }

  const pylonXs = [-(hw + 92), hw + 92];
  const cablePositions = [];

  for (const pylonX of pylonXs) {
    for (const sideZ of [-15, 15]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(7.5, 200, 7),
        concrete,
      );
      leg.position.set(pylonX, 100, sideZ);
      leg.castShadow = true;
      group.add(leg);
    }

    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(9, 6.5, 42),
      concrete,
    );
    beam.position.set(pylonX, deckY + 158, 0);
    beam.castShadow = true;
    group.add(beam);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 4.5, 38),
      concrete,
    );
    cap.position.set(pylonX, deckY + 180, 0);
    group.add(cap);

    for (const sideZ of [-13, 13]) {
      for (const offset of [30, 68, 112, 165, 225, 295]) {
        for (const direction of [-1, 1]) {
          const anchorX = pylonX + direction * offset;
          cablePositions.push(
            pylonX,
            deckY + 176,
            sideZ * 0.3,
            anchorX,
            deckY + 1.5,
            sideZ * 0.92,
          );
        }
      }
    }
  }

  const cableGeometry = new THREE.BufferGeometry();
  cableGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(cablePositions, 3),
  );
  const cableMaterial = new THREE.LineBasicMaterial({
    color: 0x74889b,
    transparent: true,
    opacity: 0.3,
  });
  const cables = new THREE.LineSegments(cableGeometry, cableMaterial);
  group.add(cables);

  // 桥面边缘灯带
  const edgeLightMaterial = emissiveMaterial(0xffdb9e, {
    type: "lamp",
    base: 0.55,
    baseColor: 0x272013,
    roughness: 0.4,
  });
  for (const z of [-16.4, 16.4]) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(halfSpan * 2, 0.35, 0.5),
      edgeLightMaterial,
    );
    strip.position.set(0, deckY + 0.9, z);
    group.add(strip);
  }

  // 桥面路灯
  const lampMaterial = emissiveMaterial(0xffdb9e, {
    type: "lamp",
    base: 1.0,
    baseColor: 0x272013,
    roughness: 0.4,
  });
  const lampGeometry = new THREE.SphereGeometry(0.7, 8, 6);
  const lampCount = Math.floor((halfSpan * 2) / 26) * 2;
  const lamps = new THREE.InstancedMesh(lampGeometry, lampMaterial, lampCount);
  const dummy = new THREE.Object3D();
  let index = 0;
  for (let x = -halfSpan + 12; x <= halfSpan - 12 && index < lampCount; x += 26) {
    for (const z of [-15, 15]) {
      if (index >= lampCount) break;
      dummy.position.set(x, deckY + 3.7, z);
      dummy.updateMatrix();
      lamps.setMatrixAt(index++, dummy.matrix);
    }
  }
  lamps.instanceMatrix.needsUpdate = true;
  group.add(lamps);

  // 桥塔航空灯
  const beaconMaterial = new THREE.MeshStandardMaterial({
    color: 0x220505,
    emissive: 0xff2a2a,
    emissiveIntensity: 2,
    roughness: 0.5,
  });
  for (const pylonX of pylonXs) {
    for (const sideZ of [-15, 15]) {
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(1.8, 10, 8),
        beaconMaterial,
      );
      beacon.position.set(pylonX, deckY + 186, sideZ);
      group.add(beacon);
    }
  }

  return {
    group,
    update(elapsed, state) {
      cableMaterial.opacity = 0.35 + state.lampIntensity * 0.14;
      beaconMaterial.emissiveIntensity =
        state.neonIntensity *
        (Math.sin(elapsed * 1.8 + 2.3) > 0.5 ? 3 : 0.2);
    },
  };
}

function createBeamBridge(u) {
  const group = new THREE.Group();
  group.name = "BeamBridge";

  const p = river.pointAt(u);
  const n = river.normalAt(u);
  const hw = river.halfWidthAt(u);
  const halfSpan = hw + 170;
  const deckY = 30;

  group.position.set(p.x, 0, p.z);
  group.rotation.y = Math.atan2(-n.z, n.x);

  const concrete = stoneMaterial(0xa9a49a, 0.9);
  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x33363a,
    roughness: 0.88,
    metalness: 0.06,
  });

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(halfSpan * 2, 3, 26),
    deckMaterial,
  );
  deck.position.y = deckY;
  group.add(deck);

  for (const x of [-hw * 0.55, hw * 0.55]) {
    for (const z of [-9, 9]) {
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(9, deckY + 6, 9),
        concrete,
      );
      pier.position.set(x, (deckY + 6) / 2 - 4, z);
      pier.castShadow = true;
      group.add(pier);
    }
  }

  for (const direction of [-1, 1]) {
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(320, 3.6, 24),
      deckMaterial,
    );
    ramp.position.set(direction * (halfSpan + 150), deckY * 0.5, 0);
    ramp.rotation.z = direction * -0.085;
    group.add(ramp);
  }

  const lampMaterial = emissiveMaterial(0xffdb9e, {
    type: "lamp",
    base: 1.0,
    baseColor: 0x272013,
    roughness: 0.4,
  });
  const lampGeometry = new THREE.SphereGeometry(0.65, 8, 6);
  const lampCount = Math.floor((halfSpan * 2) / 30) * 2;
  const lamps = new THREE.InstancedMesh(lampGeometry, lampMaterial, lampCount);
  const dummy = new THREE.Object3D();
  let index = 0;
  for (let x = -halfSpan + 10; x <= halfSpan - 10 && index < lampCount; x += 30) {
    for (const z of [-12, 12]) {
      if (index >= lampCount) break;
      dummy.position.set(x, deckY + 3, z);
      dummy.updateMatrix();
      lamps.setMatrixAt(index++, dummy.matrix);
    }
  }
  lamps.instanceMatrix.needsUpdate = true;
  group.add(lamps);

  return {
    group,
    update() {},
  };
}

/* ------------------------------------------------------------------ */
/* 组装                                                                */
/* ------------------------------------------------------------------ */

export function createCity(scene) {
  const group = new THREE.Group();
  group.name = "City";

  group.add(createLand());
  group.add(createBankWalls());
  group.add(createPromenade());
  group.add(createRoads());

  const cars = createCars();
  group.add(cars.group);

  const lamps = createLamps();
  group.add(lamps.group);

  group.add(createTrees());
  group.add(createPiers());

  const bridge = createCableStayedBridge(0.665);
  const bridge2 = createBeamBridge(0.2);
  group.add(bridge.group, bridge2.group);

  scene.add(group);

  return {
    group,
    update(delta, elapsed, state) {
      cars.update(delta);
      lamps.update(elapsed, state);
      bridge.update(elapsed, state);
      bridge2.update(elapsed, state);
    },
  };
}
