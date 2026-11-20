import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/addons/postprocessing/Pass.js";
import { createCloudNoise3D } from "../utils/textures.js";

/**
 * 半分辨率体积云海。
 *
 * 一个后处理 Pass：读取场景颜色与深度，按像素反投影出世界射线，
 * 在 [cloudBase, bandTop] 的高度层里步进采样 3D 噪声密度；
 * 用场景深度做遮挡与软相交；太阳方向做 3 次光照采样得到银边。
 * 结果先渲染到半分辨率目标，再双线性合成回场景颜色。
 */

/**
 * 山腰云带参数。密度以主云海峰值（1.0）为基准：0.015 表示 1.5%。
 * 高度层覆盖六峰峰顶区间，因此靠低密度只擦过崖壁，不形成覆盖。
 */
export const CLOUD_BAND = {
  center: 1310,
  sigma: 120,
  peak: 0.015,
};

export function bandDensity(y) {
  return (
    CLOUD_BAND.peak *
    Math.exp(-Math.pow((y - CLOUD_BAND.center) / CLOUD_BAND.sigma, 2))
  );
}

const MARCH_VERTEX = /* glsl */ `
  in vec3 position;
  in vec2 uv;
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const MARCH_FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp sampler3D;

  uniform sampler2D tDepth;
  uniform sampler3D tNoise;
  uniform mat4 uInvProjection;
  uniform mat4 uCameraWorld;
  uniform vec3 uCameraPosition;
  uniform vec3 uSunDirection;
  uniform vec3 uCloudLit;
  uniform vec3 uCloudShadow;
  uniform float uTime;
  uniform float uDensity;
  uniform float uSteps;
  uniform float uCloudBase;
  uniform float uBandTop;

  in vec2 vUv;
  out vec4 fragColor;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noiseAt(vec3 p) {
    vec3 uv = p * 0.00042 + vec3(uTime * 0.0016, 0.0, uTime * 0.0007);
    float a = texture(tNoise, uv).r;
    float b = texture(tNoise, uv * 3.1 + vec3(0.37, 0.11, 0.53)).r;
    return a * 0.72 + b * 0.28;
  }

  float heightDensity(float y) {
    float main = exp(-pow((y - 900.0) / 105.0, 2.0));
    float band = ${CLOUD_BAND.peak.toFixed(3)} * exp(-pow((y - ${CLOUD_BAND.center.toFixed(1)}) / ${CLOUD_BAND.sigma.toFixed(1)}, 2.0));
    return main + band;
  }

  float densityAt(vec3 p) {
    float lift = (texture(tNoise, p * 0.00018 + vec3(0.13, 0.0, 0.31)).r - 0.5) * 260.0;
    float profile = heightDensity(p.y - lift);
    if (profile < 0.012) return 0.0;
    float n = noiseAt(p);
    float shape = smoothstep(0.5, 0.78, n);
    float coverage = smoothstep(0.26, 0.5,
      texture(tNoise, p * 0.00009 + vec3(uTime * 0.0004, 0.2, 0.0)).r);
    return shape * coverage * profile * uDensity;
  }

  float hg(float cosTheta, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
  }

  void main() {
    float depth = texture(tDepth, vUv).x;

    vec4 farClip = uInvProjection * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 rayDirView = normalize(farClip.xyz / farClip.w);
    vec3 rayDir = normalize(mat3(uCameraWorld) * rayDirView);

    float sceneDistance;
    if (depth >= 0.99999) {
      sceneDistance = 1e9;
    } else {
      vec4 clip = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 view = uInvProjection * clip;
      view.xyz /= view.w;
      vec3 world = (uCameraWorld * vec4(view.xyz, 1.0)).xyz;
      sceneDistance = length(world - uCameraPosition);
    }

    float t0 = 0.0;
    float t1 = min(sceneDistance, 26000.0);
    if (abs(rayDir.y) > 1e-4) {
      float a = (uCloudBase - uCameraPosition.y) / rayDir.y;
      float b = (uBandTop - uCameraPosition.y) / rayDir.y;
      t0 = max(t0, min(a, b));
      t1 = min(t1, max(a, b));
    } else if (uCameraPosition.y < uCloudBase || uCameraPosition.y > uBandTop) {
      fragColor = vec4(0.0);
      return;
    }
    if (t1 <= t0) {
      fragColor = vec4(0.0);
      return;
    }

    float steps = uSteps;
    float stepLength = (t1 - t0) / steps;
    float t = t0 + stepLength * hash12(gl_FragCoord.xy);

    vec3 accumulated = vec3(0.0);
    float transmittance = 1.0;

    float cosTheta = dot(rayDir, normalize(uSunDirection));
    float phase = hg(cosTheta, 0.55) * 12.0 + 0.22;
    vec3 sunDirection = normalize(uSunDirection);

    for (int i = 0; i < 64; i++) {
      if (float(i) >= steps || transmittance < 0.015) break;
      vec3 p = uCameraPosition + rayDir * t;
      float depthFade = smoothstep(0.0, 70.0, sceneDistance - t);
      float density = densityAt(p) * depthFade;
      if (density > 0.001) {
        float lightOptical = 0.0;
        for (int j = 1; j <= 3; j++) {
          lightOptical += densityAt(p + sunDirection * (float(j) * 55.0));
        }
        float sunVisibility = exp(-lightOptical * 0.6);
        vec3 scattering = mix(uCloudShadow, uCloudLit, sunVisibility);
        scattering *= (0.5 + 0.35 * phase) * 0.5;

        float extinction = density * 0.02 * stepLength;
        float sampleTransmittance = exp(-extinction);
        accumulated += transmittance * (1.0 - sampleTransmittance) * scattering;
        transmittance *= sampleTransmittance;
      }
      t += stepLength;
    }

    fragColor = vec4(accumulated, 1.0 - transmittance);
  }
`;

const COMPOSITE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const COMPOSITE_FRAGMENT = /* glsl */ `
  uniform sampler2D tScene;
  uniform sampler2D tCloud;
  varying vec2 vUv;
  void main() {
    vec3 scene = texture2D(tScene, vUv).rgb;
    vec4 cloud = texture2D(tCloud, vUv);
    vec3 color = scene * (1.0 - cloud.a) + cloud.rgb;
    gl_FragColor = vec4(color, 1.0);
  }
`;

class CloudPass extends Pass {
  constructor(camera, uniforms, noiseTexture) {
    super();
    this.camera = camera;
    this.uniforms = uniforms;
    this.needsSwap = true;
    this.fallbackDepthTexture = null;

    this.marchMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tDepth: { value: null },
        tNoise: { value: noiseTexture },
        uInvProjection: { value: new THREE.Matrix4() },
        uCameraWorld: { value: new THREE.Matrix4() },
        uCameraPosition: { value: new THREE.Vector3() },
        uSunDirection: uniforms.uSunDirection,
        uCloudLit: uniforms.uCloudLit,
        uCloudShadow: uniforms.uCloudShadow,
        uTime: uniforms.uTime,
        uDensity: uniforms.uDensity,
        uSteps: uniforms.uSteps,
        uCloudBase: uniforms.uCloudBase,
        uBandTop: uniforms.uBandTop,
      },
      vertexShader: MARCH_VERTEX,
      fragmentShader: MARCH_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tCloud: { value: null },
      },
      vertexShader: COMPOSITE_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });

    this.marchQuad = new FullScreenQuad(this.marchMaterial);
    this.compositeQuad = new FullScreenQuad(this.compositeMaterial);

    this.halfTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.halfTarget.texture.minFilter = THREE.LinearFilter;
    this.halfTarget.texture.magFilter = THREE.LinearFilter;
  }

  setDepthTexture(texture) {
    this.fallbackDepthTexture = texture;
  }

  setSize(width, height) {
    this.halfTarget.setSize(
      Math.max(1, Math.floor(width * 0.5)),
      Math.max(1, Math.floor(height * 0.5)),
    );
  }

  render(renderer, writeBuffer, readBuffer) {
    const camera = this.camera;
    camera.updateMatrixWorld();
    const uniforms = this.marchMaterial.uniforms;
    const depthTexture =
      (readBuffer && readBuffer.depthTexture) || this.fallbackDepthTexture;

    uniforms.uInvProjection.value.copy(camera.projectionMatrixInverse);
    uniforms.uCameraWorld.value.copy(camera.matrixWorld);
    camera.getWorldPosition(uniforms.uCameraPosition.value);
    uniforms.tDepth.value = depthTexture;

    const clearAlpha = renderer.getClearAlpha();
    renderer.setClearAlpha(0);
    renderer.setRenderTarget(this.halfTarget);
    renderer.clear();
    renderer.setClearAlpha(clearAlpha);
    if (depthTexture) {
      this.marchQuad.render(renderer);
    }

    this.compositeMaterial.uniforms.tScene.value = readBuffer.texture;
    this.compositeMaterial.uniforms.tCloud.value = this.halfTarget.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.compositeQuad.render(renderer);
  }

  dispose() {
    this.halfTarget.dispose();
    this.marchMaterial.dispose();
    this.compositeMaterial.dispose();
    this.marchQuad.dispose();
    this.compositeQuad.dispose();
  }
}

export function createClouds({ renderer, camera }) {
  void renderer;
  const noiseTexture = createCloudNoise3D(64, 9871);
  const uniforms = {
    uSunDirection: { value: new THREE.Vector3(-0.7, 0.3, 0.35) },
    uCloudLit: { value: new THREE.Color(0xffe2bb) },
    uCloudShadow: { value: new THREE.Color(0x6f7f96) },
    uTime: { value: 0 },
    uDensity: { value: 0.6 },
    uSteps: { value: 48 },
    uCloudBase: { value: 730 },
    uBandTop: { value: 1460 },
  };

  const pass = new CloudPass(camera, uniforms, noiseTexture);

  function update(delta, state) {
    if (state && state.time !== undefined) {
      uniforms.uTime.value = state.time;
    } else {
      uniforms.uTime.value += delta;
    }
    if (state && state.sunDirection) {
      uniforms.uSunDirection.value.copy(state.sunDirection);
    }
    if (state && state.colors) {
      uniforms.uCloudLit.value.copy(state.colors.cloudLit);
      uniforms.uCloudShadow.value.copy(state.colors.cloudShadow);
    }
  }

  function setEnabled(value) {
    pass.enabled = Boolean(value);
  }

  function setDepthTexture(texture) {
    pass.setDepthTexture(texture);
  }

  return {
    pass,
    update,
    setEnabled,
    setDepthTexture,
    uniforms,
  };
}
