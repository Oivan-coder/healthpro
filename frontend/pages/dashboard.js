
window.Pages = window.Pages || {};
window.DashboardState = window.DashboardState || {editingTrends:false, trendQuery:""};

window.Pages.dashboard = async function renderDashboard() {
  const [data, reports] = await Promise.all([HealthAPI.summary(), HealthAPI.getLabReports()]);
  const {escape:e, value, status, attention} = Cabinet;
  const labs = data.labs || [];
  const focus = labs.filter(attention);
  const favorites = getFavoriteLabCodes().map(code => labs.find(lab => lab.code === code)).filter(Boolean);
  const latest = [...reports].sort((a,b) => parseRuDate(b.date) - parseRuDate(a.date)).slice(0,3);
  UI.root().innerHTML = `
    <div class="cabinet-page today-page">
      <section class="patient-overview">
        <div><span class="eyebrow">Ваш кабинет</span><h2>${e(UI.firstName(data.patient))}, добрый день</h2>
          <p class="muted">${labs.length ? `${focus.length} ${Cabinet.plural(focus.length,"показатель","показателя","показателей")} внимания · Последний результат: ${e(latest[0]?.date || "—")}` : "Лабораторных результатов пока нет"}</p>
        </div>
        <button class="btn primary" data-route-action="labs" data-lab-mode="reports">Посмотреть анализы</button>
      </section>
      <div class="today-columns">
        <section class="workspace-section">
          <div class="section-heading"><h2>Последние результаты</h2><button class="btn ghost small" data-route-action="labs" data-lab-mode="reports">Все отчёты</button></div>
          <div class="plain-list">${latest.map(report => `
            <button class="report-link" data-open-report="${e(report.id)}">
              <span><span class="item-title">${e(report.name)}</span><small>${e(report.date)} · ${report.testCount || 0} показателей</small></span>
              <span class="result-status ${report.abnormalCount ? "attention" : "normal"}">${report.abnormalCount ? `${report.abnormalCount} внимания` : "Готово"}</span>
            </button>`).join("") || `<p class="empty-copy">Здесь появятся ваши исследования.</p>`}</div>
        </section>
        <section class="workspace-section">
          <div class="section-heading"><h2>Что стоит обсудить</h2><span class="meta-count">${focus.length}</span></div>
          <p class="section-note">Отклонение от референса — не диагноз. Оценить результат поможет врач.</p>
          <div class="plain-list">${focus.slice(0,3).map(lab => `
            <button class="report-link" data-route-action="labs" data-lab-mode="tests" data-lab-code="${e(lab.code)}">
              <span><span class="item-title">${e(lab.name)}</span>${status(lab.flag)}</span><span class="measure">${value(lab)}</span>
            </button>`).join("") || `<p class="empty-copy">${labs.length ? "Показателей внимания нет. Результаты без референса можно посмотреть в анализах." : "Пока нет данных для оценки."}</p>`}</div>
          ${focus.length > 3 ? `<button class="btn ghost small" data-route-action="labs" data-lab-mode="abnormal">Все показатели внимания</button>` : ""}
        </section>
      </div>
      <section class="workspace-section favorite-section">
        <div class="section-heading"><h2>Избранная динамика</h2><button class="btn ghost small" data-route-action="labs" data-lab-mode="tests">Выбрать показатели</button></div>
        <div class="favorite-grid">${favorites.map((lab,index) => {
          const points = (lab.history || []).filter(point => Cabinet.numeric(point.value) !== null);
          return `<article class="favorite-trend"><div class="section-heading"><h3>${e(lab.name)}</h3>${favoriteButton(lab.code,getFavoriteLabCodes())}</div>
            <div class="favorite-value">${value(lab)}</div><p class="section-note">${e(lab.latestDate || "—")} · ${status(lab.flag)}</p>
            ${points.length >= 2 ? `<canvas id="favoriteChart${index}" class="trend-canvas" role="img" aria-label="Динамика ${e(lab.name)}"></canvas><details class="trend-data"><summary>Значения по датам</summary><ul>${points.map(point => `<li>${e(point.date)} — ${e(point.value)} ${e(lab.unit || "")}</li>`).join("")}</ul></details>` : `<p class="empty-copy">${(lab.history || []).length > 1 ? "Для графика нужны два числовых результата." : "Для графика нужен ещё один результат."}</p>`}
          </article>`;
        }).join("") || `<p class="empty-copy">Отметьте звёздочкой до трёх показателей в анализах. Даже одно значение появится здесь сразу.</p>`}</div>
      </section>
      <nav class="quick-links" aria-label="Быстрые действия"><a href="#lab-history" data-route-action="lab-history">История значений →</a><a href="#profile" data-route-action="profile">Мой профиль →</a></nav>
    </div>`;
  UI.root().querySelectorAll("[data-open-report]").forEach(button => button.onclick = () => {
    LabState.mode = "reports"; LabState.group = "Все"; LabState.query = ""; LabState.selectedReportId = button.dataset.openReport;
    App.navigate("labs");
  });
  Cabinet.bindFavorites();
  favorites.forEach((lab,index) => Charts.drawLabChart(document.getElementById(`favoriteChart${index}`),lab));
};
