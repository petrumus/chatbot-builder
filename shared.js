(() => {
  // ============================================
  // Visitor ID
  // ============================================

  const visitorId = localStorage.getItem("visitor_id") || (() => {
    const id = crypto.randomUUID();
    localStorage.setItem("visitor_id", id);
    return id;
  })();

  // ============================================
  // i18n System
  // ============================================

  let currentLang = localStorage.getItem("lang") || (() => {
    const nav = (navigator.language || navigator.userLanguage || "en").toLowerCase();
    if (nav.startsWith("ro")) return "ro";
    if (nav.startsWith("ru")) return "ru";
    return "en";
  })();

  // Page visit (fire-and-forget)
  fetch(CONFIG.PAGE_VISIT_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ visitor_id: visitorId, lang: currentLang }),
  }).catch(() => {});

  function t(key) {
    const lang = LANG[currentLang] || LANG.en;
    return lang[key] || LANG.en[key] || key;
  }

  function applyLanguage() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
    const titleEl = document.querySelector("[data-i18n-title]");
    if (titleEl) document.title = t(titleEl.getAttribute("data-i18n-title"));
    document.documentElement.lang = currentLang;
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-lang") === currentLang);
    });
  }

  // ============================================
  // Event Tracking
  // ============================================

  function trackEvent(eventName, metadata = {}) {
    fetch(CONFIG.TRACK_EVENT_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        event_name: eventName,
        page: location.pathname,
        metadata,
        visitor_id: visitorId,
      }),
    }).catch(() => {});
  }

  // Language switcher
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentLang = btn.getAttribute("data-lang");
      localStorage.setItem("lang", currentLang);
      applyLanguage();
      trackEvent("lang_switch", { lang: currentLang });
    });
  });

  applyLanguage();

  // Expose for demo.js
  window.NexonTech = {
    visitorId,
    t,
    getLang: () => currentLang,
    applyLanguage,
    trackEvent,
  };

  // ============================================
  // Navbar
  // ============================================

  const navbar = document.getElementById("navbar");
  const hamburger = document.getElementById("nav-hamburger");
  const navLinks = document.getElementById("nav-links");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      hamburger.classList.toggle("open");
      hamburger.setAttribute("aria-expanded", isOpen);
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        hamburger.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
        trackEvent("nav_click", { target: link.getAttribute("href") });
      });
    });
  }

  if (navbar) {
    if (document.body.classList.contains("page-home")) {
      const onScroll = () => navbar.classList.toggle("scrolled", window.scrollY > 60);
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    } else {
      navbar.classList.add("scrolled");
    }
  }

  // ============================================
  // Smooth Scroll
  // ============================================

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (href === "#") return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = navbar ? navbar.offsetHeight + 16 : 0;
        window.scrollTo({
          top: target.offsetTop - offset,
          behavior: "smooth",
        });
      }
    });
  });

  // ============================================
  // Scroll Reveal
  // ============================================

  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => observer.observe(el));
  }

  // ============================================
  // CTA Click Tracking (Home page)
  // ============================================

  if (document.body.classList.contains("page-home")) {
    document.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const section = btn.closest("section");
        const sectionClass = section ? section.className.replace(/\s*section\s*/, "").trim() : "unknown";
        trackEvent("cta_click", { label: btn.textContent.trim(), section: sectionClass });
      });
    });
  }

  // ============================================
  // FAQ Accordion
  // ============================================

  document.querySelectorAll(".faq-question").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach((i) => i.classList.remove("open"));
      if (!isOpen) {
        item.classList.add("open");
        trackEvent("faq_toggle", { question: btn.textContent.trim() });
      }
    });
  });

  // ============================================
  // Pricing Toggle
  // ============================================

  const pricingToggle = document.getElementById("pricing-toggle");
  if (pricingToggle) {
    pricingToggle.addEventListener("change", () => {
      const isAnnual = pricingToggle.checked;
      const attr = isAnnual ? "data-annual" : "data-monthly";
      document.querySelectorAll("[data-monthly][data-annual]").forEach((el) => {
        el.textContent = el.getAttribute(attr);
      });
      trackEvent("pricing_toggle", { period: isAnnual ? "annual" : "monthly" });
    });
  }

  // ============================================
  // Pricing Modal
  // ============================================

  const modal = document.getElementById("pricing-modal");
  if (modal) {
    const modalOverlay = modal;
    const modalTitle = document.getElementById("modal-plan-title");
    const modalContact = document.getElementById("modal-contact");
    const modalSubmitBtn = document.getElementById("modal-submit-btn");
    const modalError = document.getElementById("modal-error");
    const modalCloseBtn = document.getElementById("modal-close-btn");
    let modalPlan = "";

    function openModal(planName) {
      modalPlan = planName;
      modalTitle.textContent = t("modalTitle").replace("{plan}", planName);
      modalContact.value = "";
      modalContact.placeholder = t("contactContactPlaceholder");
      modalError.classList.add("hidden");
      modalError.textContent = "";
      modalSubmitBtn.disabled = false;
      modalSubmitBtn.textContent = t("contactSubmit");
      modalOverlay.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      modalContact.focus();
      trackEvent("modal_open", { plan: planName });
    }

    function closeModal() {
      modalOverlay.classList.add("hidden");
      document.body.style.overflow = "";
      trackEvent("modal_close", { plan: modalPlan });
    }

    modalCloseBtn.addEventListener("click", closeModal);
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modalOverlay.classList.contains("hidden")) closeModal();
    });

    async function submitModal() {
      const contact = modalContact.value.trim();
      if (!contact) {
        modalError.textContent = t("validationRequired");
        modalError.classList.remove("hidden");
        return;
      }

      modalSubmitBtn.disabled = true;
      modalError.classList.add("hidden");

      try {
        const response = await fetch(CONFIG.CONTACT_FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            contact,
            note: `Plan: ${modalPlan}`,
            lang: currentLang,
            visitor_id: visitorId,
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        trackEvent("modal_submit", { plan: modalPlan });
        modal.querySelector(".modal-card").innerHTML =
          `<div class="modal-success">${t("contactSuccess")}</div>`;
        setTimeout(closeModal, 2000);
      } catch {
        modalError.textContent = t("contactError");
        modalError.classList.remove("hidden");
        modalSubmitBtn.disabled = false;
      }
    }

    modalSubmitBtn.addEventListener("click", submitModal);
    modalContact.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitModal();
    });

    // Wire pricing CTA buttons that point to href="#"
    document.querySelectorAll('.pricing-cta-btn[href="#"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const card = btn.closest(".pricing-card") || btn.closest(".enterprise-banner");
        const planName = card ? card.querySelector("h3").textContent.trim() : "Unknown";
        trackEvent("plan_cta_click", { plan: planName, action: btn.textContent.trim() });
        openModal(planName);
      });
    });
  }
})();
