import assert from "node:assert/strict";
import * as THREE from "three";
import { createBirds } from "../src/world/birds.js";
import { createMist } from "../src/world/mist.js";
import { createWater } from "../src/world/water.js";
import { heightAt } from "../src/world/shape.js";

const scene = new THREE.Scene();
const water = createWater(scene);
assert.ok(water.waterfalls.length >= 1, "no waterfall");
for (const waterfall of water.waterfalls) {
  assert.ok(
    waterfall.start.y - waterfall.end.y > 300,
    `waterfall drop ${waterfall.start.y} -> ${waterfall.end.y}`,
  );
}
assert.ok(water.streams.length >= 2, "not enough streams");

const mist = createMist(scene);
assert.ok(mist.group.children.length >= 3, "not enough mist sheets");

const birds = createBirds(scene);
assert.ok(birds.flocks.length >= 3, "not enough bird flocks");
for (const flock of birds.flocks) {
  for (const sample of flock.samples) {
    assert.ok(
      sample.y > heightAt(sample.x, sample.z) + 120,
      `crane too low at ${sample.x},${sample.z}`,
    );
  }
}

console.log("water ok");
