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
    subtitle: "Пояснение выбранного показателя",
    placeholder: "Задайте вопрос по анализам или подготовке к приёму...",
    emptyTitle: "Выберите показатель или задайте вопрос",
    emptyText: "Этот режим разбирает только выбранный результат и показывает основание ответа."
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

function assistantValueText(context) {
  if (!context?.test_name) return "результат не выбран";
  return `${context.test_name} ${context.value ?? ""} ${context.unit || ""}`.replace(/\s+/g, " ").trim();
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

function assistantStatusBadge(flag) {
  if (flag === "high") return "выше";
  if (flag === "low") return "ниже";
  if (flag === "normal") return "";
  return "внимание";
}

function assistantTrendValues(lab) {
  const history = Array.isArray(lab?.history) ? lab.history : [];
  const values = history.slice(-3).map(row => row.value);
  if (!values.length && lab?.latestValue !== undefined) values.push(lab.latestValue);
  return values;
}

function assistantFullTrendValues(lab) {
  const history = Array.isArray(lab?.history) ? lab.history : [];
  const values = history.map(row => row.value);
  if (!values.length && lab?.latestValue !== undefined) values.push(lab.latestValue);
  return values;
}

function assistantMiniTrend(lab) {
  const values = assistantTrendValues(lab);
  if (!values.length) return "";
  const line = values.map(value => assistantEscape(value)).join(" → ");
  return `
    <div class="assistant-mini-trend">
      <span>${line}</span>
      ${lab?.unit ? `<small>${assistantEscape(lab.unit)}</small>` : ""}
    </div>
  `;
}

function bindAssistantWheelBridge() {
  const chatCard = document.querySelector(".assistant-chat-card");
  const messages = document.getElementById("assistantMessages");
  if (!chatCard || !messages) return;

  chatCard.onwheel = (event) => {
    const target = event.target;
    const interactive = target.closest?.(
      "input, textarea, select, button, summary, a, [contenteditable='true'], .assistant-indicator-popover, .assistant-indicator-list"
    );
    if (interactive) return;
    if (!chatCard.contains(target)) return;

    const before = messages.scrollTop;
    messages.scrollTop += event.deltaY;

    if (messages.scrollTop !== before) {
      event.preventDefault();
    }
  };
}

function assistantContextFromLab(lab) {
  if (!lab) return null;
  return {
    test_code: lab.code,
    test_name: lab.name,
    value: lab.latestValue,
    unit: lab.unit,
    flag: lab.flag,
    report_date: lab.latestDate,
    history: Array.isArray(lab.history)
      ? lab.history.map(row => ({
        date: row.date,
        value: row.value,
        flag: row.flag
      }))
      : []
  };
}

function assistantHistoryPrompt(context) {
  if (!context?.test_name || !Array.isArray(context.history) || !context.history.length) return "";
  const history = context.history
    .map(row => `${row.date}: ${row.value} ${context.unit || ""} (${assistantStatusShort(row.flag || context.flag)})`)
    .join("; ");
  return [
    "Контекст выбранного показателя из Атласа здоровья:",
    `Показатель: ${context.test_name}.`,
    `История значений: ${history}.`,
    "Отвечай по всей переданной динамике, а не только по последнему значению."
  ].join("\n");
}

function assistantLabSearchText(lab) {
  return `${lab.name || ""} ${lab.group || ""} ${lab.code || ""} ${lab.unit || ""}`.toLowerCase();
}

function buildAssistantSummary(summary, selectedLab) {
  const abnormal = summary.abnormal || [];
  const latestDate = assistantLatestDate(summary.labs || []);
  const focusNames = abnormal.slice(0, 3).map(lab => lab.name).join(", ");
  if (selectedLab) {
    const fullTrend = assistantFullTrendValues(selectedLab);
    return [
      `${selectedLab.name}: последнее значение ${selectedLab.latestValue} ${selectedLab.unit || ""}, ${assistantStatusShort(selectedLab.flag)}.`,
      selectedLab.history?.length > 1 ? `В динамике доступно ${selectedLab.history.length} значений: ${fullTrend.join(" → ")} ${selectedLab.unit || ""}.` : "Динамика появится после нескольких результатов.",
      "Это не диагноз: для интерпретации важны подготовка к анализу, лекарства, жалобы и цель консультации."
    ];
  }
  if (abnormal.length) {
    return [
      `В последних анализах ${UI.attentionText(abnormal.length).toLowerCase()}.`,
      focusNames ? `В зоне внимания: ${focusNames}.` : "Есть показатели выше или ниже обычного диапазона.",
      `Последние результаты датированы ${latestDate}; для интерпретации могут потребоваться жалобы, лекарства и условия сдачи анализа.`,
      "Это не диагноз, а подготовка к разговору с врачом."
    ];
  }
  return [
    "Последние значения выглядят спокойно по подключенным референсам.",
    `Последние результаты датированы ${latestDate}; полезно смотреть не только одно значение, но и динамику.`,
    "Это не диагноз, а подготовка к консультации."
  ];
}

function renderWelcomeMessage(summary, selectedLab) {
  const patientName = UI.firstName(summary.patient);
  return `
    <article class="assistant-message assistant assistant-welcome">
      <div class="assistant-message-label">Атлас</div>
      <div class="assistant-message-text">
        <p>Здравствуйте, ${assistantEscape(patientName)}. Я помогу подготовиться к консультации и разобраться в результатах анализов.</p>
        <p>Могу показать динамику показателей, подсветить изменения и помочь подготовить вопросы врачу.</p>
      </div>
    </article>
    <article class="assistant-message assistant assistant-pre-summary">
      <div class="assistant-message-label">Краткая сводка</div>
      <div class="assistant-summary-lines">
        ${buildAssistantSummary(summary, selectedLab).map(line => `<p>${assistantEscape(line)}</p>`).join("")}
      </div>
    </article>
  `;
}

function renderSelectedLabContext(selectedLab, context) {
  if (!selectedLab && !context?.test_name) return "";
  const name = selectedLab?.name || context.test_name;
  const value = selectedLab?.latestValue ?? context.value ?? "";
  const unit = selectedLab?.unit || context.unit || "";
  const flag = selectedLab?.flag || context.flag;
  return `
    <article class="assistant-context-card">
      <div>
        <span class="label">Разбираем показатель</span>
        <h3>${assistantEscape(name)} ${assistantEscape(value)} ${assistantEscape(unit)}</h3>
        <p class="muted">${assistantEscape(assistantStatusShort(flag))}${selectedLab?.latestDate ? ` · ${assistantEscape(selectedLab.latestDate)}` : ""}</p>
      </div>
      ${assistantMiniTrend(selectedLab)}
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
        <div><span>Сценарий</span><b>${assistantEscape(basis.chainLabel || "Демо-сценарий Атласа здоровья")}</b></div>
        <div><span>Показатель</span><b>${assistantEscape(basis.indicator || "не выбран")}</b></div>
        <div><span>Данные пациента</span><b>${assistantEscape(assistantPatientDataText(basis.patientData))}</b></div>
        <div><span>Источник</span><b>${assistantEscape(basis.sourceLabel || "Демо-база знаний Атласа здоровья")}</b></div>
        <div class="basis-wide"><span>Статус</span><b>${assistantEscape(basis.validationStatus || "Демо-логика, требует врачебной валидации")}</b></div>
      </div>
    </details>
  `;
}

function renderAssistantMessages(summary, selectedLab) {
  const messages = AssistantState.messages;
  const intro = renderWelcomeMessage(summary, selectedLab) + renderSelectedLabContext(selectedLab, AssistantState.context);
  const renderedMessages = messages.map(item => `
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
        <div class="assistant-provider-note">Готовлю безопасный ответ</div>
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </article>
    `);
  }
  return intro + renderedMessages.join("");
}

function quickQuestionsForContext(selectedLab) {
  if (selectedLab) {
    return [
      ["Что влияет на показатель?", `Что влияет на ${selectedLab.name}?`, "result_explanation"],
      ["Какие показатели связаны?", "Какие показатели связаны с выбранным результатом?", "result_explanation"],
      ["Что обсудить с врачом?", "Какие вопросы подготовить врачу по этому показателю?", "doctor_questions"],
      ["Какие данные уточнить?", "Какие данные стоит уточнить для интерпретации?", "doctor_questions"]
    ];
  }
  return [
    ["Короткая сводка", "Собери короткую сводку по пациенту для врача", "patient_summary"],
    ["Что требует внимания?", "Какие результаты требуют внимания перед приемом?", "patient_summary"],
    ["Вопросы врачу", "Какие вопросы подготовить врачу?", "doctor_questions"],
    ["Чего не хватает?", "Каких данных не хватает для полноценной интерпретации?", "doctor_questions"]
  ];
}

window.Pages.assistant = async function renderAssistant() {
  const summary = await HealthAPI.getSummary();
  document.querySelectorAll(".nav-link").forEach(x => x.classList.toggle("active", x.dataset.route === "assistant"));
  document.querySelectorAll(".bottom-link").forEach(x => x.classList.toggle("active", x.dataset.route === "assistant"));
  const context = AssistantState.context;
  const selectedLab = context?.test_code
    ? (summary.labs || []).find(lab => lab.code === context.test_code)
    : null;
  const modeInfo = ASSISTANT_MODES[AssistantState.mode || "patient_summary"] || ASSISTANT_MODES.patient_summary;
  const quickQuestions = quickQuestionsForContext(selectedLab);
  const hasDraft = Boolean(String(AssistantState.draft || "").trim());
  const selectableLabs = [...(summary.labs || [])]
    .filter(lab => lab.code && Array.isArray(lab.history) && lab.history.length)
    .sort((a, b) => {
      const abnormalDelta = Number(b.flag !== "normal") - Number(a.flag !== "normal");
      if (abnormalDelta) return abnormalDelta;
      return (a.group || "").localeCompare(b.group || "", "ru") || a.name.localeCompare(b.name, "ru");
    });
  const chronic = summary.patient?.chronicConditions || summary.patient?.conditions || [];

  UI.root().innerHTML = `
    <section class="assistant-page">
      <header class="assistant-hero">
        <div>
          <h2>Ассистент подготовки к приёму</h2>
          <p class="muted">Помогаю разобраться в анализах, заметить важные изменения и подготовить вопросы врачу.</p>
        </div>
        <div class="assistant-safe-wrap">
          <button class="assistant-safe-pill" type="button" title="Ответы ограничены данными пациента и согласованными медицинскими сценариями.">
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
                <div class="label">Диалог подготовки</div>
                <h3>Контекст пациента уже подключен</h3>
              </div>
              <button class="btn ghost small" id="assistantClear">Очистить</button>
            </div>

            <div class="assistant-messages" id="assistantMessages">
              ${renderAssistantMessages(summary, selectedLab)}
            </div>

            <div class="assistant-quick">
              ${quickQuestions.map(([label, question, promptMode]) => `<button class="assistant-prompt-card" data-assistant-question="${assistantEscape(question)}" data-assistant-prompt-mode="${assistantEscape(promptMode)}">${assistantEscape(label)}</button>`).join("")}
            </div>

            <form class="assistant-form" id="assistantForm">
              <details class="assistant-add-menu">
                <summary title="Добавить контекст">+</summary>
                <div class="assistant-add-list">
                  <button type="button" data-route-action="labs" data-lab-mode="tests">Выбрать показатель</button>
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
          <section class="assistant-side-card assistant-picker-card">
            <div class="assistant-side-head">
              <div>
                <div class="label">Показатель для разбора</div>
                <p class="muted">${selectedLab
                  ? "Ассистент получает всю историю выбранного показателя."
                  : "Выберите один показатель из всех анализов пациента."}</p>
              </div>
            </div>
            <div class="assistant-picker-shell">
              <button type="button" class="assistant-picker-button" id="assistantPickerButton" ${selectableLabs.length ? "" : "disabled"} aria-expanded="false" aria-controls="assistantIndicatorPopover">
                <span>
                  <b>${selectedLab ? assistantEscape(selectedLab.name) : selectableLabs.length ? "Выбрать показатель" : "Нет показателей для разбора"}</b>
                  <small>${selectedLab ? `${assistantEscape(selectedLab.latestValue)} ${assistantEscape(selectedLab.unit || "")} · ${assistantEscape(selectedLab.group || "Показатель")}` : selectableLabs.length ? "из всех анализов пациента" : "данные пока не подключены"}</small>
                </span>
                ${selectableLabs.length ? `<em>${selectableLabs.length}</em>` : ""}
              </button>
              <div class="assistant-picker-backdrop" id="assistantPickerBackdrop" hidden></div>
              <div class="assistant-indicator-popover" id="assistantIndicatorPopover" hidden>
                <div class="assistant-popover-head">
                  <div>
                    <b>Выбрать показатель</b>
                    <small>${selectableLabs.length} ${selectableLabs.length === 1 ? "показатель" : "показателей"}</small>
                  </div>
                  <button type="button" class="icon-btn assistant-popover-close" id="assistantPickerClose" aria-label="Закрыть">×</button>
                </div>
                <input class="assistant-picker-search" id="assistantIndicatorSearch" placeholder="Найти показатель" autocomplete="off">
                <div class="assistant-indicator-list" id="assistantIndicatorList">
                  ${selectableLabs.map(lab => `
                    <button type="button" class="assistant-indicator-row ${selectedLab?.code === lab.code ? "active" : ""}" data-assistant-select-lab-code="${assistantEscape(lab.code)}" data-assistant-picker-item data-assistant-picker-search="${assistantEscape(assistantLabSearchText(lab))}">
                      <span>
                        <b>${assistantEscape(lab.name)}</b>
                        <small>${assistantEscape(lab.group || "Показатель")} · ${assistantEscape(lab.history.length)} знач.</small>
                      </span>
                      <strong>${assistantEscape(lab.latestValue)} ${assistantEscape(lab.unit || "")}</strong>
                      ${assistantStatusBadge(lab.flag) ? `<em class="${UI.statusClass(lab.flag)}">${assistantEscape(assistantStatusBadge(lab.flag))}</em>` : ""}
                    </button>
                  `).join("")}
                  <p class="muted assistant-picker-empty" id="assistantPickerEmpty" hidden>Ничего не найдено.</p>
                </div>
              </div>
            </div>
            ${selectedLab ? `<div class="assistant-selected-note">${selectedLab.history?.length || 0} значений в динамике · последнее ${assistantEscape(selectedLab.latestDate || "без даты")}</div>` : ""}
            ${selectedLab ? `<button class="btn ghost small assistant-reset-context" id="assistantResetContext">Сбросить показатель</button>` : ""}
          </section>

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
            <b>Ваши данные защищены</b>
            <p class="muted">Ассистент использует только данные пациента и согласованные сценарии.</p>
          </section>
        </aside>
      </section>
    </section>
  `;

  async function sendQuestion(text, modeOverride) {
    const question = String(text || "").trim();
    if (!question || AssistantState.pending) return;
    const requestMode = modeOverride || AssistantState.mode || (AssistantState.context ? "result_explanation" : "patient_summary");
    AssistantState.mode = requestMode;
    AssistantState.draft = "";
    AssistantState.messages.push({ role: "user", text: question });
    AssistantState.pending = true;
    window.App.render();
    try {
      const response = await HealthAPI.assistantChat({ message: question, mode: requestMode, context: AssistantState.context });
      AssistantState.pending = false;
      if (response.resolvedContext?.test_name) {
        AssistantState.context = response.resolvedContext;
        AssistantState.mode = "result_explanation";
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
        text: "Ассистент временно недоступен. Медицинские данные не отправлялись во внешние сервисы.",
        basis: {
          chainLabel: "Локальная ошибка",
          indicator: context?.test_name || null,
          patientData: null,
          sourceLabel: "Демо-база знаний Атласа здоровья",
          validationStatus: "Демо-логика, требует врачебной валидации"
        }
      });
    }
    window.App.render();
  }

  const assistantInput = document.getElementById("assistantInput");
  const assistantChatCard = document.querySelector(".assistant-chat-card");
  bindAssistantWheelBridge();
  const pickerButton = document.getElementById("assistantPickerButton");
  const pickerPopover = document.getElementById("assistantIndicatorPopover");
  const pickerBackdrop = document.getElementById("assistantPickerBackdrop");
  const pickerSearch = document.getElementById("assistantIndicatorSearch");
  const pickerClose = document.getElementById("assistantPickerClose");
  const pickerEmpty = document.getElementById("assistantPickerEmpty");
  const pickerShell = document.querySelector(".assistant-picker-shell");
  const pickerList = document.getElementById("assistantIndicatorList");

  if (window.__assistantPickerOutsideHandler) {
    document.removeEventListener("click", window.__assistantPickerOutsideHandler);
  }
  if (window.__assistantPickerKeyHandler) {
    document.removeEventListener("keydown", window.__assistantPickerKeyHandler);
  }

  const closePicker = () => {
    if (!pickerPopover) return;
    pickerPopover.hidden = true;
    if (pickerBackdrop) pickerBackdrop.hidden = true;
    if (pickerButton) pickerButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("assistant-picker-open");
  };

  const openPicker = () => {
    if (!pickerPopover || !pickerButton || pickerButton.disabled) return;
    pickerPopover.hidden = false;
    if (pickerBackdrop) pickerBackdrop.hidden = false;
    pickerButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("assistant-picker-open");
    if (pickerSearch) {
      pickerSearch.value = "";
      pickerSearch.dispatchEvent(new Event("input"));
      requestAnimationFrame(() => pickerSearch.focus());
    }
  };

  const togglePicker = () => {
    if (!pickerPopover || pickerPopover.hidden) {
      openPicker();
    } else {
      closePicker();
    }
  };

  if (pickerButton) pickerButton.onclick = togglePicker;
  if (pickerClose) pickerClose.onclick = closePicker;
  if (pickerBackdrop) pickerBackdrop.onclick = closePicker;

  if (pickerSearch) {
    pickerSearch.oninput = () => {
      const query = pickerSearch.value.trim().toLowerCase();
      let visibleCount = 0;
      document.querySelectorAll("[data-assistant-picker-item]").forEach(item => {
        const matches = !query || String(item.dataset.assistantPickerSearch || "").includes(query);
        item.hidden = !matches;
        if (matches) visibleCount += 1;
      });
      if (pickerEmpty) pickerEmpty.hidden = visibleCount > 0;
    };
  }

  window.__assistantPickerOutsideHandler = (event) => {
    if (!pickerPopover || pickerPopover.hidden) return;
    if (pickerShell && pickerShell.contains(event.target)) return;
    closePicker();
  };
  window.__assistantPickerKeyHandler = (event) => {
    if (event.key === "Escape") closePicker();
  };
  document.addEventListener("click", window.__assistantPickerOutsideHandler);
  document.addEventListener("keydown", window.__assistantPickerKeyHandler);

  const syncDraftState = () => {
    AssistantState.draft = assistantInput.value;
    assistantChatCard.classList.toggle("is-composing", Boolean(assistantInput.value.trim()));
  };

  assistantInput.oninput = syncDraftState;
  syncDraftState();

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

  if (pickerList) {
    pickerList.onclick = (event) => {
      const btn = event.target.closest("[data-assistant-select-lab-code]");
      if (!btn) return;
      const lab = (summary.labs || []).find(item => item.code === btn.dataset.assistantSelectLabCode);
      if (!lab) return;
      AssistantState.context = assistantContextFromLab(lab);
      AssistantState.mode = "result_explanation";
      AssistantState.messages = [];
      AssistantState.draft = "";
      AssistantState.pending = false;
      closePicker();
      window.App.render();
    };
  }

  const resetContextBtn = document.getElementById("assistantResetContext");
  if (resetContextBtn) {
    resetContextBtn.onclick = () => {
      AssistantState.context = null;
      AssistantState.mode = "patient_summary";
      AssistantState.messages = [];
      AssistantState.draft = "";
      AssistantState.pending = false;
      window.App.render();
    };
  }

  document.getElementById("assistantClear").onclick = () => {
    AssistantState.messages = [];
    AssistantState.draft = "";
    AssistantState.pending = false;
    window.App.render();
  };

  requestAnimationFrame(() => {
    const messages = document.getElementById("assistantMessages");
    if (!messages) return;
    messages.scrollTop = AssistantState.messages.length || AssistantState.pending ? messages.scrollHeight : 0;
  });
};
