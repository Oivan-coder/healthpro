window.Pages = window.Pages || {};

window.Pages.dashboard = async function renderDashboard() {
  const data = await HealthAPI.summary();
  const normalCount = data.labs.filter(x => x.flag === "normal").length;
  const abnormalCount = data.abnormal.length;

  UI.root().innerHTML = `
    <section class="hero-summary">
      <div class="label">Пилотный пациентский кабинет</div>
      <h2>${abnormalCount ? "Есть показатели вне референса" : "Все последние показатели в норме"}</h2>
      <p>${abnormalCount ? `Внимания требуют: ${data.abnormal.slice(0,4).map(x => x.name).join(", ")}. Критических значений в демо-данных нет.` : "По последним данным отклонений не выявлено."}</p>
      <div class="summary-actions">
        <button class="btn primary" data-route-action="labs">Открыть лабораторию</button>
        <button class="btn secondary" data-route-action="appointments">Записаться к врачу</button>
      </div>
    </section>

    <section class="metric-strip">
      <div class="card metric-card"><div class="label">В норме</div><div class="kpi-number">${normalCount}</div><p class="muted">показателей</p></div>
      <div class="card metric-card"><div class="label">Внимание</div><div class="kpi-number">${abnormalCount}</div><p class="muted">выше/ниже референса</p></div>
      <div class="card metric-card"><div class="label">Пилот</div><div class="kpi-number">${data.meta.pilotScope.patients}</div><p class="muted">пациентов</p></div>
      <div class="card metric-card"><div class="label">Контур</div><div class="kpi-number">1</div><p class="muted">МИС/ЛИС</p></div>
    </section>

    <section class="content-grid">
      <div class="card">
        <div class="label">Лента событий</div>
        <h2>Что произошло</h2>
        <div class="list">
          ${data.events.map(item => `
            <div class="row-card">
              <div class="icon-bubble ${UI.iconClass(item.level)}">${item.icon}</div>
              <div>
                <b>${item.title}</b>
                <div class="muted">${item.text}</div>
                <small class="muted">${item.date}</small>
              </div>
              <span class="status ${UI.statusClass(item.level)}">${item.kind}</span>
            </div>
          `).join("")}
        </div>
      </div>

      <aside class="list">
        <div class="card">
          <div class="label">Последние анализы</div>
          <h2>Лаборатория</h2>
          <div class="list">
            ${data.labs.slice(0,6).map(lab => `
              <div class="row-card">
                <div class="icon-bubble ${lab.flag === "normal" ? "ok" : "warn"}">◌</div>
                <div>
                  <b>${lab.name}</b>
                  <div class="muted">${lab.latestDate} • ${lab.group}</div>
                </div>
                <span class="status ${UI.statusClass(lab.flag)}">${UI.labValue(lab)}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="card">
          <div class="label">Ближайший прием</div>
          <h2>${data.visits[0].specialty}</h2>
          <p><b>${data.visits[0].doctor}</b></p>
          <p class="muted">${data.visits[0].date}, ${data.visits[0].time} • каб. ${data.visits[0].room}</p>
          <button class="btn secondary wide" data-route-action="appointments">Изменить / записаться</button>
        </div>
      </aside>
    </section>
  `;
};
