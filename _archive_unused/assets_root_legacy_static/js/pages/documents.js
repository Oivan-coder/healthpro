window.Pages = window.Pages || {};

window.Pages.reports = async function renderReports() {
  const data = await HealthAPI.reports();

  UI.root().innerHTML = `
    <section class="content-grid">
      <div class="card">
        <div class="label">Заключения</div>
        <h2>Врачебные рекомендации</h2>
        <div class="grid-2">
          ${data.reports.map(r => `
            <article class="card flat">
              <span class="status ${r.status==="Новое" ? "info" : "ok"}">${r.status}</span>
              <h3>${r.title}</h3>
              <p class="muted">${r.date}</p>
              <p><b>${r.doctor}</b></p>
              <p class="muted">${r.text}</p>
              <button class="btn secondary">Открыть</button>
            </article>
          `).join("")}
        </div>
      </div>

      <aside class="card">
        <div class="label">Файлы</div>
        <h2>Документы</h2>
        <div class="list">
          ${data.docs.map(d => `
            <div class="row-card">
              <div class="icon-bubble">${d.icon}</div>
              <div>
                <b>${d.title}</b>
                <div class="muted">${d.date}</div>
              </div>
              <span class="pill">${d.type}</span>
            </div>
          `).join("")}
        </div>
      </aside>
    </section>
  `;
};
