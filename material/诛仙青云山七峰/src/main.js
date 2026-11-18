import "./deterministic.js";

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { ATMOSPHERE, CAMERA_VIEWS } from "./config.js";

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

  const clock = new THREE.Clock();
  let firstFrame = true;

  function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    controls.update(delta);
    renderer.render(scene, camera);

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
  });

  window.__qingyun = {
    THREE,
    renderer,
    scene,
    camera,
    controls,
  };
}

try {
  bootstrap();
} catch (error) {
  console.error(error);
  showFallback();
}
