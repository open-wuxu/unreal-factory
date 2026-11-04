import * as THREE from "three";
import { RIVER, WORLD } from "../config.js";

/**
 * 河道几何中枢。
 *
 * 用一条 CatmullRomCurve3 中心线定义整条黄浦江：
 *  - 按弧长均匀采样，得到位置 / 切线 / 法线 / 半宽；
 *  - 河宽随弧长缓慢变化，并在急弯处自动收窄，避免两岸自交；
 *  - 所有水面、岸墙、滨江步道、道路、建筑落位都从这里取点，
 *    因此建筑、道路、河岸、水面共享同一套空间关系。
 */

const SEGMENTS = 900;

const curve = new THREE.CatmullRomCurve3(
  RIVER.controlPoints.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  "centripetal",
);

const spaced = curve.getSpacedPoints(SEGMENTS);
const length = curve.getLength();
const ds = length / SEGMENTS;

const samples = [];

for (let i = 0; i <= SEGMENTS; i++) {
  const p = spaced[i].clone();
  p.y = 0;

  const a = spaced[Math.max(0, i - 1)];
  const b = spaced[Math.min(SEGMENTS, i + 1)];
  const tangent = new THREE.Vector3().subVectors(b, a);
  tangent.y = 0;
  if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0);
  tangent.normalize();

  // 逆时针旋转 90°：+n 指向水流的左侧
  const normal = new THREE.Vector3(tangent.z, 0, -tangent.x);

  samples.push({
    u: i / SEGMENTS,
    s: (i / SEGMENTS) * length,
    p,
    t: tangent,
    n: normal,
    halfWidth: RIVER.halfWidth(i / SEGMENTS),
  });
}

/* 急弯处限制河宽，保证偏移后的岸线不会自交。 */
for (let i = 0; i <= SEGMENTS; i++) {
  const a = samples[Math.max(0, i - 1)];
  const b = samples[Math.min(SEGMENTS, i + 1)];
  const angle = a.t.angleTo(b.t);
  const arc = b.s - a.s;
  const radius = angle > 1e-5 ? arc / angle : Infinity;
  samples[i].halfWidth = Math.min(samples[i].halfWidth, radius * 0.62);
}

/* 平滑过渡，避免河宽在曲率突变处产生折角。 */
for (let pass = 0; pass < 2; pass++) {
  const values = samples.map((sample) => sample.halfWidth);
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = values[Math.max(0, i - 1)];
    const b = values[i];
    const c = values[Math.min(SEGMENTS, i + 1)];
    samples[i].halfWidth = Math.max(150, (a + b * 2 + c) / 4);
  }
}

function indexAt(u) {
  const clamped = THREE.MathUtils.clamp(u, 0, 1);
  const f = clamped * SEGMENTS;
  const i = Math.min(SEGMENTS - 1, Math.floor(f));
  return { i, k: f - i };
}

const tmpPoint = new THREE.Vector3();
const tmpNormal = new THREE.Vector3();

export const river = {
  curve,
  samples,
  length,
  segments: SEGMENTS,

  /** 弧长参数 u ∈ [0,1] 上的点。 */
  pointAt(u, target = tmpPoint) {
    const { i, k } = indexAt(u);
    const a = samples[i].p;
    const b = samples[i + 1].p;
    return target.lerpVectors(a, b, k);
  },

  tangentAt(u, target = new THREE.Vector3()) {
    const { i, k } = indexAt(u);
    const a = samples[i].t;
    const b = samples[i + 1].t;
    return target.lerpVectors(a, b, k).normalize();
  },

  normalAt(u, target = tmpNormal) {
    const { i, k } = indexAt(u);
    const a = samples[i].n;
    const b = samples[i + 1].n;
    return target.lerpVectors(a, b, k).normalize();
  },

  halfWidthAt(u) {
    const { i, k } = indexAt(u);
    return THREE.MathUtils.lerp(
      samples[i].halfWidth,
      samples[i + 1].halfWidth,
      k,
    );
  },

  /**
   * 岸线取点：side = +1 为水流的左侧，-1 为右侧；
   * extra 为离开岸线继续向陆地方向的距离。
   */
  bankPoint(u, side, extra = 0, target = new THREE.Vector3()) {
    const p = this.pointAt(u, new THREE.Vector3());
    const n = this.normalAt(u, new THREE.Vector3());
    const hw = this.halfWidthAt(u);
    return target.copy(p).addScaledVector(n, side * (hw + extra));
  },

  /** 江面上的点：offset 为相对中心线的横向偏移。 */
  lanePoint(u, offset, target = new THREE.Vector3()) {
    const p = this.pointAt(u, new THREE.Vector3());
    const n = this.normalAt(u, new THREE.Vector3());
    return target.copy(p).addScaledVector(n, offset);
  },

  /** 最近的中心线采样点（用于快速判定陆地 / 水面）。 */
  nearest(x, z) {
    let best = 0;
    let bestDist2 = Infinity;
    for (let i = 0; i <= SEGMENTS; i++) {
      const p = samples[i].p;
      const dx = p.x - x;
      const dz = p.z - z;
      const dist2 = dx * dx + dz * dz;
      if (dist2 < bestDist2) {
        bestDist2 = dist2;
        best = i;
      }
    }
    return {
      index: best,
      sample: samples[best],
      distance: Math.sqrt(bestDist2),
    };
  },

  /** 是否位于陆地上（距离江心线超过半宽 + margin）。 */
  isLand(x, z, margin = 20) {
    const { sample, distance } = this.nearest(x, z);
    return distance > sample.halfWidth + margin;
  },

  /** 到水岸线的有符号距离：正数在陆地上，负数在水里。 */
  signedShoreDistance(x, z) {
    const { sample, distance } = this.nearest(x, z);
    return distance - sample.halfWidth;
  },

  /** 河道水体多边形（先左侧岸线顺流，再右侧岸线逆流）。 */
  waterPolygon(extra = 4) {
    const left = [];
    const right = [];
    for (const sample of samples) {
      const { p, n, halfWidth } = sample;
      left.push([
        p.x + n.x * (halfWidth + extra),
        p.z + n.z * (halfWidth + extra),
      ]);
      right.push([
        p.x - n.x * (halfWidth + extra),
        p.z - n.z * (halfWidth + extra),
      ]);
    }
    return [left, right];
  },
};

/* ------------------------------------------------------------------ */
/* 通用 ribbon 几何                                                     */
/* ------------------------------------------------------------------ */

function resolveOffset(offset, u, sample) {
  return typeof offset === "function" ? offset(u, sample) : offset;
}

/**
 * 沿河道生成水平条带（步道、道路、绿化带）。
 * offsetA / offsetB 是相对江心线的横向偏移，可以是常数或 (u, sample) => number。
 */
export function createRibbonGeometry({
  offsetA,
  offsetB,
  y = WORLD.landLevel,
  uStart = 0,
  uEnd = 1,
  step = 3,
  uvScale = 0.02,
  vRepeat = 1,
}) {
  const i0 = Math.round(THREE.MathUtils.clamp(uStart, 0, 1) * SEGMENTS);
  const i1 = Math.round(THREE.MathUtils.clamp(uEnd, 0, 1) * SEGMENTS);
  const rows = [];
  const stride = Math.max(1, Math.round(step));
  for (let i = i0; i <= i1; i += stride) rows.push(i);
  if (rows[rows.length - 1] !== i1) rows.push(i1);

  const positions = [];
  const uvs = [];
  const indices = [];

  rows.forEach((index, row) => {
    const sample = samples[index];
    const u = sample.u;
    const oa = resolveOffset(offsetA, u, sample);
    const ob = resolveOffset(offsetB, u, sample);

    positions.push(
      sample.p.x + sample.n.x * oa,
      y,
      sample.p.z + sample.n.z * oa,
      sample.p.x + sample.n.x * ob,
      y,
      sample.p.z + sample.n.z * ob,
    );

    const v = (sample.s - samples[i0].s) * uvScale;
    uvs.push(v, 0, v, vRepeat);

    if (row > 0) {
      const a = (row - 1) * 2;
      const b = a + 1;
      const c = row * 2;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  });

  // 偏移方向可能随岸侧翻转；检测首个四边形朝向，必要时反转绕序，
  // 保证所有条带的正面都朝上。
  const ax = positions[0];
  const az = positions[2];
  const bx = positions[3];
  const bz = positions[5];
  const cx = positions[6];
  const cz = positions[8];
  const crossY = (cz - az) * (bx - ax) - (cx - ax) * (bz - az);
  if (crossY < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const swap = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = swap;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * 沿岸线的竖直护岸墙。
 */
export function createBankWallGeometry({
  side,
  topY = WORLD.landLevel,
  bottomY = WORLD.riverBed,
  extra = 0,
  uStart = 0,
  uEnd = 1,
  step = 3,
}) {
  const i0 = Math.round(THREE.MathUtils.clamp(uStart, 0, 1) * SEGMENTS);
  const i1 = Math.round(THREE.MathUtils.clamp(uEnd, 0, 1) * SEGMENTS);
  const rows = [];
  const stride = Math.max(1, Math.round(step));
  for (let i = i0; i <= i1; i += stride) rows.push(i);
  if (rows[rows.length - 1] !== i1) rows.push(i1);

  const positions = [];
  const uvs = [];
  const indices = [];

  rows.forEach((index, row) => {
    const sample = samples[index];
    const offset = side * (sample.halfWidth + extra);
    const x = sample.p.x + sample.n.x * offset;
    const z = sample.p.z + sample.n.z * offset;
    positions.push(x, topY, z, x, bottomY, z);
    const v = sample.s * 0.02;
    uvs.push(v, 1, v, 0);

    if (row > 0) {
      const a = (row - 1) * 2;
      const b = a + 1;
      const c = row * 2;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
