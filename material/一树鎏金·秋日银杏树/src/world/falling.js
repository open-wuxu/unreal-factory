import * as THREE from "three";
import { FALLING_LEAVES, LEAF } from "../config.js";
import { seededRandom } from "../utils/noise.js";
import { getLeafTexture } from "../utils/textures.js";
import { groundHeightAt } from "./ground.js";
import { createLeafGeometry } from "./tree.js";

/**
 * 少量独立飘落的银杏叶。
 *
 * 每一片叶子的位置、翻转与落地都由绝对时间解析得到，
 * 因此影片逐帧导出和网页实时播放看到的是同一条轨迹。
 */

const PALETTE = [0xf1bd48, 0xe0a038, 0xffd97c, 0xcf8a2c, 0xf6c95c, 0xb7a84c];

function smooth01(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

export function createFallingLeaves(scene, crownSamples, { anisotropy = 8 } = {}) {
  const random = seededRandom(0x6f2d11);
  const usable = crownSamples.filter((point) => point.y > 8.2);
  const source = usable.length ? usable : crownSamples;

  const count = FALLING_LEAVES.count;
  const geometry = createLeafGeometry();
  const material = new THREE.MeshStandardMaterial({
    map: getLeafTexture(anisotropy),
    alphaTest: LEAF.alphaTest,
    side: THREE.DoubleSide,
    roughness: 0.62,
    metalness: 0,
    color: 0xffffff,
    envMapIntensity: 0.6,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = "ginkgo-falling-leaves";
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false; // 实例逐帧移动，包围球不再可靠

  const leaves = [];
  const dummy = new THREE.Object3D();
  const euler = new THREE.Euler();

  for (let i = 0; i < count; i++) {
    const origin = source[Math.floor(random() * source.length)].clone();
    const jitterAngle = random() * Math.PI * 2;
    const jitterRadius = 0.15 + random() * 0.9;
    origin.x += Math.cos(jitterAngle) * jitterRadius;
    origin.z += Math.sin(jitterAngle) * jitterRadius;
    origin.y += random() * 1.2;

    // 约三分之一的叶子从树冠南侧落下，更容易从镜头前经过
    if (i % 3 === 0) {
      origin.z = Math.max(origin.z, 2.6);
      origin.x = Math.max(-4.5, Math.min(4.5, origin.x));
    }

    const duration =
      FALLING_LEAVES.minFallDuration +
      random() * (FALLING_LEAVES.maxFallDuration - FALLING_LEAVES.minFallDuration);
    const driftAngle = random() * Math.PI * 2;
    const drift = 0.35 + random() * 1.35;

    leaves.push({
      origin,
      duration,
      offset: random() * duration,
      driftX: Math.cos(driftAngle) * drift,
      driftZ: Math.sin(driftAngle) * drift,
      sway: 0.16 + random() * 0.42,
      phase: random() * Math.PI * 2,
      spinX: random() * Math.PI * 2,
      spinY: random() * Math.PI * 2,
      spinZ: random() * Math.PI * 2,
      tumbleX: (random() - 0.5) * 7.5,
      tumbleY: (random() - 0.5) * 5.5,
      tumbleZ: (random() - 0.5) * 6.5,
      scale: LEAF.size * (FALLING_LEAVES.sizeMin + random() * (FALLING_LEAVES.sizeMax - FALLING_LEAVES.sizeMin)),
      color: new THREE.Color(PALETTE[Math.floor(random() * PALETTE.length)]).multiplyScalar(
        0.86 + random() * 0.2,
      ),
    });
  }

  for (let i = 0; i < leaves.length; i++) {
    mesh.setColorAt(i, leaves[i].color);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  let enabled = true;

  function writeInstances(time) {
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      const cycle = (time + leaf.offset) % leaf.duration;
      const t = cycle / leaf.duration;

      const endX = leaf.origin.x + leaf.driftX;
      const endZ = leaf.origin.z + leaf.driftZ;
      const groundY = groundHeightAt(endX, endZ) + 0.03;

      const flutterEnvelope = Math.sin(Math.PI * Math.min(1, t * 1.05));
      const swayX = Math.cos(leaf.phase + t * Math.PI * 5.2) * leaf.sway * flutterEnvelope;
      const swayZ = Math.sin(leaf.phase * 1.4 + t * Math.PI * 4.1) * leaf.sway * 0.7 * flutterEnvelope;

      const x = leaf.origin.x + leaf.driftX * t + swayX;
      const z = leaf.origin.z + leaf.driftZ * t + swayZ;
      const baseY = leaf.origin.y + (groundY - leaf.origin.y) * Math.pow(t, 1.08);
      const y =
        baseY +
        Math.sin(leaf.phase + t * Math.PI * 9.3) * 0.13 * flutterEnvelope;

      const fadeIn = smooth01(t / 0.055);
      const fadeOut = 1 - smooth01((t - 0.94) / 0.06);
      const scale = leaf.scale * fadeIn * fadeOut;

      euler.set(
        leaf.spinX + leaf.tumbleX * t + Math.sin(t * 9.1 + leaf.phase) * 0.55,
        leaf.spinY + leaf.tumbleY * t,
        leaf.spinZ + leaf.tumbleZ * t + Math.cos(t * 7.3 + leaf.phase) * 0.45,
        "XYZ",
      );

      dummy.position.set(x, y, z);
      dummy.rotation.copy(euler);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function update(delta, elapsed) {
    void delta;
    if (!enabled) return;
    writeInstances(elapsed);
  }

  writeInstances(0);
  scene.add(mesh);

  return {
    mesh,
    update,
    setEnabled(value) {
      enabled = Boolean(value);
      mesh.visible = enabled;
    },
    get enabled() {
      return enabled;
    },
    dispose() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}
