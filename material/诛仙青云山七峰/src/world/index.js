import { createSky } from "./sky.js";
import { createTerrain } from "./terrain.js";

/**
 * 场景装配入口。后续任务会把云海、建筑、植被等模块加进来，
 * 这里的契约保持不变：返回 { update, ...modules }。
 */
export function createWorld(scene, camera, renderer) {
  const sky = createSky(scene, renderer);
  const terrain = createTerrain(scene);

  function update(delta, elapsed, state) {
    void elapsed;
    sky.update(delta, state);
  }

  function setTime(t) {
    sky.setTime(t);
  }

  return {
    update,
    setTime,
    terrain,
    sky,
    sunLight: sky.sunLight,
    hemiLight: sky.hemiLight,
    ambientLight: sky.ambientLight,
    sunDirection: sky.sunDirection,
    camera,
    renderer,
  };
}
