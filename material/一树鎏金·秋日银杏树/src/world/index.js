import { createFallingLeaves } from "./falling.js";
import { createGround } from "./ground.js";
import { createLightShafts } from "./lightShafts.js";
import { createSky } from "./sky.js";
import { createTree } from "./tree.js";
import { WORLD } from "../config.js";

/**
 * 场景装配。全场景只围绕一棵银杏树：
 * 天空与主光 → 地面与草 → 银杏树 → 飘落叶 → 逆光光束。
 */
export function createWorld(scene, camera, renderer) {
  const anisotropy = Math.min(8, Math.max(1, renderer.capabilities.getMaxAnisotropy()));

  const sky = createSky(scene, renderer);
  const ground = createGround(scene, { anisotropy });
  const tree = createTree(scene, { anisotropy });
  const falling = createFallingLeaves(scene, tree.crownSamples, { anisotropy });
  const shafts = createLightShafts(scene);

  function update(delta, elapsed, state) {
    const time = state && state.time !== undefined ? state.time : elapsed;
    sky.update(delta, time);
    tree.update(delta, time);
    ground.update(delta, time);
    falling.update(delta, time);
    shafts.update(delta, time);
  }

  function setTime(time) {
    sky.setTime(time);
  }

  function setShadowFocus(target, extent) {
    sky.setShadowFocus(target, extent);
  }

  return {
    update,
    setTime,
    setShadowFocus,
    sky,
    ground,
    tree,
    falling,
    shafts,
    sunLight: sky.sunLight,
    hemiLight: sky.hemiLight,
    ambientLight: sky.ambientLight,
    fillLight: sky.fillLight,
    bounceLight: sky.bounceLight,
    rimLight: sky.rimLight,
    detailLight: sky.detailLight,
    sunDirection: sky.sunDirection,
    crownCenter: WORLD.crownCenter.clone(),
    heroLeaf: tree.heroLeaf,
    camera,
    renderer,
    stats: {
      leaves: tree.leafCount,
      branches: tree.branchCount,
      twigs: tree.twigCount,
    },
  };
}
