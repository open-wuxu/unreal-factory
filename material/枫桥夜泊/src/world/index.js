import * as THREE from "three";
import { ATMOSPHERE, COLORS, LAYOUT, WORLD, moonDirectionAt } from "../config.js";
import { createSky } from "./sky.js";
import { createWater } from "./water.js";
import { createTerrain } from "./terrain.js";
import { createBridge } from "./bridge.js";
import { createMaples } from "./trees.js";
import { createBoat } from "./boat.js";
import { createTemple } from "./temple.js";
import { createFishingBoats } from "./fishing.js";
import { createCrows } from "./birds.js";
import { createMist } from "./mist.js";
import {
  collectEmissiveMaterials,
  createEnvironmentTexture,
} from "./materials.js";

/**
 * 装配完整的江南夜景，并返回统一的更新入口。
 *
 * 空间关系：
 *   南岸 z > 34 —— 枫桥、枫树林、码头、停泊的客船
 *   江面 z ∈ [-34, 34]
 *   北岸 z < -34 —— 山坡上的寒山寺、钟楼、塔
 *   更远处 —— 三层被雾吃掉的山脊
 */
export function createWorld(scene, camera) {
  scene.background = new THREE.Color(0x0a111c);
  scene.fog = new THREE.FogExp2(ATMOSPHERE.fogColor, ATMOSPHERE.fogDensity);
  scene.environment = createEnvironmentTexture();
  scene.environmentIntensity = 0.65;

  const sky = createSky();
  scene.add(sky.mesh);

  const terrain = createTerrain();
  scene.add(terrain.group);

  const bridge = createBridge();
  scene.add(bridge.group);

  const maples = createMaples();
  scene.add(maples.group);

  const boat = createBoat();
  scene.add(boat.group);
  scene.add(boat.mooring);

  const temple = createTemple();
  scene.add(temple.group);

  const fishing = createFishingBoats();
  scene.add(fishing.group);

  const crows = createCrows();
  scene.add(crows.group);

  const mist = createMist();
  scene.add(mist.group);

  const water = createWater();
  scene.add(water.mesh);

  /* ------------------------------ 光照 ------------------------------ */

  const moonLight = new THREE.DirectionalLight(0xc4d4e8, 3.6);
  moonLight.position.copy(LAYOUT.moonDir).multiplyScalar(700);
  moonLight.target.position.set(0, 0, -30);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);

  const shadowCamera = moonLight.shadow.camera;
  shadowCamera.left = -150;
  shadowCamera.right = 150;
  shadowCamera.top = 150;
  shadowCamera.bottom = -150;
  shadowCamera.near = 80;
  shadowCamera.far = 1100;
  shadowCamera.updateProjectionMatrix();
  moonLight.shadow.bias = -0.0006;
  moonLight.shadow.normalBias = 0.7;

  scene.add(moonLight, moonLight.target);

  const hemiLight = new THREE.HemisphereLight(0x3d5670, 0x0a0e12, 1.15);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0x1c2a40, 0.32);
  scene.add(ambientLight);

  // 江对岸的一点冷色补光，避免寺院完全沉进黑里
  const fillLight = new THREE.DirectionalLight(0x2d3f5c, 0.5);
  fillLight.position.set(180, 90, -260);
  scene.add(fillLight);

  // 来自南岸天空的冷色反照：把朝向镜头的立面、树冠轻轻托起来
  const southFill = new THREE.DirectionalLight(0x41546e, 1.55);
  southFill.position.set(30, 90, 230);
  southFill.target.position.set(10, 8, -40);
  scene.add(southFill, southFill.target);

  /* --------------------------- 发光材质 ---------------------------- */

  const emissive = collectEmissiveMaterials(scene);

  /* ---------------------------- 更新 ------------------------------ */

  const moonDir = new THREE.Vector3();
  const boatRippleState = { last: -100 };
  const templeWarm = new THREE.Vector3(38, WORLD.templeBase + 3.4, -108);

  function updateWeather(delta, elapsed, state) {
    mist.update(delta, elapsed, state);
  }

  function update(delta, elapsed, state = {}) {
    const time = state.time ?? elapsed;
    const filmTime = state.filmTime ?? time;

    moonDir.copy(moonDirectionAt(filmTime));
    moonLight.position.copy(moonDir).multiplyScalar(700);
    moonLight.target.position.set(0, 0, -30);
    moonLight.target.updateMatrixWorld();
    moonLight.intensity =
      3.5 + Math.sin(elapsed * 0.08) * 0.12 + (1 - filmTime / 40) * 0.15;

    sky.update(camera, moonDir, elapsed);
    water.update(elapsed);
    water.setMoon(moonDir, 0.85);

    maples.update(delta, elapsed);
    boat.update(delta, elapsed);
    fishing.update(delta, elapsed);
    crows.update(delta, elapsed);
    updateWeather(delta, elapsed, state);

    temple.update(delta, elapsed, {
      ...state,
      time: filmTime,
      onBellRipple: (delay) => {
        water.addRipple(LAYOUT.boat.x, LAYOUT.boat.z, filmTime, 0.65);
        water.addRipple(LAYOUT.boat.x - 4, -14, filmTime, 0.35);
        water.addRipple(LAYOUT.boat.x + 8, -2, filmTime + 0.2, 0.22);
      },
    });

    // 客船随波轻轻荡出的细纹
    if (filmTime - boatRippleState.last > 3.6) {
      boatRippleState.last = filmTime;
      water.addRipple(
        LAYOUT.boat.x - 2.4,
        LAYOUT.boat.z + 1.2,
        filmTime,
        0.18,
      );
    }

    // 渔火、船灯、桥灯与寺院暖光注册到水面 shader
    water.setLantern(0, boat.worldLantern, 0xffad58, 1.35);
    for (let i = 0; i < fishing.lanternWorlds.length && i < 5; i++) {
      water.setLantern(i + 1, fishing.lanternWorlds[i], 0xff9f4e, 0.7 * fishing.boats[i].power);
    }
    water.setLantern(6, bridge.lanternPosition, 0xffb06a, 0.5);
    water.setLantern(7, templeWarm, 0xffa860, 0.55);
    if (terrain.dockLantern) {
      water.setLantern(8, terrain.dockLantern, 0xff9a4a, 0.8);
    }
  }

  return {
    update,
    sky,
    water,
    terrain,
    bridge,
    maples,
    boat,
    temple,
    fishing,
    crows,
    mist,
    moonLight,
    hemiLight,
    ambientLight,
    fillLight,
    southFill,
    emissive,
    layout: { ...LAYOUT, WORLD },
  };
}
