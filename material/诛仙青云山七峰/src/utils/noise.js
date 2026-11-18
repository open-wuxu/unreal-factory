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

function hash3(x, y, z, seed = 0) {
  let h =
    Math.imul(x | 0, 374761393) ^
    Math.imul(y | 0, 668265263) ^
    Math.imul(z | 0, 2246822519) ^
    Math.imul(seed | 0, 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function wrap(value, period) {
  if (period <= 0) return value;
  return ((value % period) + period) % period;
}

/** 可平铺的三维值噪声，返回 0..1。period 为整数晶格周期。 */
export function valueNoise3(x, y, z, seed = 0, period = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);

  const x0 = wrap(xi, period);
  const x1 = wrap(xi + 1, period);
  const y0 = wrap(yi, period);
  const y1 = wrap(yi + 1, period);
  const z0 = wrap(zi, period);
  const z1 = wrap(zi + 1, period);

  const c000 = hash3(x0, y0, z0, seed);
  const c100 = hash3(x1, y0, z0, seed);
  const c010 = hash3(x0, y1, z0, seed);
  const c110 = hash3(x1, y1, z0, seed);
  const c001 = hash3(x0, y0, z1, seed);
  const c101 = hash3(x1, y0, z1, seed);
  const c011 = hash3(x0, y1, z1, seed);
  const c111 = hash3(x1, y1, z1, seed);

  const a = c000 + (c100 - c000) * u;
  const b = c010 + (c110 - c010) * u;
  const c = c001 + (c101 - c001) * u;
  const d = c011 + (c111 - c011) * u;
  const e = a + (b - a) * v;
  const f = c + (d - c) * v;
  return e + (f - e) * w;
}

/** 可平铺三维 FBM，返回 -1..1；用于生成云噪声体纹理。 */
export function fbm3Tileable(u, v, w, octaves = 4, seed = 0, basePeriod = 8) {
  let sum = 0;
  let amplitude = 0.5;
  let period = basePeriod;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum +=
      (valueNoise3(
        u * period,
        v * period,
        w * period,
        seed + i * 19,
        period,
      ) *
        2 -
        1) *
      amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    period *= 2;
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
