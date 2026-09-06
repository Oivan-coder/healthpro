window.Pages = window.Pages || {};

window.AssistantState = window.AssistantState || {
  mode: "patient_summary",
  context: null,
  messages: [],
  draft: "",
  pending: false
};

const ASSISTANT_MODES = {
  patient_summary: {
    title: "Сводка пациента",
    subtitle: "Общий контекст перед приемом",
    placeholder: "Задайте вопрос по анализам или подготовке к приёму...",
    emptyTitle: "Соберите сводку перед приемом",
    emptyText: "Ассистент использует подключенные результаты, динамику, записи и документы. Это не диагноз и не назначение лечения."
  },
  result_explanation: {
    title: "Разбор результата",
    subtitle: "Пояснение показателя",
    placeholder: "Спросите про любой анализ или показатель...",
    emptyTitle: "Спросите про показатель",
    emptyText: "Назовите показатель своими словами — ассистент сам найдёт его в данных пациента."
  },
  doctor_questions: {
    title: "Вопросы врачу",
    subtitle: "Подготовка к консультации",
    placeholder: "Задайте вопрос по анализам или подготовке к приёму...",
    emptyTitle: "Подготовьте вопросы врачу",
    emptyText: "Ассистент поможет собрать безопасные вопросы без диагнозов и назначений."
  }
};

function assistantEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function assistantPatientDataText(patientData) {
  if (!patientData) return "не переданы";
  if (patientData.test_name) {
    return `${patientData.value ?? ""} ${patientData.unit || ""}`.trim() || "подключены";
  }
  const parts = [];
  if (patientData.patient) parts.push(patientData.patient);
  if (Number.isFinite(patientData.labReports)) parts.push(`${patientData.labReports} отчетов`);
  if (Number.isFinite(patientData.abnormal)) parts.push(`${patientData.abnormal} показателей внимания`);
  if (Number.isFinite(patientData.visits)) parts.push(`${patientData.visits} приемов/записей`);
  if (Number.isFinite(patientData.documents)) parts.push(`${patientData.documents} документов`);
  return parts.join(" · ") || "подключены";
}

function assistantLatestDate(labs = []) {
  const dated = labs
    .map(lab => lab.latestDate)
    .filter(Boolean)
    .sort((a, b) => parseRuDateSafe(b) - parseRuDateSafe(a));
  return dated[0] || "нет данных";
}

function parseRuDateSafe(value) {
  const [day, month, year] = String(value || "").split(".").map(Number);
  const parsed = new Date(year || 0, (month || 1) - 1, day || 1).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function assistantStatusShort(flag) {
  if (flag === "high") return "выше диапазона";
  if (flag === "low") return "ниже диапазона";
  if (flag === "normal") return "в обычном диапазоне";
  return "требует внимания";
}

function assistantFullTrendValues(lab) {
  const history = Array.isArray(lab?.history) ? lab.history : [];
  const values = history.map(row => row.value);
  if (!values.length && lab?.latestValue !== undefined) values.push(lab.latestValue);
  return values;
}

function bindAssistantWheelBridge() {
  const chatCard = document.querySelector(".assistant-chat-card");
  const messages = document.getElementById("assistantMessages");
  if (!chatCard || !messages) return;

  chatCard.onwheel = (event) => {
    const target = event.target;
    const interactive = target.closest?.("input, textarea, select, button, summary, a, [contenteditable='true']");
    if (interactive) return;
    if (!chatCard.contains(target)) return;

    const before = messages.scrollTop;
    messages.scrollTop += event.deltaY;
    if (messages.scrollTop !== before) event.preventDefault();
  };
}

function buildAssistantSummary(summary) {
  const abnormal = summary.abnormal || [];
  const latestDate = assistantLatestDate(summary.labs || []);
  const focusNames = abnormal.slice(0, 3).map(lab => lab.name).join(", ");
  if (abnormal.length) {
    return [
      `В последних анализах ${UI.attentionText(abnormal.length).toLowerCase()}.`,
      focusNames ? `В зоне внимания: ${focusNames}.` : "Есть показатели выше или ниже обычного диапазона.",
      `Последние результаты датированы ${latestDate}; для интерпретации могут потребоваться жалобы, лекарства и условия сдачи анализа.`
    ];
  }
  return [
    "Последние значения выглядят спокойно по подключенным референсам.",
    `Последние результаты датированы ${latestDate}; полезно смотреть не только одно значение, но и динамику.`
  ];
}

function renderWelcomeMessage(summary) {
  const patientName = UI.firstName(summary.patient);
  return `
    <article class="assistant-message assistant assistant-welcome">
      <div class="assistant-message-label">Атлас</div>
      <div class="assistant-message-text">
        <p>Здравствуйте, ${assistantEscape(patientName)}. Можете спросить про любой анализ своими словами — нужный контекст я найду сам.</p>
      </div>
    </article>
    <article class="assistant-message assistant assistant-pre-summary">
      <div class="assistant-message-label">Краткая сводка</div>
      <div class="assistant-summary-lines">
        ${buildAssistantSummary(summary).map(line => `<p>${assistantEscape(line)}</p>`).join("")}
      </div>
    </article>
  `;
}

function renderAssistantText(text) {
  const parts = [];
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    parts.push(`<ul>${listItems.map(item => `<li>${item}</li>`).join("")}</ul>`);
    listItems = [];
  };

  String(text || "").split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      parts.push("<br>");
      return;
    }
    if (/^[A-F]\. /.test(line)) {
      flushList();
      parts.push(`<h3>${assistantEscape(line)}</h3>`);
      return;
    }
    if (line.startsWith("- ")) {
      listItems.push(assistantEscape(line.slice(2)));
      return;
    }
    flushList();
    parts.push(`<p>${assistantEscape(line)}</p>`);
  });
  flushList();
  return parts.join("");
}

function renderAssistantActions(actions = []) {
  if (!actions.length) return "";
  return `
    <div class="assistant-actions">
      ${actions.map(action => `
        <button class="btn secondary" data-route-action="${assistantEscape(action.route)}" ${action.labMode ? `data-lab-mode="${assistantEscape(action.labMode)}"` : ""}>${assistantEscape(action.label)}</button>
      `).join("")}
    </div>
  `;
}

function renderAssistantBasis(basis) {
  if (!basis) return "";
  return `
    <details class="assistant-basis">
      <summary>
        <span>Основание ответа</span>
        <b>${assistantEscape(basis.sourceLabel || "Данные Атласа")}</b>
      </summary>
      <div class="basis-grid">
        <div><span>Сценарий</span><b>${assistantEscape(basis.chainLabel || "Сценарий Атласа здоровья")}</b></div>
        <div><span>Показатель</span><b>${assistantEscape(basis.indicator || "не выбран")}</b></div>
        <div><span>Данные пациента</span><b>${assistantEscape(assistantPatientDataText(basis.patientData))}</b></div>
        <div><span>Источник</span><b>${assistantEscape(basis.sourceLabel || "Данные Атласа здоровья")}</b></div>
        <div class="basis-wide"><span>Статус</span><b>${assistantEscape(basis.validationStatus || "Справочная логика; диагноз и назначения не формируются")}</b></div>
      </div>
    </details>
  `;
}

function renderAssistantMessages(summary) {
  const renderedMessages = AssistantState.messages.map(item => `
    <article class="assistant-message ${item.role}">
      <div class="assistant-message-label">${item.role === "assistant" ? "Атлас" : "Вы"}</div>
      ${item.role === "assistant" ? `<div class="assistant-provider-note">${item.provider === "gigachat" ? "GigaChat подключен" : "Demo-safe режим"}${item.safetyGuardApplied ? " · проверено правилами" : ""}${item.providerStatus === "fallback" ? " · безопасный fallback" : ""}</div>` : ""}
      <div class="assistant-message-text">${item.role === "assistant" ? renderAssistantText(item.text) : `<p>${assistantEscape(item.text)}</p>`}</div>
      ${renderAssistantActions(item.actions)}
      ${item.basis ? renderAssistantBasis(item.basis) : ""}
    </article>
  `);
  if (AssistantState.pending) {
    renderedMessages.push(`
      <article class="assistant-message assistant pending">
        <div class="assistant-provider-note">Готовлю ответ</div>
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </article>
    `);
  }
  return renderWelcomeMessage(summary) + renderedMessages.join("");
}

function quickQuestionsForContext(context) {
  if (context?.test_name) {
    return [
      ["Что значит результат?", `Что значит мой ${context.test_name}?`, "result_explanation"],
      ["Что с ним связано?", "Какие показатели связаны с этим результатом?", "result_explanation"],
      ["Что обсудить с врачом?", "Что по этому результату стоит обсудить с врачом?", "doctor_questions"]
    ];
  }
  return [
    ["Короткая сводка", "Собери короткую сводку по пациенту для врача", "patient_summary"],
    ["Что требует внимания?", "Какие результаты требуют внимания перед приемом?", "patient_summary"],
    ["Вопросы врачу", "Какие вопросы подготовить врачу?", "doctor_questions"]
  ];
}

function rerenderAssistantPreservingScroll() {
  window.__assistantRestoreScrollY = window.scrollY;
  window.App.render();
}

window.Pages.assistant = async function renderAssistant() {
  const restoreScrollY = Number.isFinite(Number(window.__assistantRestoreScrollY))
    ? Number(window.__assistantRestoreScrollY)
    : null;
  window.__assistantRestoreScrollY = null;

  const summary = await HealthAPI.getSummary();
  document.querySelectorAll(".nav-link").forEach(x => x.classList.toggle("active", x.dataset.route === "assistant"));
  document.querySelectorAll(".bottom-link").forEach(x => x.classList.toggle("active", x.dataset.route === "assistant"));
  const context = AssistantState.context;
  const modeInfo = ASSISTANT_MODES[AssistantState.mode || "patient_summary"] || ASSISTANT_MODES.patient_summary;
  const quickQuestions = quickQuestionsForContext(context);
  const hasDraft = Boolean(String(AssistantState.draft || "").trim());
  const chronic = summary.patient?.chronicConditions || summary.patient?.conditions || [];

  UI.root().innerHTML = `
    <section class="assistant-page">
      <header class="assistant-hero">
        <div>
          <h2>Ассистент подготовки к приёму</h2>
          <p class="muted">Спросите про анализы обычными словами — ассистент сам определит нужный показатель или группу.</p>
        </div>
        <div class="assistant-safe-wrap">
          <button class="assistant-safe-pill" type="button" title="Медицинские ответы ограничены данными пациента и подключенной доказательной базой.">
            <span class="assistant-live-dot"></span>
            AI-safe режим
          </button>
        </div>
      </header>

      <section class="assistant-layout">
        <div class="assistant-main">
          <div class="assistant-chat-card ${hasDraft ? "is-composing" : ""} ${AssistantState.pending ? "is-pending" : ""}">
            <div class="assistant-chat-head">
              <div>
                <div class="label">Диалог</div>
                <h3>Данные пациента подключены автоматически</h3>
              </div>
              <button class="btn ghost small" id="assistantClear">Очистить</button>
            </div>

            <div class="assistant-messages" id="assistantMessages">
              ${renderAssistantMessages(summary)}
            </div>

            <div class="assistant-quick">
              ${quickQuestions.map(([label, question, promptMode]) => `<button class="assistant-prompt-card" data-assistant-question="${assistantEscape(question)}" data-assistant-prompt-mode="${assistantEscape(promptMode)}">${assistantEscape(label)}</button>`).join("")}
            </div>

            <form class="assistant-form" id="assistantForm">
              <details class="assistant-add-menu">
                <summary title="Добавить контекст">+</summary>
                <div class="assistant-add-list">
                  <button type="button" data-assistant-insert="Опишу жалобы: ">Добавить жалобы</button>
                  <button type="button" data-assistant-insert="Лекарства и добавки: ">Добавить лекарства</button>
                  <button type="button" data-route-action="reports">Добавить документ</button>
                </div>
              </details>
              <input id="assistantInput" placeholder="${assistantEscape(modeInfo.placeholder)}" value="${assistantEscape(AssistantState.draft || "")}" autocomplete="off">
              <button class="btn primary" type="submit">Отправить</button>
            </form>
          </div>
        </div>

        <aside class="assistant-side">
          <section class="assistant-side-card">
            <div class="label">Контекст пациента</div>
            <div class="assistant-patient-grid">
              <div><span>Пол</span><b>${assistantEscape(summary.patient?.sex || "не указан")}</b></div>
              <div><span>Возраст</span><b>${assistantEscape(summary.patient?.age || "не указан")}</b></div>
              <div><span>Последние анализы</span><b>${assistantEscape(assistantLatestDate(summary.labs || []))}</b></div>
              ${chronic.length ? `<div><span>Хронические состояния</span><b>${assistantEscape(chronic.join(", "))}</b></div>` : ""}
            </div>
          </section>

          <section class="assistant-side-card assistant-privacy">
            <b>Контекст определяется автоматически</b>
            <p class="muted">Если вы назовёте другой показатель, группу анализов или тему, ассистент переключится сам.</p>
          </section>
        </aside>
      </section>
    </section>
  `;

  async function sendQuestion(text, modeOverride) {
    const question = String(text || "").trim();
    if (!question || AssistantState.pending) return;
    const requestMode = modeOverride || AssistantState.mode || "assistant_chat";
    AssistantState.mode = requestMode;
    AssistantState.draft = "";
    AssistantState.messages.push({ role: "user", text: question });
    AssistantState.pending = true;
    rerenderAssistantPreservingScroll();
    try {
      const response = await HealthAPI.assistantChat({ message: question, mode: requestMode, context: AssistantState.context });
      AssistantState.pending = false;

      if (response.contextAction === "clear") {
        AssistantState.context = null;
        if (response.mode) AssistantState.mode = response.mode;
      } else if (response.resolvedContext?.test_name) {
        AssistantState.context = response.resolvedContext;
        AssistantState.mode = "result_explanation";
      } else if (response.mode) {
        AssistantState.mode = response.mode;
      }

      AssistantState.messages.push({
        role: "assistant",
        text: response.answer,
        basis: response.basis,
        actions: response.actions || [],
        provider: response.provider,
        providerStatus: response.providerStatus,
        safetyGuardApplied: response.safetyGuardApplied
      });
    } catch (error) {
      AssistantState.pending = false;
      AssistantState.messages.push({
        role: "assistant",
        text: "Ассистент временно недоступен.",
        basis: {
          chainLabel: "Локальная ошибка",
          indicator: AssistantState.context?.test_name || null,
          patientData: null,
          sourceLabel: "Данные Атласа здоровья",
          validationStatus: "Ответ не сформирован"
        }
      });
    }
    rerenderAssistantPreservingScroll();
  }

  const assistantInput = document.getElementById("assistantInput");
  const assistantChatCard = document.querySelector(".assistant-chat-card");
  bindAssistantWheelBridge();

  const syncDraftState = () => {
    AssistantState.draft = assistantInput.value;
    assistantChatCard.classList.toggle("is-composing", Boolean(assistantInput.value.trim()));
  };

  assistantInput.oninput = syncDraftState;
  syncDraftState();

  if (window.__assistantTypeKeyHandler) {
    document.removeEventListener("keydown", window.__assistantTypeKeyHandler);
  }
  window.__assistantTypeKeyHandler = (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return;
    const target = event.target;
    if (target?.closest?.("input, textarea, select, button, a, summary, [contenteditable='true'], .modal")) return;
    if (!document.querySelector(".assistant-page")) return;

    event.preventDefault();
    assistantInput.focus({ preventScroll: true });
    const start = Number.isFinite(assistantInput.selectionStart) ? assistantInput.selectionStart : assistantInput.value.length;
    const end = Number.isFinite(assistantInput.selectionEnd) ? assistantInput.selectionEnd : start;
    assistantInput.setRangeText(event.key, start, end, "end");
    assistantInput.dispatchEvent(new Event("input", { bubbles: true }));
  };
  document.addEventListener("keydown", window.__assistantTypeKeyHandler);

  document.getElementById("assistantForm").onsubmit = (event) => {
    event.preventDefault();
    sendQuestion(assistantInput.value);
  };

  document.querySelectorAll("[data-assistant-question]").forEach(btn => {
    btn.onclick = () => {
      const question = btn.dataset.assistantQuestion || "";
      const promptMode = btn.dataset.assistantPromptMode || AssistantState.mode;
      AssistantState.mode = promptMode;
      AssistantState.draft = question;
      assistantInput.value = question;
      assistantInput.focus();
      assistantInput.setSelectionRange(question.length, question.length);
      syncDraftState();
    };
  });

  document.querySelectorAll("[data-assistant-insert]").forEach(btn => {
    btn.onclick = () => {
      assistantInput.value = btn.dataset.assistantInsert;
      assistantInput.focus();
      syncDraftState();
    };
  });

  document.getElementById("assistantClear").onclick = () => {
    AssistantState.messages = [];
    AssistantState.context = null;
    AssistantState.mode = "patient_summary";
    AssistantState.draft = "";
    AssistantState.pending = false;
    rerenderAssistantPreservingScroll();
  };

  requestAnimationFrame(() => {
    if (restoreScrollY !== null) window.scrollTo({ top: restoreScrollY, behavior: "auto" });
    const messages = document.getElementById("assistantMessages");
    if (messages && (AssistantState.messages.length || AssistantState.pending)) messages.scrollTop = messages.scrollHeight;
    if (window.matchMedia("(pointer: fine)").matches && !document.querySelector(".modal.show, .modal:not([hidden])")) {
      assistantInput.focus({ preventScroll: true });
      const caret = assistantInput.value.length;
      assistantInput.setSelectionRange(caret, caret);
    }
  });
};
