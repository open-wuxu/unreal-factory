import * as THREE from "three";

/**
 * 40 秒影片时间线。
 *
 * 五个镜头：
 *   0.0 –  7.0  月落江天：高空俯视，月亮压在天际线上
 *   7.0 – 16.0  江枫渔火：沿江岸下降，掠过枫树与渔船，靠近客船
 *  16.0 – 26.0  寒山古寺：从客船望向对岸，寺院自雾中显形
 *  26.0 – 35.0  夜半钟声：钟楼特写，撞钟与声波越过江面
 *  35.0 – 40.0  诗意收尾：回到客船，拉远，完整诗篇
 *
 * 相机位置与注视点都用按时间参数化的 Catmull-Rom 插值，
 * 既经过每个关键机位，又保持速度连续。
 */

export const FILM_DURATION = 40;
export const FILM_FPS = 60;
const LOOP_HOLD = 1.0;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smoothstep = (a, b, value) => {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const fade = (t, inStart, inEnd, outStart, outEnd) =>
  Math.min(smoothstep(inStart, inEnd, t), 1 - smoothstep(outStart, outEnd, t));

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const KEYS = [
  { t: 0.0, position: V(106, 68, 138), target: V(-8, 26, -42) },
  { t: 4.0, position: V(78, 45, 110), target: V(-9, 20, -34) },
  { t: 7.0, position: V(44, 22, 78), target: V(-16, 12, -18) },
  { t: 9.0, position: V(30, 22, 55), target: V(-34, 10, 12) },
  { t: 10.5, position: V(8, 22, 38), target: V(-44, 10, 16) },
  { t: 12.5, position: V(2, 14, 30), target: V(-10, 6, 22) },
  { t: 14.5, position: V(7, 6.5, 31), target: V(14, 2.2, 23) },
  { t: 16.0, position: V(10, 3.4, 30), target: V(14, 1.8, 23) },
  { t: 20.0, position: V(18, 6.4, 26), target: V(30, 8, -50) },
  { t: 24.0, position: V(14, 8.6, 26), target: V(40, 13, -100) },
  { t: 26.0, position: V(12, 10.5, 14), target: V(47, 15, -114) },
  { t: 29.0, position: V(20, 14.0, -8), target: V(53, 16.5, -124) },
  { t: 32.0, position: V(36, 16.0, -38), target: V(54, 17, -126) },
  { t: 34.0, position: V(44, 17.0, -58), target: V(54, 17, -126) },
  { t: 34.6, position: V(46, 17.0, -64), target: V(54, 17, -126) },
];

/**
 * 35 秒处落到客船的镜头。它与上一段之间隔着一个短暂的
 * 黑场（见 applyOverlay），因此这里是一次干净的切镜，
 * 而不是让相机跨越整条江面。
 */
const FINALE_KEYS = [
  { t: 35.0, position: V(26, 6.5, 28), target: V(16, 3, 16) },
  { t: 37.5, position: V(30, 8.0, 31), target: V(16, 3, 12) },
  { t: 38.5, position: V(46, 15.0, 30), target: V(8, 6, -10) },
  { t: 39.5, position: V(62, 27.0, 50), target: V(2, 8, -28) },
  { t: 40.0, position: V(78, 37.0, 90), target: V(-2, 8, -40) },
];

function catmullRom(p0, p1, p2, p3, u) {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  );
}

function sampleKeys(keys, time, field) {
  const t = Math.min(Math.max(time, keys[0].t), keys[keys.length - 1].t);

  let index = 0;
  while (index < keys.length - 2 && t > keys[index + 1].t) index++;

  const k1 = keys[index];
  const k2 = keys[index + 1];
  const k0 = keys[Math.max(0, index - 1)];
  const k3 = keys[Math.min(keys.length - 1, index + 2)];
  const span = Math.max(0.0001, k2.t - k1.t);
  const u = clamp01((t - k1.t) / span);

  return new THREE.Vector3(
    catmullRom(k0[field].x, k1[field].x, k2[field].x, k3[field].x, u),
    catmullRom(k0[field].y, k1[field].y, k2[field].y, k3[field].y, u),
    catmullRom(k0[field].z, k1[field].z, k2[field].z, k3[field].z, u),
  );
}

function collectOverlay() {
  const query = (key) => document.querySelector(`[data-film="${key}"]`);
  return {
    intro: query("intro"),
    line1: query("line1"),
    line2: query("line2"),
    line3: query("line3"),
    line4: query("line4"),
    end: query("end"),
    fade: query("fade"),
  };
}

function setBlock(element, opacity, rise = 18) {
  if (!element) return;
  const value = clamp01(opacity);
  element.style.opacity = value.toFixed(4);
  element.style.transform = `translate3d(0, ${((1 - value) * rise).toFixed(2)}px, 0)`;
}

export function createFilm({ camera, controls, world, composer, beforeRender }) {
  const overlay = collectOverlay();

  const cameraPosition = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();

  function sampleCamera(time) {
    const keys = time >= 35 ? FINALE_KEYS : KEYS;
    cameraPosition.copy(sampleKeys(keys, time, "position"));
    cameraTarget.copy(sampleKeys(keys, time, "target"));
  }

  function applyOverlay(time) {
    setBlock(overlay.intro, fade(time, 0.4, 1.5, 4.2, 5.0), 14);
    setBlock(overlay.line1, fade(time, 1.3, 2.2, 6.2, 6.9), 16);
    setBlock(overlay.line2, fade(time, 8.0, 8.9, 14.9, 15.6), 16);
    setBlock(overlay.line3, fade(time, 17.0, 17.9, 24.9, 25.6), 16);
    setBlock(overlay.line4, fade(time, 26.7, 27.6, 34.2, 35.0), 16);
    setBlock(overlay.end, fade(time, 36.1, 37.2, 39.2, 39.9), 20);

    if (overlay.fade) {
      const fadeIn = 1 - smoothstep(0, 0.9, time);
      const fadeOut = smoothstep(39.0, 40.0, time);
      // 34.6 – 35.4 的短暂黑场，遮住钟楼到客船的切镜
      const dip = Math.max(0, 1 - Math.abs(time - 35) / 0.5) * 0.96;
      overlay.fade.style.opacity = Math.max(fadeIn, fadeOut, dip).toFixed(4);
    }
  }

  let lastTime = -1;
  let clock = 0;

  function reset() {
    lastTime = -1;
    world.temple?.reset?.();
  }

  function renderFrame(time) {
    const filmTime = Math.min(Math.max(time, 0), FILM_DURATION);

    if (lastTime < 0 || filmTime < lastTime - 1e-6) reset();
    const delta =
      lastTime < 0 ? 1 / FILM_FPS : Math.min(Math.max(filmTime - lastTime, 0), 0.05);

    sampleCamera(filmTime);
    camera.position.copy(cameraPosition);
    controls.target.copy(cameraTarget);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();

    // 让景深等依赖当前机位的后处理在渲染前拿到最新焦点
    beforeRender?.();

    world.update(delta, filmTime, {
      time: filmTime,
      filmTime,
      mistDensity: 1,
      frostDensity: 1,
    });

    if (composer) composer.render();
    applyOverlay(filmTime);
    lastTime = filmTime;
  }

  function update(delta) {
    clock += Math.min(Math.max(delta, 0), 0.1);
    if (clock >= FILM_DURATION + LOOP_HOLD) {
      clock = 0;
      reset();
    }
    renderFrame(Math.min(clock, FILM_DURATION));
  }

  function seek(time) {
    clock = Math.min(Math.max(time, 0), FILM_DURATION);
    renderFrame(clock);
  }

  sampleCamera(0);
  camera.position.copy(cameraPosition);
  controls.target.copy(cameraTarget);
  camera.lookAt(cameraTarget);

  return {
    duration: FILM_DURATION,
    fps: FILM_FPS,
    keys: KEYS,
    finaleKeys: FINALE_KEYS,
    reset,
    seek,
    renderFrame,
    update,
    get time() {
      return clock;
    },
    set time(value) {
      clock = Math.min(Math.max(value, 0), FILM_DURATION);
    },
    applyOverlay,
  };
}
