window.Pages = window.Pages || {};

const manualLabEntryNav = document.querySelector('[data-route="manual-lab-entry"]');
if (manualLabEntryNav) {
  manualLabEntryNav.removeAttribute("data-admin-only");
  manualLabEntryNav.setAttribute("data-lab-entry-only", "");
}

window.ManualLabEntryState = window.ManualLabEntryState || {
  patientId: "",
  reportDate: "",
  serviceId: "",
  serviceQuery: "",
  testQuery: "",
  tests: [],
  entries: [],
  lastReport: null
};

window.Pages["manual-lab-entry"] = async function renderManualLabEntry() {
  const root = UI.root();
  let state = window.ManualLabEntryState;
  const currentUser = window.App?.user?.() || null;
  const isTester = currentUser?.role === "tester";
  const owner = `${currentUser?.id}:${currentUser?.patientId}`;
  if (state.owner !== owner) state = window.ManualLabEntryState = {owner,patientId:"",reportDate:"",serviceId:"",serviceQuery:"",testQuery:"",tests:[],entries:[],lastReport:null};
  let requestVersion = 0;
  let saving = false;

  const routeCaption = document.getElementById("routeCaption");
  const routeTitle = document.getElementById("routeTitle");
  if (routeCaption) routeCaption.textContent = "Результаты";
  if (routeTitle) routeTitle.textContent = "Ввод результатов";

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const normalize = (value) => String(value || "").toLowerCase().replace(/ё/g, "е").trim();
  const todayLocal = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  };

  async function manualRequest(path, options = {}) {
    const response = await fetch(`${HealthAPI.API_BASE}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    let body = null;
    try { body = await response.json(); } catch (error) { body = null; }
    if (!response.ok) {
      const code = body?.error || `api_${response.status}`;
      throw Object.assign(new Error(code), { code, status: response.status });
    }
    return body;
  }

  const userPromise = isTester
    ? Promise.resolve({ users: [{ ...currentUser, status: currentUser?.status || "active" }] })
    : HealthAPI.adminListUsers();

  const [userResult, serviceResult] = await Promise.all([
    userPromise,
    manualRequest("/admin/lab-entry/services")
  ]);

  const patients = (userResult?.users || [])
    .filter((user) => ["user", "tester"].includes(user.role) && user.patientId && user.status === "active")
    .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName), "ru"));
  const services = serviceResult?.services || [];

  if (!state.reportDate) state.reportDate = todayLocal();
  if (isTester) state.patientId = currentUser?.patientId || "";
  if (state.patientId && !patients.some((patient) => patient.patientId === state.patientId)) state.patientId = "";
  if (state.serviceId && !services.some((service) => service.id === state.serviceId)) state.serviceId = "";

  root.innerHTML = `<div class="cabinet-page manual-page">
    <section class="workspace-section">
      <div class="section-head">
        <div>
          <h2>Внести лабораторный результат</h2>
          <p class="muted">Исследование и показатель ищутся по названию или коду. Единицы и референсы подставляются из справочника.</p>
        </div>
      </div>
    </section>

    ${state.lastReport ? `
      <section class="workspace-section">
        <div class="row-card">
          <div class="icon-bubble ok">✓</div>
          <div>
            <b>Результат сохранён</b>
            <div class="muted">${escapeHtml(state.lastReport.name)} • ${escapeHtml(state.lastReport.date)} • ${Number(state.lastReport.testCount || 0)} показателей</div>
          </div>
        </div>
      </section>
    ` : ""}

    <section class="manual-columns">
      <div class="workspace-section">
        <div class="eyebrow">1. Исследование</div>
        <h2>Исследование и дата</h2>
        <div class="form-stack">
          <label>Пациент
            <select id="manualPatientSelect" ${isTester ? "disabled" : ""}>
              <option value="">Выберите пациента</option>
              ${patients.map((patient) => `<option value="${escapeHtml(patient.patientId)}" ${patient.patientId === state.patientId ? "selected" : ""}>${escapeHtml(patient.displayName)} · ${escapeHtml(patient.patientId)}</option>`).join("")}
            </select>
          </label>
          ${isTester ? `<p class="muted">Результаты добавляются только в профиль ${escapeHtml(currentUser?.displayName || "тестировщика")} · ${escapeHtml(currentUser?.patientId || "профиль не привязан")}</p>` : ""}
          <label>Дата результата
            <input id="manualReportDate" type="date" value="${escapeHtml(state.reportDate)}" />
          </label>
          <label>Поиск исследования
            <input id="manualServiceSearch" type="search" value="${escapeHtml(state.serviceQuery)}" placeholder="Например: глюкоза, биохимия, ОАК, код..." autocomplete="off" />
          </label>
          <input type="hidden" id="manualServiceSelect" value="${escapeHtml(state.serviceId)}">
          <small class="muted" id="manualServiceCount"></small>
        </div>
      </div>

      <div class="workspace-section">
        <div class="eyebrow">2. Показатель</div>
        <h2>Показатель и результат</h2>
        <form id="manualResultForm" class="form-stack">
          <label>Поиск показателя
            <input id="manualTestSearch" type="search" value="${escapeHtml(state.testQuery)}" placeholder="Например: глюкоза, АЛТ, гемоглобин..." autocomplete="off" disabled />
          </label>
          <input type="hidden" id="manualTestSelect">
          <small class="muted" id="manualTestCount"></small>

          <div id="manualTestMeta" class="interpretation soft">
            <b>Единицы и референс появятся автоматически</b>
            <p class="muted">Выберите показатель из найденных.</p>
          </div>

          <label id="manualReferenceWrap" hidden>Референсный вариант
            <select id="manualReferenceSelect"></select>
          </label>

          <label>Результат
            <input id="manualValueInput" inputmode="decimal" placeholder="Например, 6,2 или отрицательно" autocomplete="off" disabled />
          </label>
          <button class="btn secondary" id="manualAddBtn" type="submit" disabled>Добавить показатель</button>
        </form>
      </div>
    </section>

    <section class="workspace-section">
      <div class="section-head">
        <div>
          <div class="eyebrow">3. Результаты</div>
          <h2>Добавленные показатели</h2>
          <p class="muted">В один отчёт попадут только добавленные показатели.</p>
        </div>
        <span class="status ${state.entries.length ? "ok" : "info"}" id="manualEntryCount">${state.entries.length} показателей</span>
      </div>
      <div class="compact-table-wrap">
        <table class="compact-table">
          <thead><tr><th>Показатель</th><th>Результат</th><th>Единица</th><th>Референс</th><th></th></tr></thead>
          <tbody id="manualEntryRows"></tbody>
        </table>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
        <button class="btn primary" id="manualSaveBtn" type="button" ${state.entries.length ? "" : "disabled"}>Сохранить результат</button>
        <button class="btn ghost" id="manualClearBtn" type="button" ${state.entries.length ? "" : "disabled"}>Очистить</button>
      </div>
    </section></div>
  `;

  const patientSelect = document.getElementById("manualPatientSelect");
  const reportDateInput = document.getElementById("manualReportDate");
  const serviceSearch = document.getElementById("manualServiceSearch");
  const serviceSelect = document.getElementById("manualServiceSelect");
  const serviceCount = document.getElementById("manualServiceCount");
  const testSearch = document.getElementById("manualTestSearch");
  const testSelect = document.getElementById("manualTestSelect");
  const testCount = document.getElementById("manualTestCount");
  const valueInput = document.getElementById("manualValueInput");
  const addButton = document.getElementById("manualAddBtn");
  const testMeta = document.getElementById("manualTestMeta");
  const referenceWrap = document.getElementById("manualReferenceWrap");
  const referenceSelect = document.getElementById("manualReferenceSelect");
  const saveButton = document.getElementById("manualSaveBtn");
  const clearButton = document.getElementById("manualClearBtn");

  const servicePicker = SearchPicker(serviceSearch, serviceSelect, {
    items: () => services,
    label: item => `${item.name}${item.code || item.sourceServiceCode ? " · " + (item.code || item.sourceServiceCode) : ""}`,
    terms: item => `${item.name} ${item.code || ""} ${item.sourceServiceCode || ""}`,
    hint: serviceCount,
    onChange: () => {state.serviceQuery = serviceSearch.value;loadTests();}
  });
  const testPicker = SearchPicker(testSearch, testSelect, {
    items: () => state.tests,
    label: item => `${item.name}${item.code || item.sourceTestCode ? " · " + (item.code || item.sourceTestCode) : ""}`,
    terms: item => `${item.name} ${item.code || ""} ${item.sourceTestCode || ""} ${item.biomaterial || ""}`,
    hint: testCount,
    onChange: item => {state.testQuery = testSearch.value;valueInput.value = "";renderTestMeta();if(item) valueInput.focus();}
  });
  function renderTestOptions() {
    testSearch.disabled = !state.tests.length;
    testPicker.refresh();
    testCount.textContent = state.tests.length ? `В выбранном исследовании: ${state.tests.length} показателей` : "В исследовании нет доступных показателей";
  }

  function currentTest() {
    return state.tests.find((test) => String(test.id) === testSelect.value) || null;
  }

  function selectedReference(test) {
    if (!test) return null;
    const id = Number(referenceSelect.value || test.recommendedReferenceId || 0);
    return test.references?.find((reference) => Number(reference.id) === id) || test.reference || null;
  }

  function lockHeaderFields() {
    const locked = state.entries.length > 0 || saving;
    patientSelect.disabled = locked || isTester;
    reportDateInput.disabled = locked;
    serviceSearch.disabled = locked;
    serviceSelect.disabled = locked;
    if (locked) servicePicker.close();
  }

  function renderEntries() {
    const body = document.getElementById("manualEntryRows");
    body.innerHTML = state.entries.length ? state.entries.map((entry, index) => `
      <tr>
        <td><b>${escapeHtml(entry.name)}</b>${entry.biomaterial ? `<br><small class="muted">${escapeHtml(entry.biomaterial)}</small>` : ""}</td>
        <td><b>${escapeHtml(entry.value)}</b></td>
        <td>${escapeHtml(entry.unit || "—")}</td>
        <td>${escapeHtml(entry.referenceLabel || "Референс не задан")}</td>
        <td><button class="btn ghost small" type="button" data-remove-manual-entry="${index}">Удалить</button></td>
      </tr>
    `).join("") : `<tr><td colspan="5" class="muted">Добавьте хотя бы один показатель.</td></tr>`;
    document.getElementById("manualEntryCount").textContent = `${state.entries.length} показателей`;
    document.getElementById("manualEntryCount").className = `status ${state.entries.length ? "ok" : "info"}`;
    saveButton.disabled = !state.entries.length;
    clearButton.disabled = !state.entries.length;
    lockHeaderFields();
    body.querySelectorAll("[data-remove-manual-entry]").forEach((button) => {
      button.onclick = () => {
        state.entries.splice(Number(button.dataset.removeManualEntry), 1);
        renderEntries();
      };
    });
  }

  function renderTestMeta() {
    const test = currentTest();
    if (!test) {
      testMeta.innerHTML = `<b>Единицы и референс появятся автоматически</b><p class="muted">Выберите показатель.</p>`;
      referenceWrap.hidden = true;
      valueInput.disabled = true;
      addButton.disabled = true;
      return;
    }
    const details = [test.biomaterial, test.method].filter(Boolean).map(escapeHtml).join(" • ");
    testMeta.innerHTML = `
      <b>${escapeHtml(test.name)}</b>
      <p class="muted">${details || "Контекст показателя из справочника"}</p>
      <div style="display:grid;gap:6px;margin-top:10px">
        <span><b>Единица:</b> ${escapeHtml(test.unit || "без единицы")}</span>
        <span><b>Референс:</b> ${escapeHtml(test.referenceLabel || "не задан")}</span>
      </div>`;
    const ambiguous = test.referenceStatus === "ambiguous" && (test.references || []).length > 1;
    referenceWrap.hidden = !ambiguous;
    referenceSelect.innerHTML = ambiguous
      ? `<option value="">Выберите подходящий вариант</option>${test.references.map((reference) => `<option value="${Number(reference.id)}">${escapeHtml(reference.label)}</option>`).join("")}`
      : test.recommendedReferenceId
        ? `<option value="${Number(test.recommendedReferenceId)}" selected>${escapeHtml(test.referenceLabel)}</option>`
        : "";
    valueInput.disabled = false;
    addButton.disabled = false;
  }

  async function loadTests() {
    const version = ++requestVersion;
    state.patientId = patientSelect.value || (isTester ? currentUser?.patientId || "" : "");
    state.reportDate = reportDateInput.value;
    state.serviceId = serviceSelect.value;
    state.testQuery = "";
    testPicker.set(null);
    state.tests = [];
    testCount.textContent = "Загрузка показателей…";
    testSelect.disabled = true;
    testSearch.disabled = true;
    valueInput.disabled = true;
    addButton.disabled = true;
    renderTestMeta();

    if (!state.patientId || !state.serviceId) {
      testCount.textContent = "Сначала выберите исследование и пациента";
      return;
    }

    try {
      const result = await manualRequest(`/admin/lab-entry/services/${encodeURIComponent(state.serviceId)}/tests?patientId=${encodeURIComponent(state.patientId)}`);
      if (version !== requestVersion || !testSearch.isConnected || window.ManualLabEntryState !== state) return;
      state.tests = result?.tests || [];
      renderTestOptions();
    } catch (error) {
      if (version !== requestVersion || !testSearch.isConnected) return;
      testCount.textContent = "Не удалось загрузить показатели. Выберите исследование повторно.";
      UI.toast("Не удалось загрузить показатели исследования");
    }
  }

  patientSelect.onchange = loadTests;
  reportDateInput.onchange = () => {state.reportDate = reportDateInput.value;};
  referenceSelect.onchange = () => {
    const test = currentTest();
    const reference = selectedReference(test);
    const span = testMeta.querySelector("span:last-child");
    if (test && reference && span) span.innerHTML = `<b>Референс:</b> ${escapeHtml(reference.label)}`;
  };

  document.getElementById("manualResultForm").onsubmit = (event) => {
    event.preventDefault();
    const test = currentTest();
    const value = valueInput.value.trim();
    if (!test || !value) return UI.toast("Выберите показатель и введите результат");
    if (state.entries.some((entry) => entry.testId === test.id)) return UI.toast("Этот показатель уже добавлен");
    if (test.referenceStatus === "ambiguous" && !referenceSelect.value) return UI.toast("Выберите референсный вариант");
    const reference = selectedReference(test);
    state.entries.push({
      testId: test.id,
      name: test.name,
      biomaterial: test.biomaterial,
      unit: test.unit,
      value,
      referenceId: reference?.id || null,
      referenceLabel: reference?.label || test.referenceLabel || "Референс не задан"
    });
    valueInput.value = "";
    testPicker.set(null);
    renderTestMeta();
    renderEntries();
    testSearch.focus();
  };

  clearButton.onclick = () => {
    state.entries = [];
    state.lastReport = null;
    renderEntries();
  };

  saveButton.onclick = async () => {
    if (!state.entries.length || saving) return;
    saving = true;
    lockHeaderFields();
    addButton.disabled = true;
    clearButton.disabled = true;
    saveButton.disabled = true;
    try {
      const result = await manualRequest("/admin/lab-entry/reports", {
        method: "POST",
        body: JSON.stringify({
          patientId: state.patientId,
          serviceId: state.serviceId,
          reportDate: state.reportDate,
          observations: state.entries.map((entry) => ({ testId: entry.testId, value: entry.value, referenceId: entry.referenceId }))
        })
      });
      if (window.ManualLabEntryState !== state) return;
      state.lastReport = result.report;
      state.entries = [];
      state.tests = [];
      state.testQuery = "";
      UI.toast("Лабораторный результат сохранён");
      await window.App.render();
    } catch (error) {
      const messages = {
        patient_not_available: "Профиль пациента недоступен",
        patient_access_forbidden: "Можно вносить результаты только в свой тестовый профиль",
        lab_service_not_found: "Исследование не найдено",
        test_not_in_service: "Показатель не относится к исследованию",
        duplicate_test_in_report: "Показатель добавлен дважды",
        invalid_report_date: "Проверьте дату результата",
        result_value_required: "Введите результат",
        reference_not_available: "Выбранный референс недоступен"
      };
      UI.toast(messages[error.code] || "Не удалось сохранить результат");
      saveButton.disabled = false;
    } finally {
      saving = false;
      if (saveButton.isConnected) {renderEntries();renderTestMeta();}
    }
  };

  servicePicker.set(services.find(service => String(service.id) === String(state.serviceId)) || null);
  renderEntries();
  if (state.patientId && state.serviceId) await loadTests();
};
