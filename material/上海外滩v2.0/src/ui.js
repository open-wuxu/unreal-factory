/**
 * 界面绑定：时间切换、地标导航、自动环绕、重置视角。
 */
export function createUI({
  onTimeChange,
  onLandmark,
  onToggleOrbit,
  onResetView,
}) {
  const timeButtons = Array.from(document.querySelectorAll("[data-time]"));
  const landmarkButtons = Array.from(
    document.querySelectorAll("[data-landmark]"),
  );
  const orbitButton = document.getElementById("orbit-toggle");
  const resetButton = document.getElementById("reset-view");

  let orbitEnabled = true;

  function setTime(name) {
    for (const button of timeButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.time === name),
      );
    }
  }

  function setLandmark(name) {
    for (const button of landmarkButtons) {
      button.classList.toggle(
        "is-active",
        name != null && button.dataset.landmark === name,
      );
    }
  }

  function setOrbit(enabled) {
    orbitEnabled = enabled;
    orbitButton.setAttribute("aria-pressed", String(enabled));
  }

  for (const button of timeButtons) {
    button.addEventListener("click", () => {
      onTimeChange(button.dataset.time);
      setTime(button.dataset.time);
    });
  }

  for (const button of landmarkButtons) {
    button.addEventListener("click", () => {
      const name = button.dataset.landmark;
      setLandmark(name);
      onLandmark(name);
    });
  }

  orbitButton.addEventListener("click", () => {
    orbitEnabled = !orbitEnabled;
    setOrbit(orbitEnabled);
    onToggleOrbit(orbitEnabled);
  });

  resetButton.addEventListener("click", () => {
    setLandmark("overview");
    onResetView();
  });

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "1") {
      onTimeChange("day");
      setTime("day");
    } else if (key === "2") {
      onTimeChange("dusk");
      setTime("dusk");
    } else if (key === "3") {
      onTimeChange("night");
      setTime("night");
    } else if (key === " ") {
      event.preventDefault();
      orbitEnabled = !orbitEnabled;
      setOrbit(orbitEnabled);
      onToggleOrbit(orbitEnabled);
    } else if (key === "r") {
      setLandmark("overview");
      onResetView();
    }
  });

  return { setTime, setLandmark, setOrbit };
}

/* ------------------------------------------------------------------ */
/* 加载 / 回退                                                         */
/* ------------------------------------------------------------------ */

const loading = document.getElementById("loading");
const loadingProgress = document.getElementById("loading-progress");
const fallback = document.getElementById("fallback");

export function setLoadingProgress(value) {
  if (loadingProgress) {
    loadingProgress.style.width = `${Math.round(value * 100)}%`;
  }
}

export function hideLoading() {
  setLoadingProgress(1);
  window.setTimeout(() => {
    loading?.classList.add("is-done");
  }, 260);
}

export function showFallback() {
  if (fallback) fallback.hidden = false;
  loading?.classList.add("is-done");
}
