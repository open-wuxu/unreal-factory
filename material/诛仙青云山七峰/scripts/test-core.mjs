import assert from "node:assert/strict";
import { PEAKS, SUN_KEYS, WORLD, sunDirectionAt } from "../src/config.js";
import { heightAt, normalAt, peakHeightAt } from "../src/world/shape.js";
import { seededRandom, fbm2, valueNoise3 } from "../src/utils/noise.js";

for (const p of PEAKS) {
  assert.ok(Math.abs(peakHeightAt(p.id) - p.height) < 2, `${p.id} summit`);
  assert.ok(heightAt(p.x, p.z) > WORLD.cloudTop, `${p.id} above clouds`);
}
const saddle = heightAt(-1000, 1300);
assert.ok(saddle < 1000, `saddle too high: ${saddle}`);
for (let i = 0; i < PEAKS.length; i++)
  for (let j = i + 1; j < PEAKS.length; j++) {
    const a = PEAKS[i],
      b = PEAKS[j];
    assert.ok(
      Math.hypot(a.x - b.x, a.z - b.z) > 2000,
      `${a.id}/${b.id} too close`,
    );
  }
const n = normalAt(0, 0);
assert.ok(Math.abs(n.length() - 1) < 1e-3, "normal unit");
const r1 = seededRandom(7),
  r2 = seededRandom(7);
assert.equal(r1(), r2());
assert.ok(Number.isFinite(fbm2(12.3, -4.5, 4, 9)));
assert.equal(heightAt(0, 0), heightAt(0, 0));

// 方环接缝由 test-terrain.mjs 直接检查几何体顶点与缝合带。
assert.equal(SUN_KEYS[0].t, 0);
assert.equal(SUN_KEYS[SUN_KEYS.length - 1].t, 36);
const sunStart = sunDirectionAt(0);
const sunEnd = sunDirectionAt(36);
assert.ok(Math.abs(sunStart.length() - 1) < 1e-3, "sun start unit");
assert.ok(Math.abs(sunEnd.length() - 1) < 1e-3, "sun end unit");
assert.ok(sunEnd.y < sunStart.y, "sun sets over the film");
assert.ok(sunStart.x < 0, "sun in the west");

// 三维云噪声必须可平铺，避免云层出现接缝。
const cloudSample = valueNoise3(0.31, 0.47, 0.12, 5, 8);
assert.ok(
  Math.abs(cloudSample - valueNoise3(8.31, 0.47, 0.12, 5, 8)) < 1e-6,
  "cloud noise must tile",
);
assert.ok(cloudSample >= 0 && cloudSample <= 1);

console.log("core ok");
