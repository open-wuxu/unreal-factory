import assert from "node:assert/strict";
import { PEAKS } from "../src/config.js";
import { heightAt } from "../src/world/shape.js";

const byId = Object.fromEntries(PEAKS.map((peak) => [peak.id, peak]));
assert.equal(PEAKS.length, 7);

const tt = byId.tongtian;
assert.deepEqual([tt.x, tt.z, tt.height], [0, 0, 1790], "tongtian at center");

const ringIds = ["longshou", "dazhu", "fenghui", "luoxia", "xiaozhu", "chaoyang"];
const inDirection = {
  longshou: (p) => p.x > 800 && p.z < -800,
  dazhu: (p) => p.x < -800 && p.z < -800,
  fenghui: (p) => p.x < -2000 && Math.abs(p.z) < Math.abs(p.x),
  luoxia: (p) => p.x < -800 && p.z > 800,
  xiaozhu: (p) => p.x > 800 && p.z > 800,
  chaoyang: (p) => p.x > 2000 && Math.abs(p.z) < Math.abs(p.x),
};
for (const id of ringIds) {
  assert.ok(inDirection[id](byId[id]), `${id} not in its direction`);
  const ratio = byId[id].height / tt.height;
  assert.ok(ratio >= 0.55 && ratio <= 0.78, `${id} ratio ${ratio}`);
  assert.ok(byId[id].height < tt.height, `${id} not lower than tongtian`);
}

const heights = ringIds.map((id) => byId[id].height);
assert.equal(new Set(heights).size, heights.length, "six peaks must differ");

const rings = ringIds.map((id) => Math.hypot(byId[id].x, byId[id].z));
assert.ok(Math.max(...rings) - Math.min(...rings) > 100, "rings too regular");

for (let i = 0; i < PEAKS.length; i++) {
  for (let j = i + 1; j < PEAKS.length; j++) {
    const a = PEAKS[i];
    const b = PEAKS[j];
    assert.ok(
      Math.hypot(a.x - b.x, a.z - b.z) > 2000,
      `${a.id}/${b.id} too close`,
    );
  }
}

// 峰间关系：至少 2 组峰间存在低于云顶的深谷；指定两组相邻峰之间
// 存在高于云顶、但明显低于两侧主峰的低矮连接山脊。
let valleys = 0;
for (let i = 0; i < PEAKS.length; i++) {
  for (let j = i + 1; j < PEAKS.length; j++) {
    const a = PEAKS[i];
    const b = PEAKS[j];
    let low = Infinity;
    for (let s = 1; s < 20; s++) {
      const u = s / 20;
      low = Math.min(low, heightAt(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u));
    }
    if (low < 1080) valleys++;
  }
}
assert.ok(valleys >= 2, `only ${valleys} valleys between peaks`);

for (const [aId, bId] of [
  ["longshou", "chaoyang"],
  ["fenghui", "luoxia"],
]) {
  const a = byId[aId];
  const b = byId[bId];
  let high = -Infinity;
  for (let s = 4; s <= 16; s++) {
    const u = s / 20;
    high = Math.max(
      high,
      heightAt(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u),
    );
  }
  assert.ok(high > 1080, `${aId}/${bId} has no ridge above the cloud sea`);
  assert.ok(
    high < Math.min(a.height, b.height) - 100,
    `${aId}/${bId} ridge is not low enough (${high})`,
  );
}

console.log("layout ok");
