import * as THREE from "three";

/**
 * 《诛仙 · 青云山七峰》场景常量。
 *
 * 坐标系沿用仓库约定：X 向东，Z 向南，Y 向上，1 世界单位 ≈ 1 米。
 * 谷地基准高度 420 m；七个峰顶高度均为绝对世界 Y。
 */

export const WORLD = {
  valleyBase: 420,
  cloudBase: 740,
  cloudTop: 1080,
  bandBase: 1150,
  bandTop: 1500,
  far: 19200,
};

export const COLORS = {
  skyTop: 0x3f6ea8,
  skyHorizon: 0xf3c58e,
  fog: 0xd9a97e,
  rock: 0x6f6a5e,
  darkRock: 0x4b4842,
  grass: 0x5d6b45,
  bamboo: 0x6f8a4f,
  autumn: 0x8a5a36,
  path: 0x9a8b74,
  stone: 0x8d8778,
  darkStone: 0x55514a,
  wood: 0x4a3324,
  darkWood: 0x2c1e16,
  roof: 0x2e3238,
  roofWarm: 0x4a3a2c,
  gold: 0xb08a4a,
  lantern: 0xffb066,
  pine: 0x35452f,
  mist: 0xbcc6cf,
};

export const PEAKS = [
  {
    id: "tongtian",
    name: "通天峰",
    x: 0,
    z: 0,
    height: 1790,
    radius: 1500,
    plateau: 150,
    ridge: 5,
    seed: 11,
    stretch: 1.12,
    rotation: 0.35,
    palette: "granite",
  },
  {
    id: "longshou",
    name: "龙首峰",
    x: -200,
    z: -2900,
    height: 1540,
    radius: 1250,
    plateau: 90,
    ridge: 7,
    seed: 23,
    stretch: 1.65,
    rotation: 2.1,
    palette: "darkRock",
  },
  {
    id: "luoxia",
    name: "落霞峰",
    x: -2350,
    z: -1750,
    height: 1270,
    radius: 1050,
    plateau: 80,
    ridge: 6,
    seed: 37,
    stretch: 1.05,
    rotation: 1.15,
    palette: "autumn",
  },
  {
    id: "fenghui",
    name: "风回峰",
    x: -3250,
    z: 250,
    height: 1600,
    radius: 1250,
    plateau: 85,
    ridge: 8,
    seed: 41,
    stretch: 1.3,
    rotation: 0.8,
    palette: "granite",
  },
  {
    id: "dazhu",
    name: "大竹峰",
    x: -2000,
    z: 2600,
    height: 1170,
    radius: 1400,
    plateau: 140,
    ridge: 4,
    seed: 53,
    stretch: 1.1,
    rotation: 2.7,
    palette: "bamboo",
  },
  {
    id: "xiaozhu",
    name: "小竹峰",
    x: 1700,
    z: 2900,
    height: 1330,
    radius: 1000,
    plateau: 70,
    ridge: 9,
    seed: 67,
    stretch: 0.72,
    rotation: 1.7,
    palette: "bamboo",
  },
  {
    id: "chaoyang",
    name: "朝阳峰",
    x: 3100,
    z: -250,
    height: 1450,
    radius: 1300,
    plateau: 110,
    ridge: 5,
    seed: 79,
    stretch: 1.2,
    rotation: 1.95,
    palette: "granite",
  },
];

/**
 * 太阳关键帧。t 为影片绝对秒。
 * azimuth 为罗盘方位角（0=北，90=东，270=西），315≈西北，
 * 正好让落日压在落霞峰方向。
 */
export const SUN_KEYS = [
  {
    t: 0,
    elevation: 22,
    azimuth: 245,
    color: 0xffd2a1,
    intensity: 3.2,
    skyTop: 0x3f6ea8,
    skyHorizon: 0xf3c58e,
    fog: 0xd9a97e,
    exposure: 1.08,
    cloudLit: 0xffe2bb,
    cloudShadow: 0x6f7f96,
  },
  {
    t: 12,
    elevation: 18,
    azimuth: 252,
    color: 0xffc489,
    intensity: 3.0,
    skyTop: 0x38639b,
    skyHorizon: 0xf0b27f,
    fog: 0xc99a74,
    exposure: 1.12,
    cloudLit: 0xffd7a8,
    cloudShadow: 0x67758c,
  },
  {
    t: 24,
    elevation: 13,
    azimuth: 260,
    color: 0xffab6a,
    intensity: 2.7,
    skyTop: 0x30568c,
    skyHorizon: 0xea9566,
    fog: 0xb87f62,
    exposure: 1.17,
    cloudLit: 0xffc38d,
    cloudShadow: 0x5c6b83,
  },
  {
    t: 36,
    elevation: 7,
    azimuth: 268,
    color: 0xff8a52,
    intensity: 2.4,
    skyTop: 0x284a7b,
    skyHorizon: 0xdb7252,
    fog: 0x9c604f,
    exposure: 1.22,
    cloudLit: 0xffae7a,
    cloudShadow: 0x53617a,
  },
];

/** 导航机位。 */
export const CAMERA_VIEWS = {
  overview: { position: [4300, 2150, 5200], target: [0, 1000, 0] },
  tongtian: { position: [900, 1980, 1200], target: [0, 1790, 0] },
  longshou: { position: [-300, 1800, -1900], target: [-200, 1500, -2900] },
  luoxia: { position: [-1200, 1620, -850], target: [-2350, 1280, -1750] },
  fenghui: { position: [-3900, 1500, 900], target: [-3250, 1450, 250] },
  dazhu: { position: [-2350, 1500, 3300], target: [-2000, 1150, 2600] },
  xiaozhu: { position: [900, 1500, 3500], target: [1700, 1320, 2900] },
  chaoyang: { position: [3900, 1650, 500], target: [3100, 1450, -250] },
};

export const ATMOSPHERE = {
  fogDensity: 0.000055,
  bloomStrength: 0.32,
  bloomRadius: 0.7,
  bloomThreshold: 0.72,
  near: 1,
  far: 40000,
};

/** 由罗盘方位角与仰角得到指向太阳的单位向量。 */
export function sunDirectionAt(t, target = new THREE.Vector3()) {
  const last = SUN_KEYS[SUN_KEYS.length - 1];
  const clamped = Math.min(Math.max(t, SUN_KEYS[0].t), last.t);
  let i = 0;
  while (i < SUN_KEYS.length - 2 && clamped > SUN_KEYS[i + 1].t) i++;
  const a = SUN_KEYS[i];
  const b = SUN_KEYS[i + 1];
  const u = Math.min(
    1,
    Math.max(0, (clamped - a.t) / Math.max(1e-4, b.t - a.t)),
  );
  const smooth = u * u * (3 - 2 * u);
  const elevation = THREE.MathUtils.lerp(a.elevation, b.elevation, smooth);
  const azimuth = THREE.MathUtils.lerp(a.azimuth, b.azimuth, smooth);
  const az = THREE.MathUtils.degToRad(azimuth);
  const el = THREE.MathUtils.degToRad(elevation);
  target.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  return target.normalize();
}
