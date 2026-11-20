import * as THREE from "three";

/**
 * 36 秒影片时间线（纯函数，无 DOM）。
 *
 * 五个镜头各自独立机位曲线，切点处用穿云白场遮住。
 * 机位、字幕、转场与片尾都由绝对时间推导，可任意拖动。
 */

export const FILM_DURATION = 36;
export const FILM_FPS = 60;

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const FILM_SHOTS = [
  {
    index: 0,
    start: 0,
    end: 8,
    subtitle: "云海初开，七峰浮青",
    keys: [
      { t: 0, position: V(6200, 3100, -6800), target: V(0, 1050, 0) },
      { t: 4, position: V(4600, 2500, -5200), target: V(0, 1080, 0) },
      { t: 8, position: V(2600, 1900, -3600), target: V(0, 1150, 0) },
    ],
  },
  {
    index: 1,
    start: 8,
    end: 15,
    subtitle: "通天一径，玉阶凌云",
    keys: [
      { t: 8, position: V(900, 2250, 1500), target: V(0, 1780, 0) },
      { t: 11, position: V(520, 2000, 950), target: V(0, 1785, 0) },
      { t: 13.5, position: V(260, 1890, 640), target: V(0, 1790, 0) },
      { t: 15, position: V(80, 1850, 400), target: V(0, 1800, 0) },
    ],
  },
  {
    index: 2,
    start: 15,
    end: 22,
    subtitle: "竹影摇风，双峰对望",
    keys: [
      { t: 15, position: V(-2760, 960, -2280), target: V(-2600, 1150, -1800) },
      { t: 18, position: V(-2350, 1150, -2050), target: V(-800, 1300, 0) },
      { t: 22, position: V(-900, 1850, 500), target: V(1900, 1400, 3000) },
    ],
  },
  {
    index: 3,
    start: 22,
    end: 29,
    subtitle: "龙首垂瀑，风回千仞",
    keys: [
      { t: 22, position: V(-2350, 1150, 1100), target: V(-2940, 1050, 620) },
      { t: 25, position: V(-2400, 1180, 1130), target: V(-2940, 1030, 620) },
      { t: 29, position: V(-1200, 2050, 100), target: V(1450, 1450, -2500) },
    ],
  },
  {
    index: 4,
    start: 29,
    end: 36,
    subtitle: "落霞满袖，青云不老",
    keys: [
      { t: 29, position: V(-1200, 1750, 1100), target: V(-2500, 1300, 2500) },
      { t: 31, position: V(-1450, 1680, 1300), target: V(-2500, 1300, 2500) },
      { t: 32.5, position: V(-1800, 1800, 1600), target: V(-2500, 1300, 2500) },
      { t: 36, position: V(-6200, 3200, -4000), target: V(0, 1000, 0) },
    ],
  },
];

const CUTS = [8, 15, 22, 29];

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function fade(value, inStart, inEnd, outStart, outEnd) {
  return Math.min(
    smoothstep(inStart, inEnd, value),
    1 - smoothstep(outStart, outEnd, value),
  );
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

function sampleKeys(keys, time, field) {
  const t = Math.min(Math.max(time, keys[0].t), keys[keys.length - 1].t);
  let index = 0;
  while (index < keys.length - 2 && t > keys[index + 1].t) index++;
  const k1 = keys[index];
  const k2 = keys[index + 1];
  const k0 = keys[Math.max(0, index - 1)];
  const k3 = keys[Math.min(keys.length - 1, index + 2)];
  const span = Math.max(0.0001, k2.t - k1.t);
  const u = clamp01((t - k1.t) / span);
  return new THREE.Vector3(
    catmullRom(k0[field].x, k1[field].x, k2[field].x, k3[field].x, u),
    catmullRom(k0[field].y, k1[field].y, k2[field].y, k3[field].y, u),
    catmullRom(k0[field].z, k1[field].z, k2[field].z, k3[field].z, u),
  );
}

export function shotIndexAt(time) {
  const t = Math.min(Math.max(time, 0), FILM_DURATION);
  for (let i = 0; i < FILM_SHOTS.length; i++) {
    if (t < FILM_SHOTS[i].end) return i;
  }
  return FILM_SHOTS.length - 1;
}

export function sampleFilmCamera(time, outPosition, outTarget) {
  const shot = FILM_SHOTS[shotIndexAt(time)];
  const local = Math.min(Math.max(time, shot.start), shot.end);
  outPosition.copy(sampleKeys(shot.keys, local, "position"));
  outTarget.copy(sampleKeys(shot.keys, local, "target"));
  return shot;
}

/** 穿云转场：切点前后各 0.8 秒内白场升到 1。 */
export function transitionOpacityAt(time) {
  let value = 0;
  for (const cut of CUTS) {
    value = Math.max(value, 1 - clamp01(Math.abs(time - cut) / 0.8));
  }
  return value * value * (3 - 2 * value);
}

export function subtitleAt(time) {
  const shot = FILM_SHOTS[shotIndexAt(time)];
  const opacity = fade(
    time,
    shot.start + 1.0,
    shot.start + 1.9,
    shot.end - 1.2,
    shot.end - 0.4,
  );
  return { text: shot.subtitle, opacity };
}

export function titleOpacityAt(time) {
  return fade(time, 33.4, 34.4, 35.2, 36.0);
}

export function blackOpacityAt(time) {
  return Math.max(
    1 - smoothstep(0, 0.9, time),
    smoothstep(35.2, 36, time),
  );
}
