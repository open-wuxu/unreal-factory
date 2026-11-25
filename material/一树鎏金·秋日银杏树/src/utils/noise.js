/**
 * 固定种子随机与轻量噪声工具。
 *
 * 所有程序化几何、叶片分布和贴图都必须走这里，保证刷新页面、
 * 逐帧导出与关键帧截图看到的是同一棵树。
 */

/** mulberry32：小而稳定的 32 位种子随机数发生器。 */
export function seededRandom(seed = 1) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(random, min, max) {
  return min + (max - min) * random();
}

export function randSign(random) {
  return random() < 0.5 ? -1 : 1;
}

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/** 二维 value noise，返回 0..1。 */
export function noise2D(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

/** 分形 value noise，返回 0..1。 */
export function fbm2D(x, y, seed = 0, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise2D(x * frequency, y * frequency, seed + i * 131);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
}

/** 把值限制在 0..1。 */
export function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/** 平滑插值。 */
export function smooth01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}
