import * as THREE from "three";
import { sunDirectionAt } from "../config.js";
import { createTerrain } from "./terrain.js";

/**
 * 场景装配入口。后续任务会把天空、云海、建筑、植被等模块加进来，
 * 这里的契约保持不变：返回 { update, ...modules }。
 */
export function createWorld(scene, camera, renderer) {
  const terrain = createTerrain(scene);

  const sunDirection = sunDirectionAt(0);
  const sunLight = new THREE.DirectionalLight(0xffd2a1, 3.2);
  sunLight.position
    .copy(sunDirection)
    .multiplyScalar(6000)
    .add(new THREE.Vector3(0, 900, 0));
  sunLight.target.position.set(0, 900, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(4096, 4096);
  const shadowCamera = sunLight.shadow.camera;
  shadowCamera.left = -3200;
  shadowCamera.right = 3200;
  shadowCamera.top = 3200;
  shadowCamera.bottom = -3200;
  shadowCamera.near = 100;
  shadowCamera.far = 16000;
  shadowCamera.updateProjectionMatrix();
  sunLight.shadow.bias = -0.001;
  sunLight.shadow.normalBias = 14;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const hemiLight = new THREE.HemisphereLight(0xbcd4f0, 0x4a4030, 1.15);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0x8fa4bd, 0.38);
  scene.add(ambientLight);

  function update(delta, elapsed, state) {
    void delta;
    void elapsed;
    void state;
  }

  return {
    update,
    terrain,
    sunLight,
    hemiLight,
    sunDirection,
    camera,
    renderer,
  };
}
