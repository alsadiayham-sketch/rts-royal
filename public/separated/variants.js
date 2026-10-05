(() => {
  const root = document.documentElement;
  root.classList.add("js");
  const nav = document.querySelector(".variant-nav");
  const menu = document.querySelector(".variant-menu");
  const languageButton = document.querySelector("[data-language-toggle]");
  const themeButton = document.querySelector("[data-theme-toggle]");
  const form = document.querySelector("[data-contact-form]");
  const status = form?.querySelector("[data-form-status]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let language = localStorage.getItem("rts-variant-language") || ((navigator.language || "").toLowerCase().startsWith("ar") ? "ar" : "en");
  let whatsappNumber = "";

  const applyLanguage = (next) => {
    language = next === "ar" ? "ar" : "en";
    root.lang = language;
    root.dir = language === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-en][data-ar]").forEach((element) => {
      element.textContent = element.dataset[language];
    });
    document.querySelectorAll("[data-en-placeholder][data-ar-placeholder]").forEach((element) => {
      element.placeholder = language === "ar" ? element.dataset.arPlaceholder : element.dataset.enPlaceholder;
    });
    document.title = language === "ar" ? "RTS — حيث يتحول الكود إلى قوة" : "RTS — where code becomes power";
    if (languageButton) {
      languageButton.textContent = language === "ar" ? "English" : "العربية";
      languageButton.setAttribute("aria-label", language === "ar" ? "Switch to English" : "التبديل إلى العربية");
    }
    if (themeButton) {
      const isLight = root.dataset.theme === "light";
      themeButton.querySelector("[data-theme-label]").textContent = isLight
        ? (language === "ar" ? "الوضع الداكن" : "Dark mode")
        : (language === "ar" ? "الوضع الفاتح" : "Light mode");
    }
    localStorage.setItem("rts-variant-language", language);
    updateWhatsAppLinks();
  };

  const applyTheme = (next) => {
    const theme = next === "light" || next === "dark"
      ? next
      : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    root.dataset.theme = theme;
    if (themeButton) {
      themeButton.querySelector("[data-theme-icon]").textContent = theme === "light" ? "☀" : "☾";
      themeButton.querySelector("[data-theme-label]").textContent = theme === "light"
        ? (language === "ar" ? "الوضع الداكن" : "Dark mode")
        : (language === "ar" ? "الوضع الفاتح" : "Light mode");
      themeButton.setAttribute("aria-label", theme === "light" ? "Switch to dark mode" : "Switch to light mode");
    }
    localStorage.setItem("rts-variant-theme", theme);
  };

  const updateWhatsAppLinks = () => {
    if (!whatsappNumber) return;
    const greeting = language === "ar" ? "مرحباً RTS، أود مناقشة مشروع." : "Hello RTS, I would like to discuss a project.";
    document.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
      link.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(greeting)}`;
      link.target = "_blank";
      link.rel = "noopener";
    });
  };

  applyTheme(localStorage.getItem("rts-variant-theme") || "system");
  applyLanguage(language);
  languageButton?.addEventListener("click", () => applyLanguage(language === "ar" ? "en" : "ar"));
  themeButton?.addEventListener("click", () => applyTheme(root.dataset.theme === "light" ? "dark" : "light"));
  menu?.addEventListener("click", () => {
    const open = nav?.classList.toggle("is-open");
    menu.setAttribute("aria-expanded", String(Boolean(open)));
  });
  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    nav.classList.remove("is-open");
    menu?.setAttribute("aria-expanded", "false");
  }));

  const revealItems = document.querySelectorAll(".variant-reveal");
  if ("IntersectionObserver" in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }), { threshold: .12 });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  if (!reducedMotion) {
    window.addEventListener("pointermove", (event) => {
      root.style.setProperty("--pointer-x", `${event.clientX}px`);
      root.style.setProperty("--pointer-y", `${event.clientY}px`);
    }, { passive: true });
  }

  fetch("/api/settings", { headers: { Accept: "application/json" } })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error("settings unavailable")))
    .then((settings) => {
      whatsappNumber = typeof settings.whatsappNumber === "string" ? settings.whatsappNumber.replace(/\D/g, "") : "";
      updateWhatsAppLinks();
    })
    .catch(() => {});

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!whatsappNumber) {
      if (status) status.textContent = language === "ar" ? "واتساب غير جاهز بعد." : "WhatsApp is not ready yet.";
      return;
    }
    const data = new FormData(form);
    const prefix = language === "ar" ? "مرحباً RTS، اسمي" : "Hello RTS, my name is";
    const company = data.get("company") ? (language === "ar" ? " من شركة " : " from ") + data.get("company") : "";
    const message = `${prefix} ${data.get("name") || "..."}${company}.\n\n${data.get("message") || ""}`;
    if (status) status.textContent = language === "ar" ? "يتم فتح واتساب للمراجعة…" : "Opening WhatsApp for your review…";
    window.location.assign(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`);
  });

  document.querySelectorAll("[data-year]").forEach((element) => { element.textContent = new Date().getFullYear(); });
})();
