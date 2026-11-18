import * as THREE from "three";
import { WORLD } from "../config.js";
import {
  createFrostTexture,
  createMistTexture,
  seededRandom,
} from "../utils/textures.js";

/**
 * 低空薄雾与霜粒。
 *
 * 雾不做体积渲染：水面贴一层缓慢漂移的横向雾片，远岸与寺院前方
 * 叠加若干柔和的雾团，再用极细的霜粒点出深秋空气的寒意。
 * 钟声响起时，远岸雾团会有一点点被推开的扰动。
 */

export function createMist() {
  const group = new THREE.Group();
  group.name = "Mist";

  const mistTexture = createMistTexture({ seed: 41, size: 512 });
  const rand = seededRandom(701);

  /* ---- 水面横向雾片 ---- */
  const sheets = [];
  const sheetMaterial = new THREE.MeshBasicMaterial({
    map: mistTexture,
    color: 0x697a8b,
    transparent: true,
    opacity: 0.075,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    blending: THREE.NormalBlending,
  });

  for (let i = 0; i < 22; i++) {
    const width = 45 + rand() * 100;
    const depth = 18 + rand() * 40;
    const geometry = new THREE.PlaneGeometry(width, depth);
    const mesh = new THREE.Mesh(geometry, sheetMaterial.clone());
    mesh.material.opacity = 0.055 + rand() * 0.075;
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rand() * Math.PI * 2;
    mesh.position.set(
      (rand() - 0.5) * 360,
      WORLD.waterLevel + 0.35 + rand() * 1.4,
      (rand() - 0.5) * 70,
    );
    mesh.renderOrder = 6;
    mesh.userData.phase = rand() * Math.PI * 2;
    mesh.userData.drift = 0.2 + rand() * 0.5;
    mesh.userData.base = mesh.position.clone();
    group.add(mesh);
    sheets.push(mesh);
  }

  /* ---- 远岸 / 寺院前的雾团 ---- */
  const banks = [];
  for (let i = 0; i < 18; i++) {
    const material = new THREE.SpriteMaterial({
      map: mistTexture,
      color: 0x7c8c9d,
      transparent: true,
      opacity: 0.035 + rand() * 0.05,
      depthWrite: false,
      fog: true,
    });
    const sprite = new THREE.Sprite(material);
    const size = 42 + rand() * 90;
    sprite.scale.set(size, size * (0.42 + rand() * 0.2), 1);
    sprite.position.set(
      (rand() - 0.5) * 260,
      5 + rand() * 12,
      -42 - rand() * 130,
    );
    sprite.userData.phase = rand() * Math.PI * 2;
    sprite.userData.base = sprite.position.clone();
    sprite.userData.size = size;
    sprite.renderOrder = 7;
    group.add(sprite);
    banks.push(sprite);
  }

  // 寺院前的几团薄雾：让屋檐与钟楼在夜里若隐若现
  for (let i = 0; i < 8; i++) {
    const material = new THREE.SpriteMaterial({
      map: mistTexture,
      color: 0x8b9aab,
      transparent: true,
      opacity: 0.06 + rand() * 0.045,
      depthWrite: false,
      fog: true,
    });
    const sprite = new THREE.Sprite(material);
    const size = 48 + rand() * 54;
    sprite.scale.set(size, size * (0.34 + rand() * 0.16), 1);
    sprite.position.set(
      12 + rand() * 66,
      9 + rand() * 11,
      -88 - rand() * 44,
    );
    sprite.userData.phase = rand() * Math.PI * 2;
    sprite.userData.base = sprite.position.clone();
    sprite.userData.size = size;
    sprite.renderOrder = 7;
    group.add(sprite);
    banks.push(sprite);
  }

  /* ---- 霜粒 ---- */
  const frostCount = 520;
  const frostGeometry = new THREE.BufferGeometry();
  const frostPositions = new Float32Array(frostCount * 3);
  const frostPhase = new Float32Array(frostCount);
  const frostBase = new Float32Array(frostCount * 3);
  const frostSizes = new Float32Array(frostCount);

  for (let i = 0; i < frostCount; i++) {
    const x = (rand() - 0.5) * 220;
    const y = 2 + rand() * 34;
    const z = -80 + rand() * 150;
    frostBase[i * 3] = x;
    frostBase[i * 3 + 1] = y;
    frostBase[i * 3 + 2] = z;
    frostPositions[i * 3] = x;
    frostPositions[i * 3 + 1] = y;
    frostPositions[i * 3 + 2] = z;
    frostPhase[i] = rand() * Math.PI * 2;
    frostSizes[i] = 0.05 + rand() * 0.09;
  }

  frostGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(frostPositions, 3),
  );

  const frostMaterial = new THREE.PointsMaterial({
    map: createFrostTexture(),
    color: 0xc8d8ea,
    transparent: true,
    opacity: 0.5,
    size: 0.14,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    alphaTest: 0.02,
  });

  const frost = new THREE.Points(frostGeometry, frostMaterial);
  frost.frustumCulled = false;
  frost.renderOrder = 8;
  group.add(frost);

  let enabled = true;
  let lastTime = 0;

  return {
    group,
    frost,
    update(delta, elapsed, state) {
      if (!enabled) return;
      const dt = Math.min(delta, 0.05);

      for (const sheet of sheets) {
        const phase = sheet.userData.phase;
        const drift = sheet.userData.drift;
        sheet.position.x =
          sheet.userData.base.x + Math.sin(elapsed * 0.045 + phase) * 12 * drift;
        sheet.position.z =
          sheet.userData.base.z + Math.cos(elapsed * 0.037 + phase) * 5 * drift;
        sheet.material.opacity =
          (0.035 + 0.035 * (0.5 + 0.5 * Math.sin(elapsed * 0.11 + phase))) *
          (state?.mistDensity ?? 1);
        sheet.rotation.z += dt * 0.004 * drift;
      }

      const time = state?.time ?? elapsed;
      const soundAge = time - 28.6;
      for (const sprite of banks) {
        const phase = sprite.userData.phase;
        let shift = 0;
        let opacity =
          0.03 + 0.035 * (0.5 + 0.5 * Math.sin(elapsed * 0.08 + phase));

        // 钟声掠过时，薄雾被轻轻推开
        if (soundAge > 0 && soundAge < 6) {
          const push = Math.max(0, 1 - soundAge / 6);
          shift = Math.sin(soundAge * 2.2 + phase) * 2.2 * push;
          opacity += push * 0.012;
        }

        sprite.position.x = sprite.userData.base.x + shift;
        sprite.position.y = sprite.userData.base.y + shift * 0.35;
        sprite.material.opacity = opacity * (state?.mistDensity ?? 1);
      }

      // 霜粒缓慢下坠、随风漂移
      const positions = frostGeometry.attributes.position;
      for (let i = 0; i < frostCount; i++) {
        const phase = frostPhase[i];
        let x = frostBase[i * 3] + Math.sin(elapsed * 0.11 + phase) * 2.4;
        let y = frostBase[i * 3 + 1] - ((elapsed * 0.12 + phase) % 8) * 0.6;
        let z = frostBase[i * 3 + 2] + Math.cos(elapsed * 0.07 + phase * 1.3) * 1.8;
        if (y < 1.5) y += 30;
        positions.setXYZ(i, x, y, z);
      }
      positions.needsUpdate = true;
      frostMaterial.opacity =
        (0.32 + 0.12 * Math.sin(elapsed * 0.5)) * (state?.frostDensity ?? 1);

      lastTime = time;
    },
    setEnabled(value) {
      enabled = value;
      group.visible = value;
    },
    get enabled() {
      return enabled;
    },
  };
}
