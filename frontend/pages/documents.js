window.Pages = window.Pages || {};

(function markDocumentsDemoNavigation() {
  document.querySelectorAll('[data-route="reports"]').forEach((link) => {
    link.classList.add("demo-only-nav");
    if (!link.querySelector(".demo-nav-badge")) {
      const badge = document.createElement("span");
      badge.className = "demo-nav-badge";
      badge.textContent = "Демо";
      badge.style.marginLeft = "auto";
      badge.style.padding = "2px 7px";
      badge.style.borderRadius = "999px";
      badge.style.fontSize = "10px";
      badge.style.fontWeight = "700";
      badge.style.lineHeight = "1.4";
      badge.style.color = "#805515";
      badge.style.background = "#fbf1e0";
      link.appendChild(badge);
    }
  });
})();

window.Pages.reports = async function renderReports() {
  UI.root().innerHTML = `
    <section class="feed-card" style="max-width:820px;margin:0 auto;padding:32px">
      <div class="label">Закрытый демо-контур</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0 10px">
        <h2 style="margin:0">Документы</h2>
        <span class="status warn">Демо-функция</span>
      </div>
      <p class="muted" style="font-size:17px;max-width:680px">Медицинские документы, заключения и PDF пока не загружаются из реальной МИС/ЛИС.</p>
      <div class="interpretation soft" style="margin-top:20px">
        <b>Раздел временно недоступен</b>
        <p class="muted" style="margin-bottom:0">В текущей версии тестируется лабораторный контур: результаты, история, динамика, графики и помощник. Документы будут подключены отдельно.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">
        <button class="btn primary" data-route-action="labs">К анализам</button>
        <button class="btn ghost" data-route-action="dashboard">На главную</button>
      </div>
    </section>
  `;
};
