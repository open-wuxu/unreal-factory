import * as THREE from "three";

/**
 * 程序化贴图库。
 *
 * 所有贴图都由 Canvas 生成，并使用固定 seed，保证每次打开、
 * 以及逐帧导出时画面完全一致。不依赖任何外部图片资源。
 */

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

function finishTexture(canvas, { srgb = true, repeat = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  texture.anisotropy = 8;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------------------ */
/* 木材                                                                */
/* ------------------------------------------------------------------ */

function createWoodCanvas({
  seed = 7,
  base = "#745741",
  light = "#a07a58",
  dark = "#33241a",
  planks = 7,
  horizontal = true,
  size = 512,
}) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const rand = seededRandom(seed);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // 每条木板的轻微色差
  const plankSize = size / planks;
  for (let i = 0; i < planks; i++) {
    const shade = 0.82 + rand() * 0.36;
    ctx.fillStyle = `rgba(${Math.round(120 * shade)}, ${Math.round(88 * shade)}, ${Math.round(60 * shade)}, 0.55)`;
    if (horizontal) ctx.fillRect(0, i * plankSize, size, plankSize);
    else ctx.fillRect(i * plankSize, 0, plankSize, size);
  }

  // 木纹：细长的低透明度曲线
  for (let i = 0; i < 220; i++) {
    const shade = rand();
    ctx.strokeStyle = shade > 0.5 ? dark : light;
    ctx.globalAlpha = 0.05 + rand() * 0.14;
    ctx.lineWidth = 0.6 + rand() * 1.6;
    ctx.beginPath();
    if (horizontal) {
      const y = rand() * size;
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 24) {
        ctx.lineTo(x, y + Math.sin(x * 0.035 + rand() * 3) * (2 + rand() * 4));
      }
    } else {
      const x = rand() * size;
      ctx.moveTo(x, 0);
      for (let y = 0; y <= size; y += 24) {
        ctx.lineTo(x + Math.sin(y * 0.035 + rand() * 3) * (2 + rand() * 4), y);
      }
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 板缝
  ctx.strokeStyle = "rgba(8, 5, 3, 0.75)";
  ctx.lineWidth = 2;
  for (let i = 1; i < planks; i++) {
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(0, i * plankSize);
      ctx.lineTo(size, i * plankSize);
    } else {
      ctx.moveTo(i * plankSize, 0);
      ctx.lineTo(i * plankSize, size);
    }
    ctx.stroke();
  }

  // 钉子
  ctx.fillStyle = "rgba(15, 10, 7, 0.8)";
  for (let i = 0; i < planks * 5; i++) {
    const x = (rand() * planks) * plankSize;
    const y = Math.floor(rand() * size);
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

export function createWoodTexture(options = {}) {
  return finishTexture(createWoodCanvas(options));
}

/* ------------------------------------------------------------------ */
/* 石材                                                                */
/* ------------------------------------------------------------------ */

function createStoneCanvas({
  seed = 11,
  base = "#6f6a61",
  size = 512,
  rows = 6,
  cols = 4,
}) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const rand = seededRandom(seed);

  ctx.fillStyle = "#4a453e";
  ctx.fillRect(0, 0, size, size);

  const cellW = size / cols;
  const cellH = size / rows;

  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * cellW * 0.5;
    for (let col = -1; col <= cols; col++) {
      const x = col * cellW + offset + 2;
      const y = row * cellH + 2;
      const w = cellW - 4 + (rand() - 0.5) * 5;
      const h = cellH - 4 + (rand() - 0.5) * 3;
      const shade = 0.72 + rand() * 0.5;
      const r = Math.round(180 * shade);
      const g = Math.round(172 * shade);
      const b = Math.round(158 * shade);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x, y, w, h);

      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, "rgba(255,255,255,0.06)");
      grad.addColorStop(0.5, "rgba(255,255,255,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.18)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);

      // 石面斑驳
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = rand() > 0.5 ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.arc(x + rand() * w, y + rand() * h, 0.6 + rand() * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 青苔 / 水渍
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(36, 52, 38, ${0.03 + rand() * 0.09})`;
    ctx.beginPath();
    ctx.ellipse(
      rand() * size,
      rand() * size,
      8 + rand() * 34,
      4 + rand() * 16,
      rand() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  return canvas;
}

export function createStoneTexture(options = {}) {
  return finishTexture(createStoneCanvas(options));
}

/* ------------------------------------------------------------------ */
/* 瓦片                                                                */
/* ------------------------------------------------------------------ */

function createRoofCanvas({ seed = 23, size = 512 } = {}) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const rand = seededRandom(seed);

  ctx.fillStyle = "#2a2d31";
  ctx.fillRect(0, 0, size, size);

  const cols = 28;
  const rows = 14;
  const cw = size / cols;
  const rh = size / rows;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cw;
      const y = row * rh;
      const shade = 0.55 + rand() * 0.5;
      ctx.fillStyle = `rgb(${Math.round(92 * shade)}, ${Math.round(96 * shade)}, ${Math.round(102 * shade)})`;
      ctx.beginPath();
      ctx.ellipse(x + cw * 0.5, y + rh * 0.62, cw * 0.52, rh * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(0,0,0,0.42)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + rh * 0.1);
      ctx.lineTo(x, y + rh);
      ctx.stroke();

      const grad = ctx.createLinearGradient(x, y, x, y + rh);
      grad.addColorStop(0, "rgba(180,190,205,0.10)");
      grad.addColorStop(0.4, "rgba(255,255,255,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.25)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, cw, rh);
    }
  }

  return canvas;
}

export function createRoofTexture(options = {}) {
  return finishTexture(createRoofCanvas(options));
}

/* ------------------------------------------------------------------ */
/* 树皮                                                                */
/* ------------------------------------------------------------------ */

function createBarkCanvas({ seed = 31, size = 256 } = {}) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const rand = seededRandom(seed);

  ctx.fillStyle = "#3a2f27";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 300; i++) {
    ctx.strokeStyle = rand() > 0.55 ? "rgba(102,82,66,0.35)" : "rgba(6,4,3,0.4)";
    ctx.lineWidth = 0.6 + rand() * 2.4;
    const x = rand() * size;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= size; y += 16) {
      ctx.lineTo(x + Math.sin(y * 0.06 + rand() * 5) * (2 + rand() * 5), y);
    }
    ctx.stroke();
  }

  // 苔痕
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = `rgba(50, 66, 48, ${0.05 + rand() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(rand() * size, rand() * size, 3 + rand() * 14, 2 + rand() * 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

export function createBarkTexture(options = {}) {
  return finishTexture(createBarkCanvas(options));
}

/* ------------------------------------------------------------------ */
/* 枫叶（用于实例化叶片）                                               */
/* ------------------------------------------------------------------ */

function mapleLeafPath(ctx, size) {
  const cx = size * 0.5;
  const cy = size * 0.56;
  const r = size * 0.44;
  const lobes = 5;
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2 - Math.PI / 2;
    const lobe = Math.abs(Math.cos(a * lobes * 0.5));
    const notch = 0.62 + 0.38 * Math.pow(lobe, 2.6);
    const radius = r * notch;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius * 1.05;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function createLeafCanvas({ size = 128 } = {}) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  mapleLeafPath(ctx, size);
  ctx.fill();

  // 叶脉
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 1.2;
  const cx = size * 0.5;
  const cy = size * 0.58;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy + size * 0.3);
  ctx.stroke();
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.06);
    ctx.quadraticCurveTo(cx + i * size * 0.12, cy - size * 0.1, cx + i * size * 0.22, cy - size * 0.2);
    ctx.stroke();
  }

  return canvas;
}

export function createLeafTexture() {
  const texture = finishTexture(createLeafCanvas(), { repeat: false });
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/* ------------------------------------------------------------------ */
/* 光斑 / 雾 / 霜                                                       */
/* ------------------------------------------------------------------ */

function createGlowCanvas({ size = 256, power = 2.4 } = {}) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  for (let i = 0; i <= 12; i++) {
    const x = i / 12;
    const alpha = Math.pow(1 - x, power);
    grad.addColorStop(x, `rgba(255,255,255,${alpha.toFixed(3)})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function createGlowTexture(options = {}) {
  return finishTexture(createGlowCanvas(options), { repeat: false });
}

function createMistCanvas({ seed = 41, size = 512 } = {}) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const rand = seededRandom(seed);
  const image = ctx.createImageData(size, size);
  const data = image.data;

  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.13) * 43758.5453;
    return n - Math.floor(n);
  };
  const noise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  const fbm = (x, y) => {
    let value = 0;
    let amp = 0.5;
    for (let i = 0; i < 5; i++) {
      value += noise(x, y) * amp;
      x *= 2.03;
      y *= 2.03;
      amp *= 0.5;
    }
    return value;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * 3.2;
      const ny = (y / size) * 3.2;
      let value = fbm(nx, ny);
      value = Math.pow(Math.max(0, value - 0.32), 1.25) * 2.4;
      const dx = (x / size - 0.5) * 2;
      const dy = (y / size - 0.5) * 2;
      const radial = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      const alpha = Math.min(1, value * radial * radial * 1.6);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(image, 0, 0);

  // 轻微擦除几处，避免过于对称
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.1 + rand() * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(rand() * size, rand() * size, 30 + rand() * 90, 18 + rand() * 44, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  return canvas;
}

export function createMistTexture(options = {}) {
  const texture = finishTexture(createMistCanvas(options), { repeat: false });
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function createFrostCanvas({ seed = 53, size = 64 } = {}) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const rand = seededRandom(seed);
  ctx.clearRect(0, 0, size, size);
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(235,244,255,0.7)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
  ctx.fill();
  // 六角冰晶的暗示
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand() * 0.2;
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    ctx.lineTo(size / 2 + Math.cos(a) * size * 0.4, size / 2 + Math.sin(a) * size * 0.4);
    ctx.stroke();
  }
  return canvas;
}

export function createFrostTexture() {
  const texture = finishTexture(createFrostCanvas(), { repeat: false });
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/* ------------------------------------------------------------------ */
/* 发光材质标记                                                         */
/* ------------------------------------------------------------------ */

export function tagEmissive(material, type = "lamp", base = 1.0) {
  material.userData.emissiveType = type;
  material.userData.emissiveBase = base;
  return material;
}
