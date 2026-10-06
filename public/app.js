import { DOWNLOAD_URL_REGEX, PHONE_DIGITS_REGEX } from "./settings-policy.js";

const copy = {
  ar: {
    title: "RTS | حلول تقنية لعملك", description: "RTS Royal Technology Solutions: مواقع وتطبيقات وأنظمة نقاط بيع مصممة لعملك.", motto: "Where code becomes power", navAria: "التنقل الرئيسي", menuAria: "فتح القائمة", menuClose: "إغلاق القائمة", menu: "القائمة", skip: "انتقل إلى المحتوى", navServices: "الخدمات", navPos: "نقطة البيع", navApproach: "الأسلوب", navContact: "تواصل", navCta: "ابدأ محادثة", heroKicker: "RTS / تصميم + برمجة + تشغيل", heroTitle: "نبني النظام.<br><span>الذي يحرّك عملك.</span>", heroIntro: "مواقع وتطبيقات وأنظمة بيع مصممة لتبدو استثنائية وتعمل بوضوح.", heroCta: "ناقش احتياجك", heroMore: "شاهد نقطة البيع <i aria-hidden=\"true\">↓</i>", settingsLoading: "جارٍ تجهيز طرق التواصل…", illustrative: "واجهة توضيحية", heroNote: "البيع، واضح في لحظته", posDemoAria: "واجهة نقطة بيع توضيحية", demo: "عرض تجريبي", heroPosTitle: "نقطة البيع", heroTab1: "الأكثر طلباً", heroTab2: "كل المنتجات", item1: "قهوة عربية", item2: "مخبوزات", item3: "عصير طازج", item4: "إضافة جديدة", order: "الطلب", total: "الإجمالي", payDemo: "إتمام تجريبي", introBand: "لا نبيع قالباً جاهزاً. نبدأ بفهم طريقة عملك، ثم نبني المسار الذي يناسبها.", servicesTag: "أدواتك الرقمية", servicesTitle: "حل واحد لا يشبه<br>كل الحلول.", service1Title: "مواقع ومتاجر إلكترونية", service1Text: "واجهة تشرح قيمتك بوضوح وتمنح عملاءك طريقاً بسيطاً للبدء.", service2Title: "تطبيقات سطح المكتب", service2Text: "أدوات عملية لعملياتك اليومية، مصممة حول فريقك وطريقة عمله.", service3Title: "تطبيقات iOS وAndroid", service3Text: "تجارب هاتفية مخصصة عندما يحتاج عملك أن يكون قريباً من المستخدم.", service4Title: "نظام نقاط البيع", service4Text: "مبيعات ومخزون وباركود وفواتير وتقارير وفروع متعددة، مع مساحة لفهم احتياجك أولاً.", posTag: "نقطة البيع · RTS", posTitle: "شاشة البيع<br>هي بداية النظام.", posText: "استكشف مثالاً مبسطاً حسب نوع نشاطك. هذه واجهة توضيحية فقط، وليست نظام عميل أو عملية دفع حقيقية.", sectorAria: "نوع النشاط", sectorMarket: "سوبرماركت", sectorRetail: "محلات تجارية", sectorRestaurant: "مطعم", sectorCoffee: "مقهى", sectorClothing: "ملابس", sectorOther: "أعمال أخرى", interactiveDemo: "تجربة توضيحية تفاعلية", productsAria: "منتجات تجريبية", basket: "سلة العرض", clear: "مسح", basketEmpty: "اختر منتجاً لإضافته هنا.", noPayment: "لن يتم إجراء أي دفع.", posDetails: "يمكن لنظام نقطة البيع أن يجمع المبيعات والمخزون والباركود والفواتير والتقارير والفروع المتعددة. التفاصيل التي تحتاجها في قطاعك نحددها معاً قبل التنفيذ.", posCta: "تحدث عن نشاطك", approachTag: "طريقة العمل", approachTitle: "من سؤال واضح<br>إلى أداة تستخدمها.", step1Title: "نسمع السياق", step1Text: "ما الذي يبطئ فريقك؟ وما الذي يجب أن يبقى بسيطاً؟", step2Title: "نرسم المسار", step2Text: "نحوّل الأولويات إلى شاشات وخطوات يفهمها الجميع.", step3Title: "نبني معك", step3Text: "نطوّر الحل المناسب ونبقى قريبين من تفاصيله العملية.", downloadTag: "لأصحاب Windows", downloadTitle: "برنامج RTS Business الحالي.", downloadText: "تجري إعادة تقديم العلامة تحت RTS. ملف التثبيت الحالي يحمل اسم RTS Business وهو متاح لنظام Windows فقط.", downloadCta: "تنزيل RTS Business لـ Windows", downloadHelp: "إذا حظر Windows الملف، تواصل مع الدعم قبل المتابعة. لا نوصي بتعطيل الحماية.", faqTag: "أسئلة سريعة", faqTitle: "لنبدأ بوضوح.", faq1Q: "هل يمكنني طلب موقع أو تطبيق فقط؟", faq1A: "نعم. نبدأ بالخدمة التي يحتاجها عملك، سواء كانت موقعاً أو تطبيقاً أو أداة مكتبية.", faq2Q: "هل شاشة نقطة البيع المعروضة نظاماً حقيقياً؟", faq2A: "لا. إنها مثال توضيحي تفاعلي يشرح فكرة الواجهة، ولا يعالج مدفوعات أو بيانات حقيقية.", faq3Q: "هل تطبيقات الهاتف تعني توفر POS على iOS أو Android؟", faq3A: "تطبيقات الهاتف هي خدمة تطوير مخصصة. لا يعني ذلك وعداً بتوفر برنامج نقطة البيع للتثبيت على الهاتف.", contactTag: "الخطوة التالية", contactTitle: "لنضع الفكرة<br>على الطاولة.", contactText: "أخبرنا بما تحاول ترتيبه. عند الإرسال، ستفتح محادثة WhatsApp برسالتك لمراجعتها قبل الإرسال.", fieldName: "الاسم", fieldService: "ما الذي تحتاجه؟", fieldBusiness: "اسم النشاط", fieldMessage: "نبذة قصيرة", choose: "اختر خدمة", optionWebsite: "موقع أو متجر إلكتروني", optionDesktop: "تطبيق سطح مكتب", optionMobile: "تطبيق هاتف", optionPos: "نقطة بيع", optionOther: "شيء آخر", formSubmit: "مراجعة رسالة WhatsApp", footerText: "Royal code, Royal power", privacy: "الخصوصية"
  },
  en: {
    title: "RTS | Technology for your business", description: "RTS Royal Technology Solutions: websites, apps, and point-of-sale systems built around your business.", motto: "Where code becomes power", navAria: "Primary navigation", menuAria: "Open menu", menuClose: "Close menu", menu: "Menu", skip: "Skip to content", navServices: "Services", navPos: "Point of sale", navApproach: "Approach", navContact: "Contact", navCta: "Start a conversation", heroKicker: "RTS / DESIGN + CODE + OPERATIONS", heroTitle: "We build the system.<br><span>That moves your work.</span>", heroIntro: "Websites, apps, and point-of-sale systems designed to look exceptional and work clearly.", heroCta: "Discuss your needs", heroMore: "See point of sale <i aria-hidden=\"true\">↓</i>", settingsLoading: "Preparing contact options…", illustrative: "Illustrative interface", heroNote: "A clearer moment of sale", posDemoAria: "Illustrative point-of-sale interface", demo: "DEMO", heroPosTitle: "Point of sale", heroTab1: "Popular", heroTab2: "All products", item1: "Arabic coffee", item2: "Pastry", item3: "Fresh juice", item4: "New add-on", order: "Order", total: "Total", payDemo: "Demo checkout", introBand: "We do not sell a ready-made template. We start by understanding how you work, then build a fitting path.", servicesTag: "Your digital tools", servicesTitle: "One solution<br>not like every other.", service1Title: "Websites & e-commerce", service1Text: "A clear front door for your value, with an easy path for customers to get started.", service2Title: "Desktop applications", service2Text: "Practical tools for daily operations, shaped around your team and its way of working.", service3Title: "iOS & Android applications", service3Text: "Purpose-built mobile experiences when your business needs to stay close to its users.", service4Title: "Point-of-sale system", service4Text: "Sales, inventory, barcode, invoices, reporting, and multiple stores, with room to understand your needs first.", posTag: "Point of sale · RTS", posTitle: "The sales screen<br>starts the system.", posText: "Explore a simple example for your business type. This is an illustrative interface only, not a customer system or a real payment.", sectorAria: "Business type", sectorMarket: "Supermarket", sectorRetail: "Retail shops", sectorRestaurant: "Restaurant", sectorCoffee: "Coffee shop", sectorClothing: "Clothing", sectorOther: "Other businesses", interactiveDemo: "Interactive illustrative demo", productsAria: "Demo products", basket: "Demo basket", clear: "Clear", basketEmpty: "Choose a product to add it here.", noPayment: "No payment will be made.", posDetails: "A POS system can bring together sales, inventory, barcode, invoices, reporting, and multiple stores. We define the details your sector needs together before implementation.", posCta: "Talk about your business", approachTag: "How we work", approachTitle: "From a clear question<br>to a tool you use.", step1Title: "We hear the context", step1Text: "What slows your team down? What must stay simple?", step2Title: "We map the path", step2Text: "We turn priorities into screens and steps everyone can understand.", step3Title: "We build with you", step3Text: "We develop the fitting solution and stay close to its practical details.", downloadTag: "For Windows owners", downloadTitle: "The current RTS Business program.", downloadText: "The brand is being presented under RTS. The current installer is named RTS Business and is available for Windows only.", downloadCta: "Download RTS Business for Windows", downloadHelp: "If Windows blocks the file, contact support before continuing. We do not recommend disabling protection.", faqTag: "Quick questions", faqTitle: "Let’s start clearly.", faq1Q: "Can I request only a website or an app?", faq1A: "Yes. We start with the service your business needs, whether that is a website, app, or desktop tool.", faq2Q: "Is the POS screen shown here a real system?", faq2A: "No. It is an interactive illustrative example of the interface idea. It does not process payments or real data.", faq3Q: "Do mobile apps mean POS is available for iOS or Android?", faq3A: "Mobile apps are a custom development service. This does not promise a POS installer for phones.", contactTag: "Next step", contactTitle: "Let’s put the idea<br>on the table.", contactText: "Tell us what you are trying to organise. On submission, WhatsApp opens with your message so you can review it before sending.", fieldName: "Name", fieldService: "What do you need?", fieldBusiness: "Business name", fieldMessage: "A short brief", choose: "Choose a service", optionWebsite: "Website or e-commerce", optionDesktop: "Desktop application", optionMobile: "Mobile application", optionPos: "Point of sale", optionOther: "Something else", formSubmit: "Review WhatsApp message", footerText: "Royal code, Royal power", privacy: "Privacy"
  }
};

const sectorData = {
  ar: {
    market: { title: "سوبرماركت", catalog: "المنتجات السريعة", copy: "أمثلة لعناصر تظهر خلال البيع اليومي.", products: [["حليب طازج", "₪ 7", "milk"], ["خبز", "₪ 5", "bread"], ["فواكه", "₪ 11", "fruit"], ["مياه", "₪ 4", "water"]], discussion: "يمكننا مناقشة احتياجات الباركود والمخزون والفواتير في سياق عملك." },
    retail: { title: "محلات تجارية", catalog: "عناصر سريعة", copy: "مثال مبسط لواجهة بيع في متجر.", products: [["منتج جديد", "₪ 24", "milk"], ["إكسسوار", "₪ 18", "bread"], ["هدية", "₪ 35", "fruit"], ["مستلزم", "₪ 12", "water"]], discussion: "يمكننا مناقشة الأصناف والمخزون والفواتير وفق طبيعة المتجر." },
    restaurant: { title: "مطعم", catalog: "قائمة الطلب", copy: "مثال لعناصر قائمة أثناء البيع.", products: [["طبق اليوم", "₪ 48", "milk"], ["مقبلات", "₪ 22", "bread"], ["مشروب", "₪ 12", "fruit"], ["حلوى", "₪ 20", "water"]], discussion: "يمكننا مناقشة احتياجات سير الطلبات والتشغيل قبل تحديد التفاصيل." },
    coffee: { title: "مقهى", catalog: "قائمة سريعة", copy: "أمثلة لمشروبات وإضافات يومية.", products: [["قهوة", "₪ 12", "milk"], ["كرواسون", "₪ 15", "bread"], ["عصير", "₪ 16", "fruit"], ["إضافة", "₪ 4", "water"]], discussion: "يمكننا مناقشة سير طلبات المقهى وما يحتاجه فريقك فعلياً." },
    clothing: { title: "ملابس", catalog: "مختارات المتجر", copy: "مثال مبسط لقطع معروضة للبيع.", products: [["قميص", "₪ 80", "milk"], ["بنطال", "₪ 120", "bread"], ["حقيبة", "₪ 95", "fruit"], ["وشاح", "₪ 45", "water"]], discussion: "يمكننا مناقشة احتياجات المقاسات والمتغيرات عند تخطيط نظامك." },
    other: { title: "أعمال أخرى", catalog: "عناصر نموذجية", copy: "نبدأ من عناصر العمل التي تستخدمها فعلاً.", products: [["خدمة", "₪ 30", "milk"], ["منتج", "₪ 20", "bread"], ["إضافة", "₪ 10", "fruit"], ["مادة", "₪ 6", "water"]], discussion: "لنفرض أي تفاصيل مسبقاً. أخبرنا كيف تسير عملياتك ونناقش ما يناسبها." }
  },
  en: {
    market: { title: "Supermarket", catalog: "Quick products", copy: "Examples of items used in everyday sales.", products: [["Fresh milk", "₪ 7", "milk"], ["Bread", "₪ 5", "bread"], ["Fruit", "₪ 11", "fruit"], ["Water", "₪ 4", "water"]], discussion: "We can discuss barcode, inventory, and invoice needs in the context of your business." },
    retail: { title: "Retail shops", catalog: "Quick items", copy: "A simple example of a shop sales interface.", products: [["New product", "₪ 24", "milk"], ["Accessory", "₪ 18", "bread"], ["Gift", "₪ 35", "fruit"], ["Supply", "₪ 12", "water"]], discussion: "We can discuss products, inventory, and invoices according to the store’s nature." },
    restaurant: { title: "Restaurant", catalog: "Order menu", copy: "Examples of menu items during a sale.", products: [["Today’s dish", "₪ 48", "milk"], ["Starter", "₪ 22", "bread"], ["Drink", "₪ 12", "fruit"], ["Dessert", "₪ 20", "water"]], discussion: "We can discuss service flow and operations needs before defining details." },
    coffee: { title: "Coffee shop", catalog: "Quick menu", copy: "Examples of everyday drinks and add-ons.", products: [["Coffee", "₪ 12", "milk"], ["Croissant", "₪ 15", "bread"], ["Juice", "₪ 16", "fruit"], ["Add-on", "₪ 4", "water"]], discussion: "We can discuss coffee-order flow and what your team actually needs." },
    clothing: { title: "Clothing", catalog: "Store picks", copy: "A simple example of items for sale.", products: [["Shirt", "₪ 80", "milk"], ["Trousers", "₪ 120", "bread"], ["Bag", "₪ 95", "fruit"], ["Scarf", "₪ 45", "water"]], discussion: "We can discuss sizes and variants while planning your system." },
    other: { title: "Other businesses", catalog: "Sample items", copy: "We start from items you actually use in your work.", products: [["Service", "₪ 30", "milk"], ["Product", "₪ 20", "bread"], ["Add-on", "₪ 10", "fruit"], ["Material", "₪ 6", "water"]], discussion: "We will not assume details. Tell us how your work flows and we will discuss what fits." }
  }
};

let language = new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "ar";
let activeSector = "market";
let basket = [];
let whatsappNumber = "";
const isMainPage = document.body.dataset.page === "home";
let settingsState = "loading";
const defaultSiteContent = {
  ceoName: "Ahmad Dawabsheh",
  ceoMessage: "نحوّل الأفكار الجريئة إلى أنظمة يثق بها الناس، وتمنح الأعمال قوة أوضح في كل يوم.",
  feedbacks: []
};
const defaultHeroSlides = [
  { type: "image", url: "/assets/hero-royal.svg", alt: "RTS Royal Technology Solutions" },
  { type: "image", url: "/assets/pos-sales.png", alt: "RTS Business sales interface" }
];
let heroScrollerState;
const byId = (id) => document.getElementById(id);
const text = (key) => copy[language][key] || "";

function setupRWireframe(design) {
  if (!["r-orbit", "r-studio", "r-portal"].includes(design)) return;
  const canvas = document.querySelector("[data-r-wireframe]");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const points = [];
  const outlinePoints = [];
  const signalPoints = Array.from({ length: 26 }, (_, index) => ({
    angle: (index / 26) * Math.PI * 2,
    radius: .72 + (index % 5) * .045,
    speed: .00025 + (index % 4) * .00006,
    phase: index * .7
  }));
  const addStroke = (from, to, count = 34) => {
    for (let index = 0; index <= count; index += 1) {
      const ratio = index / count;
      const point = {
        x: from[0] + (to[0] - from[0]) * ratio,
        y: from[1] + (to[1] - from[1]) * ratio,
        outline: true
      };
      points.push(point);
      outlinePoints.push(point);
    }
  };
  addStroke([-.58, -.84], [-.58, .84], 62);
  addStroke([-.58, -.84], [.12, -.84], 30);
  addStroke([.12, -.84], [.12, -.06], 30);
  addStroke([.12, -.06], [-.58, .08], 30);
  addStroke([-.1, .08], [.58, .84], 40);
  for (let index = 0; index < 220; index += 1) {
    const angle = (index / 220) * Math.PI * 2;
    points.push({ x: Math.cos(angle) * .9, y: Math.sin(angle) * .9, orbit: true });
  }
  let width = 0;
  let height = 0;
  let rotation = .25;
  let targetRotation = .25;
  let tilt = 0;
  let targetTilt = 0;
  let zoom = 1;
  let frame;
  let autoRotate = !reducedMotion;
  let dragging = false;
  let moved = false;
  let pointerId = null;
  let lastPointerX = 0;
  let lastPointerY = 0;
  const resize = () => {
    const bounds = canvas.parentElement.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
    width = Math.max(bounds.width, 240);
    height = Math.max(bounds.height, 240);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const render = (time = 0) => {
    context.clearRect(0, 0, width, height);
    rotation += autoRotate ? .0038 : 0;
    rotation += (targetRotation - rotation) * .075;
    tilt += (targetTilt - tilt) * .075;
    const radius = Math.min(width, height) * .38 * zoom;
    const centerX = width / 2;
    const centerY = height / 2;
    const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 1.4);
    glow.addColorStop(0, "rgba(176, 105, 255, .24)");
    glow.addColorStop(1, "rgba(176, 105, 255, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    context.save();
    context.translate(centerX, centerY);
    context.rotate(Math.sin(time * .00025) * .035);
    for (let ring = 0; ring < 4; ring += 1) {
      context.beginPath();
      context.ellipse(0, 0, radius * (1.05 + ring * .12), radius * (.26 + ring * .055), rotation * (.16 + ring * .035), 0, Math.PI * 2);
      context.strokeStyle = `rgba(188, 126, 255, ${.32 - ring * .055})`;
      context.lineWidth = ring === 0 ? 1.6 : 1;
      context.stroke();
    }
    context.beginPath();
    context.moveTo(-radius * 1.32, Math.sin(time * .002) * radius * .18);
    context.lineTo(radius * 1.32, Math.sin(time * .002) * radius * .18);
    context.strokeStyle = "rgba(150, 180, 255, .28)";
    context.lineWidth = 1;
    context.stroke();
    context.save();
    context.globalCompositeOperation = "lighter";
    signalPoints.forEach((signal) => {
      const signalAngle = signal.angle + time * signal.speed;
      const signalDepth = Math.cos(signalAngle + rotation);
      const signalX = Math.cos(signalAngle) * radius * signal.radius;
      const signalY = Math.sin(signalAngle) * radius * signal.radius * .54;
      context.beginPath();
      context.fillStyle = `rgba(160, 190, 255, ${.28 + (signalDepth + 1) * .2})`;
      context.arc(signalX * (.82 + signalDepth * .18), signalY + Math.sin(time * .001 + signal.phase) * 5, 1.2 + signalDepth * .8, 0, Math.PI * 2);
      context.fill();
    });
    context.restore();
    context.beginPath();
    outlinePoints.forEach((point, index) => {
      const depth = Math.cos(rotation + point.x * 1.8);
      const x = point.x * radius * (.88 + depth * .12);
      const y = point.y * radius + tilt * radius * .12;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = "rgba(221, 174, 255, .22)";
    context.lineWidth = 1;
    context.stroke();
    points.forEach((point, index) => {
      const depth = Math.cos(rotation + point.x * 1.8);
      const x = point.orbit ? point.x * radius * 1.25 : point.x * radius;
      const y = point.orbit ? point.y * radius * .34 : point.y * radius;
      const projectedX = x * (0.88 + depth * .12);
      const projectedY = y + tilt * radius * .12;
      const pulse = (Math.sin(time * .003 + index * .23) + 1) * .5;
      const alpha = point.orbit ? .16 + (depth + 1) * .1 : .26 + (depth + 1) * .3 + pulse * .08;
      const size = point.orbit ? 1 + pulse * .5 : 1.15 + (depth + 1) * .7 + pulse * .45;
      context.beginPath();
      context.fillStyle = `rgba(${index % 5 === 0 ? "135, 190, 255" : "220, 150, 255"}, ${alpha * 1.18})`;
      context.arc(projectedX, projectedY, size, 0, Math.PI * 2);
      context.fill();
    });
    const sweep = ((time * .00035) % 2) - 1;
    context.beginPath();
    context.moveTo(sweep * radius * 1.5, -radius);
    context.lineTo(sweep * radius * 1.5 + radius * .7, radius);
    context.strokeStyle = "rgba(130, 190, 255, .3)";
    context.lineWidth = 2;
    context.stroke();
    context.restore();
    if (!reducedMotion) frame = requestAnimationFrame(render);
  };
  resize();
  render();
  window.addEventListener("resize", resize, { passive: true });
  canvas.addEventListener("pointermove", (event) => {
    const bounds = canvas.getBoundingClientRect();
    if (dragging && pointerId === event.pointerId) {
      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      targetRotation += dx * .012;
      targetTilt = Math.max(-1.4, Math.min(1.4, targetTilt - dy * .012));
      moved = moved || Math.abs(dx) + Math.abs(dy) > 4;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      return;
    }
    targetRotation = ((event.clientX - bounds.left) / bounds.width - .5) * 1.8;
    targetTilt = ((event.clientY - bounds.top) / bounds.height - .5) * -1.35;
  });
  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    moved = false;
    pointerId = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    autoRotate = false;
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener("pointerup", (event) => {
    if (pointerId !== event.pointerId) return;
    dragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
    pointerId = null;
    if (moved) window.setTimeout(() => { if (!dragging) autoRotate = true; }, 700);
  });
  canvas.addEventListener("pointercancel", () => {
    dragging = false;
    pointerId = null;
    autoRotate = true;
  });
  canvas.addEventListener("click", () => {
    if (!moved) autoRotate = !autoRotate;
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoom = Math.min(1.55, Math.max(.72, zoom * (event.deltaY > 0 ? .92 : 1.08)));
  }, { passive: false });
  window.addEventListener("pagehide", () => cancelAnimationFrame(frame), { once: true });
}

function setupFuturisticExperience() {
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, "");
  const requestedMode = new URLSearchParams(window.location.search).get("visual");
  const mode = requestedMode === "restrained" || requestedMode === "spectacle" || requestedMode === "immersive"
    ? requestedMode
    : path.endsWith("/restrained") ? "restrained" : path.endsWith("/spectacle") ? "spectacle" : path.endsWith("/immersive") ? "immersive" : "immersive";
  const design = path.includes("design-1-neon") ? "neon" : path.includes("design-2-orbit") ? "orbit" : path.includes("design-3-circuit") ? "circuit" : path.includes("design-4-prism") ? "prism" : path.includes("design-5-terminal") ? "terminal" : path.includes("design-6-r-orbit") ? "r-orbit" : path.includes("design-7-r-studio") ? "r-studio" : path.includes("design-8-r-portal") ? "r-portal" : path.includes("/professional") ? "professional" : path.includes("/neat") ? "neat" : path.includes("/formal") ? "formal" : "core";
  document.body.dataset.visualMode = mode;
  document.body.dataset.design = design;
  setupRWireframe(design);
  const root = document.documentElement;
  const scenes = [...document.querySelectorAll("main > section")];
  scenes.forEach((section) => {
    section.classList.add("scroll-scene");
  });
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    document.querySelectorAll(".scroll-scene").forEach((section) => revealObserver.observe(section));
  } else {
    document.querySelectorAll(".scroll-scene").forEach((section) => section.classList.add("is-visible"));
  }

  const header = document.querySelector(".site-header");
  const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 24);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  let scrollFrame;
  const updateScrollScene = () => {
    scrollFrame = undefined;
    const viewport = window.innerHeight || 1;
    const documentHeight = Math.max(document.documentElement.scrollHeight - viewport, 1);
    const pageProgress = Math.min(Math.max(window.scrollY / documentHeight, 0), 1);
    root.style.setProperty("--page-scroll", `${pageProgress}`);
    document.querySelector(".page-progress")?.style.setProperty("transform", `scaleX(${pageProgress})`);
    scenes.forEach((section) => {
      const bounds = section.getBoundingClientRect();
      const progress = Math.min(Math.max((viewport - bounds.top) / (viewport + bounds.height), 0), 1);
      const centered = (viewport / 2 - (bounds.top + bounds.height / 2)) / Math.max(viewport, bounds.height);
      section.style.setProperty("--scene-progress", progress.toFixed(3));
      section.style.setProperty("--scene-depth", centered.toFixed(3));
      section.toggleAttribute("data-passing", progress > .12 && progress < .88);
    });
    const hero = document.querySelector(".hero");
    if (hero) {
      const heroBounds = hero.getBoundingClientRect();
      const heroProgress = Math.min(Math.max(-heroBounds.top / Math.max(heroBounds.height, 1), 0), 1);
      hero.style.setProperty("--hero-scroll", heroProgress.toFixed(3));
    }
  };
  const requestScrollScene = () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollScene);
  };
  requestScrollScene();
  window.addEventListener("scroll", requestScrollScene, { passive: true });
  window.addEventListener("resize", requestScrollScene, { passive: true });

  const canvas = document.querySelector(".rts-field");
  if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const counts = { restrained: 32, immersive: 68, spectacle: 112 };
  const fieldCount = design === "r-orbit" ? 96 : counts[mode];
  const particles = [];
  const pulses = [];
  const pointer = { x: 0.5, y: 0.35, active: false };
  let width = 0;
  let height = 0;
  let frame = 0;
  let isVisible = !document.hidden;
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const seed = () => {
    particles.length = 0;
    for (let index = 0; index < fieldCount; index += 1) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.6 + 0.35,
        speed: Math.random() * 0.2 + 0.06,
        phase: Math.random() * Math.PI * 2,
        hue: index % 4 === 0 ? 232 : 285 + Math.random() * 30
      });
    }
  };
  const draw = (time) => {
    if (!isVisible) {
      frame = 0;
      return;
    }
    context.clearRect(0, 0, width, height);
    const scrollOffset = 0;
    const driftX = (pointer.x - 0.5) * 36;
    pulses.forEach((pulse, index) => {
      pulse.life -= .012;
      pulse.radius += 3.4;
      if (pulse.life <= 0) pulses.splice(index, 1);
      else {
        context.beginPath();
        context.strokeStyle = `oklch(.78 .22 ${design === "terminal" ? 42 : 310} / ${pulse.life * .38})`;
        context.lineWidth = 1.5;
        context.arc(pulse.x, pulse.y + scrollOffset, pulse.radius, 0, Math.PI * 2);
        context.stroke();
      }
    });
    if (design === "orbit" || design === "r-orbit") {
      for (let ring = 0; ring < 5; ring += 1) {
        const radius = (design === "r-orbit" ? 170 : 130) + ring * (design === "r-orbit" ? 138 : 110) + Math.sin(time * 0.00045 + ring) * 18;
        context.beginPath();
        context.strokeStyle = `oklch(.78 .23 ${design === "r-orbit" ? 292 + ring * 12 : 300 + ring * 8} / ${design === "r-orbit" ? .16 - ring * .018 : .08 - ring * .008})`;
        context.ellipse(width * (.5 + (pointer.x - .5) * .06), (design === "r-orbit" ? 430 : 560) + scrollOffset, radius, radius * (design === "r-orbit" ? .36 : .28), time * .00008, 0, Math.PI * 2);
        context.stroke();
      }
    }
    if (design === "terminal") {
      context.fillStyle = "oklch(.72 .18 42 / .035)";
      for (let line = 0; line < height; line += 32) context.fillRect(0, line + (time * .018 % 32), width, 1);
    }
    particles.forEach((particle, index) => {
      particle.y -= particle.speed;
      if (particle.y < -20) particle.y = height + 20;
      const x = particle.x + driftX + Math.sin(time * 0.00032 + particle.phase) * 16;
      const y = particle.y + scrollOffset;
      const alpha = design === "r-orbit"
        ? 0.36 + ((Math.sin(time * 0.0014 + particle.phase) + 1) / 2) * 0.5
        : design === "terminal"
        ? 0.18 + ((Math.sin(time * 0.001 + particle.phase) + 1) / 2) * 0.22
        : 0.22 + ((Math.sin(time * 0.0014 + particle.phase) + 1) / 2) * 0.38;
      context.beginPath();
      const hue = design === "r-orbit"
        ? (index % 3 === 0 ? 232 : 286 + (index % 5) * 10)
        : design === "terminal" ? 42 : design === "prism" ? (particle.hue + 55) % 360 : particle.hue;
      context.fillStyle = `oklch(${design === "r-orbit" ? .84 : .76} ${design === "r-orbit" ? .22 : .17} ${hue} / ${alpha})`;
      context.arc(x, y, design === "r-orbit" && index % 5 === 0 ? particle.radius * 2.5 : design === "circuit" && index % 4 === 0 ? particle.radius * 1.8 : particle.radius, 0, Math.PI * 2);
      context.fill();
      if ((mode !== "restrained" || design === "r-orbit") && index % (design === "r-orbit" ? 3 : design === "circuit" ? 4 : 6) === 0) {
        const next = particles[(index + 7) % particles.length];
        const nextX = next.x + driftX;
        const nextY = next.y + scrollOffset;
        const distance = Math.hypot(x - nextX, y - nextY);
        if (distance < (design === "r-orbit" ? 230 : design === "circuit" ? 230 : 170)) {
          context.beginPath();
          const reach = design === "r-orbit" ? 230 : design === "circuit" ? 230 : 170;
          context.strokeStyle = `oklch(.78 .22 ${design === "r-orbit" ? 300 : design === "terminal" ? 42 : 300} / ${design === "r-orbit" ? .3 * (1 - distance / reach) : .12 * (1 - distance / reach)})`;
          context.moveTo(x, y);
          context.lineTo(nextX, nextY);
          context.stroke();
        }
      }
      if (design === "prism" && index % 10 === 0) {
        context.beginPath();
        context.strokeStyle = `oklch(.8 .2 38 / ${alpha * .45})`;
        context.moveTo(x - 18, y + 18);
        context.lineTo(x + 18, y - 18);
        context.stroke();
      }
    });
    frame = requestAnimationFrame(draw);
  };
  resize();
  seed();
  window.addEventListener("resize", () => { resize(); seed(); }, { passive: true });
  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX / Math.max(window.innerWidth, 1);
    pointer.y = event.clientY / Math.max(window.innerHeight, 1);
    pointer.active = true;
    root.style.setProperty("--pointer-x", `${event.clientX}px`);
    root.style.setProperty("--pointer-y", `${event.clientY}px`);
  }, { passive: true });
  window.addEventListener("click", (event) => {
    if (event.target.closest("a, button, input, select, textarea, summary")) return;
    pulses.push({ x: event.clientX, y: event.clientY, radius: 10, life: 1.25 });
  });
  document.addEventListener("visibilitychange", () => {
    isVisible = !document.hidden;
    if (isVisible && !frame) frame = requestAnimationFrame(draw);
  });
  window.addEventListener("pagehide", () => cancelAnimationFrame(frame), { once: true });
  requestAnimationFrame(draw);
}

Object.assign(copy.ar, {
  motto: "Where code becomes power",
  brandStatementTag: "RTS / البوصلة التي تقودنا",
  service1Title: "مواقع تحوّل حضورك إلى حركة",
  service1Text: "تجارب رقمية تشرح قيمتك بسرعة، وتحوّل الزيارة الأولى إلى خطوة واضحة.",
  service2Title: "أدوات تشغيل تقلل الاحتكاك",
  service2Text: "تطبيقات مكتبية مصممة حول عمليات فريقك، من أول إدخال إلى القرار الأخير.",
  service4Title: "RTS Business: قوة التشغيل في لحظتها",
  service4Text: "مبيعات، مخزون، فواتير وتقارير مترابطة تمنحك صورة أسرع وتحكماً أكبر.",
  ceoMessage: "نحوّل الأفكار الجريئة إلى أنظمة يثق بها الناس، وتمنح الأعمال قوة أوضح في كل يوم.",
  navFeedback: "آراء العملاء",
  ceoTag: "رسالة القيادة",
  ceoMessage: defaultSiteContent.ceoMessage,
  feedbackTag: "أصوات العملاء",
  feedbackTitle: "تجارب تُقاس بما تغيّره.",
  heroIntro: "مواقع وتطبيقات وأنظمة بيع مصممة لتبدو استثنائية وتعمل بوضوح.",
  introBand: "من أول انطباع إلى آخر فاتورة، نصمم تجربة واحدة تعمل معك.",
  servicesTitle: "كل شاشة.<br>نفس الفكرة القوية.",
  craftStrategy: "نفهم",
  craftDesign: "نصمم",
  craftBuild: "نبرمج",
  craftLaunch: "نطلق",
  craftAria: "الفهم والتصميم والبرمجة والإطلاق",
  contactTitle: "لنصنع شيئاً<br>يستحق الاستخدام.",
  contactText: "شاركنا احتياجك. سنفتح رسالتك في WhatsApp لتراجعها قبل الإرسال.",
  fieldRequired: "أدخل قيمة صحيحة لهذا الحقل.",
  heroNote: "واجهة RTS Business الجديدة",
  sandboxTitle: "جرّب فكرة البيع حسب نشاطك",
  sectorCoverage: "للسوبرماركت، المحلات، المطاعم، المقاهي، متاجر الملابس، ومختلف الأنشطة التجارية.",
  faq2Q: "هل الصور من التطبيق الفعلي؟",
  faq2A: "نعم، صورة المعرض من تطبيق RTS Business الفعلي. أما التجربة التفاعلية فهي مثال مبسط ولا تعالج أي عملية دفع.",
  designExamplesAria: "أمثلة تصميم توضيحية",
  designExamplesTitle: "هوية واحدة.<br>تجربة متكاملة.",
  designExamplesText: "من واجهة الموقع إلى تفاصيل التطبيق، نصمم تجربة متناسقة على كل شاشة. تصورات توضيحية لما يمكن أن نبنيه لعلامتك.",
  sitePreviewTitle: "مكان واضح لعلامتك.",
  phonePreviewTitle: "مهمة اليوم",
  retry: "إعادة المحاولة",
  actualAppAria: "لقطة شاشة فعلية من تطبيق RTS Business",
  insideApp: "من داخل التطبيق",
  openImage: "عرض بالحجم الكامل",
  closeImage: "إغلاق",
  galleryAria: "لقطة فعلية من تطبيق RTS Business",
  galleryTabsAria: "اختيار لقطة شاشة",
  galleryTag: "من داخل التطبيق",
  galleryTitle: "كل تفاصيل عملك.<br>في مكان واحد.",
  galleryText: "واجهة تشغيل فعلية من RTS Business بهويته الجديدة، مصممة للسرعة والوضوح أثناء العمل اليومي.",
  gallerySales: "المبيعات",
  downloadTitle: "RTS Business 4.0.1.",
  downloadText: "هوية جديدة وواجهة تشغيل واضحة للمبيعات والمخزون والفواتير وإدارة نشاطك.",
  downloadCta: "تنزيل RTS Business لـ Windows",
  mobilePreviewAria: "تصور توضيحي لتطبيق هاتف مخصص"
});
Object.assign(copy.en, {
  motto: "Where code becomes power",
  brandStatementTag: "RTS / OUR NORTH STAR",
  service1Title: "Websites that move your presence",
  service1Text: "Digital experiences that explain your value quickly and turn a first visit into a clear next step.",
  service2Title: "Operations with less friction",
  service2Text: "Desktop tools shaped around your team, from the first input to the final decision.",
  service4Title: "RTS Business: power for daily operations",
  service4Text: "Connected sales, inventory, invoices, and reporting for faster visibility and stronger control.",
  ceoMessage: "We turn bold ideas into systems people trust, giving businesses clearer power every day.",
  navFeedback: "Client feedback",
  ceoTag: "A message from leadership",
  ceoMessage: "We turn bold ideas into systems people trust, giving businesses clearer power every day.",
  feedbackTag: "Client feedback",
  feedbackTitle: "Experiences measured by what they change.",
  heroIntro: "Websites, apps, and point-of-sale systems designed to look exceptional and work clearly.",
  introBand: "From first impression to final invoice, we design one experience that works with you.",
  servicesTitle: "Every screen.<br>One strong idea.",
  craftStrategy: "Understand",
  craftDesign: "Design",
  craftBuild: "Build",
  craftLaunch: "Launch",
  craftAria: "Understand, design, build, and launch",
  contactTitle: "Let’s build something<br>worth using.",
  contactText: "Share what you need. We will open your message in WhatsApp so you can review it before sending.",
  fieldRequired: "Enter a valid value for this field.",
  heroNote: "The new RTS Business interface",
  sandboxTitle: "Explore a sales demo for your business",
  sectorCoverage: "For supermarkets, retail shops, restaurants, coffee shops, clothing stores, and businesses of every kind.",
  faq2Q: "Are these images from the real application?",
  faq2A: "Yes. The gallery shows the real RTS Business application. The interactive sales demo is a simplified illustration and does not process payments.",
  designExamplesAria: "Illustrative design examples",
  designExamplesTitle: "One identity.<br>Every screen.",
  designExamplesText: "From the website to the smallest app interaction, we design a connected experience. Illustrative concepts of what we can build for your brand.",
  sitePreviewTitle: "A clear place for your brand.",
  phonePreviewTitle: "Today’s task",
  retry: "Try again",
  actualAppAria: "Actual RTS Business application screenshot",
  insideApp: "Inside the actual app",
  openImage: "View full size",
  closeImage: "Close",
  galleryAria: "Actual RTS Business application screenshot",
  galleryTabsAria: "Choose a screenshot",
  galleryTag: "Inside the actual app",
  galleryTitle: "Your daily business.<br>In one place.",
  galleryText: "A real RTS Business operations interface in its new identity, designed for speed and clarity during daily work.",
  gallerySales: "Sales",
  downloadTitle: "RTS Business 4.0.1.",
  downloadText: "A new identity and a clear workspace for sales, inventory, invoices, and business operations.",
  downloadCta: "Download RTS Business for Windows",
  mobilePreviewAria: "Illustrative custom mobile application preview"
});
sectorData.ar.other.discussion = "لن نفترض أي تفاصيل مسبقاً. أخبرنا كيف تسير عملياتك ونناقش ما يناسبها.";
const screenshots = {
  sales: { src: "/assets/pos-sales.png", ar: "لقطة شاشة فعلية من شاشة المبيعات في RTS Business", en: "Actual RTS Business sales screen screenshot" }
};
let activeScreenshot = "sales";
let dialogTrigger;
const subpageCopy = {
  privacy: {
    ar: { title: "RTS | الخصوصية", back: "العودة للموقع", tag: "RTS · الخصوصية", heading: "خصوصيتك، بوضوح.", collectionH: "ما الذي يجمعه هذا الموقع؟", collection: "لا يستخدم الموقع العام تحليلات أو ملفات تعريف ارتباط تسويقية. لا تُخزّن بيانات نموذج التواصل على خادم الموقع؛ عند اختيار إرسال النموذج، تُجهَّز رسالة وتُفتح في WhatsApp لتراجعها قبل إرسالها.", whatsappH: "WhatsApp", whatsapp: "عند المتابعة من نموذج التواصل، تنتقل الرسالة إلى WhatsApp، وهي خدمة طرف ثالث تخضع لسياسة الخصوصية الخاصة بها. لا ترسل النموذج إذا لم ترغب في مشاركة محتواه عبر WhatsApp.", cookiesH: "ملفات تعريف الارتباط والجلسة الإدارية", cookies: "لا يضع الموقع العام ملفات تعريف ارتباط. تستخدم منطقة الإدارة الخاصة جلسة إدارية ضرورية للحفاظ على تسجيل الدخول.", hostingH: "الاستضافة", hosting: "تعالج Cloudflare بيانات الاتصال والأمان الاعتيادية، بما في ذلك عنوان IP، لتقديم الموقع وحمايته. لا نستخدم ذلك للتحليلات التسويقية.", updatesH: "تحديثات هذه السياسة", updates: "قد نحدّث هذه الصفحة عندما تتغير طريقة عمل الموقع. سننشر النسخة المحدثة هنا.", return: "العودة إلى RTS", privacy: "الخصوصية" },
    en: { title: "RTS | Privacy", back: "Back to site", tag: "RTS · PRIVACY", heading: "Your privacy, clearly.", collectionH: "What does this site collect?", collection: "The public site uses no analytics or marketing cookies. Contact-form details are not stored on the site server; choosing to submit prepares a message and opens WhatsApp so you can review it before sending.", whatsappH: "WhatsApp", whatsapp: "Continuing from the contact form sends the message to WhatsApp, a third-party service governed by its own privacy policy. Do not submit the form if you do not want to share its content through WhatsApp.", cookiesH: "Cookies and the admin session", cookies: "The public site sets no cookies. The private admin area uses a necessary administrative session cookie to keep an administrator signed in.", hostingH: "Hosting", hosting: "Cloudflare processes normal connection and security data, including IP address, to serve and protect the site. We do not use this for marketing analytics.", updatesH: "Policy updates", updates: "We may update this page if the site’s operation changes. The updated version will be published here.", return: "Back to RTS", privacy: "Privacy" }
  },
  download: {
    ar: { title: "RTS | تنزيل RTS Business", back: "العودة للموقع", tag: "RTS · WINDOWS", heading: "تنزيل RTS Business.", installerH: "RTS Business لنظام Windows", installer: "هوية RTS Business وواجهة تشغيل أكثر وضوحاً للمبيعات والمخزون والفواتير.", download: "تنزيل RTS Business لـ Windows", beforeH: "قبل المتابعة", before: "هذا التنزيل مخصص لـ Windows فقط. إذا حظر Windows الملف أو ظهرت لك رسالة أمان، تواصل مع الدعم قبل المتابعة. لا نوصي بتعطيل حماية Windows.", return: "العودة إلى RTS", privacy: "الخصوصية", retry: "إعادة المحاولة" },
    en: { title: "RTS | Download RTS Business", back: "Back to site", tag: "RTS · WINDOWS", heading: "Download RTS Business.", installerH: "RTS Business for Windows", installer: "The RTS Business identity and a clearer workspace for sales, inventory, invoices, and operations.", download: "Download RTS Business for Windows", beforeH: "Before you continue", before: "This download is for Windows only. If Windows blocks the file or shows a security message, contact support before proceeding. We do not recommend disabling Windows protection.", return: "Back to RTS", privacy: "Privacy", retry: "Try again" }
  },
  downloadClinic: {
    ar: { title: "RTS | تنزيل RTS Clinic", back: "العودة للموقع" },
    en: { title: "RTS | Download RTS Clinic", back: "Back to site" }
  }
};

function translatedNodes(value) {
  const fragment = document.createDocumentFragment();
  const pieces = value.split(/(<br>|<span>|<\/span>|<i aria-hidden="true">|<\/i>)/);
  let activeSpan;
  let activeItalic;
  pieces.forEach((piece) => {
    if (piece === "<br>") { fragment.append(document.createElement("br")); return; }
    if (piece === "<span>") { activeSpan = document.createElement("span"); fragment.append(activeSpan); return; }
    if (piece === "</span>") { activeSpan = undefined; return; }
    if (piece === '<i aria-hidden="true">') { activeItalic = document.createElement("i"); activeItalic.setAttribute("aria-hidden", "true"); fragment.append(activeItalic); return; }
    if (piece === "</i>") { activeItalic = undefined; return; }
    (activeItalic || activeSpan || fragment).append(document.createTextNode(piece));
  });
  return fragment;
}
function setMenuState(open, focusTarget) {
  const menu = document.querySelector(".menu-toggle");
  const navigation = byId("primary-navigation");
  if (!menu || !navigation) return;
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute("aria-label", text(open ? "menuClose" : "menuAria"));
  navigation.classList.toggle("open", open);
  if (focusTarget === "first-link") navigation.querySelector("a")?.focus();
  if (focusTarget === "button") menu.focus();
}
function updateCopy() {
  const dictionary = copy[language];
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = dictionary.title;
  document.querySelector('meta[name="description"]').setAttribute("content", dictionary.description);
  document.querySelector(".hero-screenshot img").alt = screenshots.sales[language];
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = dictionary[element.dataset.i18n];
    if (value === undefined) return;
    element.replaceChildren(translatedNodes(value));
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
    element.setAttribute("aria-label", dictionary[element.dataset.i18nAria]);
  });
  document.querySelector(".language-toggle").textContent = language === "ar" ? "EN" : "ع";
  document.querySelector(".language-toggle").setAttribute("aria-label", language === "ar" ? "Switch to English" : "التبديل إلى العربية");
  setMenuState(document.querySelector(".menu-toggle")?.getAttribute("aria-expanded") === "true");
  updateSector(activeSector, true);
  renderBasket();
  renderSettingsState();
  propagateLanguageLinks();
  updateGallery(activeScreenshot);
}
function propagateLanguageLinks() {
  document.querySelectorAll("a[href^='/']").forEach((link) => {
    const url = new URL(link.getAttribute("href"), window.location.origin);
    language === "en" ? url.searchParams.set("lang", "en") : url.searchParams.delete("lang");
    link.setAttribute("href", `${url.pathname}${url.search}${url.hash}`);
  });
}
function updateSubpageCopy() {
  const page = document.body.dataset.page;
  const dictionary = subpageCopy[page]?.[language];
  if (!dictionary) return;
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = dictionary.title;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = dictionary[element.dataset.i18n];
    if (value !== undefined) element.textContent = value;
  });
  const toggle = document.querySelector(".language-toggle");
  toggle.textContent = language === "ar" ? "EN" : "ع";
  toggle.setAttribute("aria-label", language === "ar" ? "Switch to English" : "التبديل إلى العربية");
  propagateLanguageLinks();
}
function updateSector(sector, preserveBasket = false) {
  activeSector = sector;
  const data = sectorData[language][sector];
  byId("sector-title").textContent = data.title;
  byId("catalog-title").textContent = data.catalog;
  byId("sector-copy").textContent = data.copy;
  byId("sector-discussion").textContent = data.discussion;
  document.querySelectorAll(".sector").forEach((button) => {
    const selected = button.dataset.sector === sector;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  document.querySelectorAll("#demo-products button").forEach((button, index) => {
    const [name, price, visual] = data.products[index];
    button.dataset.name = name;
    button.dataset.price = price;
    button.querySelector(".product-visual").className = `product-visual ${visual}`;
    button.querySelector("span").textContent = name;
    button.querySelector("b").textContent = price;
  });
  if (!preserveBasket) basket = [];
  renderBasket();
}
function updateGallery(name) {
  activeScreenshot = name;
  const image = byId("gallery-image");
  const data = screenshots[name];
  if (!image || !data) return;
  image.src = data.src;
  image.alt = data[language];
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    image.animate(
      [{ opacity: 0.35, transform: "scale(.985)" }, { opacity: 1, transform: "scale(1)" }],
      { duration: 260, easing: "cubic-bezier(.16, 1, .3, 1)" }
    );
  }
  const galleryFrame = document.querySelector(".gallery-screen");
  if (galleryFrame) galleryFrame.dataset.shot = name;
  byId("gallery-panel")?.setAttribute("aria-labelledby", `shot-${name}`);
  document.querySelectorAll(".gallery-controls [role='tab']").forEach((button) => {
    const selected = button.dataset.shot === name;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
}
  function isSafeHeroUrl(value) {
    if (typeof value !== "string" || !value.trim()) return false;
    const url = value.trim();
    if (url.startsWith("/") && !url.startsWith("//")) return true;
    try {
      return new URL(url, window.location.origin).protocol === "https:";
    } catch {
      return false;
    }
  }
  function normalizeHeroSlides(value) {
    const source = Array.isArray(value) ? value : [];
    return source
      .slice(0, 8)
      .map((item) => {
        if (!item || !["image", "video"].includes(item.type) || !isSafeHeroUrl(item.url)) return null;
        return {
          type: item.type,
          url: item.url.trim(),
          poster: isSafeHeroUrl(item.poster) ? item.poster.trim() : "",
          alt: typeof item.alt === "string" ? item.alt.trim().slice(0, 160) : ""
        };
      })
      .filter(Boolean);
  }
  function setupHeroScroller(initialSlides = defaultHeroSlides) {
    const root = document.querySelector("[data-hero-scroller]");
    const track = root?.querySelector("[data-hero-track]");
    if (!root || !track) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = {
      root,
      track,
      slides: [],
      index: 0,
      timer: null,
      progressFrame: null,
      startedAt: 0,
      duration: 6200,
      paused: reducedMotion
    };
    heroScrollerState = state;
    const counter = root.querySelector("[data-hero-counter]");
    const progress = root.querySelector("[data-hero-progress]");
    const render = () => {
      const slideCount = Math.max(state.slides.length, 1);
      track.style.setProperty("--slide-count", slideCount);
      track.style.width = `${slideCount * 100}%`;
      track.style.transform = `translate3d(${-state.index * (100 / slideCount)}%, 0, 0)`;
      if (counter) counter.textContent = `${String(state.index + 1).padStart(2, "0")} / ${String(state.slides.length).padStart(2, "0")}`;
      state.slides.forEach((slide, index) => {
        slide.classList.toggle("is-active", index === state.index);
        const media = slide.querySelector("video");
        if (!media) return;
        if (index === state.index) media.play().catch(() => {});
        else {
          media.pause();
          media.currentTime = 0;
        }
      });
      state.startedAt = performance.now();
      if (progress) progress.style.transform = "scaleX(0)";
    };
    const next = (step = 1) => {
      if (state.slides.length < 2) return;
      state.index = (state.index + step + state.slides.length) % state.slides.length;
      render();
    };
    const tick = (time) => {
      if (!state.paused && state.slides.length > 1) {
        const elapsed = time - state.startedAt;
        if (progress) progress.style.transform = `scaleX(${Math.min(elapsed / state.duration, 1)})`;
        if (elapsed >= state.duration) next();
      }
      state.progressFrame = requestAnimationFrame(tick);
    };
    const renderSlides = (value) => {
      state.slides = [];
      track.replaceChildren();
      const slides = normalizeHeroSlides(value);
      const source = slides.length ? slides : defaultHeroSlides;
      source.forEach((item, index) => {
        const slide = document.createElement("figure");
        slide.className = "hero-media-slide";
        slide.style.setProperty("--slide-index", index);
        if (item.type === "video") {
          const video = document.createElement("video");
          video.src = item.url;
          video.autoplay = index === 0 && !reducedMotion;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = "metadata";
          if (item.poster) video.poster = item.poster;
          video.setAttribute("aria-label", item.alt || "RTS hero video");
          slide.append(video);
        } else {
          const image = document.createElement("img");
          image.src = item.url;
          image.alt = item.alt || "RTS hero image";
          image.loading = index === 0 ? "eager" : "lazy";
          slide.append(image);
        }
        track.append(slide);
        state.slides.push(slide);
      });
      state.index = Math.min(state.index, state.slides.length - 1);
      render();
    };
    root.querySelector("[data-hero-prev]")?.addEventListener("click", () => next(-1));
    root.querySelector("[data-hero-next]")?.addEventListener("click", () => next());
    root.addEventListener("mouseenter", () => { state.paused = true; });
    root.addEventListener("mouseleave", () => { state.paused = reducedMotion; state.startedAt = performance.now(); });
    root.addEventListener("focusin", () => { state.paused = true; });
    root.addEventListener("focusout", () => { state.paused = reducedMotion; state.startedAt = performance.now(); });
    root.addEventListener("touchstart", () => { state.paused = true; }, { passive: true });
    root.addEventListener("touchend", () => { state.paused = reducedMotion; state.startedAt = performance.now(); }, { passive: true });
    renderSlides(initialSlides);
    if (!reducedMotion) state.progressFrame = requestAnimationFrame(tick);
  }
  function updateHeroScroller(value) {
    if (!heroScrollerState) return;
    const slides = normalizeHeroSlides(value);
    heroScrollerState.slides.length = 0;
    heroScrollerState.track.replaceChildren();
    const source = slides.length ? slides : defaultHeroSlides;
    source.forEach((item, index) => {
      const slide = document.createElement("figure");
      slide.className = "hero-media-slide";
      const media = item.type === "video" ? document.createElement("video") : document.createElement("img");
      media.src = item.url;
      media.alt = item.alt || "RTS hero media";
      if (item.type === "video") {
        media.autoplay = index === 0;
        media.muted = true;
        media.loop = true;
        media.playsInline = true;
        media.preload = "metadata";
        if (item.poster) media.poster = item.poster;
      } else {
        media.loading = index === 0 ? "eager" : "lazy";
      }
      slide.append(media);
      heroScrollerState.track.append(slide);
      heroScrollerState.slides.push(slide);
    });
    heroScrollerState.index = 0;
    heroScrollerState.track.style.setProperty("--slide-count", Math.max(heroScrollerState.slides.length, 1));
    heroScrollerState.track.style.width = `${Math.max(heroScrollerState.slides.length, 1) * 100}%`;
    heroScrollerState.track.style.transform = "translate3d(0, 0, 0)";
    heroScrollerState.root.querySelector("[data-hero-counter]").textContent = `01 / ${String(heroScrollerState.slides.length).padStart(2, "0")}`;
    heroScrollerState.startedAt = performance.now();
    heroScrollerState.slides[0]?.querySelector("video")?.play().catch(() => {});
  }
function openScreenshot(name, trigger) {
  const dialog = byId("screenshot-dialog");
  const data = screenshots[name];
  if (!dialog || !data) return;
  dialogTrigger = trigger;
  byId("dialog-image").src = data.src;
  byId("dialog-image").alt = data[language];
  dialog.showModal();
  dialog.querySelector("[data-dialog-close]").focus();
}
function parsePrice(value) { return Number(value.replace(/[^\d.]/g, "")); }
function renderBasket() {
  const list = byId("basket-items");
  const empty = byId("basket-empty");
  list.replaceChildren();
  let total = 0;
  basket.forEach((item) => {
    total += item.amount;
    const row = document.createElement("li");
    const label = document.createElement("span");
    const price = document.createElement("b");
    label.textContent = sectorData[language][activeSector].products[item.index][0];
    price.textContent = `₪ ${item.amount}`;
    row.append(label, price);
    list.append(row);
  });
  empty.hidden = basket.length > 0;
  if (!basket.length) empty.textContent = text("basketEmpty");
  byId("basket-total").textContent = `₪ ${total}`;
}
function setContactState(message, isError = false) {
  const status = document.querySelector(".settings-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}
function renderSettingsState() {
  const retry = byId("settings-retry");
  const status = document.querySelector(".settings-status");
  if (!status) return;
  if (settingsState === "ready") setContactState(isMainPage ? (language === "ar" ? "التواصل جاهز عندما تكون مستعداً." : "Contact is ready when you are.") : "");
  if (settingsState === "error") {
    const message = isMainPage
      ? (language === "ar" ? "تعذر تحميل وسيلة التواصل. حاول مجدداً." : "We could not load contact details. Try again.")
      : (language === "ar" ? "تعذر التحقق من رابط التنزيل الحالي. حاول مجدداً." : "We could not verify the download link. Try again.");
    setContactState(message, true);
  }
  if (settingsState === "loading") setContactState(text("settingsLoading"));
  if (retry) {
    retry.hidden = settingsState !== "error";
    retry.textContent = text("retry");
  }
}
function isAllowedDownloadUrl(value) {
  return typeof value === "string" && DOWNLOAD_URL_REGEX.test(value);
}
function applySiteContent(content) {
  const data = { ...defaultSiteContent, ...(content || {}) };
  const ceoName = byId("ceo-name");
  const ceoMessage = byId("ceo-message");
  if (ceoName && data.ceoName) ceoName.textContent = data.ceoName;
  if (ceoMessage && data.ceoMessage) ceoMessage.textContent = data.ceoMessage;
  const grid = byId("testimonial-grid");
  if (grid && Array.isArray(data.feedbacks) && data.feedbacks.length) {
    grid.replaceChildren(...data.feedbacks.slice(0, 6).map((item) => {
      const card = document.createElement("article");
      card.className = "testimonial-card";
      const name = document.createElement("strong");
      name.textContent = item.name || "RTS client";
      const textNode = document.createElement("p");
      textNode.textContent = item.text || "";
      card.append(name, textNode);
      return card;
    }));
  }
  const heroSlides = Array.isArray(data.heroSlides) && data.heroSlides.length
    ? data.heroSlides
    : data.heroMedia;
  updateHeroScroller(heroSlides || defaultHeroSlides);
}
function setupThemeToggle() {
  const toggle = document.querySelector(".theme-toggle");
  if (!toggle) return;
  const storedTheme = localStorage.getItem("rts-theme");
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  let theme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : systemTheme;
  const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    document.body.dataset.theme = theme;
    toggle.textContent = theme === "dark" ? "☀" : "☾";
    toggle.setAttribute("aria-label", theme === "dark" ? "تفعيل المظهر الفاتح" : "تفعيل المظهر الداكن");
  };
  apply();
  toggle.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem("rts-theme", theme);
    apply();
  });
  systemPreference.addEventListener?.("change", (event) => {
    if (localStorage.getItem("rts-theme")) return;
    theme = event.matches ? "dark" : "light";
    apply();
  });
}
async function loadSettings() {
  settingsState = "loading";
  whatsappNumber = "";
  const downloadLink = byId("download-link");
  if (downloadLink) {
    downloadLink.setAttribute("aria-disabled", "true");
    downloadLink.removeAttribute("href");
  }
  document.querySelectorAll(".js-contact-link").forEach((link) => {
    link.setAttribute("aria-disabled", "true");
    link.tabIndex = -1;
  });
  if (byId("contact-submit")) byId("contact-submit").disabled = true;
  renderSettingsState();
  try {
    const response = await fetch("/api/settings", { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Settings unavailable");
    const settings = await response.json();
    applySiteContent(settings.content);
    if (downloadLink && !isAllowedDownloadUrl(settings.downloadUrl)) throw new Error("Invalid download URL");
    if (typeof settings.whatsappNumber !== "string" || !PHONE_DIGITS_REGEX.test(settings.whatsappNumber)) throw new Error("Invalid contact number");
    if (downloadLink) {
      downloadLink.href = "/download/rts-business";
      downloadLink.download = "RTS-Business-Setup.exe";
      downloadLink.setAttribute("aria-disabled", "false");
    }
    whatsappNumber = settings.whatsappNumber;
    document.querySelectorAll(".js-contact-link").forEach((link) => {
      link.href = "#contact";
      link.setAttribute("aria-disabled", "false");
      link.removeAttribute("tabindex");
    });
    const contactSubmit = byId("contact-submit");
    if (contactSubmit) contactSubmit.disabled = false;
    settingsState = "ready";
    renderSettingsState();
  } catch {
    settingsState = "error";
    renderSettingsState();
  }
}
function formMessage(data) {
  const serviceLabel = document.querySelector(`select[name="service"] option[value="${CSS.escape(data.service)}"]`)?.textContent || data.service;
  return language === "ar"
    ? `مرحباً RTS،\n\nالاسم: ${data.name}\nالخدمة: ${serviceLabel}\nالنشاط: ${data.business}\n\n${data.message}`
    : `Hello RTS,\n\nName: ${data.name}\nService: ${serviceLabel}\nBusiness: ${data.business}\n\n${data.message}`;
}
if (isMainPage) {
  setupFuturisticExperience();
  setupHeroScroller();
  document.querySelectorAll("[data-request-service]").forEach(link => {
    link.addEventListener("click", () => {
      document.querySelector('[name="service"]').value = link.dataset.requestService;
    });
  });
  document.querySelector(".language-toggle").addEventListener("click", () => {
    language = language === "ar" ? "en" : "ar";
    const url = new URL(window.location.href);
    language === "en" ? url.searchParams.set("lang", "en") : url.searchParams.delete("lang");
    window.history.replaceState({}, "", url);
    updateCopy();
  });
  document.querySelectorAll(".sector").forEach((button) => button.addEventListener("click", () => updateSector(button.dataset.sector)));
  document.querySelectorAll(".gallery-controls [role='tab']").forEach((button) => button.addEventListener("click", () => updateGallery(button.dataset.shot)));
  document.querySelector(".gallery-controls").addEventListener("keydown", event => {
    const tabs = [...document.querySelectorAll(".gallery-controls [role='tab']")];
    const current = tabs.indexOf(document.activeElement);
    if (current < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let next;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else {
      const forward = (event.key === "ArrowRight") === (language === "en");
      next = (current + (forward ? 1 : -1) + tabs.length) % tabs.length;
    }
    updateGallery(tabs[next].dataset.shot);
    tabs[next].focus();
  });
  document.querySelectorAll("[data-dialog-open]").forEach((button) => button.addEventListener("click", () => openScreenshot(button.dataset.shot, button)));
  byId("screenshot-dialog").querySelector("[data-dialog-close]").addEventListener("click", () => byId("screenshot-dialog").close());
  byId("screenshot-dialog").addEventListener("close", () => dialogTrigger?.focus());
  document.querySelectorAll("#demo-products button").forEach((button) => button.addEventListener("click", () => {
    basket.push({ index: [...document.querySelectorAll("#demo-products button")].indexOf(button), amount: parsePrice(button.dataset.price) });
    renderBasket();
  }));
  byId("clear-basket").addEventListener("click", () => { basket = []; renderBasket(); });
  byId("demo-pay").addEventListener("click", () => { byId("basket-empty").textContent = language === "ar" ? "عرض فقط. لم يتم إجراء أي دفع." : "Demo only. No payment was made."; byId("basket-empty").hidden = false; });
  byId("settings-retry").addEventListener("click", loadSettings);
  const menu = document.querySelector(".menu-toggle");
  const navigation = byId("primary-navigation");
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") === "true";
    setMenuState(!open, open ? undefined : "first-link");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navigation.classList.contains("open")) setMenuState(false, "button");
  });
  navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenuState(false)));
  byId("contact-form").querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("input", () => {
      field.setAttribute("aria-invalid", "false");
      const fieldError = byId(`${field.name}-error`);
      if (fieldError) fieldError.textContent = "";
    });
  });
  byId("contact-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = byId("form-status");
  const data = Object.fromEntries(new FormData(form).entries());
  const limits = { name: 80, business: 100, message: 1000 };
  const fields = ["name", "service", "business", "message"];
  let firstInvalid;
  fields.forEach((name) => {
    const field = form.elements.namedItem(name);
    const value = typeof data[name] === "string" ? data[name].trim() : "";
    data[name] = value;
    const isService = name === "service";
    const validService = !isService || [...field.options].some((option) => option.value === value && value);
    const validLength = isService || (value.length >= 2 && value.length <= limits[name]);
    const valid = validService && validLength;
    field.setAttribute("aria-invalid", String(!valid));
    const fieldError = byId(`${name}-error`);
    if (fieldError) fieldError.textContent = valid ? "" : text("fieldRequired");
    if (!valid && !firstInvalid) firstInvalid = field;
  });
  if (firstInvalid) {
    status.textContent = language === "ar" ? "أكمل الحقل المحدد بإدخال واضح قبل المتابعة." : "Complete the highlighted field with a clear entry before continuing.";
    firstInvalid.focus();
    return;
  }
  if (!whatsappNumber) { status.textContent = language === "ar" ? "وسيلة التواصل غير جاهزة. حدّث الصفحة وحاول مجدداً." : "Contact is not ready. Refresh the page and try again."; return; }
  status.textContent = language === "ar" ? "سيتم فتح WhatsApp لمراجعة رسالتك." : "WhatsApp will open so you can review your message.";
  window.location.assign(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(formMessage(data))}`);
  });
  byId("year").textContent = new Date().getFullYear();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const navSections = [...document.querySelectorAll("#services, #pos, #testimonials, #contact")];
  if ("IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        document.querySelectorAll("#primary-navigation a[href^='#']").forEach((link) => {
          if (link.getAttribute("href") === `#${entry.target.id}`) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-35% 0px -55% 0px", threshold: 0 });
    navSections.forEach((section) => navObserver.observe(section));
  }
  const heroScreenshot = document.querySelector(".hero-screenshot");
  if (heroScreenshot && !reducedMotion && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    let pointerFrame;
    heroScreenshot.addEventListener("pointermove", (event) => {
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        const bounds = heroScreenshot.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 5;
        const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * -5;
        heroScreenshot.style.setProperty("--tilt-x", `${x}deg`);
        heroScreenshot.style.setProperty("--tilt-y", `${y}deg`);
        pointerFrame = undefined;
      });
    });
    heroScreenshot.addEventListener("pointerleave", () => {
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      pointerFrame = undefined;
      heroScreenshot.style.removeProperty("--tilt-x");
      heroScreenshot.style.removeProperty("--tilt-y");
    });
  }
  updateCopy();
  setupThemeToggle();
  loadSettings();
} else {
  updateSubpageCopy();
  document.querySelector(".language-toggle")?.addEventListener("click", () => {
    const url = new URL(window.location.href);
    language === "ar" ? url.searchParams.set("lang", "en") : url.searchParams.delete("lang");
    window.location.assign(url);
  });
  if (["download", "download-clinic"].includes(document.body.dataset.page)) {
    byId("settings-retry")?.addEventListener("click", loadSettings);
    loadSettings();
  }
}
