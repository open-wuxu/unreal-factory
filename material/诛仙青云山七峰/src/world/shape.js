import * as THREE from "three";
import { PEAKS, WORLD } from "../config.js";
import { clamp, fbm2, mix, ridged2, smoothstep } from "../utils/noise.js";

/**
 * 地形唯一真值：解析高度函数 heightAt(x, z)。
 *
 * 每座峰由「域扭曲 + 角度脊线 + 悬崖带 + 卫星山脊 + 冲沟」构成。
 * 峰之间取平滑最大值，避免相加抬高；峰顶压平成建筑台地。
 */

const PEAK_DATA = PEAKS.map((peak, index) => {
  const spurs = [];
  for (let i = 0; i < 3; i++) {
    const angle = peak.rotation + i * 2.35 + (peak.seed % 7) * 0.24;
    const distance = peak.radius * (0.42 + i * 0.11);
    spurs.push({
      x: peak.x + Math.cos(angle) * distance,
      z: peak.z + Math.sin(angle) * distance,
      height: peak.height - WORLD.valleyBase,
      amplitude: 0.26 + 0.04 * i,
      spread: peak.radius * (0.4 - 0.04 * i),
      seed: peak.seed + 17 * (i + 1),
    });
  }
  return {
    ...peak,
    index,
    cos: Math.cos(peak.rotation),
    sin: Math.sin(peak.rotation),
    amplitude: peak.height - WORLD.valleyBase,
    offset: 0,
    spurs,
  };
});

function peakLocal(peak, x, z) {
  const dx = x - peak.x;
  const dz = z - peak.z;
  const lx = (dx * peak.cos + dz * peak.sin) / peak.stretch;
  const lz = -dx * peak.sin + dz * peak.cos;
  return { lx, lz, d: Math.hypot(lx, lz), angle: Math.atan2(lz, lx) };
}

function peakBody(peak, x, z) {
  // 域扭曲：让山脊与沟壑自然弯曲，而不是笔直的圆锥母线。
  const warpX = x + 190 * fbm2(x * 0.0011, z * 0.0011, 3, peak.seed + 1);
  const warpZ = z + 190 * fbm2(x * 0.0011 + 5.2, z * 0.0011 - 3.7, 4, peak.seed + 2);

  const { d, angle } = peakLocal(peak, warpX, warpZ);
  const ridge = ridged2(
    Math.cos(angle) * 1.45 + peak.seed * 0.37,
    Math.sin(angle) * 1.45 - peak.seed * 0.21,
    2,
    peak.seed,
  );
  const radius = peak.radius * (0.85 + 0.24 * ridge);
  const t = clamp(1 - d / radius, 0, 1);

  // 宽大山脚：必须在峰体轮廓之外继续连续衰减，否则会在山脚
  // 留下一圈垂直断崖（表现为放射状竖条纹）。
  const skirt = 190 * Math.exp(-Math.pow(d / (peak.radius * 2.4), 2));
  // 峰高标定：把自然顶点压到配置高度，避免压平台地后形成火山口。
  const offsetTerm =
    peak.offset * Math.exp(-Math.pow(d / (peak.radius * 2.0), 2));
  if (t <= 0) return { body: Math.max(0, skirt - offsetTerm), d };

  // 径向剖面：缓坡山脚 + 中段陡崖带 + 峰顶收束。
  const profile =
    0.6 * Math.pow(t, 1.4) + 0.4 * smoothstep(0.5, 0.84, t);
  const asym = 1 + 0.08 * Math.sin(angle * 3 + peak.seed);
  let body = peak.amplitude * profile * asym;

  // 大尺度山脊场：让山体长出分叉的脊与谷，而不是放射状褶皱。
  const macro = 0.8 + 0.32 * ridged2(
    x * 0.00105 + peak.seed * 13.7,
    z * 0.00105 - peak.seed * 7.3,
    4,
    peak.seed + 3,
  );
  body *= macro;

  // 冲沟：中段最强，峰顶与山脚减弱。
  const gullies = ridged2(x * 0.0026, z * 0.0026, 4, peak.seed + 5);
  body -= peak.amplitude * 0.07 * gullies * t * (1 - t) * 4;

  // 卫星山脊：每座峰带三条较低的山腿。
  for (const spur of peak.spurs) {
    const sd = Math.hypot(x - spur.x, z - spur.z);
    if (sd < spur.spread * 2.4) {
      const falloff = Math.exp(-Math.pow(sd / spur.spread, 2));
      const rough = 0.74 + 0.26 * ridged2(x * 0.003, z * 0.003, 3, spur.seed);
      body = Math.max(
        body,
        spur.height * spur.amplitude * falloff * rough,
      );
    }
  }

  body += skirt;
  return { body: Math.max(0, body - offsetTerm), d };
}

function baseHeight(x, z) {
  return (
    WORLD.valleyBase +
    70 * fbm2(x * 0.00016, z * 0.00016, 4, 3) +
    235 * ridged2(x * 0.0008, z * 0.0008, 4, 29)
  );
}

function rawHeightAt(x, z) {
  let peakMax = 0;
  let sum = 0;
  for (const peak of PEAK_DATA) {
    const { body } = peakBody(peak, x, z);
    peakMax = Math.max(peakMax, body);
    sum += body;
  }
  return baseHeight(x, z) + peakMax + 0.08 * Math.max(0, sum - peakMax);
}

// 迭代标定每座峰的自然顶点，使 heightAt(峰心) == 配置高度。
for (let iteration = 0; iteration < 5; iteration++) {
  for (const peak of PEAK_DATA) {
    peak.offset += rawHeightAt(peak.x, peak.z) - peak.height;
  }
}

export function heightAt(x, z) {
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

  let height =
    baseHeight(x, z) + peakMax + 0.08 * Math.max(0, sum - peakMax);

  const nearestDistance = nearestScore * nearest.plateau;
  const detailWeight = smoothstep(
    nearest.plateau * 0.6,
    nearest.plateau * 1.8,
    nearestDistance,
  );
  if (detailWeight > 0) {
    height += 34 * fbm2(x * 0.0035, z * 0.0035, 4, nearest.seed) * detailWeight;
    height -=
      22 *
      Math.pow(ridged2(x * 0.0015, z * 0.0015, 4, nearest.seed + 9), 2) *
      detailWeight;

    // 中尺度岩脊与碎石：让山体表面出现岩石质感，而不是光滑的沙丘。
    const rocky = detailWeight * smoothstep(860, 1260, height);
    if (rocky > 0) {
      height += 26 * fbm2(x * 0.009, z * 0.009, 3, nearest.seed + 21) * rocky;
      height +=
        16 *
        (ridged2(x * 0.0058, z * 0.0058, 3, nearest.seed + 27) - 0.5) *
        rocky;
    }
  }

  const plateauWeight =
    1 -
    smoothstep(
      nearest.plateau,
      nearest.plateau * 2.4,
      nearestDistance,
    );
  if (plateauWeight > 0) {
    height = mix(height, nearest.height, plateauWeight);
  }

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
