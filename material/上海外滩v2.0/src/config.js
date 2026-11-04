/**
 * 场景常量与时间预设。
 *
 * 坐标系：X 轴向东，Z 轴向南，Y 轴向上。
 * 1 个世界单位 ≈ 1 米，建筑尺寸参照真实数据。
 *
 * 黄浦江不再是直线河道，而是一条贯穿全图的大尺度 U 形弯曲：
 * 江水从左前方远处流入，向北绕出一个马蹄形弯道，再向右前方远处流出。
 * 陆家嘴位于弯道内侧的半岛上。
 */

export const WORLD = {
  landLevel: 3.0,
  roadLevel: 3.12,
  waterLevel: 0.4,
  riverBed: -7.0,
  /** 陆地范围（含河道孔洞） */
  minX: -15000,
  maxX: 15000,
  minZ: -13000,
  maxZ: 11000,
};

export const RIVER = {
  /**
   * 河道中心线控制点 [x, z]。
   * 左段自西南向东北伸展，在陆家嘴以北绕出大弯，右段向东南流出。
   */
  controlPoints: [
    [-9000, 1900],
    [-7600, 1750],
    [-6400, 1550],
    [-5300, 1400],
    [-4400, 1180],
    [-3600, 980],
    [-2950, 700],
    [-2500, 360],
    [-2180, -80],
    [-1950, -580],
    [-1770, -1050],
    [-1500, -1450],
    [-1100, -1720],
    [-600, -1840],
    [0, -1820],
    [560, -1640],
    [980, -1350],
    [1280, -1000],
    [1460, -600],
    [1560, -150],
    [1680, 340],
    [1950, 760],
    [2450, 1050],
    [3200, 1220],
    [4100, 1220],
    [5100, 1120],
    [6200, 1050],
    [7400, 1030],
    [8700, 1080],
  ],

  /** 半宽随河道缓慢变化，形成宽窄不一的真实江面。 */
  halfWidth(u) {
    return (
      252 +
      38 * Math.sin(u * 8.2 + 1.1) +
      17 * Math.sin(u * 19.7 + 3.2) +
      9 * Math.sin(u * 37.0 + 0.4)
    );
  },
};

/** 陆家嘴四座地标（半岛内侧，靠近弯道）。 */
export const TOWER_POS = {
  pearl: [-520, 0, -760],
  shanghai: [-20, 0, -300],
  jinmao: [-150, 0, -40],
  swfc: [120, 0, -60],
};

export const LANDMARK_VIEWS = {
  overview: {
    position: [-300, 1950, 3300],
    target: [-250, 0, -950],
  },
  pearl: {
    position: [-1250, 400, 260],
    target: [-520, 210, -760],
  },
  "shanghai-tower": {
    position: [-980, 540, 700],
    target: [-20, 340, -300],
  },
  swfc: {
    position: [-820, 470, 660],
    target: [120, 300, -60],
  },
  jinmao: {
    position: [-780, 430, 610],
    target: [-150, 250, -40],
  },
  bund: {
    position: [-2300, 380, 1750],
    target: [-3400, 40, 700],
  },
};

/**
 * 三种时间状态的全部可插值参数。
 * 颜色使用 sRGB 十六进制，由 THREE.Color 转换到线性工作空间。
 */
export const TIME_PRESETS = {
  day: {
    skyTop: 0x1c5bbe,
    skyHorizon: 0xd8e9fb,
    skyBottom: 0xb9d0e2,
    sunColor: 0xfff2d4,
    sunDirection: [-0.46, 0.64, 0.5],
    sunGlow: 1.05,
    star: 0.0,
    cloud: 0.5,

    sunLightColor: 0xfff1d4,
    sunLightIntensity: 3.1,
    hemiSky: 0xbfd9ff,
    hemiGround: 0x6f5c47,
    hemiIntensity: 0.85,
    ambientIntensity: 0.18,
    fogColor: 0xbcd0e0,
    fogNear: 4200,
    fogFar: 19000,
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

    waterDeep: 0x0f3542,
    waterSurface: 0x2d6d78,
    waterAccent: 0xffe0b0,
    waterNight: 0.0,
    waterReflect: 0.56,
  },

  dusk: {
    skyTop: 0x22355c,
    skyHorizon: 0xff9a78,
    skyBottom: 0x4a3542,
    sunColor: 0xffb078,
    sunDirection: [-0.76, 0.22, 0.42],
    sunGlow: 1.5,
    star: 0.1,
    cloud: 0.34,

    sunLightColor: 0xffa66c,
    sunLightIntensity: 2.7,
    hemiSky: 0x8fa6c8,
    hemiGround: 0x2a2230,
    hemiIntensity: 1.0,
    ambientIntensity: 0.38,
    fogColor: 0xb98f8c,
    fogNear: 2700,
    fogFar: 12000,
    exposure: 1.02,
    envIntensity: 0.72,
    shadowIntensity: 0.8,

    windowIntensity: 0.8,
    lampIntensity: 1.0,
    neonIntensity: 1.15,
    carLight: 0.9,
    boatLight: 0.95,

    bloomStrength: 0.46,
    bloomRadius: 0.46,
    bloomThreshold: 0.75,

    waterDeep: 0x111722,
    waterSurface: 0x3f505c,
    waterAccent: 0xffb877,
    waterNight: 0.5,
    waterReflect: 0.92,
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
    fogNear: 2800,
    fogFar: 14500,
    exposure: 1.0,
    envIntensity: 0.35,
    shadowIntensity: 0.55,

    windowIntensity: 0.95,
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
    waterReflect: 0.7,
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
