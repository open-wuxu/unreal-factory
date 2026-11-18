import * as THREE from "three";
import { LAYOUT, WORLD } from "../config.js";
import { createGlowTexture, createWoodTexture, seededRandom } from "../utils/textures.js";
import {
  emissiveMaterial,
  lanternPaperMaterial,
  woodMaterial,
} from "./materials.js";

/**
 * 唐代木质客船。
 *
 * 船体用逐站截面放样（放样线沿船长），带真实的舷弧、收窄的船首
 * 与方形船尾；甲板上是可从窗口看见诗人的木舱、竹篷、桅杆与缆绳。
 * 船体随水流轻微横摇、升沉，船头灯笼与舱内灯火各自摇曳。
 */

const LENGTH = 12.4;
const BEAM = 3.5;
const DECK_Y = 0.56;

function hullProfile(t) {
  // t: 0 = 船首, 1 = 船尾
  const bow = 1 - Math.min(1, t / 0.28);
  const stern = Math.max(0, (t - 0.78) / 0.22);
  const beam =
    BEAM *
    (0.13 + 0.87 * Math.pow(Math.min(1, t / 0.34), 0.55)) *
    (1 - 0.24 * stern * stern);
  const bottom =
    -0.62 +
    0.74 * Math.pow(bow, 1.5) +
    0.42 * Math.pow(stern, 1.7);
  const top =
    0.72 +
    0.62 * Math.pow(bow, 1.25) +
    0.24 * Math.pow(stern, 1.4);
  return { beam, bottom, top };
}

function createHullGeometry() {
  const stations = 36;
  const across = 10;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= stations; i++) {
    const t = i / stations;
    const x = -LENGTH / 2 + t * LENGTH;
    const { beam, bottom, top } = hullProfile(t);

    for (let j = 0; j <= across; j++) {
      const s = j / across;
      const a = (s - 0.5) * Math.PI;
      const z = Math.sin(a) * beam;
      const rise = Math.pow(0.5 - 0.5 * Math.cos(a), 0.82);
      const y = bottom + (top - bottom) * rise;
      positions.push(x, y, z);
      uvs.push(t * 5.5, s * 1.1);
    }
  }

  for (let i = 0; i < stations; i++) {
    const row = i * (across + 1);
    const next = (i + 1) * (across + 1);
    for (let j = 0; j < across; j++) {
      const a = row + j;
      const b = row + j + 1;
      const c = next + j;
      const d = next + j + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createDeckGeometry() {
  const stations = 28;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= stations; i++) {
    const t = i / stations;
    const x = -LENGTH / 2 + 0.55 + t * (LENGTH - 1.1);
    const { beam } = hullProfile((x + LENGTH / 2) / LENGTH);
    const width = beam * 0.9;
    const y = DECK_Y + Math.sin(t * Math.PI) * 0.035;
    positions.push(x, y, -width);
    positions.push(x, y, width);
    uvs.push(t * 6, 0, t * 6, 1);
    if (i < stations) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createBarrelRoof({ xStart, xEnd, radius, height, material }) {
  const stations = 18;
  const across = 14;
  const positions = [];
  const uvs = [];
  const indices = [];
  const baseY = DECK_Y + 1.42;

  for (let i = 0; i <= stations; i++) {
    const t = i / stations;
    const x = xStart + t * (xEnd - xStart);
    for (let j = 0; j <= across; j++) {
      const a = (j / across) * Math.PI;
      const z = Math.cos(a) * radius;
      const y = baseY + Math.sin(a) * height;
      positions.push(x, y, z);
      uvs.push(t * 4, j / across);
    }
  }

  for (let i = 0; i < stations; i++) {
    const row = i * (across + 1);
    const next = (i + 1) * (across + 1);
    for (let j = 0; j < across; j++) {
      const a = row + j;
      const b = row + j + 1;
      const c = next + j;
      const d = next + j + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createCabin(wood, darkWood, lanternLightColor) {
  const group = new THREE.Group();
  const cabin = {
    xMin: -1.35,
    xMax: 3.9,
    halfWidth: 1.22,
    height: 1.42,
  };
  const deck = DECK_Y;

  const wallThickness = 0.08;
  const wallMaterial = wood;

  // 舱底与舱顶横梁
  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(cabin.xMax - cabin.xMin, 0.16, cabin.halfWidth * 2 + 0.14),
    darkWood,
  );
  sill.position.set((cabin.xMin + cabin.xMax) / 2, deck + 0.08, 0);
  group.add(sill);

  // 远端舱壁（暖光打在其上，衬出诗人剪影）
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, cabin.height, cabin.halfWidth * 2),
    wallMaterial,
  );
  backWall.position.set(cabin.xMax, deck + cabin.height / 2, 0);
  backWall.castShadow = true;
  group.add(backWall);

  // 前端舱壁，留一个门洞
  const frontLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, cabin.height, 0.7),
    wallMaterial,
  );
  frontLeft.position.set(cabin.xMin, deck + cabin.height / 2, -cabin.halfWidth + 0.35);
  group.add(frontLeft);
  const frontRight = frontLeft.clone();
  frontRight.position.z = cabin.halfWidth - 0.35;
  group.add(frontRight);
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.34, cabin.halfWidth * 2 - 1.4),
    wallMaterial,
  );
  lintel.position.set(cabin.xMin, deck + cabin.height - 0.17, 0);
  group.add(lintel);

  // 靠窗一侧（+Z）：窗框 + 细木格
  const windowBottom = deck + 0.34;
  const windowTop = deck + cabin.height - 0.2;
  const windowHalf = 0.9;

  const sideLower = new THREE.Mesh(
    new THREE.BoxGeometry(cabin.xMax - cabin.xMin, 0.34, 0.08),
    wallMaterial,
  );
  sideLower.position.set((cabin.xMin + cabin.xMax) / 2, deck + 0.17, cabin.halfWidth);
  group.add(sideLower);

  const sideUpper = new THREE.Mesh(
    new THREE.BoxGeometry(cabin.xMax - cabin.xMin, 0.18, 0.08),
    wallMaterial,
  );
  sideUpper.position.set(
    (cabin.xMin + cabin.xMax) / 2,
    deck + cabin.height - 0.09,
    cabin.halfWidth,
  );
  group.add(sideUpper);

  for (const x of [cabin.xMin, cabin.xMax]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, windowTop - windowBottom, 0.12),
      wallMaterial,
    );
    post.position.set(x, (windowTop + windowBottom) / 2, cabin.halfWidth);
    group.add(post);
  }

  // 窗格
  const latticeMaterial = darkWood;
  for (let i = 1; i <= 3; i++) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, windowTop - windowBottom, 0.03),
      latticeMaterial,
    );
    bar.position.set(
      cabin.xMin + ((cabin.xMax - cabin.xMin) * i) / 4,
      (windowTop + windowBottom) / 2,
      cabin.halfWidth,
    );
    group.add(bar);
  }
  for (let i = 0; i < 2; i++) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(cabin.xMax - cabin.xMin, 0.03, 0.03),
      latticeMaterial,
    );
    bar.position.set(
      (cabin.xMin + cabin.xMax) / 2,
      windowBottom + (windowTop - windowBottom) * (0.34 + i * 0.33),
      cabin.halfWidth,
    );
    group.add(bar);
  }

  // 另一侧与船尾侧的木板墙
  const farSide = new THREE.Mesh(
    new THREE.BoxGeometry(cabin.xMax - cabin.xMin, cabin.height, 0.08),
    wallMaterial,
  );
  farSide.position.set((cabin.xMin + cabin.xMax) / 2, deck + cabin.height / 2, -cabin.halfWidth);
  group.add(farSide);

  // 舱内地板
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(cabin.xMax - cabin.xMin - 0.16, 0.08, cabin.halfWidth * 2 - 0.16),
    darkWood,
  );
  floor.position.set((cabin.xMin + cabin.xMax) / 2, deck + 0.06, 0);
  group.add(floor);

  // 舱内暖光：不投影，只负责把木壁与诗人剪影托出来
  const innerLight = new THREE.PointLight(lanternLightColor, 8.0, 11, 2);
  innerLight.position.set(0.4, deck + 1.15, -0.35);
  group.add(innerLight);

  // 远端舱壁上的暖色反光，让窗口里的剪影有一层柔和的底
  const glowPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.1),
    new THREE.MeshBasicMaterial({
      color: 0xff7f36,
      transparent: true,
      opacity: 0.34,
      toneMapped: true,
    }),
  );
  glowPanel.position.set(1.8, deck + 0.92, -cabin.halfWidth + 0.06);
  group.add(glowPanel);

  // 窗边的一点点暖色补光，让诗人的肩线与窗棂不至于完全沉进黑色
  const windowFill = new THREE.PointLight(0xffa050, 1.8, 3.6, 2);
  windowFill.position.set(1.8, deck + 1.05, 0.92);
  group.add(windowFill);

  return { group, cabin, innerLight };
}

function createPoet() {
  const group = new THREE.Group();
  const robe = new THREE.MeshStandardMaterial({
    color: 0x0c0906,
    emissive: 0x241006,
    emissiveIntensity: 0.42,
    roughness: 1,
    metalness: 0,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: 0x0e0a07,
    emissive: 0x2a140a,
    emissiveIntensity: 0.32,
    roughness: 1,
    metalness: 0,
  });

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.34, 0.92, 10),
    robe,
  );
  body.position.y = 0.46;
  group.add(body);

  const shoulder = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 8),
    robe,
  );
  shoulder.scale.set(1, 0.62, 1);
  shoulder.position.y = 0.9;
  group.add(shoulder);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), skin);
  head.position.y = 1.12;
  head.scale.set(0.94, 1.03, 0.92);
  group.add(head);

  // 幞头
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.24), robe);
  hat.position.y = 1.26;
  group.add(hat);

  // 交叠的双臂
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.095, 0.62, 8),
    robe,
  );
  arm.rotation.z = 1.16;
  arm.position.set(0.12, 0.68, 0.12);
  group.add(arm);
  const arm2 = arm.clone();
  arm2.rotation.z = -1.16;
  arm2.position.set(-0.12, 0.68, 0.12);
  group.add(arm2);

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return group;
}

function createLantern() {
  const group = new THREE.Group();
  const paper = lanternPaperMaterial(0xff9a45);
  paper.opacity = 0.85;

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), paper);
  body.scale.set(1, 1.25, 1);
  group.add(body);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.13, 0.06, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a1b12, roughness: 0.8 }),
  );
  cap.position.y = 0.36;
  group.add(cap);
  const bottom = cap.clone();
  bottom.position.y = -0.36;
  group.add(bottom);

  // 灯穗
  const tassel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.02, 0.34, 5),
    new THREE.MeshStandardMaterial({ color: 0x5a2c1e, roughness: 1 }),
  );
  tassel.position.y = -0.56;
  group.add(tassel);

  const glowTexture = createGlowTexture({ size: 256, power: 2.2 });
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xff9440,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: true,
    }),
  );
  glow.scale.setScalar(2.3);
  group.add(glow);

  return { group, glow, paper };
}

export function createBoat() {
  const group = new THREE.Group();
  group.name = "PoetBoat";
  group.position.set(LAYOUT.boat.x, WORLD.waterLevel, LAYOUT.boat.z);
  group.rotation.y = LAYOUT.boat.heading;

  const rand = seededRandom(307);

  const hullMaterial = woodMaterial(0xb08660, {
    map: "wood",
    repeat: [3.4, 1.2],
  });
  hullMaterial.side = THREE.DoubleSide;

  const darkWood = new THREE.MeshStandardMaterial({
    color: 0x332318,
    roughness: 0.86,
    metalness: 0.03,
    envMapIntensity: 0.4,
  });
  const cabinWood = woodMaterial(0xc09468, {
    map: "woodFine",
    repeat: [2.2, 1.2],
  });
  const bamboo = woodMaterial(0xb89a70, {
    map: "woodFine",
    repeat: [5, 1.4],
  });
  bamboo.side = THREE.DoubleSide;

  const hull = new THREE.Mesh(createHullGeometry(), hullMaterial);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  const deck = new THREE.Mesh(createDeckGeometry(), hullMaterial);
  deck.receiveShadow = true;
  group.add(deck);

  // 舷缘
  for (const side of [-1, 1]) {
    const rimPoints = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const x = -LENGTH / 2 + t * LENGTH;
      const { beam, top } = hullProfile(t);
      rimPoints.push(new THREE.Vector3(x, top + 0.03, side * beam));
    }
    const curve = new THREE.CatmullRomCurve3(rimPoints);
    const rim = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 48, 0.085, 7, false),
      darkWood,
    );
    rim.castShadow = true;
    group.add(rim);
  }

  // 船尾横板
  const transomProfile = hullProfile(1);
  const transom = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, transomProfile.top - transomProfile.bottom + 0.1, transomProfile.beam * 2),
    hullMaterial,
  );
  transom.position.set(LENGTH / 2 - 0.08, (transomProfile.top + transomProfile.bottom) / 2, 0);
  group.add(transom);

  // 甲板木板阴影线
  const plankLineMaterial = new THREE.MeshBasicMaterial({
    color: 0x0a0705,
    transparent: true,
    opacity: 0.55,
  });
  for (let i = -4; i <= 4; i++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(LENGTH - 1.6, 0.015, 0.035),
      plankLineMaterial,
    );
    line.position.set(0, DECK_Y + 0.045, i * 0.28);
    group.add(line);
  }

  const { group: cabinGroup, cabin, innerLight } = createCabin(
    cabinWood,
    darkWood,
    0xffa85c,
  );
  group.add(cabinGroup);

  const poet = createPoet();
  poet.position.set(1.72, DECK_Y - 0.06, 0.62);
  poet.scale.setScalar(1.06);
  poet.rotation.y = 0.12;
  group.add(poet);

  // 竹篷：覆盖船尾
  const canopy = createBarrelRoof({
    xStart: 3.6,
    xEnd: 5.85,
    radius: 1.12,
    height: 0.86,
    material: bamboo,
  });
  group.add(canopy);

  // 竹篷的横向骨架
  const ribMaterial = darkWood;
  for (let i = 0; i < 5; i++) {
    const x = 3.7 + i * 0.52;
    const curve = new THREE.EllipseCurve(0, 0, 1.12, 0.86, 0, Math.PI, false);
    const points = curve.getPoints(18).map(
      (p) => new THREE.Vector3(x, DECK_Y + 1.42 + p.y, p.x),
    );
    const rib = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.035, 5, false),
      ribMaterial,
    );
    group.add(rib);
  }

  // 主舱的弧形顶
  const cabinRoof = createBarrelRoof({
    xStart: -1.55,
    xEnd: 4.05,
    radius: 1.46,
    height: 0.72,
    material: bamboo,
  });
  group.add(cabinRoof);

  for (let i = 0; i < 8; i++) {
    const x = -1.45 + i * 0.72;
    const curve = new THREE.EllipseCurve(0, 0, 1.46, 0.72, 0, Math.PI, false);
    const points = curve.getPoints(20).map(
      (p) => new THREE.Vector3(x, DECK_Y + 1.42 + p.y, p.x),
    );
    const rib = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 26, 0.032, 5, false),
      ribMaterial,
    );
    group.add(rib);
  }

  // 桅杆与收起的帆
  const mastMaterial = darkWood;
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.085, 3.4, 8),
    mastMaterial,
  );
  mast.position.set(-2.15, DECK_Y + 1.7, 0);
  mast.castShadow = true;
  group.add(mast);

  const furled = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.12, 2.1, 9),
    bamboo,
  );
  furled.position.set(-2.15, DECK_Y + 2.25, 0.02);
  furled.castShadow = true;
  group.add(furled);

  // 简单的缆绳：桅顶到船首、船尾
  const ropeMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3022,
    roughness: 1,
    metalness: 0,
  });
  const rig = (a, b) => {
    const direction = new THREE.Vector3().subVectors(b, a);
    const length = direction.length();
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, length, 4),
      ropeMaterial,
    );
    mesh.position.copy(a).addScaledVector(direction, 0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
    group.add(mesh);
  };
  rig(
    new THREE.Vector3(-2.15, DECK_Y + 3.35, 0),
    new THREE.Vector3(-5.6, DECK_Y + 1.15, 0),
  );
  rig(
    new THREE.Vector3(-2.15, DECK_Y + 3.35, 0),
    new THREE.Vector3(3.7, DECK_Y + 1.8, 0),
  );
  rig(
    new THREE.Vector3(-2.15, DECK_Y + 3.35, 0),
    new THREE.Vector3(-2.15, DECK_Y + 0.6, -BEAM * 0.8),
  );

  // 船首灯杆与灯笼
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, 1.7, 7),
    mastMaterial,
  );
  pole.position.set(-4.55, DECK_Y + 0.85, 0.55);
  pole.rotation.z = -0.18;
  group.add(pole);
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.85, 7),
    mastMaterial,
  );
  arm.position.set(-4.15, DECK_Y + 1.6, 0.86);
  arm.rotation.x = 1.1;
  group.add(arm);

  const lantern = createLantern();
  lantern.group.position.set(-4.15, DECK_Y + 1.3, 1.24);
  group.add(lantern.group);

  const bowLight = new THREE.PointLight(0xff9a4a, 9.0, 20, 2);
  bowLight.position.copy(lantern.group.position);
  group.add(bowLight);

  // 从船首到岸上系船桩的缆绳（世界坐标，静态）
  const worldBow = new THREE.Vector3(-LENGTH / 2 + 0.7, DECK_Y + 0.55, 0.4);
  group.updateMatrixWorld(true);
  const bowWorld = worldBow.clone().applyMatrix4(group.matrixWorld);
  const post = new THREE.Vector3(
    LAYOUT.mooringPost.x,
    WORLD.landLevel + 1.3,
    LAYOUT.mooringPost.z,
  );
  const mid = bowWorld.clone().lerp(post, 0.5);
  mid.y -= 0.55;
  const mooringCurve = new THREE.CatmullRomCurve3([bowWorld, mid, post]);
  const mooring = new THREE.Mesh(
    new THREE.TubeGeometry(mooringCurve, 40, 0.022, 5, false),
    ropeMaterial,
  );
  mooring.castShadow = true;

  const sway = {
    phase: rand() * Math.PI * 2,
    lanternPhase: rand() * Math.PI * 2,
  };
  const basePosition = group.position.clone();

  const worldLantern = lantern.group.position.clone();
  worldLantern.applyMatrix4(group.matrixWorld);

  return {
    group,
    hull,
    poet,
    lantern,
    lanternLight: bowLight,
    innerLight,
    mooring,
    worldLantern,
    update(delta, elapsed) {
      const t = elapsed;
      group.position.y =
        basePosition.y +
        Math.sin(t * 0.52 + sway.phase) * 0.045 +
        Math.sin(t * 1.13 + sway.phase * 1.7) * 0.012;
      group.rotation.z =
        Math.sin(t * 0.47 + sway.phase) * 0.012 +
        Math.sin(t * 1.02 + sway.phase * 0.7) * 0.004;
      group.rotation.x =
        Math.sin(t * 0.39 + sway.phase * 1.3) * 0.008;
      group.rotation.y =
        LAYOUT.boat.heading + Math.sin(t * 0.23 + sway.phase) * 0.006;

      const flicker =
        0.82 +
        0.1 * Math.sin(t * 6.7 + sway.lanternPhase) +
        0.08 * Math.sin(t * 13.1 + sway.lanternPhase * 2.3);
      bowLight.intensity = 9.0 * flicker;
      lantern.glow.material.opacity = 0.3 + 0.12 * flicker;
      innerLight.intensity = 7.4 + Math.sin(t * 2.1) * 0.4;

      // 灯笼世界坐标供水面 shader 使用
      worldLantern.copy(lantern.group.position);
      worldLantern.applyMatrix4(group.matrixWorld);
    },
  };
}
