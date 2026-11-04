import * as THREE from "three";
import { RIVER } from "../config.js";
import {
  createGlowTexture,
  seededRandom,
  scaleUVs,
} from "../utils/textures.js";
import {
  emissiveMaterial,
  facadeMaterial,
  metalMaterial,
  stoneMaterial,
} from "./materials.js";

/** 立面泛光渐变：底部暖金，向上淡出。 */
function createWashTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 256, 0, 0);
  gradient.addColorStop(0, "rgba(255,198,122,0.9)");
  gradient.addColorStop(0.3, "rgba(255,188,104,0.36)");
  gradient.addColorStop(0.72, "rgba(255,172,82,0.08)");
  gradient.addColorStop(1, "rgba(255,172,82,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const LAND_LEVEL = 3.0;
const PROMENADE_LEVEL = 5.0;
const FACADE_X = -275;

/* ------------------------------------------------------------------ */
/* 石材铺装贴图                                                        */
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
      ctx.fillRect(
        col * cell + 1.5,
        row * cell + 1.5,
        cell - 3,
        cell - 3,
      );
      // 石面细微噪点
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

/* ------------------------------------------------------------------ */
/* 个别建筑的特殊屋顶                                                  */
/* ------------------------------------------------------------------ */

function addDome(group, { x, y, z, radius, copper = true }) {
  const material = copper
    ? new THREE.MeshStandardMaterial({
        color: 0x5f8271,
        metalness: 0.55,
        roughness: 0.55,
      })
    : stoneMaterial(0xbdb4a4, 0.8);

  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.92, radius, radius * 0.55, 20),
    material,
  );
  drum.position.set(x, y + radius * 0.27, z);
  drum.castShadow = true;
  group.add(drum);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(
      radius,
      24,
      14,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    ),
    material,
  );
  dome.position.set(x, y + radius * 0.55, z);
  dome.castShadow = true;
  group.add(dome);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.7, radius * 0.55, 8),
    metalMaterial(0x2f2f33, 0.5, 0.8),
  );
  cap.position.set(x, y + radius * 1.35, z);
  group.add(cap);
}

function addPyramidRoof(group, { x, y, z, radius, height }) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x4f7767,
    metalness: 0.5,
    roughness: 0.55,
  });
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 4),
    material,
  );
  roof.position.set(x, y + height / 2, z);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  const tip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.5, height * 0.5, 6),
    metalMaterial(0x9b8348, 0.4, 0.9),
  );
  tip.position.set(x, y + height + height * 0.2, z);
  group.add(tip);
}

function addClockTower(group, { x, z, roofY, width = 13, height = 20 }) {
  const towerMaterial = facadeMaterial("stonePale", {
    tint: 0xf1e6d0,
    roughness: 0.72,
    metalness: 0.06,
  });
  const towerGeometry = new THREE.BoxGeometry(width, height, width);
  scaleUVs(towerGeometry, 1.4, 1.4);
  const tower = new THREE.Mesh(towerGeometry, towerMaterial);
  tower.position.set(x, roofY + height / 2, z);
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(width + 2, 1.6, width + 2),
    stoneMaterial(0xd8cdb8, 0.78),
  );
  cap.position.set(x, roofY + height + 0.8, z);
  group.add(cap);

  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(width * 0.42, width * 0.46, 5, 16),
    stoneMaterial(0xd8cdb8, 0.78),
  );
  drum.position.set(x, roofY + height + 4, z);
  drum.castShadow = true;
  group.add(drum);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(
      width * 0.44,
      20,
      12,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    ),
    new THREE.MeshStandardMaterial({
      color: 0x507264,
      metalness: 0.55,
      roughness: 0.5,
    }),
  );
  dome.position.set(x, roofY + height + 6.5, z);
  group.add(dome);

  // 钟面朝向黄浦江
  const clockMaterial = emissiveMaterial(0xfff3cf, {
    type: "lamp",
    base: 0.9,
    baseColor: 0x2a2418,
    roughness: 0.6,
  });
  const clockFace = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 32),
    clockMaterial,
  );
  clockFace.position.set(x + width / 2 + 0.06, roofY + height * 0.66, z);
  clockFace.rotation.y = Math.PI / 2;
  group.add(clockFace);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.22, 6, 32),
    metalMaterial(0x4a4133, 0.5, 0.6),
  );
  ring.position.copy(clockFace.position);
  ring.rotation.y = Math.PI / 2;
  group.add(ring);

  const handMaterial = metalMaterial(0x25211a, 0.6, 0.5);
  const hourHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.8, 0.5),
    handMaterial,
  );
  hourHand.position.set(
    x + width / 2 + 0.12,
    roofY + height * 0.66 + 0.5,
    z,
  );
  group.add(hourHand);

  const minuteHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 2.7, 0.5),
    handMaterial,
  );
  minuteHand.position.set(
    x + width / 2 + 0.12,
    roofY + height * 0.66 + 0.7,
    z,
  );
  minuteHand.rotation.x = Math.PI / 2.6;
  group.add(minuteHand);
}

/* ------------------------------------------------------------------ */
/* 单栋外滩建筑                                                        */
/* ------------------------------------------------------------------ */

function createBundBuilding(spec, columnTransforms, treeTransforms, washMaterial) {
  const group = new THREE.Group();
  const { z, width, depth, height, style, kind, tint } = spec;

  const facade = facadeMaterial(kind, {
    tint,
    roughness: 0.78,
    metalness: 0.06,
    envMapIntensity: 0.55,
    emissiveBase: 0.9,
  });

  const geometry = new THREE.BoxGeometry(depth, height, width, 1, 4, 2);
  scaleUVs(geometry, Math.max(1, depth / 26), Math.max(1, height / 16));

  const body = new THREE.Mesh(geometry, facade);
  body.position.set(FACADE_X - depth / 2, LAND_LEVEL + height / 2, z);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 基座
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(depth + 2.4, 2.4, width + 2.4),
    stoneMaterial(0x998d7b, 0.9),
  );
  base.position.set(
    FACADE_X - depth / 2,
    LAND_LEVEL + 1.2,
    z,
  );
  base.receiveShadow = true;
  group.add(base);

  // 檐口
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(depth + 2.2, 1.8, width + 2.2),
    stoneMaterial(0xd3c6ae, 0.85),
  );
  cornice.position.set(
    FACADE_X - depth / 2,
    LAND_LEVEL + height + 0.4,
    z,
  );
  cornice.castShadow = true;
  group.add(cornice);

  const roofY = LAND_LEVEL + height + 1.3;

  // 夜间暖色泛光
  const wash = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.94, height * 0.94),
    washMaterial,
  );
  wash.position.set(FACADE_X + 0.45, LAND_LEVEL + height * 0.5, z);
  wash.rotation.y = Math.PI / 2;
  wash.renderOrder = 2;
  group.add(wash);

  // 背立面也补一层，保证从西侧俯瞰时仍有暖色建筑照明
  const washBack = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.94, height * 0.94),
    washMaterial,
  );
  washBack.position.set(
    FACADE_X - depth - 0.45,
    LAND_LEVEL + height * 0.5,
    z,
  );
  washBack.rotation.y = -Math.PI / 2;
  washBack.renderOrder = 2;
  group.add(washBack);

  // 屋顶女儿墙
  const parapet = new THREE.Mesh(
    new THREE.BoxGeometry(depth * 0.94, 1.2, width * 0.94),
    stoneMaterial(0xb9ac96, 0.9),
  );
  parapet.position.set(FACADE_X - depth / 2, roofY + 0.6, z);
  parapet.castShadow = true;
  group.add(parapet);

  // 柱廊：记录到全局 instanced mesh
  if (style === "classic" || style === "clock") {
    const count = 6;
    const span = width * 0.72;
    const columnHeight = height * 0.62;
    for (let i = 0; i < count; i++) {
      const cz = z - span / 2 + (span / (count - 1)) * i;
      columnTransforms.push({
        x: FACADE_X + 1.1,
        y: LAND_LEVEL + 2.2 + columnHeight / 2,
        z: cz,
        height: columnHeight,
      });
    }
  }

  // 三角山花
  if (style === "classic" && width > 56) {
    const pedimentShape = new THREE.Shape();
    pedimentShape.moveTo(-width * 0.34, 0);
    pedimentShape.lineTo(width * 0.34, 0);
    pedimentShape.lineTo(0, width * 0.14);
    pedimentShape.closePath();
    const pedimentGeometry = new THREE.ExtrudeGeometry(pedimentShape, {
      depth: 2.6,
      bevelEnabled: false,
      steps: 1,
    });
    pedimentGeometry.rotateY(Math.PI / 2);
    const pediment = new THREE.Mesh(
      pedimentGeometry,
      stoneMaterial(0xd6c9b1, 0.84),
    );
    pediment.position.set(FACADE_X + 0.4, roofY + 1.2, z);
    pediment.castShadow = true;
    group.add(pediment);
  }

  if (style === "dome") {
    addDome(group, {
      x: FACADE_X - depth * 0.5,
      y: roofY + 1,
      z,
      radius: Math.min(width, depth) * 0.27,
      copper: spec.copper !== false,
    });
  }

  if (style === "pyramid") {
    addPyramidRoof(group, {
      x: FACADE_X - depth * 0.5,
      y: roofY + 1,
      z,
      radius: Math.min(width, depth) * 0.42,
      height: 22,
    });
  }

  if (style === "clock") {
    addClockTower(group, {
      x: FACADE_X - depth * 0.45,
      z,
      roofY,
      width: 13,
      height: 22,
    });
  }

  // 屋顶小构件
  if (Math.random() > 0.55) {
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(5, 3, 7),
      stoneMaterial(0xa89c88, 0.9),
    );
    vent.position.set(
      FACADE_X - depth * 0.28,
      roofY + 2.5,
      z + width * 0.2,
    );
    group.add(vent);
  }

  // 沿街的树
  const treeCount = 2;
  for (let i = 0; i < treeCount; i++) {
    treeTransforms.push({
      x: FACADE_X + 12,
      z: z - width * 0.3 + i * width * 0.6,
    });
  }

  return group;
}

/* ------------------------------------------------------------------ */
/* 组装外滩                                                            */
/* ------------------------------------------------------------------ */

export function createBund(scene) {
  const group = new THREE.Group();
  group.name = "TheBund";

  const specs = [
    { z: -560, width: 66, depth: 54, height: 31, style: "classic", kind: "stoneWarm", tint: 0xf4e6cc },
    { z: -480, width: 58, depth: 50, height: 26, style: "brick", kind: "brick", tint: 0xffe9dd },
    { z: -405, width: 62, depth: 56, height: 35, style: "dome", kind: "stonePale", tint: 0xf3ead8 },
    { z: -328, width: 58, depth: 50, height: 29, style: "classic", kind: "stoneWarm", tint: 0xf7ead2 },
    { z: -252, width: 64, depth: 58, height: 34, style: "pyramid", kind: "stonePale", tint: 0xf6ecd9 },
    { z: -176, width: 56, depth: 50, height: 27, style: "classic", kind: "stoneWarm", tint: 0xf0e2c8 },
    { z: -100, width: 60, depth: 52, height: 30, style: "brick", kind: "brick", tint: 0xffe4d2 },
    { z: -26, width: 64, depth: 56, height: 33, style: "classic", kind: "stonePale", tint: 0xf5ecd9 },
    { z: 52, width: 68, depth: 58, height: 36, style: "clock", kind: "stonePale", tint: 0xf8eeda },
    { z: 130, width: 58, depth: 50, height: 28, style: "classic", kind: "stoneWarm", tint: 0xf2e4ca },
    { z: 205, width: 62, depth: 54, height: 32, style: "dome", kind: "stonePale", tint: 0xf4ead6, copper: false },
    { z: 280, width: 56, depth: 50, height: 26, style: "classic", kind: "stoneWarm", tint: 0xf5e7cd },
    { z: 355, width: 60, depth: 52, height: 31, style: "brick", kind: "brick", tint: 0xffe6d4 },
    { z: 430, width: 62, depth: 54, height: 29, style: "classic", kind: "stonePale", tint: 0xf4ebd7 },
    { z: 505, width: 58, depth: 50, height: 27, style: "dome", kind: "stoneWarm", tint: 0xf3e5cb, copper: true },
    { z: 576, width: 64, depth: 54, height: 33, style: "classic", kind: "stonePale", tint: 0xf7eeda },
  ];

  const columnTransforms = [];
  const treeTransforms = [];

  const washMaterial = new THREE.MeshBasicMaterial({
    map: createWashTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  for (const spec of specs) {
    group.add(
      createBundBuilding(spec, columnTransforms, treeTransforms, washMaterial),
    );
  }

  /* 柱廊：一个 InstancedMesh 完成所有历史建筑立柱 */
  const columnGeometry = new THREE.CylinderGeometry(0.72, 0.86, 1, 12);
  const columnMaterial = stoneMaterial(0xd9ccb4, 0.86);
  const columns = new THREE.InstancedMesh(
    columnGeometry,
    columnMaterial,
    columnTransforms.length,
  );
  const dummy = new THREE.Object3D();
  columnTransforms.forEach((transform, index) => {
    dummy.position.set(transform.x, transform.y, transform.z);
    dummy.scale.set(1, transform.height, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    columns.setMatrixAt(index, dummy.matrix);
  });
  columns.instanceMatrix.needsUpdate = true;
  columns.castShadow = true;
  columns.receiveShadow = true;
  group.add(columns);

  /* 滨江步道与防汛墙 */
  const promenadeTexture = createPavingTexture();
  promenadeTexture.repeat.set(14, 470);
  const promenadeMaterial = new THREE.MeshStandardMaterial({
    map: promenadeTexture,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.02,
  });

  const promenade = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 1600),
    promenadeMaterial,
  );
  promenade.rotation.x = -Math.PI / 2;
  promenade.position.set(-233, PROMENADE_LEVEL, 0);
  promenade.receiveShadow = true;
  group.add(promenade);

  const revetment = new THREE.Mesh(
    new THREE.BoxGeometry(6, 8, 1600),
    stoneMaterial(0x8a8071, 0.92),
  );
  revetment.position.set(
    RIVER.westBank - 1,
    PROMENADE_LEVEL - 4,
    0,
  );
  revetment.receiveShadow = true;
  revetment.castShadow = true;
  group.add(revetment);

  const bankStrip = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.5, 1600),
    stoneMaterial(0xb6aa96, 0.85),
  );
  bankStrip.position.set(RIVER.westBank - 3.4, PROMENADE_LEVEL + 0.1, 0);
  bankStrip.receiveShadow = true;
  group.add(bankStrip);

  // 临江栏杆：立柱阵列 + 两道横杆
  const railingMaterial = metalMaterial(0x3f4448, 0.42, 0.85);
  const postGeometry = new THREE.BoxGeometry(0.12, 1.25, 0.12);
  const postCount = 360;
  const posts = new THREE.InstancedMesh(
    postGeometry,
    railingMaterial,
    postCount,
  );
  for (let i = 0; i < postCount; i++) {
    dummy.position.set(RIVER.westBank - 4.5, PROMENADE_LEVEL + 0.62, -800 + i * 4.45);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);
  }
  posts.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  group.add(posts);

  for (const y of [PROMENADE_LEVEL + 0.55, PROMENADE_LEVEL + 1.18]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 1600),
      railingMaterial,
    );
    rail.position.set(RIVER.westBank - 4.5, y, 0);
    group.add(rail);
  }

  /* 行道树 */
  const treeMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c4430,
    roughness: 0.92,
    metalness: 0.02,
  });
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3729,
    roughness: 0.95,
  });

  const trunkGeometry = new THREE.CylinderGeometry(0.32, 0.5, 5.2, 8);
  const canopyGeometry = new THREE.IcosahedronGeometry(4.6, 1);

  // 合并沿街与步道的树
  const promenadeTrees = [];
  for (let i = 0; i < 34; i++) {
    promenadeTrees.push({ x: -247, z: -760 + i * 46 });
  }
  const allTrees = [...treeTransforms, ...promenadeTrees];

  const trunks = new THREE.InstancedMesh(
    trunkGeometry,
    trunkMaterial,
    allTrees.length,
  );
  const canopies = new THREE.InstancedMesh(
    canopyGeometry,
    treeMaterial,
    allTrees.length,
  );

  allTrees.forEach((tree, index) => {
    const baseY = tree.x > -250 ? PROMENADE_LEVEL : LAND_LEVEL;
    dummy.position.set(tree.x, baseY + 2.6, tree.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, index * 1.7, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);

    const scale = 0.85 + ((index * 37) % 10) / 28;
    dummy.position.set(tree.x, baseY + 8.2, tree.z);
    dummy.scale.set(scale, scale * 1.1, scale);
    dummy.rotation.set(0, index * 2.1, 0);
    dummy.updateMatrix();
    canopies.setMatrixAt(index, dummy.matrix);
  });

  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  trunks.castShadow = true;
  canopies.castShadow = true;
  group.add(trunks, canopies);

  /* 步道路灯 */
  const lampMaterial = emissiveMaterial(0xffe2ac, {
    type: "lamp",
    base: 1.6,
    baseColor: 0x2a2418,
    roughness: 0.55,
  });
  const lampPostMaterial = metalMaterial(0x2f3438, 0.5, 0.8);

  const lampPostGeometry = new THREE.CylinderGeometry(0.1, 0.16, 6.6, 8);
  const lampHeadGeometry = new THREE.SphereGeometry(0.55, 12, 10);
  const lampCount = 38;
  const lampPosts = new THREE.InstancedMesh(
    lampPostGeometry,
    lampPostMaterial,
    lampCount,
  );
  const lampHeads = new THREE.InstancedMesh(
    lampHeadGeometry,
    lampMaterial,
    lampCount,
  );

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
  const glowGeometry = new THREE.PlaneGeometry(18, 18);
  const glows = new THREE.InstancedMesh(
    glowGeometry,
    glowMaterial,
    lampCount,
  );

  for (let i = 0; i < lampCount; i++) {
    const z = -740 + i * 40;
    const x = RIVER.westBank - 8;

    dummy.position.set(x, PROMENADE_LEVEL + 3.3, z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    lampPosts.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, PROMENADE_LEVEL + 6.7, z);
    dummy.updateMatrix();
    lampHeads.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, PROMENADE_LEVEL + 0.08, z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.updateMatrix();
    glows.setMatrixAt(i, dummy.matrix);
    dummy.rotation.set(0, 0, 0);
  }

  lampPosts.instanceMatrix.needsUpdate = true;
  lampHeads.instanceMatrix.needsUpdate = true;
  glows.instanceMatrix.needsUpdate = true;
  lampPosts.castShadow = true;
  group.add(lampPosts, lampHeads, glows);

  scene.add(group);

  return {
    group,
    glowMaterial,
    washMaterial,
    update(elapsed, state) {
      glowMaterial.opacity = Math.min(0.5, state.lampIntensity * 0.24);
      washMaterial.opacity = Math.min(0.5, state.lampIntensity * 0.3);
    },
  };
}
