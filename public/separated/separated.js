(() => {
  const body = document.body;
  const root = document.documentElement;
  const cursor = document.querySelector(".cursor-orb");
  const nav = document.querySelector(".nav-shell");
  const menu = document.querySelector(".menu-button");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const languageToggle = document.querySelector("[data-language-toggle]");
  const themeToggle = document.querySelector("[data-theme-toggle]");
  const translations = {
    en: {
      navLabel: "Primary navigation",
      displayPreferences: "Display preferences",
      navCapabilities: "Capabilities",
      navManagement: "RTS Management",
      navCustomers: "Customers",
      navContact: "Contact",
      navCta: "Start a conversation",
      menu: "Menu",
      themeLight: "Light mode",
      themeDark: "Dark mode",
      heroEyebrow: "Royal Technology Solutions · 2026",
      heroTitle: "Where <em>code</em><br>becomes <strong>power.</strong>",
      heroLede: "We design digital systems that make ambitious businesses feel lighter, faster, and ready for what comes next.",
      heroPrimary: "Build with RTS",
      heroSecondary: "See the system",
      proofSystems: "Focused systems",
      proofSupport: "Human support",
      proofScale: "Built to scale",
      signalOnline: "signal online",
      operationalClarity: "operational clarity",
      systemsInMotion: "systems in motion",
      scrollToEnter: "Scroll to enter",
      manifestoEyebrow: "A clearer way forward",
      manifestoTitle: "Technology should feel like an advantage, not another thing to manage.",
      manifestoText: "RTS brings strategy, design, engineering, and operations into one focused rhythm—so every screen, sale, and decision moves in the same direction.",
      capabilitiesEyebrow: "02 / Capabilities",
      capabilitiesTitle: "Small enough to care.<br><em>Serious enough to deliver.</em>",
      digitalProductsTitle: "Digital products",
      digitalProductsText: "Websites and applications that give your ideas a clear, confident place to live.",
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
      navCapabilities: "الخدمات",
      navManagement: "نظام RTS Management",
      navCustomers: "عملاؤنا",
      navContact: "تواصل معنا",
      navCta: "ابدأ محادثة",
      menu: "القائمة",
      themeLight: "الوضع الفاتح",
      themeDark: "الوضع الداكن",
      heroEyebrow: "رويال للحلول التكنولوجية · 2026",
      heroTitle: "حيث يتحول <em>الكود</em><br>إلى <strong>قوة.</strong>",
      heroLede: "نصمم أنظمة رقمية تجعل الأعمال الطموحة أخف وأسرع وأكثر استعداداً للخطوة القادمة.",
      heroPrimary: "ابنِ مع RTS",
      heroSecondary: "شاهد النظام",
      proofSystems: "أنظمة مركزة",
      proofSupport: "دعم إنساني",
      proofScale: "جاهزة للتوسع",
      signalOnline: "الإشارة متصلة",
      operationalClarity: "وضوح تشغيلي",
      systemsInMotion: "أنظمة تتحرك",
      scrollToEnter: "مرر للدخول",
      manifestoEyebrow: "طريق أوضح إلى الأمام",
      manifestoTitle: "يجب أن تكون التكنولوجيا ميزة، لا عبئاً جديداً عليك إدارته.",
      manifestoText: "تجمع RTS الاستراتيجية والتصميم والهندسة والعمليات في إيقاع واحد، حتى تتحرك كل شاشة وكل عملية بيع وكل قرار بالاتجاه نفسه.",
      capabilitiesEyebrow: "02 / خدماتنا",
      capabilitiesTitle: "صغير بما يكفي ليهتم.<br><em>وجاد بما يكفي لينجز.</em>",
      digitalProductsTitle: "منتجات رقمية",
      digitalProductsText: "مواقع وتطبيقات تمنح أفكارك مكاناً واضحاً وواثقاً لتعيش وتنمو.",
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
  if (cursor && !prefersReducedMotion.matches) window.addEventListener("pointermove", moveCursor, { passive: true });

  menu?.addEventListener("click", () => {
    const expanded = menu.getAttribute("aria-expanded") === "true";
    menu.setAttribute("aria-expanded", String(!expanded));
    nav?.classList.toggle("is-open", !expanded);
  });
  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    nav.classList.remove("is-open");
    menu?.setAttribute("aria-expanded", "false");
  }));

  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !prefersReducedMotion.matches) {
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
  if (canvas && context && !prefersReducedMotion.matches) {
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
      const count = Math.min(110, Math.max(42, Math.round(width * height / 18000)));
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
  const whatsappLinks = document.querySelectorAll("[data-whatsapp-link]");
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
      setWhatsAppLinks();
    })
    .catch(() => {
      whatsappLinks.forEach((link) => link.removeAttribute("target"));
    });
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    if (!whatsappNumber) {
      if (status) status.textContent = translations[language].whatsappUnavailable;
      return;
    }
    if (status) status.textContent = translations[language].whatsappReady;
    const intro = language === "ar" ? "مرحباً RTS، اسمي" : "Hello RTS, my name is";
    const from = language === "ar" ? " من شركة " : " from ";
    const message = `${intro} ${data.get("name") || (language === "ar" ? "..." : "there")}${data.get("company") ? `${from}${data.get("company")}` : ""}.\n\n${data.get("message") || ""}`;
    window.location.assign(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`);
  });
  document.querySelector("#year").textContent = String(new Date().getFullYear());
})();
