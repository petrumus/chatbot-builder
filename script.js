(() => {
  // ============================================
  // i18n System
  // ============================================

  let currentLang = "en";

  // Auto-detect language from browser locale
  (function detectLanguage() {
    const nav = (navigator.language || navigator.userLanguage || "en").toLowerCase();
    if (nav.startsWith("ro")) currentLang = "ro";
    else if (nav.startsWith("ru")) currentLang = "ru";
    else currentLang = "en";
  })();

  function t(key) {
    const lang = LANG[currentLang] || LANG.en;
    return lang[key] || LANG.en[key] || key;
  }

  function applyLanguage() {
    // Update all [data-i18n] elements (textContent)
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });

    // Update all [data-i18n-placeholder] elements
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });

    // Update page title
    const titleEl = document.querySelector("[data-i18n-title]");
    if (titleEl) {
      document.title = t(titleEl.getAttribute("data-i18n-title"));
    }

    // Update html lang attribute
    document.documentElement.lang = currentLang;

    // Update lang switcher active state
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-lang") === currentLang);
    });
  }

  // Language switcher click handlers
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentLang = btn.getAttribute("data-lang");
      applyLanguage();
    });
  });

  // Apply language on load
  applyLanguage();

  // ============================================
  // DOM References
  // ============================================

  const form = document.getElementById("chatbot-form");
  const formSection = document.getElementById("form-section");
  const progressSection = document.getElementById("progress-section");
  const resultSection = document.getElementById("result-section");
  const resultSuccess = document.getElementById("result-success");
  const resultError = document.getElementById("result-error");
  const retryBtn = document.getElementById("retry-btn");
  const submitBtn = document.getElementById("submit-btn");

  const steps = [
    document.getElementById("step-1"),
    document.getElementById("step-2"),
    document.getElementById("step-3"),
    document.getElementById("step-4"),
  ];

  const STEP_INTERVAL = 3000;
  const MAX_MESSAGES = 30;
  let stepTimers = [];
  let savedFormData = null;

  // --- Chat State ---
  let userUuid = null;
  let chatbotName = null;
  let messageCount = 0;
  let sessionEnded = false;
  let isWaitingForResponse = false;

  // Chat DOM refs
  const chatConfig = document.getElementById("chat-config");
  const chatPanel = document.getElementById("chat-panel");
  const chatMessages = document.getElementById("chat-messages");
  const chatReplyButtons = document.getElementById("chat-reply-buttons");
  const chatInput = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send-btn");
  const container = document.querySelector(".container");
  const sidebarCta = document.getElementById("sidebar-cta");
  const sidebarCtaOriginalHtml = sidebarCta.innerHTML;

  // --- Validation ---

  function isValidDomain(value) {
    const stripped = value.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
    return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(stripped);
  }

  function normalizeWebsite(value) {
    let v = value.trim();
    v = v.replace(/^(https?:\/\/)?/, "");
    return "https://" + v;
  }

  function validateField(input) {
    const errorEl = document.getElementById(input.id + "-error");
    let message = "";

    if (!input.value.trim()) {
      message = t("validationRequired");
    } else if (input.id === "website") {
      if (!isValidDomain(input.value.trim())) {
        message = t("validationDomain");
      }
    } else if (input.minLength && input.value.trim().length < input.minLength) {
      message = t("validationMinLength").replace("{n}", input.minLength);
    }

    if (message) {
      input.classList.add("invalid");
      errorEl.textContent = message;
      return false;
    }

    input.classList.remove("invalid");
    errorEl.textContent = "";
    return true;
  }

  function validateForm() {
    const fields = form.querySelectorAll("input, textarea");
    let valid = true;
    fields.forEach((field) => {
      if (!validateField(field)) valid = false;
    });
    return valid;
  }

  // Clear errors on input
  form.querySelectorAll("input, textarea").forEach((field) => {
    field.addEventListener("input", () => validateField(field));
  });

  // --- Sections ---

  function showSection(section) {
    formSection.classList.add("hidden");
    progressSection.classList.add("hidden");
    resultSection.classList.add("hidden");
    resultSuccess.classList.add("hidden");
    resultError.classList.add("hidden");
    section.classList.remove("hidden");
  }

  // --- Progress Steps ---

  function resetSteps() {
    stepTimers.forEach(clearTimeout);
    stepTimers = [];
    steps.forEach((step) => {
      step.classList.add("hidden");
      step.classList.remove("done");
      const spinner = step.querySelector(".spinner");
      const checkmark = step.querySelector(".checkmark");
      spinner.classList.remove("hidden");
      checkmark.classList.add("hidden");
    });
  }

  function markStepDone(step) {
    step.classList.add("done");
    const spinner = step.querySelector(".spinner");
    const checkmark = step.querySelector(".checkmark");
    spinner.classList.add("hidden");
    checkmark.classList.remove("hidden");
  }

  function startProgressSteps() {
    resetSteps();
    steps[0].classList.remove("hidden");

    for (let i = 1; i < steps.length; i++) {
      const timer = setTimeout(() => {
        markStepDone(steps[i - 1]);
        steps[i].classList.remove("hidden");
      }, STEP_INTERVAL * i);
      stepTimers.push(timer);
    }
  }

  function completeAllSteps() {
    stepTimers.forEach(clearTimeout);
    stepTimers = [];
    steps.forEach((step) => {
      step.classList.remove("hidden");
      markStepDone(step);
    });
  }

  // --- API Call ---

  async function submitToBackend(data) {
    const response = await fetch(CONFIG.SUPABASE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(data),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const rawMsg = body?.message;
      const errMsg = (typeof rawMsg === "string") ? rawMsg : `Request failed (${response.status})`;
      const err = new Error(errMsg);
      err.data = body;
      throw err;
    }

    return body;
  }

  // --- Form Submit ---

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const data = {
      website: normalizeWebsite(document.getElementById("website").value),
      description: document.getElementById("description").value.trim(),
      chatbotName: document.getElementById("chatbot-name").value.trim(),
      lang: currentLang,
    };

    savedFormData = data;
    submitBtn.disabled = true;

    showSection(progressSection);
    startProgressSteps();

    try {
      const result = await submitToBackend(data);

      completeAllSteps();
      await new Promise((r) => setTimeout(r, 600));

      if (result.success === false) {
        showBuildError(result);
        return;
      }

      const uuid = result.uuid || (result.user_data && result.user_data.uuid);
      if (uuid) {
        activateChatMode(uuid, data);
      } else {
        showSection(resultSection);
        resultError.classList.remove("hidden");
        document.getElementById("error-message").textContent = t("noUuidError");
      }
    } catch (err) {
      completeAllSteps();
      await new Promise((r) => setTimeout(r, 400));

      if (err.data && err.data.success === false) {
        showBuildError(err.data);
        return;
      }

      showSection(resultSection);
      resultError.classList.remove("hidden");
      document.getElementById("error-message").textContent = t("buildErrorFallback");
    } finally {
      submitBtn.disabled = false;
    }
  });

  // --- Build Error Display ---

  function showBuildError(result) {
    completeAllSteps();
    showSection(resultSection);
    resultError.classList.remove("hidden");

    let msg = result.message;
    // message may be an object with failures array from n8n validation
    if (msg && typeof msg === "object") {
      msg = (msg.failures && msg.failures[0]) || t("buildErrorFallback");
    }
    document.getElementById("error-message").textContent = msg || t("buildErrorFallback");
  }

  // --- Retry ---

  retryBtn.addEventListener("click", () => {
    showSection(formSection);
  });

  // ============================================
  // Chat Mode
  // ============================================

  function activateChatMode(uuid, formData) {
    userUuid = uuid;
    chatbotName = formData.chatbotName;
    messageCount = 0;
    sessionEnded = false;
    isWaitingForResponse = false;

    // Hide all existing sections
    formSection.classList.add("hidden");
    progressSection.classList.add("hidden");
    resultSection.classList.add("hidden");
    document.querySelector("header").classList.add("hidden");

    // Populate config panel
    document.getElementById("config-bot-name").textContent = chatbotName;
    document.getElementById("config-website").textContent = formData.website;
    document.getElementById("config-website").href = formData.website;
    document.getElementById("config-description").textContent = formData.description;

    // Populate chat header
    document.getElementById("chat-bot-name").textContent = chatbotName;

    // Clear previous chat
    chatMessages.innerHTML = "";
    chatReplyButtons.innerHTML = "";
    chatInput.value = "";
    chatInput.disabled = false;
    chatInput.placeholder = t("chatPlaceholder");
    chatSendBtn.disabled = true;

    // Reset sidebar CTA
    sidebarCta.classList.remove("hidden");
    sidebarCta.innerHTML = sidebarCtaOriginalHtml;
    document.getElementById("sidebar-cta-submit-btn").addEventListener("click", submitSidebarContactForm);

    // Show chat panels
    chatConfig.classList.remove("hidden");
    chatPanel.classList.remove("hidden");

    // Switch container to chat-mode layout
    container.classList.add("chat-mode");

    // Auto-send greeting
    sendMessage(t("autoGreeting"));
  }

  // --- Markdown Renderer ---

  function renderMarkdown(text) {
    // Escape HTML entities first (XSS prevention)
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    // Split into lines for block-level processing
    const lines = html.split("\n");
    const result = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Bullet list items: "* text" or "- text" at start of line
      const bulletMatch = line.match(/^(\*|-)\s+(.+)$/);
      if (bulletMatch) {
        if (!inList) {
          result.push('<ul class="md-list">');
          inList = true;
        }
        result.push("<li>" + renderInline(bulletMatch[2]) + "</li>");
        continue;
      }

      // Close list if we were in one
      if (inList) {
        result.push("</ul>");
        inList = false;
      }

      // Empty line → paragraph break
      if (line.trim() === "") {
        result.push("<br>");
        continue;
      }

      // Regular line — apply inline formatting
      result.push(renderInline(line));
      // Add <br> unless next line is a bullet or end of text
      if (i < lines.length - 1) {
        const nextLine = lines[i + 1];
        if (!nextLine.match(/^(\*|-)\s+/)) {
          result.push("<br>");
        }
      }
    }

    // Close any open list
    if (inList) {
      result.push("</ul>");
    }

    return result.join("");
  }

  function renderInline(text) {
    // Bold: **text**
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Italic: *text* (but not at start of line — those are bullets, already handled)
    text = text.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, "<em>$1</em>");

    // Markdown links: [text](url)
    text = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );

    // Bare URLs: https://... or http://... (not already inside an href)
    text = text.replace(
      /(?<!="|&quot;)(https?:\/\/[^\s<,)]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );

    return text;
  }

  // --- Message Rendering ---

  function appendMessage(role, text, replyOptions) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble " + role;

    if (role === "bot") {
      bubble.innerHTML = renderMarkdown(text);
    } else {
      bubble.textContent = text;
    }

    chatMessages.appendChild(bubble);
    scrollToBottom();

    // Reply buttons
    chatReplyButtons.innerHTML = "";
    if (role === "bot" && replyOptions && replyOptions.length > 0 && !sessionEnded) {
      replyOptions.forEach((option) => {
        const btn = document.createElement("button");
        btn.className = "reply-btn";
        btn.textContent = option;
        btn.addEventListener("click", () => {
          sendMessage(option);
        });
        chatReplyButtons.appendChild(btn);
      });
    }
  }

  function appendError(text) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble error";
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
    scrollToBottom();
  }

  function showTypingIndicator() {
    const indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    indicator.id = "typing-indicator";
    indicator.innerHTML = "<span></span><span></span><span></span>";
    chatMessages.appendChild(indicator);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    const indicator = document.getElementById("typing-indicator");
    if (indicator) indicator.remove();
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // --- Send Message ---

  async function sendMessage(text) {
    if (isWaitingForResponse || sessionEnded || !text.trim()) return;

    const messageText = text.trim();

    // Clear reply buttons
    chatReplyButtons.innerHTML = "";

    // Show user message
    appendMessage("user", messageText);
    messageCount++;

    // Update input state
    isWaitingForResponse = true;
    chatInput.value = "";
    chatInput.disabled = true;
    chatSendBtn.disabled = true;

    showTypingIndicator();

    try {
      const response = await fetch(CONFIG.CHAT_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          text: messageText,
          user_uuid: userUuid,
          lang: currentLang,
        }),
      });

      hideTypingIndicator();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      messageCount++;

      const isSessionEnd = data.session_ended
        || messageCount >= MAX_MESSAGES
        || (!data.response && !data.user_reply_options);

      if (isSessionEnd) {
        const endMsg = data.response || t("sessionEndFallback");
        appendMessage("bot", endMsg, []);
        disableChat(t("sessionEndedBar"));
        return;
      }

      appendMessage("bot", data.response, data.user_reply_options || []);
    } catch (err) {
      hideTypingIndicator();
      appendError(t("chatError"));
      messageCount--;
    } finally {
      if (!sessionEnded) {
        isWaitingForResponse = false;
        chatInput.disabled = false;
        chatInput.focus();
        updateSendButton();
      }
    }
  }

  // --- Disable Chat (session limit) ---

  function disableChat(reason) {
    sessionEnded = true;
    isWaitingForResponse = false;
    chatInput.disabled = true;
    chatInput.placeholder = "";
    chatSendBtn.disabled = true;
    chatReplyButtons.innerHTML = "";

    // Hide sidebar CTA (in-chat CTA takes over)
    sidebarCta.classList.add("hidden");

    // Add session-ended bar
    const endedEl = document.createElement("div");
    endedEl.className = "chat-session-ended";
    endedEl.textContent = reason;
    const chatCard = chatPanel.querySelector(".chat-card");
    chatCard.appendChild(endedEl);

    // Add contact CTA form
    const cta = document.createElement("div");
    cta.className = "contact-cta";
    cta.innerHTML = `
      <div class="contact-cta-title">${escapeHtml(t("contactTitle"))}</div>
      <div class="field">
        <label>${escapeHtml(t("contactName"))}</label>
        <input type="text" id="cta-name" required>
      </div>
      <div class="field">
        <label>${escapeHtml(t("contactContact"))}</label>
        <input type="text" id="cta-contact" required>
      </div>
      <div class="field">
        <label>${escapeHtml(t("contactNote"))}</label>
        <textarea id="cta-note" rows="2"></textarea>
      </div>
      <button class="contact-cta-btn" id="cta-submit-btn">${escapeHtml(t("contactSubmit"))}</button>
      <div class="contact-cta-error hidden" id="cta-error"></div>
    `;
    chatCard.appendChild(cta);

    // CTA submit handler
    document.getElementById("cta-submit-btn").addEventListener("click", submitContactForm);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // --- Contact Form Submission ---

  async function submitContactForm() {
    const nameEl = document.getElementById("cta-name");
    const contactEl = document.getElementById("cta-contact");
    const noteEl = document.getElementById("cta-note");
    const errorEl = document.getElementById("cta-error");
    const submitBtnEl = document.getElementById("cta-submit-btn");

    const name = nameEl.value.trim();
    const contact = contactEl.value.trim();
    const note = noteEl.value.trim();

    // Validate
    errorEl.classList.add("hidden");
    errorEl.textContent = "";

    if (!name || !contact) {
      errorEl.textContent = t("validationRequired");
      errorEl.classList.remove("hidden");
      return;
    }

    submitBtnEl.disabled = true;

    try {
      const response = await fetch(CONFIG.CONTACT_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          name: name,
          contact: contact,
          note: note,
          user_uuid: userUuid,
          chatbot_name: chatbotName,
          lang: currentLang,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Replace form with success message
      const ctaEl = document.querySelector(".contact-cta");
      ctaEl.innerHTML = `<div class="contact-cta-success">${escapeHtml(t("contactSuccess"))}</div>`;
    } catch (err) {
      errorEl.textContent = t("contactError");
      errorEl.classList.remove("hidden");
      submitBtnEl.disabled = false;
    }
  }

  // --- Sidebar Contact Form Submission ---

  async function submitSidebarContactForm() {
    const contactEl = document.getElementById("sidebar-cta-contact");
    const errorEl = document.getElementById("sidebar-cta-error");
    const submitBtnEl = document.getElementById("sidebar-cta-submit-btn");

    const contact = contactEl.value.trim();

    // Validate
    errorEl.classList.add("hidden");
    errorEl.textContent = "";

    if (!contact) {
      errorEl.textContent = t("validationRequired");
      errorEl.classList.remove("hidden");
      return;
    }

    submitBtnEl.disabled = true;

    try {
      const response = await fetch(CONFIG.CONTACT_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          contact: contact,
          user_uuid: userUuid,
          chatbot_name: chatbotName,
          lang: currentLang,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Replace form with success message
      sidebarCta.innerHTML = `<div class="sidebar-cta-success">${escapeHtml(t("contactSuccess"))}</div>`;
    } catch (err) {
      errorEl.textContent = t("contactError");
      errorEl.classList.remove("hidden");
      submitBtnEl.disabled = false;
    }
  }

  // Attach sidebar CTA submit handler
  document.getElementById("sidebar-cta-submit-btn").addEventListener("click", submitSidebarContactForm);

  // --- Input Handling ---

  function updateSendButton() {
    chatSendBtn.disabled = !chatInput.value.trim() || isWaitingForResponse || sessionEnded;
  }

  chatInput.addEventListener("input", updateSendButton);

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (chatInput.value.trim() && !isWaitingForResponse && !sessionEnded) {
        sendMessage(chatInput.value);
      }
    }
  });

  chatSendBtn.addEventListener("click", () => {
    if (chatInput.value.trim() && !isWaitingForResponse && !sessionEnded) {
      sendMessage(chatInput.value);
    }
  });

  // --- Build Another ---

  document.getElementById("build-another-btn").addEventListener("click", () => {
    // Reset chat state
    userUuid = null;
    chatbotName = null;
    messageCount = 0;
    sessionEnded = false;
    isWaitingForResponse = false;

    // Hide chat panels
    chatConfig.classList.add("hidden");
    chatPanel.classList.add("hidden");
    container.classList.remove("chat-mode");

    // Remove session-ended bar and contact CTA
    const endedEl = chatPanel.querySelector(".chat-session-ended");
    if (endedEl) endedEl.remove();
    const ctaEl = chatPanel.querySelector(".contact-cta");
    if (ctaEl) ctaEl.remove();

    // Show form
    document.querySelector("header").classList.remove("hidden");
    showSection(formSection);
  });
})();
