import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { PEAKS } from "../config.js";
import {
  createBalustrade,
  createBridge,
  createGate,
  createHall,
  createIncenseBurner,
  createLantern,
  createPagoda,
  createPavilion,
  createPlatform,
  createStaircase,
  createStele,
} from "./buildings.js";
import { heightAt } from "./shape.js";

/**
 * 七峰建筑群。
 *
 * 每座峰以峰顶台地中心为原点，朝山脉中心的方向为局部 +Z。
 * 建筑落位在压平的台地上，石阶沿坡面向下放样。
 */

function frameFor(peak) {
  const rotation = Math.atan2(-peak.x, -peak.z);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const toWorld = (lx, lz) =>
    new THREE.Vector3(
      peak.x + cos * lx + sin * lz,
      0,
      peak.z - sin * lx + cos * lz,
    );
  const groundLocal = (lx, lz) => {
    const world = toWorld(lx, lz);
    return heightAt(world.x, world.z) - peak.height;
  };
  return { rotation, toWorld, groundLocal };
}

function lantern(group, x, z, height = 4) {
  const lamp = createLantern({ height });
  lamp.group.position.set(x, 0, z);
  group.add(lamp.group);
}

function stairs(group, groundLocal, fromZ, toZ, width, risers) {
  const stair = createStaircase({
    from: new THREE.Vector3(0, 0, fromZ),
    to: new THREE.Vector3(0, groundLocal(0, toZ), toZ),
    width,
    risers,
    surfaceAt: (z) => groundLocal(0, fromZ + z),
  });
  stair.name = "staircase";
  group.add(stair);
}

function ringBalustrade(group, radius, height = 1.15) {
  const points = [];
  const segments = 14;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius,
      ),
    );
  }
  group.add(createBalustrade({ points, height }));
}

function furnishTongtian(group, groundLocal) {
  const main = createHall({
    width: 86,
    depth: 46,
    height: 22,
    bays: 9,
    roofHeight: 17,
    tiers: 2,
    steps: 4,
  });
  main.position.set(0, 0, -15);
  group.add(main);

  const rear = createHall({
    width: 46,
    depth: 26,
    height: 13,
    bays: 5,
    roofHeight: 10,
    tiers: 1,
    steps: 2,
  });
  rear.position.set(0, 0, -128);
  group.add(rear);

  for (const side of [-1, 1]) {
    const wing = createHall({
      width: 34,
      depth: 20,
      height: 12,
      bays: 5,
      roofHeight: 9,
      tiers: 1,
      steps: 2,
    });
    wing.position.set(side * 100, 0, -35);
    wing.rotation.y = side * (Math.PI / 2);
    group.add(wing);
  }

  const gate = createGate({ width: 26, height: 17, text: "青云" });
  gate.position.set(0, 0, 138);
  group.add(gate);

  stairs(group, groundLocal, 152, 470, 22, 150);

  const burner = createIncenseBurner({ size: 6 });
  burner.position.set(0, 0, 92);
  group.add(burner);

  lantern(group, -58, 64);
  lantern(group, 58, 64);
  lantern(group, -58, 122);
  lantern(group, 58, 122);

  const stele = createStele({ width: 5, height: 8, text: "通天" });
  stele.position.set(46, 0, 126);
  stele.rotation.y = -0.3;
  group.add(stele);

  ringBalustrade(group, 140, 1.2);
}

function furnishLongshou(group, groundLocal) {
  const hall = createHall({
    width: 32,
    depth: 18,
    height: 9,
    bays: 5,
    roofHeight: 7,
    tiers: 1,
    steps: 3,
  });
  hall.position.set(0, 0, -18);
  group.add(hall);

  const stele = createStele({ width: 3.4, height: 6, text: "龙首" });
  stele.position.set(20, 0, 26);
  stele.rotation.y = 0.4;
  group.add(stele);

  const walkway = createBridge({
    from: new THREE.Vector3(0, 1, 42),
    to: new THREE.Vector3(0, 1, 150),
    width: 3.2,
    arch: 1.2,
  });
  group.add(walkway);

  const deck = createPlatform({ width: 18, depth: 14, height: 1.6, steps: 2 });
  deck.position.set(0, 0, 146);
  group.add(deck);

  const pavilion = createPavilion({
    radius: 4,
    height: 4.5,
    roofHeight: 3,
  });
  pavilion.position.set(-32, 0, 18);
  group.add(pavilion);

  lantern(group, 26, 44, 3.4);
  lantern(group, -22, 4, 3.4);

  ringBalustrade(group, 82, 1.1);
}

function furnishLuoxia(group, groundLocal) {
  const pagoda = createPagoda({ radius: 6, levels: 4 });
  pagoda.position.set(-22, 0, -12);
  group.add(pagoda);

  const hall = createHall({
    width: 26,
    depth: 16,
    height: 9,
    bays: 4,
    roofHeight: 7,
    tiers: 1,
    steps: 2,
  });
  hall.position.set(24, 0, -34);
  hall.rotation.y = -0.35;
  group.add(hall);

  const pavilion = createPavilion({
    radius: 5,
    height: 4.6,
    roofHeight: 3.2,
  });
  pavilion.position.set(28, 0, 30);
  group.add(pavilion);

  lantern(group, -6, 34, 3.6);
  lantern(group, 46, 8, 3.6);

  const stele = createStele({ width: 3, height: 5.5, text: "落霞" });
  stele.position.set(-36, 0, 24);
  stele.rotation.y = 0.5;
  group.add(stele);

  ringBalustrade(group, 76, 1.05);
}

function furnishFenghui(group, groundLocal) {
  const hall = createHall({
    width: 30,
    depth: 18,
    height: 10,
    bays: 5,
    roofHeight: 8,
    tiers: 1,
    steps: 3,
  });
  hall.position.set(0, 0, -26);
  group.add(hall);

  const bridge = createBridge({
    from: new THREE.Vector3(-46, 0, 10),
    to: new THREE.Vector3(30, 0, 26),
    width: 4,
    arch: 2,
  });
  group.add(bridge);

  const deck = createPlatform({ width: 20, depth: 14, height: 2, steps: 2 });
  deck.position.set(0, 0, 56);
  group.add(deck);

  const pavilion = createPavilion({ radius: 4.5, height: 4.5 });
  pavilion.position.set(-46, 0, 44);
  group.add(pavilion);

  lantern(group, 14, 62, 3.8);
  lantern(group, -16, 62, 3.8);

  stairs(group, groundLocal, 70, 230, 7, 46);

  ringBalustrade(group, 80, 1.05);
}

function furnishDazhu(group, groundLocal) {
  const hall = createHall({
    width: 42,
    depth: 26,
    height: 10,
    bays: 5,
    roofHeight: 8,
    tiers: 1,
    steps: 3,
  });
  hall.position.set(0, 0, -12);
  group.add(hall);

  const gate = createGate({ width: 12, height: 8, text: "大竹" });
  gate.position.set(0, 0, 108);
  group.add(gate);

  const pavilion = createPavilion({ radius: 5, height: 4.4 });
  pavilion.position.set(-58, 0, 42);
  group.add(pavilion);

  const walkway = createBridge({
    from: new THREE.Vector3(-40, 0, 62),
    to: new THREE.Vector3(-96, 0, 120),
    width: 3,
    arch: 0.7,
  });
  group.add(walkway);

  lantern(group, 22, 76, 3.4);
  lantern(group, -26, 48, 3.4);

  ringBalustrade(group, 128, 1.1);
}

function furnishXiaozhu(group, groundLocal) {
  const hall = createHall({
    width: 22,
    depth: 14,
    height: 8,
    bays: 4,
    roofHeight: 6.5,
    tiers: 1,
    steps: 2,
  });
  hall.position.set(0, 0, -22);
  group.add(hall);

  const pavilion = createPavilion({
    radius: 5.5,
    height: 5,
    roofHeight: 3.6,
  });
  pavilion.position.set(0, 0, 38);
  group.add(pavilion);

  const gate = createGate({ width: 9, height: 6, text: "小竹" });
  gate.position.set(0, 0, 58);
  group.add(gate);

  stairs(group, groundLocal, 62, 200, 6, 40);

  const stele = createStele({ width: 2.6, height: 4.6, text: "望月" });
  stele.position.set(24, 0, 20);
  stele.rotation.y = -0.4;
  group.add(stele);

  lantern(group, -18, 52, 3.2);
  ringBalustrade(group, 62, 1);
}

function furnishChaoyang(group, groundLocal) {
  const gate = createGate({ width: 15, height: 10, text: "朝阳" });
  gate.position.set(0, 0, 88);
  group.add(gate);

  const hall = createHall({
    width: 36,
    depth: 20,
    height: 11,
    bays: 5,
    roofHeight: 8.5,
    tiers: 1,
    steps: 3,
  });
  hall.position.set(0, 0, -6);
  group.add(hall);

  const deck = createPlatform({ width: 26, depth: 18, height: 2, steps: 3 });
  deck.position.set(0, 0, 56);
  group.add(deck);

  const pavilion = createPavilion({ radius: 5, height: 4.6 });
  pavilion.position.set(-52, 0, 24);
  group.add(pavilion);

  stairs(group, groundLocal, 70, 230, 8, 50);

  lantern(group, 20, 58, 3.8);
  lantern(group, -20, 58, 3.8);

  ringBalustrade(group, 98, 1.1);
}

const FURNISH = {
  tongtian: furnishTongtian,
  longshou: furnishLongshou,
  luoxia: furnishLuoxia,
  fenghui: furnishFenghui,
  dazhu: furnishDazhu,
  xiaozhu: furnishXiaozhu,
  chaoyang: furnishChaoyang,
};

export function createPeaks(scene) {
  const group = new THREE.Group();
  group.name = "peaks";
  const complexes = {};

  for (const peak of PEAKS) {
    const peakGroup = new THREE.Group();
    peakGroup.name = `peak-${peak.id}`;
    peakGroup.userData.peakId = peak.id;
    const frame = frameFor(peak);
    peakGroup.position.set(peak.x, peak.height, peak.z);
    peakGroup.rotation.y = frame.rotation;

    FURNISH[peak.id]?.(peakGroup, frame.groundLocal);

    // 把每个建筑组坐落在其所在位置的真实地面上，避免台地边缘悬空。
    // 石阶已经按地形逐级铺板，单独处理。
    for (const child of peakGroup.children) {
      if (!child.isGroup || child.name === "staircase") continue;
      child.position.y = frame.groundLocal(child.position.x, child.position.z);
      child.userData.grounded = true;
    }

    group.add(peakGroup);

    const main = frame.toWorld(0, -15);
    complexes[peak.id] = {
      plateauY: peak.height,
      center: new THREE.Vector3(peak.x, peak.height, peak.z),
      landmark: new THREE.Vector3(main.x, peak.height + 22, main.z),
      rotation: frame.rotation,
    };
  }

  scene.add(group);

  return {
    group,
    complexes,
    update() {},
  };
}

/**
 * 把七峰里按材质分组的静态 Mesh 合并成少量几何体。
 * 3188 个独立 Mesh 会带来 3000+ draw call；合并后只剩十余个共享材质批次，
 * 列柱等 InstancedMesh 保持原样。
 */
export function mergeStaticMeshes(root) {
  root.updateMatrixWorld(true);
  const batches = new Map();
  const staticMeshes = [];

  root.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh) return;
    const material = object.material;
    if (!material || Array.isArray(material)) return;
    staticMeshes.push(object);
    if (!batches.has(material.uuid)) {
      batches.set(material.uuid, { material, geometries: [] });
    }
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") {
        geometry.deleteAttribute(name);
      }
    }
    batches.get(material.uuid).geometries.push(geometry);
  });

  for (const mesh of staticMeshes) {
    mesh.parent?.remove(mesh);
  }

  const mergedGroup = new THREE.Group();
  mergedGroup.name = "merged-static";

  for (const { material, geometries } of batches.values()) {
    if (geometries.length === 1) {
      const mesh = new THREE.Mesh(geometries[0], material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mergedGroup.add(mesh);
      continue;
    }
    const merged = mergeGeometries(geometries, false);
    if (merged) {
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mergedGroup.add(mesh);
      for (const geometry of geometries) geometry.dispose();
    } else {
      for (const geometry of geometries) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mergedGroup.add(mesh);
      }
    }
  }

  return mergedGroup;
}
