import assert from "node:assert/strict";
import * as THREE from "three";
import { PEAKS } from "../src/config.js";
import { createBirds } from "../src/world/birds.js";
import { createMist } from "../src/world/mist.js";
import { createWater } from "../src/world/water.js";
import { heightAt } from "../src/world/shape.js";

const scene = new THREE.Scene();
const water = createWater(scene);
const main = water.waterfalls.find((item) => item.kind === "main");
assert.ok(main, "main waterfall missing");
assert.ok(
  main.start.y - main.end.y > 300,
  `main drop ${main.start.y} -> ${main.end.y}`,
);

for (const fall of water.waterfalls) {
  for (let i = 0; i < fall.points.length; i++) {
    const point = fall.points[i];
    assert.ok(
      point.y >= heightAt(point.x, point.z) + 1,
      `${fall.kind} ribbon underground at ${i}`,
    );
    if (i > 0) {
      assert.ok(
        point.y <= fall.points[i - 1].y + 0.01,
        `${fall.kind} ribbon rises at ${i}`,
      );
    }
  }
  for (let i = 0; i < fall.sprayPositions.length; i += 3) {
    const dx = fall.sprayPositions[i] - fall.end.x;
    const dy = fall.sprayPositions[i + 1] - fall.end.y;
    const dz = fall.sprayPositions[i + 2] - fall.end.z;
    assert.ok(
      Math.hypot(dx, dy, dz) < fall.width * 2.5,
      `${fall.kind} spray detached`,
    );
  }
}

for (const pond of water.ponds) {
  assert.ok(
    Math.abs(pond.y - heightAt(pond.x, pond.z)) < 1.5,
    `${pond.kind} pond not grounded`,
  );
}

const tributary = water.waterfalls.find((item) => item.kind === "tributary");
assert.ok(tributary, "dazhu tributary waterfall missing");
const drop = tributary.start.y - tributary.end.y;
assert.ok(drop >= 80 && drop <= 220, `tributary drop ${drop}`);
assert.ok(
  Math.abs(heightAt(tributary.start.x, tributary.start.z) + 1 - tributary.start.y) < 12,
  "tributary start not grounded",
);
assert.ok(
  Math.abs(heightAt(tributary.end.x, tributary.end.z) + 1 - tributary.end.y) < 12,
  "tributary end not grounded",
);
const dazhu = PEAKS.find((peak) => peak.id === "dazhu");
assert.ok(
  Math.hypot(tributary.start.x - dazhu.x, tributary.start.z - dazhu.z) < dazhu.radius * 0.6,
  "tributary not on dazhu",
);

const streamPeaks = ["dazhu", "xiaozhu"];
for (const peakId of streamPeaks) {
  const peak = PEAKS.find((item) => item.id === peakId);
  const near = water.streams.some((stream) => {
    const p0 = stream.points[0];
    const p1 = stream.points[stream.points.length - 1];
    return Math.min(
      Math.hypot(p0.x - peak.x, p0.z - peak.z),
      Math.hypot(p1.x - peak.x, p1.z - peak.z),
    ) < peak.radius * 0.8;
  });
  assert.ok(near, `no stream near ${peakId}`);
}

const mist = createMist(scene);
assert.ok(mist.group.children.length >= 3, "not enough mist sheets");

const birds = createBirds(scene);
assert.ok(birds.flocks.length >= 3, "not enough bird flocks");
for (const flock of birds.flocks) {
  const [cx, , cz] = flock.definition.center;
  assert.ok(
    PEAKS.some((peak) => Math.hypot(cx - peak.x, cz - peak.z) < 400),
    `flock at ${cx},${cz} not anchored to a peak`,
  );
  for (const sample of flock.samples) {
    assert.ok(
      sample.y > heightAt(sample.x, sample.z) + 120,
      `crane too low at ${sample.x},${sample.z}`,
    );
  }
}

console.log("water ok");
