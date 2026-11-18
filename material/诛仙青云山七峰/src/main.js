import "./deterministic.js";

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";

import { ATMOSPHERE, CAMERA_VIEWS } from "./config.js";
import { createWorld } from "./world/index.js";
import { heightAt } from "./world/shape.js";

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.3 },
    uGrain: { value: 0.01 },
    uSaturation: { value: 1.06 },
    uContrast: { value: 1.03 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uSaturation;
    uniform float uContrast;
    varying vec2 vUv;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));

      c += vec3(-0.004, 0.001, 0.012) * (1.0 - smoothstep(0.0, 0.4, luma));
      c += vec3(0.026, 0.012, -0.006) * smoothstep(0.45, 1.0, luma);

      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      c = mix(vec3(0.5), c, uContrast);
      c = clamp(c, 0.0, 8.0);

      vec2 p = vUv - 0.5;
      float vignette = smoothstep(0.88, 0.3, length(p));
      c *= mix(1.0, vignette, uVignette);

      float grain = hash21(vUv * 1920.0 + fract(uTime) * 37.0) - 0.5;
      c += grain * uGrain;

      gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
    }
  `,
};

function supportsWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGL2RenderingContext && canvas.getContext("webgl2"),
    );
  } catch {
    return false;
  }
}

function showFallback() {
  const loading = document.getElementById("loading");
  const fallback = document.getElementById("fallback");
  if (loading) loading.style.display = "none";
  if (fallback) fallback.hidden = false;
}

function bootstrap() {
  if (!supportsWebGL2()) {
    showFallback();
    return;
  }

  const canvas = document.getElementById("scene");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  const pixelRatio = Math.min(window.devicePixelRatio, 1.6);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b2836);

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    ATMOSPHERE.near,
    ATMOSPHERE.far,
  );
  const overview = CAMERA_VIEWS.overview;
  camera.position.fromArray(overview.position);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.fromArray(overview.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 20;
  controls.maxDistance = 22000;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.update();

  const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: true,
    depthTexture: new THREE.DepthTexture(1, 1),
  });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(window.innerWidth, window.innerHeight);
  // 两个 ping-pong 目标都要带深度，云 Pass 才能在任意一帧读到场景深度。
  composer.renderTarget2.depthTexture = new THREE.DepthTexture(1, 1);

  const world = createWorld(scene, camera, renderer);

  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(world.clouds.pass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    ATMOSPHERE.bloomStrength,
    ATMOSPHERE.bloomRadius,
    ATMOSPHERE.bloomThreshold,
  );
  composer.addPass(bloomPass);

  const gradePass = new ShaderPass(GradeShader);
  composer.addPass(gradePass);
  composer.addPass(new OutputPass());

  const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
  composer.addPass(smaaPass);

  const params = new URLSearchParams(window.location.search);
  const viewName = params.get("view");
  if (viewName === "ground") {
    const x = -1100;
    const z = 1400;
    camera.position.set(x, heightAt(x, z) + 6, z);
    controls.target.set(0, 1520, 0);
    controls.update();
  } else if (CAMERA_VIEWS[viewName]) {
    camera.position.fromArray(CAMERA_VIEWS[viewName].position);
    controls.target.fromArray(CAMERA_VIEWS[viewName].target);
    controls.update();
  }

  const clock = new THREE.Clock();
  let firstFrame = true;

  function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;
    controls.update(delta);
    world.update(delta, elapsed, { time: elapsed });
    gradePass.uniforms.uTime.value = elapsed;
    composer.render();

    if (firstFrame) {
      firstFrame = false;
      const loading = document.getElementById("loading");
      if (loading) loading.style.display = "none";
    }
  }

  renderer.setAnimationLoop(animate);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  window.__qingyun = {
    THREE,
    renderer,
    scene,
    camera,
    controls,
    composer,
    world,
    bloomPass,
    gradePass,
    smaaPass,
  };
}

try {
  bootstrap();
} catch (error) {
  console.error(error);
  showFallback();
}
