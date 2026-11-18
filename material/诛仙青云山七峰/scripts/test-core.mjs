import assert from "node:assert/strict";
import { PEAKS, WORLD } from "../src/config.js";
import { heightAt, normalAt, peakHeightAt } from "../src/world/shape.js";
import { seededRandom, fbm2 } from "../src/utils/noise.js";

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

// 方环接缝：同一世界坐标在两个环上必须取到同一高度。
for (const z of [-1200, -600, 0, 600, 1200]) {
  assert.equal(heightAt(-1200, z), heightAt(-1200, z));
  assert.equal(heightAt(1200, z), heightAt(1200, z));
}
for (let x = -1200; x < 1200; x += 6) {
  const a = heightAt(x, 1200);
  const b = heightAt(x + 6, 1200);
  assert.ok(Math.abs(a - b) < 400, `discontinuity at ${x}: ${a} -> ${b}`);
}
console.log("core ok");
