(() => {
  const NT = window.NexonTech;

  // ============================================
  // DOM References
  // ============================================

  const form = document.getElementById("chatbot-form");
  if (!form) return; // Not on demo page

  const formSection = document.getElementById("form-section");
  const progressSection = document.getElementById("progress-section");
  const resultSection = document.getElementById("result-section");
  const resultSuccess = document.getElementById("result-success");
  const resultError = document.getElementById("result-error");
  const retryBtn = document.getElementById("retry-btn");
  const submitBtn = document.getElementById("submit-btn");
  const demoHeader = document.getElementById("demo-header");

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
  const state = {
    userUuid: null,
    chatbotName: null,
    messageCount: 0,
    sessionEnded: false,
    isWaitingForResponse: false,
  };

  // Chat DOM refs
  const chatConfig = document.getElementById("chat-config");
  const chatPanel = document.getElementById("chat-panel");
  const chatMessages = document.getElementById("chat-messages");
  const chatReplyButtons = document.getElementById("chat-reply-buttons");
  const chatInput = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send-btn");
  const container = document.getElementById("demo-container");
  const sidebarCta = document.getElementById("sidebar-cta");
  const sidebarCtaOriginalHtml = sidebarCta ? sidebarCta.innerHTML : "";

  // ============================================
  // Validation
  // ============================================

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
      message = NT.t("validationRequired");
    } else if (input.id === "website") {
      if (!isValidDomain(input.value.trim())) {
        message = NT.t("validationDomain");
      }
    } else if (input.minLength && input.value.trim().length < input.minLength) {
      message = NT.t("validationMinLength").replace("{n}", input.minLength);
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

  // ============================================
  // Section Management
  // ============================================

  function showSection(section) {
    formSection.classList.add("hidden");
    progressSection.classList.add("hidden");
    resultSection.classList.add("hidden");
    resultSuccess.classList.add("hidden");
    resultError.classList.add("hidden");
    section.classList.remove("hidden");
  }

  // ============================================
  // Progress Steps
  // ============================================

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

  // ============================================
  // API Call
  // ============================================

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

  // ============================================
  // Form Submit
  // ============================================

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const data = {
      website: normalizeWebsite(document.getElementById("website").value),
      description: document.getElementById("description").value.trim(),
      chatbotName: document.getElementById("chatbot-name").value.trim(),
      lang: NT.getLang(),
      visitor_id: NT.visitorId,
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
        document.getElementById("error-message").textContent = NT.t("noUuidError");
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
      document.getElementById("error-message").textContent = getBuildErrorMessage(err);
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ============================================
  // Build Error Display
  // ============================================

  function showBuildError(result) {
    completeAllSteps();
    showSection(resultSection);
    resultError.classList.remove("hidden");

    let msg = result.message;
    if (msg && typeof msg === "object") {
      msg = (msg.failures && msg.failures[0]) || NT.t("buildErrorFallback");
    }
    document.getElementById("error-message").textContent = msg || NT.t("buildErrorFallback");
  }

  function getBuildErrorMessage(err) {
    if (err instanceof TypeError) return NT.t("buildErrorNetwork");
    if (err.message && /50[234]/.test(err.message)) return NT.t("buildErrorUnavailable");
    return NT.t("buildErrorFallback");
  }

  function getChatErrorMessage(err) {
    if (err instanceof TypeError) return NT.t("chatErrorNetwork");
    if (err.message && /50[234]/.test(err.message)) return NT.t("chatErrorUnavailable");
    return NT.t("chatError");
  }

  // --- Retry ---
  retryBtn.addEventListener("click", () => {
    showSection(formSection);
  });

  // ============================================
  // Chat Mode
  // ============================================

  function activateChatMode(uuid, formData) {
    state.userUuid = uuid;
    state.chatbotName = formData.chatbotName;
    state.messageCount = 0;
    state.sessionEnded = false;
    state.isWaitingForResponse = false;

    // Hide all existing sections
    formSection.classList.add("hidden");
    progressSection.classList.add("hidden");
    resultSection.classList.add("hidden");
    if (demoHeader) demoHeader.classList.add("hidden");

    // Populate config panel
    document.getElementById("config-bot-name").textContent = state.chatbotName;
    document.getElementById("config-website").textContent = formData.website;
    document.getElementById("config-website").href = formData.website;
    document.getElementById("config-description").textContent = formData.description;

    // Populate chat header
    document.getElementById("chat-bot-name").textContent = state.chatbotName;

    // Clear previous chat
    chatMessages.innerHTML = "";
    chatReplyButtons.innerHTML = "";
    chatInput.value = "";
    chatInput.disabled = false;
    chatInput.placeholder = NT.t("chatPlaceholder");
    chatSendBtn.disabled = true;

    // Reset sidebar CTA
    if (sidebarCta) {
      sidebarCta.classList.remove("hidden");
      sidebarCta.innerHTML = sidebarCtaOriginalHtml;
      NT.applyLanguage();
      document.getElementById("sidebar-cta-submit-btn").addEventListener("click", submitSidebarContactForm);
    }

    // Show chat panels
    chatConfig.classList.remove("hidden");
    chatPanel.classList.remove("hidden");

    // Switch container to chat-mode layout
    container.classList.add("chat-mode");

    // Auto-send greeting
    sendMessage(NT.t("autoGreeting"));
  }

  // ============================================
  // Markdown Renderer
  // ============================================

  function renderMarkdown(text) {
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const lines = html.split("\n");
    const result = [];
    let listType = null;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      const bulletMatch = line.match(/^(\*|-)\s+(.+)$/);
      if (bulletMatch) {
        if (listType !== "ul") {
          if (listType) result.push("</" + listType + ">");
          result.push('<ul class="md-list">');
          listType = "ul";
        }
        result.push("<li>" + renderInline(bulletMatch[2]) + "</li>");
        continue;
      }

      const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
      if (orderedMatch) {
        if (listType !== "ol") {
          if (listType) result.push("</" + listType + ">");
          result.push('<ol class="md-list">');
          listType = "ol";
        }
        result.push("<li>" + renderInline(orderedMatch[1]) + "</li>");
        continue;
      }

      if (listType) {
        result.push("</" + listType + ">");
        listType = null;
      }

      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        const tableLines = [line];
        while (i + 1 < lines.length && lines[i + 1].trim().startsWith("|") && lines[i + 1].trim().endsWith("|")) {
          i++;
          tableLines.push(lines[i]);
        }
        if (tableLines.length >= 2) {
          result.push(renderTable(tableLines));
        } else {
          result.push(renderInline(line));
        }
        continue;
      }

      if (line.trim() === "") {
        result.push("<br>");
        continue;
      }

      result.push(renderInline(line));
      if (i < lines.length - 1) {
        const nextLine = lines[i + 1];
        if (!nextLine.match(/^(\*|-)\s+/) && !nextLine.match(/^\d+\.\s+/) && !nextLine.trim().startsWith("|")) {
          result.push("<br>");
        }
      }
    }

    if (listType) {
      result.push("</" + listType + ">");
    }

    return result.join("");
  }

  function renderTable(lines) {
    function parseCells(row) {
      return row.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); });
    }

    function isSeparator(row) {
      return parseCells(row).every(function (c) { return /^[-:]+$/.test(c); });
    }

    var hasHeader = lines.length >= 2 && isSeparator(lines[1]);
    var startIdx = hasHeader ? 2 : 0;
    var headerCells = hasHeader ? parseCells(lines[0]) : [];

    var tableHtml = '<div class="md-table-wrapper"><table class="md-table">';

    if (hasHeader) {
      tableHtml += "<thead><tr>";
      for (var h = 0; h < headerCells.length; h++) {
        tableHtml += "<th>" + renderInline(headerCells[h]) + "</th>";
      }
      tableHtml += "</tr></thead>";
    }

    tableHtml += "<tbody>";
    for (var r = startIdx; r < lines.length; r++) {
      if (isSeparator(lines[r])) continue;
      var cells = parseCells(lines[r]);
      tableHtml += "<tr>";
      for (var c = 0; c < cells.length; c++) {
        tableHtml += "<td>" + renderInline(cells[c]) + "</td>";
      }
      tableHtml += "</tr>";
    }
    tableHtml += "</tbody></table></div>";

    return tableHtml;
  }

  function renderInline(text) {
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, "<em>$1</em>");
    text = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );
    text = text.replace(
      /(?<!="|&quot;)(https?:\/\/[^\s<,)]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );
    return text;
  }

  // ============================================
  // Message Rendering
  // ============================================

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

    chatReplyButtons.innerHTML = "";
    if (role === "bot" && replyOptions && replyOptions.length > 0 && !state.sessionEnded) {
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
    requestAnimationFrame(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  // ============================================
  // Send Message
  // ============================================

  async function sendMessage(text) {
    if (state.isWaitingForResponse || state.sessionEnded || !text.trim()) return;

    const messageText = text.trim();

    chatReplyButtons.innerHTML = "";
    appendMessage("user", messageText);
    state.messageCount++;

    state.isWaitingForResponse = true;
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
          user_uuid: state.userUuid,
          lang: NT.getLang(),
          visitor_id: NT.visitorId,
        }),
      });

      hideTypingIndicator();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      state.messageCount++;

      const isSessionEnd = data.session_ended
        || state.messageCount >= MAX_MESSAGES
        || (!data.response && !data.user_reply_options);

      if (isSessionEnd) {
        const endMsg = data.response || NT.t("sessionEndFallback");
        appendMessage("bot", endMsg, []);
        disableChat(NT.t("sessionEndedBar"));

        if (state.messageCount >= MAX_MESSAGES) {
          fetch(CONFIG.REACHED_LIMIT_FUNCTION_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              user_uuid: state.userUuid,
              chatbot_name: state.chatbotName,
              lang: NT.getLang(),
              visitor_id: NT.visitorId,
            }),
          }).catch(() => {});
        }

        return;
      }

      appendMessage("bot", data.response, data.user_reply_options || []);
    } catch (err) {
      hideTypingIndicator();
      appendError(getChatErrorMessage(err));
      state.messageCount--;
    } finally {
      if (!state.sessionEnded) {
        state.isWaitingForResponse = false;
        chatInput.disabled = false;
        chatInput.focus();
        updateSendButton();
      }
    }
  }

  // ============================================
  // Disable Chat (session limit)
  // ============================================

  function disableChat(reason) {
    state.sessionEnded = true;
    state.isWaitingForResponse = false;
    chatInput.disabled = true;
    chatInput.placeholder = "";
    chatSendBtn.disabled = true;
    chatReplyButtons.innerHTML = "";

    if (sidebarCta) sidebarCta.classList.add("hidden");

    const endedEl = document.createElement("div");
    endedEl.className = "chat-session-ended";
    endedEl.textContent = reason;
    const chatCard = chatPanel.querySelector(".chat-card");
    chatCard.appendChild(endedEl);

    const cta = document.createElement("div");
    cta.className = "contact-cta";
    cta.innerHTML = `
      <div class="contact-cta-title">${escapeHtml(NT.t("contactTitle"))}</div>
      <div class="field">
        <label>${escapeHtml(NT.t("contactName"))}</label>
        <input type="text" id="cta-name" required>
      </div>
      <div class="field">
        <label>${escapeHtml(NT.t("contactContact"))}</label>
        <input type="text" id="cta-contact" required>
      </div>
      <div class="field">
        <label>${escapeHtml(NT.t("contactNote"))}</label>
        <textarea id="cta-note" rows="2"></textarea>
      </div>
      <button class="contact-cta-btn" id="cta-submit-btn">${escapeHtml(NT.t("contactSubmit"))}</button>
      <div class="contact-cta-error hidden" id="cta-error"></div>
    `;
    chatCard.appendChild(cta);

    document.getElementById("cta-submit-btn").addEventListener("click", submitContactForm);
    cta.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ============================================
  // Contact Form Submission
  // ============================================

  async function submitContactForm() {
    const nameEl = document.getElementById("cta-name");
    const contactEl = document.getElementById("cta-contact");
    const noteEl = document.getElementById("cta-note");
    const errorEl = document.getElementById("cta-error");
    const submitBtnEl = document.getElementById("cta-submit-btn");

    const name = nameEl.value.trim();
    const contact = contactEl.value.trim();
    const note = noteEl.value.trim();

    errorEl.classList.add("hidden");
    errorEl.textContent = "";

    if (!name || !contact) {
      errorEl.textContent = NT.t("validationRequired");
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
          user_uuid: state.userUuid,
          chatbot_name: state.chatbotName,
          lang: NT.getLang(),
          visitor_id: NT.visitorId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const ctaEl = document.querySelector(".contact-cta");
      ctaEl.innerHTML = `<div class="contact-cta-success">${escapeHtml(NT.t("contactSuccess"))}</div>`;
    } catch (err) {
      errorEl.textContent = NT.t("contactError");
      errorEl.classList.remove("hidden");
      submitBtnEl.disabled = false;
    }
  }

  // ============================================
  // Sidebar Contact Form
  // ============================================

  async function submitSidebarContactForm() {
    const contactEl = document.getElementById("sidebar-cta-contact");
    const errorEl = document.getElementById("sidebar-cta-error");
    const submitBtnEl = document.getElementById("sidebar-cta-submit-btn");

    const contact = contactEl.value.trim();

    errorEl.classList.add("hidden");
    errorEl.textContent = "";

    if (!contact) {
      errorEl.textContent = NT.t("validationRequired");
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
          user_uuid: state.userUuid,
          chatbot_name: state.chatbotName,
          lang: NT.getLang(),
          visitor_id: NT.visitorId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      sidebarCta.innerHTML = `<div class="sidebar-cta-success">${escapeHtml(NT.t("contactSuccess"))}</div>`;
    } catch (err) {
      errorEl.textContent = NT.t("contactError");
      errorEl.classList.remove("hidden");
      submitBtnEl.disabled = false;
    }
  }

  // ============================================
  // Input Handling
  // ============================================

  function updateSendButton() {
    chatSendBtn.disabled = !chatInput.value.trim() || state.isWaitingForResponse || state.sessionEnded;
  }

  chatInput.addEventListener("input", updateSendButton);

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (chatInput.value.trim() && !state.isWaitingForResponse && !state.sessionEnded) {
        sendMessage(chatInput.value);
      }
    }
  });

  chatSendBtn.addEventListener("click", () => {
    if (chatInput.value.trim() && !state.isWaitingForResponse && !state.sessionEnded) {
      sendMessage(chatInput.value);
    }
  });

  // ============================================
  // Build Another
  // ============================================

  document.getElementById("build-another-btn").addEventListener("click", () => {
    state.userUuid = null;
    state.chatbotName = null;
    state.messageCount = 0;
    state.sessionEnded = false;
    state.isWaitingForResponse = false;

    chatConfig.classList.add("hidden");
    chatPanel.classList.add("hidden");
    container.classList.remove("chat-mode");

    const endedEl = chatPanel.querySelector(".chat-session-ended");
    if (endedEl) endedEl.remove();
    const ctaEl = chatPanel.querySelector(".contact-cta");
    if (ctaEl) ctaEl.remove();

    if (demoHeader) demoHeader.classList.remove("hidden");
    showSection(formSection);
  });
})();
