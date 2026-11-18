import * as THREE from "three";
import { createMistTexture } from "../utils/textures.js";

/**
 * 贴谷雾带：几层低透明度的水平雾片，缓慢漂移。
 * 体量云海由 clouds.js 负责，这里只补充近山的薄雾层次。
 */

const SHEETS = [
  { x: 0, y: 900, z: 0, size: 2600, opacity: 0.06, speed: 4, phase: 0.3 },
  { x: -2800, y: 960, z: 300, size: 2200, opacity: 0.07, speed: -3, phase: 1.7 },
  { x: -2400, y: 980, z: -1200, size: 2200, opacity: 0.05, speed: 5, phase: 2.9 },
];

export function createMist(scene) {
  const group = new THREE.Group();
  group.name = "mist";
  const texture = createMistTexture();
  const meshes = [];

  for (const sheet of SHEETS) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(sheet.size, sheet.size),
      new THREE.MeshBasicMaterial({
        map: texture,
        color: 0xe4ebf0,
        transparent: true,
        opacity: sheet.opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(sheet.x, sheet.y, sheet.z);
    mesh.userData.sheet = sheet;
    mesh.renderOrder = 2;
    group.add(mesh);
    meshes.push(mesh);
  }

  scene.add(group);

  let clock = 0;

  function update(delta, state) {
    clock = state && state.time !== undefined ? state.time : clock + delta;
    for (const mesh of meshes) {
      const sheet = mesh.userData.sheet;
      mesh.position.x =
        sheet.x + Math.sin(clock * 0.03 + sheet.phase) * 90 + clock * sheet.speed * 0.5;
      mesh.position.z =
        sheet.z + Math.cos(clock * 0.024 + sheet.phase) * 70;
    }
  }

  return {
    group,
    update,
    setEnabled(value) {
      group.visible = Boolean(value);
    },
  };
}
