import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createBalustrade,
  createGate,
  createHall,
  createIncenseBurner,
  createLantern,
  createPlatform,
  createRoof,
  createStaircase,
  createStele,
} from "../src/world/buildings.js";
import { PEAKS } from "../src/config.js";
import { createPeaks, mergeStaticMeshes } from "../src/world/peaks.js";
import { heightAt } from "../src/world/shape.js";

function countMeshes(group) {
  let count = 0;
  group.traverse((object) => {
    if (object.isMesh) count++;
  });
  return count;
}

function assertFinite(group, name) {
  group.updateMatrixWorld(true);
  let meshes = 0;
  group.traverse((object) => {
    if (!object.isMesh) return;
    meshes++;
    const positions = object.geometry.getAttribute("position");
    assert.ok(positions, `${name}: mesh without positions`);
    for (let i = 0; i < positions.count; i++) {
      assert.ok(
        Number.isFinite(positions.getX(i)) &&
          Number.isFinite(positions.getY(i)) &&
          Number.isFinite(positions.getZ(i)),
        `${name}: non-finite vertex`,
      );
    }
  });
  assert.ok(meshes > 0, `${name}: no meshes`);
  return meshes;
}

const roofOne = createRoof({ width: 20, depth: 12, height: 6, tiers: 1 });
const roofTwo = createRoof({ width: 20, depth: 12, height: 6, tiers: 2 });
assertFinite(roofOne, "roof-one");
assertFinite(roofTwo, "roof-two");
assert.ok(
  countMeshes(roofTwo) > countMeshes(roofOne),
  "two-tier roof has more meshes",
);

const stair = createStaircase({
  from: new THREE.Vector3(0, 0, 0),
  to: new THREE.Vector3(0, 12, 30),
  width: 6,
  risers: 12,
});
assertFinite(stair, "staircase");
const stairBox = new THREE.Box3().setFromObject(stair);
assert.ok(Math.abs(stairBox.max.y - 12) < 0.8, `stair rise ${stairBox.max.y}`);

const pieces = [
  ["platform", createPlatform({ width: 30, depth: 20, height: 3, steps: 3 })],
  ["hall", createHall({ width: 26, depth: 16, height: 9, bays: 5 })],
  ["gate", createGate({ width: 14, height: 10 })],
  [
    "balustrade",
    createBalustrade({
      points: [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(20, 0, 0),
        new THREE.Vector3(20, 0, 20),
      ],
      height: 1.1,
    }),
  ],
  ["lantern", createLantern({ height: 4 }).group],
  ["burner", createIncenseBurner({ size: 3 })],
  ["stele", createStele({ width: 3, height: 5, text: "青云" })],
];

for (const [name, group] of pieces) assertFinite(group, name);

const scene = new THREE.Scene();
const peaks = createPeaks(scene);
assert.equal(Object.keys(peaks.complexes).length, PEAKS.length);

for (const peak of PEAKS) {
  const complex = peaks.complexes[peak.id];
  assert.ok(complex, `${peak.id}: missing complex`);
  assert.ok(
    Math.abs(complex.plateauY - peak.height) < 1,
    `${peak.id}: plateau height`,
  );
  assert.ok(
    Math.abs(heightAt(complex.center.x, complex.center.z) - peak.height) < 6,
    `${peak.id}: plateau does not match terrain`,
  );

  const peakGroup = peaks.group.children.find(
    (child) => child.userData.peakId === peak.id,
  );
  assert.ok(peakGroup, `${peak.id}: missing peak group`);
  peakGroup.updateMatrixWorld(true);

  let buildings = 0;
  for (const child of peakGroup.children) {
    if (!child.isGroup) continue;
    if (child.name === "staircase") {
      child.updateMatrixWorld(true);
      let treads = 0;
      child.traverse((object) => {
        if (!object.userData.stairTread) return;
        treads++;
        const point = new THREE.Vector3();
        object.getWorldPosition(point);
        const treadTop = point.y + 0.3;
        const ground = heightAt(point.x, point.z);
        assert.ok(
          Math.abs(treadTop - ground) < 3,
          `${peak.id}: stair tread floats ${(treadTop - ground).toFixed(1)} m`,
        );
      });
      assert.ok(treads > 10, `${peak.id}: only ${treads} stair treads`);
      continue;
    }

    buildings++;
    const position = new THREE.Vector3();
    child.getWorldPosition(position);
    const ground = heightAt(position.x, position.z);
    const box = new THREE.Box3().setFromObject(child);
    assert.ok(
      Math.abs(box.min.y - ground) < 12,
      `${peak.id}: ${child.name || "building"} floats ${
        (box.min.y - ground).toFixed(1)
      } m above ground`,
    );
  }
  assert.ok(buildings >= 5, `${peak.id}: only ${buildings} buildings`);
}

const meshesBefore = countMeshes(peaks.group);
const merged = mergeStaticMeshes(peaks.group);
const meshesAfter = countMeshes(merged);
assert.ok(meshesAfter < 80, `merged meshes still ${meshesAfter}`);
assert.ok(
  meshesBefore > meshesAfter * 10,
  `merge did not reduce meshes (${meshesBefore} -> ${meshesAfter})`,
);

console.log(`buildings ok (merged ${meshesBefore} -> ${meshesAfter} meshes)`);
