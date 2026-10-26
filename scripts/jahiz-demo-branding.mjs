const asset = name => `/jahiz/assets/${name}`;

const demoBranding = {
  cafe: {
    backgroundImage: asset("demo-cafe.jpg"),
    backgroundMode: "cover",
    primaryColor: "#563156",
    backgroundColor: "#e7d8c8",
    surfaceColor: "#fffaf5",
    textColor: "#291b2e",
    layout: "wide",
    spacing: "airy",
    radius: "round",
    align: "center",
    font: "sans",
    welcomeText: "قهوة تُحضّر بعناية، وتتابعها هنا بهدوء. · Carefully prepared coffee, simply tracked here.",
    readyText: "طلبك جاهز للاستلام. · Your order is ready for pickup.",
    blocks: [
      { id: "cafe-hero", type: "image", enabled: true, url: asset("demo-cafe.jpg") },
      { id: "cafe-welcome", type: "welcome", enabled: true, icon: "coffee", text: "قهوة تُحضّر بعناية، وتتابعها هنا بهدوء. · Carefully prepared coffee, simply tracked here." },
      { id: "cafe-tracking", type: "tracking", enabled: true },
      { id: "cafe-note", type: "text", enabled: true, icon: "clock", text: "أدخل رقم الإيصال ورمز الاستلام لمتابعة الحالة. · Use your receipt number and pickup code to track status." },
    ],
  },
  kitchen: {
    backgroundImage: asset("demo-kitchen.jpg"),
    backgroundMode: "cover",
    primaryColor: "#184d4d",
    backgroundColor: "#d7e5df",
    surfaceColor: "#f8fbf8",
    textColor: "#102a2a",
    layout: "split",
    spacing: "comfortable",
    radius: "soft",
    align: "start",
    font: "sans",
    welcomeText: "من محطة التحضير إلى الاستلام، الحالة واضحة. · From preparation to pickup, your status stays clear.",
    readyText: "طلبك جاهز للاستلام. · Your order is ready for pickup.",
    blocks: [
      { id: "kitchen-hero", type: "image", enabled: true, url: asset("demo-kitchen.jpg") },
      { id: "kitchen-welcome", type: "welcome", enabled: true, icon: "utensils", text: "من محطة التحضير إلى الاستلام، الحالة واضحة. · From preparation to pickup, your status stays clear." },
      { id: "kitchen-tracking", type: "tracking", enabled: true },
      { id: "kitchen-note", type: "text", enabled: true, icon: "clock", text: "هذه صفحة متابعة فقط؛ لا طلب أو دفع من هنا. · This page tracks readiness only; ordering and payment are not available here." },
    ],
  },
  bakery: {
    backgroundImage: asset("demo-bakery.jpg"),
    backgroundMode: "cover",
    primaryColor: "#7a3d20",
    backgroundColor: "#ead7bf",
    surfaceColor: "#fff9f0",
    textColor: "#382014",
    layout: "centered",
    spacing: "airy",
    radius: "round",
    align: "center",
    font: "serif",
    welcomeText: "دفعة اليوم تُتابَع برقم الإيصال. · Today’s bake is tracked by your receipt number.",
    readyText: "طلبك جاهز للاستلام. · Your order is ready for pickup.",
    blocks: [
      { id: "bakery-hero", type: "image", enabled: true, url: asset("demo-bakery.jpg") },
      { id: "bakery-welcome", type: "welcome", enabled: true, icon: "bread", text: "دفعة اليوم تُتابَع برقم الإيصال. · Today’s bake is tracked by your receipt number." },
      { id: "bakery-tracking", type: "tracking", enabled: true },
      { id: "bakery-note", type: "text", enabled: true, icon: "sparkles", text: "احتفظ برمز الاستلام الخاص بك للمتابعة. · Keep your private pickup code to continue tracking." },
    ],
  },
};

function completePatch(patch) {
  return {
    logoUrl: "",
    reviewUrl: "",
    customHtml: "",
    customPageHeight: 640,
    ...patch,
  };
}

export const jahizDemoBranding = Object.freeze(
  Object.fromEntries(Object.entries(demoBranding).map(([name, patch]) => [name, Object.freeze(completePatch(patch))])),
);

export function getJahizDemoBranding(name) {
  const patch = jahizDemoBranding[name];
  if (!patch) throw new Error(`Unknown Jahiz demo branding: ${name}`);
  return structuredClone(patch);
}
