import * as THREE from "three";
import { createSky } from "./sky.js";
import { createWater } from "./water.js";
import { createTowers } from "./towers.js";
import { createBund } from "./bund.js";
import { createCity } from "./city.js";
import { createBoats } from "./boats.js";
import { collectEmissiveMaterials } from "./materials.js";

/**
 * 构建完整世界，并返回统一的更新入口。
 */
export function createWorld(scene, camera) {
  const sky = createSky();
  scene.add(sky.mesh);

  const water = createWater();
  scene.add(water);

  const towers = createTowers(scene);
  const bund = createBund(scene);
  const city = createCity(scene);
  const boats = createBoats(scene);

  /* 光照 ------------------------------------------------------------ */

  const sunLight = new THREE.DirectionalLight(0xfff1d4, 3.1);
  sunLight.position.set(-800, 1000, 800);
  sunLight.target.position.set(120, 0, -60);
  sunLight.castShadow = true;

  sunLight.shadow.mapSize.set(2048, 2048);
  const shadowCamera = sunLight.shadow.camera;
  shadowCamera.left = -1050;
  shadowCamera.right = 1050;
  shadowCamera.top = 1050;
  shadowCamera.bottom = -1050;
  shadowCamera.near = 150;
  shadowCamera.far = 3600;
  shadowCamera.updateProjectionMatrix();

  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.9;

  scene.add(sunLight, sunLight.target);

  const hemiLight = new THREE.HemisphereLight(0xbfd9ff, 0x6f5c47, 0.85);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xcfe6ff, 0.18);
  scene.add(ambientLight);

  /* 发光材质注册表 -------------------------------------------------- */

  const emissive = collectEmissiveMaterials(scene);

  function update(delta, elapsed, state) {
    sky.update(camera, elapsed);
    water.update(elapsed);
    towers.update(elapsed, state);
    bund.update(elapsed, state);
    city.update(delta, elapsed, state);
    boats.update(delta, elapsed, state);
  }

  return {
    sky,
    water,
    towers,
    bund,
    city,
    boats,
    sunLight,
    hemiLight,
    ambientLight,
    emissive,
    update,
  };
}
