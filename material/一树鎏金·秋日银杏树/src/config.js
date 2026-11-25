import * as THREE from "three";

/**
 * 《一树鎏金 · 秋日银杏树》场景常量。
 *
 * 坐标系沿用仓库约定：X 向东、Z 向南、Y 向上，1 世界单位 ≈ 1 米。
 * 全场景只有一棵银杏树，树根落在地面原点。
 */

export const WORLD = {
  groundLevel: 0,
  treeHeight: 14.2,
  trunkTop: 8.6,
  crownCenter: new THREE.Vector3(0, 8.75, 0),
  crownRadii: new THREE.Vector3(5.85, 5.0, 5.85),
  near: 0.05,
  far: 420,
  fogDensity: 0.0105,
  groundSize: 260,
};

export const COLORS = {
  skyTop: 0x6f98bd,
  skyMid: 0xb8c2b7,
  skyHorizon: 0xf2bd7c,
  fog: 0xe8c18e,
  sun: 0xffcb92,
  sunCore: 0xfff3d8,
  bark: 0x4a4034,
  soil: 0x4b3c2a,
  grass: 0x7f7d4b,
  gold: 0xf2c14b,
  amber: 0xd98b2f,
  paleGold: 0xffe08a,
  orange: 0xe8a13a,
  greenGold: 0xb9b04f,
  leafGlow: 0xffc25e,
  shaft: 0xffcf84,
};

/** 从场景指向太阳的单位向量：树冠后方偏左、约 19° 仰角的金色低阳。 */
export const SUN_DIRECTION = new THREE.Vector3(-0.2, 0.34, -0.92).normalize();

export const SUN = {
  color: 0xffd7a0,
  intensity: 3.0,
  shadowExtent: 12,
  shadowMapSize: 2048,
  rimColor: 0xffb96a,
  rimIntensity: 0.48,
};

export const CAMERA_VIEWS = {
  overview: {
    position: [0.2, 4.25, 22.6],
    target: [0, 7.1, 0],
    fov: 38,
  },
  up: {
    position: [2.15, 0.95, 3.65],
    target: [0.15, 11.0, 0],
    fov: 56,
  },
  crown: {
    position: [6.9, 11.6, 7.9],
    target: [0.6, 9.7, 0.2],
    fov: 42,
  },
  leaf: {
    position: [6.09, 7.96, 3.2],
    target: [3.226, 8.489, 2.496],
    fov: 31,
  },
  trunk: {
    position: [1.75, 2.9, -2.7],
    target: [0.04, 4.5, 0],
    fov: 44,
  },
};

export const LEAF = {
  /** 单张叶片的世界尺寸（米），实际叶片会在此基础上随机缩放。 */
  size: 0.27,
  alphaTest: 0.42,
  /** 目标叶片实例数，实际数量由枝条结构决定。 */
  targetCount: 29000,
  palette: [
    { color: 0xf4c64f, weight: 0.32 },
    { color: 0xffdf8c, weight: 0.24 },
    { color: 0xe0a13a, weight: 0.18 },
    { color: 0xd98b2f, weight: 0.14 },
    { color: 0xf6bf45, weight: 0.08 },
    { color: 0xb9b04f, weight: 0.04 },
  ],
};

export const WIND = {
  /** Shader 风动的基础振幅倍率。 */
  strength: 0.92,
  speed: 1.0,
  gust: 0.32,
};

export const FALLING_LEAVES = {
  count: 34,
  minFallDuration: 8.5,
  maxFallDuration: 15.0,
  sizeMin: 0.72,
  sizeMax: 1.18,
};

/** 摄影机安全区：不允许进入树干或树冠核心。 */
export const CAMERA_LIMITS = {
  minHeight: 0.45,
  trunkRadius: 1.05,
  trunkHeight: 9.0,
  crownCenter: new THREE.Vector3(0, 8.75, 0),
  crownAvoidRadii: new THREE.Vector3(4.05, 4.35, 4.05),
  minDistance: 2.4,
  maxDistance: 40,
};
