import * as THREE from "three";

/**
 * 影片模式时间线。
 *
 * 整支短片 28 秒、60 fps，共 4 个镜头：
 *   0.0 –  5.2  高空俯冲，交代 U 形江湾
 *   5.2 – 11.0  外滩立面低空横移
 *  11.0 – 22.0  陆家嘴四塔环绕，镜头内完成黄昏 → 夜景
 *  22.0 – 28.0  外滩夜色拉远，收尾
 *
 * 相机、昼夜状态与文字都由绝对时间 t 推导；渲染侧按 1/60 秒
 * 固定步长推进，因此每次导出结果一致。
 */

export const FILM_DURATION = 28;
export const FILM_FPS = 60;

const NIGHT_AT = 17.2;
const LOOP_HOLD = 0.8;

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const smoothstep = (a, b, value) => {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const fade = (t, inStart, inEnd, outStart, outEnd) =>
  Math.min(smoothstep(inStart, inEnd, t), 1 - smoothstep(outStart, outEnd, t));

const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

const lerp = THREE.MathUtils.lerp;

function collectOverlay() {
  const query = (key) => document.querySelector(`[data-film="${key}"]`);
  return {
    title: query("title"),
    bund: query("bund"),
    data: query("data"),
    night: query("night"),
    end: query("end"),
    fade: query("fade"),
    rows: Array.from(document.querySelectorAll("[data-metric]")),
  };
}

function setBlock(element, opacity, rise = 18) {
  if (!element) return;
  const value = clamp01(opacity);
  element.style.opacity = value.toFixed(4);
  element.style.transform = `translate3d(0, ${((1 - value) * rise).toFixed(2)}px, 0)`;
}

export function createFilm({
  camera,
  controls,
  scene,
  time,
  world,
  composer,
}) {
  const overlay = collectOverlay();
  const bund = scene.getObjectByName("TheBund");
  const buildings = bund
    ? bund.children.filter((child) => child.type === "Group")
    : [];

  const building = (index) =>
    buildings[Math.max(0, Math.min(buildings.length - 1, index))];

  /** 建筑临江立面正前方 dist 米、离地 y 米的机位与注视点。 */
  function front(index, dist, y) {
    const target = building(index);
    const faceX = Math.sin(target.rotation.y);
    const faceZ = Math.cos(target.rotation.y);
    return {
      position: new THREE.Vector3(
        target.position.x + faceX * dist,
        y,
        target.position.z + faceZ * dist,
      ),
      target: new THREE.Vector3(target.position.x, 22, target.position.z),
    };
  }

  const opening = {
    start: 0,
    end: 5.2,
    from: {
      position: new THREE.Vector3(-400, 2100, 3950),
      target: new THREE.Vector3(-250, 0, -1100),
    },
    to: {
      position: new THREE.Vector3(-290, 1350, 2750),
      target: new THREE.Vector3(-250, 30, -950),
    },
  };

  const bundGlide = {
    start: 5.2,
    end: 11.0,
    from: front(3, 320, 36),
    to: front(12, 300, 40),
  };

  const towerOrbit = {
    start: 11.0,
    end: 22.0,
    from: {
      position: new THREE.Vector3(-1050, 420, 330),
      target: new THREE.Vector3(-100, 300, -300),
    },
    to: {
      position: new THREE.Vector3(520, 560, 760),
      target: new THREE.Vector3(-100, 330, -300),
    },
  };

  const bundNight = {
    start: 22.0,
    end: FILM_DURATION,
    from: front(8, 280, 38),
    to: front(8, 460, 78),
  };

  const orbitA = {
    radius: Math.hypot(
      towerOrbit.from.position.x - towerOrbit.from.target.x,
      towerOrbit.from.position.z - towerOrbit.from.target.z,
    ),
    angle: Math.atan2(
      towerOrbit.from.position.x - towerOrbit.from.target.x,
      towerOrbit.from.position.z - towerOrbit.from.target.z,
    ),
  };
  const orbitB = {
    radius: Math.hypot(
      towerOrbit.to.position.x - towerOrbit.to.target.x,
      towerOrbit.to.position.z - towerOrbit.to.target.z,
    ),
    angle: Math.atan2(
      towerOrbit.to.position.x - towerOrbit.to.target.x,
      towerOrbit.to.position.z - towerOrbit.to.target.z,
    ),
  };

  const cameraPosition = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();

  function shotProgress(shot, t) {
    return clamp01((t - shot.start) / (shot.end - shot.start));
  }

  function sampleCamera(t) {
    if (t < opening.end) {
      const e = easeInOutSine(shotProgress(opening, t));
      cameraPosition.lerpVectors(opening.from.position, opening.to.position, e);
      cameraTarget.lerpVectors(opening.from.target, opening.to.target, e);
      return;
    }

    if (t < bundGlide.end) {
      const e = easeInOutSine(shotProgress(bundGlide, t));
      cameraPosition.lerpVectors(bundGlide.from.position, bundGlide.to.position, e);
      cameraTarget.lerpVectors(bundGlide.from.target, bundGlide.to.target, e);
      return;
    }

    if (t < towerOrbit.end) {
      const e = easeInOutSine(shotProgress(towerOrbit, t));
      const angle = lerp(orbitA.angle, orbitB.angle, e);
      const radius = lerp(orbitA.radius, orbitB.radius, e);
      cameraTarget.lerpVectors(towerOrbit.from.target, towerOrbit.to.target, e);
      cameraPosition.set(
        cameraTarget.x + Math.sin(angle) * radius,
        lerp(towerOrbit.from.position.y, towerOrbit.to.position.y, e),
        cameraTarget.z + Math.cos(angle) * radius,
      );
      return;
    }

    const e = easeInOutSine(shotProgress(bundNight, t));
    cameraPosition.lerpVectors(bundNight.from.position, bundNight.to.position, e);
    cameraTarget.lerpVectors(bundNight.from.target, bundNight.to.target, e);
  }

  function applyOverlay(t) {
    setBlock(overlay.title, fade(t, 0.9, 1.8, 4.4, 5.1), 22);
    setBlock(overlay.bund, fade(t, 6.0, 6.9, 10.2, 10.9), 16);
    setBlock(overlay.data, fade(t, 11.9, 12.6, 17.2, 17.9), 16);
    setBlock(overlay.night, fade(t, 19.6, 20.5, 21.3, 21.9), 16);
    setBlock(overlay.end, fade(t, 24.2, 25.3, 27.1, 27.8), 20);

    overlay.rows.forEach((row, index) => {
      const start = 12.2 + index * 0.42;
      setBlock(row, fade(t, start, start + 0.5, 17.1, 17.7), 10);
    });

    if (overlay.fade) {
      const fadeIn = 1 - smoothstep(0, 0.75, t);
      const fadeOut = smoothstep(27.15, 28.0, t);
      const value = Math.max(fadeIn, fadeOut);
      overlay.fade.style.opacity = value.toFixed(4);
    }
  }

  let lastT = -1;
  let nightTriggered = false;
  let clock = 0;

  function reset() {
    time.setImmediate("dusk");
    nightTriggered = false;
    lastT = -1;
    overlay.rows.forEach((row) => setBlock(row, 0, 10));
  }

  function renderFrame(t) {
    const filmTime = Math.min(Math.max(t, 0), FILM_DURATION);

    if (lastT < 0 || filmTime < lastT - 1e-6) reset();

    const delta =
      lastT < 0 ? 0 : Math.min(Math.max(filmTime - lastT, 0), 0.05);

    if (filmTime >= NIGHT_AT && !nightTriggered) {
      time.setPreset("night");
      nightTriggered = true;
    }

    time.update(delta);
    sampleCamera(filmTime);

    camera.position.copy(cameraPosition);
    controls.target.copy(cameraTarget);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();

    world.update(delta, filmTime, time.state);
    composer.render();
    applyOverlay(filmTime);

    lastT = filmTime;
  }

  function update(delta) {
    clock += Math.min(Math.max(delta, 0), 0.1);
    if (clock >= FILM_DURATION + LOOP_HOLD) {
      clock = 0;
      reset();
    }
    renderFrame(Math.min(clock, FILM_DURATION));
  }

  // 初始机位，避免第一帧之前相机停在旧位置。
  sampleCamera(0);
  camera.position.copy(cameraPosition);
  controls.target.copy(cameraTarget);
  camera.lookAt(cameraTarget);

  return {
    duration: FILM_DURATION,
    fps: FILM_FPS,
    nightAt: NIGHT_AT,
    reset,
    renderFrame,
    update,
  };
}
