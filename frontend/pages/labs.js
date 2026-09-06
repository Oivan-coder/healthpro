window.Pages = window.Pages || {};

window.LabState = {
  mode: "reports",
  group: "Все",
  query: "",
  selectedCode: "GLU",
  selectedReportId: "",
  onlyAbnormal: false,
  sort: "date"
};

window.LabHistoryState = window.LabHistoryState || {
  query: "",
  view: "table"
};

const LABS_FAVORITE_LABS_KEY = "healthId.favoriteLabCodes";

function getFavoriteLabCodes() {
  const saved = PatientStorage.getPatientState(LABS_FAVORITE_LABS_KEY, []);
  return Array.isArray(saved) ? saved : [];
}

function setFavoriteLabCodes(codes) {
  PatientStorage.setPatientState(LABS_FAVORITE_LABS_KEY, [...new Set(codes)].slice(0, 3));
}

function isFavoriteLab(code) {
  return getFavoriteLabCodes().includes(code);
}

function toggleFavoriteLab(code) {
  const current = getFavoriteLabCodes();
  const next = current.includes(code)
    ? current.filter(item => item !== code)
    : [...current, code].slice(-3);
  setFavoriteLabCodes(next);
}

function favoriteButton(code, favoriteCodes, extraClass = "") {
  const active = favoriteCodes.includes(code);
  return `
    <button class="favorite-star ${extraClass} ${active ? "active" : ""}" type="button" data-favorite-code="${code}" aria-label="${active ? "Убрать показатель из избранного" : "Добавить показатель в избранное"}" title="${active ? "Убрать с главной" : "Добавить на главную"}">★</button>
  `;
}

function reportStatusText(status) {
  const statuses = {
    final: "Результат готов",
    corrected: "Результат обновлен",
    preliminary: "Ожидает подтверждения"
  };
  return statuses[status] || status || "Результат готов";
}

function bookingSuggestionForLab(lab) {
  const key = `${lab.code || ""} ${lab.name || ""}`.toLowerCase();
  if (/(glu|hba1c|insulin|c-peptide|c peptide|глюкоз|инсулин)/i.test(key)) {
    return { specialtyId: "endo", title: "Эндокринолог" };
  }
  if (/(alt|ast|bilirubin|ggt|алт|аст|билирубин|ггт)/i.test(key)) {
    return { specialtyId: "therapy", title: "Гастроэнтеролог или терапевт" };
  }
  if (/(crp|соэ|soe|wbc|срб|лейкоцит)/i.test(key)) {
    return { specialtyId: "therapy", title: "Терапевт" };
  }
  if (/(ldl|hdl|chol|cholesterol|triglycerides|tg|лпнп|лпвп|холестерин|триглицерид)/i.test(key)) {
    return { specialtyId: "cardio", title: "Кардиолог или терапевт" };
  }
  return { specialtyId: "therapy", title: "Терапевт" };
}

function createBookingContext(lab) {
  const suggestion = bookingSuggestionForLab(lab);
  return {
    test_code: lab.code,
    test_name: lab.name,
    value: lab.latestValue,
    unit: lab.unit,
    flag: lab.flag,
    report_date: lab.latestDate,
    specialtyId: suggestion.specialtyId,
    suggestedSpecialty: suggestion.title
  };
}

function safeFilename(value) {
  return `${value || "lab_report"}`.replace(/[^\p{L}\p{N}_-]+/gu, "_");
}

async function downloadLabReportPdf(reportId, reportName) {
  try {
    const response = await fetch(HealthAPI.labReportPdfDownloadUrl(reportId));
    if (!response.ok) {
      let body = {};
      try { body = await response.json(); } catch (error) { body = {}; }
      if (body.error === "lab_report_pdf_not_connected") {
        UI.toast("PDF-бланк пока не подключен.");
        return;
      }
      UI.toast("PDF недоступен для выбранного исследования.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFilename(reportName || reportId)}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    UI.toast("PDF скачан");
  } catch (error) {
    UI.toast("PDF временно недоступен.");
  }
}


function parseRuDate(date) {
  if (/^\d{4}-/.test(date || "")) return new Date(date);
  const [day, month, year] = String(date || "").split(".").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

window.Pages.labs = async function renderLabs() {
  const [data, reports] = await Promise.all([HealthAPI.labs(), HealthAPI.getLabReports()]);
  const {escape:e, status, reference, value, attention} = Cabinet;
  const query = LabState.query.trim().toLowerCase();
  const favorites = getFavoriteLabCodes();
  const reportMode = LabState.mode === "reports";
  let items = reportMode ? reports : data.labs.filter(lab => LabState.mode !== "abnormal" || attention(lab));
  items = items.filter(item => `${item.name} ${item.group || ""} ${item.code || ""} ${item.serviceCode || ""} ${item.sourceServiceCode || ""} ${item.date || ""}`.toLowerCase().includes(query));
  items = [...items].sort((a,b) => {
    if (LabState.sort === "name") return a.name.localeCompare(b.name,"ru");
    if (LabState.sort === "status") return reportMode ? (b.abnormalCount || 0) - (a.abnormalCount || 0) : Number(attention(b)) - Number(attention(a));
    return parseRuDate(b.date || b.latestDate) - parseRuDate(a.date || a.latestDate);
  });
  const key = reportMode ? "id" : "code";
  const selectedKey = reportMode ? "selectedReportId" : "selectedCode";
  if (!items.some(item => item[key] === LabState[selectedKey])) LabState[selectedKey] = items[0]?.[key] || "";
  const selected = LabState[selectedKey] ? (reportMode
    ? await HealthAPI.getLabReport(LabState[selectedKey])
    : await HealthAPI.getLabTestHistory(LabState[selectedKey]) || items.find(item => item.code === LabState[selectedKey])) : null;
  const history = [...(selected?.history || [])].sort((a,b) => parseRuDate(a.date) - parseRuDate(b.date));
  const rowMarkup = row => `<tr>
    <th scope="row">${e(row.name)}</th><td data-label="Значение" class="measure">${e(Cabinet.display(row.value))}</td>
    <td data-label="Единица">${e(Cabinet.display(row.unit))}</td><td data-label="Референс">${reference(row)}</td>
    <td data-label="Статус">${status(row.mappingStatus === "unmapped" ? "unknown" : row.flag)}</td>
    <td class="table-actions">${row.code ? `${favoriteButton(row.code,favorites)}<button class="btn ghost small" data-show-test="${e(row.code)}">Динамика</button>` : "—"}</td>
  </tr>`;
  UI.root().innerHTML = `
    <div class="cabinet-page results-page">
      <div class="results-toolbar">
        <div class="workspace-tabs" role="group" aria-label="Вид анализов">
          ${[["reports","Отчёты"],["abnormal","Внимание"],["tests","Показатели"]].map(([mode,label]) => `<button type="button" aria-pressed="${LabState.mode === mode}" class="${LabState.mode === mode ? "active" : ""}" data-lab-mode="${mode}">${label}</button>`).join("")}
        </div>
        <label class="search-field"><span class="sr-only">Поиск анализов</span><input id="labSearch" type="text" placeholder="Название, код или дата" value="${e(LabState.query)}" autocomplete="off"></label>
        <label><span class="sr-only">Сортировка</span><select id="labSort"><option value="date" ${LabState.sort === "date" ? "selected" : ""}>Сначала новые</option><option value="name" ${LabState.sort === "name" ? "selected" : ""}>По названию</option><option value="status" ${LabState.sort === "status" ? "selected" : ""}>Сначала внимание</option></select></label>
      </div>
      <section class="results-layout">
        <aside class="results-list" aria-label="${reportMode ? "Отчёты" : "Показатели"}">
          <div class="section-heading"><h2>${reportMode ? "Исследования" : LabState.mode === "abnormal" ? "Показатели внимания" : "Показатели"}</h2><span class="meta-count">${items.length}</span></div>
          ${items.map(item => `<button class="result-item ${item[key] === LabState[selectedKey] ? "selected" : ""}" data-result-key="${e(item[key])}" aria-current="${item[key] === LabState[selectedKey] ? "true" : "false"}">
            <span class="item-title">${e(item.name)}</span>
            <small>${e(item.date || item.latestDate || "—")}${reportMode ? ` · ${item.testCount || 0} ${Cabinet.plural(item.testCount || 0,"показатель","показателя","показателей")}` : ` · ${e(item.group || "")}`}</small>
            <span class="result-item-bottom">${reportMode ? `<span class="result-status ${item.abnormalCount ? "attention" : "normal"}">${item.abnormalCount ? `${item.abnormalCount} внимания` : "Нет показателей внимания"}</span><small>${e(reportStatusText(item.status))}</small>` : `<span class="measure">${value(item)}</span>${status(item.flag)}`}</span>
          </button>`).join("") || `<p class="empty-copy">${query ? "Ничего не найдено. Попробуйте другой запрос." : "Пока нет результатов в этом разделе."}</p>`}
        </aside>
        <div class="lab-detail workspace-section" id="resultDetail">
          ${selected && reportMode ? `
            <header class="section-heading"><div><h2>${e(selected.name)}</h2><p class="section-note">${e(selected.date)} · ${e(reportStatusText(selected.status))}</p></div></header>
            <p class="report-summary">${selected.testCount || 0} ${Cabinet.plural(selected.testCount || 0,"показатель","показателя","показателей")} · ${selected.abnormalCount || 0} внимания. Оценка дана по референсам лаборатории, это не диагноз.</p>
            <div class="compact-table-wrap"><table class="compact-table observation-table"><thead><tr><th>Показатель</th><th>Значение</th><th>Единица</th><th>Референс</th><th>Статус</th><th><span class="sr-only">Действия</span></th></tr></thead><tbody>${(selected.observations || []).map(rowMarkup).join("")}</tbody></table></div>
            <div class="quick-links report-file-actions"><button class="btn secondary" data-report-pdf-id="${e(selected.id)}" data-report-pdf-name="${e(selected.name)}">Скачать оригинальный бланк</button></div>
          ` : selected ? `
            <header class="section-heading"><div><span class="eyebrow">${e(selected.group || "Показатель")}</span><h2>${e(selected.name)}</h2></div>${favoriteButton(selected.code,favorites)}</header>
            <div class="indicator-summary"><span class="favorite-value">${value(selected)}</span>${status(selected.flag)}<span class="section-note">Референс: ${reference(selected)} · ${e(selected.latestDate || "—")}</span></div>
            ${selected.interpretation ? `<p class="report-summary">${e(selected.interpretation)}</p>` : ""}
            ${history.filter(point => Cabinet.numeric(point.value) !== null).length >= 2 ? `<canvas id="labChart" class="trend-canvas detail-chart" role="img" aria-label="Динамика ${e(selected.name)}"></canvas>` : `<p class="empty-copy">${history.length < 2 ? "Для графика нужен ещё один результат." : "Для графика нужны числовые результаты."}</p>`}
            <div class="compact-table-wrap"><table class="compact-table value-history"><caption>История значений</caption><thead><tr><th>Дата</th><th>Значение</th><th>Статус</th></tr></thead><tbody>${[...history].reverse().map(point => `<tr><td>${e(point.date)}</td><td class="measure">${value({...point,unit:selected.unit})}</td><td>${status(point.flag)}</td></tr>`).join("")}</tbody></table></div>
            <div class="quick-links"><button class="btn secondary" data-explain-test="${e(selected.code)}">Спросить помощника</button></div>
            ${selected.interpretationRequirements?.length ? `<details class="trend-data"><summary>Что важно для интерпретации</summary><p>${e(selected.interpretationRequirements.join("; "))}</p></details>` : ""}
          ` : `<h2>${query ? "Ничего не найдено" : "Результатов пока нет"}</h2><p class="empty-copy">${query ? "Измените поиск или переключите вкладку." : "Здесь появятся детали лабораторного исследования."}</p>`}
        </div>
      </section>
    </div>`;
  UI.root().querySelectorAll("[data-lab-mode]").forEach(button => button.onclick = () => {
    LabState.mode = button.dataset.labMode; LabState.group = "Все"; App.render();
  });
  UI.root().querySelectorAll("[data-result-key]").forEach(button => button.onclick = async () => {
    LabState[selectedKey] = button.dataset.resultKey;
    await App.render();
    const detail = document.getElementById("resultDetail");
    if (detail && UI.root().getBoundingClientRect().width < 920) detail.scrollIntoView({behavior:"smooth",block:"start"});
  });
  UI.root().querySelectorAll("[data-show-test]").forEach(button => button.onclick = () => {
    LabState.mode = "tests"; LabState.query = ""; LabState.selectedCode = button.dataset.showTest; App.render();
  });
  UI.root().querySelectorAll("[data-report-pdf-id]").forEach(button => button.onclick = () => downloadLabReportPdf(button.dataset.reportPdfId,button.dataset.reportPdfName));
  const explain = UI.root().querySelector("[data-explain-test]");
  if (explain) explain.onclick = () => {
    window.AssistantState = window.AssistantState || {};
    AssistantState.mode = "result_explanation"; AssistantState.context = createBookingContext(selected); AssistantState.messages = [];
    AssistantState.pending = false; AssistantState.draft = "";
    App.navigate("assistant");
  };
  Cabinet.search(document.getElementById("labSearch"), query => {LabState.query = query;});
  document.getElementById("labSort").onchange = event => {LabState.sort = event.target.value; App.render();};
  Cabinet.bindFavorites();
  if (!reportMode && selected) Charts.drawLabChart(document.getElementById("labChart"), {...selected,history});
};

window.Pages["lab-history"] = async function renderLabHistory() {
  const rows = await HealthAPI.labHistory();
  const {escape:e, value, status, reference, attention} = Cabinet;
  const query = LabHistoryState.query.trim().toLowerCase();
  const filtered = rows.filter(row => `${row.date} ${row.name} ${row.code} ${row.group}`.toLowerCase().includes(query)).sort((a,b) => parseRuDate(b.date) - parseRuDate(a.date));
  const favorites = getFavoriteLabCodes();
  const rowMarkup = row => `<tr>
    <td data-label="Дата">${e(row.date)}</td><td data-label="Группа">${e(row.group || "—")}</td>
    <th scope="row">${e(row.name)}</th><td data-label="Значение" class="measure">${value(row)}</td>
    <td data-label="Референс">${reference(row)}</td><td data-label="Статус">${status(row.flag)}</td>
    <td class="table-actions">${favoriteButton(row.code,favorites)}<button class="btn ghost small" data-history-chart-code="${e(row.code)}">Динамика</button></td>
  </tr>`;
  const table = items => `<div class="compact-table-wrap"><table class="compact-table history-values"><thead><tr><th>Дата</th><th>Группа</th><th>Показатель</th><th>Значение</th><th>Референс</th><th>Статус</th><th><span class="sr-only">Действия</span></th></tr></thead><tbody>${items.map(rowMarkup).join("")}</tbody></table></div>`;
  const dates = [...new Set(filtered.map(row => row.date))];
  UI.root().innerHTML = `<section class="cabinet-page history-page">
    <div class="section-heading"><h2>История значений</h2><p class="section-note">${rows.length} ${Cabinet.plural(rows.length,"результат","результата","результатов")} · ${new Set(rows.map(row => row.code)).size} ${Cabinet.plural(new Set(rows.map(row => row.code)).size,"показатель","показателя","показателей")} · ${rows.filter(attention).length} внимания</p></div>
    <div class="history-controls"><label class="search-field"><span class="sr-only">Поиск по истории</span><input type="text" id="historySearch" value="${e(LabHistoryState.query)}" placeholder="Показатель, группа, код или дата" autocomplete="off"></label>
      <div class="workspace-tabs" role="group" aria-label="Вид истории">${[["table","Таблица"],["dates","По датам"]].map(([view,label]) => `<button class="${LabHistoryState.view === view ? "active" : ""}" aria-pressed="${LabHistoryState.view === view}" data-history-view="${view}">${label}</button>`).join("")}</div>
    </div>
    ${!filtered.length ? `<p class="empty-copy">Ничего не найдено.</p>` : LabHistoryState.view === "dates" ? dates.map(date => `<section class="date-section"><h3>${e(date)}</h3>${table(filtered.filter(row => row.date === date))}</section>`).join("") : table(filtered)}
  </section>`;
  Cabinet.search(document.getElementById("historySearch"),query => {LabHistoryState.query = query;});
  UI.root().querySelectorAll("[data-history-view]").forEach(button => button.onclick = () => {LabHistoryState.view = button.dataset.historyView;App.render();});
  UI.root().querySelectorAll("[data-history-chart-code]").forEach(button => button.onclick = () => {
    LabState.mode = "tests"; LabState.query = ""; LabState.group = "Все"; LabState.selectedCode = button.dataset.historyChartCode;App.navigate("labs");
  });
  Cabinet.bindFavorites();
};
