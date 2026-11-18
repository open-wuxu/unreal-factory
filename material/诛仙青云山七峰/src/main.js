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
import { createAudio } from "./audio.js";
import { createFilm } from "./film.js";
import { FILM_DURATION, FILM_FPS } from "./filmTimeline.js";
import { createWorld } from "./world/index.js";
import { heightAt } from "./world/shape.js";
import { createUI, hideLoading, showFallback } from "./ui.js";

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
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // 阴影只在焦点变化或影片帧推进时刷新，避免每帧重建 4096² 阴影图。
  renderer.shadowMap.autoUpdate = false;

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
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.7;
  controls.minDistance = 40;
  controls.maxDistance = 22000;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.enabled = false;
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

  /* 影片与 UI ------------------------------------------------------- */

  let mode = "demo"; // demo 播放影片 | free 自由浏览
  let playing = true;
  let currentView = "overview";
  let loadingHidden = false;

  const film = createFilm({
    camera,
    controls,
    world,
    composer,
    onBeforeFrame: (time) => {
      gradePass.uniforms.uTime.value = time;
    },
  });

  const audio = createAudio();

  const flight = {
    active: false,
    elapsed: 0,
    duration: 1.7,
    fromPosition: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toPosition: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
  };

  const shadowFocus = controls.target.clone();
  world.setShadowFocus(shadowFocus, 1400);

  function flyTo(view, duration = 1.7) {
    if (!view) return;
    flight.fromPosition.copy(camera.position);
    flight.fromTarget.copy(controls.target);
    flight.toPosition.fromArray(view.position);
    flight.toTarget.fromArray(view.target);
    flight.elapsed = 0;
    flight.duration = duration;
    flight.active = true;
    world.setShadowFocus(flight.toTarget, 1500);
  }

  function updateFlight(delta) {
    if (!flight.active) return;
    flight.elapsed = Math.min(flight.duration, flight.elapsed + delta);
    const t = easeInOutCubic(flight.elapsed / flight.duration);
    camera.position.lerpVectors(flight.fromPosition, flight.toPosition, t);
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, t);
    const ground = heightAt(camera.position.x, camera.position.z);
    if (camera.position.y < ground + 8) {
      camera.position.y = ground + 8;
    }
    camera.lookAt(controls.target);
    if (flight.elapsed >= flight.duration) {
      flight.active = false;
      controls.update();
    }
  }

  function setView(name) {
    const view = CAMERA_VIEWS[name];
    if (!view) return;
    currentView = name;
    flyTo(view);
  }

  function enterFreeMode() {
    if (filmMode || mode === "free") return;
    mode = "free";
    playing = false;
    controls.enabled = true;
    flight.active = false;
    controls.autoRotate = false;
    document.body.classList.remove("is-demo");
    ui.setPlaying(false);
    ui.setFreeMode(true);
    ui.setTime(film.time, FILM_DURATION);
  }

  function resumeDemo() {
    mode = "demo";
    playing = true;
    controls.enabled = false;
    document.body.classList.add("is-demo");
    ui.setFreeMode(false);
    ui.setPlaying(true);
    film.seek(film.time);
  }

  const ui = createUI({
    onView: (name) => {
      enterFreeMode();
      setView(name);
      ui.setView(name);
    },
    onPlayToggle: () => {
      if (filmMode) return;
      if (mode === "free") {
        resumeDemo();
      } else {
        playing = !playing;
        ui.setPlaying(playing);
      }
    },
    onReplay: () => {
      if (filmMode) return;
      mode = "demo";
      document.body.classList.add("is-demo");
      playing = true;
      controls.enabled = false;
      ui.setFreeMode(false);
      ui.setPlaying(true);
      ui.setView("overview");
      currentView = "overview";
      film.reset();
      film.seek(0);
      film.time = 0;
    },
    onSeek: (value) => {
      if (filmMode) return;
      mode = "demo";
      document.body.classList.add("is-demo");
      playing = false;
      controls.enabled = false;
      ui.setFreeMode(false);
      ui.setPlaying(false);
      film.seek(value);
      film.time = value;
      ui.setTime(value, FILM_DURATION);
    },
    onToggle: (key, value) => {
      if (key === "clouds") world.clouds.setEnabled(value);
      else if (key === "mist") world.mist.setEnabled(value);
      else if (key === "subtitles") {
        document.body.classList.toggle("subtitles-off", !value);
      } else if (key === "sound") {
        audio.setEnabled(value);
      }
    },
  });

  ui.setPlaying(true);
  ui.setView("overview");
  ui.setTime(0, FILM_DURATION);
  document.body.classList.add("is-demo");

  /* 初始机位（自由浏览 URL） --------------------------------------- */

  if (!filmMode) {
    const viewName = params.get("view");
    if (viewName === "ground") {
      const x = -1100;
      const z = 1400;
      mode = "free";
      playing = false;
      controls.enabled = true;
      camera.position.set(x, heightAt(x, z) + 8, z);
      controls.target.set(0, 1520, 0);
      controls.update();
      document.body.classList.remove("is-demo");
      ui.setFreeMode(true);
      ui.setPlaying(false);
      ui.setTime(0, FILM_DURATION);
    } else if (CAMERA_VIEWS[viewName]) {
      mode = "free";
      playing = false;
      controls.enabled = true;
      camera.position.fromArray(CAMERA_VIEWS[viewName].position);
      controls.target.fromArray(CAMERA_VIEWS[viewName].target);
      controls.update();
      currentView = viewName;
      document.body.classList.remove("is-demo");
      ui.setFreeMode(true);
      ui.setPlaying(false);
      ui.setView(viewName);
      ui.setTime(0, FILM_DURATION);
    }
  }

  /* 交互 ------------------------------------------------------------ */

  renderer.domElement.addEventListener("pointerdown", enterFreeMode);
  renderer.domElement.addEventListener("wheel", enterFreeMode, {
    passive: true,
  });

  window.addEventListener("keydown", (event) => {
    if (filmMode) return;
    if (event.code === "Space") {
      event.preventDefault();
      if (mode === "free") resumeDemo();
      else {
        playing = !playing;
        ui.setPlaying(playing);
      }
    } else if (event.code === "KeyR") {
      mode = "free";
      document.body.classList.remove("is-demo");
      playing = false;
      controls.enabled = true;
      ui.setFreeMode(true);
      ui.setPlaying(false);
      ui.setView("overview");
      currentView = "overview";
      flyTo(CAMERA_VIEWS.overview, 1.9);
    } else if (/^Digit[1-8]$/.test(event.code)) {
      const names = [
        "tongtian",
        "longshou",
        "luoxia",
        "fenghui",
        "dazhu",
        "xiaozhu",
        "chaoyang",
        "overview",
      ];
      const name = names[Number(event.code.slice(-1)) - 1];
      if (name) {
        mode = "free";
        playing = false;
        controls.enabled = true;
        document.body.classList.remove("is-demo");
        ui.setFreeMode(true);
        ui.setPlaying(false);
        setView(name);
        ui.setView(name);
      }
    }
  });

  /* 主循环 ---------------------------------------------------------- */

  const clock = new THREE.Clock();
  let shadowClock = 0;

  function updateFreeCamera(delta) {
    if (flight.active) {
      updateFlight(delta);
    } else {
      controls.update(delta);
      const ground = heightAt(camera.position.x, camera.position.z);
      if (camera.position.y < ground + 8) {
        camera.position.y = ground + 8;
        camera.lookAt(controls.target);
      }
    }

    shadowClock += delta;
    if (
      shadowClock > 0.6 ||
      controls.target.distanceToSquared(shadowFocus) > 150 * 150
    ) {
      shadowClock = 0;
      shadowFocus.copy(controls.target);
      world.setShadowFocus(shadowFocus, 1400);
    }
  }

  function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;

    if (mode === "demo") {
      if (playing) film.update(delta);
      else film.renderFrame(film.time);
      audio.update(film.time);
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
    controls.enabled = false;
    playing = !captureMode;
    film.seek(0);
    film.time = 0;

    const soundButton = document.getElementById("film-sound");
    if (soundButton) {
      soundButton.addEventListener("click", () => {
        const enabled = audio.toggle();
        soundButton.setAttribute("aria-pressed", String(enabled));
        soundButton.textContent = enabled ? "声音 · 开" : "声音 · 关";
      });
    }

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
          gradePass.uniforms.uTime.value = time;
          if (world.sunLight?.shadow) world.sunLight.shadow.needsUpdate = true;
        },
        reset: () => film.reset(),
      };
    } else {
      const filmClock = new THREE.Clock();
      renderer.setAnimationLoop(() => {
        const delta = Math.min(filmClock.getDelta(), 0.05);
        film.update(delta);
        audio.update(film.time);
        if (!loadingHidden) {
          loadingHidden = true;
          hideLoading();
        }
      });
    }
  } else {
    renderer.setAnimationLoop(animate);
  }

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
    ui,
    film,
    audio,
    filmMode,
    captureMode,
    bloomPass,
    gradePass,
    smaaPass,
    flyTo,
    flight,
    get mode() {
      return mode;
    },
    get playing() {
      return playing;
    },
    get currentView() {
      return currentView;
    },
    setView(position, target) {
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
    },
    setShadowFocus(point, extent = 1400) {
      shadowFocus.copy(point);
      world.setShadowFocus(shadowFocus, extent);
    },
    setDemo(time = 0) {
      mode = "demo";
      playing = true;
      document.body.classList.add("is-demo");
      controls.enabled = false;
      ui.setFreeMode(false);
      ui.setPlaying(true);
      film.seek(time);
      film.time = time;
    },
  };
}

try {
  bootstrap();
} catch (error) {
  console.error(error);
  showFallback();
}
