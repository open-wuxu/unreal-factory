import * as THREE from "three";

/**
 * 《枫桥夜泊》场景常量。
 *
 * 坐标系（与仓库约定一致）：
 *   X 向东，Z 向南，Y 向上，1 世界单位 ≈ 1 米。
 *
 * 河道沿 X 轴展开，z = 0 为江心，南岸（近景，枫桥与客船）在 z > 0，
 * 北岸（远景，寒山寺）在 z < 0。月亮压在西北方天际线附近。
 */

export const COLORS = {
  night: 0x101a2c,
  moon: 0xb7c9de,
  river: 0x172a40,
  maple: 0x8b302e,
  fishingFire: 0xffad58,
  lantern: 0xe6a65a,
  mist: 0xa5b2c1,
  ink: 0x05090f,
  stone: 0x6f6a61,
  darkStone: 0x3c3a36,
  wood: 0x3a2a20,
  darkWood: 0x241a14,
  roof: 0x24272b,
  bronze: 0x6c5b3e,
};

/** 水平基准高度。 */
export const WORLD = {
  waterLevel: 0.35,
  landLevel: 1.35,
  bankTop: 1.6,
  riverHalfWidth: 34,
  riverLength: 520,
  templeBase: 9.2,
};

/** 关键位置。 */
export const LAYOUT = {
  bridge: { x: -42, z: 0, width: 7.2, span: 74, rise: 11.5 },
  boat: { x: 14, z: 23.4, heading: -0.16 },
  temple: { x: 42, z: -118, y: WORLD.templeBase },
  bell: { x: 47, z: -126, y: 20.5 },
  poet: { x: 14.2, z: 23.2 },
  lanternBoat: { x: -4, y: 1.95, z: 22.6 },
  mooringPost: { x: 7.6, z: 27.2 },
  moonDir: new THREE.Vector3(-0.55, 0.08, -0.83).normalize(),
};

/** 近岸枫树（x, z, 高度系数）。 */
export const MAPLES = [
  [-96, 40, 1.15],
  [-74, 37, 0.92],
  [-58, 43, 1.24],
  [-30, 38, 1.05],
  [-14, 44, 0.86],
  [6, 39, 1.18],
  [30, 43, 0.95],
  [52, 38, 1.1],
  [74, 44, 0.88],
  [-48, -40, 0.9],
  [58, -42, 0.84],
];

/** 渔船在水面上的位置（x, z, 灯火强度）。 */
export const FISHING_BOATS = [
  [-92, -8, 1.0],
  [-34, -20, 0.8],
  [26, -14, 0.9],
  [88, 4, 0.75],
  [-150, 12, 0.6],
];

/** 导航机位。 */
export const CAMERA_VIEWS = {
  overview: {
    position: [96, 58, 128],
    target: [-4, 8, -34],
  },
  bridge: {
    position: [14, 16, 48],
    target: [-42, 6, -2],
  },
  maples: {
    position: [-24, 6.5, 51],
    target: [-60, 9, 28],
  },
  boat: {
    position: [34, 6.2, 33],
    target: [14, 2.2, 23],
  },
  temple: {
    position: [16, 10, 18],
    target: [42, 17, -118],
  },
  water: {
    position: [2, 4.2, 38],
    target: [-8, 1.2, -70],
  },
};

/** 雾与后处理基线。 */
export const ATMOSPHERE = {
  fogColor: 0x27313f,
  fogDensity: 0.0029,
  exposure: 1.24,
  bloomStrength: 0.28,
  bloomRadius: 0.6,
  bloomThreshold: 0.62,
};

/** 月光方向（单位向量）；随影片时间缓慢下沉。 */
export function moonDirectionAt(t) {
  const drop = THREE.MathUtils.clamp(t / 40, 0, 1);
  const az = -0.55 - drop * 0.01;
  const elevation = 0.078 - drop * 0.03;
  return new THREE.Vector3(az, elevation, -1).normalize();
}
