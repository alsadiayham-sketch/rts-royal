const paths = Object.freeze({
  coffee: "M4 7h12v8a5 5 0 0 1-12 0V7Zm12 2h2a3 3 0 0 1 0 6h-2M6 3v2m4-2v2m4-2v2M3 21h14",
  utensils: "M7 3v8m-3-8v5a3 3 0 0 0 6 0V3m-3 5v13m8-18v8m0 0v10m0-10a3 3 0 0 1 3-3V3",
  bread: "M5 20h14a2 2 0 0 0 2-2v-5a6 6 0 0 0-11-4 5 5 0 0 0-7 5v4a2 2 0 0 0 2 2Zm3-7h.01M12 7h.01M16 10h.01",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z",
  heart: "M20.8 8.6C20.8 15 12 20.5 12 20.5S3.2 15 3.2 8.6A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.8 1.6Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3.5 2",
  pin: "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Zm-8 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  phone: "M7 3h3l1.5 4-2 1.5a14 14 0 0 0 6 6l1.5-2L20 14v3c0 1.1-.9 2-2 2C10.3 19 5 13.7 5 6c0-1.1.9-2 2-2Z",
  leaf: "M20 4C10 4 4 8.5 4 15c0 2.5 1.7 5 4 5 6.5 0 10-7 12-16Zm-15 16c3-4 6-6 11-8",
  sparkles: "m12 3 .9 3.1L16 7l-3.1.9L12 11l-.9-3.1L8 7l3.1-.9L12 3Zm6 9 .6 2.4L21 15l-2.4.6L18 18l-.6-2.4L15 15l2.4-.6L18 12ZM6 14l.9 3.1L10 18l-3.1.9L6 22l-.9-3.1L2 18l3.1-.9L6 14Z",
});

export const ICONS = Object.freeze(Object.keys(paths));

export function iconSvg(name, label = "") {
  const path = paths[ICONS.includes(name) ? name : "sparkles"];
  const title = label ? `<title>${escapeHtml(label)}</title>` : "";
  return `<svg viewBox="0 0 24 24" aria-hidden="${label ? "false" : "true"}" role="img" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${title}<path d="${path}"/></svg>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}
