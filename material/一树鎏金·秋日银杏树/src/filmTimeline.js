import * as THREE from "three";

/**
 * 30 秒影片时间线（纯函数，无 DOM）。
 *
 * 六个镜头共用一条绝对时间轴，每个镜头内部由 Catmull-Rom
 * 采样机位；360° 环绕使用参数化圆轨，保证树始终位于画面中央。
 * 所有状态都可由时间推导，拖动时间轴或逐帧导出不会产生累积误差。
 */

export const FILM_DURATION = 30;
export const FILM_FPS = 60;

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function catmullRom(p0, p1, p2, p3, u) {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  );
}

function sampleKeys(keys, time, field, out) {
  const t = Math.min(Math.max(time, keys[0].t), keys[keys.length - 1].t);
  let index = 0;
  while (index < keys.length - 2 && t > keys[index + 1].t) index++;
  const k1 = keys[index];
  const k2 = keys[index + 1];
  const k0 = keys[Math.max(0, index - 1)];
  const k3 = keys[Math.min(keys.length - 1, index + 2)];
  const span = Math.max(0.0001, k2.t - k1.t);
  const u = clamp01((t - k1.t) / span);
  out.set(
    catmullRom(k0[field].x, k1[field].x, k2[field].x, k3[field].x, u),
    catmullRom(k0[field].y, k1[field].y, k2[field].y, k3[field].y, u),
    catmullRom(k0[field].z, k1[field].z, k2[field].z, k3[field].z, u),
  );
  return out;
}

/* 镜头二：360° 环绕，12 段圆轨。 */
const ORBIT_START = 0.035;
const ORBIT_RADIUS = 19.5;
const ORBIT_HEIGHT = 5.15;

function buildOrbitKeys(start, end) {
  const keys = [];
  const segments = 14;
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const angle = ORBIT_START + u * Math.PI * 2;
    keys.push({
      t: start + (end - start) * u,
      position: V(
        Math.sin(angle) * ORBIT_RADIUS,
        ORBIT_HEIGHT + Math.sin(angle * 2) * 0.22,
        Math.cos(angle) * ORBIT_RADIUS,
      ),
      target: V(0, 7.18, 0),
    });
  }
  return keys;
}

export const FILM_SHOTS = [
  {
    index: 0,
    id: "reveal",
    name: "整体亮相",
    start: 0,
    end: 5,
    mode: "path",
    fovStart: 38,
    fovEnd: 39.5,
    wind: 0.95,
    dof: { aperture: 0.0018, maxblur: 0.004 },
    keys: [
      { t: 0, position: V(0, 2.35, 24.0), target: V(0, 6.95, 0) },
      { t: 2.4, position: V(0.3, 2.66, 22.0), target: V(0, 7.05, 0) },
      { t: 5, position: V(0.62, 2.96, 20.3), target: V(0, 7.15, 0) },
    ],
  },
  {
    index: 1,
    id: "orbit",
    name: "360° 环绕",
    start: 5,
    end: 11,
    mode: "orbit",
    fovStart: 42.5,
    fovEnd: 42.5,
    wind: 1.05,
    dof: { aperture: 0.0016, maxblur: 0.0035 },
    keys: buildOrbitKeys(5, 11),
  },
  {
    index: 2,
    id: "lookup",
    name: "低角度仰视",
    start: 11,
    end: 16,
    mode: "path",
    fovStart: 57,
    fovEnd: 55,
    wind: 1.0,
    dof: { aperture: 0.0042, maxblur: 0.0055 },
    keys: [
      { t: 11, position: V(2.3, 1.0, 3.6), target: V(0.06, 3.3, 0) },
      { t: 13, position: V(2.5, 2.5, 3.9), target: V(0, 8.8, 0) },
      { t: 16, position: V(2.85, 4.5, 4.25), target: V(0, 12.8, 0) },
    ],
  },
  {
    index: 3,
    id: "macro",
    name: "叶片微距",
    start: 16,
    end: 21,
    mode: "path",
    fovStart: 31,
    fovEnd: 32,
    wind: 1.18,
    dof: { aperture: 0.0085, maxblur: 0.0065 },
    keys: [
      { t: 16, position: V(6.12, 8.02, 3.24), target: V(3.28, 8.53, 2.54) },
      { t: 18.5, position: V(5.94, 7.9, 3.1), target: V(3.23, 8.49, 2.5) },
      { t: 21, position: V(5.76, 7.78, 2.96), target: V(3.18, 8.45, 2.46) },
    ],
  },
  {
    index: 4,
    id: "bark",
    name: "树干与枝条",
    start: 21,
    end: 25,
    mode: "path",
    fovStart: 44,
    fovEnd: 43,
    wind: 0.92,
    dof: { aperture: 0.0042, maxblur: 0.005 },
    keys: [
      { t: 21, position: V(1.72, 2.85, -2.68), target: V(0.03, 4.45, 0.02) },
      { t: 23, position: V(1.92, 3.55, -2.88), target: V(0.05, 5.35, 0) },
      { t: 25, position: V(2.12, 4.65, -3.05), target: V(0.1, 6.35, 0.04) },
    ],
  },
  {
    index: 5,
    id: "finale",
    name: "完整收尾",
    start: 25,
    end: 30,
    mode: "path",
    fovStart: 41,
    fovEnd: 38,
    wind: 0.98,
    dof: { aperture: 0.0018, maxblur: 0.004 },
    keys: [
      { t: 25, position: V(4.2, 5.0, 6.6), target: V(0, 8.4, 0) },
      { t: 27.2, position: V(2.6, 4.9, 13.2), target: V(0, 7.7, 0) },
      { t: 28.7, position: V(0.5, 5.25, 21.6), target: V(0, 7.1, 0) },
      { t: 30, position: V(0.18, 5.35, 23.4), target: V(0, 7.1, 0) },
    ],
  },
];

const CUTS = [5, 11, 16, 21, 25];

export function shotIndexAt(time) {
  const t = Math.min(Math.max(time, 0), FILM_DURATION);
  for (let i = 0; i < FILM_SHOTS.length; i++) {
    if (t < FILM_SHOTS[i].end) return i;
  }
  return FILM_SHOTS.length - 1;
}

export function sampleFilmCamera(time, outPosition, outTarget) {
  const t = Math.min(Math.max(time, 0), FILM_DURATION);
  const shot = FILM_SHOTS[shotIndexAt(t)];
  const local = Math.min(Math.max(t, shot.start), shot.end);
  const progress = (local - shot.start) / Math.max(0.0001, shot.end - shot.start);

  if (shot.mode === "orbit") {
    const eased = smoothstep(0, 1, progress);
    const angle = ORBIT_START + eased * Math.PI * 2;
    outPosition.set(
      Math.sin(angle) * ORBIT_RADIUS,
      ORBIT_HEIGHT + Math.sin(angle * 2) * 0.22,
      Math.cos(angle) * ORBIT_RADIUS,
    );
    outTarget.set(0, 7.18, 0);
  } else {
    sampleKeys(shot.keys, local, "position", outPosition);
    sampleKeys(shot.keys, local, "target", outTarget);
  }

  const fov = shot.fovStart + (shot.fovEnd - shot.fovStart) * smoothstep(0, 1, progress);
  return { shot, fov, dof: shot.dof, wind: shot.wind };
}

export function cutFlashAt(time) {
  let value = 0;
  for (const cut of CUTS) {
    value = Math.max(value, 1 - clamp01(Math.abs(time - cut) / 0.22));
  }
  return smoothstep(0, 1, value) * 0.26;
}

export function startFadeAt(time) {
  return 1 - smoothstep(0, 0.95, time);
}

export function titleOpacityAt(time) {
  return smoothstep(27.6, 28.9, time);
}

export function shotAt(time) {
  return FILM_SHOTS[shotIndexAt(time)];
}
