import * as THREE from "three";
import { getFacade, tagEmissive } from "../utils/textures.js";

/**
 * 带窗格贴图的 PBR 立面材质。
 * emissiveIntensity 由时间系统按 window 类型统一驱动。
 */
export function facadeMaterial(
  kind,
  {
    tint = 0xffffff,
    roughness = 0.42,
    metalness = 0.32,
    envMapIntensity = 1.0,
    emissiveBase = 1.0,
  } = {},
) {
  const { map, emissiveMap } = getFacade(kind);
  const material = new THREE.MeshStandardMaterial({
    color: tint,
    map,
    emissiveMap,
    emissive: 0xffffff,
    emissiveIntensity: 0,
    roughness,
    metalness,
    envMapIntensity,
  });
  return tagEmissive(material, "window", emissiveBase);
}

/**
 * 纯发光材质：灯杆、霓虹、车灯、船舱灯。
 * 通过 userData.emissiveType 归类，便于批量切换昼夜亮度。
 */
export function emissiveMaterial(
  color,
  {
    type = "neon",
    base = 1.0,
    roughness = 0.45,
    metalness = 0.1,
    baseColor = 0x090909,
  } = {},
) {
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    emissive: color,
    emissiveIntensity: 0,
    roughness,
    metalness,
  });
  return tagEmissive(material, type, base);
}

/** 玻璃幕墙（无贴图的补充构件）。 */
export function glassMaterial(
  color = 0x8fc4e8,
  { roughness = 0.15, metalness = 0.82, envMapIntensity = 1.4 } = {},
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    envMapIntensity,
  });
}

/** 混凝土 / 石材。 */
export function stoneMaterial(color = 0xb9ad98, roughness = 0.82) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.04,
  });
}

/** 深色金属。 */
export function metalMaterial(color = 0x3a4048, roughness = 0.45, metalness = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

/** 在两点之间放置一根圆柱，用于斜撑、缆索骨架。 */
export function cylinderBetween(a, b, radius, material, radialSegments = 8) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
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
  return mesh;
}

/**
 * 收集场景里所有按发光类型标记过的材质（去重）。
 * 时间系统只需遍历这几十个材质，而不是整个场景图。
 */
export function collectEmissiveMaterials(root) {
  const registry = {
    window: [],
    lamp: [],
    neon: [],
    car: [],
    boat: [],
  };
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
        base: material.userData.emissiveBase ?? 1.0,
      });
    }
  });

  return registry;
}

/** 按时间状态更新全部发光强度。 */
export function applyEmissiveState(registry, state) {
  const intensities = {
    window: state.windowIntensity,
    lamp: state.lampIntensity,
    neon: state.neonIntensity,
    car: state.carLight,
    boat: state.boatLight,
  };

  for (const type of Object.keys(registry)) {
    for (const entry of registry[type]) {
      entry.material.emissiveIntensity = intensities[type] * entry.base;
    }
  }
}
