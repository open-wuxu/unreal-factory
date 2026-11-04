import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { DEFAULT_PRESET, LANDMARK_VIEWS } from "./config.js";
import { createWorld } from "./world/index.js";
import { createTimeSystem } from "./world/time.js";
import {
  createUI,
  hideLoading,
  setLoadingProgress,
  showFallback,
} from "./ui.js";

/* ------------------------------------------------------------------ */
/* 能力检测                                                            */
/* ------------------------------------------------------------------ */

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

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

async function bootstrap() {
  if (!supportsWebGL2()) {
    showFallback();
    return;
  }

  setLoadingProgress(0.08);

  const canvas = document.getElementById("scene");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch (error) {
    console.error(error);
    showFallback();
    return;
  }

  const pixelRatio = Math.min(window.devicePixelRatio, 1.6);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor(0x05070b, 1);

  const scene = new THREE.Scene();

  const view = LANDMARK_VIEWS.overview;
  const camera = new THREE.PerspectiveCamera(
    44,
    window.innerWidth / window.innerHeight,
    1,
    30000,
  );
  // 开场从更远处飞入，随后进入自动环绕
  camera.position.set(
    view.position[0] * 1.55,
    view.position[1] * 2.15,
    view.position[2] * 1.55,
  );

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.fromArray(view.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.8;
  controls.minDistance = 420;
  controls.maxDistance = 12000;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI * 0.492;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.32;
  controls.zoomToCursor = true;
  controls.enabled = false;

  setLoadingProgress(0.28);

  const world = createWorld(scene, camera);

  setLoadingProgress(0.66);

  /* 后处理 ---------------------------------------------------------- */

  const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(window.innerWidth, window.innerHeight);

  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.55,
    0.5,
    0.72,
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  /* 昼夜系统 -------------------------------------------------------- */

  const time = createTimeSystem({
    renderer,
    scene,
    world,
    bloomPass,
    sunLight: world.sunLight,
    hemiLight: world.hemiLight,
    ambientLight: world.ambientLight,
    initial: DEFAULT_PRESET,
    onChange: (name) => ui.setTime(name),
  });

  renderer.shadowMap.needsUpdate = true;

  setLoadingProgress(0.88);

  /* 相机飞行 -------------------------------------------------------- */

  const flight = {
    active: false,
    elapsed: 0,
    duration: 1.6,
    fromPosition: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toPosition: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    restoreOrbit: true,
  };

  function flyTo(targetView, duration = 1.6, restoreOrbit = true) {
    flight.fromPosition.copy(camera.position);
    flight.fromTarget.copy(controls.target);
    flight.toPosition.fromArray(targetView.position);
    flight.toTarget.fromArray(targetView.target);
    flight.elapsed = 0;
    flight.duration = duration;
    flight.active = true;
    flight.restoreOrbit = restoreOrbit;
    controls.autoRotate = false;
    controls.enabled = false;
  }

  function updateFlight(delta) {
    if (!flight.active) return;
    flight.elapsed = Math.min(flight.duration, flight.elapsed + delta);
    const t = easeInOutCubic(flight.elapsed / flight.duration);

    camera.position.lerpVectors(
      flight.fromPosition,
      flight.toPosition,
      t,
    );
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, t);
    camera.lookAt(controls.target);

    if (flight.elapsed >= flight.duration) {
      flight.active = false;
      controls.enabled = true;
      controls.autoRotate = flight.restoreOrbit;
    }
  }

  /* 界面 ------------------------------------------------------------ */

  const ui = createUI({
    onTimeChange: (name) => time.setPreset(name),
    onLandmark: (name) => {
      const targetView = LANDMARK_VIEWS[name];
      if (targetView) flyTo(targetView, 1.5);
    },
    onToggleOrbit: (enabled) => {
      if (flight.active) flight.restoreOrbit = enabled;
      else controls.autoRotate = enabled;
    },
    onResetView: () => flyTo(LANDMARK_VIEWS.overview, 1.7),
  });

  ui.setTime(time.current);
  ui.setLandmark("overview");
  ui.setOrbit(true);

  controls.addEventListener("start", () => {
    if (!flight.active) ui.setLandmark(null);
  });

  /* 主循环 ---------------------------------------------------------- */

  const timer = new THREE.Timer();
  timer.connect(document);

  let firstFrame = true;

  function animate() {
    timer.update();
    const delta = Math.min(timer.getDelta(), 0.05);
    const elapsed = timer.getElapsed();

    time.update(delta);

    if (flight.active) {
      updateFlight(delta);
    } else if (!flight.active) {
      controls.update(delta);
    }

    world.update(delta, elapsed, time.state);
    composer.render();

    if (firstFrame) {
      firstFrame = false;
      hideLoading();
      // 开场飞行：从远处推近到全景。
      flyTo(LANDMARK_VIEWS.overview, 2.8, true);
    }
  }

  renderer.setAnimationLoop(animate);

  /* 尺寸 ------------------------------------------------------------ */

  window.addEventListener("resize", () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);
  });

  // 首帧渲染完成后再收起加载层
  setLoadingProgress(0.96);

  // 便于调试与性能检查
  window.__bund = {
    renderer,
    scene,
    camera,
    controls,
    composer,
    world,
    time,
    flyTo,
    flight,
    setView(position, target) {
      flight.active = false;
      controls.enabled = true;
      controls.autoRotate = false;
      camera.position.fromArray(position);
      controls.target.fromArray(target);
      controls.update();
    },
  };
}

bootstrap().catch((error) => {
  console.error(error);
  showFallback();
});
