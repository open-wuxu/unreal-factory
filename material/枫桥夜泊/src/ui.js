/**
 * 交互界面绑定。
 *
 * 所有按钮通过 id / data-* 属性绑定，主循环只负责把状态推回这里。
 */

export function setLoadingProgress(value) {
  const bar = document.getElementById("loading-progress");
  if (bar) bar.style.width = `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

export function hideLoading() {
  const loading = document.getElementById("loading");
  if (!loading) return;
  loading.classList.add("is-hidden");
  window.setTimeout(() => {
    loading.style.display = "none";
  }, 1000);
}

export function showFallback() {
  const fallback = document.getElementById("fallback");
  if (fallback) fallback.hidden = false;
  const loading = document.getElementById("loading");
  if (loading) loading.style.display = "none";
}

function formatTime(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function createUI({
  onPlayToggle,
  onReplay,
  onSeek,
  onView,
  onReset,
  onToggleMist,
  onToggleSubtitles,
  onToggleSound,
}) {
  const play = document.getElementById("play");
  const playLabel = document.getElementById("play-label");
  const replay = document.getElementById("replay");
  const timeline = document.getElementById("timeline");
  const timeLabel = document.getElementById("time-label");
  const resetView = document.getElementById("reset-view");
  const viewButtons = Array.from(document.querySelectorAll("[data-view]"));
  const toggles = Array.from(document.querySelectorAll("[data-toggle]"));

  let scrubbing = false;

  play?.addEventListener("click", () => onPlayToggle?.());
  replay?.addEventListener("click", () => onReplay?.());
  resetView?.addEventListener("click", () => onReset?.());

  timeline?.addEventListener("pointerdown", () => {
    scrubbing = true;
  });
  timeline?.addEventListener("pointerup", () => {
    scrubbing = false;
  });
  timeline?.addEventListener("input", () => {
    const value = Number(timeline.value);
    updateTimeline(value, Number(timeline.max));
    onSeek?.(value);
  });
  window.addEventListener("pointerup", () => {
    scrubbing = false;
  });

  for (const button of viewButtons) {
    button.addEventListener("click", () => onView?.(button.dataset.view));
  }

  for (const button of toggles) {
    button.addEventListener("click", () => {
      const name = button.dataset.toggle;
      const next = button.getAttribute("aria-pressed") !== "true";
      if (name === "mist") {
        onToggleMist?.(next);
        setToggle("mist", next);
      } else if (name === "subtitles") {
        onToggleSubtitles?.(next);
        setToggle("subtitles", next);
      } else if (name === "sound") {
        const result = onToggleSound?.(next);
        setToggle("sound", typeof result === "boolean" ? result : next);
      }
    });
  }

  function setToggle(name, value) {
    const button = toggles.find((item) => item.dataset.toggle === name);
    if (button) button.setAttribute("aria-pressed", String(Boolean(value)));
  }

  function updateTimeline(value, max) {
    if (timeline) {
      if (!scrubbing) timeline.value = String(value);
      const progress = max > 0 ? `${(value / max) * 100}%` : "0%";
      timeline.style.setProperty("--progress", progress);
    }
    if (timeLabel) timeLabel.textContent = `${formatTime(value)} / ${formatTime(max)}`;
  }

  function setPlaying(value) {
    const playing = Boolean(value);
    document.body.classList.toggle("is-paused", !playing);
    play?.setAttribute("aria-pressed", String(playing));
    if (playLabel) playLabel.textContent = playing ? "暂停" : "播放";
  }

  function setView(name) {
    for (const button of viewButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.view === name));
    }
  }

  function setTime(value, duration) {
    updateTimeline(value, duration);
  }

  function setFreeMode(value) {
    document.body.classList.toggle("free-mode", Boolean(value));
  }

  setPlaying(true);
  setToggle("mist", true);
  setToggle("subtitles", true);
  setToggle("sound", false);
  updateTimeline(0, 40);

  return {
    setPlaying,
    setTime,
    setView,
    setFreeMode,
    setToggle,
    setMist: (value) => setToggle("mist", value),
    setSubtitles: (value) => setToggle("subtitles", value),
    setSound: (value) => setToggle("sound", value),
  };
}
