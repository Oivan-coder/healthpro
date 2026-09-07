window.Pages = window.Pages || {};
Pages.reports = async () => renderDemoUnavailable("Документы","Здесь будут медицинские заключения и документы.");

(() => {
  const originalLabs = Pages.labs;
  if (typeof originalLabs !== "function") return;

  const state = { result: null, busy: false };

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
      .lab-scan-row{border:1px solid var(--border,#dbe5e1);border-radius:14px;padding:12px;background:rgba(255,255,255,.7)}
      .lab-scan-row.needs-review{border-style:dashed}.lab-scan-row-head{display:flex;gap:10px;align-items:flex-start;justify-content:space-between}
      .lab-scan-grid{display:grid;grid-template-columns:minmax(120px,1fr) minmax(150px,2fr);gap:8px 12px;margin-top:10px}
      .lab-scan-grid label{font-size:12px;color:var(--muted,#667)}.lab-scan-grid input,.lab-scan-grid select{width:100%;margin-top:4px}
      .lab-scan-meta{display:flex;gap:12px;flex-wrap:wrap;margin:10px 0}.lab-scan-badge{font-size:12px;padding:4px 8px;border-radius:999px;background:rgba(43,112,86,.08)}
      .lab-scan-save{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px}
      @media(max-width:680px){.lab-scan-grid{grid-template-columns:1fr}.lab-scan-actions .btn{flex:1 1 145px}.lab-scan-row-head{display:block}}
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
    return messages[code] || "Не удалось распознать файл. Попробуйте ещё раз.";
  }

  async function api(path, options) {
    const response = await fetch(`${HealthAPI.API_BASE}${path}`, { credentials: "include", ...options });
    let body = null;
    try { body = await response.json(); } catch (error) {}
    if (!response.ok) {
      const code = body?.error || `api_${response.status}`;
      throw Object.assign(new Error(code), { code, status: response.status });
    }
    return body;
  }

  function renderResult(card) {
    const result = state.result;
    if (!result) return;
    const review = card.querySelector("#labScanReview");
    const rowsHtml = result.rows.map((row) => {
      const options = [];
      if (!row.selected) options.push(`<option value="">Выберите показатель</option>`);
      const seen = new Set();
      const allChoices = row.selected ? [row.selected, ...(row.choices || [])] : (row.choices || []);
      allChoices.forEach((choice) => {
        const key = `${choice.testId}|${choice.serviceId}`;
        if (seen.has(key)) return;
        seen.add(key);
        const selected = row.selected && String(row.selected.testId) === String(choice.testId) && String(row.selected.serviceId) === String(choice.serviceId);
        options.push(`<option value="${escapeHtml(key)}" ${selected ? "selected" : ""}>${escapeHtml(choice.name)}${choice.unit ? ` · ${escapeHtml(choice.unit)}` : ""} — ${escapeHtml(choice.serviceName)}</option>`);
      });
      const needsReview = row.status !== "matched";
      return `<div class="lab-scan-row ${needsReview ? "needs-review" : ""}" data-scan-row="${escapeHtml(row.id)}">
        <div class="lab-scan-row-head">
          <div><b>${escapeHtml(row.extractedName)}</b>${row.extractedCode ? `<div class="muted">${escapeHtml(row.extractedCode)}</div>` : ""}</div>
          <label><input type="checkbox" data-scan-include checked> добавить</label>
        </div>
        <div class="lab-scan-grid">
          <label>Распознанное значение<input data-scan-value value="${escapeHtml(row.value)}"></label>
          <label>Показатель в Атласе<select data-scan-choice>${options.join("")}</select></label>
          <label>Единица на бланке<input value="${escapeHtml(row.extractedUnit)}" disabled></label>
          <label>Референс на бланке<input value="${escapeHtml(row.extractedReference)}" disabled></label>
        </div>
        ${needsReview ? `<div class="muted" style="margin-top:8px">Проверьте сопоставление перед сохранением.</div>` : ""}
      </div>`;
    }).join("");

    review.innerHTML = `<div class="lab-scan-meta">
      <span class="lab-scan-badge">Найдено: ${result.summary.total}</span>
      <span class="lab-scan-badge">Сопоставлено: ${result.summary.matched}</span>
      ${result.summary.review ? `<span class="lab-scan-badge">Нужно проверить: ${result.summary.review}</span>` : ""}
    </div>
    <label>Дата исследования<input type="date" id="labScanDate" value="${escapeHtml(result.reportDate)}"></label>
    <div class="lab-scan-review">${rowsHtml}</div>
    <div class="lab-scan-save"><button class="btn primary" id="labScanSave" type="button">Сохранить подтверждённые результаты</button><span class="muted">В БД попадут только отмеченные строки.</span></div>`;
    review.hidden = false;
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
