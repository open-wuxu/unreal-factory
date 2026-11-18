import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { PEAKS } from "../config.js";
import { seededRandom } from "../utils/noise.js";
import {
  createBambooLeafTexture,
  createGrassBladeTexture,
} from "../utils/textures.js";
import { heightAt, normalAt } from "./shape.js";

/**
 * 植被：竹海、松林、秋林与草簇。
 *
 * 全部用 InstancedMesh；竹竿与叶片通过 onBeforeCompile 注入风摆。
 * 分布按「竹林团簇 + 坡向筛选」，避开峰顶建筑台地。
 */

const COUNTS = {
  dazhuBamboo: 12800,
  xiaozhuBamboo: 5600,
  pine: 1000,
  autumn: 600,
  grass: 3200,
};

const windUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
};

function withWind(material, bendExpression, key) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;\nuniform float uWind;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 windWorld = modelMatrix * instanceMatrix * vec4(position, 1.0);
        float bend = ${bendExpression};
        transformed.x += sin(uTime * 0.85 + windWorld.x * 0.045 + windWorld.z * 0.06) * 0.55 * uWind * bend;
        transformed.z += cos(uTime * 0.63 + windWorld.x * 0.03) * 0.32 * uWind * bend;`,
      );
  };
  material.customProgramCacheKey = () => key;
  return material;
}

function slopeAt(x, z) {
  return normalAt(x, z).y;
}

function grovePlacements(peak, total, seed, opts) {
  const random = seededRandom(seed);
  const placements = [];
  const perGrove = 80;
  const maxAttempts = Math.ceil(total / perGrove) * 40;
  let attempts = 0;

  while (placements.length < total && attempts < maxAttempts) {
    attempts++;
    const angle = random() * Math.PI * 2;
    const distance =
      peak.plateau * opts.inner + random() * peak.radius * opts.spread;
    const cx = peak.x + Math.cos(angle) * distance;
    const cz = peak.z + Math.sin(angle) * distance;
    const centerHeight = heightAt(cx, cz);
    if (
      centerHeight < peak.height * opts.minHeightRatio ||
      centerHeight > peak.height - 10 ||
      slopeAt(cx, cz) < 0.52
    ) {
      continue;
    }
    const groveRadius = 18 + random() * 24;
    for (let i = 0; i < perGrove && placements.length < total; i++) {
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * groveRadius;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (slopeAt(x, z) < 0.45) continue;
      const y = heightAt(x, z);
      if (y > peak.height - 8) continue;
      placements.push({
        x,
        y,
        z,
        height: 12 + random() * 7,
        scale: 0.8 + random() * 0.5,
        rotation: random() * Math.PI * 2,
        tilt: (random() - 0.5) * 0.08,
      });
    }
  }
  return placements;
}

function scatteredPlacements(peak, total, seed, opts) {
  const random = seededRandom(seed);
  const placements = [];
  let attempts = 0;
  while (placements.length < total && attempts < total * 20) {
    attempts++;
    const angle = random() * Math.PI * 2;
    const distance =
      peak.plateau * opts.inner + random() * peak.radius * opts.spread;
    const x = peak.x + Math.cos(angle) * distance;
    const z = peak.z + Math.sin(angle) * distance;
    if (slopeAt(x, z) < opts.minSlope) continue;
    const y = heightAt(x, z);
    if (y < opts.minHeight || y > peak.height - opts.clearance) continue;
    placements.push({
      x,
      y,
      z,
      scale: opts.scaleMin + random() * (opts.scaleMax - opts.scaleMin),
      rotation: random() * Math.PI * 2,
      height: opts.heightMin + random() * (opts.heightMax - opts.heightMin),
    });
  }
  return placements;
}

function setInstances(mesh, placements, configure, colors) {
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  placements.forEach((placement, index) => {
    configure(dummy, placement);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    if (colors) {
      colors(color, placement, index);
      mesh.setColorAt(index, color);
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (colors && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function createVegetation(scene) {
  const group = new THREE.Group();
  group.name = "vegetation";
  const samplePoints = [];

  const dazhu = PEAKS.find((peak) => peak.id === "dazhu");
  const xiaozhu = PEAKS.find((peak) => peak.id === "xiaozhu");
  const luoxia = PEAKS.find((peak) => peak.id === "luoxia");

  const dazhuBamboo = grovePlacements(dazhu, COUNTS.dazhuBamboo, 501, {
    inner: 1.04,
    spread: 1.1,
    minHeightRatio: 0.74,
  });
  const xiaozhuBamboo = grovePlacements(xiaozhu, COUNTS.xiaozhuBamboo, 733, {
    inner: 1.05,
    spread: 1.0,
    minHeightRatio: 0.8,
  });
  const bamboo = [...dazhuBamboo, ...xiaozhuBamboo];
  samplePoints.push(...bamboo.slice(0, 120));

  /* 竹竿 ------------------------------------------------------------ */
  const culmGeometry = new THREE.CylinderGeometry(0.1, 0.15, 1, 5, 2, true);
  culmGeometry.translate(0, 0.5, 0);
  const culmMaterial = withWind(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
    "smoothstep(0.0, 1.0, position.y)",
    "qingyun-bamboo-culm",
  );
  const culms = new THREE.InstancedMesh(
    culmGeometry,
    culmMaterial,
    bamboo.length,
  );
  culms.castShadow = false;
  culms.receiveShadow = true;
  setInstances(
    culms,
    bamboo,
    (dummy, p) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.tilt, p.rotation, p.tilt * 0.6);
      dummy.scale.set(p.scale, p.height, p.scale);
    },
    (color, p, index) => {
      const hue = 0.22 + ((index % 11) / 11) * 0.035;
      color.setHSL(hue, 0.45, 0.38 + ((index % 7) / 7) * 0.1);
    },
  );
  group.add(culms);

  /* 竹叶簇 ---------------------------------------------------------- */
  const leafGeometry = mergeGeometries([
    new THREE.PlaneGeometry(4.2, 5.2),
    new THREE.PlaneGeometry(4.2, 5.2).rotateY(Math.PI / 2),
  ]);
  const leafMaterial = withWind(
    new THREE.MeshStandardMaterial({
      map: createBambooLeafTexture(),
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.92,
      metalness: 0,
      color: 0xffffff,
      emissive: 0x223018,
      emissiveIntensity: 0.45,
    }),
    "1.0",
    "qingyun-bamboo-leaf",
  );
  const leaves = new THREE.InstancedMesh(
    leafGeometry,
    leafMaterial,
    bamboo.length,
  );
  leaves.castShadow = false;
  leaves.receiveShadow = true;
  setInstances(
    leaves,
    bamboo,
    (dummy, p) => {
      dummy.position.set(p.x, p.y + p.height, p.z);
      dummy.rotation.set(0, p.rotation * 1.7, 0);
      const scale = 1.6 + p.scale * 0.9;
      dummy.scale.set(scale, scale * 1.15, scale);
    },
    (color, p, index) => {
      color.setHSL(0.235, 0.5, 0.42 + ((index % 5) / 5) * 0.1);
    },
  );
  group.add(leaves);

  // 中段叶簇：让竹丛在远处连成一片绿雾，而不是几根孤立的竹竿。
  const leavesLow = new THREE.InstancedMesh(
    leafGeometry,
    leafMaterial,
    bamboo.length,
  );
  leavesLow.castShadow = false;
  leavesLow.receiveShadow = true;
  setInstances(
    leavesLow,
    bamboo,
    (dummy, p) => {
      dummy.position.set(p.x, p.y + p.height * 0.58, p.z);
      dummy.rotation.set(0, p.rotation * 1.3 + 0.6, 0);
      const scale = 1.0 + p.scale * 0.6;
      dummy.scale.set(scale, scale * 1.1, scale);
    },
    (color, p, index) => {
      color.setHSL(0.235, 0.48, 0.36 + ((index % 6) / 6) * 0.08);
    },
  );
  group.add(leavesLow);

  /* 松林 ------------------------------------------------------------ */
  const pinePlacements = [];
  let pineSeed = 800;
  for (const peak of PEAKS) {
    const share = Math.round(COUNTS.pine / PEAKS.length);
    pinePlacements.push(
      ...scatteredPlacements(peak, share, pineSeed, {
        inner: 1.15,
        spread: 1.35,
        minSlope: 0.42,
        minHeight: peak.height * 0.7,
        clearance: 12,
        scaleMin: 0.7,
        scaleMax: 1.35,
        heightMin: 1,
        heightMax: 1,
      }),
    );
    pineSeed += 97;
  }
  samplePoints.push(...pinePlacements.slice(0, 40));

  const trunkGeometry = new THREE.CylinderGeometry(0.32, 0.62, 6, 6);
  trunkGeometry.translate(0, 3, 0);
  const trunkMaterial = withWind(
    new THREE.MeshStandardMaterial({ color: 0x4b3a2b, roughness: 0.95 }),
    "clamp(position.y / 12.0, 0.0, 1.0) * 0.3",
    "qingyun-pine-trunk",
  );
  const pineTrunks = new THREE.InstancedMesh(
    trunkGeometry,
    trunkMaterial,
    pinePlacements.length,
  );
  setInstances(pineTrunks, pinePlacements, (dummy, p) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.rotation, 0);
    dummy.scale.set(p.scale, p.scale, p.scale);
  });

  const coneA = new THREE.ConeGeometry(3.4, 6, 7);
  coneA.translate(0, 6.2, 0);
  const coneB = new THREE.ConeGeometry(2.6, 5, 7);
  coneB.translate(0, 9.2, 0);
  const coneC = new THREE.ConeGeometry(1.7, 4, 7);
  coneC.translate(0, 11.9, 0);
  const pineFoliageGeometry = mergeGeometries([coneA, coneB, coneC]);
  const pineFoliageMaterial = withWind(
    new THREE.MeshStandardMaterial({
      color: 0x4a6440,
      roughness: 0.95,
      flatShading: true,
    }),
    "clamp(position.y / 12.0, 0.0, 1.0) * 0.35",
    "qingyun-pine-foliage",
  );
  const pineFoliage = new THREE.InstancedMesh(
    pineFoliageGeometry,
    pineFoliageMaterial,
    pinePlacements.length,
  );
  setInstances(pineFoliage, pinePlacements, (dummy, p) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.rotation, 0);
    dummy.scale.set(p.scale, p.scale, p.scale);
  });
  group.add(pineTrunks, pineFoliage);

  /* 秋林（落霞峰） --------------------------------------------------- */
  const autumnPlacements = scatteredPlacements(luoxia, COUNTS.autumn, 4242, {
    inner: 1.1,
    spread: 1.5,
    minSlope: 0.38,
    minHeight: 980,
    clearance: 10,
    scaleMin: 0.75,
    scaleMax: 1.3,
    heightMin: 1,
    heightMax: 1,
  });
  samplePoints.push(...autumnPlacements.slice(0, 40));

  const autumnTrunks = new THREE.InstancedMesh(
    trunkGeometry,
    trunkMaterial,
    autumnPlacements.length,
  );
  setInstances(autumnTrunks, autumnPlacements, (dummy, p) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.rotation, 0);
    dummy.scale.set(p.scale, p.scale * 0.9, p.scale);
  });

  const crownParts = [];
  for (const [x, y, z, radius] of [
    [0, 8.4, 0, 4.0],
    [2.6, 7.4, 1.2, 3.1],
    [-2.4, 7.8, -1.4, 3.3],
    [0.6, 10.8, 1.4, 2.9],
  ]) {
    const sphere = new THREE.IcosahedronGeometry(radius, 1);
    sphere.translate(x, y, z);
    crownParts.push(sphere);
  }
  const crownGeometry = mergeGeometries(crownParts);
  const crownMaterial = withWind(
    new THREE.MeshStandardMaterial({
      color: 0xa35a2e,
      roughness: 0.94,
      flatShading: true,
    }),
    "clamp(position.y / 12.0, 0.0, 1.0) * 0.4",
    "qingyun-autumn-crown",
  );
  const autumnCrowns = new THREE.InstancedMesh(
    crownGeometry,
    crownMaterial,
    autumnPlacements.length,
  );
  setInstances(
    autumnCrowns,
    autumnPlacements,
    (dummy, p) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.rotation, 0);
      dummy.scale.set(p.scale, p.scale, p.scale);
    },
    (color, p, index) => {
      color.setHSL(0.055 + ((index % 5) / 5) * 0.035, 0.55, 0.38);
    },
  );
  group.add(autumnTrunks, autumnCrowns);

  /* 草簇 ------------------------------------------------------------ */
  const grassPlacements = [];
  let grassSeed = 1700;
  for (const peak of PEAKS) {
    const share = Math.round(COUNTS.grass / PEAKS.length);
    grassPlacements.push(
      ...scatteredPlacements(peak, share, grassSeed, {
        inner: 0.78,
        spread: 0.55,
        minSlope: 0.35,
        minHeight: 600,
        clearance: 2,
        scaleMin: 0.8,
        scaleMax: 1.8,
        heightMin: 1,
        heightMax: 1,
      }),
    );
    grassSeed += 131;
  }
  samplePoints.push(...grassPlacements.slice(0, 40));

  const grassGeometry = mergeGeometries([
    new THREE.PlaneGeometry(1.6, 1.2),
    new THREE.PlaneGeometry(1.6, 1.2).rotateY(Math.PI / 2),
  ]);
  grassGeometry.translate(0, 0.6, 0);
  const grassMaterial = withWind(
    new THREE.MeshStandardMaterial({
      map: createGrassBladeTexture(),
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.95,
      color: 0xffffff,
    }),
    "smoothstep(0.0, 1.2, position.y)",
    "qingyun-grass",
  );
  const grass = new THREE.InstancedMesh(
    grassGeometry,
    grassMaterial,
    grassPlacements.length,
  );
  grass.castShadow = false;
  grass.receiveShadow = true;
  setInstances(
    grass,
    grassPlacements,
    (dummy, p) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.rotation, 0);
      dummy.scale.set(p.scale, p.scale, p.scale);
    },
    (color, p, index) => {
      color.setHSL(0.21, 0.34, 0.32 + ((index % 4) / 4) * 0.07);
    },
  );
  group.add(grass);

  scene.add(group);

  function update(delta, state) {
    if (state && state.time !== undefined) {
      windUniforms.uTime.value = state.time;
    } else {
      windUniforms.uTime.value += delta;
    }
    windUniforms.uWind.value = state && state.wind !== undefined ? state.wind : 1;
  }

  return {
    group,
    update,
    counts: {
      bamboo: {
        dazhu: dazhuBamboo.length,
        xiaozhu: xiaozhuBamboo.length,
        total: bamboo.length,
      },
      pine: pinePlacements.length,
      autumn: autumnPlacements.length,
      grass: grassPlacements.length,
    },
    samplePoints,
  };
}
