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

console.log("buildings ok");
