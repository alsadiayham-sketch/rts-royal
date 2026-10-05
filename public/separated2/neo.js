(() => {
  const root = document.documentElement;
  const modes = {
    observe: {
      status: { en: "Observation mode / systems are calm", ar: "وضع المراقبة / الأنظمة هادئة" },
      time: 12,
      pulse: "rgba(102,220,255,.22)"
    },
    align: {
      status: { en: "Alignment mode / work is finding its rhythm", ar: "وضع التنسيق / العمل يجد إيقاعه" },
      time: 18,
      pulse: "rgba(168,117,255,.24)"
    },
    move: {
      status: { en: "Momentum mode / the next move is ready", ar: "وضع الزخم / الخطوة التالية جاهزة" },
      time: 24,
      pulse: "rgba(255,143,202,.24)"
    }
  };
  let mode = "observe";
  let seconds = 0;
  const status = document.querySelector("[data-neo-status]");
  const time = document.querySelector("[data-neo-time]");
  const buttons = document.querySelectorAll("[data-neo-mode]");
  const updateMode = (next) => {
    mode = modes[next] ? next : "observe";
    buttons.forEach((button) => button.classList.toggle("is-active", button.dataset.neoMode === mode));
    if (status) {
      const copy = modes[mode].status;
      status.dataset.en = copy.en;
      status.dataset.ar = copy.ar;
      status.textContent = root.lang === "ar" ? copy.ar : copy.en;
    }
    root.style.setProperty("--mode-pulse", modes[mode].pulse);
  };
  buttons.forEach((button) => button.addEventListener("click", () => updateMode(button.dataset.neoMode)));
  window.setInterval(() => {
    seconds += 1;
    const total = modes[mode].time + seconds;
    if (time) time.textContent = `00:${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }, 1000);
  window.addEventListener("pointermove", (event) => {
    root.style.setProperty("--pointer-x", `${event.clientX}px`);
    root.style.setProperty("--pointer-y", `${event.clientY}px`);
  }, { passive: true });
  updateMode(mode);
})();
