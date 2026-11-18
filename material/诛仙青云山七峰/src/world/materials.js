import * as THREE from "three";
import {
  createGroundTexture,
  createLatticeTexture,
  createPlaqueTexture,
  createRockTexture,
  createRoofTileTexture,
  createStoneTexture,
  createWoodTexture,
} from "../utils/textures.js";

/**
 * 共享材质。地形材质通过 onBeforeCompile 注入世界坐标三平面细节，
 * 其它材质在后续任务中加入。
 */

let shared = null;

function makeTerrainMaterial(detail) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
    dithering: true,
    side: THREE.DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: detail };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNor;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vWPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vWNor = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNor;\nuniform sampler2D uDetail;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec3 wn = normalize(vWNor);
          vec3 weights = pow(abs(wn), vec3(4.0));
          weights /= (weights.x + weights.y + weights.z + 1e-4);
          float detail = weights.x * texture2D(uDetail, vWPos.zy * 0.018).r
                       + weights.y * texture2D(uDetail, vWPos.xz * 0.018).r
                       + weights.z * texture2D(uDetail, vWPos.xy * 0.018).r;
          float rock = smoothstep(0.12, 0.52, 1.0 - wn.y);
          diffuseColor.rgb *= mix(1.0, 0.66 + detail * 0.76,
            mix(0.22, 0.9, rock));
        }`,
      );
  };
  material.customProgramCacheKey = () => "qingyun-terrain-v1";
  return material;
}

export function createMaterials() {
  if (shared) return shared;
  const rock = createRockTexture();
  const ground = createGroundTexture();
  shared = {
    terrain: makeTerrainMaterial(rock),
    rockTexture: rock,
    groundTexture: ground,
    stone: new THREE.MeshStandardMaterial({
      color: 0xbdb4a4,
      map: createStoneTexture(),
      roughness: 0.88,
      metalness: 0,
    }),
    darkStone: new THREE.MeshStandardMaterial({
      color: 0x777268,
      map: createStoneTexture(),
      roughness: 0.9,
      metalness: 0,
    }),
    wood: new THREE.MeshStandardMaterial({
      color: 0x9a7a5c,
      map: createWoodTexture(),
      roughness: 0.78,
      metalness: 0,
    }),
    column: new THREE.MeshStandardMaterial({
      color: 0x7a3b2c,
      roughness: 0.62,
      metalness: 0.02,
    }),
    wall: new THREE.MeshStandardMaterial({
      color: 0x3a2a20,
      roughness: 0.86,
      metalness: 0,
    }),
    darkWood: new THREE.MeshStandardMaterial({
      color: 0x2c1e16,
      roughness: 0.82,
      metalness: 0,
    }),
    roof: new THREE.MeshStandardMaterial({
      color: 0xd6dbe3,
      map: createRoofTileTexture(),
      roughness: 0.68,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
    lattice: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createLatticeTexture(),
      emissive: 0x3a2410,
      emissiveIntensity: 0.55,
      roughness: 0.7,
      metalness: 0,
    }),
    gold: new THREE.MeshStandardMaterial({
      color: 0xb08a4a,
      roughness: 0.42,
      metalness: 0.55,
    }),
    makePlaque(text) {
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: createPlaqueTexture(text),
        roughness: 0.6,
        metalness: 0.1,
      });
    },
  };
  return shared;
}
