import "./deterministic.js";

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

import { ATMOSPHERE, CAMERA_VIEWS } from "./config.js";
import { createWorld } from "./world/index.js";
import { createFilm, FILM_DURATION, FILM_FPS } from "./film.js";
import { createAudio } from "./audio.js";
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
/* 电影级色调：低调的冷暗部、暖高光、晕影与颗粒                          */
/* ------------------------------------------------------------------ */

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.34 },
    uGrain: { value: 0.012 },
    uSaturation: { value: 1.05 },
    uContrast: { value: 1.035 },
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

      // 冷暗部 / 暖高光的分离色调（在线性空间里做得很轻）
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c += vec3(-0.006, 0.001, 0.014) * (1.0 - smoothstep(0.0, 0.42, luma));
      c += vec3(0.028, 0.014, -0.008) * smoothstep(0.46, 1.0, luma);

      // 轻提暗部，避免夜色被压成死黑
      c += vec3(0.0035, 0.0055, 0.009) * (1.0 - smoothstep(0.0, 0.5, luma));

      // 饱和度与柔和的 S 形对比
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      c = mix(vec3(0.5), c, uContrast);
      c = clamp(c, 0.0, 8.0);

      // 暗角
      vec2 p = vUv - 0.5;
      float vignette = smoothstep(0.86, 0.28, length(p));
      c *= mix(1.0, vignette, uVignette);

      // 极细的胶片颗粒
      float grain = hash21(vUv * 1920.0 + fract(uTime) * 37.0) - 0.5;
      c += grain * uGrain;

      gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
    }
  `,
};

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

async function bootstrap() {
  if (!supportsWebGL2()) {
    showFallback();
    return;
  }

  setLoadingProgress(0.06);

  const params = new URLSearchParams(window.location.search);
  const filmMode = params.has("film");
  const captureMode = params.has("capture");
  const noBokeh = params.has("nobokeh");

  const canvas = document.getElementById("scene");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
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
  renderer.toneMappingExposure = ATMOSPHERE.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = true;
  renderer.setClearColor(0x05080d, 1);
  renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
    console.error("shader error", gl.getProgramInfoLog(program));
    console.error("vs", gl.getShaderInfoLog(vertexShader));
    console.error("fs", gl.getShaderInfoLog(fragmentShader));
  };

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.4,
    20000,
  );

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(14, 2.2, 23);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.7;
  controls.minDistance = 2.5;
  controls.maxDistance = 320;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.zoomToCursor = true;
  controls.enabled = false;

  setLoadingProgress(0.22);

  const world = createWorld(scene, camera);

  setLoadingProgress(0.7);

  /* 后处理 ---------------------------------------------------------- */

  const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(window.innerWidth, window.innerHeight);

  composer.addPass(new RenderPass(scene, camera));

  let bokehPass = null;
  if (!noBokeh) {
    bokehPass = new BokehPass(scene, camera, {
      focus: 30,
      aperture: 0.00028,
      maxblur: 0.0055,
    });
    composer.addPass(bokehPass);
  }

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

  /* 影片 ------------------------------------------------------------ */

  const film = createFilm({
    camera,
    controls,
    world,
    composer,
    beforeRender: updateFocus,
  });

  setLoadingProgress(0.86);

  /* 声音 ------------------------------------------------------------ */

  const audio = createAudio();

  /* 界面 ------------------------------------------------------------ */

  let mode = "demo"; // demo | free
  let playing = true;
  let elapsed = 0;
  let shadowClock = 0;

  const flight = {
    active: false,
    elapsed: 0,
    duration: 1.6,
    fromPosition: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toPosition: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
  };

  function flyTo(view, duration = 1.6) {
    if (!view) return;
    flight.fromPosition.copy(camera.position);
    flight.fromTarget.copy(controls.target);
    flight.toPosition.fromArray(view.position);
    flight.toTarget.fromArray(view.target);
    flight.elapsed = 0;
    flight.duration = duration;
    flight.active = true;
    controls.enabled = false;
  }

  function updateFlight(delta) {
    if (!flight.active) return;
    flight.elapsed = Math.min(flight.duration, flight.elapsed + delta);
    const t = easeInOutCubic(flight.elapsed / flight.duration);
    camera.position.lerpVectors(flight.fromPosition, flight.toPosition, t);
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, t);
    camera.lookAt(controls.target);
    if (flight.elapsed >= flight.duration) {
      flight.active = false;
      if (mode === "free") controls.enabled = true;
    }
  }

  const ui = createUI({
    onPlayToggle: () => {
      if (filmMode) return;
      if (mode === "free") {
        mode = "demo";
        playing = true;
        ui.setFreeMode(false);
        ui.setPlaying(true);
        film.seek(film.time);
      } else {
        playing = !playing;
        ui.setPlaying(playing);
      }
    },
    onReplay: () => {
      if (filmMode) return;
      film.reset();
      mode = "demo";
      playing = true;
      controls.enabled = false;
      ui.setFreeMode(false);
      ui.setPlaying(true);
      film.seek(0);
      film.time = 0;
      ui.setTime(0, FILM_DURATION);
    },
    onSeek: (value) => {
      if (filmMode) return;
      mode = "demo";
      playing = false;
      controls.enabled = false;
      ui.setFreeMode(false);
      ui.setPlaying(false);
      film.seek(value);
      film.time = value;
      ui.setTime(value, FILM_DURATION);
    },
    onView: (name) => {
      if (filmMode) return;
      const view = CAMERA_VIEWS[name];
      if (!view) return;
      if (mode !== "free") {
        mode = "free";
        playing = false;
        ui.setPlaying(false);
        ui.setFreeMode(true);
      }
      ui.setView(name);
      flyTo(view, 1.7);
    },
    onReset: () => {
      if (filmMode) return;
      mode = "free";
      playing = false;
      ui.setPlaying(false);
      ui.setFreeMode(true);
      ui.setView("overview");
      flyTo(CAMERA_VIEWS.overview, 1.8);
    },
    onToggleMist: (value) => {
      world.mist.setEnabled(value);
    },
    onToggleSubtitles: (value) => {
      document.body.classList.toggle("subtitles-off", !value);
    },
    onToggleSound: (value) => {
      const enabled = audio.toggle(value);
      return enabled;
    },
  });

  ui.setPlaying(true);
  ui.setView(null);

  /* 影片模式 -------------------------------------------------------- */

  if (filmMode) {
    document.body.classList.add("is-film");
    if (captureMode) document.body.classList.add("capture-mode");
    controls.enabled = false;
    await document.fonts.ready;

    film.seek(0);
    film.time = 0;

    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "none";
  }

  // 影片模式里的声音开关
  const filmSound = document.getElementById("film-sound");
  if (filmSound) {
    filmSound.addEventListener("click", () => {
      const enabled = audio.toggle();
      filmSound.setAttribute("aria-pressed", String(enabled));
      filmSound.textContent = enabled ? "声音 · 开" : "声音 · 关";
    });
  }

  /* 进入自由探索 ---------------------------------------------------- */

  function enterFreeMode() {
    if (filmMode || captureMode || mode === "free") return;
    mode = "free";
    playing = false;
    ui.setPlaying(false);
    ui.setFreeMode(true);
    ui.setView(null);
    controls.enabled = true;
    controls.update();
  }

  renderer.domElement.addEventListener("pointerdown", enterFreeMode);
  renderer.domElement.addEventListener(
    "wheel",
    () => enterFreeMode(),
    { passive: true },
  );

  window.addEventListener("keydown", (event) => {
    if (filmMode) return;
    if (event.code === "Space") {
      event.preventDefault();
      if (mode === "free") {
        mode = "demo";
        playing = true;
        ui.setFreeMode(false);
        ui.setPlaying(true);
        film.seek(film.time);
      } else {
        playing = !playing;
        ui.setPlaying(playing);
      }
    } else if (event.code === "KeyR") {
      mode = "free";
      playing = false;
      ui.setPlaying(false);
      ui.setFreeMode(true);
      flyTo(CAMERA_VIEWS.overview, 1.8);
    } else if (/^Digit[1-6]$/.test(event.code)) {
      const names = ["overview", "bridge", "maples", "boat", "temple", "water"];
      const name = names[Number(event.code.slice(-1)) - 1];
      const view = CAMERA_VIEWS[name];
      if (view) {
        mode = "free";
        playing = false;
        ui.setPlaying(false);
        ui.setFreeMode(true);
        ui.setView(name);
        flyTo(view, 1.6);
      }
    }
  });

  /* 捕获模式 -------------------------------------------------------- */

  if (filmMode && captureMode) {
    window.__capture = {
      ready: true,
      duration: FILM_DURATION,
      fps: FILM_FPS,
      width: window.innerWidth,
      height: window.innerHeight,
      renderAt: (time) => {
        film.renderFrame(time);
        if (world.moonLight?.shadow) {
          world.moonLight.shadow.needsUpdate = true;
        }
        gradePass.uniforms.uTime.value = time;
      },
      reset: () => {
        film.reset();
      },
    };
  }

  /* 主循环 ---------------------------------------------------------- */

  const timer = new THREE.Timer();
  timer.connect(document);

  let firstFrame = true;

  function renderFree(delta) {
    if (flight.active) updateFlight(delta);
    else controls.update(delta);

    const pausedTime = film.time;
    world.update(delta, elapsed, {
      time: pausedTime,
      filmTime: pausedTime,
      mistDensity: 1,
      frostDensity: 1,
    });
    updateFocus();
    composer.render();
  }

  function updateFocus() {
    if (!bokehPass) return;
    const distance = camera.position.distanceTo(controls.target);
    bokehPass.uniforms.focus.value = THREE.MathUtils.clamp(distance * 0.86, 6, 220);
  }

  function animate() {
    timer.update();
    const delta = Math.min(timer.getDelta(), 0.05);
    elapsed = timer.getElapsed();

    if (mode === "demo") {
      if (playing) {
        film.update(delta);
        audio.update(film.time);
        ui.setTime(film.time, FILM_DURATION);
      } else {
        film.renderFrame(film.time);
        audio.update(film.time);
      }
      ui.setTime(film.time, FILM_DURATION);
    } else {
      renderFree(delta);
    }

    gradePass.uniforms.uTime.value = elapsed;
    updateFocus();

    // 月亮方向变化很慢：阴影贴图每 0.5 秒刷新一次即可
    shadowClock += delta;
    if (shadowClock > 0.5) {
      shadowClock = 0;
      if (world.moonLight?.shadow) world.moonLight.shadow.needsUpdate = true;
    }

    if (firstFrame) {
      firstFrame = false;
      hideLoading();
    }
  }

  if (filmMode) {
    if (!captureMode) {
      renderer.setAnimationLoop(() => {
        timer.update();
        const delta = Math.min(timer.getDelta(), 0.05);
        elapsed = timer.getElapsed();
        film.update(delta);
        audio.update(film.time);
        gradePass.uniforms.uTime.value = elapsed;
        updateFocus();
        shadowClock += delta;
        if (shadowClock > 0.5) {
          shadowClock = 0;
          if (world.moonLight?.shadow) world.moonLight.shadow.needsUpdate = true;
        }
        if (firstFrame) {
          firstFrame = false;
          hideLoading();
        }
      });
    } else {
      renderer.setAnimationLoop(null);
    }
  } else {
    renderer.setAnimationLoop(animate);
  }

  /* 尺寸 ------------------------------------------------------------ */

  window.addEventListener("resize", () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);
  });

  setLoadingProgress(0.96);

  // 调试入口
  window.__fengqiao = {
    THREE,
    renderer,
    scene,
    camera,
    controls,
    composer,
    world,
    film,
    audio,
    bloomPass,
    gradePass,
    bokehPass,
    filmMode,
    captureMode,
    get mode() {
      return mode;
    },
    get playing() {
      return playing;
    },
    flyTo,
    flight,
    setView(position, target) {
      mode = "free";
      playing = false;
      flight.active = false;
      controls.enabled = true;
      camera.position.fromArray(position);
      controls.target.fromArray(target);
      controls.update();
      ui.setFreeMode(true);
      ui.setPlaying(false);
    },
    setDemo(time = 0) {
      mode = "demo";
      playing = true;
      controls.enabled = false;
      ui.setFreeMode(false);
      ui.setPlaying(true);
      film.seek(time);
      film.time = time;
    },
  };
}

bootstrap().catch((error) => {
  console.error(error);
  showFallback();
});
