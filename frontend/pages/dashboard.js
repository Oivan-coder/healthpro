window.Pages = window.Pages || {};

window.DashboardState = window.DashboardState || {
  editingTrends: false,
  trendQuery: ""
};

const DASHBOARD_FAVORITE_LABS_KEY = "healthId.favoriteLabCodes";

function getDashboardTrendCodes(labs) {
  const savedState = PatientStorage.getPatientState(DASHBOARD_FAVORITE_LABS_KEY, []);
  const saved = Array.isArray(savedState) ? savedState : [];
  const available = new Set(labs.map(lab => lab.code));
  return saved.filter(code => available.has(code)).slice(0, 3);
}

function getDashboardFavoriteLabs(labs) {
  return getDashboardTrendCodes(labs)
    .map(code => labs.find(lab => lab.code === code))
    .filter(Boolean)
    .slice(0, 3);
}

function patientLabStatusText(count) {
  return count
    ? "Есть что обсудить"
    : "В обычном диапазоне";
}

function dashboardNumber(value) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function hasReferenceRange(lab) {
  const low = dashboardNumber(lab.low);
  const high = dashboardNumber(lab.high);
  return low !== null && high !== null && high > low;
}

function dashboardStatusShort(flag) {
  if (flag === "high") return "выше обычного диапазона";
  if (flag === "low") return "ниже обычного диапазона";
  if (flag === "normal") return "в обычном диапазоне";
  return "нет референса";
}

function dashboardStatusClass(flag) {
  if (flag === "normal") return "ok";
  if (flag === "high" || flag === "low") return "warn";
  return "info";
}

function latestReportDate(reports) {
  return reports[0]?.date || "дата уточняется";
}

function reportBadge(report) {
  const text = String(report.name || report.serviceCode || "").toLowerCase();
  if (text.includes("биох")) return "БХ";
  if (text.includes("восп")) return "В";
  if (text.includes("липид") || text.includes("холест")) return "ЛП";
  if (text.includes("горм")) return "Г";
  const words = String(report.name || "И").split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
}

function reportAttentionItems(report, labs) {
  const observations = Array.isArray(report.observations) ? report.observations : [];
  let items = observations.filter(item => item.flag && item.flag !== "normal");
  if (!items.length) {
    const reportName = String(report.name || "").toLowerCase();
    items = labs.filter((lab) => {
      if (lab.flag === "normal") return false;
      if (report.date && lab.latestDate && lab.latestDate !== report.date) return false;
      const group = String(lab.group || "").toLowerCase();
      return reportName.includes(group) || group.includes(reportName) || reportName.includes("биох") && group.includes("биох");
    });
  }
  return items.slice(0, 3).map(item => `${item.name}${item.flag === "low" ? " ↓" : " ↑"}`);
}

function getDashboardTrendLabs(labs) {
  return getDashboardFavoriteLabs(labs)
    .filter(lab => Array.isArray(lab.history) && lab.history.length > 1)
    .filter(hasReferenceRange)
    .slice(0, 3);
}

function noReferenceTrendLabs(labs) {
  return getDashboardFavoriteLabs(labs)
    .filter(lab => Array.isArray(lab.history) && lab.history.length > 1 && !hasReferenceRange(lab))
    .slice(0, 3);
}

function latestEventItems(events) {
  return [...(events || [])]
    .filter(event => !["sync", "api", "system"].includes(event.kind))
    .slice(0, 4);
}

window.Pages.dashboard = async function renderDashboard() {
  const data = await HealthAPI.summary();
  const reports = await HealthAPI.getLabReports();
  const patient = data.patient;
  const firstName = UI.firstName(patient);
  const abnormalCount = data.abnormal.length;
  const nextVisit = data.nextVisit || data.visits[0];
  const latestReports = reports.slice(0, 3);
  const patientEvents = latestEventItems(data.events);
  const favoriteLabs = getDashboardFavoriteLabs(data.labs);
  const trendLabs = getDashboardTrendLabs(data.labs);
  const skippedTrendLabs = noReferenceTrendLabs(data.labs);
  const insufficientHistoryLabs = favoriteLabs.filter(lab => !Array.isArray(lab.history) || lab.history.length < 2);
  const focusLabs = data.labs.filter(lab => lab.flag !== "normal").slice(0, 4);
  const documentsCount = (data.documents || []).length + (data.reports || []).length;
  const newResultsDate = latestReportDate(latestReports);

  UI.root().innerHTML = `
    <section class="health-feed">
      <section class="health-hero dashboard-hero-v2">
        <div class="hero-copy">
          <div class="label">Сегодня</div>
          <h2>${firstName}, результаты обновлены</h2>
          <p>Есть ${abnormalCount} ${pluralRu(abnormalCount, "показатель", "показателя", "показателей")}, которые стоит обсудить с врачом. Это не диагноз — посмотрите динамику и подготовьте вопросы к приему.</p>
          <div class="hero-facts">
            <span class="status ${abnormalCount ? "warn" : "ok"}">${abnormalCount ? UI.attentionText(abnormalCount) : "Показатели в обычном диапазоне"}</span>
            <span>${newResultsDate}</span>
          </div>
          <div class="summary-actions quick-actions">
            <button class="btn primary" data-route-action="labs" data-lab-mode="${abnormalCount ? "abnormal" : "reports"}">Посмотреть анализы</button>
            <button class="btn secondary" data-route-action="appointments">Обсудить с врачом</button>
            <button class="btn ghost" data-route-action="reports">Документы</button>
          </div>
        </div>
        <div class="today-card hero-next-card">
          <span class="label">Следующий шаг</span>
          <b>${nextVisit ? `${nextVisit.specialty}, ${nextVisit.date}` : "Выбрать врача"}</b>
          <p>${nextVisit ? "Подготовьте вопросы по показателям внимания." : "Можно обсудить результаты и динамику."}</p>
        </div>
      </section>

      <section class="feed-card dashboard-trend-panel">
        <div class="section-head">
          <div>
            <div class="label">Избранная динамика</div>
            <h2>${favoriteLabs.length ? "Ваши показатели" : "Пока нет избранных показателей"}</h2>
            <p class="muted">Избранные показатели отображаются сразу. График динамики строится после появления как минимум двух результатов.</p>
          </div>
          <button class="btn ghost" data-route-action="labs" data-lab-mode="tests">Выбрать показатели</button>
        </div>
        ${favoriteLabs.length ? `
          ${trendLabs.length ? `
            <div class="dashboard-trend-layout">
              <div class="dashboard-chart-shell">
                <canvas id="dashboardTrendChart" class="dashboard-chart dashboard-chart-large"></canvas>
              </div>
              <div class="normalized-trend-legend">
                ${favoriteLabs.map((lab, index) => `
                  <div>
                    <i style="background:${Charts.palette(index)}"></i>
                    <b>${lab.name}</b>
                    <span>последнее: ${lab.latestValue} ${lab.unit || ""}</span>
                    <small class="status ${dashboardStatusClass(lab.flag)}">${dashboardStatusShort(lab.flag)}</small>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : `
            <div class="normalized-trend-legend">
              ${favoriteLabs.map((lab, index) => `
                <div>
                  <i style="background:${Charts.palette(index)}"></i>
                  <b>${lab.name}</b>
                  <span>последнее: ${lab.latestValue} ${lab.unit || ""}</span>
                  <small class="status ${dashboardStatusClass(lab.flag)}">${dashboardStatusShort(lab.flag)}</small>
                </div>
              `).join("")}
            </div>
            <div class="empty-trend empty-trend-large" style="margin-top:14px">
              <b>Пока недостаточно данных для графика</b>
              <p>Показатели уже сохранены в избранном. После следующего результата здесь автоматически появится динамика.</p>
            </div>
          `}
          ${insufficientHistoryLabs.length ? `<p class="trend-note">Для ${insufficientHistoryLabs.length} ${pluralRu(insufficientHistoryLabs.length, "показателя", "показателей", "показателей")} пока есть только одно значение.</p>` : ""}
          ${skippedTrendLabs.length ? `<p class="trend-note">Для части показателей нет референсного диапазона, поэтому они не показаны на общем графике.</p>` : ""}
        ` : `
          <div class="empty-trend empty-trend-large">
            <b>Добавьте показатели в избранное</b>
            <p>Добавьте показатели в избранное в разделе Анализы, чтобы видеть их здесь.</p>
            <button class="btn primary" data-route-action="labs" data-lab-mode="tests">К анализам</button>
          </div>
        `}
      </section>

      <section class="feed-card dashboard-attention-panel">
        <div class="section-head">
          <div>
            <div class="label">Показатели внимания</div>
            <h2>${focusLabs.length ? "Что стоит обсудить" : "Все в обычном диапазоне"}</h2>
          </div>
          <button class="btn ghost" data-route-action="labs" data-lab-mode="abnormal">Открыть список</button>
        </div>
        <div class="dashboard-attention-list">
          ${focusLabs.map(lab => `
            <article class="attention-compact-card ${dashboardStatusClass(lab.flag)}">
              <div>
                <b>${lab.name}</b>
                <span>${lab.latestValue} ${lab.unit || ""} · ${dashboardStatusShort(lab.flag)}</span>
              </div>
              <button class="btn secondary small" data-book-lab-code="${lab.code}">Обсудить с врачом</button>
            </article>
          `).join("") || `<p class="muted">Последние значения находятся в обычном диапазоне.</p>`}
        </div>
      </section>

      <section class="feed-card dashboard-results-panel">
        <div class="section-head">
          <div>
            <div class="label">Новые результаты</div>
            <h2>Исследования готовы</h2>
            <p class="muted">${latestReports.length} исследования от ${newResultsDate}</p>
          </div>
          <button class="btn ghost" data-route-action="labs" data-lab-mode="reports">Все анализы</button>
        </div>
        <div class="ready-report-list">
          ${latestReports.map((report) => {
            const attention = reportAttentionItems(report, data.labs);
            const attentionCount = report.abnormalCount || attention.length || 0;
            return `
              <article class="ready-report-row">
                <div class="report-token">${reportBadge(report)}</div>
                <div class="ready-report-main">
                  <h3>${report.name}</h3>
                  <p>${report.date} · результат готов</p>
                  <small>${attention.length ? attention.join(", ") : "Показатели в обычном диапазоне"}</small>
                </div>
                <div class="ready-report-metrics">
                  <span><b>${report.testCount || 0}</b><small>показателей</small></span>
                  <span><b>${attentionCount}</b><small>внимания</small></span>
                </div>
                <button class="btn secondary small" data-route-action="labs" data-lab-mode="reports">Открыть исследование</button>
              </article>
            `;
          }).join("") || UI.renderEmpty("Пока нет лабораторных отчетов.")}
        </div>
      </section>

      <section class="next-step-events-row">
        <aside class="next-step-card next-step-combined">
          <div class="label">Следующий шаг</div>
          <h2>${nextVisit ? "Обсудить показатели" : "Выбрать врача"}</h2>
          <p>${nextVisit
            ? `${nextVisit.specialty}: ${nextVisit.doctor}. Можно заранее подготовить вопросы по показателям, которые требуют внимания.`
            : "Запишитесь к врачу, чтобы обсудить результаты и динамику."}</p>
          ${nextVisit ? `<p class="muted">${nextVisit.date}, ${nextVisit.time} • каб. ${nextVisit.room}</p>` : ""}
          <button class="btn primary wide" data-route-action="appointments">${nextVisit ? "Изменить запись" : "Записаться"}</button>
          <div class="embedded-events">
            <div>
              <div class="label">Последние события</div>
              <h2>Что произошло</h2>
            </div>
            <div class="health-timeline compact">
              ${patientEvents.map(event => `
                <div class="timeline-item">
                  <div class="timeline-dot ${UI.iconClass(event.level)}">${event.icon || ""}</div>
                  <div>
                    <b>${event.title}</b>
                    <p class="muted">${event.text}</p>
                    <small>${event.date}</small>
                  </div>
                </div>
              `).join("") || UI.renderEmpty("Новых событий пока нет.")}
            </div>
          </div>
        </aside>
      </section>

    </section>
  `;

  document.querySelectorAll("[data-book-lab-code]").forEach(btn => btn.onclick = (event) => {
    event.preventDefault();
    const lab = data.labs.find(item => item.code === btn.dataset.bookLabCode);
    if (!lab) return;
    window.BookingState = window.BookingState || {};
    BookingState.resultContext = {
      test_code: lab.code,
      test_name: lab.name,
      value: lab.latestValue,
      unit: lab.unit,
      flag: lab.flag,
      report_date: lab.latestDate,
      specialtyId: "therapy",
      suggestedSpecialty: "Терапевт"
    };
    BookingState.specialtyId = "therapy";
    window.App.navigate("appointments");
  });

  if (trendLabs.length) {
    setTimeout(() => Charts.drawDashboardTrendChart(document.getElementById("dashboardTrendChart"), trendLabs), 20);
  }
};
