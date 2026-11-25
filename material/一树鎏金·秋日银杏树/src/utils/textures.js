import * as THREE from "three";
import { fbm2D, seededRandom } from "./noise.js";

/**
 * 全部贴图由 Canvas 程序化生成，不依赖任何外部图片。
 * 固定种子保证每次打开看到相同的树皮、叶片与地面。
 */

const cache = new Map();

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toTexture(canvas, { colorSpace, wrap = true, repeat = null, anisotropy = 1 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (colorSpace) texture.colorSpace = colorSpace;
  if (wrap) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  if (repeat) texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = Math.max(1, anisotropy);
  texture.needsUpdate = true;
  return texture;
}

/* ------------------------------------------------------------------ */
/* 树皮                                                                */
/* ------------------------------------------------------------------ */

function drawBarkAlbedo(size, random) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, "#2f2821");
  base.addColorStop(0.42, "#3b3127");
  base.addColorStop(0.72, "#2b241d");
  base.addColorStop(1, "#44382a");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // 大尺度色斑：潮湿、苔痕与老皮
  for (let i = 0; i < 220; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 18 + random() * 150;
    const tone = random();
    const color =
      tone < 0.34
        ? "122, 128, 88"
        : tone < 0.68
          ? "116, 99, 76"
          : "62, 54, 43";
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${color}, ${0.035 + random() * 0.06})`);
    gradient.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // 大尺度纵向色带：老树皮的明暗起伏
  for (let i = 0; i < 56; i++) {
    const x = random() * size;
    const width = 26 + random() * 128;
    const light = random() < 0.42;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.strokeStyle = light
      ? `rgba(126, 108, 78, ${0.035 + random() * 0.055})`
      : `rgba(14, 11, 8, ${0.03 + random() * 0.06})`;
    ctx.beginPath();
    let px = x;
    ctx.moveTo(px, -40);
    for (let y = 0; y <= size + 40; y += 34) {
      px += (random() - 0.5) * 16;
      ctx.lineTo(px, y);
    }
    ctx.stroke();
  }

  // 纵向生长纹理
  for (let i = 0; i < 1600; i++) {
    const x = random() * size;
    const length = 60 + random() * size * 0.8;
    const y0 = random() * size - length * 0.4;
    const width = 0.35 + random() * 1.7;
    const light = random() < 0.52;
    ctx.strokeStyle = light
      ? `rgba(188, 164, 126, ${0.012 + random() * 0.05})`
      : `rgba(20, 16, 12, ${0.015 + random() * 0.055})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    let px = x;
    ctx.moveTo(px, y0);
    for (let y = y0 + 18; y <= y0 + length; y += 18) {
      px += (random() - 0.5) * 3.2;
      ctx.lineTo(px, y);
    }
    ctx.stroke();
  }

  // 深裂纹与翻起的树皮边缘
  for (let c = 0; c < 44; c++) {
    const startX = random() * size;
    const startY = random() * size - 40;
    const length = 120 + random() * 520;
    const drift = (random() - 0.5) * 58;
    const points = [];
    let x = startX;
    for (let y = startY; y <= startY + length; y += 16) {
      const t = (y - startY) / Math.max(1, length);
      x = startX + drift * t + Math.sin(t * 9 + c) * 4 + (random() - 0.5) * 3;
      points.push([x, y]);
    }
    const width = 2.4 + random() * 12;
    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(9, 7, 5, ${0.42 + random() * 0.32})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach(([px, py], index) => (index ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();

    ctx.strokeStyle = `rgba(196, 172, 132, ${0.08 + random() * 0.14})`;
    ctx.lineWidth = Math.max(0.8, width * 0.3);
    ctx.beginPath();
    points.forEach(([px, py], index) =>
      index ? ctx.lineTo(px + width * 0.8, py) : ctx.moveTo(px + width * 0.8, py),
    );
    ctx.stroke();
  }

  // 更宽、更深的老年裂沟
  for (let c = 0; c < 18; c++) {
    const startX = random() * size;
    const startY = random() * size - 80;
    const length = 240 + random() * 620;
    const drift = (random() - 0.5) * 90;
    const points = [];
    let x = startX;
    for (let y = startY; y <= startY + length; y += 20) {
      const t = (y - startY) / Math.max(1, length);
      x = startX + drift * t + Math.sin(t * 6 + c * 1.7) * 9 + (random() - 0.5) * 5;
      points.push([x, y]);
    }
    const width = 7 + random() * 16;
    ctx.strokeStyle = `rgba(6, 5, 4, ${0.5 + random() * 0.3})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach(([px, py], index) => (index ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();

    ctx.strokeStyle = `rgba(206, 182, 138, ${0.08 + random() * 0.12})`;
    ctx.lineWidth = 1.6 + random() * 2.2;
    ctx.beginPath();
    points.forEach(([px, py], index) =>
      index ? ctx.lineTo(px + width * 0.75, py) : ctx.moveTo(px + width * 0.75, py),
    );
    ctx.stroke();
  }

  // 剥落的浅色树皮斑块
  for (let i = 0; i < 90; i++) {
    const x = random() * size;
    const y = random() * size;
    const rx = 5 + random() * 28;
    const ry = 12 + random() * 70;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((random() - 0.5) * 0.36);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(172, 154, 124, ${0.05 + random() * 0.1})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(22, 18, 13, ${0.1 + random() * 0.12})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // 横向皮孔
  for (let i = 0; i < 260; i++) {
    const x = random() * size;
    const y = random() * size;
    const width = 2 + random() * 13;
    ctx.strokeStyle = `rgba(16, 12, 9, ${0.16 + random() * 0.22})`;
    ctx.lineWidth = 0.8 + random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y + (random() - 0.5) * 1.4);
    ctx.stroke();
  }

  // 细碎颗粒
  for (let i = 0; i < 5200; i++) {
    const x = random() * size;
    const y = random() * size;
    const light = random() < 0.5;
    ctx.fillStyle = light
      ? `rgba(196, 174, 136, ${0.02 + random() * 0.08})`
      : `rgba(10, 8, 6, ${0.02 + random() * 0.1})`;
    const sizePx = 0.5 + random() * 1.9;
    ctx.fillRect(x, y, sizePx, sizePx * (0.6 + random() * 2));
  }

  return canvas;
}

function buildBarkMaps(albedoCanvas, random) {
  const size = albedoCanvas.width;
  const source = albedoCanvas.getContext("2d").getImageData(0, 0, size, size);
  const bumpCanvas = createCanvas(size, size);
  const roughCanvas = createCanvas(size, size);
  const bumpCtx = bumpCanvas.getContext("2d");
  const roughCtx = roughCanvas.getContext("2d");
  const bump = bumpCtx.createImageData(size, size);
  const rough = roughCtx.createImageData(size, size);

  for (let i = 0; i < source.data.length; i += 4) {
    const lum =
      source.data[i] * 0.299 + source.data[i + 1] * 0.587 + source.data[i + 2] * 0.114;
    const height = Math.max(0, Math.min(255, 86 + (lum - 64) * 1.28));
    bump.data[i] = height;
    bump.data[i + 1] = height;
    bump.data[i + 2] = height;
    bump.data[i + 3] = 255;

    const roughness = Math.max(120, Math.min(255, 246 - (lum - 60) * 0.42));
    rough.data[i] = roughness;
    rough.data[i + 1] = roughness;
    rough.data[i + 2] = roughness;
    rough.data[i + 3] = 255;
  }
  bumpCtx.putImageData(bump, 0, 0);
  roughCtx.putImageData(rough, 0, 0);
  return { bumpCanvas, roughCanvas };
}

export function getBarkTextures(anisotropy = 1) {
  const key = `bark:${anisotropy}`;
  if (cache.has(key)) return cache.get(key);

  const random = seededRandom(0x5b17c3);
  const albedoCanvas = drawBarkAlbedo(1024, random);
  const { bumpCanvas, roughCanvas } = buildBarkMaps(albedoCanvas, random);

  const result = {
    map: toTexture(albedoCanvas, {
      colorSpace: THREE.SRGBColorSpace,
      anisotropy,
    }),
    bumpMap: toTexture(bumpCanvas, { anisotropy }),
    roughnessMap: toTexture(roughCanvas, { anisotropy }),
  };
  cache.set(key, result);
  return result;
}

/* ------------------------------------------------------------------ */
/* 银杏叶                                                              */
/* ------------------------------------------------------------------ */

const LEAF_RADIUS = 234;
const LEAF_ORIGIN = { x: 256, y: 462 };

function leafRadius(theta) {
  const cleft = 1 - 0.18 * Math.exp(-Math.pow(theta / 0.115, 2));
  const margin = 1 + 0.014 * Math.sin(theta * 43 + 0.8) + 0.008 * Math.sin(theta * 97);
  const edge = 1 - 0.055 * Math.pow(Math.abs(theta) / 1.36, 4);
  return LEAF_RADIUS * cleft * margin * edge;
}

function leafOutline(count = 128) {
  const points = [];
  for (let i = 0; i <= count; i++) {
    const theta = -1.36 + (2.72 * i) / count;
    const radius = leafRadius(theta);
    points.push({
      theta,
      x: LEAF_ORIGIN.x + Math.sin(theta) * radius,
      y: LEAF_ORIGIN.y - Math.cos(theta) * radius,
    });
  }
  return points;
}

export function getLeafTexture(anisotropy = 1) {
  const key = `leaf:${anisotropy}`;
  if (cache.has(key)) return cache.get(key);

  const size = 512;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const random = seededRandom(0x51d6a9);
  const outline = leafOutline();

  // 叶柄
  const stem = ctx.createLinearGradient(256, 512, 256, 438);
  stem.addColorStop(0, "#5f4828");
  stem.addColorStop(1, "#b4833a");
  ctx.strokeStyle = stem;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(256, 512);
  ctx.quadraticCurveTo(252, 486, 256, 450);
  ctx.stroke();

  // 扇形叶面
  ctx.beginPath();
  ctx.moveTo(LEAF_ORIGIN.x, LEAF_ORIGIN.y);
  for (const point of outline) ctx.lineTo(point.x, point.y);
  ctx.closePath();

  const fill = ctx.createRadialGradient(256, 430, 12, 256, 360, LEAF_RADIUS * 0.96);
  fill.addColorStop(0, "#e7c887");
  fill.addColorStop(0.32, "#f5dfa4");
  fill.addColorStop(0.68, "#ffeab5");
  fill.addColorStop(1, "#fff3cf");
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.save();
  ctx.clip();

  // 色彩斑驳，让每片叶子的纹理不重复
  for (let i = 0; i < 46; i++) {
    const x = 120 + random() * 272;
    const y = 190 + random() * 246;
    const radius = 6 + random() * 46;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const warm = random() < 0.72;
    gradient.addColorStop(
      0,
      warm
        ? `rgba(208, 148, 58, ${0.04 + random() * 0.09})`
        : `rgba(255, 250, 222, ${0.04 + random() * 0.1})`,
    );
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // 放射状叶脉
  const veinCount = 27;
  for (let i = 0; i < veinCount; i++) {
    const theta = -1.2 + (2.4 * i) / (veinCount - 1);
    const radius = leafRadius(theta) * 0.94;
    const endX = LEAF_ORIGIN.x + Math.sin(theta) * radius;
    const endY = LEAF_ORIGIN.y - Math.cos(theta) * radius;
    const midX = LEAF_ORIGIN.x + Math.sin(theta) * radius * 0.52;
    const midY = LEAF_ORIGIN.y - Math.cos(theta) * radius * 0.52;

    ctx.strokeStyle = "rgba(176, 122, 38, 0.5)";
    ctx.lineWidth = 1.05;
    ctx.beginPath();
    ctx.moveTo(LEAF_ORIGIN.x, LEAF_ORIGIN.y);
    ctx.quadraticCurveTo(midX + Math.sin(theta) * 8, midY, endX, endY);
    ctx.stroke();

    // 次级叶脉
    if (i % 2 === 0) {
      for (const side of [-1, 1]) {
        const branchTheta = theta + side * 0.11;
        const branchRadius = radius * (0.66 + random() * 0.16);
        const bx = LEAF_ORIGIN.x + Math.sin(branchTheta) * branchRadius;
        const by = LEAF_ORIGIN.y - Math.cos(branchTheta) * branchRadius;
        ctx.strokeStyle = "rgba(176, 122, 38, 0.26)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    }
  }

  // 中央叶柄延伸
  ctx.strokeStyle = "rgba(158, 106, 32, 0.36)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(LEAF_ORIGIN.x, LEAF_ORIGIN.y);
  ctx.lineTo(LEAF_ORIGIN.x, LEAF_ORIGIN.y - 26);
  ctx.stroke();

  // 边缘微暗，避免远景发白
  const edgeShade = ctx.createRadialGradient(256, 380, LEAF_RADIUS * 0.52, 256, 380, LEAF_RADIUS);
  edgeShade.addColorStop(0, "rgba(120, 76, 18, 0)");
  edgeShade.addColorStop(1, "rgba(120, 76, 18, 0.16)");
  ctx.fillStyle = edgeShade;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  ctx.strokeStyle = "rgba(146, 96, 28, 0.32)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(LEAF_ORIGIN.x, LEAF_ORIGIN.y);
  for (const point of outline) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.stroke();

  const texture = toTexture(canvas, {
    colorSpace: THREE.SRGBColorSpace,
    wrap: false,
    anisotropy,
  });
  cache.set(key, texture);
  return texture;
}

/* ------------------------------------------------------------------ */
/* 地面 / 草 / 光晕 / 环境                                             */
/* ------------------------------------------------------------------ */

export function getGroundTexture(anisotropy = 1) {
  const key = `ground:${anisotropy}`;
  if (cache.has(key)) return cache.get(key);

  const size = 512;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  const random = seededRandom(0x2f19b7);

  const soil = [74, 60, 42];
  const grass = [108, 108, 62];
  const dryGrass = [139, 127, 72];
  const moss = [86, 96, 52];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const broad = fbm2D(x * 0.016, y * 0.016, 11, 4);
      const fine = fbm2D(x * 0.11, y * 0.11, 29, 3);
      const litter = fbm2D(x * 0.05 + 40, y * 0.05, 43, 3);

      let r = soil[0];
      let g = soil[1];
      let b = soil[2];
      const grassMix = Math.min(1, Math.max(0, (broad - 0.38) * 2.4));
      r += (grass[0] - r) * grassMix * 0.86;
      g += (grass[1] - g) * grassMix * 0.86;
      b += (grass[2] - b) * grassMix * 0.86;

      const dryMix = Math.max(0, (litter - 0.58) * 2.2);
      r += (dryGrass[0] - r) * dryMix;
      g += (dryGrass[1] - g) * dryMix;
      b += (dryGrass[2] - b) * dryMix;

      const mossMix = Math.max(0, (fine - 0.62) * 1.6);
      r += (moss[0] - r) * mossMix * 0.5;
      g += (moss[1] - g) * mossMix * 0.5;
      b += (moss[2] - b) * mossMix * 0.5;

      const grain = (random() - 0.5) * 26;
      const index = (y * size + x) * 4;
      image.data[index] = Math.max(0, Math.min(255, r + grain));
      image.data[index + 1] = Math.max(0, Math.min(255, g + grain));
      image.data[index + 2] = Math.max(0, Math.min(255, b + grain * 0.8));
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  // 草叶、枯枝与碎叶
  for (let i = 0; i < 1600; i++) {
    const x = random() * size;
    const y = random() * size;
    const angle = random() * Math.PI * 2;
    const length = 1.4 + random() * 7;
    ctx.strokeStyle =
      random() < 0.42
        ? `rgba(183, 150, 70, ${0.12 + random() * 0.24})`
        : `rgba(58, 68, 34, ${0.1 + random() * 0.22})`;
    ctx.lineWidth = 0.5 + random() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  const texture = toTexture(canvas, {
    colorSpace: THREE.SRGBColorSpace,
    repeat: [16, 16],
    anisotropy,
  });
  cache.set(key, texture);
  return texture;
}

export function getGrassTexture(anisotropy = 1) {
  const key = `grass:${anisotropy}`;
  if (cache.has(key)) return cache.get(key);

  const size = 256;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const random = seededRandom(0x7ac35d);

  for (let i = 0; i < 34; i++) {
    const baseX = 38 + random() * (size - 76);
    const baseY = size - 4;
    const height = 52 + random() * 148;
    const bend = (random() - 0.5) * 86;
    const width = 1.4 + random() * 3.4;
    const tone = random();
    ctx.strokeStyle =
      tone < 0.52
        ? `rgba(152, 151, 92, ${0.72 + random() * 0.24})`
        : tone < 0.82
          ? `rgba(122, 132, 74, ${0.68 + random() * 0.28})`
          : `rgba(186, 164, 92, ${0.7 + random() * 0.26})`;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(
      baseX + bend * 0.35,
      baseY - height * 0.58,
      baseX + bend,
      baseY - height,
    );
    ctx.stroke();
  }

  const texture = toTexture(canvas, {
    colorSpace: THREE.SRGBColorSpace,
    wrap: false,
    anisotropy,
  });
  cache.set(key, texture);
  return texture;
}

/** 树下落叶毯：透明贴图，铺在地面之上增加秋日氛围。 */
export function getLitterTexture(anisotropy = 1) {
  const key = `litter:${anisotropy}`;
  if (cache.has(key)) return cache.get(key);

  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const random = seededRandom(0x4ab19c);
  const palette = [
    "rgba(216, 158, 58, 0.85)",
    "rgba(233, 185, 76, 0.82)",
    "rgba(197, 130, 44, 0.82)",
    "rgba(180, 112, 37, 0.78)",
    "rgba(158, 122, 58, 0.72)",
    "rgba(228, 197, 105, 0.8)",
  ];

  for (let i = 0; i < 1700; i++) {
    const radius = Math.pow(random(), 0.62) * 470;
    const angle = random() * Math.PI * 2;
    const x = size / 2 + Math.cos(angle) * radius;
    const y = size / 2 + Math.sin(angle) * radius;
    const scale = 0.18 + random() * 0.5;
    const rotation = random() * Math.PI * 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.fillStyle = palette[Math.floor(random() * palette.length)];
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.quadraticCurveTo(-10, 2, -13, -12);
    ctx.quadraticCurveTo(-7, -18, 0, -11);
    ctx.quadraticCurveTo(7, -18, 13, -12);
    ctx.quadraticCurveTo(10, 2, 0, 12);
    ctx.fill();
    ctx.restore();
  }

  // 少量深色枯枝与土块
  for (let i = 0; i < 260; i++) {
    const x = random() * size;
    const y = random() * size;
    ctx.strokeStyle = `rgba(64, 48, 28, ${0.12 + random() * 0.22})`;
    ctx.lineWidth = 1 + random() * 2.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * 30, y + (random() - 0.5) * 30);
    ctx.stroke();
  }

  // 圆形边缘淡出，避免出现生硬的贴图边界
  ctx.globalCompositeOperation = "destination-in";
  const fade = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.24,
    size / 2,
    size / 2,
    size * 0.5,
  );
  fade.addColorStop(0, "rgba(255, 255, 255, 1)");
  fade.addColorStop(0.7, "rgba(255, 255, 255, 0.92)");
  fade.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";

  const texture = toTexture(canvas, {
    colorSpace: THREE.SRGBColorSpace,
    wrap: false,
    anisotropy,
  });
  cache.set(key, texture);
  return texture;
}

export function getGlowTexture() {  if (cache.has("glow")) return cache.get("glow");
  const size = 256;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255, 249, 226, 1)");
  gradient.addColorStop(0.18, "rgba(255, 230, 170, 0.9)");
  gradient.addColorStop(0.46, "rgba(255, 196, 104, 0.32)");
  gradient.addColorStop(1, "rgba(255, 176, 80, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = toTexture(canvas, {
    colorSpace: THREE.SRGBColorSpace,
    wrap: false,
  });
  cache.set("glow", texture);
  return texture;
}

export function getEnvironmentTexture() {
  if (cache.has("environment")) return cache.get("environment");
  const width = 1024;
  const height = 512;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#7ea6c9");
  sky.addColorStop(0.34, "#b7c9d2");
  sky.addColorStop(0.52, "#f1d4a6");
  sky.addColorStop(0.62, "#f7c887");
  sky.addColorStop(0.72, "#8a6b45");
  sky.addColorStop(1, "#35281a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sun = ctx.createRadialGradient(700, 300, 0, 700, 300, 240);
  sun.addColorStop(0, "rgba(255, 247, 214, 0.95)");
  sun.addColorStop(0.22, "rgba(255, 224, 154, 0.6)");
  sun.addColorStop(0.62, "rgba(255, 190, 104, 0.16)");
  sun.addColorStop(1, "rgba(255, 180, 90, 0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);

  const random = seededRandom(0x77a1);
  for (let i = 0; i < 22; i++) {
    const x = random() * width;
    const y = 130 + random() * 150;
    const w = 120 + random() * 300;
    const cloud = ctx.createRadialGradient(x, y, 0, x, y, w);
    cloud.addColorStop(0, "rgba(255, 242, 214, 0.1)");
    cloud.addColorStop(1, "rgba(255, 242, 214, 0)");
    ctx.fillStyle = cloud;
    ctx.fillRect(0, 0, width, height);
  }

  const texture = toTexture(canvas, {
    colorSpace: THREE.SRGBColorSpace,
    wrap: true,
  });
  texture.mapping = THREE.EquirectangularReflectionMapping;
  cache.set("environment", texture);
  return texture;
}

export function disposeTextureCache() {
  for (const value of cache.values()) value.dispose?.();
  cache.clear();
}
