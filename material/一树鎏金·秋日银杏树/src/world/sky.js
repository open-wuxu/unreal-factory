import * as THREE from "three";
import { COLORS, SUN, SUN_DIRECTION } from "../config.js";
import { getEnvironmentTexture, getGlowTexture } from "../utils/textures.js";

/**
 * 秋日清晨的天空、环境光与主光。
 *
 * 太阳位于树的西北侧（树的背面），摄影机从南侧看向树时
 * 会得到强烈的金色背光——这是整个场景的主视觉。
 */

const skyVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const skyFragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 midColor;
  uniform vec3 horizonColor;
  uniform vec3 groundColor;
  uniform vec3 sunColor;
  uniform vec3 sunDirection;
  uniform float uTime;
  varying vec3 vWorldPosition;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float height = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

    vec3 color = mix(horizonColor, midColor, smoothstep(0.47, 0.66, height));
    color = mix(color, topColor, smoothstep(0.63, 0.98, height));
    color = mix(groundColor, color, smoothstep(0.29, 0.52, height));

    vec3 sunDir = normalize(sunDirection);
    float sunDot = max(dot(dir, sunDir), 0.0);
    float disc = smoothstep(0.9992, 0.9997, sunDot);
    float halo = pow(sunDot, 38.0) * 0.34 + pow(sunDot, 8.0) * 0.09;
    color += sunColor * (disc * 1.5 + halo);

    // 地平线附近的薄雾带，极轻，避免天空过于平面
    float band = smoothstep(0.49, 0.57, height) * (1.0 - smoothstep(0.61, 0.76, height));
    vec2 hazeUv = vec2(atan(dir.z, dir.x) * 2.4 + uTime * 0.008, height * 9.0);
    float haze = valueNoise(hazeUv) * 0.6 + valueNoise(hazeUv * 2.3 + 7.1) * 0.4;
    color += sunColor * band * haze * 0.035;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createSky(scene, renderer) {
  const envTexture = getEnvironmentTexture();
  scene.environment = envTexture;
  scene.environmentIntensity = 0.72;

  const uniforms = {
    topColor: { value: new THREE.Color(COLORS.skyTop) },
    midColor: { value: new THREE.Color(COLORS.skyMid) },
    horizonColor: { value: new THREE.Color(COLORS.skyHorizon) },
    groundColor: { value: new THREE.Color(0x6b5538) },
    sunColor: { value: new THREE.Color(COLORS.sunCore) },
    sunDirection: { value: SUN_DIRECTION.clone() },
    uTime: { value: 0 },
  };

  const skyMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 32), skyMaterial);
  sky.name = "ginkgo-sky";
  sky.frustumCulled = false;
  scene.add(sky);

  // 太阳光晕：位于树后，被树冠遮挡后只剩透光边缘
  const glowTexture = getGlowTexture();
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffe3ae,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: true,
    }),
  );
  sunSprite.name = "ginkgo-sun-glow";
  sunSprite.position.copy(SUN_DIRECTION).multiplyScalar(290);
  sunSprite.scale.setScalar(30);
  scene.add(sunSprite);

  const sunLight = new THREE.DirectionalLight(SUN.color, SUN.intensity);
  sunLight.name = "ginkgo-sun";
  sunLight.position.copy(SUN_DIRECTION).multiplyScalar(46);
  sunLight.target.position.set(0, 6.4, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(SUN.shadowMapSize, SUN.shadowMapSize);
  sunLight.shadow.camera.left = -SUN.shadowExtent;
  sunLight.shadow.camera.right = SUN.shadowExtent;
  sunLight.shadow.camera.top = SUN.shadowExtent;
  sunLight.shadow.camera.bottom = -SUN.shadowExtent;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 110;
  sunLight.shadow.camera.updateProjectionMatrix();
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.04;
  sunLight.shadow.radius = 3.6;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const hemiLight = new THREE.HemisphereLight(0xf7dcb6, 0x3b3020, 0.48);
  hemiLight.name = "ginkgo-hemi";
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xffe2bd, 0.08);
  scene.add(ambientLight);

  // 来自摄影机一侧的低强度暖色补光，避免树干死黑
  const fillLight = new THREE.DirectionalLight(0xffd7b0, 0.42);
  fillLight.position.set(9, 7, 13);
  fillLight.target.position.set(0, 6, 0);
  scene.add(fillLight);
  scene.add(fillLight.target);

  // 金色地面反弹光，照亮低处树干与树根，同时保持树冠的逆光层次
  const bounceLight = new THREE.DirectionalLight(0xffb878, 0.68);
  bounceLight.name = "ginkgo-bounce";
  bounceLight.position.set(4.2, 1.1, 7.2);
  bounceLight.target.position.set(0, 2.6, 0);
  scene.add(bounceLight);
  scene.add(bounceLight.target);

  // 逆光轮廓：从树的另一侧擦过树冠边缘
  const rimLight = new THREE.DirectionalLight(SUN.rimColor, SUN.rimIntensity);
  rimLight.position.copy(SUN_DIRECTION).multiplyScalar(-30);
  rimLight.position.y += 12;
  rimLight.target.position.set(0, 9, 0);
  scene.add(rimLight);
  scene.add(rimLight.target);

  // 仅在树干特写时启用的摄影机侧柔光（相当于一块暖色反光板）
  const detailLight = new THREE.SpotLight(0xffe2c6, 0, 12, 0.38, 1, 2);
  detailLight.name = "ginkgo-detail-light";
  detailLight.castShadow = false;
  scene.add(detailLight);
  scene.add(detailLight.target);

  function update(delta, elapsed) {
    void delta;
    uniforms.uTime.value = elapsed;
    sunSprite.material.opacity = 0.43 + Math.sin(elapsed * 0.21) * 0.02;
  }

  function setTime(time) {
    uniforms.uTime.value = time;
    // 清晨阳光随时间极轻微地转暖，镜头内几乎察觉不到
    const warmth = Math.sin(time * 0.08) * 0.03;
    sunLight.intensity = SUN.intensity + warmth;
  }

  function setShadowFocus() {
    // 树是静态的，阴影相机固定覆盖树冠与树根；
    // 保留接口，让世界装配与其它项目保持一致的契约。
  }

  return {
    group: sky,
    sky,
    sunLight,
    hemiLight,
    ambientLight,
    fillLight,
    bounceLight,
    rimLight,
    detailLight,
    sunSprite,
    sunDirection: SUN_DIRECTION.clone(),
    environment: envTexture,
    update,
    setTime,
    setShadowFocus,
    dispose() {
      scene.remove(sky);
      scene.remove(sunSprite);
      scene.remove(sunLight);
      scene.remove(sunLight.target);
      scene.remove(hemiLight);
      scene.remove(ambientLight);
      scene.remove(fillLight);
      scene.remove(fillLight.target);
      scene.remove(bounceLight);
      scene.remove(bounceLight.target);
      scene.remove(rimLight);
      scene.remove(rimLight.target);
      scene.remove(detailLight);
      scene.remove(detailLight.target);
      sky.geometry.dispose();
      skyMaterial.dispose();
      sunSprite.material.dispose();
    },
  };
}
