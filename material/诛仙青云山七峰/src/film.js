import * as THREE from "three";
import {
  FILM_DURATION,
  FILM_FPS,
  blackOpacityAt,
  sampleFilmCamera,
  subtitleAt,
  titleOpacityAt,
  transitionOpacityAt,
} from "./filmTimeline.js";

/**
 * 影片播放器：机位、光照、云、植被、水体与字幕都由绝对时间推导。
 * 场景状态不使用随机累积，因此拖动时间轴可精确重放。
 */

const LOOP_HOLD = 0.8;

function collectOverlay() {
  const query = (key) => document.querySelector(`[data-film="${key}"]`);
  return {
    fade: query("fade"),
    wipe: query("wipe"),
    subtitle: query("subtitle"),
    title: query("title"),
  };
}

export function createFilm({
  camera,
  controls,
  world,
  composer,
  onBeforeFrame,
} = {}) {
  const overlay = collectOverlay();
  const position = new THREE.Vector3();
  const target = new THREE.Vector3();
  let clock = 0;
  let lastTime = -1;

  function renderFrame(time) {
    const t = Math.min(Math.max(time, 0), FILM_DURATION);
    sampleFilmCamera(t, position, target);
    camera.position.copy(position);
    controls.target.copy(target);
    camera.lookAt(target);
    camera.updateMatrixWorld();

    world.setTime(t);
    world.setShadowFocus(target, 1400);
    onBeforeFrame?.(t);
    world.update(1 / FILM_FPS, t, { time: t, wind: 1 });

    if (composer) composer.render();
    applyOverlay(t);
    lastTime = t;
  }

  function applyOverlay(time) {
    const subtitle = subtitleAt(time);
    if (overlay.subtitle) {
      overlay.subtitle.textContent = subtitle.text;
      overlay.subtitle.style.opacity = subtitle.opacity.toFixed(4);
      overlay.subtitle.style.transform = `translate(-50%, ${(
        (1 - subtitle.opacity) *
        14
      ).toFixed(2)}px)`;
    }
    if (overlay.title) {
      overlay.title.style.opacity = titleOpacityAt(time).toFixed(4);
    }
    if (overlay.wipe) {
      overlay.wipe.style.opacity = transitionOpacityAt(time).toFixed(4);
    }
    if (overlay.fade) {
      overlay.fade.style.opacity = blackOpacityAt(time).toFixed(4);
    }
  }

  function update(delta) {
    clock += Math.min(Math.max(delta, 0), 0.1);
    if (clock >= FILM_DURATION + LOOP_HOLD) {
      clock = 0;
      lastTime = -1;
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
