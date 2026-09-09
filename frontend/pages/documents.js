window.Pages = window.Pages || {};
Pages.reports = async () => renderDemoUnavailable("Документы","Здесь будут медицинские заключения и документы.");

(() => {
  const originalLabs = Pages.labs;
  if (typeof originalLabs !== "function") return;

  const state = { result: null, busy: false, searchTimers: new Map() };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function ensureStyles() {
    if (document.getElementById("labScanStyles")) return;
    const style = document.createElement("style");
    style.id = "labScanStyles";
    style.textContent = `
      .lab-scan-card{margin-bottom:18px}.lab-scan-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
      .lab-scan-status{margin-top:12px}.lab-scan-review{margin-top:16px;display:grid;gap:12px}
      .lab-scan-row{border:1px solid var(--border,#dbe5e1);border-radius:16px;padding:16px;background:rgba(255,255,255,.82)}
      .lab-scan-row.needs-review{border-style:dashed}.lab-scan-row-head{display:flex;gap:10px;align-items:flex-start;justify-content:space-between}
      .lab-scan-row-head b{font-size:18px}.lab-scan-grid{display:grid;grid-template-columns:minmax(150px,.9fr) minmax(260px,1.4fr);gap:12px 16px;margin-top:12px}
      .lab-scan-grid label{font-size:12px;color:var(--muted,#667);font-weight:600}.lab-scan-grid input,.lab-scan-grid select{width:100%;margin-top:5px}
      .lab-scan-meta{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.lab-scan-badge{font-size:12px;padding:5px 9px;border-radius:999px;background:rgba(43,112,86,.08)}
      .lab-scan-save{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px}.lab-scan-choice{display:grid;gap:7px}
      .lab-scan-search{border-color:rgba(31,126,126,.35)!important}.lab-scan-search-note{font-size:12px;color:var(--muted,#667);font-weight:400}
      .lab-scan-source-note{margin-top:12px;padding:10px 12px;border-radius:12px;background:rgba(43,112,86,.055);font-size:13px;color:var(--muted,#667)}
      @media(max-width:680px){.lab-scan-grid{grid-template-columns:1fr}.lab-scan-actions .btn{flex:1 1 145px}.lab-scan-row-head{display:block}.lab-scan-row-head label{display:block;margin-top:8px}}
    `;
    document.head.appendChild(style);
  }

  function errorMessage(code) {
    const messages = {
      unsupported_scan_file: "Поддерживаются PDF, JPG и PNG.",
      scan_file_too_large: "Файл слишком большой. Максимум 10 МБ.",
      scan_no_results: "Не удалось найти результаты анализов на этом файле.",
      scan_ai_unavailable: "Распознавание сейчас недоступно.",
      scan_rate_limit: "Слишком много попыток. Попробуйте позднее.",
      gigachat_timeout: "Распознавание заняло слишком много времени. Попробуйте ещё раз.",
      scan_invalid_response: "Не удалось уверенно разобрать документ. Попробуйте более чёткое фото или PDF."
    };
    return messages[code] || "Не удалось выполнить операцию. Попробуйте ещё раз.";
  }

  async function api(path, options = {}) {
    const response = await fetch(`${HealthAPI.API_BASE}${path}`, { credentials: "include", ...options });
    let body = null;
    try { body = await response.json(); } catch (error) {}
    if (!response.ok) {
      const code = body?.error || `api_${response.status}`;
      throw Object.assign(new Error(code), { code, status: response.status });
    }
    return body;
  }

  function optionLabel(choice) {
    const unit = choice.unit ? ` · ${choice.unit}` : "";
    return `${choice.name}${unit} — ${choice.serviceName}`;
  }

  function appendChoices(select, choices, preserveValue = "") {
    const seen = new Set();
    const selectedValue = preserveValue || select.value;
    select.innerHTML = '<option value="">Выберите показатель</option>';
    (choices || []).forEach((choice) => {
      const key = `${choice.testId}|${choice.serviceId}`;
      if (seen.has(key)) return;
      seen.add(key);
      const option = document.createElement("option");
      option.value = key;
      option.textContent = optionLabel(choice);
      option.dataset.unit = choice.unit || "";
      select.appendChild(option);
    });
    if (selectedValue && [...select.options].some((option) => option.value === selectedValue)) select.value = selectedValue;
  }

  async function searchDictionary(rowElement, query) {
    const select = rowElement.querySelector("[data-scan-choice]");
    const note = rowElement.querySelector("[data-scan-search-note]");
    const q = String(query || "").trim();
    if (!q) {
      const source = state.result?.rows.find((row) => row.id === rowElement.dataset.scanRow);
      const initial = source?.selected ? [source.selected, ...(source.choices || [])] : (source?.choices || []);
      appendChoices(select, initial, select.value);
      note.textContent = "Введите название или сокращение, если предложение неверное.";
      return;
    }
    note.textContent = "Ищу по всему справочнику Атласа…";
    try {
      const response = await api(`/lab-scan/search?q=${encodeURIComponent(q)}`);
      appendChoices(select, response.results || [], "");
      note.textContent = response.results?.length ? `Найдено вариантов: ${response.results.length}` : "В справочнике ничего не найдено.";
    } catch (error) {
      note.textContent = "Не удалось выполнить поиск по справочнику.";
    }
  }

  function bindSearch(rowElement) {
    const input = rowElement.querySelector("[data-scan-search]");
    input.addEventListener("input", () => {
      const id = rowElement.dataset.scanRow;
      clearTimeout(state.searchTimers.get(id));
      state.searchTimers.set(id, setTimeout(() => searchDictionary(rowElement, input.value), 250));
    });
  }

  function renderResult(card) {
    const result = state.result;
    if (!result) return;
    const review = card.querySelector("#labScanReview");
    const rowsHtml = result.rows.map((row) => {
      const choices = row.selected ? [row.selected, ...(row.choices || [])] : (row.choices || []);
      const seen = new Set();
      const options = ['<option value="">Выберите показатель</option>'];
      choices.forEach((choice) => {
        const key = `${choice.testId}|${choice.serviceId}`;
        if (seen.has(key)) return;
        seen.add(key);
        const selected = row.selected && String(row.selected.testId) === String(choice.testId) && String(row.selected.serviceId) === String(choice.serviceId);
        options.push(`<option value="${escapeHtml(key)}" data-unit="${escapeHtml(choice.unit || "")}" ${selected ? "selected" : ""}>${escapeHtml(optionLabel(choice))}</option>`);
      });
      const needsReview = row.status !== "matched";
      return `<div class="lab-scan-row ${needsReview ? "needs-review" : ""}" data-scan-row="${escapeHtml(row.id)}">
        <div class="lab-scan-row-head">
          <div><b>${escapeHtml(row.extractedName)}</b>${row.extractedCode ? `<div class="muted">${escapeHtml(row.extractedCode)}</div>` : ""}</div>
          <label><input type="checkbox" data-scan-include checked> добавить</label>
        </div>
        <div class="lab-scan-grid">
          <label>Распознанное значение<input data-scan-value value="${escapeHtml(row.value)}"></label>
          <label class="lab-scan-choice">Показатель в Атласе
            <input class="lab-scan-search" data-scan-search placeholder="Поиск по всему справочнику: например, протромбин…" autocomplete="off">
            <select data-scan-choice>${options.join("")}</select>
            <span class="lab-scan-search-note" data-scan-search-note>${needsReview ? "Предложение не подтверждено автоматически — проверьте или найдите вручную." : "Автоматическое сопоставление выглядит уверенно, но его можно заменить."}</span>
          </label>
          <label>Единица на исходном бланке<input value="${escapeHtml(row.extractedUnit)}" disabled></label>
          <label>Референс на исходном бланке<input value="${escapeHtml(row.extractedReference)}" disabled></label>
        </div>
      </div>`;
    }).join("");

    review.innerHTML = `<div class="lab-scan-meta">
      <span class="lab-scan-badge">Найдено: ${result.summary.total}</span>
      <span class="lab-scan-badge">Автосопоставлено: ${result.summary.matched}</span>
      ${result.summary.review ? `<span class="lab-scan-badge">Проверить вручную: ${result.summary.review}</span>` : ""}
    </div>
    <label>Дата исследования<input type="date" id="labScanDate" value="${escapeHtml(result.reportDate)}"></label>
    <div class="lab-scan-source-note">Единица и референс ниже — то, что распознано с исходного бланка. После сохранения показатель живёт в Атласе по нашему справочнику и нашим референсным интервалам; поэтому сопоставление показателя нужно проверить.</div>
    <div class="lab-scan-review">${rowsHtml}</div>
    <div class="lab-scan-save"><button class="btn primary" id="labScanSave" type="button">Сохранить подтверждённые результаты</button><span class="muted">В БД попадут только отмеченные строки.</span></div>`;
    review.hidden = false;
    review.querySelectorAll("[data-scan-row]").forEach(bindSearch);
    card.querySelector("#labScanSave").onclick = () => save(card);
  }

  async function analyze(card, file) {
    if (!file || state.busy) return;
    const mime = String(file.type || "").toLowerCase();
    if (!["application/pdf", "image/jpeg", "image/png"].includes(mime)) {
      card.querySelector("#labScanStatus").textContent = "Поддерживаются PDF, JPG и PNG.";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      card.querySelector("#labScanStatus").textContent = "Максимальный размер файла — 10 МБ.";
      return;
    }
    state.busy = true;
    const status = card.querySelector("#labScanStatus");
    status.textContent = "Распознаю бланк и сопоставляю показатели со справочником…";
    card.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    try {
      state.result = await api("/lab-scan/analyze", {
        method: "POST",
        headers: { "Content-Type": mime, "X-File-Name": encodeURIComponent(file.name || "analysis") },
        body: file
      });
      status.textContent = "Готово. Проверьте распознанные данные перед сохранением.";
      renderResult(card);
    } catch (error) {
      status.textContent = errorMessage(error.code);
    } finally {
      state.busy = false;
      card.querySelectorAll("button").forEach((button) => { button.disabled = false; });
    }
  }

  async function save(card) {
    if (!state.result || state.busy) return;
    const rows = [];
    let unresolved = false;
    card.querySelectorAll("[data-scan-row]").forEach((element) => {
      if (!element.querySelector("[data-scan-include]").checked) return;
      const choice = element.querySelector("[data-scan-choice]").value;
      const value = element.querySelector("[data-scan-value]").value.trim();
      if (!choice || !value) { unresolved = true; return; }
      const [testId, serviceId] = choice.split("|");
      const source = state.result.rows.find((row) => row.id === element.dataset.scanRow);
      rows.push({
        testId, serviceId, value,
        extractedName: source?.extractedName || "",
        extractedUnit: source?.extractedUnit || "",
        extractedReference: source?.extractedReference || ""
      });
    });
    const status = card.querySelector("#labScanStatus");
    if (unresolved) {
      status.textContent = "Для всех отмеченных строк выберите показатель в Атласе и проверьте значение.";
      return;
    }
    if (!rows.length) {
      status.textContent = "Отметьте хотя бы один результат для сохранения.";
      return;
    }
    state.busy = true;
    const saveButton = card.querySelector("#labScanSave");
    saveButton.disabled = true;
    status.textContent = "Сохраняю подтверждённые результаты…";
    try {
      const response = await api("/lab-scan/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportDate: card.querySelector("#labScanDate").value,
          fileName: state.result.fileName,
          mimeType: state.result.mimeType,
          laboratory: state.result.laboratory,
          reportName: state.result.reportName,
          rows
        })
      });
      const count = (response.reports || []).reduce((sum, report) => sum + Number(report.testCount || 0), 0);
      status.innerHTML = `Сохранено результатов: <b>${count}</b>. <a href="#lab-history">Открыть историю анализов</a>`;
      card.querySelector("#labScanReview").hidden = true;
      state.result = null;
    } catch (error) {
      status.textContent = errorMessage(error.code);
    } finally {
      state.busy = false;
      if (saveButton) saveButton.disabled = false;
    }
  }

  function inject() {
    ensureStyles();
    const root = document.getElementById("pageRoot");
    if (!root || document.getElementById("labScanCard")) return;
    const card = document.createElement("section");
    card.className = "card lab-scan-card";
    card.id = "labScanCard";
    card.innerHTML = `<div class="label">Добавить результаты</div><h2>Сканировать анализ</h2>
      <p class="muted">Сфотографируйте бланк на телефоне или приложите PDF/JPG/PNG. Перед записью вы обязательно проверите распознанные данные.</p>
      <div class="lab-scan-actions">
        <button class="btn primary" id="labScanCamera" type="button">Сфотографировать</button>
        <button class="btn" id="labScanFile" type="button">Выбрать файл</button>
      </div>
      <input id="labScanCameraInput" type="file" accept="image/jpeg,image/png" capture="environment" hidden>
      <input id="labScanFileInput" type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" hidden>
      <div class="lab-scan-status muted" id="labScanStatus">PDF/JPG/PNG, до 10 МБ. Ничего не сохраняется без подтверждения.</div>
      <div id="labScanReview" hidden></div>`;
    root.prepend(card);
    const cameraInput = card.querySelector("#labScanCameraInput");
    const fileInput = card.querySelector("#labScanFileInput");
    card.querySelector("#labScanCamera").onclick = () => cameraInput.click();
    card.querySelector("#labScanFile").onclick = () => fileInput.click();
    cameraInput.onchange = () => analyze(card, cameraInput.files?.[0]);
    fileInput.onchange = () => analyze(card, fileInput.files?.[0]);
  }

  Pages.labs = async (...args) => {
    const result = await originalLabs(...args);
    inject();
    return result;
  };
})();
