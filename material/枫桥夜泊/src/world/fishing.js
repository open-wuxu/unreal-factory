import * as THREE from "three";
import { FISHING_BOATS, WORLD } from "../config.js";
import { createGlowTexture, seededRandom } from "../utils/textures.js";
import { woodMaterial } from "./materials.js";

/**
 * 江上的渔船与渔火。
 *
 * 五艘小舟分布在远近不同的水面上，每艘只有一盏微弱的灯火。
 * 灯火的世界坐标会注册到水面 shader，形成随波晃动、断续的暖色倒影。
 */

function createSampanGeometry(length, beam, depth) {
  const stations = 14;
  const across = 7;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= stations; i++) {
    const t = i / stations;
    const x = -length / 2 + t * length;
    const taper = Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.96 + 0.02)), 0.42);
    const half = beam * 0.5 * taper;
    const top = 0.34 + 0.18 * Math.pow(Math.abs(t - 0.5) * 2, 2);
    const bottom = -depth * Math.pow(Math.sin(Math.PI * Math.min(1, t)), 0.3);

    for (let j = 0; j <= across; j++) {
      const s = j / across;
      const a = (s - 0.5) * Math.PI;
      const z = Math.sin(a) * half;
      const rise = Math.pow(0.5 - 0.5 * Math.cos(a), 0.8);
      positions.push(x, bottom + (top - bottom) * rise, z);
      uvs.push(t * 3, s);
    }
  }

  for (let i = 0; i < stations; i++) {
    const row = i * (across + 1);
    const next = (i + 1) * (across + 1);
    for (let j = 0; j < across; j++) {
      indices.push(row + j, next + j, row + j + 1, row + j + 1, next + j, next + j + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createFishingBoats() {
  const group = new THREE.Group();
  group.name = "FishingBoats";

  const hullMaterial = woodMaterial(0x8a6a4a, {
    map: "woodFine",
    repeat: [2, 1],
  });
  const darkWood = new THREE.MeshStandardMaterial({
    color: 0x2c1e14,
    roughness: 0.9,
    metalness: 0.02,
  });
  const glowTexture = createGlowTexture({ size: 128, power: 2.6 });
  const lanternMaterial = new THREE.MeshBasicMaterial({
    color: 0xff9346,
    transparent: true,
    opacity: 0.95,
  });

  const boats = [];
  const lanternWorlds = [];
  const rand = seededRandom(401);

  FISHING_BOATS.forEach(([x, z, power], index) => {
    const boat = new THREE.Group();
    const heading = (rand() - 0.5) * 0.5 + (index % 2 === 0 ? 0.1 : -0.2);
    boat.position.set(x, WORLD.waterLevel, z);
    boat.rotation.y = heading;

    const hull = new THREE.Mesh(
      createSampanGeometry(4.8, 1.5, 0.42),
      hullMaterial,
    );
    hull.castShadow = true;
    hull.receiveShadow = true;
    boat.add(hull);

    // 简单的竹篷
    const canopy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.72, 1.7, 12, 1, true, 0, Math.PI),
      darkWood,
    );
    canopy.rotation.z = Math.PI / 2;
    canopy.scale.set(1, 1, 0.72);
    canopy.position.set(0.3, 0.42, 0);
    boat.add(canopy);

    // 撑篙
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 2.6, 5),
      darkWood,
    );
    pole.position.set(-1.7, 1.0, 0.18);
    pole.rotation.z = 0.34;
    boat.add(pole);

    // 船头灯火
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      lanternMaterial.clone(),
    );
    lantern.scale.y = 1.25;
    lantern.position.set(-1.55, 0.72, 0);
    boat.add(lantern);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xff8f40,
        transparent: true,
        opacity: 0.34 * power,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.scale.setScalar(1.6 + power * 0.7);
    glow.position.copy(lantern.position);
    boat.add(glow);

    group.add(boat);
    boats.push({
      group: boat,
      lantern,
      glow,
      base: new THREE.Vector3(x, WORLD.waterLevel, z),
      phase: rand() * Math.PI * 2,
      power,
      flicker: rand() * 6.28,
    });

    const worldLantern = new THREE.Vector3();
    lantern.getWorldPosition(worldLantern);
    lanternWorlds.push(worldLantern);
  });

  return {
    group,
    boats,
    lanternWorlds,
    update(delta, elapsed) {
      for (let i = 0; i < boats.length; i++) {
        const boat = boats[i];
        const t = elapsed;
        boat.group.position.y =
          boat.base.y +
          Math.sin(t * 0.62 + boat.phase) * 0.035 +
          Math.sin(t * 1.41 + boat.phase * 1.7) * 0.012;
        boat.group.rotation.z =
          Math.sin(t * 0.7 + boat.phase) * 0.02;
        boat.group.rotation.x =
          Math.cos(t * 0.52 + boat.phase * 1.3) * 0.012;

        const flicker =
          0.72 +
          0.16 * Math.sin(t * 7.3 + boat.flicker) +
          0.12 * Math.sin(t * 13.7 + boat.flicker * 2.1);
        boat.glow.material.opacity = 0.28 + 0.2 * flicker;
        boat.lantern.material.opacity = 0.7 + 0.25 * flicker;
        boat.lantern.scale.set(1, 1.25 + Math.sin(t * 5.1 + boat.flicker) * 0.05, 1);

        boat.lantern.getWorldPosition(lanternWorlds[i]);
      }
    },
  };
}
