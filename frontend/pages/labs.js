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

function reportAttentionText(count) {
  if (!count) return "все в обычном диапазоне";
  if (count === 1) return "1 показатель требует внимания";
  if (count > 1 && count < 5) return `${count} показателя требуют внимания`;
  return `${count} показателей требуют внимания`;
}

function pluralRu(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function labListMetaText(mode, count, hasScrollHint) {
  const noun = mode === "reports"
    ? pluralRu(count, "отчет", "отчета", "отчетов")
    : pluralRu(count, "показатель", "показателя", "показателей");
  return hasScrollHint ? `${count} ${noun} · прокрутите список` : `${count} ${noun}`;
}

function cleanSourceCode(code) {
  if (!code) return "";
  return String(code).replace(/^source\s+/i, "").trim();
}

function reportSourceText(report) {
  const sourceCode = cleanSourceCode(report.sourceServiceCode || report.serviceCode);
  return sourceCode ? `технический код: ${sourceCode}` : "технический код не указан";
}

function syncLabListHeight() {
  const listCard = document.querySelector(".lab-list-card");
  const detailCard = document.querySelector(".lab-detail");
  const isDesktop = window.matchMedia("(min-width: 901px)").matches;

  if (!listCard || !detailCard || !isDesktop) {
    if (listCard) {
      listCard.classList.remove("is-height-synced");
      listCard.style.height = "";
    }
    return;
  }

  const detailHeight = Math.ceil(detailCard.getBoundingClientRect().height);
  if (!detailHeight) return;

  listCard.classList.add("is-height-synced");
  listCard.style.height = `${detailHeight}px`;
}

if (!window.__labListHeightSyncBound) {
  window.__labListHeightSyncBound = true;
  window.addEventListener("resize", () => requestAnimationFrame(syncLabListHeight));
}

function patientStatusText(flag) {
  return UI.statusText(flag);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ru"));
}

function reportCategory(report) {
  return report.name || report.serviceCode || report.sourceServiceCode || "Другое";
}

function groupsForMode(mode, reports, labs, abnormalLabs) {
  if (mode === "reports") return ["Все", ...uniqueSorted(reports.map(reportCategory))];
  if (mode === "abnormal") return ["Все", ...uniqueSorted(abnormalLabs.map(lab => lab.group))];
  return ["Все", ...uniqueSorted(labs.filter(lab => lab.history?.length).map(lab => lab.group))];
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

window.Pages.labs = async function renderLabs() {
  const [data, reports] = await Promise.all([HealthAPI.labs(), HealthAPI.getLabReports()]);
  const abnormalLabs = data.labs.filter(x => x.flag !== "normal");
  const groups = groupsForMode(LabState.mode, reports, data.labs, abnormalLabs);
  if (!groups.includes(LabState.group)) LabState.group = "Все";
  const favoriteCodes = getFavoriteLabCodes();
  let labs = LabState.mode === "abnormal"
    ? abnormalLabs
    : data.labs.filter(lab => lab.history?.length);
  let filteredReports = reports;

  if (LabState.group !== "Все") {
    if (LabState.mode === "reports") {
      filteredReports = filteredReports.filter(report => reportCategory(report) === LabState.group);
    } else {
      labs = labs.filter(x => x.group === LabState.group);
    }
  }
  if (LabState.query) {
    const q = LabState.query.toLowerCase();
    labs = labs.filter(x => `${x.name} ${x.group} ${x.code} ${x.loinc}`.toLowerCase().includes(q));
    filteredReports = filteredReports.filter(x => `${x.name} ${x.serviceCode} ${x.sourceServiceCode} ${x.date}`.toLowerCase().includes(q));
  }
  if (LabState.onlyAbnormal) labs = labs.filter(x => x.flag !== "normal");
  if (LabState.onlyAbnormal) filteredReports = filteredReports.filter(x => x.abnormalCount > 0);

  const statusRank = { high: 0, low: 1, normal: 2 };
  labs = [...labs].sort((a, b) => {
    const favoriteDelta = Number(favoriteCodes.includes(b.code)) - Number(favoriteCodes.includes(a.code));
    if (favoriteDelta) return favoriteDelta;
    if (LabState.sort === "name") return a.name.localeCompare(b.name, "ru");
    if (LabState.sort === "status") return (statusRank[a.flag] ?? 3) - (statusRank[b.flag] ?? 3);
    return parseRuDate(b.latestDate) - parseRuDate(a.latestDate);
  });
  const hasDisplayLabs = labs.length > 0;
  const hasPatientLabs = data.labs.length > 0;
  const hasModeData = LabState.mode === "reports"
    ? reports.length > 0
    : LabState.mode === "abnormal"
      ? abnormalLabs.length > 0
      : data.labs.some(lab => lab.history?.length);

  if (!data.labs.find(x => x.code === LabState.selectedCode)) LabState.selectedCode = data.labs[0]?.code || "";
  if (hasDisplayLabs && !labs.find(x => x.code === LabState.selectedCode)) LabState.selectedCode = labs[0].code;
  if (LabState.mode === "reports" && !filteredReports.find(x => x.id === LabState.selectedReportId)) {
    LabState.selectedReportId = filteredReports[0]?.id || "";
  } else if (!reports.find(x => x.id === LabState.selectedReportId)) {
    LabState.selectedReportId = reports[0]?.id || "";
  }
  const selectedReport = LabState.selectedReportId ? await HealthAPI.getLabReport(LabState.selectedReportId) : null;
  const selected = LabState.selectedCode
    ? await HealthAPI.getLabTestHistory(LabState.selectedCode) || data.labs.find(x => x.code === LabState.selectedCode)
    : null;
  const selectedHistory = selected ? [...selected.history].sort((a, b) => parseRuDate(b.date) - parseRuDate(a.date)) : [];
  const listItemCount = LabState.mode === "reports" ? filteredReports.length : labs.length;
  const hasScrollHint = LabState.mode === "reports"
    ? filteredReports.length > 3
    : LabState.mode === "abnormal"
      ? labs.length > 2
      : labs.length > 3;
  const listModeClass = LabState.mode === "reports"
    ? "reports-list"
    : LabState.mode === "abnormal"
      ? "attention-list"
      : "history-list";

  UI.root().innerHTML = `
    <section class="lab-hero">
      <div>
        <div class="label">Анализы</div>
        <h2>Результаты и динамика</h2>
        <p class="muted">Исследования, показатели для обсуждения с врачом и история значений во времени.</p>
      </div>
      <div class="lab-hero-stats">
        <div><span class="label">Исследования</span><b>${reports.length}</b></div>
        <div><span class="label">Показатели</span><b>${data.labs.length}</b></div>
        <div><span class="label">Внимание</span><b>${abnormalLabs.length}</b></div>
      </div>
    </section>

    <div class="toolbar">
      <div class="segmented-control">
        <button class="${LabState.mode === "reports" ? "active" : ""}" data-lab-mode="reports">Отчеты</button>
        <button class="${LabState.mode === "abnormal" ? "active" : ""}" data-lab-mode="abnormal">Внимание</button>
        <button class="${LabState.mode === "tests" ? "active" : ""}" data-lab-mode="tests">Параметры</button>
      </div>
      <input id="labSearch" placeholder="Поиск: глюкоза, ОАК, АЛТ" value="${LabState.query}">
      <select id="labSort" aria-label="Сортировка лабораторных показателей">
        <option value="date" ${LabState.sort === "date" ? "selected" : ""}>Сначала новые</option>
        <option value="name" ${LabState.sort === "name" ? "selected" : ""}>По названию</option>
        <option value="status" ${LabState.sort === "status" ? "selected" : ""}>По статусу</option>
      </select>
      <button class="btn ghost" id="scrollToChart">График</button>
    </div>

    <div class="tabs">
      ${groups.map(g => `<button class="tab ${g===LabState.group ? "active":""}" data-lab-group="${g}">${g}</button>`).join("")}
    </div>

    <section class="lab-layout">
      <div class="card lab-list-card">
        <div class="label">${LabState.mode === "reports" ? "Исследования" : LabState.mode === "abnormal" ? "Требуют внимания" : "Показатели / динамика"}</div>
        <h2>${LabState.mode === "reports" ? "Готовые исследования" : LabState.mode === "abnormal" ? "За пределами обычного диапазона" : LabState.group}</h2>
        ${LabState.mode === "abnormal" ? `<p class="muted lab-list-note">Это не диагноз. Показатели требуют интерпретации врачом с учетом жалоб, подготовки и лекарств.</p>` : ""}
        ${listItemCount ? `<p class="muted lab-list-meta">${labListMetaText(LabState.mode, listItemCount, hasScrollHint)}</p>` : ""}
        <div class="lab-list-wrap ${hasScrollHint ? "has-overflow" : ""}">
          <div class="lab-list ${listModeClass}">
            ${LabState.mode === "reports" ? filteredReports.map(report => `
              <article class="lab-card ${report.id===LabState.selectedReportId ? "active":""}">
                <button class="lab-card-main" data-report-id="${report.id}">
                  <div class="lab-card-head">
                    <div>
                      <div class="lab-name">${report.name}</div>
                      <small class="muted">${report.date} • ${report.testCount} показателей</small>
                    </div>
                    <span class="status ${report.abnormalCount ? "warn" : "ok"}">${reportStatusText(report.status)}</span>
                  </div>
                  <div class="report-card-note ${report.abnormalCount ? "warn" : "ok"}">${reportAttentionText(report.abnormalCount)}</div>
                  <small class="technical-meta">${reportSourceText(report)}</small>
                  <div class="tile-grid report-mini-grid">
                    <div class="tile"><span class="label">Тестов</span><b>${report.testCount}</b></div>
                    <div class="tile"><span class="label">Внимание</span><b>${report.abnormalCount}</b></div>
                  </div>
                </button>
                <div class="lab-card-actions">
                  <button class="btn ghost wide" data-report-id="${report.id}">Открыть исследование</button>
                  <button class="btn secondary wide" data-report-pdf-id="${report.id}" data-report-pdf-name="${report.name}">Скачать PDF</button>
                </div>
              </article>
            `).join("") || UI.renderEmpty(hasModeData ? "Ничего не найдено." : "Пока нет лабораторных отчетов пациента.") : labs.map(lab => `
              <article class="lab-card ${lab.code===LabState.selectedCode ? "active":""}">
                <div class="lab-card-head lab-card-head-actions">
                  <button class="lab-card-title" data-lab-code="${lab.code}">
                    <span class="lab-name">${lab.name}</span>
                    <small class="muted">${lab.group}</small>
                  </button>
                  <div class="lab-card-head-tools">
                    <span class="status ${UI.statusClass(lab.flag)}">${patientStatusText(lab.flag)}</span>
                    ${favoriteButton(lab.code, favoriteCodes)}
                  </div>
                </div>
                <button class="lab-card-main" data-lab-code="${lab.code}">
                  <div class="lab-value">${UI.labValue(lab)}</div>
                  ${UI.referenceRangeBar(lab)}
                  ${UI.sparkline(lab)}
                </button>
                <div class="lab-card-actions">
                  <button class="btn ghost wide" data-lab-code="${lab.code}">Динамика</button>
                  <button class="btn secondary wide" data-assistant-lab-code="${lab.code}">Обсудить с врачом</button>
                  ${LabState.mode === "abnormal" ? `<button class="btn primary wide lab-book-btn" data-book-lab-code="${lab.code}">Записаться</button>` : ""}
                </div>
              </article>
            `).join("") || UI.renderEmpty(LabState.mode === "abnormal" && !hasModeData ? "Сейчас нет показателей, требующих внимания. Последние значения находятся в обычном диапазоне." : "Ничего не найдено.")}
          </div>
        </div>
      </div>

      <div class="card lab-detail" id="labChartAnchor">
        ${LabState.mode !== "reports" && !hasDisplayLabs ? `
          <div class="interpretation soft">
            <b>${LabState.mode === "abnormal" && !hasModeData ? "Сейчас нет показателей, требующих внимания" : hasPatientLabs ? "Ничего не найдено" : "Лабораторных результатов пока нет"}</b>
            <p class="muted">${LabState.mode === "abnormal" && !hasModeData ? "Последние значения находятся в обычном диапазоне." : hasPatientLabs ? "Попробуйте изменить поиск или режим просмотра." : "Когда появятся результаты пациента, здесь будет динамика по его показателям."}</p>
          </div>
        ` : LabState.mode === "reports" && selectedReport ? `
          <div class="detail-head">
            <div>
              <div class="label">Исследование</div>
              <h2>${selectedReport.name}</h2>
              <p class="muted">${selectedReport.date} • ${reportStatusText(selectedReport.status)}</p>
            </div>
            <div>
              <div class="detail-value">${selectedReport.testCount}</div>
              <span class="status ${selectedReport.abnormalCount ? "warn" : "ok"}">${reportAttentionText(selectedReport.abnormalCount)}</span>
            </div>
          </div>

          <div class="detail-actions">
            <button class="btn secondary" data-report-pdf-id="${selectedReport.id}" data-report-pdf-name="${selectedReport.name}">Скачать PDF</button>
          </div>

          <div class="report-patient-summary ${selectedReport.abnormalCount ? "warn" : "ok"}">
            <b>${selectedReport.abnormalCount ? "Есть показатели для обсуждения" : "Показатели выглядят спокойно"}</b>
            <p class="muted">${selectedReport.abnormalCount
              ? `В этом исследовании ${reportAttentionText(selectedReport.abnormalCount)}. Рекомендуется обсудить результат с врачом и посмотреть динамику.`
              : "В этом исследовании показатели находятся в обычном диапазоне. Продолжайте наблюдать динамику по плану врача."}</p>
          </div>

          <div class="report-summary-strip">
            <div><span class="label">Показателей</span><b>${selectedReport.testCount}</b></div>
            <div><span class="label">Внимание</span><b>${selectedReport.abnormalCount}</b></div>
            <div><span class="label">Статус отчета</span><b>${reportStatusText(selectedReport.status)}</b></div>
          </div>

          <div class="report-observation-grid">
            ${selectedReport.observations.map(row => UI.labIndicatorCard({
              code: row.code,
              name: row.name,
              group: "Показатель исследования",
              latestDate: selectedReport.date,
              latestValue: row.value,
              unit: row.unit,
              low: row.low,
              high: row.high,
              flag: row.mappingStatus === "unmapped" ? "warn" : row.flag,
              history: []
            }, {
              action: `<button class="btn ghost wide" data-lab-code="${row.code}">Динамика</button>${row.sourceTestCode ? `<details class="technical-details"><summary>Технические данные</summary><small>Код источника: ${row.sourceTestCode}</small></details>` : ""}`
            })).join("")}
          </div>
        ` : selected && LabState.mode !== "reports" ? `
        <div class="detail-head">
          <div>
            <div class="label">${selected.group}</div>
            <h2 class="detail-title-with-action">${selected.name} ${favoriteButton(selected.code, favoriteCodes, "detail")}</h2>
            <p class="muted">Последнее значение: ${selected.latestDate}</p>
          </div>
          <div>
            <div class="detail-value">${UI.labValue(selected)}</div>
            <span class="status ${UI.statusClass(selected.flag)}">${patientStatusText(selected.flag)}</span>
          </div>
        </div>

        <div class="interpretation">
          <b>Пациентское пояснение</b>
          <p class="muted">${selected.interpretation}</p>
          ${UI.referenceRangeBar(selected)}
        </div>

        <div class="grid-2 lab-context-grid">
          <div class="interpretation soft">
            <b>Пояснение по правилам</b>
            <p class="muted">Этот экран не делает новый AI-запрос: здесь показаны проверенные правила по референсу, динамике и дате результата. Для свободного вопроса откройте показатель в помощнике.</p>
          </div>
          <div class="interpretation soft">
            <b>Что нужно для полноценной интерпретации</b>
            <p class="muted">${(selected.interpretationRequirements || []).join("; ")}.</p>
          </div>
        </div>

        <div class="tile-grid">
          <div class="tile"><span class="label">Референс</span><b>${selected.low}–${selected.high} ${selected.unit}</b></div>
          <div class="tile"><span class="label">Последнее значение</span><b>${UI.labValue(selected)}</b></div>
        </div>

        <details class="technical-details">
          <summary>Технические данные</summary>
          <div class="technical-details-grid">
            <span>Код показателя</span><b>${selected.code || "не указан"}</b>
            <span>LOINC</span><b>${selected.loinc || "не указан"}</b>
          </div>
        </details>

        ${LabState.mode === "abnormal" ? `
          <div class="detail-actions">
            <button class="btn primary" data-book-lab-code="${selected.code}">Записаться</button>
            <button class="btn secondary" id="openSelectedChart">Динамика</button>
          </div>
        ` : ""}
        ${LabState.mode === "tests" ? `
        <canvas id="labChart" class="chart"></canvas>

        <div class="history-panel">
          <div>
            <div class="label">Динамика выбранного показателя</div>
            <h3>${selected.name}</h3>
          </div>
          <div class="history-card-list">
            ${selectedHistory.map(row => `
              <article class="history-value-card">
                <div>
                  <b>${row.date}</b>
                  <p class="muted">${patientStatusText(row.flag)}</p>
                </div>
                <strong>${row.value} ${selected.unit}</strong>
                ${UI.referenceRangeBar({ ...selected, latestValue: row.value, flag: row.flag })}
              </article>
            `).join("")}
          </div>
        </div>
        ` : ""}
        ` : `
          <div class="interpretation soft">
            <b>${LabState.mode === "reports" ? "Ничего не найдено" : "Лабораторных результатов пока нет"}</b>
            <p class="muted">${LabState.mode === "reports" ? "Попробуйте изменить поиск или выбрать другую вкладку." : "Справочник подключен, но в пациентском кабинете будут показаны только реальные результаты пациента."}</p>
          </div>
        `}
      </div>
    </section>
  `;

  document.querySelectorAll("[data-lab-mode]").forEach(btn => btn.onclick = () => {
    LabState.mode = btn.dataset.labMode;
    window.App.render();
  });

  document.querySelectorAll("[data-lab-group]").forEach(btn => btn.onclick = () => {
    LabState.group = btn.dataset.labGroup;
    window.App.render();
  });

  document.querySelectorAll("[data-lab-code]").forEach(btn => btn.onclick = () => {
    LabState.selectedCode = btn.dataset.labCode;
    if (LabState.mode !== "abnormal") LabState.mode = "tests";
    window.App.render();
  });

  document.querySelectorAll("[data-book-lab-code]").forEach(btn => btn.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const lab = data.labs.find(item => item.code === btn.dataset.bookLabCode);
    if (!lab) return;
    const context = createBookingContext(lab);
    window.BookingState = window.BookingState || {};
    BookingState.resultContext = context;
    BookingState.specialtyId = context.specialtyId;
    BookingState.doctorId = "";
    window.App.navigate("appointments");
  });

  document.querySelectorAll("[data-assistant-lab-code]").forEach(btn => btn.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const lab = data.labs.find(item => item.code === btn.dataset.assistantLabCode);
    if (!lab) return;
    window.AssistantState = window.AssistantState || { context: null, messages: [] };
    AssistantState.mode = "result_explanation";
    AssistantState.context = createBookingContext(lab);
    AssistantState.messages = [];
    window.App.navigate("assistant");
  });

  document.querySelectorAll("[data-favorite-code]").forEach(star => star.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavoriteLab(star.dataset.favoriteCode);
    UI.toast(isFavoriteLab(star.dataset.favoriteCode) ? "Добавлено на главную" : "Убрано с главной");
    window.App.render();
  });

  document.querySelectorAll("[data-report-id]").forEach(btn => btn.onclick = () => {
    LabState.selectedReportId = btn.dataset.reportId;
    window.App.render();
  });

  document.querySelectorAll("[data-report-pdf-id]").forEach(btn => btn.onclick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await downloadLabReportPdf(btn.dataset.reportPdfId, btn.dataset.reportPdfName);
  });

  document.getElementById("labSearch").oninput = (e) => {
    LabState.query = e.target.value;
    window.App.render();
  };

  document.getElementById("labSort").onchange = (e) => {
    LabState.sort = e.target.value;
    window.App.render();
  };

  document.getElementById("scrollToChart").onclick = () => {
    LabState.mode = "tests";
    document.getElementById("labChartAnchor").scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openSelectedChart = document.getElementById("openSelectedChart");
  if (openSelectedChart) {
    openSelectedChart.onclick = () => {
      LabState.mode = "tests";
      window.App.render();
    };
  }

  if (LabState.mode === "tests" && selected) {
    setTimeout(() => Charts.drawLabChart(document.getElementById("labChart"), selected), 20);
  }

  requestAnimationFrame(syncLabListHeight);
};

function parseRuDate(date) {
  const [day, month, year] = date.split(".").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function historyValueText(row) {
  return `${row.value ?? ""}${row.unit ? " " + row.unit : ""}`.trim() || "значение уточняется";
}

function historyReferenceText(row) {
  const hasLow = row.low !== undefined && row.low !== null && row.low !== "";
  const hasHigh = row.high !== undefined && row.high !== null && row.high !== "";
  if (!hasLow && !hasHigh) return "референс уточняется";
  if (hasLow && hasHigh) return `${row.low}-${row.high}${row.unit ? " " + row.unit : ""}`;
  if (hasLow) return `от ${row.low}${row.unit ? " " + row.unit : ""}`;
  return `до ${row.high}${row.unit ? " " + row.unit : ""}`;
}

function historyDateGroups(items) {
  return uniqueSorted(items.map(row => row.group)).slice(0, 4).join(" · ");
}

function historySearchText(row) {
  return `${row.name || ""} ${row.code || ""} ${row.loinc || ""} ${row.group || ""} ${row.date || ""}`.toLowerCase();
}

window.Pages["lab-history"] = async function renderLabHistory() {
  const rows = await HealthAPI.labHistory();
  const query = (LabHistoryState.query || "").trim().toLowerCase();
  const filteredRows = query ? rows.filter(row => historySearchText(row).includes(query)) : rows;
  const byDate = filteredRows.reduce((acc, row) => {
    acc[row.date] = acc[row.date] || [];
    acc[row.date].push(row);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort((a, b) => parseRuDate(b) - parseRuDate(a));
  const totalAttention = rows.filter(row => row.flag !== "normal").length;
  const uniqueTests = new Set(rows.map(row => row.code)).size;
  const favoriteCodes = getFavoriteLabCodes();

  UI.root().innerHTML = `
    <section class="history-feed">
      <div class="feed-card history-hero-card">
        <div>
          <div class="label">История анализов</div>
          <h2>Все значения</h2>
          <p class="muted">Ищите показатель по названию, группе, коду или дате. Основной вид компактный, чтобы история оставалась рабочей при большом количестве результатов.</p>
        </div>
        <div class="history-stat-strip">
          <div><span class="label">Дат</span><b>${dates.length}</b></div>
          <div><span class="label">Показателей</span><b>${uniqueTests}</b></div>
          <div><span class="label">Внимание</span><b>${totalAttention}</b></div>
        </div>
      </div>

      <div class="history-toolbar feed-card">
        <input id="historySearch" placeholder="Найти: глюкоза, липиды, GLU, 21.04" value="${LabHistoryState.query || ""}" autocomplete="off">
        <div class="segmented-control history-view-toggle">
          <button class="${LabHistoryState.view === "table" ? "active" : ""}" data-history-view="table">Таблица</button>
          <button class="${LabHistoryState.view === "dates" ? "active" : ""}" data-history-view="dates">По датам</button>
        </div>
      </div>

      ${LabHistoryState.view === "dates" ? `
        <div class="history-date-list">
          ${dates.map(date => {
            const items = byDate[date];
            const attention = items.filter(row => row.flag !== "normal").length;
            return `
              <article class="history-date-card">
                <div class="history-date-head">
                  <div>
                    <span class="label">${date}</span>
                    <h3>${items.length} ${pluralRu(items.length, "показатель", "показателя", "показателей")}</h3>
                    <p class="muted">${historyDateGroups(items)}</p>
                  </div>
                  <span class="status ${attention ? "warn" : "ok"}">${attention ? `${attention} для обсуждения` : "В обычном диапазоне"}</span>
                </div>
                <div class="history-card-list compact">
                  ${items.map(row => `
                    <article class="history-value-card ${UI.statusClass(row.flag)}">
                      <div class="history-value-main">
                        <b>${row.name}</b>
                        <p class="muted">${row.group}</p>
                      </div>
                      <div class="history-value-measure">
                        <span class="label">Значение</span>
                        <strong>${historyValueText(row)}</strong>
                      </div>
                      <div class="history-reference-card">
                        <span class="label">Референс</span>
                        <b>${historyReferenceText(row)}</b>
                      </div>
                      <span class="status ${UI.statusClass(row.flag)}">${patientStatusText(row.flag)}</span>
                      <div class="history-row-actions">
                        ${favoriteButton(row.code, favoriteCodes)}
                        <button class="btn ghost small" data-history-chart-code="${row.code}">Динамика</button>
                      </div>
                    </article>
                  `).join("")}
                </div>
              </article>
            `;
          }).join("") || UI.renderEmpty("Ничего не найдено.")}
        </div>
      ` : `
        <div class="history-table-card feed-card">
          <div class="history-table-grid" role="table" aria-label="История лабораторных показателей">
            <div class="history-table-row history-table-head" role="row">
              <span>Дата</span>
              <span>Группа</span>
              <span>Показатель</span>
              <span>Значение</span>
              <span>Референс</span>
              <span>Статус</span>
              <span></span>
            </div>
            ${filteredRows.map(row => `
              <article class="history-table-row ${UI.statusClass(row.flag)}" role="row">
                <div class="history-table-date" role="cell"><span class="mobile-label">Дата</span><b>${row.date}</b></div>
                <div role="cell"><span class="mobile-label">Группа</span>${row.group || "Показатель"}</div>
                <div class="history-table-name" role="cell">
                  <span class="mobile-label">Показатель</span>
                  <b>${row.name}</b>
                  <details class="technical-details compact"><summary>Технические данные</summary><small>Код: ${row.code || "не указан"}${row.loinc ? ` · LOINC: ${row.loinc}` : ""}</small></details>
                </div>
                <div role="cell"><span class="mobile-label">Значение</span><strong>${historyValueText(row)}</strong></div>
                <div role="cell"><span class="mobile-label">Референс</span>${historyReferenceText(row)}</div>
                <div role="cell"><span class="mobile-label">Статус</span><span class="status ${UI.statusClass(row.flag)}">${patientStatusText(row.flag)}</span></div>
                <div class="history-row-actions" role="cell">
                  ${favoriteButton(row.code, favoriteCodes)}
                  <button class="btn ghost small" data-history-chart-code="${row.code}">Динамика</button>
                </div>
              </article>
            `).join("") || UI.renderEmpty("Ничего не найдено.")}
          </div>
        </div>
      `}
    </section>
  `;

  const historySearch = document.getElementById("historySearch");
  if (historySearch) {
    historySearch.oninput = (event) => {
      LabHistoryState.query = event.target.value;
      window.App.render();
    };
  }

  document.querySelectorAll("[data-history-view]").forEach(btn => btn.onclick = () => {
    LabHistoryState.view = btn.dataset.historyView;
    window.App.render();
  });

  document.querySelectorAll("[data-history-chart-code]").forEach(btn => btn.onclick = () => {
    LabState.mode = "tests";
    LabState.group = "Все";
    LabState.selectedCode = btn.dataset.historyChartCode;
    window.App.navigate("labs");
  });

  document.querySelectorAll("[data-favorite-code]").forEach(star => star.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavoriteLab(star.dataset.favoriteCode);
    UI.toast(isFavoriteLab(star.dataset.favoriteCode) ? "Добавлено на главную" : "Убрано с главной");
    window.App.render();
  });
};
