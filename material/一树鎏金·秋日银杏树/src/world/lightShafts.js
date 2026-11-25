import * as THREE from "three";
import { COLORS, SUN_DIRECTION } from "../config.js";
import { getGlowTexture } from "../utils/textures.js";

/**
 * 树冠背后的柔和金色光束。
 *
 * 用少量加法混合的屏幕空间 Sprite 模拟阳光穿过枝叶后的散射。
 * Sprite 位于树后，被树冠与树干真实遮挡，只在枝叶缝隙间露出，
 * 因此不会出现廉价的整屏光柱。
 */

const SHAFTS = [
  { offset: [-3.6, 1.4], scale: [5.2, 22], opacity: 0.03, rotation: 0.16, phase: 0.3 },
  { offset: [-1.6, 2.7], scale: [4.2, 19], opacity: 0.026, rotation: -0.1, phase: 1.7 },
  { offset: [1.5, 3.6], scale: [5.8, 24], opacity: 0.024, rotation: 0.22, phase: 2.9 },
  { offset: [3.7, 1.9], scale: [4.6, 20], opacity: 0.028, rotation: -0.18, phase: 4.2 },
  { offset: [0.5, -2.2], scale: [6.2, 18], opacity: 0.02, rotation: 0.08, phase: 5.4 },
  { offset: [-2.7, -2.9], scale: [4.8, 17], opacity: 0.018, rotation: -0.24, phase: 3.6 },
];

export function createLightShafts(scene) {
  const group = new THREE.Group();
  group.name = "ginkgo-light-shafts";

  const sunDir = SUN_DIRECTION.clone();
  const right = new THREE.Vector3().crossVectors(sunDir, new THREE.Vector3(0, 1, 0)).normalize();
  const upish = new THREE.Vector3().crossVectors(right, sunDir).normalize();
  const center = sunDir.clone().multiplyScalar(31);
  const texture = getGlowTexture();

  const items = [];
  for (const config of SHAFTS) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: COLORS.shaft,
      transparent: true,
      opacity: config.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      fog: false,
      rotation: config.rotation,
      toneMapped: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position
      .copy(center)
      .addScaledVector(right, config.offset[0])
      .addScaledVector(upish, config.offset[1]);
    sprite.scale.set(config.scale[0], config.scale[1], 1);
    group.add(sprite);
    items.push({ sprite, material, config });
  }

  scene.add(group);
  let enabled = true;

  function update(delta, elapsed) {
    void delta;
    if (!enabled) return;
    for (const item of items) {
      const pulse =
        0.82 +
        0.18 * Math.sin(elapsed * 0.33 + item.config.phase) +
        0.06 * Math.sin(elapsed * 0.91 + item.config.phase * 1.7);
      item.material.opacity = item.config.opacity * pulse;
    }
    group.position.x = Math.sin(elapsed * 0.04) * 0.4;
  }

  return {
    group,
    update,
    setEnabled(value) {
      enabled = Boolean(value);
      group.visible = enabled;
    },
    dispose() {
      scene.remove(group);
      for (const item of items) item.material.dispose();
    },
  };
}
