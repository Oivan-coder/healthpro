window.Pages = window.Pages || {};
window.ManualLabEntryState = window.ManualLabEntryState || {
  patientId: "",
  reportDate: "",
  serviceId: "",
  tests: [],
  entries: [],
  lastReport: null
};

window.Pages["manual-lab-entry"] = async function renderManualLabEntry() {
  const root = UI.root();
  const state = window.ManualLabEntryState;

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

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

  const [userResult, serviceResult] = await Promise.all([
    HealthAPI.adminListUsers(),
    manualRequest("/admin/lab-entry/services")
  ]);
  const patients = (userResult?.users || [])
    .filter((user) => user.role === "user" && user.patientId && user.status === "active")
    .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName), "ru"));
  const services = serviceResult?.services || [];

  if (!state.reportDate) state.reportDate = todayLocal();
  if (state.patientId && !patients.some((patient) => patient.patientId === state.patientId)) state.patientId = "";
  if (state.serviceId && !services.some((service) => service.id === state.serviceId)) state.serviceId = "";

  root.innerHTML = `
    <section class="card">
      <div class="section-head">
        <div>
          <div class="label">Ручной ввод • admin-only</div>
          <h2>Внести лабораторный результат</h2>
          <p class="muted">Исследования, показатели, единицы и референсы уже находятся в справочнике. Здесь вводится только результат пациента.</p>
        </div>
        <span class="status info">${services.length} исследований в справочнике</span>
      </div>
    </section>

    ${state.lastReport ? `
      <section class="card" style="margin-top:16px">
        <div class="row-card">
          <div class="icon-bubble ok">✓</div>
          <div>
            <b>Результат сохранён</b>
            <div class="muted">${escapeHtml(state.lastReport.name)} • ${escapeHtml(state.lastReport.date)} • ${Number(state.lastReport.testCount || 0)} показателей</div>
          </div>
        </div>
      </section>
    ` : ""}

    <section class="grid-2" style="margin-top:16px">
      <div class="card">
        <div class="label">1. Исследование</div>
        <h2>Кому и за какую дату</h2>
        <div class="form-stack">
          <label>Пациент
            <select id="manualPatientSelect">
              <option value="">Выберите пациента</option>
              ${patients.map((patient) => `<option value="${escapeHtml(patient.patientId)}" ${patient.patientId === state.patientId ? "selected" : ""}>${escapeHtml(patient.displayName)} · ${escapeHtml(patient.patientId)}</option>`).join("")}
            </select>
          </label>
          <label>Дата результата
            <input id="manualReportDate" type="date" value="${escapeHtml(state.reportDate)}" />
          </label>
          <label>Исследование
            <select id="manualServiceSelect">
              <option value="">Выберите исследование</option>
              ${services.map((service) => `<option value="${escapeHtml(service.id)}" ${service.id === state.serviceId ? "selected" : ""}>${escapeHtml(service.name)} · ${Number(service.testCount || 0)} показ.</option>`).join("")}
            </select>
          </label>
        </div>
      </div>

      <div class="card">
        <div class="label">2. Показатель</div>
        <h2>Выберите показатель и введите значение</h2>
        <form id="manualResultForm" class="form-stack">
          <label>Показатель
            <select id="manualTestSelect" disabled>
              <option value="">Сначала выберите пациента и исследование</option>
            </select>
          </label>

          <div id="manualTestMeta" class="interpretation soft">
            <b>Единицы и референс появятся автоматически</b>
            <p class="muted">Для возрастных и половых референсов Атлас подберёт подходящий интервал. Если контекста недостаточно, можно выбрать вариант из справочника.</p>
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

    <section class="card" style="margin-top:16px">
      <div class="section-head">
        <div>
          <div class="label">3. Результаты</div>
          <h2>Перед сохранением</h2>
          <p class="muted">Пустые показатели не создаются. В один лабораторный отчёт попадают только добавленные строки.</p>
        </div>
        <span class="status ${state.entries.length ? "ok" : "info"}" id="manualEntryCount">${state.entries.length} показателей</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Показатель</th><th>Результат</th><th>Единица</th><th>Референс</th><th></th></tr></thead>
          <tbody id="manualEntryRows"></tbody>
        </table>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
        <button class="btn primary" id="manualSaveBtn" type="button" ${state.entries.length ? "" : "disabled"}>Сохранить результат</button>
        <button class="btn ghost" id="manualClearBtn" type="button" ${state.entries.length ? "" : "disabled"}>Очистить</button>
      </div>
    </section>
  `;

  const patientSelect = document.getElementById("manualPatientSelect");
  const reportDateInput = document.getElementById("manualReportDate");
  const serviceSelect = document.getElementById("manualServiceSelect");
  const testSelect = document.getElementById("manualTestSelect");
  const valueInput = document.getElementById("manualValueInput");
  const addButton = document.getElementById("manualAddBtn");
  const testMeta = document.getElementById("manualTestMeta");
  const referenceWrap = document.getElementById("manualReferenceWrap");
  const referenceSelect = document.getElementById("manualReferenceSelect");
  const saveButton = document.getElementById("manualSaveBtn");
  const clearButton = document.getElementById("manualClearBtn");

  function currentTest() {
    return state.tests.find((test) => test.id === testSelect.value) || null;
  }

  function selectedReference(test) {
    if (!test) return null;
    const id = Number(referenceSelect.value || test.recommendedReferenceId || 0);
    return test.references?.find((reference) => Number(reference.id) === id) || test.reference || null;
  }

  function lockHeaderFields() {
    const locked = state.entries.length > 0;
    patientSelect.disabled = locked;
    reportDateInput.disabled = locked;
    serviceSelect.disabled = locked;
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
      </div>
    `;

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
    state.patientId = patientSelect.value;
    state.reportDate = reportDateInput.value;
    state.serviceId = serviceSelect.value;
    state.tests = [];
    testSelect.innerHTML = `<option value="">Загрузка…</option>`;
    testSelect.disabled = true;
    valueInput.disabled = true;
    addButton.disabled = true;
    renderTestMeta();

    if (!state.patientId || !state.serviceId) {
      testSelect.innerHTML = `<option value="">Сначала выберите пациента и исследование</option>`;
      return;
    }

    try {
      const result = await manualRequest(`/admin/lab-entry/services/${encodeURIComponent(state.serviceId)}/tests?patientId=${encodeURIComponent(state.patientId)}`);
      state.tests = result?.tests || [];
      testSelect.innerHTML = `<option value="">Выберите показатель</option>${state.tests.map((test) => `<option value="${escapeHtml(test.id)}">${escapeHtml(test.name)}${test.biomaterial ? ` · ${escapeHtml(test.biomaterial)}` : ""}</option>`).join("")}`;
      testSelect.disabled = !state.tests.length;
      renderTestMeta();
    } catch (error) {
      testSelect.innerHTML = `<option value="">Не удалось загрузить показатели</option>`;
      UI.toast("Не удалось загрузить показатели исследования");
    }
  }

  patientSelect.onchange = loadTests;
  serviceSelect.onchange = loadTests;
  reportDateInput.onchange = () => { state.reportDate = reportDateInput.value; };
  testSelect.onchange = renderTestMeta;
  referenceSelect.onchange = () => {
    const test = currentTest();
    const reference = selectedReference(test);
    if (test && reference) {
      testMeta.querySelector("span:last-child").innerHTML = `<b>Референс:</b> ${escapeHtml(reference.label)}`;
    }
  };

  document.getElementById("manualResultForm").onsubmit = (event) => {
    event.preventDefault();
    const test = currentTest();
    const value = valueInput.value.trim();
    if (!test || !value) {
      UI.toast("Выберите показатель и введите результат");
      return;
    }
    if (state.entries.some((entry) => entry.testId === test.id)) {
      UI.toast("Этот показатель уже добавлен");
      return;
    }
    if (test.referenceStatus === "ambiguous" && !referenceSelect.value) {
      UI.toast("Выберите референсный вариант");
      return;
    }
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
    testSelect.value = "";
    renderTestMeta();
    renderEntries();
  };

  clearButton.onclick = () => {
    state.entries = [];
    state.lastReport = null;
    renderEntries();
  };

  saveButton.onclick = async () => {
    if (!state.entries.length) return;
    saveButton.disabled = true;
    try {
      const result = await manualRequest("/admin/lab-entry/reports", {
        method: "POST",
        body: JSON.stringify({
          patientId: state.patientId,
          serviceId: state.serviceId,
          reportDate: state.reportDate,
          observations: state.entries.map((entry) => ({
            testId: entry.testId,
            value: entry.value,
            referenceId: entry.referenceId
          }))
        })
      });
      state.lastReport = result.report;
      state.entries = [];
      state.tests = [];
      UI.toast("Лабораторный результат сохранён");
      await window.App.render();
    } catch (error) {
      const messages = {
        patient_not_available: "Профиль пациента недоступен",
        lab_service_not_found: "Исследование не найдено",
        test_not_in_service: "Показатель не относится к исследованию",
        duplicate_test_in_report: "Показатель добавлен дважды",
        invalid_report_date: "Проверьте дату результата",
        result_value_required: "Введите результат",
        reference_not_available: "Выбранный референс недоступен"
      };
      UI.toast(messages[error.code] || "Не удалось сохранить результат");
      saveButton.disabled = false;
    }
  };

  renderEntries();
  if (state.patientId && state.serviceId) await loadTests();
};
