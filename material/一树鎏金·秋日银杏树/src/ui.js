/**
 * 界面绑定：机位、播放/重播、时间轴与开关。
 * 纯 DOM 层，不持有场景状态。
 */

function formatTime(seconds) {
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60);
  const rest = Math.floor(total % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function createUI({ onView, onPlayToggle, onReplay, onReset, onSeek, onToggle } = {}) {
  const viewButtons = [...document.querySelectorAll("[data-view]")];
  const playButton = document.querySelector('[data-action="play"]');
  const replayButton = document.querySelector('[data-action="replay"]');
  const resetButton = document.querySelector('[data-action="reset"]');
  const timeline = document.querySelector("[data-time]");
  const timeLabel = document.querySelector("[data-time-label]");
  const toggles = [...document.querySelectorAll("[data-toggle]")];

  for (const button of viewButtons) {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
      onView?.(button.dataset.view);
    });
  }

  playButton?.addEventListener("click", () => onPlayToggle?.());
  replayButton?.addEventListener("click", () => onReplay?.());
  resetButton?.addEventListener("click", () => onReset?.());

  timeline?.addEventListener("input", () => {
    onSeek?.(Number(timeline.value));
  });

  for (const toggle of toggles) {
    toggle.addEventListener("change", () => {
      onToggle?.(toggle.dataset.toggle, toggle.checked);
    });
  }

  function setPlaying(playing) {
    if (playButton) {
      playButton.textContent = playing ? "❚❚" : "▶";
      playButton.setAttribute("aria-label", playing ? "暂停" : "播放");
    }
  }

  function setTime(value, total = Number(timeline?.max ?? 30)) {
    if (timeline && document.activeElement !== timeline) {
      timeline.value = String(value);
    }
    if (timeline) {
      const progress = Math.min(100, Math.max(0, (value / Math.max(0.001, total)) * 100));
      timeline.style.setProperty("--progress", `${progress.toFixed(2)}%`);
    }
    if (timeLabel) {
      timeLabel.textContent = `${formatTime(value)} / ${formatTime(total)}`;
    }
  }

  function setFreeMode(free) {
    document.body.classList.toggle("is-free", Boolean(free));
  }

  function setView(name) {
    for (const button of viewButtons) {
      button.classList.toggle("is-active", button.dataset.view === name);
    }
  }

  function setToggle(key, value) {
    const toggle = toggles.find((item) => item.dataset.toggle === key);
    if (toggle) toggle.checked = Boolean(value);
  }

  return { setPlaying, setTime, setFreeMode, setView, setToggle };
}

export function hideLoading() {
  const loading = document.getElementById("loading");
  if (loading) loading.style.display = "none";
}

export function showFallback() {
  hideLoading();
  const fallback = document.getElementById("fallback");
  if (fallback) fallback.hidden = false;
}
