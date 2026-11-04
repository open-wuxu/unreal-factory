import * as THREE from "three";

/** 可复现的伪随机数，保证每次打开的立面亮窗分布一致。 */
export function seededRandom(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function finishTexture(canvas, { srgb = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * 生成一张建筑立面（albedo + emissive 亮窗）贴图。
 * 两个画布使用完全相同的窗户网格，保证白天与夜间窗位对齐。
 */
export function createFacadeTextures({
  seed = 1,
  cols = 8,
  rows = 24,
  width = 256,
  height = 512,
  base = "#1d2a36",
  baseTop = "#2a3d4e",
  windowColor = "#0a1620",
  litColors = ["#ffd9a0", "#fff0cd", "#c9e6ff"],
  litRatio = 0.38,
  mullion = "rgba(0,0,0,0.28)",
  floorLine = "rgba(255,255,255,0.05)",
  floorEvery = 1,
  marginX = 0.18,
  marginY = 0.16,
  crownBand = null,
}) {
  const albedo = makeCanvas(width, height);
  const emissive = makeCanvas(width, height);
  const ctx = albedo.getContext("2d");
  const ectx = emissive.getContext("2d");
  const rand = seededRandom(seed);

  // 立面底色带轻微垂直渐变，避免整面死板。
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, baseTop);
  gradient.addColorStop(0.65, base);
  gradient.addColorStop(1, base);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ectx.fillStyle = "#000000";
  ectx.fillRect(0, 0, width, height);

  const cellW = width / cols;
  const cellH = height / rows;

  for (let row = 0; row < rows; row++) {
    const isOfficeFloor = floorEvery > 1 ? row % floorEvery === 0 : true;

    for (let col = 0; col < cols; col++) {
      const x = col * cellW + cellW * marginX * 0.5;
      const y = row * cellH + cellH * marginY * 0.5;
      const w = cellW * (1 - marginX);
      const h = cellH * (1 - marginY);

      // 玻璃反光：上缘稍亮
      const glass = ctx.createLinearGradient(x, y, x, y + h);
      glass.addColorStop(0, windowColor);
      glass.addColorStop(1, "rgba(4,10,16,0.95)");
      ctx.fillStyle = glass;
      ctx.fillRect(x, y, w, h);

      const lit = rand() < litRatio;
      if (lit) {
        const color = litColors[Math.floor(rand() * litColors.length)];
        const strength = 0.28 + rand() * 0.48;
        ectx.globalAlpha = strength;
        ectx.fillStyle = color;
        ectx.fillRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ectx.globalAlpha = 1;

        // 部分窗户只亮一半，模拟百叶或室内遮挡
        if (rand() < 0.28) {
          ectx.fillStyle = "rgba(0,0,0,0.55)";
          ectx.fillRect(x, y + h * 0.52, w, h * 0.48);
        }
      }

      // 窗框
      ctx.strokeStyle = mullion;
      ctx.lineWidth = Math.max(1, cellW * 0.035);
      ctx.strokeRect(x, y, w, h);
    }

    // 楼层横线
    if (floorEvery === 1 || row % floorEvery === 0) {
      ctx.fillStyle = floorLine;
      ctx.fillRect(0, (row + 1) * cellH - cellH * 0.06, width, cellH * 0.06);
    }

    // 部分楼层整层亮灯（办公楼的典型观感）
    if (isOfficeFloor && rand() < 0.06) {
      const start = Math.floor(rand() * cols * 0.4);
      const span = 2 + Math.floor(rand() * (cols * 0.6));
      for (let c = start; c < Math.min(cols, start + span); c++) {
        const x = c * cellW + cellW * marginX * 0.5 + 1;
        const y = row * cellH + cellH * marginY * 0.5 + 1;
        ectx.globalAlpha = 0.38 + rand() * 0.3;
        ectx.fillStyle = litColors[Math.floor(rand() * litColors.length)];
        ectx.fillRect(x, y, cellW * (1 - marginX) - 2, cellH * (1 - marginY) - 2);
        ectx.globalAlpha = 1;
      }
    }
  }

  // 顶部装饰带（用于上海中心、环球金融中心的冠部）
  if (crownBand) {
    const h = cellH * 1.6;
    ctx.fillStyle = crownBand;
    ctx.fillRect(0, 0, width, h);
    ectx.fillStyle = crownBand;
    ectx.fillRect(0, 0, width, h);
  }

  return {
    map: finishTexture(albedo),
    emissiveMap: finishTexture(emissive),
  };
}

/** 立面种类库：主塔、背景塔、外滩历史建筑各取所需。 */
export const FACADE_KINDS = {
  glassBlue: {
    seed: 11,
    cols: 7,
    rows: 24,
    base: "#3f5b72",
    baseTop: "#6586a1",
    windowColor: "#0a1a26",
    litColors: ["#ffc47a", "#ffdba0", "#a8d2f4"],
    litRatio: 0.2,
    floorLine: "rgba(180,220,255,0.12)",
  },
  glassDark: {
    seed: 23,
    cols: 6,
    rows: 22,
    base: "#2c3e50",
    baseTop: "#476178",
    windowColor: "#081019",
    litColors: ["#ffca8a", "#ffb870", "#b9dcf7"],
    litRatio: 0.24,
    floorLine: "rgba(160,200,240,0.1)",
  },
  silver: {
    seed: 37,
    cols: 6,
    rows: 20,
    base: "#626972",
    baseTop: "#929aa3",
    windowColor: "#0d141b",
    litColors: ["#ffd18a", "#ffc274", "#f3e4c4"],
    litRatio: 0.22,
    floorLine: "rgba(255,255,255,0.12)",
  },
  stoneWarm: {
    seed: 53,
    cols: 6,
    rows: 10,
    base: "#c4b59c",
    baseTop: "#e0d4bf",
    windowColor: "#33261c",
    litColors: ["#ffc87a", "#ffb45c", "#ffe0a8"],
    litRatio: 0.26,
    mullion: "rgba(80,60,40,0.32)",
    floorLine: "rgba(90,70,50,0.08)",
    marginX: 0.3,
    marginY: 0.2,
  },
  stonePale: {
    seed: 67,
    cols: 6,
    rows: 10,
    base: "#d6ccb8",
    baseTop: "#ede4d2",
    windowColor: "#3a2e22",
    litColors: ["#ffcf8e", "#ffb964", "#ffe7b8"],
    litRatio: 0.22,
    mullion: "rgba(90,70,50,0.28)",
    floorLine: "rgba(90,70,50,0.07)",
    marginX: 0.32,
    marginY: 0.22,
  },
  brick: {
    seed: 79,
    cols: 6,
    rows: 10,
    base: "#7e5042",
    baseTop: "#9a6854",
    windowColor: "#24170f",
    litColors: ["#ffc87a", "#ffb45c"],
    litRatio: 0.24,
    mullion: "rgba(44,24,16,0.38)",
    floorLine: "rgba(30,18,12,0.1)",
    marginX: 0.32,
    marginY: 0.2,
  },
  background: {
    seed: 97,
    cols: 5,
    rows: 14,
    width: 128,
    height: 256,
    base: "#3a4e62",
    baseTop: "#55708a",
    windowColor: "#0a141d",
    litColors: ["#ffc98a", "#ffdda8", "#b9dcf7"],
    litRatio: 0.2,
    floorLine: "rgba(180,220,255,0.09)",
  },
};

const facadeCache = new Map();

export function getFacade(kind) {
  if (!facadeCache.has(kind)) {
    const options = FACADE_KINDS[kind];
    if (!options) throw new Error(`Unknown facade kind: ${kind}`);
    facadeCache.set(kind, createFacadeTextures(options));
  }
  return facadeCache.get(kind);
}

/** 缩放几何体 UV，用来在共享材质的前提下控制窗格密度。 */
export function scaleUVs(geometry, u, v) {
  const uv = geometry.attributes.uv;
  if (!uv) return geometry;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  }
  uv.needsUpdate = true;
  return geometry;
}

/**
 * 生成一张等距柱状环境贴图：天空渐变 + 太阳/月亮光晕。
 * 用于 PBR 材质的 IBL 反射，随昼夜预设切换。
 */
export function createEnvironmentTexture(preset) {
  const width = 1024;
  const height = 512;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const top = new THREE.Color(preset.skyTop);
  const horizon = new THREE.Color(preset.skyHorizon);
  const bottom = new THREE.Color(preset.skyBottom);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, `#${top.getHexString()}`);
  gradient.addColorStop(0.46, `#${horizon.getHexString()}`);
  gradient.addColorStop(0.54, `#${horizon.getHexString()}`);
  gradient.addColorStop(1, `#${bottom.getHexString()}`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 星空
  if (preset.star > 0.2) {
    const rand = seededRandom(1234);
    const count = Math.floor(700 * preset.star);
    for (let i = 0; i < count; i++) {
      const x = rand() * width;
      const y = rand() * height * 0.55;
      const r = rand() * 1.3 + 0.2;
      ctx.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.75})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 太阳 / 月亮光晕
  const [dx, dy, dz] = preset.sunDirection;
  const sunU = 0.5 + Math.atan2(dz, dx) / (Math.PI * 2);
  const sunV = Math.acos(THREE.MathUtils.clamp(dy, -1, 1)) / Math.PI;
  const cx = sunU * width;
  const cy = sunV * height;
  const sun = new THREE.Color(preset.sunColor);

  for (const offset of [-width, 0, width]) {
    const glow = ctx.createRadialGradient(
      cx + offset,
      cy,
      0,
      cx + offset,
      cy,
      width * 0.34,
    );
    glow.addColorStop(0, `rgba(255,255,255,0.95)`);
    glow.addColorStop(0.03, `#${sun.getHexString()}`);
    glow.addColorStop(0.18, toRgba(sun, 0.26 * preset.sunGlow));
    glow.addColorStop(1, toRgba(sun, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function toRgba(color, alpha) {
  return `rgba(${Math.round(color.r * 255)},${Math.round(
    color.g * 255,
  )},${Math.round(color.b * 255)},${alpha})`;
}

/** 径向光晕贴图（灯池、船尾浪花、喷泉灯光等）。 */
export function createGlowTexture(
  inner = "rgba(255,235,190,0.95)",
  mid = "rgba(255,210,140,0.35)",
  outer = "rgba(255,200,120,0)",
) {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.35, mid);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** 建材质时统一注册发光类型与基准强度，供时间系统批量调整。 */
export function tagEmissive(material, type, base = 1) {
  material.userData.emissiveType = type;
  material.userData.emissiveBase = base;
  return material;
}

export function tagNeon(material, base = 1) {
  material.userData.emissiveType = "neon";
  material.userData.emissiveBase = base;
  return material;
}
