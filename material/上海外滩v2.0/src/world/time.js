import * as THREE from "three";
import {
  COLOR_KEYS,
  DEFAULT_PRESET,
  NUMERIC_KEYS,
  TIME_PRESETS,
} from "../config.js";
import { createEnvironmentTexture } from "../utils/textures.js";
import { applyEmissiveState } from "./materials.js";

const TRANSITION_SECONDS = 1.9;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function createState(preset) {
  const state = {};
  for (const key of NUMERIC_KEYS) state[key] = preset[key];
  for (const key of COLOR_KEYS) state[key] = new THREE.Color(preset[key]);
  state.sunDirection = new THREE.Vector3(...preset.sunDirection).normalize();
  return state;
}

function cloneState(source) {
  const copy = {};
  for (const key of NUMERIC_KEYS) copy[key] = source[key];
  for (const key of COLOR_KEYS) copy[key] = source[key].clone();
  copy.sunDirection = source.sunDirection.clone();
  return copy;
}

/**
 * 昼夜系统：在三个预设之间插值天空、光照、雾、曝光、
 * 泛光、水面参数与所有建筑的发光强度。
 */
export function createTimeSystem({
  renderer,
  scene,
  world,
  bloomPass,
  sunLight,
  hemiLight,
  ambientLight,
  initial = DEFAULT_PRESET,
  onChange,
}) {
  const environments = {};
  for (const [name, preset] of Object.entries(TIME_PRESETS)) {
    environments[name] = createEnvironmentTexture(preset);
  }

  const state = createState(TIME_PRESETS[initial]);
  let fromState = cloneState(state);
  let toState = cloneState(state);
  let progress = 1;
  let current = initial;
  let target = initial;

  scene.fog = new THREE.Fog(
    state.fogColor.clone(),
    state.fogNear,
    state.fogFar,
  );
  scene.environment = environments[initial];
  scene.environmentIntensity = state.envIntensity;

  function apply(next) {
    // 天空
    const sky = world.sky.uniforms;
    sky.uTop.value.copy(next.skyTop);
    sky.uHorizon.value.copy(next.skyHorizon);
    sky.uBottom.value.copy(next.skyBottom);
    sky.uSunColor.value.copy(next.sunColor);
    sky.uSunDir.value.copy(next.sunDirection);
    sky.uSunGlow.value = next.sunGlow;
    sky.uStars.value = next.star;
    sky.uCloud.value = next.cloud;

    // 光照
    sunLight.color.copy(next.sunLightColor);
    sunLight.intensity = next.sunLightIntensity;
    sunLight.shadow.intensity = next.shadowIntensity;
    sunLight.position
      .copy(next.sunDirection)
      .multiplyScalar(1700)
      .add(sunLight.target.position);

    hemiLight.color.copy(next.hemiSky);
    hemiLight.groundColor.copy(next.hemiGround);
    hemiLight.intensity = next.hemiIntensity;

    ambientLight.color.copy(next.skyHorizon);
    ambientLight.intensity = next.ambientIntensity;

    // 大气
    scene.fog.color.copy(next.fogColor);
    scene.fog.near = next.fogNear;
    scene.fog.far = next.fogFar;
    scene.environmentIntensity = next.envIntensity;
    renderer.toneMappingExposure = next.exposure;

    // 泛光
    bloomPass.strength = next.bloomStrength;
    bloomPass.radius = next.bloomRadius;
    bloomPass.threshold = next.bloomThreshold;

    // 水面
    world.water.applyPreset(next, next.sunDirection);

    // 所有发光材质
    applyEmissiveState(world.emissive, next);
  }

  function setPreset(name) {
    if (!TIME_PRESETS[name] || name === target) return;
    fromState = cloneState(state);
    toState = createState(TIME_PRESETS[name]);
    progress = 0;
    target = name;

    scene.environment = environments[name];

    // 强制刷新一次阴影贴图
    if (sunLight.shadow) sunLight.shadow.needsUpdate = true;

    onChange?.(name);
  }

  function update(delta) {
    if (progress >= 1) return;

    progress = Math.min(1, progress + delta / TRANSITION_SECONDS);
    const t = easeInOutCubic(progress);

    for (const key of NUMERIC_KEYS) {
      state[key] = THREE.MathUtils.lerp(fromState[key], toState[key], t);
    }
    for (const key of COLOR_KEYS) {
      state[key].lerpColors(fromState[key], toState[key], t);
    }
    state.sunDirection
      .lerpVectors(fromState.sunDirection, toState.sunDirection, t)
      .normalize();

    apply(state);

    // 太阳在动，阴影贴图需要重新渲染
    if (sunLight.shadow) sunLight.shadow.needsUpdate = true;
    if (progress >= 1) current = target;
  }

  /**
   * 直接落到某个预设，不播放过渡。
   * 影片捕获与循环重播需要可重复的初始昼夜状态。
   */
  function setImmediate(name) {
    if (!TIME_PRESETS[name]) return;

    const next = createState(TIME_PRESETS[name]);
    for (const key of NUMERIC_KEYS) state[key] = next[key];
    for (const key of COLOR_KEYS) state[key].copy(next[key]);
    state.sunDirection.copy(next.sunDirection);

    fromState = cloneState(next);
    toState = cloneState(next);
    progress = 1;
    current = name;
    target = name;

    scene.environment = environments[name];
    apply(state);
    if (sunLight.shadow) sunLight.shadow.needsUpdate = true;
    onChange?.(name);
  }

  // 初始状态
  apply(state);
  if (sunLight.shadow) sunLight.shadow.needsUpdate = true;

  return {
    state,
    get current() {
      return current;
    },
    get target() {
      return target;
    },
    get transitioning() {
      return progress < 1;
    },
    setPreset,
    setImmediate,
    update,
  };
}
