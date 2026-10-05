(() => {
  const panel = document.querySelector("[data-live-panel]");
  if (!panel) return;
  const values = {
    flow: { orders: ["248", "251", "244", "257"], clarity: ["96%", "97%", "95%", "98%"], response: ["1.4s", "1.2s", "1.5s", "1.1s"] },
    clarity: { orders: ["238", "246", "252", "249"], clarity: ["98%", "99%", "97%", "98%"], response: ["1.1s", "1.0s", "1.2s", "1.1s"] },
    signal: { orders: ["261", "268", "264", "271"], clarity: ["94%", "96%", "95%", "97%"], response: ["1.6s", "1.3s", "1.4s", "1.2s"] }
  };
  let mode = "flow";
  let tick = 0;
  let timer = 0;
  const update = () => {
    const data = values[mode];
    ["orders", "clarity", "response"].forEach((key, index) => {
      const value = data[key][tick % data[key].length];
      const node = panel.querySelector(`[data-live-value="${key}"]`);
      const bar = panel.querySelector(`[data-live-bar="${key}"]`);
      if (node) node.textContent = value;
      if (bar) bar.style.transform = `scaleX(${key === "response" ? Math.max(.45, 1 - parseFloat(value) / 4) : parseFloat(value) / (key === "orders" ? 300 : 100)})`;
    });
    const sync = panel.querySelector("[data-live-sync]");
    if (sync) sync.textContent = `SYNC ${new Date().toLocaleTimeString([], { hour12: false })}`;
    tick += 1;
  };
  const start = () => { if (!timer && !document.hidden) { update(); timer = window.setInterval(update, 1800); } };
  const stop = () => { window.clearInterval(timer); timer = 0; };
  panel.querySelectorAll("[data-live-mode]").forEach((button) => button.addEventListener("click", () => {
    mode = button.dataset.liveMode;
    panel.querySelectorAll("[data-live-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
    update();
  }));
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  start();
})();
