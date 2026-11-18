import assert from "node:assert/strict";
import * as THREE from "three";
import { createVegetation } from "../src/world/vegetation.js";
import { heightAt } from "../src/world/shape.js";

const scene = new THREE.Scene();
const vegetation = createVegetation(scene);

assert.ok(vegetation.group, "vegetation group missing");
const { counts, samplePoints } = vegetation;

assert.ok(
  counts.bamboo.dazhu >= 12000 && counts.bamboo.dazhu <= 15000,
  `dazhu bamboo ${counts.bamboo.dazhu}`,
);
assert.ok(
  counts.bamboo.xiaozhu >= 5000 && counts.bamboo.xiaozhu <= 7000,
  `xiaozhu bamboo ${counts.bamboo.xiaozhu}`,
);
assert.equal(
  counts.bamboo.total,
  counts.bamboo.dazhu + counts.bamboo.xiaozhu,
);
assert.ok(counts.pine >= 800 && counts.pine <= 1200, `pine ${counts.pine}`);
assert.ok(
  counts.autumn >= 500 && counts.autumn <= 700,
  `autumn ${counts.autumn}`,
);
assert.ok(counts.grass >= 3000, `grass ${counts.grass}`);

assert.ok(samplePoints.length >= 200, "not enough sample points");
for (const point of samplePoints.slice(0, 300)) {
  assert.ok(
    Math.abs(heightAt(point.x, point.z) - point.y) < 2,
    `vegetation not grounded at ${point.x},${point.z}`,
  );
}

let instanced = 0;
vegetation.group.traverse((object) => {
  if (!object.isInstancedMesh) return;
  instanced++;
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < object.count; i++) {
    object.getMatrixAt(i, matrix);
    for (const value of matrix.elements) {
      assert.ok(Number.isFinite(value), "non-finite instance matrix");
    }
  }
});
assert.ok(instanced >= 6, `only ${instanced} instanced meshes`);

console.log("vegetation ok");
