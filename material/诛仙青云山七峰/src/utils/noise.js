/**
 * 确定性噪声与随机数。
 *
 * 所有地形、植被与贴图随机都从这里取，保证每次打开的画面一致。
 */

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function mix(a, b, t) {
  return a + (b - a) * t;
}

/** mulberry32：可复现的 0..1 随机数发生器。 */
export function seededRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 二维整数哈希，返回 0..1。 */
export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** 双线性平滑的值噪声，返回 0..1。 */
export function valueNoise2(x, y, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const sx = xi + Math.imul(seed | 0, 1013);
  const sy = yi - Math.imul(seed | 0, 7919);
  const a = hash2(sx, sy);
  const b = hash2(sx + 1, sy);
  const c = hash2(sx, sy + 1);
  const d = hash2(sx + 1, sy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** 多尺度分形噪声，返回 -1..1。 */
export function fbm2(x, y, octaves = 4, seed = 0) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum +=
      (valueNoise2(x * frequency, y * frequency, seed + i * 31) * 2 - 1) *
      amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / norm;
}

/** 山脊噪声，返回 0..1；用于山脊、冲沟与云层细节。 */
export function ridged2(x, y, octaves = 4, seed = 0) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = valueNoise2(x * frequency, y * frequency, seed + i * 17);
    const ridge = 1 - Math.abs(n * 2 - 1);
    sum += ridge * ridge * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / norm;
}
