(() => {
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

  // Chat DOM refs (resolved lazily after DOM is ready)
  const chatConfig = document.getElementById("chat-config");
  const chatPanel = document.getElementById("chat-panel");
  const chatMessages = document.getElementById("chat-messages");
  const chatReplyButtons = document.getElementById("chat-reply-buttons");
  const chatInput = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send-btn");
  const container = document.querySelector(".container");

  // --- Validation ---

  function isValidDomain(value) {
    // Strip protocol and path, check if it looks like a domain
    const stripped = value.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
    return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(stripped);
  }

  function normalizeWebsite(value) {
    let v = value.trim();
    // Remove protocol if present
    v = v.replace(/^(https?:\/\/)?/, "");
    // Ensure https://
    return "https://" + v;
  }

  function validateField(input) {
    const errorEl = document.getElementById(input.id + "-error");
    let message = "";

    if (!input.value.trim()) {
      message = "This field is required.";
    } else if (input.id === "website") {
      if (!isValidDomain(input.value.trim())) {
        message = "Please enter a valid domain (e.g. example.com).";
      }
    } else if (input.minLength && input.value.trim().length < input.minLength) {
      message = `Must be at least ${input.minLength} characters.`;
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
    // Show first step immediately
    steps[0].classList.remove("hidden");

    for (let i = 1; i < steps.length; i++) {
      const timer = setTimeout(() => {
        // Mark previous step done
        markStepDone(steps[i - 1]);
        // Show current step
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
      const err = new Error(body?.message || `Request failed (${response.status})`);
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
    };

    savedFormData = data;
    submitBtn.disabled = true;

    showSection(progressSection);
    startProgressSteps();

    try {
      const result = await submitToBackend(data);

      // Complete all progress steps visually
      completeAllSteps();

      // Short delay so user sees the final checkmark before switching
      await new Promise((r) => setTimeout(r, 600));

      // Check for explicit failure from backend
      if (result.success === false) {
        showBuildError(result);
        return;
      }

      // Check for uuid — required for chat mode
      // uuid may be at top level or nested in user_data
      const uuid = result.uuid || (result.user_data && result.user_data.uuid);
      if (uuid) {
        activateChatMode(uuid, data);
      } else {
        // No uuid — show error, don't enter chat mode
        showSection(resultSection);
        resultError.classList.remove("hidden");
        document.getElementById("error-message").textContent =
          "Chatbot was created but something went wrong loading the chat. Please contact support.";
      }
    } catch (err) {
      completeAllSteps();
      await new Promise((r) => setTimeout(r, 400));

      // Check if backend returned structured error (e.g. 422 with failures)
      if (err.data && err.data.success === false) {
        showBuildError(err.data);
        return;
      }

      showSection(resultSection);
      resultError.classList.remove("hidden");

      const errorMsg = document.getElementById("error-message");
      errorMsg.textContent =
        "We couldn't build your chatbot. Please try again.";
    } finally {
      submitBtn.disabled = false;
    }
  });

  // --- Build Error Display ---

  function showBuildError(result) {
    completeAllSteps();
    showSection(resultSection);
    resultError.classList.remove("hidden");

    document.getElementById("error-message").textContent =
      result.message || "We couldn't build your chatbot.";
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
    document.getElementById("config-uuid").textContent = uuid;

    // Populate chat header
    document.getElementById("chat-bot-name").textContent = chatbotName;

    // Clear previous chat
    chatMessages.innerHTML = "";
    chatReplyButtons.innerHTML = "";
    chatInput.value = "";
    chatInput.disabled = false;
    chatInput.placeholder = "Type a message...";
    chatSendBtn.disabled = true;

    // Show chat panels
    chatConfig.classList.remove("hidden");
    chatPanel.classList.remove("hidden");

    // Switch container to chat-mode layout
    container.classList.add("chat-mode");

    // Auto-send greeting
    sendMessage("Salut");
  }

  // --- Markdown Renderer ---

  function renderMarkdown(text) {
    // Escape HTML entities first (XSS prevention)
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Italic: *text* (but not inside a bold that was already processed)
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Links: [text](url)
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );

    // Newlines
    html = html.replace(/\n/g, "<br>");

    return html;
  }

  // --- Message Rendering ---

  function appendMessage(role, text, replyOptions) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble " + role;

    if (role === "bot") {
      bubble.innerHTML = renderMarkdown(text);
    } else {
      // User messages — escape HTML only
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
      const response = await fetch(CONFIG.CHAT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: messageText,
          user_uuid: userUuid,
        }),
      });

      hideTypingIndicator();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      messageCount++;

      // Check for session end:
      // - explicit flag from backend
      // - client-side count reached limit
      // - response missing the "response" field (webhook1 default body on limit)
      const isSessionEnd = data.session_ended
        || messageCount >= MAX_MESSAGES
        || (!data.response && !data.user_reply_options);

      if (isSessionEnd) {
        const endMsg = data.response
          || "Ai atins limita de mesaje pentru această sesiune demo. Contactează-ne pentru a continua.";
        appendMessage("bot", endMsg, []);
        disableChat("You've reached the message limit for this demo session.");
        return;
      }

      appendMessage("bot", data.response, data.user_reply_options || []);
    } catch (err) {
      hideTypingIndicator();
      appendError("Something went wrong. Please try again.");
      // Don't count failed messages
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

    // Add session-ended bar
    const endedEl = document.createElement("div");
    endedEl.className = "chat-session-ended";
    endedEl.textContent = reason;
    const chatCard = chatPanel.querySelector(".chat-card");
    chatCard.appendChild(endedEl);
  }

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

    // Remove any session-ended bar
    const endedEl = chatPanel.querySelector(".chat-session-ended");
    if (endedEl) endedEl.remove();

    // Show form
    document.querySelector("header").classList.remove("hidden");
    showSection(formSection);
  });
})();
