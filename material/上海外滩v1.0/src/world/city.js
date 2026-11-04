import * as THREE from "three";
import { RIVER } from "../config.js";
import { createGlowTexture, seededRandom } from "../utils/textures.js";
import {
  emissiveMaterial,
  metalMaterial,
  stoneMaterial,
} from "./materials.js";

const LAND_LEVEL = 3.0;
const ROAD_LEVEL = LAND_LEVEL + 0.06;
const BRIDGE_Z = 1250;

/* ------------------------------------------------------------------ */

function createLand() {
  const group = new THREE.Group();

  const eastMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d4249,
    roughness: 0.95,
    metalness: 0.02,
  });
  const westMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a4741,
    roughness: 0.96,
    metalness: 0.02,
  });

  const east = new THREE.Mesh(
    new THREE.PlaneGeometry(3800, 9000),
    eastMaterial,
  );
  east.rotation.x = -Math.PI / 2;
  east.position.set(RIVER.eastBank + 1900, LAND_LEVEL, 0);
  east.receiveShadow = true;
  group.add(east);

  const west = new THREE.Mesh(
    new THREE.PlaneGeometry(3800, 9000),
    westMaterial,
  );
  west.rotation.x = -Math.PI / 2;
  west.position.set(RIVER.westBank - 1900, LAND_LEVEL, 0);
  west.receiveShadow = true;
  group.add(west);

  // 两岸防汛墙
  const wallMaterial = stoneMaterial(0x7d776b, 0.92);
  const eastWall = new THREE.Mesh(
    new THREE.BoxGeometry(4, 4.2, 3200),
    wallMaterial,
  );
  eastWall.position.set(RIVER.eastBank + 1, LAND_LEVEL + 1.2, 0);
  eastWall.receiveShadow = true;
  eastWall.castShadow = true;
  group.add(eastWall);

  // 浦东滨江步道
  const quay = new THREE.Mesh(
    new THREE.BoxGeometry(20, 1.2, 3200),
    stoneMaterial(0x8a8377, 0.9),
  );
  quay.position.set(RIVER.eastBank + 11, LAND_LEVEL + 0.6, 0);
  quay.receiveShadow = true;
  group.add(quay);

  const quayLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.35, 3200),
    emissiveMaterial(0x9fd8ff, {
      type: "lamp",
      base: 0.75,
      baseColor: 0x081018,
      roughness: 0.4,
    }),
  );
  quayLight.position.set(RIVER.eastBank + 20.6, LAND_LEVEL + 1.0, 0);
  group.add(quayLight);

  return group;
}

/* ------------------------------------------------------------------ */

function createRoadMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x1b1d20,
    roughness: 0.9,
    metalness: 0.05,
  });
}

function createRoads() {
  const group = new THREE.Group();
  const roadMaterial = createRoadMaterial();

  const roads = [
    { x: -265, width: 20, length: 1600 },
    { x: 244, width: 28, length: 2800 },
    { x: 244, width: 22, length: 1100, z: -760, rotate: true },
    { x: 244, width: 22, length: 1100, z: 560, rotate: true },
  ];

  for (const road of roads) {
    const geometry = road.rotate
      ? new THREE.PlaneGeometry(road.length, road.width)
      : new THREE.PlaneGeometry(road.width, road.length);
    const mesh = new THREE.Mesh(geometry, roadMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      road.rotate ? 800 : road.x,
      ROAD_LEVEL,
      road.rotate ? road.z : 0,
    );
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // 车道虚线
  const dashGeometry = new THREE.BoxGeometry(0.26, 0.03, 4.5);
  const dashMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9b6ac,
    emissive: 0xb9b6ac,
    emissiveIntensity: 0.14,
    roughness: 0.7,
  });

  const dashTransforms = [];
  for (let zi = -780; zi <= 780; zi += 13) {
    dashTransforms.push({ x: -265, z: zi, rot: 0 });
  }
  for (let zi = -1380; zi <= 1380; zi += 13) {
    dashTransforms.push({ x: 244, z: zi, rot: 0 });
  }

  const dashes = new THREE.InstancedMesh(
    dashGeometry,
    dashMaterial,
    dashTransforms.length,
  );
  const dummy = new THREE.Object3D();
  dashTransforms.forEach((dash, index) => {
    dummy.position.set(dash.x, ROAD_LEVEL + 0.02, dash.z);
    dummy.rotation.set(0, dash.rot, 0);
    dummy.updateMatrix();
    dashes.setMatrixAt(index, dummy.matrix);
  });
  dashes.instanceMatrix.needsUpdate = true;
  group.add(dashes);

  return group;
}

/* ------------------------------------------------------------------ */

function createCars() {
  const group = new THREE.Group();
  const rand = seededRandom(606);

  const cars = [];
  const laneDefs = [
    // 西岸：外滩沿江道路
    { x: -270, dir: 1, speed: 11, range: 790 },
    { x: -262, dir: 1, speed: 9, range: 790 },
    { x: -258, dir: -1, speed: 12, range: 790 },
    { x: -266, dir: -1, speed: 8.5, range: 790 },
    // 东岸：浦东滨江大道
    { x: 236, dir: 1, speed: 14, range: 1390 },
    { x: 244, dir: 1, speed: 12, range: 1390 },
    { x: 252, dir: -1, speed: 15, range: 1390 },
    { x: 260, dir: -1, speed: 11, range: 1390 },
  ];

  for (const lane of laneDefs) {
    const count = lane.x > 0 ? 7 : 4;
    for (let i = 0; i < count; i++) {
      cars.push({
        x: lane.x,
        z: -lane.range + rand() * lane.range * 2,
        speed: lane.speed * (0.75 + rand() * 0.5),
        dir: lane.dir,
        range: lane.range,
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
  bodies.receiveShadow = false;

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

  // 头灯与尾灯
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

  function updateMatrices() {
    cars.forEach((car, index) => {
      const y = ROAD_LEVEL + 0.7;
      dummy.position.set(car.x, y, car.z);
      dummy.rotation.set(0, car.dir > 0 ? 0 : Math.PI, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bodies.setMatrixAt(index, dummy.matrix);

      const front = car.z + car.dir * 2.2;
      const rear = car.z - car.dir * 2.2;
      for (const side of [-0.62, 0.62]) {
        dummy.position.set(car.x + side, y, front);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        headlights.setMatrixAt(index * 2 + (side > 0 ? 1 : 0), dummy.matrix);

        dummy.position.set(car.x + side, y, rear);
        dummy.updateMatrix();
        taillights.setMatrixAt(index * 2 + (side > 0 ? 1 : 0), dummy.matrix);
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
        car.z += car.speed * car.dir * delta;
        if (car.z > car.range) car.z -= car.range * 2;
        if (car.z < -car.range) car.z += car.range * 2;
      }
      updateMatrices();
    },
  };
}

/* ------------------------------------------------------------------ */

function createBridge() {
  const group = new THREE.Group();
  group.name = "NanpuBridge";

  const deckY = 46;
  const concrete = stoneMaterial(0xb4afa4, 0.85);

  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c2e31,
    roughness: 0.85,
    metalness: 0.08,
  });

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(1480, 3.4, 30),
    deckMaterial,
  );
  deck.position.set(0, deckY, BRIDGE_Z);
  group.add(deck);

  const railMaterial = metalMaterial(0x777d84, 0.45, 0.7);
  for (const z of [BRIDGE_Z - 15, BRIDGE_Z + 15]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(1480, 1.6, 0.5),
      railMaterial,
    );
    rail.position.set(0, deckY + 2.4, z);
    group.add(rail);
  }

  // 两岸引桥：从桥面高度缓降到地面
  for (const direction of [-1, 1]) {
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(640, 4, 26),
      deckMaterial,
    );
    ramp.position.set(direction * 1050, 25.5, BRIDGE_Z);
    ramp.rotation.z = -direction * 0.066;
    group.add(ramp);
  }

  const cablePositions = [];
  const pylonXs = [-232, 232];

  for (const pylonX of pylonXs) {
    for (const sideZ of [-13, 13]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(7, 184, 6.5),
        concrete,
      );
      leg.position.set(pylonX, 88, BRIDGE_Z + sideZ);
      leg.castShadow = true;
      group.add(leg);
    }

    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 6, 38),
      concrete,
    );
    beam.position.set(pylonX, deckY + 108, BRIDGE_Z);
    beam.castShadow = true;
    group.add(beam);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(5, 4, 34),
      concrete,
    );
    cap.position.set(pylonX, deckY + 132, BRIDGE_Z);
    group.add(cap);

    // 斜拉索
    for (const sideZ of [-13, 13]) {
      for (const offset of [28, 62, 100, 142, 188, 240]) {
        for (const direction of [-1, 1]) {
          const anchorX = pylonX + direction * offset;
          cablePositions.push(
            pylonX,
            deckY + 130,
            BRIDGE_Z + sideZ * 0.25,
            anchorX,
            deckY + 1,
            BRIDGE_Z + sideZ * 0.92,
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
    color: 0xd4dde8,
    transparent: true,
    opacity: 0.55,
  });
  const cables = new THREE.LineSegments(cableGeometry, cableMaterial);
  group.add(cables);

  // 桥面路灯
  const lampMaterial = emissiveMaterial(0xffdb9e, {
    type: "lamp",
    base: 1.0,
    baseColor: 0x272013,
    roughness: 0.4,
  });
  const lampGeometry = new THREE.SphereGeometry(0.6, 8, 6);
  const lampCount = 118;
  const lamps = new THREE.InstancedMesh(lampGeometry, lampMaterial, lampCount);
  const dummy = new THREE.Object3D();
  let index = 0;
  for (let x = -720; x <= 720 && index < lampCount; x += 24) {
    for (const z of [BRIDGE_Z - 14, BRIDGE_Z + 14]) {
      if (index >= lampCount) break;
      dummy.position.set(x, deckY + 3.6, z);
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
    for (const sideZ of [-13, 13]) {
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 10, 8),
        beaconMaterial,
      );
      beacon.position.set(pylonX, deckY + 136, BRIDGE_Z + sideZ);
      group.add(beacon);
    }
  }

  return {
    group,
    cableMaterial,
    beaconMaterial,
    update(elapsed, state) {
      cableMaterial.opacity = 0.35 + state.lampIntensity * 0.14;
      beaconMaterial.emissiveIntensity =
        state.neonIntensity *
        (Math.sin(elapsed * 1.8 + 2.3) > 0.5 ? 3 : 0.2);
    },
  };
}

/* ------------------------------------------------------------------ */

function createPudongWaterfront() {
  const group = new THREE.Group();

  const lampMaterial = emissiveMaterial(0xbfe4ff, {
    type: "lamp",
    base: 1.15,
    baseColor: 0x101820,
    roughness: 0.4,
  });
  const postMaterial = metalMaterial(0x2c3238, 0.5, 0.8);

  const postGeometry = new THREE.CylinderGeometry(0.09, 0.14, 5.4, 8);
  const headGeometry = new THREE.SphereGeometry(0.45, 10, 8);
  const count = 70;

  const posts = new THREE.InstancedMesh(postGeometry, postMaterial, count);
  const heads = new THREE.InstancedMesh(headGeometry, lampMaterial, count);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < count; i++) {
    const z = -1360 + i * 40;
    const x = RIVER.eastBank + 18;

    dummy.position.set(x, LAND_LEVEL + 3.2, z);
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, LAND_LEVEL + 5.9, z);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  }
  posts.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  group.add(posts, heads);

  // 滨江灯带在地面的光晕
  const glowMaterial = new THREE.MeshBasicMaterial({
    map: createGlowTexture(
      "rgba(190,230,255,0.85)",
      "rgba(120,200,255,0.22)",
      "rgba(80,170,255,0)",
    ),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glowGeometry = new THREE.PlaneGeometry(16, 16);
  const glows = new THREE.InstancedMesh(glowGeometry, glowMaterial, count);
  for (let i = 0; i < count; i++) {
    dummy.position.set(RIVER.eastBank + 18, LAND_LEVEL + 1.25, -1360 + i * 40);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.updateMatrix();
    glows.setMatrixAt(i, dummy.matrix);
  }
  glows.instanceMatrix.needsUpdate = true;
  group.add(glows);

  return {
    group,
    glowMaterial,
    update(elapsed, state) {
      glowMaterial.opacity = Math.min(0.42, state.lampIntensity * 0.2);
    },
  };
}

/* ------------------------------------------------------------------ */

export function createCity(scene) {
  const group = new THREE.Group();
  group.name = "City";

  const land = createLand();
  const roads = createRoads();
  const cars = createCars();
  const bridge = createBridge();
  const waterfront = createPudongWaterfront();

  group.add(land, roads, cars.group, bridge.group, waterfront.group);
  scene.add(group);

  return {
    group,
    update(delta, elapsed, state) {
      cars.update(delta);
      bridge.update(elapsed, state);
      waterfront.update(elapsed, state);
    },
  };
}
