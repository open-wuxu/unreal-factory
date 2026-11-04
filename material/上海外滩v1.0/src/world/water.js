import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { RIVER } from "../config.js";

/**
 * 黄浦江水面。
 *
 * 使用 three 的 Reflector 生成真实的平面反射（低分辨率渲染目标），
 * 再通过自定义 shader 叠加程序化波纹、菲涅尔、日光高光、
 * 夜间灯影与岸边泡沫。
 */

const WaterShader = {
  name: "BundWaterShader",

  uniforms: {
    color: { value: new THREE.Color(0xffffff) },
    tDiffuse: { value: null },
    textureMatrix: { value: new THREE.Matrix4() },

    uTime: { value: 0 },
    uDeepColor: { value: new THREE.Color(0x103742) },
    uSurfaceColor: { value: new THREE.Color(0x2d6d78) },
    uAccent: { value: new THREE.Color(0xffe0b0) },
    uSunColor: { value: new THREE.Color(0xfff2d4) },
    uSunDir: { value: new THREE.Vector3(-0.52, 0.66, 0.54).normalize() },
    uSunIntensity: { value: 1.0 },
    uNight: { value: 0.0 },
    uReflect: { value: 0.7 },
    uFogColor: { value: new THREE.Color(0xcadff0) },
    uFogNear: { value: 1500 },
    uFogFar: { value: 8200 },
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
    uniform vec3 uAccent;
    uniform vec3 uSunColor;
    uniform vec3 uSunDir;
    uniform float uSunIntensity;
    uniform float uNight;
    uniform float uReflect;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;

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

    // 四组不同尺度的行波叠加，返回值当作水面斜率
    vec2 waveSlope(vec2 p, float t) {
      vec2 s = vec2(0.0);
      s += vec2(cos(p.x * 0.045 + t * 0.7), sin(p.y * 0.052 - t * 0.55)) * 0.55;
      s += vec2(
        cos(p.x * 0.11 - p.y * 0.03 + t * 1.3),
        sin(p.y * 0.13 + p.x * 0.02 - t * 1.05)
      ) * 0.30;
      s += vec2(
        cos(p.x * 0.31 + p.y * 0.12 + t * 2.1),
        sin(p.y * 0.27 - p.x * 0.09 - t * 1.8)
      ) * 0.12;
      s += vec2(
        cos(p.x * 0.9 + p.y * 0.4 + t * 3.1),
        sin(p.y * 0.8 - p.x * 0.3 - t * 2.7)
      ) * 0.04;
      return s;
    }

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      vec2 p = vWorldPos.xz;
      vec2 slope = waveSlope(p, uTime);

      vec3 normal = normalize(vec3(-slope.x * 0.09, 1.0, -slope.y * 0.09));

      vec2 uv = vUv.xy / max(vUv.w, 0.0001);
      vec2 distort = slope * 0.0024 * mix(0.5, 1.0, uNight);

      vec3 refl = texture2D(
        tDiffuse,
        clamp(uv + distort, vec2(0.002), vec2(0.998))
      ).rgb;
      vec3 reflB = texture2D(
        tDiffuse,
        clamp(uv + distort * 2.4 + vec2(0.0, 0.0012), vec2(0.002), vec2(0.998))
      ).rgb;
      refl = mix(refl, reflB, 0.35);

      float fresnel = pow(1.0 - clamp(dot(viewDir, normal), 0.0, 1.0), 3.0);
      fresnel = mix(0.06, 1.0, fresnel);

      vec3 base = mix(uDeepColor, uSurfaceColor, fresnel * 0.7);
      vec3 col = mix(base, refl, clamp(fresnel * uReflect, 0.0, 1.0));

      // 太阳 / 月亮在水面的碎金高光
      vec3 sunDir = normalize(uSunDir);
      vec3 halfDir = normalize(sunDir + viewDir);
      float specular = pow(max(dot(normal, halfDir), 0.0), 420.0);
      col += uSunColor * specular * uSunIntensity * 2.4;

      // 夜间：灯影随波拉出细碎的光带
      float shimmer = noise2(vec2(p.x * 0.07, p.y * 0.2 + uTime * 0.22));
      shimmer = pow(shimmer, 2.4);
      float grazing = 1.0 - smoothstep(0.02, 0.28, abs(viewDir.y));
      col += uAccent * shimmer * uNight * 0.22 * grazing * fresnel;

      // 岸边泡沫
      float shore = smoothstep(196.0, 209.0, abs(vWorldPos.x));
      float foamNoise = noise2(vec2(p.x * 1.6, p.y * 0.32 + uTime * 0.85));
      float foam = shore * smoothstep(0.42, 0.92, foamNoise);
      col += vec3(0.68, 0.76, 0.78) * foam * 0.4;

      // 与场景雾保持一致
      float distanceToCamera = length(vWorldPos - cameraPosition);
      float fog = smoothstep(uFogNear, uFogFar, distanceToCamera);
      col = mix(col, uFogColor, fog);

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

export function createWater() {
  const width = Math.min(1280, Math.round(window.innerWidth * 0.85));
  const height = Math.min(760, Math.round(window.innerHeight * 0.85));

  const geometry = new THREE.PlaneGeometry(RIVER.width + 10, RIVER.length, 1, 1);
  const water = new Reflector(geometry, {
    clipBias: 0.004,
    textureWidth: width,
    textureHeight: height,
    color: 0xffffff,
    multisample: 0,
    shader: WaterShader,
  });

  water.rotation.x = -Math.PI / 2;
  water.position.y = RIVER.waterLevel;
  water.material.fog = false;

  const uniforms = water.material.uniforms;

  water.update = (elapsed) => {
    uniforms.uTime.value = elapsed;
  };

  water.applyPreset = (preset, sunDirection) => {
    uniforms.uDeepColor.value.set(preset.waterDeep);
    uniforms.uSurfaceColor.value.set(preset.waterSurface);
    uniforms.uAccent.value.set(preset.waterAccent);
    uniforms.uSunColor.value.set(preset.sunColor);
    uniforms.uSunDir.value.copy(sunDirection);
    uniforms.uSunIntensity.value = preset.sunLightIntensity;
    uniforms.uNight.value = preset.waterNight;
    uniforms.uReflect.value = preset.waterReflect;
    uniforms.uFogColor.value.set(preset.fogColor);
    uniforms.uFogNear.value = preset.fogNear;
    uniforms.uFogFar.value = preset.fogFar;
  };

  return water;
}
