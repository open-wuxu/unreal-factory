import * as THREE from "three";
import { fbm2, ridged2, seededRandom } from "./noise.js";

/**
 * 程序化 Canvas 贴图。所有贴图都在浏览器内生成，不引用外部图片。
 * 结果按 key 缓存，避免重复生成。
 */

const cache = new Map();

function canvasTexture(key, size, draw, { srgb = false } = {}) {
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

export function disposeTextureCache() {
  for (const texture of cache.values()) texture.dispose();
  cache.clear();
}
