import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import { LEAF, WORLD } from "../config.js";
import { fbm2D, seededRandom, smooth01 } from "../utils/noise.js";
import {
  getGrassTexture,
  getGroundTexture,
  getLeafTexture,
  getLitterTexture,
} from "../utils/textures.js";
import { createLeafGeometry } from "./tree.js";

/**
 * 地面、草簇与散落的银杏叶。
 *
 * 地面高度只由 groundHeightAt(x, z) 决定，飘落叶片和草簇都查询它，
 * 确保所有落点贴地。树根附近是一处非常缓的土丘。
 */

export function groundHeightAt(x, z) {
  const radius = Math.hypot(x, z);
  const mound = 0.21 * Math.exp(-(radius * radius) / 7.5);
  const broad = (fbm2D(x * 0.055 + 31.7, z * 0.055 - 12.3, 7, 4) - 0.5) * 0.16;
  const fine = (fbm2D(x * 0.21 - 8.1, z * 0.21 + 4.4, 19, 3) - 0.5) * 0.045;
  const rim = smooth01((radius - 26) / 90) * -0.06;
  return mound + broad + fine + rim;
}

function createGroundMesh(anisotropy) {
  const size = WORLD.groundSize;
  const segments = 168;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, groundHeightAt(x, z));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  // 树根附近偏暖的土壤色，远处偏草绿，打破重复贴图的均匀感
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const radius = Math.hypot(x, z);
    const warm = Math.exp(-(radius * radius) / 55);
    const patch = fbm2D(x * 0.09 + 17.3, z * 0.09 - 4.1, 55, 3);
    const shade = 0.86 + patch * 0.28;
    colors[i * 3] = (0.94 + 0.14 * warm) * shade;
    colors[i * 3 + 1] = (0.99 + 0.01 * warm) * shade;
    colors[i * 3 + 2] = (0.86 - 0.14 * warm) * shade;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshStandardMaterial({
    map: getGroundTexture(anisotropy),
    roughness: 0.96,
    metalness: 0,
    color: 0xffffff,
    vertexColors: true,
    envMapIntensity: 0.32,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "ginkgo-ground";
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function createLeafLitter(anisotropy) {
  const radius = 8.8;
  const geometry = new THREE.CircleGeometry(radius, 128);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, groundHeightAt(x, z) + 0.022);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    map: getLitterTexture(anisotropy),
    transparent: true,
    depthWrite: false,
    roughness: 1,
    metalness: 0,
    color: 0xffffff,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "ginkgo-leaf-litter";
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  return { mesh, geometry, material };
}

function createFallenLeaves(anisotropy, random) {
  const count = 1400;
  const geometry = createLeafGeometry();
  const material = new THREE.MeshStandardMaterial({
    map: getLeafTexture(anisotropy),
    alphaTest: LEAF.alphaTest,
    side: THREE.DoubleSide,
    roughness: 0.84,
    metalness: 0,
    color: 0xffffff,
    envMapIntensity: 0.36,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = "ginkgo-fallen-leaves";
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  const dummy = new THREE.Object3D();
  const normal = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const palette = [0xe6b24a, 0xd69433, 0xf2ca6d, 0xc27a2e, 0xb58a3a, 0x9e9a4b];

  for (let i = 0; i < count; i++) {
    const radius = 9.6 * Math.pow(random(), 0.62);
    const angle = random() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const tiltX = (random() - 0.5) * 0.62;
    const tiltZ = (random() - 0.5) * 0.62;
    normal.set(tiltX, 1, tiltZ).normalize();
    quaternion.setFromUnitVectors(zAxis, normal);
    spin.setFromAxisAngle(normal, random() * Math.PI * 2);
    quaternion.premultiply(spin);

    dummy.position.set(x, groundHeightAt(x, z) + 0.016 + random() * 0.014, z);
    dummy.quaternion.copy(quaternion);
    dummy.scale.setScalar(LEAF.size * (0.66 + random() * 0.5));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    const color = new THREE.Color(palette[Math.floor(random() * palette.length)]);
    color.multiplyScalar(0.84 + random() * 0.22);
    mesh.setColorAt(i, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return { mesh, geometry, material };
}

function createGrass(anisotropy, random, uniforms) {
  const blade = new THREE.PlaneGeometry(1, 1, 1, 2);
  blade.translate(0, 0.5, 0);
  const crossed = blade.clone();
  crossed.rotateY(Math.PI / 2);
  const geometry = BufferGeometryUtils.mergeGeometries([blade, crossed], false);
  blade.dispose();
  crossed.dispose();
  if (!geometry) throw new Error("草叶几何合并失败");

  const material = new THREE.MeshStandardMaterial({
    map: getGrassTexture(anisotropy),
    alphaTest: 0.32,
    side: THREE.DoubleSide,
    roughness: 0.92,
    metalness: 0,
    color: 0xffffff,
    envMapIntensity: 0.3,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uTime;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float grassPhase = dot(instanceMatrix[3].xyz, vec3(0.41, 0.13, 0.67));
        float grassHeight = clamp(position.y, 0.0, 1.0);
        transformed.x += sin(uTime * 1.15 + grassPhase) * 0.06 * grassHeight * grassHeight;
        transformed.z += cos(uTime * 0.91 + grassPhase * 1.7) * 0.04 * grassHeight * grassHeight;`,
      );
  };
  material.customProgramCacheKey = () => "ginkgo-grass-wind";

  const count = 2000;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = "ginkgo-grass";
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  const dummy = new THREE.Object3D();
  const palette = [0xa3a56b, 0x8f9b5e, 0xb8a766, 0xa8945c, 0x869456];

  for (let i = 0; i < count; i++) {
    const radius = 1.15 + Math.pow(random(), 0.7) * 24;
    const angle = random() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const height = 0.24 + random() * 0.38;

    dummy.position.set(x, groundHeightAt(x, z) - 0.01, z);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    dummy.scale.set(0.26 + random() * 0.36, height, 0.26 + random() * 0.36);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    const color = new THREE.Color(palette[Math.floor(random() * palette.length)]);
    color.multiplyScalar(0.82 + random() * 0.3);
    mesh.setColorAt(i, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return { mesh, geometry, material };
}

export function createGround(scene, { anisotropy = 8 } = {}) {
  const random = seededRandom(0x3ac81d);
  const uniforms = { uTime: { value: 0 } };

  const ground = createGroundMesh(anisotropy);
  scene.add(ground);

  const litter = createLeafLitter(anisotropy);
  scene.add(litter.mesh);

  const fallen = createFallenLeaves(anisotropy, random);
  scene.add(fallen.mesh);

  const grass = createGrass(anisotropy, random, uniforms);
  scene.add(grass.mesh);

  function update(delta, elapsed) {
    void delta;
    uniforms.uTime.value = elapsed;
  }

  return {
    group: ground,
    ground,
    litter: litter.mesh,
    fallenLeaves: fallen.mesh,
    grass: grass.mesh,
    heightAt: groundHeightAt,
    update,
    dispose() {
      scene.remove(ground);
      scene.remove(litter.mesh);
      scene.remove(fallen.mesh);
      scene.remove(grass.mesh);
      ground.geometry.dispose();
      ground.material.dispose();
      litter.geometry.dispose();
      litter.material.dispose();
      fallen.geometry.dispose();
      fallen.material.dispose();
      fallen.mesh.dispose();
      grass.geometry.dispose();
      grass.material.dispose();
      grass.mesh.dispose();
    },
  };
}
