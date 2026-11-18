import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import {
  createBarkTexture,
  createRoofTexture,
  createStoneTexture,
  createWoodTexture,
  tagEmissive,
} from "../utils/textures.js";

/**
 * 共享材质与几何工具。
 *
 * 场景中重复出现的石材、木材、瓦片、树皮全部复用同一份材质，
 * 以便实例化渲染并减少 GPU 状态切换。
 */

let cache = null;

function textures() {
  if (cache) return cache;
  const stone = createStoneTexture({ seed: 11, rows: 6, cols: 4 });
  stone.repeat.set(2.2, 1.4);
  const stoneFine = createStoneTexture({ seed: 17, rows: 10, cols: 7 });
  stoneFine.repeat.set(1.4, 1.4);
  const wood = createWoodTexture({ seed: 7, planks: 7 });
  wood.repeat.set(1, 2);
  const woodFine = createWoodTexture({
    seed: 29,
    planks: 12,
    base: "#4a3626",
    light: "#6d513a",
    dark: "#241812",
  });
  woodFine.repeat.set(2, 2);
  const roof = createRoofTexture({ seed: 23 });
  roof.repeat.set(3, 2);
  const bark = createBarkTexture({ seed: 31 });
  bark.repeat.set(1.2, 2.4);

  cache = { stone, stoneFine, wood, woodFine, roof, bark };
  return cache;
}

export function stoneMaterial(
  color = 0x8a857a,
  { roughness = 0.88, map = "stone", repeat = null } = {},
) {
  const tex = textures()[map]?.clone() ?? null;
  if (tex) {
    if (repeat) tex.repeat.set(repeat[0], repeat[1]);
    tex.needsUpdate = true;
  }
  return new THREE.MeshStandardMaterial({
    color,
    map: tex,
    roughness,
    metalness: 0.035,
    envMapIntensity: 0.55,
  });
}

export function woodMaterial(
  color = 0x6a4c34,
  { roughness = 0.82, map = "wood", repeat = null, metalness = 0.03 } = {},
) {
  const tex = textures()[map]?.clone() ?? null;
  if (tex) {
    if (repeat) tex.repeat.set(repeat[0], repeat[1]);
    tex.needsUpdate = true;
  }
  return new THREE.MeshStandardMaterial({
    color,
    map: tex,
    roughness,
    metalness,
    envMapIntensity: 0.5,
  });
}

export function roofMaterial(color = 0x4a4e55) {
  const map = textures().roof.clone();
  map.repeat.set(3, 2);
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    color,
    map,
    roughness: 0.72,
    metalness: 0.06,
    envMapIntensity: 0.7,
  });
}

export function barkMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x6b523e,
    map: textures().bark,
    roughness: 0.95,
    metalness: 0.02,
    envMapIntensity: 0.3,
  });
}

export function bronzeMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x8a7444,
    roughness: 0.34,
    metalness: 0.96,
    envMapIntensity: 1.5,
  });
}

export function darkMetalMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x2a2b28,
    roughness: 0.44,
    metalness: 0.85,
    envMapIntensity: 0.9,
  });
}

/**
 * 自发光材质。type 用于归类，base 为相对强度。
 * 场景的夜色是固定的，强度由 world 的 update 做轻微呼吸 / 摇曳。
 */
export function emissiveMaterial(
  color,
  { type = "lamp", base = 1.0, intensity = 0, roughness = 0.5, metalness = 0.0, baseColor = 0x050403 } = {},
) {
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    emissive: color,
    emissiveIntensity: intensity * base,
    roughness,
    metalness,
    envMapIntensity: 0.4,
  });
  return tagEmissive(material, type, base);
}

/** 灯笼纸：半透、暖光、无光照。 */
export function lanternPaperMaterial(color = 0xffb768) {
  return tagEmissive(
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      toneMapped: true,
    }),
    "lamp",
    1.0,
  );
}

/** 在两點之间放置一根锥形圆柱。用于枝干、缆绳、栏杆。 */
export function cylinderBetween(
  a,
  b,
  radiusA,
  radiusB,
  material,
  radialSegments = 7,
) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(
    radiusB,
    radiusA,
    length,
    radialSegments,
    1,
    false,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(a).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** 合并一组 Mesh 的几何（同材质），返回单个 Mesh。 */
export function mergeMeshes(meshes, material, { castShadow = true } = {}) {
  const geometries = [];
  for (const mesh of meshes) {
    mesh.updateMatrix();
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrix);
    geometries.push(geometry);
  }
  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  if (!merged) {
    return new THREE.Group();
  }
  const result = new THREE.Mesh(merged, material);
  result.castShadow = castShadow;
  result.receiveShadow = true;
  return result;
}

/** 收集可发光材质，供统一亮度控制。 */
export function collectEmissiveMaterials(root) {
  const registry = { lamp: [], window: [], boat: [], fire: [] };
  const seen = new Set();
  root.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      const type = material?.userData?.emissiveType;
      if (!type || !(type in registry) || seen.has(material)) continue;
      seen.add(material);
      registry[type].push({
        material,
        base: material.userData.emissiveBase ?? 1,
        initial: material.emissiveIntensity ?? 1,
      });
    }
  });
  return registry;
}

export function applyEmissiveScale(registry, scale) {
  for (const list of Object.values(registry)) {
    for (const entry of list) {
      entry.material.emissiveIntensity = entry.initial * scale;
    }
  }
}

/** 生成一张夜空的等距柱状环境贴图，供金属与湿润表面反射。 */
export function createEnvironmentTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#0a1220");
  grad.addColorStop(0.45, "#182a44");
  grad.addColorStop(0.62, "#334a63");
  grad.addColorStop(0.72, "#1a2532");
  grad.addColorStop(1, "#05080d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // 月亮的柔光
  const moonX = 512 * (0.44 + 0.5) % 512;
  const moonY = 256 * 0.33;
  const glow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 70);
  glow.addColorStop(0, "rgba(220,233,250,0.95)");
  glow.addColorStop(0.12, "rgba(180,200,225,0.5)");
  glow.addColorStop(1, "rgba(120,150,190,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 512, 256);

  // 近岸暖光的微弱交代
  const warm = ctx.createRadialGradient(512 * 0.1, 256 * 0.6, 0, 512 * 0.1, 256 * 0.6, 90);
  warm.addColorStop(0, "rgba(255,170,90,0.18)");
  warm.addColorStop(1, "rgba(255,170,90,0)");
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, 512, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
