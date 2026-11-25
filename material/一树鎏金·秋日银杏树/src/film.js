import * as THREE from "three";
import {
  FILM_DURATION,
  FILM_FPS,
  cutFlashAt,
  sampleFilmCamera,
  startFadeAt,
  titleOpacityAt,
} from "./filmTimeline.js";

/**
 * 影片播放器。
 *
 * 摄影机、焦点、风动、飘落叶与覆盖层全部由绝对时间推导；
 * 场景中没有「上一帧累积」的状态，因此可以任意跳转与逐帧导出。
 */

const LOOP_HOLD = 1.0;

function collectOverlay() {
  const query = (key) => document.querySelector(`[data-film="${key}"]`);
  return {
    fade: query("fade"),
    flash: query("flash"),
    title: query("title"),
  };
}

export function createFilm({
  camera,
  controls,
  world,
  composer,
  bokehPass,
  gradePass,
  onBeforeFrame,
} = {}) {
  const overlay = collectOverlay();
  const position = new THREE.Vector3();
  const target = new THREE.Vector3();
  let clock = 0;
  let lastTime = -1;
  let titleEnabled = true;

  function renderFrame(time) {
    const t = Math.min(Math.max(time, 0), FILM_DURATION);
    const meta = sampleFilmCamera(t, position, target);

    camera.position.copy(position);
    controls.target.copy(target);
    camera.lookAt(target);

    const fov = meta.fov;
    if (Math.abs(camera.fov - fov) > 0.0005) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();

    world.setTime(t);
    world.update(1 / FILM_FPS, t, { time: t, wind: meta.wind });
    world.sunLight.shadow.needsUpdate = true;

    // 树干特写时启用摄影机侧柔光，照亮树皮细节
    if (world.detailLight) {
      const isBarkShot = meta.shot.id === "bark";
      world.detailLight.position.copy(camera.position);
      world.detailLight.target.position.copy(target);
      world.detailLight.target.updateMatrixWorld();
      world.detailLight.intensity = isBarkShot ? 85 : 0;
    }

    if (bokehPass) {
      const focus = Math.max(0.2, camera.position.distanceTo(target));
      bokehPass.uniforms.focus.value = focus;
      bokehPass.uniforms.aperture.value = meta.dof.aperture;
      bokehPass.uniforms.maxblur.value = meta.dof.maxblur;
    }
    if (gradePass) gradePass.uniforms.uTime.value = t;

    onBeforeFrame?.(t, meta);
    if (composer) composer.render();
    applyOverlay(t);
    lastTime = t;
  }

  function applyOverlay(time) {
    if (overlay.flash) {
      overlay.flash.style.opacity = cutFlashAt(time).toFixed(4);
    }
    if (overlay.fade) {
      overlay.fade.style.opacity = startFadeAt(time).toFixed(4);
    }
    if (overlay.title) {
      const opacity = titleEnabled ? titleOpacityAt(time) : 0;
      overlay.title.style.opacity = opacity.toFixed(4);
      overlay.title.style.transform = `translate(-50%, ${((1 - opacity) * 12).toFixed(2)}px)`;
    }
  }

  function update(delta) {
    clock += Math.min(Math.max(delta, 0), 0.1);
    if (clock >= FILM_DURATION + LOOP_HOLD) {
      clock = 0;
    }
    renderFrame(Math.min(clock, FILM_DURATION));
    return clock;
  }

  function seek(time) {
    clock = Math.min(Math.max(time, 0), FILM_DURATION);
    renderFrame(clock);
  }

  function reset() {
    clock = 0;
    lastTime = -1;
  }

  renderFrame(0);

  return {
    duration: FILM_DURATION,
    fps: FILM_FPS,
    update,
    seek,
    reset,
    renderFrame,
    applyOverlay,
    setTitleEnabled(value) {
      titleEnabled = Boolean(value);
    },
    get titleEnabled() {
      return titleEnabled;
    },
    get time() {
      return clock;
    },
    set time(value) {
      clock = Math.min(Math.max(value, 0), FILM_DURATION);
    },
    get lastTime() {
      return lastTime;
    },
  };
}
