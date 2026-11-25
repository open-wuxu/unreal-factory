import "./deterministic.js";

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { CAMERA_LIMITS, CAMERA_VIEWS, COLORS, WORLD } from "./config.js";
import { createFilm } from "./film.js";
import { FILM_DURATION, FILM_FPS } from "./filmTimeline.js";
import { createWorld } from "./world/index.js";
import { createUI, hideLoading, showFallback } from "./ui.js";

/**
 * 主入口。
 *
 * 普通访问：自动演示 30 秒镜头 → 鼠标交互进入自由浏览 →
 *           机位按钮 / 自动环绕 / 时间轴 / 飘叶开关。
 * ?film=1：隐藏 HUD，实时循环播放影片。
 * ?film=1&capture=1：停止实时循环，由 window.__capture.renderAt(t) 逐帧推进。
 */

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.28 },
    uGrain: { value: 0.006 },
    uSaturation: { value: 1.035 },
    uContrast: { value: 1.028 },
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
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));

      // 高光偏暖、阴影略偏青灰的轻量分离调色
      color += vec3(0.012, 0.005, -0.005) * smoothstep(0.34, 1.0, luma);
      color += vec3(-0.004, 0.001, 0.006) * (1.0 - smoothstep(0.0, 0.3, luma));

      float gradedLuma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(gradedLuma), color, uSaturation);
      color = mix(vec3(0.5), color, uContrast);
      color = clamp(color, 0.0, 8.0);

      vec2 p = vUv - 0.5;
      float vignette = smoothstep(0.92, 0.28, length(p));
      color *= mix(1.0, vignette, uVignette);

      float grain = hash21(vUv * 1728.0 + fract(uTime) * 41.0) - 0.5;
      color += grain * uGrain;

      gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
    }
  `,
};

function supportsWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGL2RenderingContext && canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function bootstrap() {
  if (!supportsWebGL2()) {
    showFallback();
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const filmMode = params.has("film");
  const captureMode = params.has("capture");

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
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // 必须保持 autoUpdate：手动关闭后首帧阴影贴图未初始化，
  // 会让所有受光材质的阴影采样失败、整批网格不绘制（《枫桥夜泊》有同类记录）。
  renderer.shadowMap.autoUpdate = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120d08);
  scene.fog = new THREE.FogExp2(COLORS.fog, WORLD.fogDensity);

  const camera = new THREE.PerspectiveCamera(
    CAMERA_VIEWS.overview.fov,
    window.innerWidth / window.innerHeight,
    WORLD.near,
    WORLD.far,
  );
  camera.position.fromArray(CAMERA_VIEWS.overview.position);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.fromArray(CAMERA_VIEWS.overview.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.75;
  controls.panSpeed = 0.62;
  controls.screenSpacePanning = true;
  controls.minDistance = CAMERA_LIMITS.minDistance;
  controls.maxDistance = CAMERA_LIMITS.maxDistance;
  controls.minPolarAngle = 0.08;
  // 允许仰视机位位于注视点下方（< 180°），穿地与穿树由 constrainCamera 负责
  controls.maxPolarAngle = Math.PI * 0.9;
  controls.autoRotateSpeed = 0.62;
  controls.enabled = false;
  controls.update();

  /* 世界 ------------------------------------------------------------ */

  const world = createWorld(scene, camera, renderer);

  /* 后期 ------------------------------------------------------------ */

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(window.innerWidth, window.innerHeight);

  composer.addPass(new RenderPass(scene, camera));

  const bokehPass = new BokehPass(scene, camera, {
    focus: 18,
    aperture: 0.0024,
    maxblur: 0.004,
  });
  composer.addPass(bokehPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.2,
    0.5,
    0.9,
  );
  composer.addPass(bloomPass);

  const gradePass = new ShaderPass(GradeShader);
  composer.addPass(gradePass);

  composer.addPass(new SMAAPass());
  composer.addPass(new OutputPass());

  /* 影片 ------------------------------------------------------------ */

  const film = createFilm({
    camera,
    controls,
    world,
    composer,
    bokehPass,
    gradePass,
    onBeforeFrame: (time) => {
      gradePass.uniforms.uTime.value = time;
    },
  });

  /* 状态 ------------------------------------------------------------ */

  let mode = "demo"; // demo 自动演示 | free 自由浏览
  let playing = true;
  let currentView = "overview";
  let loadingHidden = false;
  let shadowAccumulator = 0;

  const flight = {
    active: false,
    elapsed: 0,
    duration: 1.8,
    fromPosition: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    fromFov: camera.fov,
    toPosition: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    toFov: camera.fov,
  };

  function clearFilmOverlays() {
    for (const key of ["fade", "flash", "title"]) {
      const element = document.querySelector(`[data-film="${key}"]`);
      if (element) element.style.opacity = "0";
    }
  }

  function constrainCamera(position, target) {
    const minHeight = CAMERA_LIMITS.minHeight;
    const ground = world.ground.heightAt(position.x, position.z) + 0.35;
    if (position.y < Math.max(minHeight, ground)) {
      position.y = Math.max(minHeight, ground);
    }

    // 树干圆柱：禁止穿过主干
    if (position.y < CAMERA_LIMITS.trunkHeight) {
      const horizontal = Math.hypot(position.x, position.z);
      if (horizontal < CAMERA_LIMITS.trunkRadius) {
        const scale = CAMERA_LIMITS.trunkRadius / Math.max(horizontal, 0.0001);
        position.x *= scale;
        position.z *= scale;
      }
    }

    // 树冠核心椭球：允许贴近叶缘，但不进入树冠内部
    const center = CAMERA_LIMITS.crownCenter;
    const radii = CAMERA_LIMITS.crownAvoidRadii;
    const nx = (position.x - center.x) / radii.x;
    const ny = (position.y - center.y) / radii.y;
    const nz = (position.z - center.z) / radii.z;
    const distance = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (distance < 1) {
      const scale = 1.015 / Math.max(distance, 0.0001);
      position.set(
        center.x + (position.x - center.x) * scale,
        Math.max(
          Math.max(minHeight, ground),
          center.y + (position.y - center.y) * scale,
        ),
        center.z + (position.z - center.z) * scale,
      );
    }

    const offset = position.clone().sub(target);
    const length = offset.length();
    if (length < CAMERA_LIMITS.minDistance) {
      offset.setLength(CAMERA_LIMITS.minDistance);
      position.copy(target).add(offset);
    }
  }

  function applyView(name, duration = 1.8) {
    const view = CAMERA_VIEWS[name];
    if (!view) return;
    currentView = name;
    flight.fromPosition.copy(camera.position);
    flight.fromTarget.copy(controls.target);
    flight.fromFov = camera.fov;
    flight.toPosition.fromArray(view.position);
    flight.toTarget.fromArray(view.target);
    flight.toFov = view.fov;
    flight.elapsed = 0;
    flight.duration = duration;
    flight.active = true;
    controls.autoRotate = false;
    ui.setToggle("orbit", false);
    ui.setView(name);
  }

  function updateFlight(delta) {
    if (!flight.active) return;
    flight.elapsed = Math.min(flight.duration, flight.elapsed + delta);
    const t = easeInOutCubic(flight.elapsed / flight.duration);
    camera.position.lerpVectors(flight.fromPosition, flight.toPosition, t);
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, t);
    camera.fov = THREE.MathUtils.lerp(flight.fromFov, flight.toFov, t);
    camera.updateProjectionMatrix();
    constrainCamera(camera.position, controls.target);
    camera.lookAt(controls.target);
    if (flight.elapsed >= flight.duration) {
      flight.active = false;
      controls.update();
    }
  }

  function enterFreeMode() {
    if (filmMode || mode === "free") return;
    mode = "free";
    playing = false;
    controls.enabled = true;
    controls.autoRotate = false;
    ui.setToggle("orbit", false);
    document.body.classList.remove("is-demo");
    document.body.classList.add("is-free");
    ui.setFreeMode(true);
    ui.setPlaying(false);
    ui.setView(null);
    clearFilmOverlays();
    controls.update();
  }

  function startDemo(time = 0) {
    if (filmMode) return;
    mode = "demo";
    playing = true;
    controls.enabled = false;
    controls.autoRotate = false;
    ui.setToggle("orbit", false);
    document.body.classList.add("is-demo");
    document.body.classList.remove("is-free");
    ui.setFreeMode(false);
    ui.setPlaying(true);
    ui.setView("overview");
    currentView = "overview";
    film.seek(time);
    film.time = time;
    ui.setTime(time, FILM_DURATION);
  }

  const ui = createUI({
    onView: (name) => {
      if (filmMode) return;
      enterFreeMode();
      applyView(name);
    },
    onPlayToggle: () => {
      if (filmMode) return;
      if (mode === "free") {
        startDemo(0);
      } else {
        playing = !playing;
        ui.setPlaying(playing);
      }
    },
    onReplay: () => {
      if (filmMode) return;
      startDemo(0);
    },
    onReset: () => {
      if (filmMode) return;
      enterFreeMode();
      controls.autoRotate = false;
      ui.setToggle("orbit", false);
      applyView("overview", 1.6);
    },
    onSeek: (value) => {
      if (filmMode) return;
      mode = "demo";
      playing = false;
      controls.enabled = false;
      controls.autoRotate = false;
      document.body.classList.add("is-demo");
      document.body.classList.remove("is-free");
      ui.setFreeMode(false);
      ui.setPlaying(false);
      film.seek(value);
      film.time = value;
      ui.setTime(value, FILM_DURATION);
    },
    onToggle: (key, value) => {
      if (key === "orbit") {
        if (value) {
          enterFreeMode();
          controls.autoRotate = true;
          ui.setToggle("orbit", true);
          flight.active = false;
        } else {
          controls.autoRotate = false;
        }
      } else if (key === "falling") {
        world.falling.setEnabled(value);
      } else if (key === "title") {
        film.setTitleEnabled(value);
      }
    },
  });

  ui.setPlaying(!filmMode);
  ui.setView("overview");
  ui.setTime(0, FILM_DURATION);

  /* 交互 ------------------------------------------------------------ */

  const stopAutoRotate = () => {
    if (controls.autoRotate) {
      controls.autoRotate = false;
      ui.setToggle("orbit", false);
    }
  };

  // capture 阶段运行，确保首次拖拽就能接管 OrbitControls
  renderer.domElement.addEventListener(
    "pointerdown",
    () => {
      enterFreeMode();
      stopAutoRotate();
    },
    { capture: true },
  );
  renderer.domElement.addEventListener(
    "wheel",
    () => {
      enterFreeMode();
      stopAutoRotate();
    },
    { capture: true, passive: true },
  );

  function cycleView(name) {
    if (filmMode) return;
    enterFreeMode();
    applyView(name);
  }

  window.addEventListener("keydown", (event) => {
    if (filmMode) return;
    const keyViews = {
      Digit1: "overview",
      Digit2: "up",
      Digit3: "crown",
      Digit4: "leaf",
      Digit5: "trunk",
    };
    if (event.code === "Space") {
      event.preventDefault();
      if (mode === "free") startDemo(0);
      else {
        playing = !playing;
        ui.setPlaying(playing);
      }
    } else if (event.code === "KeyR") {
      enterFreeMode();
      applyView("overview", 1.9);
    } else if (event.code === "KeyA") {
      enterFreeMode();
      controls.autoRotate = !controls.autoRotate;
      ui.setToggle("orbit", controls.autoRotate);
    } else if (keyViews[event.code]) {
      cycleView(keyViews[event.code]);
    }
  });

  /* 自由相机 -------------------------------------------------------- */

  function updateFreeCamera(delta) {
    if (flight.active) {
      updateFlight(delta);
    } else {
      controls.update(delta);
      constrainCamera(camera.position, controls.target);
      if (camera.position.distanceTo(controls.target) > 0.01) {
        camera.lookAt(controls.target);
      }
    }

    const isMacro = currentView === "leaf" && !flight.active;
    const focus = camera.position.distanceTo(controls.target);
    bokehPass.uniforms.focus.value = Math.max(0.2, focus);
    bokehPass.uniforms.aperture.value = isMacro ? 0.012 : 0.0012;
    bokehPass.uniforms.maxblur.value = isMacro ? 0.008 : 0.0035;

    if (world.detailLight) {
      world.detailLight.position.copy(camera.position);
      world.detailLight.target.position.copy(controls.target);
      world.detailLight.target.updateMatrixWorld();
      world.detailLight.intensity = currentView === "trunk" ? 80 : 0;
    }

    shadowAccumulator += delta;
    if (shadowAccumulator > 1 / 30) {
      shadowAccumulator = 0;
      world.sunLight.shadow.needsUpdate = true;
    }
  }

  /* 主循环 ---------------------------------------------------------- */

  const timer = new THREE.Timer();
  timer.connect(document);

  function animate() {
    timer.update();
    const delta = Math.min(timer.getDelta(), 0.05);
    const elapsed = timer.getElapsed();

    if (mode === "demo") {
      if (playing) film.update(delta);
      else film.renderFrame(film.time);
      ui.setTime(film.time, FILM_DURATION);
    } else {
      updateFreeCamera(delta);
      world.update(delta, elapsed, { time: elapsed });
      gradePass.uniforms.uTime.value = elapsed;
      composer.render();
    }

    if (!loadingHidden) {
      loadingHidden = true;
      hideLoading();
    }
  }

  /* 影片模式 -------------------------------------------------------- */

  if (filmMode) {
    document.body.classList.add("is-film");
    document.body.classList.remove("is-demo");
    controls.enabled = false;
    playing = !captureMode;
    film.seek(0);
    film.time = 0;

    if (captureMode) {
      document.body.classList.add("capture-mode");
      renderer.setAnimationLoop(null);
      film.renderFrame(0);
      hideLoading();
      window.__capture = {
        ready: true,
        duration: FILM_DURATION,
        fps: FILM_FPS,
        width: window.innerWidth,
        height: window.innerHeight,
        renderAt: (time) => {
          film.renderFrame(time);
        },
        reset: () => film.reset(),
      };
    } else {
      const filmTimer = new THREE.Timer();
      filmTimer.connect(document);
      renderer.setAnimationLoop(() => {
        filmTimer.update();
        const delta = Math.min(filmTimer.getDelta(), 0.05);
        film.update(delta);
        if (!loadingHidden) {
          loadingHidden = true;
          hideLoading();
        }
      });
    }
  } else {
    document.body.classList.add("is-demo");
    startDemo(0);
    renderer.setAnimationLoop(animate);
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  window.__yinxing = {
    THREE,
    renderer,
    scene,
    camera,
    controls,
    composer,
    world,
    film,
    ui,
    bokehPass,
    bloomPass,
    gradePass,
    flyTo: applyView,
    flight,
    filmMode,
    captureMode,
    stats: world.stats,
    setView(name, duration) {
      enterFreeMode();
      applyView(name, duration);
    },
    setCamera(position, target) {
      mode = "free";
      playing = false;
      flight.active = false;
      controls.enabled = true;
      controls.autoRotate = false;
      camera.position.fromArray(position);
      controls.target.fromArray(target);
      controls.update();
      ui.setFreeMode(true);
      ui.setPlaying(false);
      ui.setView(null);
      document.body.classList.remove("is-demo");
      document.body.classList.add("is-free");
      clearFilmOverlays();
    },
    setDemo(time = 0) {
      startDemo(time);
    },
    setFallingEnabled(value) {
      world.falling.setEnabled(value);
      ui.setToggle("falling", value);
    },
    get mode() {
      return mode;
    },
    get playing() {
      return playing;
    },
    get currentView() {
      return currentView;
    },
  };
}

try {
  bootstrap();
} catch (error) {
  console.error(error);
  showFallback();
}
