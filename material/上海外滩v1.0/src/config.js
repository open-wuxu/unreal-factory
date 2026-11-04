/**
 * 场景常量与时间预设。
 *
 * 坐标系：Y 轴向上，黄浦江沿 Z 轴南北走向。
 * 1 个世界单位 ≈ 1 米，建筑尺寸参照真实数据。
 */

export const RIVER = {
  width: 420,
  length: 7600,
  westBank: -210,
  eastBank: 210,
  waterLevel: 0.4,
};

export const TOWER_POS = {
  pearl: [330, 0, -300],
  jinmao: [445, 0, -40],
  swfc: [470, 0, 30],
  shanghai: [420, 0, 140],
};

export const LANDMARK_VIEWS = {
  overview: {
    position: [-700, 285, 700],
    target: [200, 200, 0],
  },
  pearl: {
    position: [10, 205, 330],
    target: [330, 225, -300],
  },
  "shanghai-tower": {
    position: [-320, 430, 780],
    target: [420, 300, 130],
  },
  swfc: {
    position: [-20, 380, 640],
    target: [470, 260, 30],
  },
  jinmao: {
    position: [40, 330, 590],
    target: [445, 210, -40],
  },
  bund: {
    position: [90, 78, 330],
    target: [-275, 40, 60],
  },
};

/**
 * 三种时间状态的全部可插值参数。
 * 颜色使用 sRGB 十六进制，由 THREE.Color 转换到线性工作空间。
 */
export const TIME_PRESETS = {
  day: {
    skyTop: 0x1c5bbe,
    skyHorizon: 0xd6e9ff,
    skyBottom: 0xb9d4ea,
    sunColor: 0xfff2d4,
    sunDirection: [-0.52, 0.66, 0.54],
    sunGlow: 1.05,
    star: 0.0,
    cloud: 0.45,

    sunLightColor: 0xfff1d4,
    sunLightIntensity: 3.1,
    hemiSky: 0xbfd9ff,
    hemiGround: 0x6f5c47,
    hemiIntensity: 0.85,
    ambientIntensity: 0.18,
    fogColor: 0xcadff0,
    fogNear: 1500,
    fogFar: 8200,
    exposure: 1.0,
    envIntensity: 0.85,
    shadowIntensity: 0.92,

    windowIntensity: 0.0,
    lampIntensity: 0.0,
    neonIntensity: 0.22,
    carLight: 0.18,
    boatLight: 0.22,

    bloomStrength: 0.12,
    bloomRadius: 0.35,
    bloomThreshold: 0.94,

    waterDeep: 0x103742,
    waterSurface: 0x2d6d78,
    waterAccent: 0xffe0b0,
    waterNight: 0.0,
    waterReflect: 0.56,
  },

  dusk: {
    skyTop: 0x1d2a52,
    skyHorizon: 0xff9c60,
    skyBottom: 0x3a2a35,
    sunColor: 0xffb070,
    sunDirection: [-0.86, 0.2, 0.34],
    sunGlow: 1.45,
    star: 0.08,
    cloud: 0.35,

    sunLightColor: 0xffa968,
    sunLightIntensity: 2.2,
    hemiSky: 0xffb586,
    hemiGround: 0x37293a,
    hemiIntensity: 0.5,
    ambientIntensity: 0.2,
    fogColor: 0xe89a72,
    fogNear: 1450,
    fogFar: 7600,
    exposure: 1.05,
    envIntensity: 0.7,
    shadowIntensity: 0.8,

    windowIntensity: 0.8,
    lampIntensity: 1.0,
    neonIntensity: 1.15,
    carLight: 0.9,
    boatLight: 0.95,

    bloomStrength: 0.42,
    bloomRadius: 0.45,
    bloomThreshold: 0.76,

    waterDeep: 0x1b1a28,
    waterSurface: 0x6e4a4a,
    waterAccent: 0xffb877,
    waterNight: 0.45,
    waterReflect: 0.8,
  },

  night: {
    skyTop: 0x03060f,
    skyHorizon: 0x101c36,
    skyBottom: 0x04060a,
    sunColor: 0xbcd6ff,
    sunDirection: [0.4, 0.58, -0.55],
    sunGlow: 0.55,
    star: 1.0,
    cloud: 0.12,

    sunLightColor: 0x9fc0ff,
    sunLightIntensity: 0.82,
    hemiSky: 0x2a4478,
    hemiGround: 0x070709,
    hemiIntensity: 0.42,
    ambientIntensity: 0.12,
    fogColor: 0x08101f,
    fogNear: 1700,
    fogFar: 8400,
    exposure: 1.0,
    envIntensity: 0.35,
    shadowIntensity: 0.55,

    windowIntensity: 1.1,
    lampIntensity: 1.2,
    neonIntensity: 1.2,
    carLight: 1.4,
    boatLight: 1.1,

    bloomStrength: 0.58,
    bloomRadius: 0.52,
    bloomThreshold: 0.74,

    waterDeep: 0x03070e,
    waterSurface: 0x0c1b2b,
    waterAccent: 0xffd59a,
    waterNight: 1.0,
    waterReflect: 0.9,
  },
};

/** 用于插值的参数键（全部为数字或颜色）。 */
export const NUMERIC_KEYS = [
  "sunGlow",
  "star",
  "cloud",
  "sunLightIntensity",
  "hemiIntensity",
  "ambientIntensity",
  "fogNear",
  "fogFar",
  "exposure",
  "envIntensity",
  "shadowIntensity",
  "windowIntensity",
  "lampIntensity",
  "neonIntensity",
  "carLight",
  "boatLight",
  "bloomStrength",
  "bloomRadius",
  "bloomThreshold",
  "waterNight",
  "waterReflect",
];

export const COLOR_KEYS = [
  "skyTop",
  "skyHorizon",
  "skyBottom",
  "sunColor",
  "sunLightColor",
  "hemiSky",
  "hemiGround",
  "fogColor",
  "waterDeep",
  "waterSurface",
  "waterAccent",
];

export const DEFAULT_PRESET = "dusk";
