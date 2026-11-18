import * as THREE from "three";
import { PEAKS, WORLD } from "../config.js";
import { clamp, fbm2, mix, ridged2, smoothstep } from "../utils/noise.js";

/**
 * 地形唯一真值：解析高度函数 heightAt(x, z)。
 *
 * 每座峰由「各向异性径向轮廓 + 脊线噪声 + 山脚裙坡」构成，
 * 峰之间取平滑最大值，避免简单相加把峰顶抬高；峰顶压平成建筑台地。
 */

const PEAK_DATA = PEAKS.map((peak) => ({
  ...peak,
  cos: Math.cos(peak.rotation),
  sin: Math.sin(peak.rotation),
  amplitude: peak.height - WORLD.valleyBase,
}));

/** 远离核心区的五条远山脊，让地平线不空。 */
const FAR_RIDGES = [
  { angle: 0.35, distance: 12300, width: 2400, height: 820, span: 0.85 },
  { angle: 1.75, distance: 14200, width: 3000, height: 1050, span: 1.0 },
  { angle: 2.9, distance: 11800, width: 2200, height: 760, span: 0.75 },
  { angle: 4.15, distance: 13600, width: 2800, height: 980, span: 0.95 },
  { angle: 5.3, distance: 12800, width: 2500, height: 700, span: 0.8 },
];

function peakLocal(peak, x, z) {
  const dx = x - peak.x;
  const dz = z - peak.z;
  const lx = (dx * peak.cos + dz * peak.sin) / peak.stretch;
  const lz = -dx * peak.sin + dz * peak.cos;
  return { lx, lz, d: Math.hypot(lx, lz), angle: Math.atan2(lz, lx) };
}

function peakBody(peak, x, z) {
  const { d, angle } = peakLocal(peak, x, z);
  const ridge = ridged2(
    Math.cos(angle) * 2.2 + peak.seed * 0.37,
    Math.sin(angle) * 2.2 - peak.seed * 0.21,
    3,
    peak.seed,
  );
  const radius = peak.radius * (0.8 + 0.34 * ridge);
  const t = clamp(1 - d / radius, 0, 1);
  const asym = 1 + 0.12 * Math.sin(angle * 3 + peak.seed);
  const core = peak.amplitude * Math.pow(t, 2.2) * asym;
  const skirt =
    220 *
    Math.exp(-Math.pow(d / (peak.radius * 2.2), 2)) *
    (0.9 + 0.2 * Math.sin(angle * 2 + peak.seed));
  return { body: core + skirt, d };
}

function farRidgeHeight(x, z) {
  const radial = Math.hypot(x, z);
  if (radial < 6000) return -Infinity;
  const theta = Math.atan2(z, x);
  let best = -Infinity;
  for (const ridge of FAR_RIDGES) {
    let delta = Math.abs(theta - ridge.angle);
    if (delta > Math.PI) delta = Math.PI * 2 - delta;
    const angular = Math.exp(-Math.pow(delta / ridge.span, 2) * 2.2);
    const radialTerm = Math.exp(
      -Math.pow((radial - ridge.distance) / ridge.width, 2),
    );
    best = Math.max(best, ridge.height * angular * radialTerm);
  }
  return best <= 0 ? -Infinity : WORLD.valleyBase + best;
}

export function heightAt(x, z) {
  const base =
    WORLD.valleyBase + 60 * fbm2(x * 0.00016, z * 0.00016, 4, 3);

  let peakMax = 0;
  let sum = 0;
  let nearest = PEAK_DATA[0];
  let nearestScore = Infinity;

  for (const peak of PEAK_DATA) {
    const { body, d } = peakBody(peak, x, z);
    peakMax = Math.max(peakMax, body);
    sum += body;
    const score = d / peak.plateau;
    if (score < nearestScore) {
      nearestScore = score;
      nearest = peak;
    }
  }

  let height = base + peakMax + 0.12 * Math.max(0, sum - peakMax);

  const detailWeight = smoothstep(
    nearest.plateau * 0.5,
    nearest.plateau * 2.2,
    nearestScore * nearest.plateau,
  );
  if (detailWeight > 0) {
    height += 24 * fbm2(x * 0.004, z * 0.004, 4, nearest.seed) * detailWeight;
    height -=
      14 *
      Math.pow(ridged2(x * 0.0018, z * 0.0018, 4, nearest.seed + 5), 2) *
      detailWeight;
  }

  const plateauWeight =
    1 - smoothstep(nearest.plateau, nearest.plateau * 1.6, nearestScore * nearest.plateau);
  if (plateauWeight > 0) {
    height = mix(height, nearest.height, plateauWeight);
  }

  const far = farRidgeHeight(x, z);
  if (far > height) height = far;

  return height;
}

export function peakHeightAt(peakId) {
  const peak = PEAKS.find((item) => item.id === peakId);
  if (!peak) throw new Error(`unknown peak ${peakId}`);
  return heightAt(peak.x, peak.z);
}

const _normalTarget = new THREE.Vector3();

export function normalAt(x, z, target = _normalTarget) {
  const step = 4;
  const left = heightAt(x - step, z);
  const right = heightAt(x + step, z);
  const back = heightAt(x, z - step);
  const front = heightAt(x, z + step);
  return target.set(left - right, step * 2, back - front).normalize();
}

export { PEAKS };
