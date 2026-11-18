import * as THREE from "three";
import { COLORS, PEAKS, WORLD } from "../config.js";
import { clamp, fbm2, smoothstep } from "../utils/noise.js";
import { createMaterials } from "./materials.js";
import { heightAt, normalAt } from "./shape.js";

/**
 * 同心方环地形（clipmap 式）。
 *
 * 所有顶点都按同一解析高度函数取样；相邻环共享的边界坐标完全一致，
 * 因此不会有地表接缝。近环细、远环粗，最外环没入天边雾中。
 */

const RINGS = [
  { half: 2400, cell: 15, inner: 0 },
  { half: 4800, cell: 30, inner: 2400 },
  { half: 9600, cell: 60, inner: 4800 },
  { half: 19200, cell: 120, inner: 9600 },
];

const rockColor = new THREE.Color(COLORS.rock);
const darkRockColor = new THREE.Color(COLORS.darkRock);
const grassColor = new THREE.Color(COLORS.grass);
const bambooColor = new THREE.Color(COLORS.bamboo);
const autumnColor = new THREE.Color(COLORS.autumn);
const highRockColor = new THREE.Color(0x837d70);
const courtyardColor = new THREE.Color(COLORS.path);
const scratchColor = new THREE.Color();
const scratchPalette = new THREE.Color();

function nearestPeak(x, z) {
  let best = PEAKS[0];
  let bestDistance = Infinity;
  for (const peak of PEAKS) {
    const dx = x - peak.x;
    const dz = z - peak.z;
    const distance = dx * dx + dz * dz;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = peak;
    }
  }
  return { peak: best, distance: Math.sqrt(bestDistance) };
}

function colorFor(x, z, height, normalY, peak, distance) {
  const slope = 1 - normalY;
  const base = scratchColor;

  if (peak.palette === "bamboo") scratchPalette.copy(bambooColor);
  else if (peak.palette === "autumn") scratchPalette.copy(autumnColor);
  else if (peak.palette === "darkRock") scratchPalette.copy(darkRockColor);
  else scratchPalette.copy(grassColor);

  const influence = 1 - smoothstep(peak.radius * 1.2, peak.radius * 2.8, distance);
  base.copy(grassColor).lerp(scratchPalette, influence * 0.9);

  if (height > 1330) {
    base.lerp(rockColor, smoothstep(1330, 1700, height) * 0.7);
  }

  // 峰顶台地是铺石广场，而不是草地。
  const courtyard =
    1 - smoothstep(peak.plateau * 0.92, peak.plateau * 1.22, distance);
  if (courtyard > 0) {
    base.lerp(courtyardColor, courtyard * 0.82);
  }

  const rockWeight = smoothstep(0.34, 0.72, slope);
  if (rockWeight > 0) {
    scratchPalette.copy(peak.palette === "darkRock" ? darkRockColor : rockColor);
    base.lerp(scratchPalette, rockWeight * 0.85);
    base.lerp(highRockColor, rockWeight * smoothstep(0.6, 0.95, slope) * 0.35);
  }

  const variation = fbm2(x * 0.0026, z * 0.0026, 3, 13) * 0.5 + 0.5;
  const fine = fbm2(x * 0.011, z * 0.011, 2, 71) * 0.5 + 0.5;
  return base.multiplyScalar(0.8 + variation * 0.32 + (fine - 0.5) * 0.08);
}

/** 低成本半球遮蔽：只对近环取 4 个方向的高度差。 */
function ambientOcclusion(x, z, height, sample) {
  if (!sample) {
    return 1;
  }
  let occlusion = 0;
  const radius = 55;
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + 0.6;
    const neighbour = heightAt(
      x + Math.cos(angle) * radius,
      z + Math.sin(angle) * radius,
    );
    occlusion += Math.max(0, neighbour - height - 6);
  }
  return clamp(1 - (occlusion / 4) * 0.0075, 0.55, 1);
}

function buildRing(ring, ringIndex) {
  const { half, cell, inner } = ring;
  const segments = Math.round((half * 2) / cell);
  const stride = segments + 1;
  const vertices = [];
  const indices = [];
  const map = new Int32Array(stride * stride).fill(-1);

  for (let j = 0; j <= segments; j++) {
    const z = -half + j * cell;
    for (let i = 0; i <= segments; i++) {
      const x = -half + i * cell;
      if (inner > 0 && Math.abs(x) < inner - 1e-6 && Math.abs(z) < inner - 1e-6) {
        continue;
      }
      const index = vertices.length / 3;
      map[j * stride + i] = index;
      vertices.push(x, heightAt(x, z), z);
    }
  }

  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = map[j * stride + i];
      const b = map[(j + 1) * stride + i];
      const c = map[(j + 1) * stride + i + 1];
      const d = map[j * stride + i + 1];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      indices.push(a, b, c, a, c, d);
    }
  }

  // 缝合带：粗环的内边界每格补一个细采样中点，填平与细环之间的
  // T 型接缝（细环单元恰好是粗环的一半）。
  if (inner > 0) {
    const innerStart = Math.round((half - inner) / cell);
    const innerEnd = Math.round((half + inner) / cell);
    const addStitch = (indexA, indexB) => {
      const a = map[indexA];
      const b = map[indexB];
      if (a < 0 || b < 0) return;
      const ax = vertices[a * 3];
      const az = vertices[a * 3 + 2];
      const bx = vertices[b * 3];
      const bz = vertices[b * 3 + 2];
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const mid = vertices.length / 3;
      vertices.push(mx, heightAt(mx, mz), mz);
      indices.push(a, b, mid);
    };
    for (let i = innerStart; i < innerEnd; i++) {
      addStitch(innerStart * stride + i, innerStart * stride + i + 1);
      addStitch(innerEnd * stride + i, innerEnd * stride + i + 1);
    }
    for (let j = innerStart; j < innerEnd; j++) {
      addStitch(j * stride + innerStart, (j + 1) * stride + innerStart);
      addStitch(j * stride + innerEnd, (j + 1) * stride + innerEnd);
    }
  }

  const position = new Float32Array(vertices);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setIndex(indices);

  // 法线统一由解析函数取样，保证相邻环在共享边上的光照一致。
  const normalArray = new Float32Array(position.length);
  const normal = new THREE.Vector3();
  for (let v = 0; v < position.length / 3; v++) {
    normalAt(position[v * 3], position[v * 3 + 2], normal);
    normalArray[v * 3] = normal.x;
    normalArray[v * 3 + 1] = normal.y;
    normalArray[v * 3 + 2] = normal.z;
  }
  geometry.setAttribute(
    "normal",
    new THREE.BufferAttribute(normalArray, 3),
  );
  geometry.computeBoundingSphere();

  const normals = geometry.getAttribute("normal");
  const colors = new Float32Array((position.length / 3) * 3);
  const aoSample = ringIndex === 0;

  for (let v = 0; v < position.length / 3; v++) {
    const x = position[v * 3];
    const z = position[v * 3 + 2];
    const y = position[v * 3 + 1];
    const normalY = Math.abs(normals.getY(v));
    const { peak, distance } = nearestPeak(x, z);
    const rawAo = ambientOcclusion(x, z, y, aoSample);
    // 近环外缘把 AO 渐隐到 1，避免与无 AO 的粗环形成亮度接缝。
    const edgeFade = smoothstep(
      ring.half - 300,
      ring.half,
      Math.max(Math.abs(x), Math.abs(z)),
    );
    const ao = aoSample ? 1 - (1 - rawAo) * (1 - edgeFade) : 1;
    const color = colorFor(x, z, y, normalY, peak, distance);
    color.multiplyScalar(ao);
    colors[v * 3] = color.r;
    colors[v * 3 + 1] = color.g;
    colors[v * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function createTerrain(scene) {
  const materials = createMaterials();
  const group = new THREE.Group();
  group.name = "terrain";

  let vertexCount = 0;
  let triangleCount = 0;

  RINGS.forEach((ring, ringIndex) => {
    const geometry = buildRing(ring, ringIndex);
    const mesh = new THREE.Mesh(geometry, materials.terrain);
    mesh.name = `terrain-ring-${ringIndex}`;
    mesh.castShadow = ringIndex <= 1;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
    vertexCount += geometry.getAttribute("position").count;
    triangleCount += geometry.index.count / 3;
  });

  scene.add(group);

  return {
    group,
    sampleHeight: heightAt,
    sampleNormal: normalAt,
    ringCount: RINGS.length,
    vertexCount,
    triangleCount,
    far: WORLD.far,
  };
}
