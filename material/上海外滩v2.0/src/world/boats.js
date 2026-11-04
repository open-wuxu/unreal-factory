import * as THREE from "three";
import { WORLD } from "../config.js";
import { river } from "./river.js";
import { createGlowTexture } from "../utils/textures.js";
import { emissiveMaterial, metalMaterial } from "./materials.js";

/**
 * 黄浦江上的游船与货轮。
 * 所有船只沿河道中心线的不同航线（横向偏移）连续行驶，
 * 船头方向由河道切线决定，因此会自然地跟随 U 形弯道转弯。
 */

const WATER_Y = WORLD.waterLevel;

/** 船体俯视轮廓，挤出成带船艏的船壳。 */
function createHullGeometry(length = 30, width = 10, depth = 3.2) {
  const shape = new THREE.Shape();
  const halfLength = length / 2;
  const halfWidth = width / 2;
  shape.moveTo(-halfWidth, -halfLength);
  shape.lineTo(halfWidth, -halfLength);
  shape.lineTo(halfWidth, halfLength * 0.36);
  shape.quadraticCurveTo(halfWidth, halfLength * 0.86, 0, halfLength);
  shape.quadraticCurveTo(-halfWidth, halfLength * 0.86, -halfWidth, halfLength * 0.36);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 8,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createGlowMaterial(inner, mid, outer) {
  return new THREE.MeshBasicMaterial({
    map: createGlowTexture(inner, mid, outer),
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function createBoat({
  hullColor = 0xf2f4f6,
  stripeColor = 0x1f5d8a,
  cabinLevels = 2,
  scale = 1,
}) {
  const group = new THREE.Group();

  const hullMaterial = new THREE.MeshStandardMaterial({
    color: hullColor,
    metalness: 0.18,
    roughness: 0.45,
  });
  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: stripeColor,
    metalness: 0.3,
    roughness: 0.4,
  });
  const windowMaterial = emissiveMaterial(0xffe0a4, {
    type: "boat",
    base: 1.5,
    baseColor: 0x1c150c,
    roughness: 0.4,
  });

  const hull = new THREE.Mesh(createHullGeometry(30, 10, 3.2), hullMaterial);
  hull.position.y = 1.7;
  group.add(hull);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(10.1, 0.6, 24),
    stripeMaterial,
  );
  stripe.position.y = 1.1;
  group.add(stripe);

  // 甲板舱室
  let topY = 1.7;
  const cabinMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9eef2,
    metalness: 0.1,
    roughness: 0.5,
  });

  for (let level = 0; level < cabinLevels; level++) {
    const shrink = 1 - level * 0.14;
    const height = 2.4;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(8.4 * shrink, height, 16 * shrink),
      cabinMaterial,
    );
    cabin.position.set(0, topY + height / 2, level === 0 ? 0.5 : -0.4);
    group.add(cabin);

    const windows = new THREE.Mesh(
      new THREE.BoxGeometry(8.5 * shrink, height * 0.42, 16.1 * shrink),
      windowMaterial,
    );
    windows.position.set(0, topY + height * 0.58, level === 0 ? 0.5 : -0.4);
    group.add(windows);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(8.9 * shrink, 0.3, 16.6 * shrink),
      cabinMaterial,
    );
    roof.position.set(0, topY + height + 0.15, level === 0 ? 0.5 : -0.4);
    group.add(roof);

    topY += height + 0.3;
  }

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 6, 6),
    metalMaterial(0x8b949c, 0.4, 0.8),
  );
  mast.position.set(0, topY + 3, -1);
  group.add(mast);

  const mastLightMaterial = emissiveMaterial(0xfff3d0, {
    type: "boat",
    base: 1.4,
    baseColor: 0x1c1a12,
  });
  const mastLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    mastLightMaterial,
  );
  mastLight.position.set(0, topY + 6, -1);
  group.add(mastLight);

  const portLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    emissiveMaterial(0xff3b30, {
      type: "boat",
      base: 1.6,
      baseColor: 0x200604,
    }),
  );
  portLight.position.set(-5.05, 1.9, 6);
  group.add(portLight);

  const starboardLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    emissiveMaterial(0x35ff8a, {
      type: "boat",
      base: 1.6,
      baseColor: 0x04180c,
    }),
  );
  starboardLight.position.set(5.05, 1.9, 6);
  group.add(starboardLight);

  const wakeMaterial = createGlowMaterial(
    "rgba(225,240,255,0.55)",
    "rgba(190,225,245,0.16)",
    "rgba(160,205,235,0)",
  );
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(14, 44), wakeMaterial);
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, 0.12, -30);
  group.add(wake);

  group.scale.setScalar(scale);
  group.userData.wakeMaterial = wakeMaterial;

  return group;
}

/* ------------------------------------------------------------------ */
/* 货轮                                                                */
/* ------------------------------------------------------------------ */

function createFreighter({
  u = 0,
  lane = 0,
  dir = 1,
  speed = 5,
  hullColor = 0x2c3b52,
  scale = 1.6,
}) {
  const group = new THREE.Group();

  const hullMaterial = new THREE.MeshStandardMaterial({
    color: hullColor,
    metalness: 0.35,
    roughness: 0.55,
  });
  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x777d80,
    metalness: 0.3,
    roughness: 0.6,
  });

  const hull = new THREE.Mesh(createHullGeometry(96, 24, 9), hullMaterial);
  hull.position.y = 4.5;
  group.add(hull);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(22, 0.8, 78), deckMaterial);
  deck.position.y = 9.2;
  group.add(deck);

  // 集装箱：一个 InstancedMesh 完成整船货柜
  const containerGeometry = new THREE.BoxGeometry(2.6, 2.8, 6.2);
  const containerMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.35,
    roughness: 0.55,
  });
  const palette = [0x9b3a2e, 0x2f5f8a, 0x3d7a52, 0xc08b35, 0x8d8f92, 0x6b4d7a];
  const rows = 5;
  const columns = 6;
  const stacks = 2;
  const containers = new THREE.InstancedMesh(
    containerGeometry,
    containerMaterial,
    rows * columns * stacks,
  );
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let index = 0;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      for (let stack = 0; stack < stacks; stack++) {
        dummy.position.set(
          -10 + column * 3.1,
          10.3 + stack * 2.9,
          -22 + row * 12 + (stack % 2) * 1.4,
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        containers.setMatrixAt(index, dummy.matrix);
        containers.setColorAt(
          index,
          color.setHex(palette[(row * 7 + column * 3 + stack) % palette.length]),
        );
        index++;
      }
    }
  }
  containers.instanceMatrix.needsUpdate = true;
  containers.instanceColor.needsUpdate = true;
  group.add(containers);

  // 舰桥与烟囱（船尾）
  const bridgeMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8e9e6,
    metalness: 0.1,
    roughness: 0.5,
  });
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(16, 18, 14),
    bridgeMaterial,
  );
  bridge.position.set(0, 18, -39);
  group.add(bridge);

  const bridgeWindows = new THREE.Mesh(
    new THREE.BoxGeometry(16.4, 4, 14.4),
    emissiveMaterial(0xffe0a4, {
      type: "boat",
      base: 1.4,
      baseColor: 0x1c150c,
      roughness: 0.4,
    }),
  );
  bridgeWindows.position.set(0, 23, -39);
  group.add(bridgeWindows);

  const funnel = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.6, 8, 10),
    new THREE.MeshStandardMaterial({
      color: 0x30343a,
      roughness: 0.6,
      metalness: 0.4,
    }),
  );
  funnel.position.set(0, 30, -42);
  group.add(funnel);

  const mastLightMaterial = emissiveMaterial(0xfff3d0, {
    type: "boat",
    base: 1.5,
    baseColor: 0x1c1a12,
  });
  const mastLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 8, 6),
    mastLightMaterial,
  );
  mastLight.position.set(0, 40, -39);
  group.add(mastLight);

  const wakeMaterial = createGlowMaterial(
    "rgba(225,240,255,0.5)",
    "rgba(190,225,245,0.14)",
    "rgba(160,205,235,0)",
  );
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(30, 90), wakeMaterial);
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, 0.15, -90);
  group.add(wake);

  group.scale.setScalar(scale);
  group.userData.wakeMaterial = wakeMaterial;
  group.userData.laneOffset = lane;
  group.userData.dir = dir;
  group.userData.speed = speed;
  group.userData.u = u;
  group.userData.bobPhase = Math.random() * Math.PI * 2;
  group.userData.cruise = false;

  return group;
}

/* ------------------------------------------------------------------ */
/* 组装                                                                */
/* ------------------------------------------------------------------ */

export function createBoats(scene) {
  const group = new THREE.Group();
  group.name = "Boats";

  const cruiseDefinitions = [
    { u: 0.05, lane: -95, dir: 1, speed: 8.5, cabinLevels: 2, hullColor: 0xf4f6f8, stripeColor: 0x1f5d8a, scale: 1.15 },
    { u: 0.24, lane: 110, dir: -1, speed: 7.4, cabinLevels: 2, hullColor: 0xeceff2, stripeColor: 0x8b2f3a, scale: 0.95 },
    { u: 0.37, lane: -35, dir: 1, speed: 6.6, cabinLevels: 3, hullColor: 0xf6f7f8, stripeColor: 0x2b6e6a, scale: 1.3 },
    { u: 0.51, lane: 150, dir: -1, speed: 7.8, cabinLevels: 1, hullColor: 0xdfe6ee, stripeColor: 0x2a3d6b, scale: 0.8 },
    { u: 0.62, lane: -140, dir: 1, speed: 6.2, cabinLevels: 2, hullColor: 0xf2eee6, stripeColor: 0x9a6b2f, scale: 0.9 },
    { u: 0.78, lane: 60, dir: -1, speed: 7.0, cabinLevels: 2, hullColor: 0xf4f6f8, stripeColor: 0x315c7a, scale: 1.05 },
  ];

  const boats = [];

  for (const definition of cruiseDefinitions) {
    const mesh = createBoat(definition);
    mesh.userData.u = definition.u;
    mesh.userData.laneOffset = definition.lane;
    mesh.userData.dir = definition.dir;
    mesh.userData.speed = definition.speed;
    mesh.userData.bobPhase = Math.random() * Math.PI * 2;
    mesh.userData.cruise = true;
    boats.push(mesh);
    group.add(mesh);
  }

  const freighters = [
    createFreighter({
      u: 0.31,
      lane: -165,
      dir: 1,
      speed: 5.2,
      hullColor: 0x2c3b52,
    }),
    createFreighter({
      u: 0.83,
      lane: 175,
      dir: -1,
      speed: 4.6,
      hullColor: 0x5a2b2b,
    }),
  ];
  freighters.forEach((mesh) => {
    boats.push(mesh);
    group.add(mesh);
  });

  scene.add(group);

  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const t = new THREE.Vector3();

  return {
    group,
    update(delta, elapsed, state) {
      for (const mesh of boats) {
        const data = mesh.userData;
        data.u += (data.dir * data.speed * delta) / river.length;
        if (data.u > 1) data.u -= 1;
        if (data.u < 0) data.u += 1;

        river.pointAt(data.u, p);
        river.normalAt(data.u, n);
        river.tangentAt(data.u, t);

        const x = p.x + n.x * data.laneOffset;
        const z = p.z + n.z * data.laneOffset;
        const bob = Math.sin(elapsed * 0.85 + data.bobPhase) * 0.16;
        const sink = data.cruise ? 0 : -1.2;

        mesh.position.set(x, WATER_Y + sink + bob, z);
        mesh.rotation.y = Math.atan2(t.x * data.dir, t.z * data.dir);
        mesh.rotation.x = Math.sin(elapsed * 0.72 + data.bobPhase) * 0.012;
        mesh.rotation.z = Math.sin(elapsed * 0.93 + data.bobPhase * 1.4) * 0.01;

        const wakeMaterial = data.wakeMaterial;
        if (wakeMaterial) {
          wakeMaterial.opacity =
            0.35 + state.boatLight * 0.22 + Math.sin(elapsed * 3 + data.bobPhase) * 0.03;
        }
      }
    },
  };
}
