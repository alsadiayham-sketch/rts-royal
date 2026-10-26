import { customerPageUrl } from "./links.js";
import { ICONS } from "./jahiz-icons.js";
import {
  MAX_BLOCKS, combineCustomFiles, customFilesError, exportTemplate,
  imageFileError, importTemplate, normalizeBranding,
} from "./jahiz-designer.js";
import { applyCustomerTheme, blockIcon } from "./jahiz-render.js";

const API = "/api/jahiz";
const state = {
  lang: localStorage.getItem("jahiz-language") === "en" ? "en" : "ar",
  session: null, venue: null, orders: [], brand: null, tab: "orders", poll: null,
  pollDelay: 5000, order: null, wake: null, notified: false, dirty: false, savedBrand: null,
};
const copy = {
  ar: {
    network: "تعذر الاتصال. تحقق من الشبكة وحاول مجدداً.", required: "أكمل الحقول المطلوبة بشكل صحيح.",
    saved: "تم حفظ صفحة العميل.", loading: "جارٍ التحميل…", loginFailed: "تعذر تسجيل الدخول. تحقق من البيانات.",
    loggedOut: "تم تسجيل الخروج.", orders: "الطلبات", newOrder: "طلب جديد", number: "رقم الطلب",
    pickupCode: "رمز الاستلام", pickupHelp: "رمز من 12 حرفاً أو رقماً يقدمه فريق المنشأة.",
    minutes: "دقائق تقديرية", add: "إضافة الطلب", waiting: "في الانتظار", ready: "جاهز", done: "مكتمل",
    cancelled: "ملغي", estimate: "تعديل الوقت", empty: "لا توجد طلبات نشطة الآن.",
    brand: "مصمم صفحة العميل", qr: "QR والطباعة", staff: "الفريق", account: "الفوترة والحساب",
    save: "حفظ ونشر", remove: "حذف", edit: "تعديل", hide: "إخفاء", show: "إظهار", up: "للأعلى",
    down: "للأسفل", addBlock: "إضافة قسم", preview: "معاينة مباشرة", staffOnly: "هذه الإعدادات متاحة للمالك فقط.",
    paymentOff: "الدفع الإلكتروني غير مهيأ", joinTitle: "انضم إلى قائمة الانتظار",
    joinHelp: "أدخل رقم الإيصال ورمز الاستلام الخاص الذي يقدمه لك فريق المنشأة.", join: "متابعة طلبي",
    notFound: "لم نعثر على منشأة بهذه البيانات.", orderError: "تعذر العثور على إيصال المتابعة. تحقق من الرابط.",
    keepOpen: "أبقِ هذه الصفحة مفتوحة لتتلقى التحديثات. لا تتوفر إشعارات دفع في هذه الخدمة.",
    enableAlert: "تفعيل التنبيه الصوتي والاهتزاز", alertOn: "تم تفعيل التنبيه لهذه الجلسة.",
    review: "قيّم تجربتك",     receipt: "إيصال المتابعة", receiptNumber: "رقم الإيصال", privateCode: "رمز الاستلام الخاص",
    privateCodeHelp: "12 حرفاً أو رقماً · تم التحقق منه عند الانضمام", tracking: "متابعة الطلب",
    trackingEyebrow: "صفحتك الخاصة للمتابعة", trackingPromise: "حالة الطلب وتقدير الجاهزية في مكان واحد.",
    stepWaiting: "قيد الانتظار", stepReady: "جاهز للاستلام", stepDone: "مكتمل",
    stepCancelled: "ملغي", estimateLabel: "التقدير الحالي", statusLabel: "حالة الطلب",
    countdownLabel: "الوقت المتبقي التقريبي", errorAlert: "تعذر إكمال المتابعة. راجع البيانات وحاول مجدداً.",
    skipTracking: "تخطي إلى متابعة الطلب", skipStatus: "تخطي إلى حالة الطلب", footer: "Jahiz جاهز · RTS",
    timeUnknown: "الوقت قيد التحديث", demo: "منشأة تجريبية",
    print: "طباعة / حفظ PDF", downloadPng: "تنزيل PNG عالي الدقة", downloadSvg: "تنزيل SVG",
    copyLink: "نسخ الرابط", copyTrackingLink: "نسخ رابط متابعة العميل", password: "كلمة المرور",
    currentPassword: "كلمة المرور الحالية", newPassword: "كلمة مرور جديدة", changePassword: "تغيير كلمة المرور",
    staffName: "اسم الموظف", staffUsername: "اسم المستخدم", staffPassword: "كلمة مرور مؤقتة",
    addStaff: "إضافة موظف", plan: "الخطة", expires: "تنتهي", history: "سجل المدفوعات",
    noHistory: "لا يوجد سجل دفع متاح.", brandColor: "اللون الأساسي", background: "لون الخلفية",
    text: "لون النص", welcome: "رسالة الترحيب", readyText: "رسالة الجاهزية", reviewUrl: "رابط التقييم",
    logo: "الشعار", blocks: "أقسام الصفحة", trackingLocked: "قسم تتبع الطلب مطلوب دائماً.",
    imageSafety: "صور PNG أو JPEG أو WebP فقط، حتى 200 كيلوبايت.", applicationSent: "تم إرسال طلبك للمراجعة.",
    tenant: "المنشأة", customerLink: "رابط العميل", designer: "المصمم", content: "المحتوى",
    appearance: "المظهر", imported: "تصميم مخصص", desktop: "سطح المكتب", mobile: "هاتف",
    export: "تصدير JSON", import: "استيراد JSON", preset: "أنماط جاهزة", cafe: "مقهى هادئ",
    kitchen: "مطبخ عملي", minimal: "الحد الأدنى", discard: "لديك تغييرات غير محفوظة. هل تريد تجاهلها؟",
    uploadHtml: "رفع HTML وCSS", htmlHelp: "يُقبل HTML وCSS فقط (حتى 200 كيلوبايت معاً). لا نصوص برمجية ولا نماذج ولا CSS خارجي.",
    pendingUpload: "سيظهر التصميم المستورد للعميل بعد حفظ الصفحة ونشره.", customWarning: "يتم تنظيف HTML عند الحفظ؛ لا يتم دعم النصوص البرمجية أو النماذج أو CSS الخارجي، وقد تختلف النتيجة عن الملف الأصلي.",
    customHeight: "ارتفاع التصميم المخصص",
    openCustomer: "فتح صفحة العميل", layout: "التخطيط", spacing: "المسافة", radius: "الحواف", align: "المحاذاة",
    font: "الخط", backgroundImage: "صورة الخلفية", backgroundMode: "نمط الخلفية", surfaceColor: "سطح المحتوى",
    icon: "أيقونة", caption: "تسمية", clear: "إزالة", savedOpen: "تم الحفظ. افتح صفحة العميل للتأكد من النتيجة.",
  },
  en: {
    network: "We could not connect. Check your network and try again.", required: "Complete the required fields correctly.",
    saved: "Customer page saved.", loading: "Loading…", loginFailed: "We could not sign you in. Check your details.",
    loggedOut: "Signed out.", orders: "Orders", newOrder: "New order", number: "Order number",
    pickupCode: "Pickup code", pickupHelp: "A 12-character code provided by venue staff.", minutes: "Estimated minutes",
    add: "Add order", waiting: "Waiting", ready: "Ready", done: "Done", cancelled: "Cancelled",
    estimate: "Change estimate", empty: "There are no active orders right now.", brand: "Customer page designer",
    qr: "QR and print", staff: "Team", account: "Billing and account", save: "Save and publish", remove: "Remove",
    edit: "Edit", hide: "Hide", show: "Show", up: "Move up", down: "Move down", addBlock: "Add section",
    preview: "Live preview", staffOnly: "These settings are available to the owner only.", paymentOff: "Online payment is not configured",
    joinTitle: "Join the queue",     joinHelp: "Enter the receipt number and private pickup code provided by venue staff.", join: "Track my order",
    notFound: "We could not find a venue with these details.", orderError: "We could not find that tracking receipt. Check the link.",
    keepOpen: "Keep this page open for updates. Push notifications are not available in this service.",
    enableAlert: "Enable sound and vibration alert", alertOn: "Alerts are enabled for this session.", review: "Rate your experience",
    receipt: "Tracking receipt", receiptNumber: "Receipt number", privateCode: "Private pickup code",
    privateCodeHelp: "12 characters · verified when you joined", tracking: "Order tracking",
    trackingEyebrow: "Your private tracking page", trackingPromise: "Your order status and readiness estimate in one place.",
    stepWaiting: "Waiting", stepReady: "Ready for pickup", stepDone: "Complete",
    stepCancelled: "Cancelled", estimateLabel: "Current estimate", statusLabel: "Order status",
    countdownLabel: "Estimated time remaining", errorAlert: "We could not continue tracking. Check your details and try again.",
    skipTracking: "Skip to order tracking", skipStatus: "Skip to order status", footer: "Jahiz جاهز · RTS",
    timeUnknown: "Time is being updated", demo: "Demo venue", print: "Print / save PDF",
    downloadPng: "Download high-resolution PNG", downloadSvg: "Download SVG", copyLink: "Copy link",
    copyTrackingLink: "Copy customer tracking link", password: "Password", currentPassword: "Current password",
    newPassword: "New password", changePassword: "Change password", staffName: "Staff name", staffUsername: "Username",
    staffPassword: "Temporary password", addStaff: "Add staff", plan: "Plan", expires: "Expires",
    history: "Payment history", noHistory: "No payment history is available.", brandColor: "Primary color",
    background: "Background color", text: "Text color", welcome: "Welcome message", readyText: "Ready message",
    reviewUrl: "Review URL", logo: "Logo", blocks: "Page sections", trackingLocked: "The order tracking section is always required.",
    imageSafety: "PNG, JPEG, or WebP only, up to 200 KB.", applicationSent: "Your request was sent for review.",
    tenant: "Venue", customerLink: "Customer link", designer: "Designer", content: "Content", appearance: "Appearance",
    imported: "Custom design", desktop: "Desktop", mobile: "Mobile", export: "Export JSON", import: "Import JSON",
    preset: "Reusable styles", cafe: "Calm café", kitchen: "Practical kitchen", minimal: "Minimal",
    discard: "You have unsaved changes. Discard them?", uploadHtml: "Upload HTML and CSS",
    htmlHelp: "HTML and CSS only (200 KB combined). Scripts, forms, and external CSS are unsupported.",
    pendingUpload: "The imported design is shown to customers only after you save and publish this page.",
    customWarning: "HTML is cleaned on save. Scripts, forms, and external CSS are unsupported, so the result can differ from the original file.",
    customHeight: "Custom design height", openCustomer: "Open customer page", layout: "Layout", spacing: "Spacing",
    radius: "Corners", align: "Alignment", font: "Font", backgroundImage: "Background image",
    backgroundMode: "Background mode", surfaceColor: "Content surface", icon: "Icon", caption: "Caption",
    clear: "Clear", savedOpen: "Saved. Open the customer page to check the result.",
  },
};

const $ = (selector, root = document) => root.querySelector(selector);
const t = key => copy[state.lang][key] || key;
const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) node.append(child?.nodeType ? child : document.createTextNode(String(child ?? "")));
  return node;
};
const field = (label, control, help = "") => el("div", { class: "j-field" }, [el("label", { text: label }), control, help ? el("small", { text: help }) : null].filter(Boolean));
const safeUrl = (url, image = false) => {
  try { const parsed = new URL(url, location.origin); return image ? parsed.origin === location.origin || /^data:image\/(png|jpeg|webp);/i.test(url) : parsed.protocol === "https:" || parsed.origin === location.origin; } catch { return false; }
};
const normalizePickupCode = value => String(value || "").trim().toUpperCase();
const formatTime = value => value && !Number.isNaN(new Date(value).valueOf())
  ? new Intl.DateTimeFormat(state.lang === "ar" ? "ar-SA" : "en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value)) : t("timeUnknown");

async function api(path, options = {}) {
  let response;
  try { response = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options }); } catch { throw new Error("NETWORK"); }
  let body = {}; try { body = await response.json(); } catch {}
  if (!response.ok) throw new Error(body?.error?.message || "NETWORK");
  return body;
}
function feedback(target, message, type = "error") {
  const box = $(target); if (!box) return;
  box.textContent = message; box.className = `j-feedback ${type}`; box.classList.remove("hidden");
}
function clearFeedback(target) { const box = $(target); if (box) box.className = "j-feedback hidden"; }
function markDirty() { state.dirty = true; const indicator = $("#designer-dirty"); if (indicator) indicator.textContent = "●"; }
function customerUrl(venue = state.venue) { return customerPageUrl(venue, location.origin); }
function isOwner() { return state.session?.user?.role === "owner"; }

function setLanguage(lang) {
  state.lang = lang; localStorage.setItem("jahiz-language", lang);
  document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-lang]").forEach(button => { button.textContent = lang === "ar" ? "English" : "العربية"; });
  document.querySelectorAll("[data-customer-copy]").forEach(node => { node.textContent = t(node.dataset.customerCopy); });
  if (document.body.dataset.page === "owner" && state.session) renderOwner();
  if (document.body.dataset.page === "join" && state.venue) renderJoinPage();
  if (document.body.dataset.page === "order") renderOrder();
}
document.addEventListener("click", event => { if (event.target.closest("[data-lang]")) setLanguage(state.lang === "ar" ? "en" : "ar"); });

function visibleBlocks(branding) { return normalizeBranding(branding).blocks.filter(block => block.enabled); }
function iconNode(block, alt = "") {
  const icon = blockIcon(block, alt);
  return icon.type === "image" ? el("img", { class: "j-block-icon", src: icon.value, alt: icon.alt }) : (() => {
    const span = el("span", { class: "j-block-icon", "aria-label": alt || null }); span.insertAdjacentHTML("beforeend", icon.value); return span;
  })();
}
function playFeedbackTone(type = "success") {
  try {
    const context = new AudioContext(), oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.frequency.value = type === "error" ? 280 : 660;
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.08, context.currentTime + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .16);
    oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .18);
  } catch {}
}
function customerMasthead(venue, compact = false) {
  const branding = normalizeBranding(venue.branding || {});
  const head = el("header", { class: "j-venue-masthead" });
  if (branding.logoUrl && safeUrl(branding.logoUrl, true)) head.append(el("img", { class: "j-venue-logo", src: branding.logoUrl, alt: venue.name || "Jahiz" }));
  const identity = el("div", { class: "j-venue-identity" }, [
    el("p", { class: "j-venue-eyebrow", text: compact ? t("tracking") : t("trackingEyebrow") }),
    el(compact ? "h2" : "h1", { text: venue.name || "Jahiz" }),
  ]);
  if (venue.isDemo) identity.append(el("span", { class: "j-badge", text: t("demo") }));
  head.append(identity);
  return head;
}
function renderCustomer(parent, venue, { compact = false } = {}) {
  const branding = applyCustomerTheme(parent, venue.branding || {});
  parent.replaceChildren();
  const feedbackBox = !compact ? el("div", { id: "join-feedback", class: "j-feedback hidden", role: "alert", "aria-live": "assertive" }) : null;
  const shell = el("div", { class: "j-customer-native j-customer-experience" });
  shell.append(customerMasthead(venue, compact));
  if (!compact) shell.append(el("p", { class: "j-venue-intro", text: t("trackingPromise") }));
  for (const block of visibleBlocks(branding)) {
    const section = el("section", { class: `j-customer-block j-block-${block.type}` });
    if (block.icon || block.iconUrl) section.append(iconNode(block, block.text || ""));
    if (block.type === "welcome" && branding.welcomeText) section.append(el("p", { text: branding.welcomeText }));
    if (block.type === "text" && block.text) section.append(el("p", { text: block.text }));
    if (block.type === "image" && block.url && safeUrl(block.url, true)) section.append(el("img", { class: "j-customer-image", src: block.url, alt: block.text || "" }));
    if (block.type === "link" && block.url && safeUrl(block.url)) section.append(el("a", { href: block.url, target: "_blank", rel: "noopener noreferrer", text: block.text || block.url }));
    if (block.type === "review" && branding.reviewUrl && safeUrl(branding.reviewUrl)) section.append(el("a", { class: "j-button secondary", href: branding.reviewUrl, target: "_blank", rel: "noopener noreferrer", text: t("review") }));
    if (block.type === "icon" && block.text) section.append(el("p", { text: block.text }));
    if (block.type === "tracking") section.append(renderTracking(venue, compact));
    if (section.childNodes.length) shell.append(section);
  }
  if (feedbackBox) parent.append(feedbackBox);
  if (!compact && venue.branding?.hasCustomPage) {
    const frame = el("iframe", {
      class: "j-custom-page", title: `${venue.name || "Jahiz"} ${t("imported")}`, sandbox: "", referrerpolicy: "no-referrer",
      src: `${API}/public/page?slug=${encodeURIComponent(venue.slug)}&v=${encodeURIComponent(venue.brandingRevision || venue.revision || "")}`,
      height: String(branding.customPageHeight),
    });
    parent.append(frame);
  }
  parent.append(shell);
}
function renderTracking(venue, compact) {
  const area = el("section", { class: "j-tracking-area", "aria-labelledby": "tracking-title" }, [
    el("div", { class: "j-tracking-heading" }, [
      el("span", { class: "j-tracking-index", text: "01", "aria-hidden": "true" }),
      el("div", {}, [el("h3", { id: "tracking-title", text: t("joinTitle") }), el("p", { text: t("joinHelp") })]),
    ]),
  ]);
  if (compact) return area;
  const form = el("form", { class: "j-tracking-form" });
  const number = el("input", { name: "number", inputmode: "numeric", autocomplete: "off", required: "", maxlength: "12", placeholder: t("number"), "aria-label": t("receiptNumber") });
  const pickupCode = el("input", { name: "pickupCode", autocomplete: "one-time-code", autocapitalize: "characters", spellcheck: "false", required: "", maxlength: "12", placeholder: t("pickupCode"), dir: "ltr", "aria-label": t("privateCode") });
  number.value = state.joinPrefill?.number || ""; pickupCode.value = state.joinPrefill?.pickupCode || "";
  form.append(field(t("receiptNumber"), number), field(t("privateCode"), pickupCode, t("pickupHelp")), el("button", { class: "j-button j-track-action", type: "submit", text: t("join") }));
  form.addEventListener("submit", async event => {
    event.preventDefault(); const receipt = number.value.trim(); const code = normalizePickupCode(pickupCode.value); pickupCode.value = code;
    if (!/^\d{1,12}$/.test(receipt) || !/^[A-Z0-9]{12}$/.test(code)) { playFeedbackTone("error"); return feedback("#join-feedback", t("required")); }
    try { const answer = await api("/public/join", { method: "POST", body: JSON.stringify({ slug: venue.slug, number: receipt, pickupCode: code }) }); location.assign(`/jahiz/order/?token=${encodeURIComponent(answer.token)}`); }
    catch (error) { playFeedbackTone("error"); feedback("#join-feedback", error.message === "NETWORK" ? t("network") : error.message); }
  });
  area.append(form); return area;
}

async function bootstrapOwner() {
  try {
    state.session = await api("/session"); state.venue = state.session.venue;
    state.brand = normalizeBranding(state.venue.branding); state.savedBrand = structuredClone(state.brand);
    $("#session-name").textContent = state.session.user?.name || state.session.user?.username || "";
    renderOwner(); await refreshOrders(); startOwnerPolling();
  } catch { location.assign("/jahiz/login/"); }
}
function startOwnerPolling() {
  clearTimeout(state.poll);
  const tick = async () => { if (document.visibilityState === "visible") { try { await refreshOrders(); state.pollDelay = 5000; } catch { state.pollDelay = Math.min(state.pollDelay * 2, 60000); } } state.poll = setTimeout(tick, state.pollDelay); };
  state.poll = setTimeout(tick, 5000);
}
async function refreshOrders() { const result = await api("/orders"); state.orders = Array.isArray(result.orders) ? result.orders : []; if (state.tab === "orders") renderOwner(); }
function renderOwner() {
  document.querySelectorAll("[data-owner-tab]").forEach(button => button.setAttribute("aria-current", button.dataset.ownerTab === state.tab ? "page" : "false"));
  ({ orders: renderOrders, brand: renderBrand, qr: renderQr, staff: renderStaff, account: renderAccount }[state.tab] || renderOrders)();
}
function renderOrders() {
  const view = $("#owner-view"); view.replaceChildren();
  const active = state.orders.filter(order => ["waiting", "ready"].includes(order.status));
  const form = el("form", { class: "j-panel wide" });
  const number = el("input", { name: "number", required: "", inputmode: "numeric", maxlength: "12", placeholder: t("number") });
  const minutes = el("input", { name: "minutes", type: "number", min: "1", max: "180", placeholder: t("minutes") });
  form.append(el("h1", { text: t("orders") }), el("div", { class: "j-grid" }, [field(t("number"), number), field(t("minutes"), minutes)]), el("button", { class: "j-button", type: "submit", text: t("add") }));
  form.addEventListener("submit", async event => { event.preventDefault(); const n = number.value.trim(), m = minutes.value; if (!/^\d{1,12}$/.test(n) || (m && (+m < 1 || +m > 180))) return feedback("#owner-feedback", t("required")); try { await api("/orders", { method: "POST", body: JSON.stringify({ number: n, minutes: m ? +m : null }) }); await refreshOrders(); } catch (error) { feedback("#owner-feedback", error.message); } });
  const list = el("div", { class: "j-orders" }, active.length ? active.map(orderRow) : [el("div", { class: "j-empty", text: t("empty") })]);
  view.append(form, el("h2", { text: t("orders") }), list);
}
function orderRow(order) {
  const actions = el("div", { class: "j-order-actions" });
  const update = async (action, minutes) => { try { await api("/orders", { method: "PATCH", body: JSON.stringify({ id: order.id, action, minutes, revision: order.revision }) }); await refreshOrders(); } catch (error) { feedback("#owner-feedback", error.message); } };
  if (order.status === "waiting") actions.append(
    el("button", { class: "j-button success small", type: "button", text: t("ready"), onclick: () => update("ready") }),
    el("button", { class: "j-button secondary small", type: "button", text: t("estimate"), onclick: () => openEstimate(update) }),
    el("button", { class: "j-button danger small", type: "button", text: t("cancelled"), onclick: () => update("cancel") }),
  );
  if (order.status === "ready") actions.append(el("button", { class: "j-button small", type: "button", text: t("done"), onclick: () => update("done") }));
  if (order.pickupCode) actions.append(el("button", { class: "j-button secondary small", type: "button", text: t("copyTrackingLink"), onclick: () => copyText(`${customerUrl()}#${new URLSearchParams({ number: order.number, code: normalizePickupCode(order.pickupCode) })}`) }));
  return el("article", { class: "j-order" }, [el("strong", { class: "j-order-number", text: order.number }), el("span", { class: `j-status ${order.status}`, text: t(order.status) }), el("span", { class: "j-order-meta", text: order.estimatedReadyAt ? formatTime(order.estimatedReadyAt) : t("timeUnknown") }), order.pickupCode ? el("code", { text: order.pickupCode }) : null, actions].filter(Boolean));
}
function openEstimate(save) {
  const minutes = el("input", { type: "number", min: "1", max: "180", placeholder: t("minutes") });
  openDialog(t("estimate"), [field(t("minutes"), minutes), el("button", {
    class: "j-button", type: "button", text: t("save"), onclick: () => {
      const value = Number(minutes.value);
      if (value >= 1 && value <= 180) { closeDialog(); save("estimate", value); }
      else feedback("#owner-feedback", t("required"));
    },
  })]);
}

const presets = {
  cafe: { primaryColor: "#5a2c5f", backgroundColor: "#f8f2f7", surfaceColor: "#ffffff", textColor: "#302335", layout: "centered", spacing: "comfortable", radius: "soft", align: "start", font: "serif" },
  kitchen: { primaryColor: "#3b2569", backgroundColor: "#f5f4fa", surfaceColor: "#ffffff", textColor: "#1d1b28", layout: "wide", spacing: "compact", radius: "square", align: "start", font: "sans" },
  minimal: { primaryColor: "#48216a", backgroundColor: "#ffffff", surfaceColor: "#ffffff", textColor: "#202020", layout: "centered", spacing: "airy", radius: "soft", align: "center", font: "sans" },
};
function renderBrand() {
  if (!isOwner()) { $("#owner-view").replaceChildren(el("div", { class: "j-empty", text: t("staffOnly") })); return; }
  state.brand = normalizeBranding(state.brand);
  const view = $("#owner-view"); view.replaceChildren();
  const tools = el("div", { class: "j-designer-tools" });
  const tabs = ["designer", "content", "appearance", "imported"].map((key, index) => el("button", { class: "j-button secondary small", type: "button", text: t(key), "data-designer-tab": key, "aria-pressed": index === 0 ? "true" : "false" }));
  const form = el("div", { class: "j-designer-panel" });
  const preview = el("div", { class: "j-preview-wrap" }, [el("div", { class: "j-preview-head" }, [el("h2", { text: t("preview") }), el("span", { id: "designer-dirty", class: "j-dirty", text: state.dirty ? "●" : "" }), el("div", { class: "j-preview-toggle" }, [el("button", { class: "j-button secondary small", type: "button", text: t("desktop"), "aria-pressed": "true", onclick: event => setPreviewMode(event, "desktop") }), el("button", { class: "j-button secondary small", type: "button", text: t("mobile"), "aria-pressed": "false", onclick: event => setPreviewMode(event, "mobile") })])]), el("div", { class: "j-device desktop" }, [el("div", { class: "j-device-bar" }), el("div", { class: "j-customer", id: "brand-preview" })])]);
  tools.append(...tabs, el("button", { class: "j-button secondary small", type: "button", text: t("export"), onclick: downloadTemplate }), el("button", { class: "j-button secondary small", type: "button", text: t("import"), onclick: () => $("#template-upload").click() }), el("a", { class: "j-button secondary small", href: customerUrl(), target: "_blank", rel: "noopener", text: t("openCustomer") }), el("button", { class: "j-button small", type: "button", text: t("save"), onclick: saveBrand }));
  const upload = el("input", { id: "template-upload", class: "sr-only", type: "file", accept: "application/json,.json" });
  upload.addEventListener("change", importTemplateFile);
  view.append(el("div", { class: "j-designer-head" }, [el("div", {}, [el("h1", { text: t("brand") }), el("p", { text: t("trackingLocked") })]), tools, upload]), el("div", { class: "j-designer-layout" }, [form, preview]));
  renderDesignerPanel(form, "designer");
  renderCustomer($("#brand-preview"), { ...state.venue, branding: state.brand, hasCustomPage: false }, { compact: true });
  tools.addEventListener("click", event => { const button = event.target.closest("[data-designer-tab]"); if (!button) return; if (state.dirty && !confirm(t("discard"))) return; tools.querySelectorAll("[data-designer-tab]").forEach(item => item.setAttribute("aria-pressed", String(item === button))); renderDesignerPanel(form, button.dataset.designerTab); });
}
function renderDesignerPanel(panel, tab) {
  panel.replaceChildren();
  if (tab === "designer") return panel.append(el("h2", { text: t("blocks") }), blockList(), el("button", { class: "j-button secondary", type: "button", text: t("addBlock"), onclick: addBlock }));
  if (tab === "content") return renderContentPanel(panel);
  if (tab === "appearance") return renderAppearancePanel(panel);
  renderCustomPanel(panel);
}
function bindModel(control, key) {
  control.addEventListener("input", () => { state.brand[key] = control.value.trim(); markDirty(); updatePreview(); });
  control.addEventListener("change", () => { state.brand[key] = control.value.trim(); markDirty(); updatePreview(); });
}
function renderContentPanel(panel) {
  const welcome = el("textarea", { maxlength: "300" }); welcome.value = state.brand.welcomeText; bindModel(welcome, "welcomeText");
  const ready = el("textarea", { maxlength: "300" }); ready.value = state.brand.readyText; bindModel(ready, "readyText");
  const review = el("input", { type: "url", dir: "ltr", maxlength: "500" }); review.value = state.brand.reviewUrl; bindModel(review, "reviewUrl");
  panel.append(field(t("welcome"), welcome), field(t("readyText"), ready), field(t("reviewUrl"), review), imageUpload(t("logo"), value => { state.brand.logoUrl = value; markDirty(); updatePreview(); }));
}
function renderAppearancePanel(panel) {
  const controls = [
    colorInput("primaryColor", t("brandColor")), colorInput("backgroundColor", t("background")), colorInput("surfaceColor", t("surfaceColor")), colorInput("textColor", t("text")),
    selectInput("layout", t("layout"), ["centered", "wide", "split"]), selectInput("spacing", t("spacing"), ["compact", "comfortable", "airy"]),
    selectInput("radius", t("radius"), ["square", "soft", "round"]), selectInput("align", t("align"), ["start", "center"]), selectInput("font", t("font"), ["sans", "serif"]),
    selectInput("backgroundMode", t("backgroundMode"), ["cover", "tile"]), imageUpload(t("backgroundImage"), value => { state.brand.backgroundImage = value; markDirty(); updatePreview(); }),
  ];
  const presetButtons = Object.keys(presets).map(name => el("button", {
    class: "j-button secondary small", type: "button", text: t(name),
    onclick: () => {
      if (!state.dirty || confirm(t("discard"))) {
        Object.assign(state.brand, presets[name]); markDirty(); renderBrand();
      }
    },
  }));
  panel.append(...controls, el("h2", { text: t("preset") }), el("div", { class: "j-preset-row" }, presetButtons));
}
function colorInput(key, label) { const input = el("input", { type: "text", dir: "ltr", maxlength: "7", value: state.brand[key], pattern: "#[0-9A-Fa-f]{6}" }); bindModel(input, key); return field(label, input); }
function selectInput(key, label, options) { const input = el("select"); options.forEach(value => input.append(el("option", { value, text: value }))); input.value = state.brand[key]; bindModel(input, key); return field(label, input); }
function imageUpload(label, callback) {
  const input = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp" });
  input.addEventListener("change", () => { const file = input.files?.[0], error = imageFileError(file); if (error) { feedback("#owner-feedback", error); input.value = ""; return; } const reader = new FileReader(); reader.addEventListener("load", () => callback(String(reader.result))); reader.readAsDataURL(file); });
  return field(label, input, t("imageSafety"));
}
function renderCustomPanel(panel) {
  const html = el("input", { type: "file", accept: ".html,.htm,text/html" });
  const css = el("input", { type: "file", accept: ".css,text/css" });
  const height = el("input", { type: "number", min: "320", max: "1600", value: String(state.brand.customPageHeight) });
  bindModel(height, "customPageHeight");
  const submit = el("button", { class: "j-button secondary", type: "button", text: t("uploadHtml") });
  submit.addEventListener("click", async () => {
    const error = customFilesError(html.files?.[0], css.files?.[0]); if (error) return feedback("#owner-feedback", error);
    const [markup, stylesheet] = await Promise.all([html.files[0].text(), css.files?.[0]?.text() || ""]);
    state.brand.customHtml = combineCustomFiles(markup, stylesheet); markDirty(); feedback("#owner-feedback", t("pendingUpload"), "success");
  });
  panel.append(el("h2", { text: t("uploadHtml") }), field("HTML", html, t("htmlHelp")), field("CSS", css), field(t("customHeight"), height), submit, el("p", { class: "j-note", text: t("pendingUpload") }), el("p", { class: "j-note", text: t("customWarning") }));
}
function blockList() {
  const list = el("div", { class: "j-block-list" });
  state.brand.blocks.forEach((block, index) => {
    const controls = el("div", { class: "j-block-controls" }, [
      el("button", { class: "j-button secondary small", type: "button", text: block.enabled ? t("hide") : t("show"), onclick: () => { if (block.type !== "tracking") { block.enabled = !block.enabled; markDirty(); renderBrand(); } } }),
      el("button", { class: "j-button secondary small", type: "button", text: t("edit"), onclick: () => editBlock(block) }),
      el("button", { class: "j-button secondary small", type: "button", text: "↑", "aria-label": t("up"), onclick: () => moveBlock(index, -1) }),
      el("button", { class: "j-button secondary small", type: "button", text: "↓", "aria-label": t("down"), onclick: () => moveBlock(index, 1) }),
    ]);
    if (block.type !== "tracking") controls.append(el("button", { class: "j-button danger small", type: "button", text: t("remove"), onclick: () => { state.brand.blocks.splice(index, 1); markDirty(); renderBrand(); } }));
    const row = el("div", { class: "j-block", draggable: "true", tabindex: "0", "aria-label": `${block.type}. ${t("up")} / ${t("down")}` }, [block.icon ? iconNode(block) : null, el("span", { class: "j-block-title", text: block.text || block.type }), controls].filter(Boolean));
    row.addEventListener("dragstart", event => event.dataTransfer.setData("text/plain", block.id));
    row.addEventListener("dragover", event => event.preventDefault());
    row.addEventListener("drop", event => { event.preventDefault(); const from = state.brand.blocks.findIndex(item => item.id === event.dataTransfer.getData("text/plain")); if (from >= 0 && from !== index) { const [moved] = state.brand.blocks.splice(from, 1); state.brand.blocks.splice(index, 0, moved); markDirty(); renderBrand(); } });
    row.addEventListener("keydown", event => { if (event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); moveBlock(index, event.key === "ArrowUp" ? -1 : 1); } });
    list.append(row);
  }); return list;
}
function moveBlock(index, delta) { const to = index + delta; if (to >= 0 && to < state.brand.blocks.length) { [state.brand.blocks[index], state.brand.blocks[to]] = [state.brand.blocks[to], state.brand.blocks[index]]; markDirty(); renderBrand(); } }
function addBlock() {
  if (state.brand.blocks.length >= MAX_BLOCKS) return feedback("#owner-feedback", `Maximum ${MAX_BLOCKS} blocks.`);
  const select = el("select"); ["welcome", "text", "image", "link", "review", "icon"].forEach(type => select.append(el("option", { value: type, text: type })));
  openDialog(t("addBlock"), [field("Type", select), el("button", { class: "j-button", type: "button", text: t("addBlock"), onclick: () => { state.brand.blocks.push({ id: crypto.randomUUID(), type: select.value, enabled: true, icon: select.value === "icon" ? "sparkles" : "" }); markDirty(); closeDialog(); renderBrand(); } })]);
}
function editBlock(block) {
  const text = el("textarea", { maxlength: "500" }); text.value = block.text || "";
  const url = el("input", { type: "url", dir: "ltr", maxlength: "2048" }); url.value = block.url || "";
  const icon = el("select"); ["", ...ICONS].forEach(name => icon.append(el("option", { value: name, text: name || "—" }))); icon.value = block.icon || "";
  const live = () => { block.text = text.value.trim(); block.url = url.value.trim(); block.icon = icon.value; markDirty(); updatePreview(); };
  text.addEventListener("input", live); url.addEventListener("input", live); icon.addEventListener("change", live);
  openDialog(`${t("edit")} · ${block.type}`, [field(t("caption"), text), field("URL", url), field(t("icon"), icon), imageUpload(t("icon"), value => { block.iconUrl = value; markDirty(); updatePreview(); }), el("button", { class: "j-button", type: "button", text: t("save"), onclick: () => { if (url.value && !safeUrl(url.value, block.type === "image")) return feedback("#owner-feedback", t("required")); live(); closeDialog(); renderBrand(); } })]);
}
function updatePreview() { const preview = $("#brand-preview"); if (preview) renderCustomer(preview, { ...state.venue, branding: state.brand, hasCustomPage: false }, { compact: true }); }
function setPreviewMode(event, mode) { const device = $(".j-device"); device?.classList.toggle("mobile", mode === "mobile"); device?.classList.toggle("desktop", mode === "desktop"); event.currentTarget.parentElement.querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", String(button === event.currentTarget))); }
function downloadTemplate() { const blob = new Blob([exportTemplate(state.brand)], { type: "application/json" }); const href = URL.createObjectURL(blob); const link = el("a", { href, download: "jahiz-page.json" }); link.click(); URL.revokeObjectURL(href); }
async function importTemplateFile(event) { const file = event.target.files?.[0]; if (!file) return; try { if (state.dirty && !confirm(t("discard"))) return; state.brand = importTemplate(await file.text()); markDirty(); renderBrand(); } catch (error) { feedback("#owner-feedback", error.message); } finally { event.target.value = ""; } }
async function saveBrand() {
  state.brand = normalizeBranding(state.brand);
  if (!/^#[\da-f]{6}$/i.test(state.brand.primaryColor) || !/^#[\da-f]{6}$/i.test(state.brand.backgroundColor) || !/^#[\da-f]{6}$/i.test(state.brand.textColor) || (state.brand.reviewUrl && !safeUrl(state.brand.reviewUrl))) return feedback("#owner-feedback", t("required"));
  try {
    const result = await api("/settings", { method: "PATCH", body: JSON.stringify({ branding: state.brand, revision: state.venue.brandingRevision }) });
    state.brand = normalizeBranding(result.branding || result.venue?.branding || state.brand);
    state.venue = { ...state.venue, ...(result.venue || {}), branding: state.brand, brandingRevision: result.revision ?? state.venue.brandingRevision };
    state.savedBrand = structuredClone(state.brand); state.dirty = false; feedback("#owner-feedback", t("savedOpen"), "success"); renderBrand();
  } catch (error) { feedback("#owner-feedback", error.message === "NETWORK" ? t("network") : error.message); }
}
async function renderQr() {
  const view = $("#owner-view"); view.replaceChildren(); const target = el("div", { class: "j-qr" }); const url = customerUrl();
  view.append(el("div", { class: "j-toolbar" }, [el("div", {}, [el("h1", { text: t("qr") }), el("p", { text: t("customerLink") })])]), target);
  if (!window.QRCode) return target.append(el("p", { text: t("network") }));
  try {
    const [svg, png] = await Promise.all([window.QRCode.toString(url, { type: "svg", margin: 4, color: { dark: "#000", light: "#fff" }, errorCorrectionLevel: "M" }), window.QRCode.toDataURL(url, { width: 1600, margin: 4, color: { dark: "#000", light: "#fff" }, errorCorrectionLevel: "M" })]);
    target.append(el("img", { src: png, alt: "QR" }), el("code", { text: url }), el("div", { class: "j-qr-actions" }, [downloadButton(t("downloadPng"), png, "jahiz-qr.png"), downloadButton(t("downloadSvg"), `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, "jahiz-qr.svg"), el("button", { class: "j-button secondary", type: "button", text: t("copyLink"), onclick: () => copyText(url) }), el("a", { class: "j-button", href: `/jahiz/poster/?shop=${encodeURIComponent(state.venue.slug)}`, target: "_blank", rel: "noopener", text: t("print") })]));
  } catch { target.append(el("p", { text: t("network") })); }
}
const downloadButton = (label, href, name) => el("a", { class: "j-button secondary", href, download: name, text: label });
async function copyText(text) { try { if (!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(text); feedback("#owner-feedback", t("saved"), "success"); } catch { feedback("#owner-feedback", t("network")); } }

function renderStaff() {
  const view = $("#owner-view"); view.replaceChildren(); if (!isOwner()) return view.append(el("div", { class: "j-empty", text: t("staffOnly") }));
  const form = el("form", { class: "j-panel wide" }); const name = el("input", { name: "name", required: "", maxlength: "100" }); const username = el("input", { name: "username", required: "", maxlength: "80", dir: "ltr" }); const password = el("input", { name: "password", type: "password", required: "", minlength: "8", dir: "ltr" });
  form.append(el("h1", { text: t("staff") }), el("div", { class: "j-grid" }, [field(t("staffName"), name), field(t("staffUsername"), username), field(t("staffPassword"), password)]), el("button", { class: "j-button", type: "submit", text: t("addStaff") }));
  form.addEventListener("submit", async event => { event.preventDefault(); if (!form.checkValidity()) return form.reportValidity(); try { await api("/staff", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) }); state.session = await api("/session"); renderStaff(); } catch (error) { feedback("#owner-feedback", error.message); } });
  const list = el("div", { class: "j-orders" });
  for (const person of state.session.staff || []) {
    const remove = el("button", { class: "j-button danger small", type: "button", text: t("remove") });
    remove.addEventListener("click", async () => {
      try { await api("/staff", { method: "DELETE", body: JSON.stringify({ id: person.id }) }); state.session = await api("/session"); renderStaff(); }
      catch (error) { feedback("#owner-feedback", error.message); }
    });
    list.append(el("article", { class: "j-order" }, [el("strong", { text: person.name || person.username }), el("span", { class: "j-order-meta", text: person.username || "" }), remove]));
  }
  view.append(form, el("h2", { text: t("staff") }), list);
}
function renderAccount() {
  const view = $("#owner-view"); view.replaceChildren(); const form = el("form", { class: "j-panel wide" }); const current = el("input", { name: "currentPassword", type: "password", required: "" }); const next = el("input", { name: "newPassword", type: "password", required: "", minlength: "8" });
  form.append(el("h2", { text: t("changePassword") }), field(t("currentPassword"), current), field(t("newPassword"), next), el("button", { class: "j-button", type: "submit", text: t("changePassword") }));
  form.addEventListener("submit", async event => { event.preventDefault(); try { await api("/password", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) }); form.reset(); feedback("#owner-feedback", t("saved"), "success"); } catch (error) { feedback("#owner-feedback", error.message); } });
  if (!isOwner()) return view.append(el("h1", { text: t("password") }), form);
  const billing = state.session.billing || {};
  const expiry = state.venue.expiresAt ? new Intl.DateTimeFormat(state.lang === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium" }).format(new Date(state.venue.expiresAt)) : "—";
  const metrics = el("div", { class: "j-metrics" }, [
    el("div", { class: "j-metric" }, [el("small", { text: t("plan") }), el("strong", { text: billing.plan?.name || "—" })]),
    el("div", { class: "j-metric" }, [el("small", { text: t("expires") }), el("strong", { text: expiry })]),
  ]);
  const history = el("section", { class: "j-panel wide" }, [el("h2", { text: t("history") })]);
  if (billing.payments?.length) {
    const entries = el("ul");
    billing.payments.forEach(payment => entries.append(el("li", { text: `${payment.amountMinor} ${payment.currency} · ${formatTime(payment.createdAt)}` })));
    history.append(entries);
  } else history.append(el("p", { text: t("noHistory") }));
  history.append(el("p", { class: "j-note", text: t("paymentOff") }));
  view.append(el("h1", { text: t("account") }), metrics, history, form);
}
function openDialog(title, content) { $("#dialog-title").textContent = title; $("#dialog-content").replaceChildren(...content); $("#owner-dialog").showModal(); }
function closeDialog() { $("#owner-dialog").close(); }
async function logout() { try { await api("/logout", { method: "POST", body: "{}" }); } finally { clearTimeout(state.poll); location.assign("/jahiz/login/"); } }

async function submitApplication(event) { event.preventDefault(); const form = event.currentTarget; if (!form.checkValidity()) return form.reportValidity(); try { await api("/applications", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) }); form.reset(); feedback("#application-feedback", t("applicationSent"), "success"); } catch (error) { feedback("#application-feedback", error.message === "NETWORK" ? t("network") : error.message); } }
async function submitLogin(event) { event.preventDefault(); const form = event.currentTarget; if (!form.checkValidity()) return form.reportValidity(); try { await api("/login", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) }); location.assign("/jahiz/owner/"); } catch (error) { feedback("#login-feedback", error.message === "NETWORK" ? t("loginFailed") : error.message); } }
async function renderJoinPage() { renderCustomer($("#join-content"), state.venue); }
function consumeJoinFragment() { const params = new URLSearchParams(location.hash.slice(1)); if (location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`); return { number: String(params.get("number") || "").trim(), pickupCode: normalizePickupCode(params.get("code")) }; }
async function initJoin() { state.joinPrefill = consumeJoinFragment(); const slug = new URLSearchParams(location.search).get("shop") || ""; try { state.venue = (await api(`/public/venue?slug=${encodeURIComponent(slug)}`)).venue; renderJoinPage(); } catch { $("#join-content").replaceChildren(el("p", { text: t("notFound") })); } }
function remainingTime(value) { const seconds = Math.max(0, Math.ceil((new Date(value).valueOf() - Date.now()) / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
function statusProgress(status) {
  const states = ["waiting", "ready", "done"];
  return status === "cancelled" ? 0 : Math.max(0, states.indexOf(status));
}
function orderJourney(status) {
  const current = statusProgress(status);
  const steps = [
    { status: "waiting", label: t("stepWaiting") },
    { status: "ready", label: t("stepReady") },
    { status: "done", label: t("stepDone") },
  ];
  return el("ol", { class: `j-order-progress ${status === "cancelled" ? "cancelled" : ""}`, "aria-label": t("statusLabel") }, steps.map((step, index) => {
    const state = status === "cancelled" ? "" : index < current ? "complete" : index === current ? "current" : "";
    return el("li", { class: state, "aria-current": state === "current" ? "step" : null }, [
      el("span", { class: "j-progress-dot", text: String(index + 1), "aria-hidden": "true" }),
      el("span", { text: step.label }),
    ]);
  }));
}
function renderOrder() {
  const root = $("#order-content"); if (!root || !state.order) return; clearInterval(state.receiptTimer); applyCustomerTheme(root, state.venue.branding || {}); root.replaceChildren();
  const order = state.order;
  const notice = el("div", { id: "order-feedback", class: "j-feedback hidden", role: "status", "aria-live": "polite" });
  const countdown = el("strong", { class: "j-countdown-value", text: order.estimatedReadyAt ? remainingTime(order.estimatedReadyAt) : t("timeUnknown"), dir: "ltr" });
  const receipt = el("section", { class: "j-receipt-details", "aria-label": t("receipt") }, [
    el("div", { class: "j-receipt-item" }, [el("span", { class: "j-detail-label", text: t("receiptNumber") }), el("strong", { class: "j-public-number", text: order.number, dir: "ltr" })]),
    el("div", { class: "j-receipt-item j-private-code" }, [el("span", { class: "j-detail-label", text: t("privateCode") }), el("strong", { text: "•••• •••• ••••", dir: "ltr" }), el("small", { text: t("privateCodeHelp") })]),
  ]);
  const estimate = el("section", { class: "j-order-estimate", "aria-live": "polite" }, [
    el("span", { class: "j-detail-label", text: t("countdownLabel") }), countdown,
    el("span", { class: `j-status ${order.status}`, text: order.status === "cancelled" ? t("stepCancelled") : t(order.status) }),
  ]);
  const journey = el("div", { class: "j-order-journey" }, [
    customerMasthead(state.venue, true),
    el("p", { class: "j-venue-intro", text: t("trackingPromise") }),
    el("h1", { text: t("receipt") }),
    receipt,
    orderJourney(order.status),
    estimate,
    el("p", { class: "j-note", text: t("keepOpen") }),
    el("button", { class: "j-button secondary j-alert-action", type: "button", text: t("enableAlert"), onclick: enableAlerts }),
  ]);
  root.append(notice, journey);
  if (order.estimatedReadyAt && order.status === "waiting") state.receiptTimer = setInterval(() => { countdown.textContent = remainingTime(order.estimatedReadyAt); }, 1000);
}
function playReadyTone() { try { const context = new AudioContext(), oscillator = context.createOscillator(), gain = context.createGain(); oscillator.frequency.value = 880; gain.gain.setValueAtTime(.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(.12, context.currentTime + .02); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .4); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .42); } catch {} }
async function enableAlerts() { state.notified = true; playReadyTone(); try { state.wake = await navigator.wakeLock?.request("screen"); } catch {} feedback("#order-feedback", t("alertOn"), "success"); }
function pollPublicOrder(token) { const tick = async () => { if (document.visibilityState === "visible") try { const data = await api(`/public/order?token=${encodeURIComponent(token)}`), becameReady = state.order?.status !== "ready" && data.order?.status === "ready"; state.order = data.order; state.venue = data.venue; renderOrder(); if (becameReady && state.notified) { navigator.vibrate?.([180, 100, 180]); playReadyTone(); } } catch {} state.poll = setTimeout(tick, 5000); }; state.poll = setTimeout(tick, 5000); }
async function initOrder() { const token = new URLSearchParams(location.search).get("token") || ""; try { const data = await api(`/public/order?token=${encodeURIComponent(token)}`); state.order = data.order; state.venue = data.venue; renderOrder(); pollPublicOrder(token); } catch { $("#order-content").replaceChildren(el("p", { text: t("orderError") })); } }
async function initPoster() { const slug = new URLSearchParams(location.search).get("shop") || ""; try { const venue = (await api(`/public/venue?slug=${encodeURIComponent(slug)}`)).venue, root = $("#poster-content"), url = customerUrl(venue); root.replaceChildren(el("p", { text: venue.name || "" }), el("h1", { text: t("joinTitle") })); if (!window.QRCode) throw new Error(); root.append(el("div", { class: "j-qr" }, [el("img", { src: await window.QRCode.toDataURL(url, { width: 1400, margin: 4, errorCorrectionLevel: "M" }), alt: "QR" }), el("p", { text: t("joinHelp") })]), el("button", { class: "j-button no-print", type: "button", text: t("print"), onclick: () => window.print() })); } catch { $("#poster-content").replaceChildren(el("p", { text: t("notFound") })); } }
function init() {
  setLanguage(state.lang); const page = document.body.dataset.page;
  if (page === "home" || page === "signup") $("#application-form")?.addEventListener("submit", submitApplication);
  if (page === "login") { const slug = new URLSearchParams(location.search).get("shop"); if (slug) $("#slug").value = slug; $("#login-form")?.addEventListener("submit", submitLogin); }
  if (page === "owner") { bootstrapOwner(); document.addEventListener("click", event => { const tab = event.target.closest("[data-owner-tab]"); if (tab) { if (state.tab === "brand" && state.dirty && !confirm(t("discard"))) return; state.tab = tab.dataset.ownerTab; renderOwner(); } if (event.target.closest("#logout")) logout(); if (event.target.closest("[data-close-dialog]")) closeDialog(); }); window.addEventListener("beforeunload", event => { if (state.dirty) { event.preventDefault(); event.returnValue = ""; } }); }
  if (page === "join") initJoin(); if (page === "order") initOrder(); if (page === "poster") initPoster();
}
init();
