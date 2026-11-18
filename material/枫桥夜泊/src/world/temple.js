import * as THREE from "three";
import { LAYOUT, WORLD } from "../config.js";
import { seededRandom } from "../utils/textures.js";
import { farBankHeight } from "./terrain.js";
import {
  bronzeMaterial,
  darkMetalMaterial,
  emissiveMaterial,
  mergeMeshes,
  roofMaterial,
  stoneMaterial,
  woodMaterial,
} from "./materials.js";

/**
 * 寒山寺。
 *
 * 寺院位于北岸山坡的平台上，由山门、主殿、钟楼、偏殿与一座五层
 * 砖木塔组成。所有屋面的曲线、飞檐与脊饰都由同一套屋顶生成器
 * 产生；钟楼内悬挂一口可摆动的青铜钟，钟声以极淡的环形波前
 * 越过江面。
 */

const STRIKE_TIME = 28.6;
const RING_COUNT = 4;
const RING_DURATION = 7.0;

function smoothstep(a, b, value) {
  const t = Math.min(1, Math.max(0, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/* ------------------------------------------------------------------ */
/* 屋顶                                                                */
/* ------------------------------------------------------------------ */

function createRoofGeometry({
  width,
  depth,
  eaveY,
  ridgeY,
  ridgeLength,
  upturn = 1.0,
  segmentsX = 30,
  segmentsZ = 20,
}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const W = width;
  const D = depth;
  const R = Math.max(0, Math.min(ridgeLength, W - 0.5));

  for (let iz = 0; iz <= segmentsZ; iz++) {
    const z = -D / 2 + (iz / segmentsZ) * D;
    for (let ix = 0; ix <= segmentsX; ix++) {
      const x = -W / 2 + (ix / segmentsX) * W;

      const sideT = Math.abs(z) / (D / 2);
      const endT = Math.max(0, (Math.abs(x) - R / 2) / Math.max(0.001, (W - R) / 2));
      const t = Math.min(1, Math.max(sideT, endT));

      let y = ridgeY - (ridgeY - eaveY) * Math.pow(t, 0.8);

      const corner =
        smoothstep(0.66, 1.0, Math.abs(x) / (W / 2)) *
        smoothstep(0.66, 1.0, Math.abs(z) / (D / 2));
      y += upturn * corner * Math.pow(t, 1.45);

      // 瓦面的轻微起伏，打破规则的平面
      y += Math.sin(x * 0.85) * 0.018 + Math.cos(z * 1.15) * 0.012;

      positions.push(x, y, z);
      uvs.push((x / W + 0.5) * 6, (z / D + 0.5) * 5);

      if (ix < segmentsX && iz < segmentsZ) {
        const a = iz * (segmentsX + 1) + ix;
        const b = a + 1;
        const c = a + segmentsX + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
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

function createRoof({
  width,
  depth,
  eaveY,
  ridgeY,
  ridgeLength,
  upturn = 1.0,
  position = new THREE.Vector3(),
}) {
  const group = new THREE.Group();
  group.position.copy(position);

  const material = roofMaterial(0x7e848c);
  material.side = THREE.DoubleSide;

  const roof = new THREE.Mesh(
    createRoofGeometry({
      width,
      depth,
      eaveY,
      ridgeY,
      ridgeLength,
      upturn,
    }),
    material,
  );
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // 屋面下的暗色望板，避免从下仰视时看到瓦面
  const soffitMaterial = new THREE.MeshStandardMaterial({
    color: 0x17130f,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const soffit = new THREE.Mesh(
    createRoofGeometry({
      width: width - 0.15,
      depth: depth - 0.15,
      eaveY: eaveY - 0.1,
      ridgeY: ridgeY - 0.16,
      ridgeLength,
      upturn: upturn * 0.96,
    }),
    soffitMaterial,
  );
  soffit.position.y = -0.12;
  group.add(soffit);

  // 正脊
  const ridgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2c2e,
    roughness: 0.7,
    metalness: 0.1,
  });
  if (ridgeLength > 0.4) {
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(ridgeLength + 0.9, 0.38, 0.34),
      ridgeMaterial,
    );
    ridge.position.y = ridgeY + 0.16;
    ridge.castShadow = true;
    group.add(ridge);

    // 两端微微上翘的脊饰
    for (const side of [-1, 1]) {
      const finial = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.7, 6),
        ridgeMaterial,
      );
      finial.position.set(side * (ridgeLength / 2 + 0.55), ridgeY + 0.48, 0);
      finial.rotation.z = -side * 0.5;
      group.add(finial);
    }
  } else {
    const finial = new THREE.Mesh(
      new THREE.ConeGeometry(0.26, 0.9, 7),
      ridgeMaterial,
    );
    finial.position.y = ridgeY + 0.5;
    group.add(finial);
  }

  // 檐口：沿四边取样，做成微微起翘的细梁
  const fasciaMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2119,
    roughness: 0.78,
    metalness: 0.05,
  });
  const eavePoint = (x, z) => {
    const sideT = Math.abs(z) / (depth / 2);
    const endT = Math.max(
      0,
      (Math.abs(x) - Math.max(0, ridgeLength) / 2) /
        Math.max(0.001, (width - Math.max(0, ridgeLength)) / 2),
    );
    const t = Math.min(1, Math.max(sideT, endT));
    const corner =
      smoothstep(0.66, 1, Math.abs(x) / (width / 2)) *
      smoothstep(0.66, 1, Math.abs(z) / (depth / 2));
    return (
      ridgeY - (ridgeY - eaveY) * Math.pow(t, 0.8) +
      upturn * corner * Math.pow(t, 1.45) -
      0.08
    );
  };

  const edges = [
    { fixed: -depth / 2, axis: "x" },
    { fixed: depth / 2, axis: "x" },
    { fixed: -width / 2, axis: "z" },
    { fixed: width / 2, axis: "z" },
  ];
  for (const edge of edges) {
    const points = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      if (edge.axis === "x") {
        const x = -width / 2 + u * width;
        points.push(new THREE.Vector3(x, eavePoint(x, edge.fixed), edge.fixed));
      } else {
        const z = -depth / 2 + u * depth;
        points.push(new THREE.Vector3(edge.fixed, eavePoint(edge.fixed, z), z));
      }
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const beam = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 36, 0.085, 5, false),
      fasciaMaterial,
    );
    beam.castShadow = true;
    group.add(beam);
  }

  return group;
}

/* ------------------------------------------------------------------ */
/* 殿宇                                                                */
/* ------------------------------------------------------------------ */

function createColumns(points, height, baseY, material, radius = 0.2) {
  const group = new THREE.Group();
  for (const [x, z] of points) {
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.9, radius, height, 10),
      material,
    );
    column.position.set(x, baseY + height / 2, z);
    column.castShadow = true;
    column.receiveShadow = true;
    group.add(column);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.5, radius * 1.7, 0.18, 10),
      stoneMaterial(0x5f5950),
    );
    base.position.set(x, baseY + 0.09, z);
    group.add(base);
  }
  return group;
}

function createLatticeWindow(width, height) {
  const group = new THREE.Group();
  const barMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a130d,
    roughness: 0.9,
    metalness: 0.02,
  });

  const cols = Math.max(2, Math.round(width / 0.34));
  const rows = Math.max(2, Math.round(height / 0.34));
  for (let i = 1; i < cols; i++) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, height, 0.04),
      barMaterial,
    );
    bar.position.x = -width / 2 + (width * i) / cols;
    group.add(bar);
  }
  for (let i = 1; i < rows; i++) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.035, 0.04),
      barMaterial,
    );
    bar.position.y = -height / 2 + (height * i) / rows;
    group.add(bar);
  }

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.14, height + 0.14, 0.07),
    barMaterial,
  );
  frame.position.z = -0.03;
  group.add(frame);

  return group;
}

function createWarmWindow(width, height) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffb066,
    transparent: true,
    opacity: 0.52,
    toneMapped: true,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  glow.position.z = 0.02;
  return glow;
}

function createHall({
  position,
  width,
  depth,
  wallHeight,
  roofRise,
  name,
  baseY,
  windows = 3,
  warm = 0.5,
  roofUpturn = 1.15,
}) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.name = name;

  const plinthHeight = 0.85;
  const floorY = baseY + plinthHeight;

  const plinthMaterial = stoneMaterial(0xa89f8e, {
    map: "stone",
    repeat: [3, 1],
  });
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(width + 4.2, plinthHeight, depth + 4.2),
    plinthMaterial,
  );
  plinth.position.y = baseY + plinthHeight / 2;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // 台阶
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.18, 1.1),
      plinthMaterial,
    );
    step.position.set(0, baseY + 0.72 - i * 0.24, depth / 2 + 2.6 + i * 1.0);
    step.receiveShadow = true;
    group.add(step);
  }

  const wallMaterial = woodMaterial(0x8a6a4a, {
    map: "woodFine",
    repeat: [3, 1],
  });
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, wallHeight, depth),
    wallMaterial,
  );
  body.position.y = floorY + wallHeight / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 檐柱
  const columnMaterial = woodMaterial(0xb07a50, {
    map: "woodFine",
    repeat: [0.4, 2],
  });
  const columnPoints = [];
  const nx = Math.max(2, Math.round(width / 3.2));
  const nz = Math.max(2, Math.round(depth / 3.2));
  for (let i = 0; i <= nx; i++) {
    const x = -width / 2 + (width * i) / nx;
    columnPoints.push([x, depth / 2 + 0.55], [x, -depth / 2 - 0.55]);
  }
  for (let i = 1; i < nz; i++) {
    const z = -depth / 2 + (depth * i) / nz;
    columnPoints.push([width / 2 + 0.55, z], [-width / 2 - 0.55, z]);
  }
  group.add(createColumns(columnPoints, wallHeight + 0.3, floorY, columnMaterial, 0.19));

  // 门窗：朝向江面（+Z）的一侧
  const windowY = floorY + wallHeight * 0.55;
  for (let i = 0; i < windows; i++) {
    const x = ((i - (windows - 1) / 2) * width) / (windows + 0.4);
    const w = Math.min(2.4, width / (windows + 0.9));
    const h = 1.5;

    const glow = createWarmWindow(w, h);
    glow.position.set(x, windowY, depth / 2 + 0.03);
    glow.material.opacity = 0.35 + warm * 0.3;
    group.add(glow);

    const lattice = createLatticeWindow(w, h);
    lattice.position.set(x, windowY, depth / 2 + 0.08);
    group.add(lattice);
  }

  // 中央门洞
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.16, wallHeight * 0.62, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x0b0806, roughness: 1 }),
  );
  door.position.set(0, floorY + wallHeight * 0.31, depth / 2 + 0.045);
  group.add(door);

  // 匾额
  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.26, 0.58, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x1b120c, roughness: 0.7 }),
  );
  plaque.position.set(0, floorY + wallHeight * 0.84, depth / 2 + 0.08);
  group.add(plaque);
  const plaqueLight = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.2, 0.2),
    new THREE.MeshBasicMaterial({
      color: 0x9b7843,
      transparent: true,
      opacity: 0.55,
    }),
  );
  plaqueLight.position.set(0, floorY + wallHeight * 0.84, depth / 2 + 0.15);
  group.add(plaqueLight);

  // 屋顶
  const eaveY = floorY + wallHeight + 0.2;
  const roof = createRoof({
    width: width + 4.6,
    depth: depth + 4.6,
    eaveY,
    ridgeY: eaveY + roofRise,
    ridgeLength: width * 0.5,
    upturn: roofUpturn,
    position: new THREE.Vector3(0, 0, 0),
  });
  group.add(roof);

  return { group, floorY, eaveY, ridgeY: eaveY + roofRise };
}

/* ------------------------------------------------------------------ */
/* 钟与钟楼                                                            */
/* ------------------------------------------------------------------ */

function createBell() {
  const group = new THREE.Group();

  const profile = [
    [0.03, 2.42],
    [0.2, 2.38],
    [0.32, 2.26],
    [0.38, 2.02],
    [0.43, 1.7],
    [0.5, 1.25],
    [0.59, 0.78],
    [0.7, 0.32],
    [0.78, 0.03],
    [0.72, 0.0],
    [0.64, 0.24],
    [0.55, 0.68],
    [0.46, 1.12],
    [0.4, 1.55],
    [0.33, 1.9],
    [0.22, 2.12],
    [0.03, 2.16],
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const material = bronzeMaterial();
  material.emissive = new THREE.Color(0x120c06);
  material.emissiveIntensity = 0.3;
  const bell = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 48),
    material,
  );
  bell.castShadow = true;
  bell.receiveShadow = true;
  group.add(bell);

  // 钟腰与钟口的装饰箍
  const bandMaterial = darkMetalMaterial();
  for (const [y, radius] of [
    [1.72, 0.42],
    [0.34, 0.75],
  ]) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.035, 6, 40),
      bandMaterial,
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    group.add(band);
  }

  // 钟肩的乳钉
  const studGeometry = new THREE.SphereGeometry(0.045, 6, 5);
  const studs = new THREE.InstancedMesh(studGeometry, material, 28);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const radius = 0.4;
    dummy.position.set(Math.cos(a) * radius, 1.95, Math.sin(a) * radius);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    studs.setMatrixAt(i, dummy.matrix);
  }
  group.add(studs);

  // 悬挂的钟钮与链
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.035, 6, 16),
    bandMaterial,
  );
  ring.position.y = 2.5;
  ring.rotation.y = Math.PI / 2;
  group.add(ring);

  return group;
}

function createBellTower({ position, baseY }) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.name = "BellTower";

  const plinthMaterial = stoneMaterial(0xa89f8e, {
    map: "stone",
    repeat: [2, 1],
  });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.8, 6.6), plinthMaterial);
  plinth.position.y = baseY + 0.4;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const floorY = baseY + 0.8;
  const firstHeight = 3.5;
  const secondHeight = 3.0;
  const secondFloorY = floorY + firstHeight;
  const eaveY = secondFloorY + secondHeight;

  const columnMaterial = woodMaterial(0xb07a50, {
    map: "woodFine",
    repeat: [0.4, 2],
  });

  // 一层：四角立柱 + 栏杆
  const corners = [
    [-2.4, -2.4],
    [2.4, -2.4],
    [-2.4, 2.4],
    [2.4, 2.4],
  ];
  group.add(createColumns(corners, firstHeight, floorY, columnMaterial, 0.24));

  const beamMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a1d14,
    roughness: 0.86,
    metalness: 0.03,
  });
  for (const [x, z] of corners) {
    const beamX = new THREE.Mesh(
      new THREE.BoxGeometry(4.9, 0.22, 0.2),
      beamMaterial,
    );
    beamX.position.set(0, floorY + firstHeight - 0.1, z);
    group.add(beamX);
    const beamZ = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.22, 4.9),
      beamMaterial,
    );
    beamZ.position.set(x, floorY + firstHeight - 0.1, 0);
    group.add(beamZ);
  }

  // 二层：更小的开敞钟室
  const upperHalf = 1.75;
  const upperCorners = [
    [-upperHalf, -upperHalf],
    [upperHalf, -upperHalf],
    [-upperHalf, upperHalf],
    [upperHalf, upperHalf],
  ];
  group.add(createColumns(upperCorners, secondHeight, secondFloorY, columnMaterial, 0.2));

  const upperFloor = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.28, 4.2),
    woodMaterial(0x8a6a4a, { map: "woodFine", repeat: [2, 2] }),
  );
  upperFloor.position.y = secondFloorY;
  upperFloor.castShadow = true;
  group.add(upperFloor);

  // 二层栏杆
  for (const side of [-1, 1]) {
    for (const axis of ["x", "z"]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(
          axis === "x" ? 4.0 : 0.1,
          0.1,
          axis === "x" ? 0.1 : 4.0,
        ),
        beamMaterial,
      );
      rail.position.set(
        axis === "x" ? 0 : side * 2.0,
        secondFloorY + 0.55,
        axis === "x" ? side * 2.0 : 0,
      );
      group.add(rail);
    }
  }

  // 悬挂大钟的横梁
  const bellBeam = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.28, 0.28),
    beamMaterial,
  );
  bellBeam.position.y = secondFloorY + secondHeight - 0.35;
  group.add(bellBeam);

  const bellPivotY = secondFloorY + secondHeight - 0.5;
  const bell = createBell();
  const bellGroup = new THREE.Group();
  bellGroup.position.y = bellPivotY;
  bell.scale.setScalar(1.15);
  const bellMesh = bell;
  bellMesh.position.y = -2.42;
  bellGroup.add(bellMesh);
  group.add(bellGroup);

  // 钟链
  const chain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.55, 5),
    darkMetalMaterial(),
  );
  chain.position.y = bellPivotY + 0.05;
  group.add(chain);

  // 撞钟木
  const strikerPivot = new THREE.Group();
  strikerPivot.position.set(bell.position.x + 2.25, bellPivotY + 0.3, 0);
  const striker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.16, 2.5, 8),
    woodMaterial(0x4a3523, { map: "woodFine", repeat: [1, 3] }),
  );
  striker.position.y = -1.25;
  striker.castShadow = true;
  strikerPivot.add(striker);
  group.add(strikerPivot);

  // 屋盖
  const roof = createRoof({
    width: 7.8,
    depth: 7.8,
    eaveY,
    ridgeY: eaveY + 2.4,
    ridgeLength: 1.4,
    upturn: 0.95,
    position: new THREE.Vector3(0, 0, 0),
  });
  group.add(roof);

  const bellLight = new THREE.PointLight(0xffb266, 3.4, 20, 2);
  bellLight.position.set(0, secondFloorY + 1.2, 0);
  group.add(bellLight);

  return {
    group,
    bellGroup,
    bellMesh,
    strikerPivot,
    bellLight,
    bellWorld: new THREE.Vector3(position.x, bellPivotY - 1.0, position.z),
    pivotTop: bellPivotY,
  };
}

/* ------------------------------------------------------------------ */
/* 塔                                                                  */
/* ------------------------------------------------------------------ */

function createPagoda({ position, baseY }) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.name = "Pagoda";

  const bodyMaterial = woodMaterial(0x86664a, {
    map: "woodFine",
    repeat: [2, 2],
  });
  const stone = stoneMaterial(0x9f9788, { map: "stone", repeat: [2, 1] });

  const base = new THREE.Mesh(new THREE.BoxGeometry(9, 1.1, 9), stone);
  base.position.y = baseY + 0.55;
  base.receiveShadow = true;
  group.add(base);

  let y = baseY + 1.1;
  let width = 7.2;
  for (let tier = 0; tier < 5; tier++) {
    const height = tier === 0 ? 3.0 : 2.5;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, width),
      bodyMaterial,
    );
    body.position.y = y + height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roof = createRoof({
      width: width + 2.6,
      depth: width + 2.6,
      eaveY: y + height,
      ridgeY: y + height + 1.35,
      ridgeLength: 0.6,
      upturn: 0.75,
      position: new THREE.Vector3(0, 0, 0),
    });
    group.add(roof);

    y += height + 1.0;
    width *= 0.82;
  }

  // 塔刹
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 3.2, 8),
    darkMetalMaterial(),
  );
  spire.position.y = y + 1.1;
  group.add(spire);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffb15a }),
  );
  glow.position.y = y + 0.4;
  group.add(glow);

  return { group, topY: y };
}

/* ------------------------------------------------------------------ */
/* 院墙、山门、石阶                                                     */
/* ------------------------------------------------------------------ */

function createCompound({ baseY }) {
  const group = new THREE.Group();
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3230,
    roughness: 0.95,
    metalness: 0.02,
  });
  const capMaterial = roofMaterial(0x3c4047);

  const x0 = 12;
  const x1 = 76;
  const z0 = -150;
  const z1 = -86;
  const height = 2.2;

  const segments = [
    { x: (x0 + x1) / 2, z: z0, w: x1 - x0, d: 0.5 },
    { x: (x0 + x1) / 2, z: z1, w: x1 - x0, d: 0.5, gate: true },
    { x: x0, z: (z0 + z1) / 2, w: 0.5, d: Math.abs(z1 - z0) },
    { x: x1, z: (z0 + z1) / 2, w: 0.5, d: Math.abs(z1 - z0) },
  ];

  for (const segment of segments) {
    if (segment.gate) {
      // 前面留出山门，其余部分分两段墙
      const gateWidth = 7;
      const sideWidth = (segment.w - gateWidth) / 2;
      for (const side of [-1, 1]) {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(sideWidth, height, segment.d),
          wallMaterial,
        );
        wall.position.set(
          segment.x + side * (gateWidth / 2 + sideWidth / 2),
          baseY + height / 2,
          segment.z,
        );
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);

        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(sideWidth + 0.3, 0.22, segment.d + 0.5),
          capMaterial,
        );
        cap.position.set(wall.position.x, baseY + height + 0.1, segment.z);
        group.add(cap);
      }
      continue;
    }

    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(segment.w, height, segment.d),
      wallMaterial,
    );
    wall.position.set(segment.x, baseY + height / 2, segment.z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(segment.w + 0.3, 0.22, segment.d + 0.5),
      capMaterial,
    );
    cap.position.set(segment.x, baseY + height + 0.1, segment.z);
    group.add(cap);
  }

  // 山门
  const gateRoof = createRoof({
    width: 9.4,
    depth: 5.2,
    eaveY: baseY + 4.4,
    ridgeY: baseY + 6.4,
    ridgeLength: 2.2,
    upturn: 0.85,
    position: new THREE.Vector3(LAYOUT.temple.x, 0, z1),
  });
  group.add(gateRoof);

  for (const side of [-1, 1]) {
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.25, 4.4, 9),
      woodMaterial(0xaa7a50, { map: "woodFine", repeat: [0.4, 2] }),
    );
    column.position.set(LAYOUT.temple.x + side * 3.1, baseY + 2.2, z1);
    column.castShadow = true;
    group.add(column);
  }

  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 0.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.85 }),
  );
  lintel.position.set(LAYOUT.temple.x, baseY + 4.1, z1);
  group.add(lintel);

  // 山门匾额
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.7),
    new THREE.MeshBasicMaterial({
      color: 0xb08a4e,
      transparent: true,
      opacity: 0.35,
    }),
  );
  plaque.position.set(LAYOUT.temple.x, baseY + 3.55, z1 + 0.28);
  group.add(plaque);

  // 从山门向下的石阶
  const steps = [];
  const stepMaterial = stoneMaterial(0x9a9284, {
    map: "stoneFine",
    repeat: [2, 0.4],
  });
  const startZ = z1 + 2.4;
  const endZ = -62;
  const count = 18;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const z = startZ + (endZ - startZ) * t;
    const ground = farBankHeight(LAYOUT.temple.x, z);
    const y = ground + 0.12 + (1 - t) * 0.25;
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 0.22, (startZ - endZ) / count + 0.35),
      stepMaterial,
    );
    step.position.set(LAYOUT.temple.x, y, z);
    step.receiveShadow = true;
    steps.push(step);
  }
  group.add(mergeMeshes(steps, stepMaterial, { castShadow: false }));

  return group;
}

/* ------------------------------------------------------------------ */
/* 山寺周围的树木剪影                                                   */
/* ------------------------------------------------------------------ */

function createTempleTrees() {
  const group = new THREE.Group();
  const rand = seededRandom(619);
  const dummy = new THREE.Object3D();

  const roundMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c382f,
    roughness: 0.95,
    metalness: 0,
  });
  const roundGeometry = new THREE.IcosahedronGeometry(1, 1);
  const roundMesh = new THREE.InstancedMesh(roundGeometry, roundMaterial, 190);

  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d1712,
    roughness: 1,
    metalness: 0,
  });
  const trunkGeometry = new THREE.CylinderGeometry(1, 1.35, 1, 5);
  trunkGeometry.translate(0, 0.5, 0);
  const trunkMesh = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, 96);

  // 山门到江面之间的视线走廊留空，让寺院能完整显露
  function inViewCorridor(x, z) {
    return z > LAYOUT.temple.z - 6 && z < -58 && x > -8 && x < 96;
  }

  let canopyCount = 0;
  let trunkCount = 0;
  let guard = 0;

  while (trunkCount < 96 && guard < 3000) {
    guard++;
    const angle = rand() * Math.PI * 2;
    const radius = 30 + rand() * 120;
    const x = LAYOUT.temple.x + Math.cos(angle) * radius * 1.2;
    const z = LAYOUT.temple.z + Math.sin(angle) * radius * 0.95;
    if (z > -54) continue;
    if (inViewCorridor(x, z)) continue;
    if (x > 8 && x < 82 && z > -156 && z < -84) continue;

    const ground = farBankHeight(x, z);
    const height = 4.5 + rand() * 5.5;
    const width = 2.2 + rand() * 2.8;
    const trunkHeight = height * (0.34 + rand() * 0.18);

    dummy.position.set(x, ground, z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(0.18 + rand() * 0.12, trunkHeight, 0.18 + rand() * 0.12);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(trunkCount++, dummy.matrix);

    if (canopyCount + 2 > 190) continue;

    const crownY = ground + trunkHeight + height * 0.18;
    dummy.position.set(x, crownY, z);
    dummy.rotation.set(rand() * 0.3, rand() * Math.PI * 2, rand() * 0.3);
    dummy.scale.set(width, height * 0.46, width * (0.85 + rand() * 0.3));
    dummy.updateMatrix();
    roundMesh.setMatrixAt(canopyCount++, dummy.matrix);

    // 第二团树冠，错开一点，形成不规则的阔叶轮廓
    dummy.position.set(
      x + (rand() - 0.5) * width * 0.8,
      crownY + height * (0.18 + rand() * 0.16),
      z + (rand() - 0.5) * width * 0.8,
    );
    dummy.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
    dummy.scale.set(
      width * (0.5 + rand() * 0.25),
      height * (0.26 + rand() * 0.12),
      width * (0.45 + rand() * 0.25),
    );
    dummy.updateMatrix();
    roundMesh.setMatrixAt(canopyCount++, dummy.matrix);
  }

  roundMesh.count = canopyCount;
  trunkMesh.count = trunkCount;
  roundMesh.instanceMatrix.needsUpdate = true;
  trunkMesh.instanceMatrix.needsUpdate = true;
  roundMesh.castShadow = true;
  roundMesh.receiveShadow = true;
  trunkMesh.castShadow = true;
  group.add(roundMesh, trunkMesh);
  return group;
}

/* ------------------------------------------------------------------ */
/* 声波视觉                                                             */
/* ------------------------------------------------------------------ */

function createSoundRings(count) {
  const rings = [];
  const group = new THREE.Group();

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uRadius: { value: 0.1 },
      uOpacity: { value: 0 },
      uSeed: { value: 0 },
      uColor: { value: new THREE.Color(0x9fb4cc) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uRadius;
      uniform float uOpacity;
      uniform float uSeed;
      uniform vec3 uColor;
      varying vec2 vUv;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float angle = atan(p.y, p.x);

        // 不规则的波前：半径与透明度都被噪声轻轻打散
        float wobble = (noise2(vec2(angle * 2.0 + uSeed, uRadius * 18.0)) - 0.5) * 0.024;
        float rr = r + wobble;
        float thickness = 0.008 + uRadius * 0.016;
        float ring = smoothstep(uRadius - thickness, uRadius, rr)
                   * (1.0 - smoothstep(uRadius, uRadius + thickness, rr));

        float shred = 0.25 + 0.75 * noise2(vec2(angle * 5.0 + uSeed * 9.0, uRadius * 13.0));
        float arcMask = smoothstep(0.34, 0.6, noise2(vec2(angle * 7.0 + uSeed * 13.0, 3.7)));
        float fade = smoothstep(0.0, 0.08, uRadius) * (1.0 - smoothstep(0.62, 0.78, uRadius));

        float alpha = ring * shred * arcMask * fade * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });

  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), material.clone());
    mesh.material.uniforms.uSeed.value = i * 1.7;
    mesh.visible = false;
    mesh.renderOrder = 20;
    group.add(mesh);
    rings.push(mesh);
  }

  return { group, rings };
}

/* ------------------------------------------------------------------ */
/* 主入口                                                              */
/* ------------------------------------------------------------------ */

export function createTemple() {
  const group = new THREE.Group();
  group.name = "HanshanTemple";

  const baseY = WORLD.templeBase;
  const hall = createHall({
    position: new THREE.Vector3(38, 0, -114),
    width: 17,
    depth: 10.5,
    wallHeight: 4.6,
    roofRise: 3.6,
    name: "MainHall",
    baseY,
    windows: 3,
    warm: 0.6,
    roofUpturn: 1.35,
  });
  group.add(hall.group);

  const sideHall = createHall({
    position: new THREE.Vector3(22, 0, -126),
    width: 11,
    depth: 7,
    wallHeight: 3.6,
    roofRise: 2.6,
    name: "SideHall",
    baseY: farBankHeight(22, -126),
    windows: 2,
    warm: 0.35,
    roofUpturn: 1.0,
  });
  group.add(sideHall.group);

  const tower = createBellTower({
    position: new THREE.Vector3(55, 0, -126),
    baseY: farBankHeight(55, -126),
  });
  group.add(tower.group);

  const pagoda = createPagoda({
    position: new THREE.Vector3(66, 0, -144),
    baseY: farBankHeight(66, -144),
  });
  group.add(pagoda.group);

  group.add(createCompound({ baseY }));
  group.add(createTempleTrees());

  // 院内的暖色灯火：主殿前与钟楼下
  const hallLight = new THREE.PointLight(0xffa860, 8.5, 40, 2);
  hallLight.position.set(38, baseY + 5.6, -108);
  group.add(hallLight);

  const towerLight = new THREE.PointLight(0xffa860, 4.0, 22, 2);
  towerLight.position.set(55, farBankHeight(55, -126) + 5.5, -123);
  group.add(towerLight);

  // 山道旁的两盏石灯
  const lampMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb268,
    transparent: true,
    opacity: 0.8,
  });
  for (const z of [-78, -68]) {
    const x = LAYOUT.temple.x + 4.6;
    const ground = farBankHeight(x, z);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 1.1, 7),
      stoneMaterial(0x5b554b, { map: "stoneFine" }),
    );
    post.position.set(x, ground + 0.55, z);
    group.add(post);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.4, 0.34),
      lampMaterial,
    );
    lamp.position.set(x, ground + 1.3, z);
    group.add(lamp);
  }

  // 声波
  const sound = createSoundRings(RING_COUNT);
  sound.group.position.copy(tower.bellWorld);
  sound.group.lookAt(new THREE.Vector3(LAYOUT.boat.x, WORLD.waterLevel + 2, LAYOUT.boat.z));
  group.add(sound.group);

  // 钟声到达客船后，江面出现的涟漪时刻
  const rippleTimes = [31.1, 32.4];

  let lastTime = -1;
  let lastRippleIndex = 0;

  return {
    group,
    hall,
    sideHall,
    tower,
    pagoda,
    bellWorld: tower.bellWorld.clone(),
    strikeTime: STRIKE_TIME,
    rippleTimes,
    sound,
    update(delta, elapsed, state) {
      const time = state?.time ?? elapsed;
      const strike = time - STRIKE_TIME;

      // 钟摆
      let bellAngle = Math.sin(time * 0.55) * 0.008;
      if (strike > 0) {
        bellAngle +=
          Math.sin(strike * 4.1) * 0.105 * Math.exp(-strike * 0.85);
      }
      tower.bellGroup.rotation.z = bellAngle;

      // 撞木
      let strikerAngle;
      if (time < STRIKE_TIME - 0.4) {
        strikerAngle = lerp(-0.06, 0.62, smoothstep(25.6, STRIKE_TIME - 0.4, time));
      } else if (time < STRIKE_TIME) {
        strikerAngle = lerp(0.62, -0.52, smoothstep(STRIKE_TIME - 0.4, STRIKE_TIME, time));
      } else {
        strikerAngle =
          -0.52 * Math.exp(-(time - STRIKE_TIME) * 1.9) *
          Math.cos((time - STRIKE_TIME) * 4.4);
      }
      tower.strikerPivot.rotation.z = strikerAngle;

      // 钟体被撞后的细微震动与暖光脉冲
      const pulse =
        strike > 0 ? Math.exp(-strike * 1.7) * Math.min(1, strike * 8) : 0;
      tower.bellLight.intensity = 3.4 + pulse * 8.0;
      tower.bellMesh.position.x = strike > 0 ? Math.sin(strike * 38) * 0.012 * pulse : 0;

      // 声波环
      for (let i = 0; i < sound.rings.length; i++) {
        const ring = sound.rings[i];
        const local = time - STRIKE_TIME - 0.22 - i * 0.62;
        if (local > 0 && local < RING_DURATION) {
          const progress = local / RING_DURATION;
          ring.visible = true;
          ring.material.uniforms.uRadius.value = 0.06 + progress * 0.7;
          const envelope =
            smoothstep(0, 0.5, local) * (1 - smoothstep(4.6, RING_DURATION, local));
          ring.material.uniforms.uOpacity.value = envelope * (0.045 - i * 0.006);
          ring.scale.setScalar(1 + progress * 0.35);
        } else {
          ring.visible = false;
          ring.material.uniforms.uOpacity.value = 0;
        }
      }

      // 钟声抵达客船时触发江面涟漪（只触发一次）
      if (lastTime >= 0 && time > lastTime) {
        for (let i = lastRippleIndex; i < rippleTimes.length; i++) {
          if (lastTime < rippleTimes[i] && time >= rippleTimes[i]) {
            state?.onBellRipple?.(rippleTimes[i] - STRIKE_TIME);
            lastRippleIndex = i + 1;
          }
        }
      }
      if (time < lastTime - 0.001) {
        lastRippleIndex = 0;
      }
      lastTime = time;
    },
    reset() {
      lastTime = -1;
      lastRippleIndex = 0;
      tower.strikerPivot.rotation.z = 0;
      tower.bellGroup.rotation.z = 0;
    },
  };
}
