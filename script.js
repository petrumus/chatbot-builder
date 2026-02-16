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
  let stepTimers = [];
  let savedFormData = null;

  // --- Validation ---

  function validateField(input) {
    const errorEl = document.getElementById(input.id + "-error");
    let message = "";

    if (!input.value.trim()) {
      message = "This field is required.";
    } else if (input.type === "url") {
      try {
        new URL(input.value.trim());
      } catch {
        message = "Please enter a valid URL (e.g. https://example.com).";
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

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(errorBody || `Request failed (${response.status})`);
    }

    return response.json();
  }

  // --- Form Submit ---

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const data = {
      website: document.getElementById("website").value.trim(),
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

      showSection(resultSection);
      resultSuccess.classList.remove("hidden");

      const title = document.getElementById("success-title");
      const message = document.getElementById("success-message");
      title.textContent = `Your chatbot "${data.chatbotName}" is ready!`;
      message.textContent = result.message || "Your chatbot has been built successfully.";
    } catch (err) {
      completeAllSteps();
      await new Promise((r) => setTimeout(r, 400));

      showSection(resultSection);
      resultError.classList.remove("hidden");

      const errorMsg = document.getElementById("error-message");
      errorMsg.textContent =
        "We couldn't build your chatbot. Please try again.";
    } finally {
      submitBtn.disabled = false;
    }
  });

  // --- Retry ---

  retryBtn.addEventListener("click", () => {
    showSection(formSection);
  });
})();
