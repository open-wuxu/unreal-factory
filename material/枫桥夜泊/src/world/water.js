import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { ATMOSPHERE, WORLD } from "../config.js";

/**
 * 江面。
 *
 * Reflector 提供真实的平面镜像（天空、寺院、枫树、灯火都会被反射），
 * 自定义 shader 在其上叠加：细碎波纹、菲涅尔、沿视线拉长的月光碎影、
 * 暖色渔火倒影、贴岸泡沫、以及钟声抵达时的同心涟漪。
 */

const MAX_LANTERNS = 10;
const MAX_RIPPLES = 6;

const WaterShader = {
  name: "FengqiaoWaterShader",

  uniforms: {
    color: { value: new THREE.Color(0xffffff) },
    tDiffuse: { value: null },
    textureMatrix: { value: new THREE.Matrix4() },

    uTime: { value: 0 },
    uDeepColor: { value: new THREE.Color(0x0b1722) },
    uSurfaceColor: { value: new THREE.Color(0x172a40) },
    uMoonColor: { value: new THREE.Color(0xb7c9de) },
    uMoonDir: { value: new THREE.Vector3(-0.12, 0.1, -0.99).normalize() },
    uMoonIntensity: { value: 1.0 },
    uReflect: { value: 0.6 },
    uFogColor: { value: new THREE.Color(ATMOSPHERE.fogColor) },
    uFogDensity: { value: ATMOSPHERE.fogDensity },
    uLanternPos: {
      value: Array.from({ length: MAX_LANTERNS }, () => new THREE.Vector3()),
    },
    uLanternColor: {
      value: Array.from({ length: MAX_LANTERNS }, () => new THREE.Color(0xffad58)),
    },
    uLanternPower: { value: new Float32Array(MAX_LANTERNS) },
    uRipples: {
      value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -10, 0)),
    },
  },

  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorldPos;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPosition.xyz;
      vUv = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 color;

    uniform float uTime;
    uniform vec3 uDeepColor;
    uniform vec3 uSurfaceColor;
    uniform vec3 uMoonColor;
    uniform vec3 uMoonDir;
    uniform float uMoonIntensity;
    uniform float uReflect;
    uniform vec3 uFogColor;
    uniform float uFogDensity;

    uniform vec3 uLanternPos[10];
    uniform vec3 uLanternColor[10];
    uniform float uLanternPower[10];
    uniform vec4 uRipples[6];

    varying vec4 vUv;
    varying vec3 vWorldPos;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise2(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    // 低频、缓慢的行波；返回 xz 方向的斜率
    vec2 waveSlope(vec2 p, float t) {
      vec2 s = vec2(0.0);
      s += vec2(cos(p.x * 0.085 + t * 0.28), sin(p.y * 0.12 - t * 0.24)) * 0.62;
      s += vec2(
        cos(p.x * 0.21 - p.y * 0.045 + t * 0.62),
        sin(p.y * 0.18 + p.x * 0.037 - t * 0.54)
      ) * 0.30;
      s += vec2(
        cos(p.x * 0.58 + p.y * 0.17 + t * 1.15),
        sin(p.y * 0.51 - p.x * 0.15 - t * 1.02)
      ) * 0.11;
      s += vec2(
        cos(p.x * 1.7 + p.y * 0.6 + t * 2.1),
        sin(p.y * 1.5 - p.x * 0.5 - t * 1.9)
      ) * 0.035;
      return s;
    }

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      vec2 p = vWorldPos.xz;

      vec2 slope = waveSlope(p, uTime);

      // 钟声 / 桨声的同心涟漪：把径向斜率叠加到水面上
      for (int i = 0; i < 6; i++) {
        vec4 ripple = uRipples[i];
        float age = uTime - ripple.z;
        if (age > 0.0 && age < 7.0 && ripple.w > 0.001) {
          vec2 d = p - ripple.xy;
          float r = length(d) + 0.001;
          float front = sin(r * 1.65 - age * 2.9);
          float decay = exp(-r * 0.055) * exp(-age * 0.42);
          float ring = front * decay * ripple.w;
          slope += (d / r) * ring * 3.2;
        }
      }

      // 低频噪声扰动，打破规则行波
      float jitterA = noise2(p * 0.33 + uTime * 0.35) - 0.5;
      float jitterB = noise2(p * 0.29 - uTime * 0.41 + 27.1) - 0.5;

      vec3 normal = normalize(vec3(
        -slope.x * 0.055 + jitterA * 0.16,
        1.0,
        -slope.y * 0.055 + jitterB * 0.16
      ));

      vec2 uv = vUv.xy / max(vUv.w, 0.0001);
      vec2 distort = slope * vec2(0.0022, 0.0034);
      vec3 refl = texture2D(
        tDiffuse,
        clamp(uv + distort, vec2(0.002), vec2(0.998))
      ).rgb;
      vec3 reflB = texture2D(
        tDiffuse,
        clamp(uv + distort * 2.6 + vec2(0.0, 0.0018), vec2(0.002), vec2(0.998))
      ).rgb;
      refl = mix(refl, reflB, 0.4);

      float fresnel = pow(1.0 - clamp(dot(viewDir, normal), 0.0, 1.0), 3.2);
      fresnel = mix(0.10, 1.0, fresnel);

      vec3 base = mix(uDeepColor, uSurfaceColor, fresnel * 0.62);
      vec3 col = mix(base, refl * vec3(0.62, 0.7, 0.86), clamp(fresnel * uReflect, 0.0, 1.0));

      // ---- 月光：沿相机 → 月亮的方位拉出一条细长的银色碎影 ----
      vec2 toPoint = normalize(p - cameraPosition.xz + vec2(0.0001));
      vec2 moonH = normalize(uMoonDir.xz);
      float align = clamp(dot(toPoint, moonH), -1.0, 1.0);
      float angleDiff = acos(align);
      float path = exp(-angleDiff * angleDiff * 170.0);

      vec3 moonDir = normalize(uMoonDir);
      vec3 halfDir = normalize(moonDir + viewDir);
      float sparkle = pow(max(dot(normal, halfDir), 0.0), 58.0);
      float shimmer = noise2(vec2(p.x * 0.075, p.y * 0.21 + uTime * 0.32)) * 0.65
                    + noise2(vec2(p.x * 0.31 + uTime * 0.2, p.y * 0.12)) * 0.35;
      shimmer = smoothstep(0.26, 0.74, shimmer);
      float micro = (0.55 + 0.45 * noise2(vec2(p.x * 1.35, p.y * 0.72 + uTime * 0.55)))
                  * (0.45 + 0.55 * noise2(vec2(p.x * 3.3 + uTime * 0.3, p.y * 1.7 - uTime * 0.2)));
      float moonPath = path * (0.008 + sparkle * 0.5) * shimmer * micro;
      col += uMoonColor * moonPath * uMoonIntensity;

      // 高光边缘再补一层极细的银蓝线，让倒影断续、有呼吸感
      float thin = pow(max(dot(normal, halfDir), 0.0), 150.0);
      col += uMoonColor * thin * path * 0.35 * uMoonIntensity;

      // ---- 渔火 / 灯笼的暖色倒影 ----
      for (int i = 0; i < 10; i++) {
        float power = uLanternPower[i];
        if (power <= 0.001) continue;

        vec3 lp = uLanternPos[i];
        vec3 mirror = vec3(lp.x, 2.0 * 0.35 - lp.y, lp.z);

        // 相机到镜像点的连线：暖光在江面上被拉成一条竖向光带
        vec2 a = cameraPosition.xz;
        vec2 b = mirror.xz;
        vec2 ab = b - a;
        float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
        float segDist = length(p - (a + ab * t));
        float band = exp(-segDist * segDist * 1.35);
        float lengthFade = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.82, 1.0, t));

        float rippleNoise = noise2(vec2(p.x * 0.9, p.y * 0.55 + uTime * 0.9));
        float broken = pow(max(0.0, 0.55 - rippleNoise), 1.6) * 1.6;
        float glint = pow(max(dot(normal, normalize(normalize(lp - vWorldPos) + viewDir)), 0.0), 34.0);
        float atten = 1.0 / (1.0 + length(lp - vWorldPos) * 0.045);

        col += uLanternColor[i] * band * lengthFade * (broken * 0.22 + glint * 0.55) * power * atten;
      }

      // ---- 贴岸的暗色水线 ----
      float shore = smoothstep(31.0, 34.0, abs(vWorldPos.z));
      float foamNoise = noise2(vec2(p.x * 0.6, p.y * 0.8 + uTime * 0.35));
      col = mix(col, col * 0.62, shore * 0.55 * foamNoise);

      // ---- 与场景一致的雾 ----
      float distanceToCamera = length(vWorldPos - cameraPosition);
      float fog = 1.0 - exp(-uFogDensity * uFogDensity * distanceToCamera * distanceToCamera);
      col = mix(col, uFogColor, fog);

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

function createWaterGeometry() {
  const geometry = new THREE.PlaneGeometry(660, 92, 220, 30);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function createWater() {
  const width = Math.min(1280, Math.round(window.innerWidth * 0.9));
  const height = Math.min(760, Math.round(window.innerHeight * 0.9));

  const water = new Reflector(createWaterGeometry(), {
    clipBias: 0.004,
    textureWidth: width,
    textureHeight: height,
    color: 0xffffff,
    multisample: 4,
    shader: WaterShader,
  });

  water.position.y = WORLD.waterLevel;
  water.material.fog = false;
  water.receiveShadow = false;

  const uniforms = water.material.uniforms;
  let rippleCursor = 0;

  const lanterns = Array.from({ length: MAX_LANTERNS }, () => ({
    position: new THREE.Vector3(0, -100, 0),
    color: new THREE.Color(0xffad58),
    power: 0,
  }));

  function syncLanterns() {
    for (let i = 0; i < MAX_LANTERNS; i++) {
      uniforms.uLanternPos.value[i].copy(lanterns[i].position);
      uniforms.uLanternColor.value[i].copy(lanterns[i].color);
      uniforms.uLanternPower.value[i] = lanterns[i].power;
    }
  }

  water.update = (elapsed) => {
    uniforms.uTime.value = elapsed;
  };

  water.setMoon = (direction, intensity = 1) => {
    uniforms.uMoonDir.value.copy(direction);
    uniforms.uMoonIntensity.value = intensity;
  };

  water.setLantern = (index, position, color, power = 1) => {
    if (index < 0 || index >= MAX_LANTERNS) return;
    lanterns[index].position.copy(position);
    lanterns[index].color.set(color);
    lanterns[index].power = power;
    syncLanterns();
  };

  water.addRipple = (x, z, time, strength = 1) => {
    uniforms.uRipples.value[rippleCursor].set(x, z, time, strength);
    rippleCursor = (rippleCursor + 1) % MAX_RIPPLES;
  };

  water.applyAtmosphere = () => {
    uniforms.uFogColor.value.set(ATMOSPHERE.fogColor);
    uniforms.uFogDensity.value = ATMOSPHERE.fogDensity;
  };

  water.applyAtmosphere();
  water.setMoon(new THREE.Vector3(-0.12, 0.1, -0.99).normalize(), 1);

  return {
    mesh: water,
    water,
    uniforms,
    addRipple: water.addRipple,
    setLantern: water.setLantern,
    setMoon: water.setMoon,
    update: water.update,
  };
}
