import * as THREE from "three";
import { ATMOSPHERE, SUN_KEYS } from "../config.js";

/**
 * 程序化天空、太阳与大气。
 *
 * 天空穹顶是单个 ShaderMaterial：地平线暖色、天顶冷蓝、太阳盘与光晕、
 * 两层缓慢漂移的卷云。太阳方向、色温、曝光和雾色由 SUN_KEYS 插值。
 */

const KEY_COLORS = [
  "color",
  "skyTop",
  "skyHorizon",
  "fog",
  "cloudLit",
  "cloudShadow",
];

const colorA = new THREE.Color();
const colorB = new THREE.Color();

function sampleKeys(t) {
  const clamped = Math.min(Math.max(t, 0), SUN_KEYS[SUN_KEYS.length - 1].t);
  let i = 0;
  while (i < SUN_KEYS.length - 2 && clamped > SUN_KEYS[i + 1].t) i++;
  const a = SUN_KEYS[i];
  const b = SUN_KEYS[i + 1];
  const u = Math.min(
    1,
    Math.max(0, (clamped - a.t) / Math.max(1e-4, b.t - a.t)),
  );
  const smooth = u * u * (3 - 2 * u);
  const state = {
    elevation: THREE.MathUtils.lerp(a.elevation, b.elevation, smooth),
    azimuth: THREE.MathUtils.lerp(a.azimuth, b.azimuth, smooth),
    intensity: THREE.MathUtils.lerp(a.intensity, b.intensity, smooth),
    exposure: THREE.MathUtils.lerp(a.exposure, b.exposure, smooth),
    colors: {},
  };
  for (const key of KEY_COLORS) {
    colorA.setHex(a[key]);
    colorB.setHex(b[key]);
    state.colors[key] = colorA.clone().lerp(colorB, smooth);
  }
  return state;
}

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vDirection = worldPosition.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uSkyTop;
  uniform vec3 uSkyHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uCloudLit;
  uniform vec3 uCloudShadow;
  uniform vec3 uSunDirection;
  uniform float uTime;

  varying vec3 vDirection;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += valueNoise(p) * amplitude;
      p = p * 2.03 + vec2(1.7, 9.2);
      amplitude *= 0.5;
    }
    return sum;
  }

  void main() {
    vec3 direction = normalize(vDirection);
    float height = clamp(direction.y, -0.3, 1.0);
    float horizon = pow(clamp(height, 0.0, 1.0), 0.52);

    vec3 color = mix(uSkyHorizon, uSkyTop, horizon);
    color = mix(color, uSkyHorizon * 1.06,
      pow(1.0 - clamp(height, 0.0, 1.0), 9.0) * 0.55);

    float sunDot = max(dot(direction, normalize(uSunDirection)), 0.0);
    color += uSunColor * pow(sunDot, 6.0) * 0.16;
    color += uSunColor * pow(sunDot, 180.0) * 1.4;

    float disk = smoothstep(0.99945, 0.99982, sunDot);
    color += uSunColor * disk * 14.0;

    vec2 cloudUv = direction.xz / (abs(direction.y) + 0.28);
    float cirrus = fbm(cloudUv * 0.85 + vec2(uTime * 0.0035, uTime * 0.0012));
    cirrus = smoothstep(0.56, 0.88, cirrus) * smoothstep(0.02, 0.3, direction.y);
    vec3 cirrusColor = mix(uCloudShadow, uCloudLit, 0.6 + sunDot * 0.4);
    color = mix(color, cirrusColor, cirrus * 0.3);

    color = mix(color, uSkyHorizon * 0.52, smoothstep(0.0, -0.18, direction.y));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createSky(scene, renderer) {
  const uniforms = {
    uSkyTop: { value: new THREE.Color(0x3f6ea8) },
    uSkyHorizon: { value: new THREE.Color(0xf3c58e) },
    uSunColor: { value: new THREE.Color(0xffd2a1) },
    uCloudLit: { value: new THREE.Color(0xffe2bb) },
    uCloudShadow: { value: new THREE.Color(0x6f7f96) },
    uSunDirection: { value: new THREE.Vector3(-0.7, 0.3, 0.35) },
    uTime: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(24000, 48, 32),
    material,
  );
  dome.name = "sky-dome";
  dome.frustumCulled = false;
  dome.renderOrder = -1000;
  scene.add(dome);

  const sunLight = new THREE.DirectionalLight(0xffd2a1, 3.2);
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
  sunLight.target.position.set(0, 900, 0);

  const hemiLight = new THREE.HemisphereLight(0xbcd4f0, 0x4a4030, 0.55);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0x8fa4bd, 0.1);
  scene.add(ambientLight);

  scene.fog = new THREE.FogExp2(0xd9a97e, ATMOSPHERE.fogDensity);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envDome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 24), material);
  envDome.frustumCulled = false;
  envScene.add(envDome);
  let environment = null;
  let envTime = -999;
  const sunDirection = new THREE.Vector3();
  const lightOffset = new THREE.Vector3(0, 900, 0);
  let state = sampleKeys(0);

  function regenerateEnvironment(t, force = false) {
    if (!force && Math.abs(t - envTime) < 2.2) return;
    envTime = t;
    const target = pmrem.fromScene(envScene, 0, 0.1, 200);
    if (environment) environment.dispose();
    environment = target;
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.4;
  }

  function setTime(t) {
    state = sampleKeys(t);
    const az = THREE.MathUtils.degToRad(state.azimuth);
    const el = THREE.MathUtils.degToRad(state.elevation);
    sunDirection
      .set(
        Math.sin(az) * Math.cos(el),
        Math.sin(el),
        -Math.cos(az) * Math.cos(el),
      )
      .normalize();

    uniforms.uSunDirection.value.copy(sunDirection);
    uniforms.uSkyTop.value.copy(state.colors.skyTop);
    uniforms.uSkyHorizon.value.copy(state.colors.skyHorizon);
    uniforms.uSunColor.value.copy(state.colors.color);
    uniforms.uCloudLit.value.copy(state.colors.cloudLit);
    uniforms.uCloudShadow.value.copy(state.colors.cloudShadow);
    uniforms.uTime.value = t;

    sunLight.color.copy(state.colors.color);
    sunLight.intensity = state.intensity;
    sunLight.position.copy(sunDirection).multiplyScalar(6000).add(lightOffset);
    sunLight.target.position.copy(lightOffset);
    sunLight.target.updateMatrixWorld();

    hemiLight.color.copy(state.colors.skyTop).lerp(state.colors.skyHorizon, 0.5);
    hemiLight.groundColor.copy(state.colors.fog).multiplyScalar(0.35);
    ambientLight.color.copy(state.colors.skyHorizon);
    ambientLight.intensity = 0.1;

    scene.fog.color.copy(state.colors.fog);
    renderer.toneMappingExposure = state.exposure;

    regenerateEnvironment(t);
  }

  function update(delta, stateIn) {
    uniforms.uTime.value += delta;
    void stateIn;
  }

  setTime(0);
  regenerateEnvironment(0, true);

  return {
    group: dome,
    material,
    sunLight,
    hemiLight,
    ambientLight,
    setTime,
    update,
    get sunDirection() {
      return sunDirection;
    },
    get state() {
      return state;
    },
    get environment() {
      return environment;
    },
  };
}
