import assert from "node:assert/strict";
import * as THREE from "three";
import { PEAKS } from "../src/config.js";
import { createTerrain } from "../src/world/terrain.js";
import { heightAt } from "../src/world/shape.js";

// 台地：距峰心 0.8×plateau 的八个方向都必须是配置高度。
for (const peak of PEAKS) {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radius = peak.plateau * 0.8;
    const x = peak.x + Math.cos(angle) * radius;
    const z = peak.z + Math.sin(angle) * radius;
    assert.ok(
      Math.abs(heightAt(x, z) - peak.height) < 2,
      `${peak.id}: plateau not flat at ${angle.toFixed(2)} (${heightAt(x, z)})`,
    );
  }
}

const scene = new THREE.Scene();
const terrain = createTerrain(scene);

function findVertex(geometry, x, z, tolerance = 0.02) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  for (let i = 0; i < position.count; i++) {
    if (
      Math.abs(position.getX(i) - x) < tolerance &&
      Math.abs(position.getZ(i) - z) < tolerance
    ) {
      return i;
    }
  }
  return -1;
}

const BOUNDARIES = [
  { inner: 2400, fineCell: 15, coarseRing: 1 },
  { inner: 4800, fineCell: 30, coarseRing: 2 },
  { inner: 9600, fineCell: 60, coarseRing: 3 },
];

for (const boundary of BOUNDARIES) {
  const fineRing = terrain.group.children[boundary.coarseRing - 1];
  const coarseRing = terrain.group.children[boundary.coarseRing];
  fineRing.updateMatrixWorld(true);
  coarseRing.updateMatrixWorld(true);

  const fineGeometry = fineRing.geometry;
  const coarseGeometry = coarseRing.geometry;
  // 粗环单元 = 细环单元 × 2，所以中点距内边界正好是一个细环单元。
  const midX = -boundary.inner + boundary.fineCell;
  const midZ = -boundary.inner;

  const fineIndex = findVertex(fineGeometry, midX, midZ);
  const coarseIndex = findVertex(coarseGeometry, midX, midZ);
  assert.ok(fineIndex >= 0, `fine ring missing seam vertex at ${midX},${midZ}`);
  assert.ok(
    coarseIndex >= 0,
    `coarse ring missing stitch vertex at ${midX},${midZ}`,
  );

  const finePosition = fineGeometry.getAttribute("position");
  const coarsePosition = coarseGeometry.getAttribute("position");
  const fineY = finePosition.getY(fineIndex);
  const coarseY = coarsePosition.getY(coarseIndex);
  const expected = heightAt(midX, midZ);
  assert.ok(
    Math.abs(fineY - coarseY) < 0.02,
    `seam height mismatch ${fineY} vs ${coarseY}`,
  );
  assert.ok(
    Math.abs(coarseY - expected) < 0.02,
    `stitch vertex not on terrain ${coarseY} vs ${expected}`,
  );

  const fineNormal = fineGeometry.getAttribute("normal");
  const coarseNormal = coarseGeometry.getAttribute("normal");
  const normalDelta =
    Math.abs(fineNormal.getX(fineIndex) - coarseNormal.getX(coarseIndex)) +
    Math.abs(fineNormal.getY(fineIndex) - coarseNormal.getY(coarseIndex)) +
    Math.abs(fineNormal.getZ(fineIndex) - coarseNormal.getZ(coarseIndex));
  assert.ok(normalDelta < 0.05, `normal seam ${normalDelta}`);

  const fineColor = fineGeometry.getAttribute("color");
  const coarseColor = coarseGeometry.getAttribute("color");
  const colorDelta =
    Math.abs(fineColor.getX(fineIndex) - coarseColor.getX(coarseIndex)) +
    Math.abs(fineColor.getY(fineIndex) - coarseColor.getY(coarseIndex)) +
    Math.abs(fineColor.getZ(fineIndex) - coarseColor.getZ(coarseIndex));
  assert.ok(colorDelta < 0.08, `color/AO seam ${colorDelta}`);
}

console.log("terrain ok");
