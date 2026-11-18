import * as THREE from "three";
import { fbm2, fbm3Tileable, ridged2, seededRandom } from "./noise.js";

/**
 * 程序化 Canvas 贴图。所有贴图都在浏览器内生成，不引用外部图片。
 * 结果按 key 缓存，避免重复生成。
 */

const cache = new Map();
const hasDOM = typeof document !== "undefined";
let fallbackTexture = null;

/** Node 测试环境没有 Canvas：返回 1×1 白色纹理，让几何测试可以跑。 */
function fallback() {
  if (!fallbackTexture) {
    const data = new Uint8Array([255, 255, 255, 255]);
    fallbackTexture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    fallbackTexture.needsUpdate = true;
  }
  return fallbackTexture;
}

function canvasTexture(key, size, draw, { srgb = false } = {}) {
  if (!hasDOM) return fallback();
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  draw(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

function fillNoise(context, size, fn) {
  const image = context.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = Math.max(0, Math.min(255, fn(x, y) * 255));
      const index = (y * size + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

/** 灰阶岩壁细节：分形噪声 + 细裂缝。 */
export function createRockTexture() {
  return canvasTexture("rock-detail", 256, (context, size) => {
    const random = seededRandom(4177);
    const cracks = Array.from({ length: 14 }, () => ({
      x: random() * size,
      y: random() * size,
      angle: random() * Math.PI,
      length: 20 + random() * 60,
    }));
    fillNoise(context, size, (x, y) => {
      const u = (x / size) * 8;
      const v = (y / size) * 8;
      const coarse = fbm2(u, v, 4, 91) * 0.5 + 0.5;
      const fine = fbm2(u * 4.1, v * 4.1, 3, 37) * 0.5 + 0.5;
      let value = 0.52 + coarse * 0.34 + (fine - 0.5) * 0.22;
      for (const crack of cracks) {
        const dx = x - crack.x;
        const dy = y - crack.y;
        const along = dx * Math.cos(crack.angle) + dy * Math.sin(crack.angle);
        const across = -dx * Math.sin(crack.angle) + dy * Math.cos(crack.angle);
        if (Math.abs(along) < crack.length && Math.abs(across) < 1.6) {
          value *= 0.62;
        }
      }
      return value;
    });
    context.globalAlpha = 0.22;
    context.fillStyle = "#39423a";
    for (let i = 0; i < 260; i++) {
      const x = random() * size;
      const y = random() * size;
      context.fillRect(x, y, 1 + random() * 2, 1 + random() * 2);
    }
    context.globalAlpha = 1;
  });
}

/** 林地/草坡的斑驳细节。 */
export function createGroundTexture() {
  return canvasTexture("ground-detail", 256, (context, size) => {
    fillNoise(context, size, (x, y) => {
      const u = (x / size) * 7;
      const v = (y / size) * 7;
      const broad = fbm2(u, v, 4, 211) * 0.5 + 0.5;
      const patch = ridged2(u * 2.3, v * 2.3, 3, 97);
      return 0.5 + broad * 0.36 + (patch - 0.5) * 0.18;
    });
  });
}

/** 青瓦：横向瓦垄 + 错缝，深灰蓝。 */
export function createRoofTileTexture() {
  return canvasTexture(
    "roof-tile",
    256,
    (context, size) => {
      context.fillStyle = "#3c424c";
      context.fillRect(0, 0, size, size);
      const rowHeight = 16;
      const tileWidth = 20;
      for (let row = 0; row < size / rowHeight; row++) {
        const y = row * rowHeight;
        context.fillStyle = row % 2 === 0 ? "#525a67" : "#4a525e";
        context.fillRect(0, y, size, rowHeight - 2);
        context.fillStyle = "#2b313a";
        context.fillRect(0, y + rowHeight - 2, size, 2);
        context.fillStyle = "#77808f";
        for (let x = (row % 2) * (tileWidth / 2); x < size; x += tileWidth) {
          context.fillRect(x, y + 2, 2, rowHeight - 4);
        }
      }
      context.globalAlpha = 0.16;
      context.fillStyle = "#0b0d10";
      for (let i = 0; i < 300; i++) {
        const x = (i * 97) % size;
        const y = (i * 61) % size;
        context.fillRect(x, y, 3, 3);
      }
      context.globalAlpha = 1;
    },
    { srgb: true },
  );
}

/** 深色木纹。 */
export function createWoodTexture() {
  return canvasTexture(
    "wood-grain",
    256,
    (context, size) => {
      context.fillStyle = "#4a3324";
      context.fillRect(0, 0, size, size);
      const random = seededRandom(8821);
      for (let i = 0; i < 90; i++) {
        const x = random() * size;
        const width = 0.6 + random() * 2.4;
        const shade = 40 + random() * 50;
        context.fillStyle = `rgba(${shade * 0.7}, ${shade * 0.48}, ${shade * 0.3}, 0.35)`;
        context.fillRect(x, 0, width, size);
      }
      context.globalAlpha = 0.25;
      context.fillStyle = "#1a100a";
      for (let i = 0; i < 26; i++) {
        const y = random() * size;
        context.fillRect(0, y, size, 1);
      }
      context.globalAlpha = 1;
    },
    { srgb: true },
  );
}

/** 窗棂格栅：深底 + 暖色木格。 */
export function createLatticeTexture() {
  return canvasTexture(
    "lattice",
    256,
    (context, size) => {
      context.fillStyle = "#181310";
      context.fillRect(0, 0, size, size);
      context.strokeStyle = "#8a6335";
      context.lineWidth = 4;
      const step = 32;
      for (let i = 0; i <= size; i += step) {
        context.beginPath();
        context.moveTo(i, 0);
        context.lineTo(i, size);
        context.stroke();
        context.beginPath();
        context.moveTo(0, i);
        context.lineTo(size, i);
        context.stroke();
      }
      context.strokeStyle = "#5d4223";
      context.lineWidth = 2;
      for (let i = step / 2; i <= size; i += step) {
        context.beginPath();
        context.moveTo(i, 0);
        context.lineTo(i, size);
        context.stroke();
        context.beginPath();
        context.moveTo(0, i);
        context.lineTo(size, i);
        context.stroke();
      }
    },
    { srgb: true },
  );
}

/** 石材：错缝砌块。 */
export function createStoneTexture() {
  return canvasTexture(
    "stone-block",
    256,
    (context, size) => {
      context.fillStyle = "#8c867a";
      context.fillRect(0, 0, size, size);
      const rowHeight = 32;
      const blockWidth = 64;
      for (let row = 0; row < size / rowHeight; row++) {
        const offset = row % 2 === 0 ? 0 : blockWidth / 2;
        for (let x = -blockWidth; x < size; x += blockWidth) {
          const shade = 120 + ((row * 37 + x * 13) % 34);
          context.fillStyle = `rgb(${shade}, ${shade - 5}, ${shade - 14})`;
          context.fillRect(x + offset + 2, row * rowHeight + 2, blockWidth - 4, rowHeight - 4);
        }
      }
      context.strokeStyle = "rgba(40,38,34,0.5)";
      context.lineWidth = 2;
      for (let row = 0; row <= size; row += rowHeight) {
        context.beginPath();
        context.moveTo(0, row);
        context.lineTo(size, row);
        context.stroke();
      }
    },
    { srgb: true },
  );
}

/** 匾额：深底金字。 */
export function createPlaqueTexture(text) {
  const key = `plaque-${text}`;
  if (!hasDOM) return fallback();
  return canvasTexture(
    key,
    512,
    (context, size) => {
      context.fillStyle = "#141a22";
      context.fillRect(0, 0, size, size * 0.4);
      context.strokeStyle = "#b08a4a";
      context.lineWidth = 8;
      context.strokeRect(10, 10, size - 20, size * 0.4 - 20);
      context.fillStyle = "#d8b06a";
      context.font = 'bold 108px "Songti SC", "STSong", serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, size / 2, size * 0.2);
    },
    { srgb: true },
  );
}

/** 竹叶：透明底上的一簇细长叶片，用于交叉卡片。 */
export function createBambooLeafTexture() {
  return canvasTexture(
    "bamboo-leaf",
    256,
    (context, size) => {
      context.clearRect(0, 0, size, size);
      const random = seededRandom(3311);
      for (let i = 0; i < 120; i++) {
        const x = random() * size;
        const y = random() * size;
        const length = 30 + random() * 54;
        const angle = random() * Math.PI * 2;
        context.save();
        context.translate(x, y);
        context.rotate(angle);
        const gradient = context.createLinearGradient(0, 0, length, 0);
        gradient.addColorStop(0, "rgba(118,152,64,0)");
        gradient.addColorStop(0.35, "rgba(138,176,78,0.98)");
        gradient.addColorStop(1, "rgba(74,108,44,0.95)");
        context.fillStyle = gradient;
        context.beginPath();
        context.moveTo(0, 0);
        context.quadraticCurveTo(length * 0.5, -5.5, length, 0);
        context.quadraticCurveTo(length * 0.5, 5.5, 0, 0);
        context.fill();
        context.restore();
      }
    },
    { srgb: true },
  );
}

/** 软雾团：用于贴谷雾片的透明度贴图。 */
export function createMistTexture() {
  return canvasTexture(
    "mist-sheet",
    256,
    (context, size) => {
      context.clearRect(0, 0, size, size);
      const random = seededRandom(5511);
      for (let i = 0; i < 44; i++) {
        const x = random() * size;
        const y = random() * size;
        const radius = 18 + random() * 60;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, "rgba(255,255,255,0.16)");
        gradient.addColorStop(0.5, "rgba(255,255,255,0.07)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    },
    { srgb: true },
  );
}

/** 水雾光点：瀑布底部的喷溅。 */
export function createSprayTexture() {
  return canvasTexture(
    "spray",
    128,
    (context, size) => {
      context.clearRect(0, 0, size, size);
      const gradient = context.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2,
      );
      gradient.addColorStop(0, "rgba(255,255,255,0.85)");
      gradient.addColorStop(0.45, "rgba(255,255,255,0.35)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
    },
    { srgb: true },
  );
}

/** 草叶：透明底上的几根细草。 */
export function createGrassBladeTexture() {
  return canvasTexture(
    "grass-blade",
    128,
    (context, size) => {
      context.clearRect(0, 0, size, size);
      const random = seededRandom(9199);
      for (let i = 0; i < 16; i++) {
        const x = 8 + random() * (size - 16);
        const height = 40 + random() * 70;
        const bend = (random() - 0.5) * 22;
        context.strokeStyle = i % 3 === 0 ? "#7d8f45" : "#5f7838";
        context.lineWidth = 1.6 + random() * 1.6;
        context.beginPath();
        context.moveTo(x, size);
        context.quadraticCurveTo(x + bend * 0.5, size - height * 0.6, x + bend, size - height);
        context.stroke();
      }
    },
    { srgb: true },
  );
}

/**
 * 可平铺的三维云噪声体纹理（64³, R8）。
 * 作为体积云 Ray Marching 的密度场，线性过滤 + 三轴 Repeat。
 */
export function createCloudNoise3D(size = 64, seed = 1234) {
  const key = `cloud-3d-${size}-${seed}`;
  if (cache.has(key)) return cache.get(key);
  const data = new Uint8Array(size * size * size);
  let index = 0;
  for (let z = 0; z < size; z++) {
    const w = (z + 0.5) / size;
    for (let y = 0; y < size; y++) {
      const v = (y + 0.5) / size;
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size;
        const n = fbm3Tileable(u, v, w, 5, seed, 8) * 0.5 + 0.5;
        data[index++] = Math.round(Math.min(1, Math.max(0, n)) * 255);
      }
    }
  }
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.wrapR = THREE.RepeatWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

export function disposeTextureCache() {
  for (const texture of cache.values()) texture.dispose();
  cache.clear();
}
