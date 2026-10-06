(() => {
  const body = document.body;
  const root = document.documentElement;
  root.classList.add("js");
  const cursor = document.querySelector(".cursor-orb");
  const loadProgress = document.querySelector("[data-load-progress]");
  const nav = document.querySelector(".nav-shell");
  const menu = document.querySelector(".menu-button");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const languageToggle = document.querySelector("[data-language-toggle]");
  const themeToggle = document.querySelector("[data-theme-toggle]");
  const translations = {
    en: {
      navLabel: "Primary navigation",
      displayPreferences: "Display preferences",
      navServices: "Services",
      navProducts: "RTS Products",
      navManagement: "RTS Management",
      navContact: "Contact",
      navCta: "Start a conversation",
      menu: "Menu",
      themeLight: "Light mode",
      themeDark: "Dark mode",
      heroEyebrow: "Royal Technology Solutions · 2026",
      heroTitle: "Where <em>code</em><br>becomes <strong>power.</strong>",
      heroPrimary: "Build with RTS",
      heroSecondary: "Explore services",
      proofSystems: "Focused systems",
      proofSupport: "Human support",
      proofScale: "Built to scale",
      signalOnline: "signal online",
      operationalClarity: "operational clarity",
      systemsInMotion: "systems in motion",
      scrollToEnter: "Scroll to enter",
      servicesEyebrow: "01 / Services",
      servicesTitle: "Build the right<br><em>digital advantage.</em>",
      startProject: "Start a project",
      websitesTitle: "Websites",
      websitesText: "Clear, responsive websites that give your brand a confident place to meet the world.",
      applicationsTitle: "Applications",
      applicationsText: "Desktop, iOS, and Android applications shaped around the way your team works.",
      viewWork: "View work",
      contactAbout: "Contact us",
      websitesEyebrow: "Websites",
      websitesShowcaseTitle: "Websites that make<br><em>the first step feel easy.</em>",
      websitesShowcaseText: "Explore selected RTS website work, then tell us what your next digital front door needs to do.",
      applicationsEyebrow: "Applications",
      applicationsShowcaseTitle: "Tools with a screen<br><em>for every important move.</em>",
      applicationsShowcaseText: "Desktop, iOS, and Android experiences built around the moments your team and customers repeat every day.",
      businessEyebrow: "RTS Business",
      businessShowcaseTitle: "The business view,<br><em>fully in focus.</em>",
      businessShowcaseText: "See the full RTS Business workspace across sales, checkout, and settings.",
      clinicEyebrow: "RTS Clinic",
      clinicShowcaseTitle: "A calmer workspace<br><em>for the clinic day.</em>",
      clinicShowcaseText: "Browse the RTS Clinic screens and keep the next patient, note, and operational detail visible.",
      downloadBusiness: "Download RTS Business",
      downloadClinic: "Download RTS Clinic",
      carouselPrevious: "Previous image",
      carouselNext: "Next image",
      carouselEmpty: "Add screenshots from the admin panel to show this work here.",
      openProduct: "Open product page",
      businessProductTitle: "RTS Business",
      businessProductText: "A focused Windows workspace for sales, inventory, invoices, and reporting.",
      clinicProductTitle: "RTS Clinic",
      clinicProductText: "A calmer Windows workspace for patient files, appointments, sessions, and billing.",
      capabilitiesEyebrow: "02 / Capabilities",
      capabilitiesTitle: "Small enough to care.<br><em>Serious enough to deliver.</em>",
      digitalProductsTitle: "Digital products",
      digitalProductsText: "Websites, Android, iOS, and desktop applications shaped around the way your team works.",
      businessSystemsTitle: "Business systems",
      businessSystemsText: "Connected tools for the work behind the work—less friction, more visibility.",
      technicalDirectionTitle: "Technical direction",
      technicalDirectionText: "A practical path from a rough idea to a system your team can rely on.",
      explore: "Explore",
      managementEyebrow: "03 / RTS Management",
      managementTitle: "One operational view.<br><em>Every move in focus.</em>",
      managementText: "RTS Management brings sales, reports, inventory, and configuration into a single calm workspace for teams that need to move with confidence.",
      salesCaption: "Sales, without the noise.",
      reportsCaption: "Know the shape of the day.",
      settingsCaption: "Configure your edge.",
      customersEyebrow: "04 / Customers",
      customersTitle: "Built around the way<br><em>real teams work.</em>",
      customersText: "From the first customer interaction to the final report, we build around the details that make your business yours.",
      yourMomentum: "your<br>momentum",
      listenFirst: "We listen first.",
      buildDifference: "Then we build the part that changes everything.",
      ceoEyebrow: "05 / A message from leadership",
      ceoQuote: "“The best technology does not ask people to change who they are. It gives their best work more room to happen.”",
      contactEyebrow: "Start a signal",
      contactTitle: "Have a challenge<br>worth solving?",
      contactText: "Tell us where the friction is. We’ll open a WhatsApp conversation so you can review the message before it is sent.",
      contactDirectLabel: "Prefer a direct line?",
      contactDirectLink: "Message RTS on WhatsApp ↗",
      formName: "Name",
      formCompany: "Company",
      formService: "What do you need?",
      chooseService: "Choose a service",
      serviceDigitalProducts: "Digital product",
      serviceBusiness: "RTS Business",
      serviceClinic: "RTS Clinic",
      serviceOther: "Something else",
      formMessage: "What are you building?",
      formSubmit: "Open WhatsApp",
      footerTagline: "where code becomes power",
      liveEyebrow: "Live operating picture",
      liveTitle: "See the system<br><em>respond in real time.</em>",
      liveText: "A lightweight pulse check inspired by the way RTS keeps work visible, calm, and moving.",
      liveConnected: "RTS signal connected",
      liveOrders: "Orders flowing",
      liveClarity: "Operational clarity",
      liveResponse: "Response time",
      liveView: "View",
      liveFlow: "Flow",
      liveClarityMode: "Clarity",
      liveSignal: "Signal",
      whatsappGreeting: "Hello RTS, I would like to discuss a project.",
      whatsappReady: "Opening WhatsApp for your review…",
      whatsappUnavailable: "WhatsApp is not ready yet. Please use the direct link after the page finishes loading."
    },
    ar: {
      navLabel: "التنقل الرئيسي",
      displayPreferences: "إعدادات العرض",
      navServices: "الخدمات",
      navProducts: "منتجات RTS",
      navManagement: "نظام RTS Management",
      navContact: "تواصل معنا",
      navCta: "ابدأ محادثة",
      menu: "القائمة",
      themeLight: "الوضع الفاتح",
      themeDark: "الوضع الداكن",
      heroEyebrow: "رويال للحلول التكنولوجية · 2026",
      heroTitle: "حيث يتحول <em>الكود</em><br>إلى <strong>قوة.</strong>",
      heroPrimary: "ابنِ مع RTS",
      heroSecondary: "اكتشف الخدمات",
      proofSystems: "أنظمة مركزة",
      proofSupport: "دعم إنساني",
      proofScale: "جاهزة للتوسع",
      signalOnline: "الإشارة متصلة",
      operationalClarity: "وضوح تشغيلي",
      systemsInMotion: "أنظمة تتحرك",
      scrollToEnter: "مرر للدخول",
      servicesEyebrow: "01 / خدماتنا",
      servicesTitle: "ابنِ ميزتك<br><em>الرقمية الصحيحة.</em>",
      startProject: "ابدأ مشروعاً",
      websitesTitle: "مواقع إلكترونية",
      websitesText: "مواقع واضحة ومتجاوبة تمنح علامتك مكاناً واثقاً للقاء العالم.",
      applicationsTitle: "تطبيقات",
      applicationsText: "تطبيقات سطح مكتب وiOS وAndroid مصممة حول طريقة عمل فريقك.",
      viewWork: "شاهد الأعمال",
      contactAbout: "تواصل معنا",
      websitesEyebrow: "مواقع إلكترونية",
      websitesShowcaseTitle: "مواقع تجعل<br><em>الخطوة الأولى أسهل.</em>",
      websitesShowcaseText: "استكشف بعض أعمال RTS على الويب، ثم أخبرنا بما يحتاجه حضورك الرقمي القادم.",
      applicationsEyebrow: "تطبيقات",
      applicationsShowcaseTitle: "أدوات لها شاشة<br><em>لكل حركة مهمة.</em>",
      applicationsShowcaseText: "تجارب سطح مكتب وiOS وAndroid مبنية حول اللحظات التي يكررها فريقك وعملاؤك كل يوم.",
      businessEyebrow: "RTS Business",
      businessShowcaseTitle: "رؤية العمل،<br><em>بكل تفاصيلها.</em>",
      businessShowcaseText: "شاهد مساحة RTS Business كاملة بين المبيعات والدفع والإعدادات.",
      clinicEyebrow: "RTS Clinic",
      clinicShowcaseTitle: "مساحة عمل أهدأ<br><em>ليوم العيادة.</em>",
      clinicShowcaseText: "تصفح شاشات RTS Clinic وأبقِ المريض والملاحظة والتفصيل التشغيلي التالي واضحاً.",
      downloadBusiness: "تنزيل RTS Business",
      downloadClinic: "تنزيل RTS Clinic",
      carouselPrevious: "الصورة السابقة",
      carouselNext: "الصورة التالية",
      carouselEmpty: "أضف لقطات الشاشة من لوحة الإدارة لتظهر الأعمال هنا.",
      openProduct: "افتح صفحة المنتج",
      businessProductTitle: "RTS Business",
      businessProductText: "مساحة عمل Windows مركزة للمبيعات والمخزون والفواتير والتقارير.",
      clinicProductTitle: "RTS Clinic",
      clinicProductText: "مساحة عمل هادئة لملفات المرضى والمواعيد والجلسات والفوترة.",
      capabilitiesEyebrow: "02 / خدماتنا",
      capabilitiesTitle: "صغير بما يكفي ليهتم.<br><em>وجاد بما يكفي لينجز.</em>",
      digitalProductsTitle: "منتجات رقمية",
      digitalProductsText: "مواقع وتطبيقات Android وiOS وDesktop مصممة حول طريقة عمل فريقك.",
      businessSystemsTitle: "أنظمة أعمال",
      businessSystemsText: "أدوات مترابطة للعمل خلف الكواليس، باحتكاك أقل ورؤية أكبر.",
      technicalDirectionTitle: "توجيه تقني",
      technicalDirectionText: "طريق عملي يحول الفكرة الأولية إلى نظام يستطيع فريقك الاعتماد عليه.",
      explore: "اكتشف",
      managementEyebrow: "03 / نظام RTS Management",
      managementTitle: "رؤية تشغيلية واحدة.<br><em>كل حركة في موضعها.</em>",
      managementText: "يجمع RTS Management المبيعات والتقارير والمخزون والإعدادات في مساحة عمل هادئة للفرق التي تحتاج إلى التحرك بثقة.",
      salesCaption: "مبيعات بلا ضجيج.",
      reportsCaption: "اعرف شكل يومك.",
      settingsCaption: "اضبط ميزتك.",
      customersEyebrow: "04 / العملاء",
      customersTitle: "مصمم حول طريقة<br><em>عمل الفرق الحقيقية.</em>",
      customersText: "من أول تفاعل مع العميل وحتى التقرير النهائي، نبني حول التفاصيل التي تجعل عملك فريداً.",
      yourMomentum: "زخمك<br>الخاص",
      listenFirst: "نستمع أولاً.",
      buildDifference: "ثم نبني الجزء الذي يغير كل شيء.",
      ceoEyebrow: "05 / رسالة من القيادة",
      ceoQuote: "“أفضل تكنولوجيا لا تطلب من الناس أن يغيروا من هم، بل تمنح أفضل ما لديهم مساحة أكبر ليظهر.”",
      contactEyebrow: "ابدأ الإشارة",
      contactTitle: "لديك تحدٍ<br>يستحق الحل؟",
      contactText: "أخبرنا أين يوجد الاحتكاك، وسنفتح محادثة عبر واتساب لتراجع الرسالة قبل إرسالها.",
      contactDirectLabel: "تفضل التواصل المباشر؟",
      contactDirectLink: "راسل RTS عبر واتساب ↗",
      formName: "الاسم",
      formCompany: "الشركة",
      formService: "ما الذي تحتاجه؟",
      chooseService: "اختر الخدمة",
      serviceDigitalProducts: "منتج رقمي",
      serviceBusiness: "RTS Business",
      serviceClinic: "RTS Clinic",
      serviceOther: "شيء آخر",
      formMessage: "ماذا تبني؟",
      formSubmit: "افتح واتساب",
      footerTagline: "حيث يتحول الكود إلى قوة",
      liveEyebrow: "صورة تشغيلية مباشرة",
      liveTitle: "شاهد النظام<br><em>يستجيب لحظياً.</em>",
      liveText: "نبض تفاعلي خفيف مستوحى من طريقة RTS في إبقاء العمل واضحاً وهادئاً ومتحركاً.",
      liveConnected: "إشارة RTS متصلة",
      liveOrders: "الطلبات المتدفقة",
      liveClarity: "الوضوح التشغيلي",
      liveResponse: "زمن الاستجابة",
      liveView: "العرض",
      liveFlow: "التدفق",
      liveClarityMode: "الوضوح",
      liveSignal: "الإشارة",
      whatsappGreeting: "مرحباً RTS، أود مناقشة مشروع.",
      whatsappReady: "يتم فتح واتساب لمراجعة رسالتك…",
      whatsappUnavailable: "واتساب غير جاهز بعد. استخدم الرابط المباشر بعد اكتمال تحميل الصفحة."
    }
  };
  let language = localStorage.getItem("rts-separated-language") || ((navigator.language || "").toLowerCase().startsWith("ar") ? "ar" : "en");

  const applyLanguage = (nextLanguage) => {
    language = nextLanguage === "ar" ? "ar" : "en";
    const dictionary = translations[language];
    root.lang = language;
    root.dir = language === "ar" ? "rtl" : "ltr";
    document.title = language === "ar" ? "RTS — حيث يتحول الكود إلى قوة" : "RTS — where code becomes power";
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = dictionary[element.dataset.i18n];
      if (value) element.innerHTML = value;
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      const value = dictionary[element.dataset.i18nAriaLabel];
      if (value) element.setAttribute("aria-label", value);
    });
    if (languageToggle) {
      languageToggle.textContent = language === "ar" ? "English" : "العربية";
      languageToggle.setAttribute("aria-pressed", String(language === "ar"));
      languageToggle.setAttribute("aria-label", language === "ar" ? "Switch to English" : "التبديل إلى العربية");
    }
    localStorage.setItem("rts-separated-language", language);
  };

  const applyTheme = (nextTheme) => {
    const theme = nextTheme === "light" || nextTheme === "dark"
      ? nextTheme
      : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    root.dataset.theme = theme;
    if (themeToggle) {
      const isLight = theme === "light";
      themeToggle.setAttribute("aria-pressed", String(isLight));
      themeToggle.querySelector(".theme-icon").textContent = isLight ? "☀" : "☾";
      const label = themeToggle.querySelector("[data-i18n]");
      if (label) label.dataset.i18n = isLight ? "themeDark" : "themeLight";
      themeToggle.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
      applyLanguage(language);
    }
    localStorage.setItem("rts-separated-theme", theme);
  };

  const savedTheme = localStorage.getItem("rts-separated-theme");
  applyTheme(savedTheme || "system");
  applyLanguage(language);
  languageToggle?.addEventListener("click", () => {
    applyLanguage(language === "ar" ? "en" : "ar");
    renderShowcases(window.__rtsShowcases);
    setWhatsAppLinks();
  });
  themeToggle?.addEventListener("click", () => applyTheme(root.dataset.theme === "light" ? "dark" : "light"));
  window.matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => {
    if (!localStorage.getItem("rts-separated-theme")) applyTheme("system");
  });

  const moveCursor = (event) => {
    root.style.setProperty("--mouse-x", `${event.clientX}px`);
    root.style.setProperty("--mouse-y", `${event.clientY}px`);
  };
  const saveData = Boolean(navigator.connection?.saveData || navigator.connection?.effectiveType === "2g");
  const canAnimate = !prefersReducedMotion.matches && !saveData && window.matchMedia("(pointer: fine)").matches;
  if (cursor && canAnimate) window.addEventListener("pointermove", moveCursor, { passive: true });

  menu?.addEventListener("click", () => {
    const expanded = menu.getAttribute("aria-expanded") === "true";
    menu.setAttribute("aria-expanded", String(!expanded));
    nav?.classList.toggle("is-open", !expanded);
  });
  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    nav.classList.remove("is-open");
    menu?.setAttribute("aria-expanded", "false");
  }));

  let scrollTicking = false;
  const updateHeader = () => {
    nav?.classList.remove("is-hidden");
    scrollTicking = false;
  };
  window.addEventListener("scroll", () => {
    if (!scrollTicking) {
      window.requestAnimationFrame(updateHeader);
      scrollTicking = true;
    }
  }, { passive: true });

  const sectionLinks = Array.from(nav?.querySelectorAll("a[href^='#']") || []);
  const trackedSections = sectionLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  if ("IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        sectionLinks.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`));
      });
    }, { rootMargin: "-35% 0px -55% 0px", threshold: 0 });
    trackedSections.forEach((section) => sectionObserver.observe(section));
  }

  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && canAnimate) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12, rootMargin: "0px 0px -8% 0px" });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  const canvas = document.querySelector(".starfield");
  const context = canvas?.getContext("2d");
  if (canvas && context && canAnimate && window.innerWidth > 900) {
    let width = 0;
    let height = 0;
    let animationFrame = 0;
    const particles = [];
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles.length = 0;
      const count = Math.min(72, Math.max(30, Math.round(width * height / 26000)));
      for (let index = 0; index < count; index += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 1.35 + .35,
          speed: Math.random() * .18 + .035,
          phase: Math.random() * Math.PI * 2,
          color: index % 5 === 0 ? "102,220,255" : index % 4 === 0 ? "255,143,202" : "194,150,255"
        });
      }
    };
    const draw = (time) => {
      context.clearRect(0, 0, width, height);
      particles.forEach((particle, index) => {
        particle.y -= particle.speed;
        if (particle.y < -10) particle.y = height + 10;
        const x = particle.x + Math.sin(time * .00035 + particle.phase) * 12;
        const alpha = .24 + (Math.sin(time * .0012 + particle.phase) + 1) * .2;
        context.beginPath();
        context.fillStyle = `rgba(${particle.color}, ${alpha})`;
        context.arc(x, particle.y, particle.radius * (index % 9 === 0 ? 2.5 : 1), 0, Math.PI * 2);
        context.fill();
        if (index % 7 === 0) {
          const next = particles[(index + 9) % particles.length];
          const distance = Math.hypot(x - next.x, particle.y - next.y);
          if (distance < 150) {
            context.beginPath();
            context.strokeStyle = `rgba(168,117,255,${.12 * (1 - distance / 150)})`;
            context.moveTo(x, particle.y);
            context.lineTo(next.x, next.y);
            context.stroke();
          }
        }
      });
      animationFrame = requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });
    animationFrame = requestAnimationFrame(draw);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(animationFrame);
      else animationFrame = requestAnimationFrame(draw);
    });
  }

  const form = document.querySelector("#contact-form");
  const status = form?.querySelector(".form-status");
  document.querySelectorAll("[data-service-link]").forEach((link) => {
    link.addEventListener("click", () => {
      const service = form?.querySelector('[name="service"]');
      if (service) service.value = link.dataset.serviceLink || "";
    });
  });
  const whatsappLinks = document.querySelectorAll("[data-whatsapp-link]");
  const defaultShowcases = {
    websites: [
      { url: "/assets/hero-royal.svg", alt: "RTS website visual" },
      { url: "/assets/og.png", alt: "RTS website identity visual" }
    ],
    applications: [
      { url: "/assets/separated/management-sales.png", alt: "RTS application sales screen" },
      { url: "/assets/separated/management-reports.png", alt: "RTS application reports screen" },
      { url: "/assets/separated/management-settings.png", alt: "RTS application settings screen" }
    ],
    business: [
      { url: "/assets/pos-sales.png", alt: "RTS Business sales screen" },
      { url: "/assets/pos-checkout.png", alt: "RTS Business checkout screen" },
      { url: "/assets/pos-settings.png", alt: "RTS Business settings screen" }
    ],
    clinic: [
      { url: "/assets/separated/management-sales.png", alt: "RTS Clinic workspace preview" },
      { url: "/assets/separated/management-reports.png", alt: "RTS Clinic reporting preview" },
      { url: "/assets/separated/management-settings.png", alt: "RTS Clinic settings preview" }
    ]
  };
  const normalizeShowcases = (value) => {
    const result = {};
    Object.keys(defaultShowcases).forEach((key) => {
      const entries = Array.isArray(value?.[key]) ? value[key] : defaultShowcases[key];
      result[key] = entries
        .filter((item) => item && typeof item.url === "string" && item.url.trim())
        .slice(0, 12)
        .map((item) => ({
          url: item.url.trim(),
          alt: typeof item.alt === "string" && item.alt.trim() ? item.alt.trim() : `${key} showcase`
        }));
    });
    return result;
  };
  const renderShowcases = (value) => {
    const showcases = normalizeShowcases(value);
    window.__rtsShowcases = showcases;
    document.querySelectorAll("[data-carousel]").forEach((carousel) => {
      const key = carousel.dataset.carousel;
      const slides = showcases[key] || [];
      carousel.replaceChildren();
      if (!slides.length) {
        const empty = document.createElement("p");
        empty.className = "showcase-empty";
        empty.textContent = translations[language].carouselEmpty;
        carousel.append(empty);
        return;
      }
      let activeIndex = 0;
      const image = document.createElement("img");
      image.className = "showcase-image";
      image.loading = "lazy";
      image.decoding = "async";
      image.alt = slides[0].alt;
      const chrome = document.createElement("div");
      chrome.className = "showcase-chrome";
      const label = document.createElement("span");
      label.textContent = `${key.toUpperCase()} / ${String(activeIndex + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
      const previous = document.createElement("button");
      previous.type = "button";
      previous.className = "showcase-arrow showcase-previous";
      previous.setAttribute("aria-label", translations[language].carouselPrevious);
      previous.textContent = "←";
      const next = document.createElement("button");
      next.type = "button";
      next.className = "showcase-arrow showcase-next";
      next.setAttribute("aria-label", translations[language].carouselNext);
      next.textContent = "→";
      const dots = document.createElement("div");
      dots.className = "showcase-dots";
      const update = (index) => {
        activeIndex = (index + slides.length) % slides.length;
        const slide = slides[activeIndex];
        image.src = slide.url;
        image.alt = slide.alt;
        label.textContent = `${key.toUpperCase()} / ${String(activeIndex + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
        dots.querySelectorAll("button").forEach((dot, dotIndex) => dot.classList.toggle("is-active", dotIndex === activeIndex));
      };
      slides.forEach((slide, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "showcase-dot";
        dot.setAttribute("aria-label", `${index + 1} / ${slides.length}`);
        dot.addEventListener("click", () => update(index));
        dots.append(dot);
      });
      previous.addEventListener("click", () => update(activeIndex - 1));
      next.addEventListener("click", () => update(activeIndex + 1));
      chrome.append(label, previous, next);
      carousel.append(image, chrome, dots);
      update(0);
    });
  };
  renderShowcases(defaultShowcases);
  let whatsappNumber = "";
  const setWhatsAppLinks = () => {
    if (!whatsappNumber) return;
    whatsappLinks.forEach((link) => {
      link.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(translations[language].whatsappGreeting)}`;
      link.target = "_blank";
      link.rel = "noopener";
    });
  };
  fetch("/api/settings", { headers: { Accept: "application/json" } })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error("settings unavailable")))
    .then((settings) => {
      if (typeof settings.whatsappNumber === "string") whatsappNumber = settings.whatsappNumber.replace(/\D/g, "");
      const heroBackground = settings.content?.heroBackground;
      const backdrop = document.querySelector("[data-hero-backdrop]");
      if (backdrop && typeof heroBackground === "string" && heroBackground.trim()) {
        backdrop.style.backgroundImage = `url("${heroBackground.replace(/"/g, "%22")}")`;
      }
      renderShowcases(settings.content?.showcases);
      setWhatsAppLinks();
    })
    .catch(() => {
      whatsappLinks.forEach((link) => link.removeAttribute("target"));
    });
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const requestPayload = {
      name: String(data.get("name") || "").trim(),
      service: String(data.get("service") || "").trim(),
      business: String(data.get("business") || "").trim(),
      message: String(data.get("message") || "").trim(),
      language,
    };
    if (!whatsappNumber) {
      if (status) status.textContent = translations[language].whatsappUnavailable;
      return;
    }
    if (status) status.textContent = language === "ar" ? "يتم حفظ طلبك..." : "Saving your request...";
    fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    })
      .then((response) => response.ok ? response.json() : response.json().then((payload) => Promise.reject(new Error(payload?.error?.message || "Request could not be saved."))))
      .then(() => {
        if (status) status.textContent = translations[language].whatsappReady;
        const intro = language === "ar" ? "مرحباً RTS، اسمي" : "Hello RTS, my name is";
        const from = language === "ar" ? " من شركة " : " from ";
        const serviceLabel = requestPayload.service ? `\n\nService: ${requestPayload.service}` : "";
        const message = `${intro} ${requestPayload.name}${requestPayload.business ? `${from}${requestPayload.business}` : ""}.${serviceLabel}\n\n${requestPayload.message}`;
        window.location.assign(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`);
      })
      .catch((error) => {
        if (status) status.textContent = language === "ar"
          ? "تعذر حفظ الطلب. يرجى المحاولة مرة أخرى."
          : error.message || "We could not save your request. Please try again.";
      });
  });
  document.querySelector("#year").textContent = String(new Date().getFullYear());
  const finishLoading = () => window.requestAnimationFrame(() => loadProgress?.classList.add("is-complete"));
  const imageReady = Array.from(document.images).map((image) => image.complete
    ? Promise.resolve()
    : new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    }));
  Promise.race([
    Promise.allSettled(imageReady),
    new Promise((resolve) => window.setTimeout(resolve, 1200))
  ]).then(finishLoading);
})();
