import { DOWNLOAD_URL_REGEX, PHONE_DIGITS_REGEX } from "./settings-policy.js";

const copy = {
  ar: {
    title: "RTS | حلول تقنية لعملك", description: "RTS Royal Technology Solutions — مواقع وتطبيقات وأنظمة نقاط بيع مصممة لعملك.", navAria: "التنقل الرئيسي", menuAria: "فتح القائمة", menu: "القائمة", skip: "انتقل إلى المحتوى", navServices: "الخدمات", navPos: "نقطة البيع", navApproach: "الأسلوب", navContact: "تواصل", navCta: "ابدأ محادثة", heroKicker: "RTS · حلول تُبنى حول عملك", heroTitle: "فكرتك.<br>شغلك.<br><span>نظامك.</span>", heroIntro: "نصمم الأدوات الرقمية التي تجعل عملك أوضح وأسهل في كل يوم — من أول واجهة إلى نقطة البيع.", heroCta: "ناقش احتياجك", heroMore: "استكشف نقطة البيع <i aria-hidden=\"true\">↓</i>", settingsLoading: "جارٍ تجهيز طرق التواصل…", illustrative: "واجهة توضيحية", heroNote: "البيع، واضح في لحظته", posDemoAria: "واجهة نقطة بيع توضيحية", demo: "عرض تجريبي", heroPosTitle: "نقطة البيع", heroTab1: "الأكثر طلباً", heroTab2: "كل المنتجات", item1: "قهوة عربية", item2: "مخبوزات", item3: "عصير طازج", item4: "إضافة جديدة", order: "الطلب", total: "الإجمالي", payDemo: "إتمام تجريبي", introBand: "لا نبيع قالباً جاهزاً. نبدأ بفهم طريقة عملك، ثم نبني المسار الذي يناسبها.", servicesTag: "أدواتك الرقمية", servicesTitle: "حل واحد لا يشبه<br>كل الحلول.", service1Title: "مواقع ومتاجر إلكترونية", service1Text: "واجهة تشرح قيمتك بوضوح وتمنح عملاءك طريقاً بسيطاً للبدء.", service2Title: "تطبيقات سطح المكتب", service2Text: "أدوات عملية لعملياتك اليومية، مصممة حول فريقك وطريقة عمله.", service3Title: "تطبيقات iOS وAndroid", service3Text: "تجارب هاتفية مخصصة عندما يحتاج عملك أن يكون قريباً من المستخدم.", service4Title: "نظام نقاط البيع", service4Text: "مبيعات ومخزون وباركود وفواتير وتقارير وفروع متعددة — مع مساحة لفهم احتياجك أولاً.", posTag: "نقطة البيع · RTS", posTitle: "شاشة البيع<br>هي بداية النظام.", posText: "استكشف مثالاً مبسطاً حسب نوع نشاطك. هذه واجهة توضيحية فقط، وليست نظام عميل أو عملية دفع حقيقية.", sectorAria: "نوع النشاط", sectorMarket: "سوبرماركت", sectorRetail: "محلات تجارية", sectorRestaurant: "مطعم", sectorCoffee: "مقهى", sectorClothing: "ملابس", sectorOther: "أعمال أخرى", interactiveDemo: "تجربة توضيحية تفاعلية", productsAria: "منتجات تجريبية", basket: "سلة العرض", clear: "مسح", basketEmpty: "اختر منتجاً لإضافته هنا.", noPayment: "لن يتم إجراء أي دفع.", posDetails: "يمكن لنظام نقطة البيع أن يجمع المبيعات والمخزون والباركود والفواتير والتقارير والفروع المتعددة. التفاصيل التي تحتاجها في قطاعك نحددها معاً قبل التنفيذ.", posCta: "تحدث عن نشاطك", approachTag: "طريقة العمل", approachTitle: "من سؤال واضح<br>إلى أداة تستخدمها.", step1Title: "نسمع السياق", step1Text: "ما الذي يبطئ فريقك؟ وما الذي يجب أن يبقى بسيطاً؟", step2Title: "نرسم المسار", step2Text: "نحوّل الأولويات إلى شاشات وخطوات يفهمها الجميع.", step3Title: "نبني معك", step3Text: "نطوّر الحل المناسب ونبقى قريبين من تفاصيله العملية.", downloadTag: "لأصحاب Windows", downloadTitle: "برنامج ADA POS الحالي.", downloadText: "تجري إعادة تقديم العلامة تحت RTS. ملف التثبيت الحالي يحمل اسم ADA POS وهو متاح لنظام Windows فقط.", downloadCta: "تنزيل ADA POS لـ Windows", downloadHelp: "إذا حظر Windows الملف، تواصل مع الدعم قبل المتابعة. لا نوصي بتعطيل الحماية.", faqTag: "أسئلة سريعة", faqTitle: "لنبدأ بوضوح.", faq1Q: "هل يمكنني طلب موقع أو تطبيق فقط؟", faq1A: "نعم. نبدأ بالخدمة التي يحتاجها عملك، سواء كانت موقعاً أو تطبيقاً أو أداة مكتبية.", faq2Q: "هل شاشة نقطة البيع المعروضة نظاماً حقيقياً؟", faq2A: "لا. إنها مثال توضيحي تفاعلي يشرح فكرة الواجهة، ولا يعالج مدفوعات أو بيانات حقيقية.", faq3Q: "هل تطبيقات الهاتف تعني توفر POS على iOS أو Android؟", faq3A: "تطبيقات الهاتف هي خدمة تطوير مخصصة. لا يعني ذلك وعداً بتوفر برنامج نقطة البيع للتثبيت على الهاتف.", contactTag: "الخطوة التالية", contactTitle: "لنضع الفكرة<br>على الطاولة.", contactText: "أخبرنا بما تحاول ترتيبه. عند الإرسال، ستفتح محادثة WhatsApp برسالتك لمراجعتها قبل الإرسال.", fieldName: "الاسم", fieldService: "ما الذي تحتاجه؟", fieldBusiness: "اسم النشاط", fieldMessage: "نبذة قصيرة", choose: "اختر خدمة", optionWebsite: "موقع أو متجر إلكتروني", optionDesktop: "تطبيق سطح مكتب", optionMobile: "تطبيق هاتف", optionPos: "نقطة بيع", optionOther: "شيء آخر", formSubmit: "مراجعة رسالة WhatsApp", footerText: "تقنية مصممة للعمل الحقيقي.", privacy: "الخصوصية"
  },
  en: {
    title: "RTS | Technology for your business", description: "RTS Royal Technology Solutions — websites, apps, and point-of-sale systems built around your business.", navAria: "Primary navigation", menuAria: "Open menu", menu: "Menu", skip: "Skip to content", navServices: "Services", navPos: "Point of sale", navApproach: "Approach", navContact: "Contact", navCta: "Start a conversation", heroKicker: "RTS · Technology built around your work", heroTitle: "Your idea.<br>Your work.<br><span>Your system.</span>", heroIntro: "We design digital tools that make work clearer and easier every day — from the first screen to the point of sale.", heroCta: "Discuss your needs", heroMore: "Explore point of sale <i aria-hidden=\"true\">↓</i>", settingsLoading: "Preparing contact options…", illustrative: "Illustrative interface", heroNote: "A clearer moment of sale", posDemoAria: "Illustrative point-of-sale interface", demo: "DEMO", heroPosTitle: "Point of sale", heroTab1: "Popular", heroTab2: "All products", item1: "Arabic coffee", item2: "Pastry", item3: "Fresh juice", item4: "New add-on", order: "Order", total: "Total", payDemo: "Demo checkout", introBand: "We do not sell a ready-made template. We start by understanding how you work, then build a fitting path.", servicesTag: "Your digital tools", servicesTitle: "One solution<br>not like every other.", service1Title: "Websites & e-commerce", service1Text: "A clear front door for your value, with an easy path for customers to get started.", service2Title: "Desktop applications", service2Text: "Practical tools for daily operations, shaped around your team and its way of working.", service3Title: "iOS & Android applications", service3Text: "Purpose-built mobile experiences when your business needs to stay close to its users.", service4Title: "Point-of-sale system", service4Text: "Sales, inventory, barcode, invoices, reporting, and multiple stores — with room to understand your needs first.", posTag: "Point of sale · RTS", posTitle: "The sales screen<br>starts the system.", posText: "Explore a simple example for your business type. This is an illustrative interface only, not a customer system or a real payment.", sectorAria: "Business type", sectorMarket: "Supermarket", sectorRetail: "Retail shops", sectorRestaurant: "Restaurant", sectorCoffee: "Coffee shop", sectorClothing: "Clothing", sectorOther: "Other businesses", interactiveDemo: "Interactive illustrative demo", productsAria: "Demo products", basket: "Demo basket", clear: "Clear", basketEmpty: "Choose a product to add it here.", noPayment: "No payment will be made.", posDetails: "A POS system can bring together sales, inventory, barcode, invoices, reporting, and multiple stores. We define the details your sector needs together before implementation.", posCta: "Talk about your business", approachTag: "How we work", approachTitle: "From a clear question<br>to a tool you use.", step1Title: "We hear the context", step1Text: "What slows your team down? What must stay simple?", step2Title: "We map the path", step2Text: "We turn priorities into screens and steps everyone can understand.", step3Title: "We build with you", step3Text: "We develop the fitting solution and stay close to its practical details.", downloadTag: "For Windows owners", downloadTitle: "The current ADA POS program.", downloadText: "The brand is being presented under RTS. The current installer is named ADA POS and is available for Windows only.", downloadCta: "Download ADA POS for Windows", downloadHelp: "If Windows blocks the file, contact support before continuing. We do not recommend disabling protection.", faqTag: "Quick questions", faqTitle: "Let’s start clearly.", faq1Q: "Can I request only a website or an app?", faq1A: "Yes. We start with the service your business needs, whether that is a website, app, or desktop tool.", faq2Q: "Is the POS screen shown here a real system?", faq2A: "No. It is an interactive illustrative example of the interface idea. It does not process payments or real data.", faq3Q: "Do mobile apps mean POS is available for iOS or Android?", faq3A: "Mobile apps are a custom development service. This does not promise a POS installer for phones.", contactTag: "Next step", contactTitle: "Let’s put the idea<br>on the table.", contactText: "Tell us what you are trying to organise. On submission, WhatsApp opens with your message so you can review it before sending.", fieldName: "Name", fieldService: "What do you need?", fieldBusiness: "Business name", fieldMessage: "A short brief", choose: "Choose a service", optionWebsite: "Website or e-commerce", optionDesktop: "Desktop application", optionMobile: "Mobile application", optionPos: "Point of sale", optionOther: "Something else", formSubmit: "Review WhatsApp message", footerText: "Technology for real work.", privacy: "Privacy"
  }
};

const sectorData = {
  ar: {
    market: { title: "سوبرماركت", catalog: "المنتجات السريعة", copy: "أمثلة لعناصر تظهر خلال البيع اليومي.", products: [["حليب طازج", "₪ 7", "milk"], ["خبز", "₪ 5", "bread"], ["فواكه", "₪ 11", "fruit"], ["مياه", "₪ 4", "water"]], discussion: "يمكننا مناقشة احتياجات الباركود والمخزون والفواتير في سياق عملك." },
    retail: { title: "محلات تجارية", catalog: "عناصر سريعة", copy: "مثال مبسط لواجهة بيع في متجر.", products: [["منتج جديد", "₪ 24", "milk"], ["إكسسوار", "₪ 18", "bread"], ["هدية", "₪ 35", "fruit"], ["مستلزم", "₪ 12", "water"]], discussion: "يمكننا مناقشة الأصناف والمخزون والفواتير وفق طبيعة المتجر." },
    restaurant: { title: "مطعم", catalog: "قائمة الطلب", copy: "مثال لعناصر قائمة أثناء البيع.", products: [["طبق اليوم", "₪ 48", "milk"], ["مقبلات", "₪ 22", "bread"], ["مشروب", "₪ 12", "fruit"], ["حلوى", "₪ 20", "water"]], discussion: "يمكننا مناقشة احتياجات سير الطلبات والتشغيل قبل تحديد التفاصيل." },
    coffee: { title: "مقهى", catalog: "قائمة سريعة", copy: "أمثلة لمشروبات وإضافات يومية.", products: [["قهوة", "₪ 12", "milk"], ["كرواسون", "₪ 15", "bread"], ["عصير", "₪ 16", "fruit"], ["إضافة", "₪ 4", "water"]], discussion: "يمكننا مناقشة سير طلبات المقهى وما يحتاجه فريقك فعلياً." },
    clothing: { title: "ملابس", catalog: "مختارات المتجر", copy: "مثال مبسط لقطع معروضة للبيع.", products: [["قميص", "₪ 80", "milk"], ["بنطال", "₪ 120", "bread"], ["حقيبة", "₪ 95", "fruit"], ["وشاح", "₪ 45", "water"]], discussion: "يمكننا مناقشة احتياجات المقاسات والمتغيرات عند تخطيط نظامك." },
    other: { title: "أعمال أخرى", catalog: "عناصر نموذجية", copy: "نبدأ من عناصر العمل التي تستخدمها فعلاً.", products: [["خدمة", "₪ 30", "milk"], ["منتج", "₪ 20", "bread"], ["إضافة", "₪ 10", "fruit"], ["مادة", "₪ 6", "water"]], discussion: "لنفرض أي تفاصيل مسبقاً — أخبرنا كيف تسير عملياتك ونناقش ما يناسبها." }
  },
  en: {
    market: { title: "Supermarket", catalog: "Quick products", copy: "Examples of items used in everyday sales.", products: [["Fresh milk", "₪ 7", "milk"], ["Bread", "₪ 5", "bread"], ["Fruit", "₪ 11", "fruit"], ["Water", "₪ 4", "water"]], discussion: "We can discuss barcode, inventory, and invoice needs in the context of your business." },
    retail: { title: "Retail shops", catalog: "Quick items", copy: "A simple example of a shop sales interface.", products: [["New product", "₪ 24", "milk"], ["Accessory", "₪ 18", "bread"], ["Gift", "₪ 35", "fruit"], ["Supply", "₪ 12", "water"]], discussion: "We can discuss products, inventory, and invoices according to the store’s nature." },
    restaurant: { title: "Restaurant", catalog: "Order menu", copy: "Examples of menu items during a sale.", products: [["Today’s dish", "₪ 48", "milk"], ["Starter", "₪ 22", "bread"], ["Drink", "₪ 12", "fruit"], ["Dessert", "₪ 20", "water"]], discussion: "We can discuss service flow and operations needs before defining details." },
    coffee: { title: "Coffee shop", catalog: "Quick menu", copy: "Examples of everyday drinks and add-ons.", products: [["Coffee", "₪ 12", "milk"], ["Croissant", "₪ 15", "bread"], ["Juice", "₪ 16", "fruit"], ["Add-on", "₪ 4", "water"]], discussion: "We can discuss coffee-order flow and what your team actually needs." },
    clothing: { title: "Clothing", catalog: "Store picks", copy: "A simple example of items for sale.", products: [["Shirt", "₪ 80", "milk"], ["Trousers", "₪ 120", "bread"], ["Bag", "₪ 95", "fruit"], ["Scarf", "₪ 45", "water"]], discussion: "We can discuss sizes and variants while planning your system." },
    other: { title: "Other businesses", catalog: "Sample items", copy: "We start from items you actually use in your work.", products: [["Service", "₪ 30", "milk"], ["Product", "₪ 20", "bread"], ["Add-on", "₪ 10", "fruit"], ["Material", "₪ 6", "water"]], discussion: "We will not assume details — tell us how your work flows and we will discuss what fits." }
  }
};

let language = new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "ar";
let activeSector = "market";
let basket = [];
let whatsappNumber = "";
const isMainPage = document.body.dataset.page === "home";
let settingsState = "loading";
const byId = (id) => document.getElementById(id);
const text = (key) => copy[language][key] || "";

Object.assign(copy.ar, {
  heroIntro: "نصمم ونطوّر المواقع، تطبيقات سطح المكتب وiOS وAndroid، وأنظمة نقاط البيع. هوية تليق بعملك، وبرمجة تجعل كل التفاصيل تعمل معاً.",
  heroNote: "واجهة التطبيق الحالية",
  sandboxTitle: "جرّب فكرة البيع حسب نشاطك",
  sectorCoverage: "للسوبرماركت، المحلات، المطاعم، المقاهي، متاجر الملابس، ومختلف الأنشطة التجارية.",
  faq2Q: "هل الصور من التطبيق الفعلي؟",
  faq2A: "نعم، صور المعرض من تطبيق ADA POS الحالي. أما التجربة التفاعلية فهي مثال مبسط ولا تعالج أي عملية دفع.",
  designExamplesAria: "أمثلة تصميم توضيحية",
  designExamplesTitle: "هوية واحدة.<br>تجربة متكاملة.",
  designExamplesText: "من واجهة الموقع إلى تفاصيل التطبيق، نصمم تجربة متناسقة على كل شاشة. تصورات توضيحية لما يمكن أن نبنيه لعلامتك.",
  sitePreviewTitle: "مكان واضح لعلامتك.",
  phonePreviewTitle: "مهمة اليوم",
  retry: "إعادة المحاولة",
  actualAppAria: "لقطة شاشة فعلية من تطبيق ADA POS",
  insideApp: "من داخل التطبيق",
  openImage: "عرض بالحجم الكامل",
  closeImage: "إغلاق",
  galleryAria: "معرض لقطات فعلية من ADA POS",
  galleryTabsAria: "اختيار لقطة شاشة",
  galleryTag: "من داخل التطبيق",
  galleryTitle: "كل تفاصيل عملك.<br>في مكان واحد.",
  galleryText: "المبيعات، الفواتير، العملاء، المخزون والإعدادات — شاهد لقطات فعلية من تطبيقنا. بعض المعرّفات أُخفيت لحماية الخصوصية.",
  gallerySales: "المبيعات",
  galleryCheckout: "الدفع",
  gallerySettings: "الإعدادات",
  mobilePreviewAria: "تصور توضيحي لتطبيق هاتف مخصص"
});
Object.assign(copy.en, {
  heroIntro: "We design and build websites, desktop software, iOS and Android apps, and point-of-sale systems. Thoughtful design meets software that brings your business together.",
  heroNote: "The current application",
  sandboxTitle: "Explore a sales demo for your business",
  sectorCoverage: "For supermarkets, retail shops, restaurants, coffee shops, clothing stores, and businesses of every kind.",
  faq2Q: "Are these images from the real application?",
  faq2A: "Yes. The gallery shows the current ADA POS application. The interactive sales demo is a simplified illustration and does not process payments.",
  designExamplesAria: "Illustrative design examples",
  designExamplesTitle: "One identity.<br>Every screen.",
  designExamplesText: "From the website to the smallest app interaction, we design a connected experience. Illustrative concepts of what we can build for your brand.",
  sitePreviewTitle: "A clear place for your brand.",
  phonePreviewTitle: "Today’s task",
  retry: "Try again",
  actualAppAria: "Actual ADA POS application screenshot",
  insideApp: "Inside the actual app",
  openImage: "View full size",
  closeImage: "Close",
  galleryAria: "Gallery of actual ADA POS screenshots",
  galleryTabsAria: "Choose a screenshot",
  galleryTag: "Inside the actual app",
  galleryTitle: "Your daily business.<br>In one place.",
  galleryText: "Sales, invoices, customers, inventory, and settings — actual screenshots from our application. Some identifiers are obscured for privacy.",
  gallerySales: "Sales",
  galleryCheckout: "Checkout",
  gallerySettings: "Settings",
  mobilePreviewAria: "Illustrative custom mobile application preview"
});
sectorData.ar.other.discussion = "لن نفترض أي تفاصيل مسبقاً — أخبرنا كيف تسير عملياتك ونناقش ما يناسبها.";
const screenshots = {
  sales: { src: "/assets/pos-sales.png", ar: "لقطة شاشة فعلية من شاشة المبيعات في ADA POS", en: "Actual ADA POS sales screen screenshot" },
  checkout: { src: "/assets/pos-checkout.png", ar: "لقطة شاشة فعلية من شاشة الدفع في ADA POS", en: "Actual ADA POS checkout screen screenshot" },
  settings: { src: "/assets/pos-settings.png", ar: "لقطة شاشة فعلية من شاشة الإعدادات في ADA POS", en: "Actual ADA POS settings screen screenshot" }
};
let activeScreenshot = "sales";
let dialogTrigger;
const subpageCopy = {
  privacy: {
    ar: { title: "RTS | الخصوصية", back: "العودة للموقع", tag: "RTS · الخصوصية", heading: "خصوصيتك، بوضوح.", collectionH: "ما الذي يجمعه هذا الموقع؟", collection: "لا يستخدم الموقع العام تحليلات أو ملفات تعريف ارتباط تسويقية. لا تُخزّن بيانات نموذج التواصل على خادم الموقع؛ عند اختيار إرسال النموذج، تُجهَّز رسالة وتُفتح في WhatsApp لتراجعها قبل إرسالها.", whatsappH: "WhatsApp", whatsapp: "عند المتابعة من نموذج التواصل، تنتقل الرسالة إلى WhatsApp، وهي خدمة طرف ثالث تخضع لسياسة الخصوصية الخاصة بها. لا ترسل النموذج إذا لم ترغب في مشاركة محتواه عبر WhatsApp.", cookiesH: "ملفات تعريف الارتباط والجلسة الإدارية", cookies: "لا يضع الموقع العام ملفات تعريف ارتباط. تستخدم منطقة الإدارة الخاصة جلسة إدارية ضرورية للحفاظ على تسجيل الدخول.", hostingH: "الاستضافة", hosting: "تعالج Cloudflare بيانات الاتصال والأمان الاعتيادية، بما في ذلك عنوان IP، لتقديم الموقع وحمايته. لا نستخدم ذلك للتحليلات التسويقية.", updatesH: "تحديثات هذه السياسة", updates: "قد نحدّث هذه الصفحة عندما تتغير طريقة عمل الموقع. سننشر النسخة المحدثة هنا.", return: "العودة إلى RTS", privacy: "الخصوصية" },
    en: { title: "RTS | Privacy", back: "Back to site", tag: "RTS · PRIVACY", heading: "Your privacy, clearly.", collectionH: "What does this site collect?", collection: "The public site uses no analytics or marketing cookies. Contact-form details are not stored on the site server; choosing to submit prepares a message and opens WhatsApp so you can review it before sending.", whatsappH: "WhatsApp", whatsapp: "Continuing from the contact form sends the message to WhatsApp, a third-party service governed by its own privacy policy. Do not submit the form if you do not want to share its content through WhatsApp.", cookiesH: "Cookies and the admin session", cookies: "The public site sets no cookies. The private admin area uses a necessary administrative session cookie to keep an administrator signed in.", hostingH: "Hosting", hosting: "Cloudflare processes normal connection and security data, including IP address, to serve and protect the site. We do not use this for marketing analytics.", updatesH: "Policy updates", updates: "We may update this page if the site’s operation changes. The updated version will be published here.", return: "Back to RTS", privacy: "Privacy" }
  },
  download: {
    ar: { title: "RTS | تنزيل ADA POS", back: "العودة للموقع", tag: "RTS · WINDOWS", heading: "تنزيل ADA POS.", installerH: "ملف التثبيت الحالي", installer: "تجري إعادة تقديم العلامة تحت RTS. برنامج Windows الحالي يحمل اسم ADA POS. حجم ملف التثبيت يقارب 731 MiB؛ قد يستغرق التنزيل وقتاً حسب اتصالك.", download: "تنزيل ADA POS لـ Windows", beforeH: "قبل المتابعة", before: "هذا التنزيل مخصص لـ Windows فقط. إذا حظر Windows الملف أو ظهرت لك رسالة أمان، تواصل مع الدعم قبل المتابعة. لا نوصي بتعطيل حماية Windows.", return: "العودة إلى RTS", privacy: "الخصوصية", retry: "إعادة المحاولة" },
    en: { title: "RTS | Download ADA POS", back: "Back to site", tag: "RTS · WINDOWS", heading: "Download ADA POS.", installerH: "The current installer", installer: "RTS is presenting the brand anew. The current Windows program is named ADA POS. The installer is about 731 MiB, so download time depends on your connection.", download: "Download ADA POS for Windows", beforeH: "Before you continue", before: "This download is for Windows only. If Windows blocks the file or shows a security message, contact support before proceeding. We do not recommend disabling Windows protection.", return: "Back to RTS", privacy: "Privacy", retry: "Try again" }
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
  const galleryFrame = document.querySelector(".gallery-screen");
  if (galleryFrame) galleryFrame.dataset.shot = name;
  byId("gallery-panel")?.setAttribute("aria-labelledby", `shot-${name}`);
  document.querySelectorAll(".gallery-controls [role='tab']").forEach((button) => {
    const selected = button.dataset.shot === name;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
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
async function loadSettings() {
  settingsState = "loading";
  whatsappNumber = "";
  const downloadLink = byId("download-link");
  if (downloadLink) {
    downloadLink.setAttribute("aria-disabled", "true");
    downloadLink.removeAttribute("href");
  }
  document.querySelectorAll(".js-contact-link").forEach(link => link.setAttribute("aria-disabled", "true"));
  if (byId("contact-submit")) byId("contact-submit").disabled = true;
  renderSettingsState();
  try {
    const response = await fetch("/api/settings", { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Settings unavailable");
    const settings = await response.json();
    if (!isAllowedDownloadUrl(settings.downloadUrl)) throw new Error("Invalid download URL");
    if (typeof settings.whatsappNumber !== "string" || !PHONE_DIGITS_REGEX.test(settings.whatsappNumber)) throw new Error("Invalid contact number");
    if (downloadLink) {
      downloadLink.href = settings.downloadUrl;
      downloadLink.setAttribute("aria-disabled", "false");
    }
    whatsappNumber = settings.whatsappNumber;
    document.querySelectorAll(".js-contact-link").forEach((link) => {
      link.href = "#contact";
      link.setAttribute("aria-disabled", "false");
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
  byId("demo-pay").addEventListener("click", () => { byId("basket-empty").textContent = language === "ar" ? "عرض فقط — لم يتم إجراء أي دفع." : "Demo only — no payment was made."; byId("basket-empty").hidden = false; });
  byId("settings-retry").addEventListener("click", loadSettings);
  const menu = document.querySelector(".menu-toggle");
  const navigation = byId("primary-navigation");
  menu.addEventListener("click", () => { const open = menu.getAttribute("aria-expanded") === "true"; menu.setAttribute("aria-expanded", String(!open)); navigation.classList.toggle("open", !open); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && navigation.classList.contains("open")) { menu.setAttribute("aria-expanded", "false"); navigation.classList.remove("open"); menu.focus(); } });
  navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => { menu.setAttribute("aria-expanded", "false"); navigation.classList.remove("open"); }));
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
  updateCopy();
  loadSettings();
} else {
  updateSubpageCopy();
  document.querySelector(".language-toggle")?.addEventListener("click", () => {
    const url = new URL(window.location.href);
    language === "ar" ? url.searchParams.set("lang", "en") : url.searchParams.delete("lang");
    window.location.assign(url);
  });
  if (document.body.dataset.page === "download") {
    byId("settings-retry")?.addEventListener("click", loadSettings);
    loadSettings();
  }
}
