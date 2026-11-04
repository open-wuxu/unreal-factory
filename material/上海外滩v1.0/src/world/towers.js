import * as THREE from "three";
import { TOWER_POS } from "../config.js";
import { seededRandom, scaleUVs } from "../utils/textures.js";
import {
  cylinderBetween,
  emissiveMaterial,
  facadeMaterial,
  glassMaterial,
  metalMaterial,
  stoneMaterial,
} from "./materials.js";

/* ------------------------------------------------------------------ */
/* 公共小工具                                                          */
/* ------------------------------------------------------------------ */

function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** 把顶点位置向顶部收分，做出塔楼向上收窄的轮廓。 */
function taperBox(geometry, height, topScale) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const t = THREE.MathUtils.clamp((y + height / 2) / height, 0, 1);
    const scale = 1 + (topScale - 1) * t;
    position.setX(i, position.getX(i) * scale);
    position.setZ(i, position.getZ(i) * scale);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** 把 XY 平面投影成 UV，用于 ExtrudeGeometry。 */
function projectUVs(geometry, width, height, uRepeat, vRepeat) {
  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = (position.getX(i) / width + 0.5) * uRepeat;
    uv[i * 2 + 1] = (position.getY(i) / height) * vRepeat;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}

/* ------------------------------------------------------------------ */
/* 东方明珠                                                            */
/* ------------------------------------------------------------------ */

function createOrientalPearl() {
  const group = new THREE.Group();
  group.name = "OrientalPearl";

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xc2558f,
    metalness: 0.78,
    roughness: 0.26,
    emissive: 0xff2f86,
    emissiveIntensity: 0,
    envMapIntensity: 1.25,
  });

  const darkMetal = metalMaterial(0x2c2d35, 0.45, 0.85);
  const concrete = stoneMaterial(0x8d8d92, 0.86);

  const pinkNeon = emissiveMaterial(0xff5fa8, {
    type: "neon",
    base: 1.05,
    baseColor: 0x1a0a12,
    roughness: 0.3,
    metalness: 0.3,
  });

  const stripNeon = emissiveMaterial(0xff8ac6, {
    type: "neon",
    base: 0.8,
    baseColor: 0x140910,
    roughness: 0.35,
  });

  // 底座与裙房
  const podium = shadowed(
    new THREE.Mesh(new THREE.CylinderGeometry(56, 62, 12, 40), concrete),
  );
  podium.position.y = 6;
  group.add(podium);

  const podiumRing = new THREE.Mesh(
    new THREE.TorusGeometry(56, 1.1, 8, 64),
    stripNeon,
  );
  podiumRing.rotation.x = -Math.PI / 2;
  podiumRing.position.y = 12.2;
  group.add(podiumRing);

  const annex = shadowed(
    new THREE.Mesh(new THREE.BoxGeometry(54, 26, 92), concrete),
  );
  annex.position.set(34, 15, 26);
  group.add(annex);

  const annexGlass = new THREE.Mesh(
    new THREE.BoxGeometry(54.5, 12, 92.5),
    facadeMaterial("glassDark", {
      tint: 0x9fb7cc,
      metalness: 0.35,
      roughness: 0.38,
      emissiveBase: 0.7,
    }),
  );
  annexGlass.position.set(34, 19, 26);
  annexGlass.castShadow = true;
  group.add(annexGlass);

  // 三根主立柱
  const columnRadius = 17;
  const columnTop = 368;
  const columnPositions = [];
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(angle) * columnRadius;
    const z = Math.sin(angle) * columnRadius;
    columnPositions.push(new THREE.Vector3(x, 0, z));

    const column = shadowed(
      new THREE.Mesh(
        new THREE.CylinderGeometry(4.6, 6.4, columnTop, 20, 8),
        bodyMaterial,
      ),
    );
    column.position.set(x, columnTop / 2, z);
    group.add(column);

    // 立柱外侧的竖向灯带
    const stripAngle = angle;
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 320, 0.9),
      stripNeon,
    );
    strip.position.set(
      x + Math.cos(stripAngle) * 4.7,
      190,
      z + Math.sin(stripAngle) * 4.7,
    );
    group.add(strip);

    // 柱身中部的小球节点
    const node = shadowed(
      new THREE.Mesh(new THREE.SphereGeometry(7.2, 20, 16), bodyMaterial),
    );
    node.position.set(x, 196, z);
    group.add(node);
  }

  // 斜撑：三根立柱之间交错拉结
  const braceMaterial = darkMetal;
  for (let i = 0; i < 3; i++) {
    const a = columnPositions[i];
    const b = columnPositions[(i + 1) % 3];
    const rise = 70;
    for (let level = 0; level < 3; level++) {
      const y0 = 40 + level * 90;
      const start = new THREE.Vector3(a.x, y0, a.z);
      const end = new THREE.Vector3(b.x, y0 + rise, b.z);
      group.add(
        shadowed(cylinderBetween(start, end, 1.15, braceMaterial, 8)),
      );
      const startBack = new THREE.Vector3(b.x, y0, b.z);
      const endBack = new THREE.Vector3(a.x, y0 + rise, a.z);
      group.add(
        shadowed(cylinderBetween(startBack, endBack, 1.15, braceMaterial, 8)),
      );
    }
  }

  // 三个球体
  const spheres = [
    { y: 98, radius: 30, segments: 48 },
    { y: 266, radius: 26, segments: 44 },
    { y: 352, radius: 10, segments: 28 },
  ];

  spheres.forEach(({ y, radius, segments }) => {
    const sphere = shadowed(
      new THREE.Mesh(
        new THREE.SphereGeometry(radius, segments, Math.round(segments * 0.7)),
        bodyMaterial,
      ),
    );
    sphere.position.y = y;
    group.add(sphere);

    // 球体上的发光环带
    const latitudes = radius > 15 ? [-42, -14, 14, 42] : [-30, 0, 30];
    for (const latitude of latitudes) {
      const rad = THREE.MathUtils.degToRad(latitude);
      const ringRadius = Math.cos(rad) * radius * 1.012;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(ringRadius, 0.4, 8, 72),
        pinkNeon,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y + Math.sin(rad) * radius;
      group.add(ring);
    }
  });

  // 天线
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 1.9, 108, 10),
    bodyMaterial,
  );
  antenna.position.y = 414;
  antenna.castShadow = true;
  group.add(antenna);

  const antennaRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.5, 0.45, 6, 24),
    pinkNeon,
  );
  antennaRing.rotation.x = Math.PI / 2;
  antennaRing.position.y = 376;
  group.add(antennaRing);

  // 航空障碍灯
  const beaconMaterial = new THREE.MeshStandardMaterial({
    color: 0x220505,
    emissive: 0xff2a2a,
    emissiveIntensity: 2,
    roughness: 0.5,
  });
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 12, 10),
    beaconMaterial,
  );
  beacon.position.y = 468;
  group.add(beacon);

  return {
    group,
    bodyMaterial,
    pinkNeon,
    beaconMaterial,
    update(elapsed, state) {
      // 塔身颜色缓慢流转：粉 → 紫 → 青
      const hue = 0.9 - 0.16 * (0.5 + 0.5 * Math.sin(elapsed * 0.12));
      bodyMaterial.emissive.setHSL(hue, 0.72, 0.52);
      const pulse = 0.72 + 0.28 * Math.sin(elapsed * 0.9);
      bodyMaterial.emissiveIntensity = state.neonIntensity * 0.4 * pulse;
      pinkNeon.emissive.setHSL((hue + 0.04) % 1, 0.68, 0.64);
      beaconMaterial.emissiveIntensity =
        state.neonIntensity * (Math.sin(elapsed * 2.4) > 0.55 ? 3.2 : 0.25);
    },
  };
}

/* ------------------------------------------------------------------ */
/* 上海中心大厦                                                        */
/* ------------------------------------------------------------------ */

function roundedTriangleRadius(theta, R) {
  const centers = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  const orbit = R * 0.44;
  const circle = R * 0.62;
  let maxRadius = 0;
  for (const phi of centers) {
    const delta = theta - phi;
    const sin = orbit * Math.sin(delta);
    if (Math.abs(sin) > circle) continue;
    const radius =
      orbit * Math.cos(delta) + Math.sqrt(circle * circle - sin * sin);
    if (radius > maxRadius) maxRadius = radius;
  }
  return maxRadius;
}

function createShanghaiTower() {
  const group = new THREE.Group();
  group.name = "ShanghaiTower";

  const HEIGHT = 632;
  const BASE_RADIUS = 46;
  const RINGS = 108;
  const SEGMENTS = 120;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= RINGS; i++) {
    const v = i / RINGS;
    const y = v * HEIGHT;

    // 底部略收，中段最饱满，顶部收至约 60%
    const profile =
      0.97 + 0.05 * Math.sin(v * Math.PI) - 0.37 * Math.pow(smoothstep(0.12, 1, v), 1.35);
    const twist = v * ((Math.PI * 2) / 3);

    for (let j = 0; j <= SEGMENTS; j++) {
      const localTheta = (j / SEGMENTS) * Math.PI * 2;
      const radius = roundedTriangleRadius(localTheta, BASE_RADIUS) * profile;
      const worldTheta = localTheta + twist;
      positions.push(
        Math.cos(worldTheta) * radius,
        y,
        Math.sin(worldTheta) * radius,
      );
      uvs.push((j / SEGMENTS) * 3, v * 6);
    }
  }

  const stride = SEGMENTS + 1;
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
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

  const material = facadeMaterial("glassBlue", {
    tint: 0xc3e2ff,
    metalness: 0.15,
    roughness: 0.2,
    envMapIntensity: 1.2,
    emissiveBase: 0.85,
  });

  const tower = shadowed(new THREE.Mesh(geometry, material));
  group.add(tower);

  // 冠部发光环：沿顶部截面的闭合光带
  const crownPoints = [];
  const topV = 1;
  const topProfile =
    0.97 + 0.05 * Math.sin(topV * Math.PI) - 0.37 * Math.pow(smoothstep(0.12, 1, topV), 1.35);
  const topTwist = topV * ((Math.PI * 2) / 3);
  for (let j = 0; j < SEGMENTS; j++) {
    const theta = (j / SEGMENTS) * Math.PI * 2;
    const radius = roundedTriangleRadius(theta, BASE_RADIUS) * topProfile * 1.004;
    crownPoints.push(
      new THREE.Vector3(
        Math.cos(theta + topTwist) * radius,
        HEIGHT - 3,
        Math.sin(theta + topTwist) * radius,
      ),
    );
  }
  const crownCurve = new THREE.CatmullRomCurve3(crownPoints, true);
  const crownMaterial = emissiveMaterial(0x9fe6ff, {
    type: "neon",
    base: 1.8,
    baseColor: 0x061018,
    roughness: 0.2,
  });
  const crown = new THREE.Mesh(
    new THREE.TubeGeometry(crownCurve, 200, 1.1, 6, true),
    crownMaterial,
  );
  group.add(crown);

  const crownGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(
      BASE_RADIUS * topProfile * 0.78,
      BASE_RADIUS * topProfile * 0.9,
      14,
      48,
      1,
      true,
    ),
    glassMaterial(0x5f7f96, {
      roughness: 0.42,
      metalness: 0.25,
      envMapIntensity: 0.55,
    }),
  );
  crownGlass.position.y = HEIGHT + 5;
  group.add(crownGlass);

  // 三条螺旋灯缝
  const seamMaterial = emissiveMaterial(0xc3f0ff, {
    type: "neon",
    base: 0.34,
    baseColor: 0x040c12,
    roughness: 0.25,
  });

  for (let s = 0; s < 3; s++) {
    const thetaBase = (s / 3) * Math.PI * 2;
    const points = [];
    for (let i = 0; i <= 90; i++) {
      const v = i / 90;
      const profile =
        0.97 + 0.05 * Math.sin(v * Math.PI) - 0.37 * Math.pow(smoothstep(0.12, 1, v), 1.35);
      const radius =
        roundedTriangleRadius(thetaBase, BASE_RADIUS) * profile * 1.006;
      const theta = thetaBase + v * ((Math.PI * 2) / 3);
      points.push(
        new THREE.Vector3(
          Math.cos(theta) * radius,
          v * HEIGHT,
          Math.sin(theta) * radius,
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const seam = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 180, 0.62, 5, false),
      seamMaterial,
    );
    group.add(seam);
  }

  const beaconMaterial = new THREE.MeshStandardMaterial({
    color: 0x220505,
    emissive: 0xff2a2a,
    emissiveIntensity: 2,
    roughness: 0.5,
  });
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(2, 12, 10),
    beaconMaterial,
  );
  beacon.position.y = HEIGHT + 16;
  group.add(beacon);

  return {
    group,
    crownMaterial,
    beaconMaterial,
    update(elapsed, state) {
      const pulse = 0.78 + 0.22 * Math.sin(elapsed * 0.7 + 1.2);
      crownMaterial.emissiveIntensity = state.neonIntensity * 1.5 * pulse;
      beaconMaterial.emissiveIntensity =
        state.neonIntensity *
        (Math.sin(elapsed * 2.0 + 1.7) > 0.55 ? 3.2 : 0.25);
    },
  };
}

/* ------------------------------------------------------------------ */
/* 环球金融中心（“开瓶器”）                                            */
/* ------------------------------------------------------------------ */

function createSWFC() {
  const group = new THREE.Group();
  group.name = "SWFC";

  const BODY_HEIGHT = 390;
  const TOTAL_HEIGHT = 492;
  const BODY_WIDTH = 100;
  const BODY_DEPTH = 64;

  const material = facadeMaterial("glassBlue", {
    tint: 0xbcd8ef,
    metalness: 0.15,
    roughness: 0.3,
    envMapIntensity: 1.2,
    emissiveBase: 0.85,
  });

  // 主塔身
  const bodyGeometry = new THREE.BoxGeometry(
    BODY_WIDTH,
    BODY_HEIGHT,
    BODY_DEPTH,
    1,
    6,
    1,
  );
  taperBox(bodyGeometry, BODY_HEIGHT, 0.93);
  scaleUVs(bodyGeometry, 2.2, 2.6);
  const body = shadowed(new THREE.Mesh(bodyGeometry, material));
  body.position.y = BODY_HEIGHT / 2;
  group.add(body);

  const bodyBase = shadowed(
    new THREE.Mesh(
      new THREE.BoxGeometry(BODY_WIDTH + 6, 10, BODY_DEPTH + 6),
      stoneMaterial(0x7d7c79, 0.9),
    ),
  );
  bodyBase.position.y = 5;
  group.add(bodyBase);

  // 顶部“开瓶器”U 形轮廓
  const shape = new THREE.Shape();
  shape.moveTo(-46.5, 0);
  shape.lineTo(46.5, 0);
  shape.lineTo(44, 100);
  shape.lineTo(24, 100);
  shape.lineTo(16.5, 28);
  shape.lineTo(-16.5, 28);
  shape.lineTo(-24, 100);
  shape.lineTo(-44, 100);
  shape.closePath();

  const crownGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: BODY_DEPTH - 2,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 1,
  });
  projectUVs(crownGeometry, BODY_WIDTH, TOTAL_HEIGHT, 2.2, 3.0);
  crownGeometry.translate(0, BODY_HEIGHT, -(BODY_DEPTH - 2) / 2);
  const crown = shadowed(new THREE.Mesh(crownGeometry, material));
  group.add(crown);

  // 开口边缘的冷光灯带
  const edgeMaterial = emissiveMaterial(0xcfe9ff, {
    type: "neon",
    base: 1.25,
    baseColor: 0x061018,
    roughness: 0.25,
  });

  for (const side of [-1, 1]) {
    for (const z of [-(BODY_DEPTH - 1) / 2, (BODY_DEPTH - 1) / 2]) {
      const start = new THREE.Vector3(
        side * 16.5,
        BODY_HEIGHT + 28,
        z,
      );
      const end = new THREE.Vector3(side * 24, BODY_HEIGHT + 100, z);
      group.add(cylinderBetween(start, end, 0.55, edgeMaterial, 6));
    }
    // 开口顶部的横向灯带
    const capStart = new THREE.Vector3(side * 24, BODY_HEIGHT + 100, -31);
    const capEnd = new THREE.Vector3(side * 24, BODY_HEIGHT + 100, 31);
    group.add(cylinderBetween(capStart, capEnd, 0.55, edgeMaterial, 6));
  }

  // 顶部航空灯
  const beaconMaterial = new THREE.MeshStandardMaterial({
    color: 0x220505,
    emissive: 0xff2a2a,
    emissiveIntensity: 2,
    roughness: 0.5,
  });
  for (const x of [-34, 34]) {
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 12, 10),
      beaconMaterial,
    );
    beacon.position.set(x, TOTAL_HEIGHT + 4, 0);
    group.add(beacon);
  }

  return {
    group,
    material,
    beaconMaterial,
    update(elapsed, state) {
      beaconMaterial.emissiveIntensity =
        state.neonIntensity *
        (Math.sin(elapsed * 2.2 + 3.1) > 0.55 ? 3.2 : 0.25);
    },
  };
}

/* ------------------------------------------------------------------ */
/* 金茂大厦                                                            */
/* ------------------------------------------------------------------ */

function createJinMao() {
  const group = new THREE.Group();
  group.name = "JinMao";

  const material = facadeMaterial("silver", {
    tint: 0xe2e5ea,
    metalness: 0.2,
    roughness: 0.38,
    envMapIntensity: 1.15,
    emissiveBase: 0.8,
  });

  const ledgeMaterial = metalMaterial(0x9aa1aa, 0.4, 0.75);

  const bandMaterial = emissiveMaterial(0xffd28a, {
    type: "neon",
    base: 0.7,
    baseColor: 0x120c05,
    roughness: 0.35,
  });

  const TIERS = 12;
  const TIER_HEIGHT = 30;
  const BASE_WIDTH = 64;

  for (let i = 0; i < TIERS; i++) {
    const width = BASE_WIDTH - i * 2.6;
    const radius = width / 1.85;
    const y = i * TIER_HEIGHT;

    const tierGeometry = new THREE.CylinderGeometry(
      radius * 0.955,
      radius,
      TIER_HEIGHT,
      8,
    );
    scaleUVs(tierGeometry, 2.0, 0.62);
    const tier = shadowed(new THREE.Mesh(tierGeometry, material));
    tier.position.y = y + TIER_HEIGHT / 2;
    tier.rotation.y = Math.PI / 8;
    group.add(tier);

    // 每层收分的檐口
    const ledge = shadowed(
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          radius * 1.075,
          radius * 1.075,
          2.6,
          8,
        ),
        ledgeMaterial,
      ),
    );
    ledge.position.y = y + TIER_HEIGHT - 1.3;
    ledge.rotation.y = Math.PI / 8;
    group.add(ledge);

    // 夜间金色腰带
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius * 1.085,
        radius * 1.085,
        0.75,
        8,
        1,
        true,
      ),
      bandMaterial,
    );
    band.position.y = y + TIER_HEIGHT - 2.7;
    band.rotation.y = Math.PI / 8;
    group.add(band);
  }

  // 顶部收束与塔尖
  const topY = TIERS * TIER_HEIGHT;
  const drum = shadowed(
    new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 22, 12), material),
  );
  drum.position.y = topY + 11;
  group.add(drum);

  const roof = shadowed(
    new THREE.Mesh(
      new THREE.ConeGeometry(11.5, 20, 12),
      metalMaterial(0xb8a06e, 0.38, 0.8),
    ),
  );
  roof.position.y = topY + 32;
  group.add(roof);

  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 1.1, 24, 8),
    metalMaterial(0xd8c28e, 0.35, 0.9),
  );
  spire.position.y = topY + 54;
  group.add(spire);

  const beaconMaterial = new THREE.MeshStandardMaterial({
    color: 0x220505,
    emissive: 0xff2a2a,
    emissiveIntensity: 2,
    roughness: 0.5,
  });
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 12, 10),
    beaconMaterial,
  );
  beacon.position.y = topY + 67;
  group.add(beacon);

  return {
    group,
    bandMaterial,
    beaconMaterial,
    update(elapsed, state) {
      bandMaterial.emissiveIntensity =
        state.neonIntensity * 0.7 * (0.8 + 0.2 * Math.sin(elapsed * 0.55));
      beaconMaterial.emissiveIntensity =
        state.neonIntensity *
        (Math.sin(elapsed * 2.6 + 0.6) > 0.55 ? 3.2 : 0.25);
    },
  };
}

/* ------------------------------------------------------------------ */
/* 背景城市                                                            */
/* ------------------------------------------------------------------ */

function buildBackgroundCity() {
  const group = new THREE.Group();
  group.name = "BackgroundCity";
  const rand = seededRandom(20241104);

  const boxMaterial = facadeMaterial("background", {
    tint: 0xd8e2ec,
    metalness: 0.08,
    roughness: 0.6,
    envMapIntensity: 0.8,
    emissiveBase: 0.5,
  });

  const crownMaterial = emissiveMaterial(0xffe0ae, {
    type: "neon",
    base: 0.3,
    baseColor: 0x050a10,
    roughness: 0.4,
  });

  const keepOut = Object.values(TOWER_POS).map(
    ([x, , z]) => new THREE.Vector2(x, z),
  );

  const specs = [];

  // 浦东：陆家嘴核心区后方的高层建筑群
  let attempts = 0;
  while (specs.length < 38 && attempts < 1200) {
    attempts++;
    const x = 300 + rand() * 760;
    const z = -1100 + rand() * 2200;
    const pos = new THREE.Vector2(x, z);
    if (keepOut.some((p) => pos.distanceTo(p) < 145)) continue;

    const width = 28 + rand() * 58;
    const depth = 28 + rand() * 58;
    const height = 55 + Math.pow(rand(), 1.9) * 260;
    const rotation = rand() * Math.PI;
    const shade = 0.4 + rand() * 0.28;
    specs.push({
      x,
      z,
      width,
      depth,
      height,
      rotation,
      color: new THREE.Color().setHSL(0.57 + rand() * 0.05, 0.16, shade),
      crowned: rand() < 0.35,
    });
  }

  // 浦西：外滩背后的城市体量
  let westCount = 0;
  attempts = 0;
  while (westCount < 46 && attempts < 900) {
    attempts++;
    const x = -360 - rand() * 1250;
    const z = -1200 + rand() * 2400;
    const width = 26 + rand() * 70;
    const depth = 26 + rand() * 70;
    const height = 18 + Math.pow(rand(), 1.5) * 130;
    specs.push({
      x,
      z,
      width,
      depth,
      height,
      rotation: rand() * Math.PI,
      color: new THREE.Color().setHSL(0.09 + rand() * 0.03, 0.12, 0.34 + rand() * 0.18),
      crowned: rand() < 0.22,
      west: true,
    });
    westCount++;
  }

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  scaleUVs(boxGeometry, 1, 1);

  const towers = new THREE.InstancedMesh(
    boxGeometry,
    boxMaterial,
    specs.length,
  );
  towers.castShadow = false;
  towers.receiveShadow = false;

  const crownGeometry = new THREE.BoxGeometry(1, 1, 1);
  const crownCount = specs.filter((s) => s.crowned).length;
  const crowns = new THREE.InstancedMesh(
    crownGeometry,
    crownMaterial,
    crownCount,
  );

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let crownIndex = 0;

  specs.forEach((spec, index) => {
    dummy.position.set(spec.x, spec.height / 2, spec.z);
    dummy.rotation.set(0, spec.rotation, 0);
    dummy.scale.set(spec.width, spec.height, spec.depth);
    dummy.updateMatrix();
    towers.setMatrixAt(index, dummy.matrix);
    towers.setColorAt(index, color.copy(spec.color));

    if (spec.crowned) {
      dummy.position.set(spec.x, spec.height + 1.2, spec.z);
      dummy.rotation.set(0, spec.rotation, 0);
      dummy.scale.set(spec.width * 0.8, 1.1, spec.depth * 0.8);
      dummy.updateMatrix();
      crowns.setMatrixAt(crownIndex, dummy.matrix);
      crownIndex++;
    }
  });

  towers.instanceMatrix.needsUpdate = true;
  towers.instanceColor.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;

  group.add(towers, crowns);

  // 两栋圆润的 IFC 风格双子塔，补齐天际线层次
  const twinMaterial = glassMaterial(0x9dc6e2, {
    roughness: 0.18,
    metalness: 0.75,
  });
  const twinPositions = [
    [620, 250, -430],
    [705, 235, -395],
  ];
  for (const [x, height, z] of twinPositions) {
    const radius = 24;
    const shaft = shadowed(
      new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.82, radius, height, 32),
        twinMaterial,
      ),
    );
    shaft.position.set(x, height / 2, z);
    group.add(shaft);

    const cap = shadowed(
      new THREE.Mesh(
        new THREE.SphereGeometry(
          radius * 0.82,
          24,
          12,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2,
        ),
        twinMaterial,
      ),
    );
    cap.position.set(x, height, z);
    group.add(cap);

    const capRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.82, 0.6, 6, 48),
      crownMaterial,
    );
    capRing.rotation.x = Math.PI / 2;
    capRing.position.set(x, height + 0.5, z);
    group.add(capRing);
  }

  return {
    group,
    crownMaterial,
    update(elapsed, state) {
      crownMaterial.emissiveIntensity =
        state.neonIntensity * 0.3 * (0.85 + 0.15 * Math.sin(elapsed * 0.5));
    },
  };
}

/* ------------------------------------------------------------------ */
/* 组装                                                                */
/* ------------------------------------------------------------------ */

export function createTowers(scene) {
  const root = new THREE.Group();
  root.name = "Towers";
  scene.add(root);

  const pearl = createOrientalPearl();
  pearl.group.position.set(...TOWER_POS.pearl);
  root.add(pearl.group);

  const shanghai = createShanghaiTower();
  shanghai.group.position.set(...TOWER_POS.shanghai);
  root.add(shanghai.group);

  const swfc = createSWFC();
  swfc.group.position.set(...TOWER_POS.swfc);
  root.add(swfc.group);

  const jinmao = createJinMao();
  jinmao.group.position.set(...TOWER_POS.jinmao);
  root.add(jinmao.group);

  const background = buildBackgroundCity();
  root.add(background.group);

  const landmarks = { pearl, shanghai, swfc, jinmao };

  return {
    root,
    landmarks,
    update(elapsed, state) {
      pearl.update(elapsed, state);
      shanghai.update(elapsed, state);
      swfc.update(elapsed, state);
      jinmao.update(elapsed, state);
      background.update(elapsed, state);
    },
  };
}
