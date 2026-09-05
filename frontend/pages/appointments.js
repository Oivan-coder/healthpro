window.Pages = window.Pages || {};

window.BookingState = window.BookingState || {
  specialtyId: "therapy",
  doctorId: "doc_1",
  date: "26.04",
  slot: "11:30"
};

function markDemoNavigation(route) {
  document.querySelectorAll(`[data-route="${route}"]`).forEach((link) => {
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
}

function renderDemoUnavailable(sectionName, description) {
  UI.root().innerHTML = `
    <section class="feed-card" style="max-width:820px;margin:0 auto;padding:32px">
      <div class="label">Закрытый демо-контур</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0 10px">
        <h2 style="margin:0">${sectionName}</h2>
        <span class="status warn">Демо-функция</span>
      </div>
      <p class="muted" style="font-size:17px;max-width:680px">${description}</p>
      <div class="interpretation soft" style="margin-top:20px">
        <b>Раздел временно недоступен</b>
        <p class="muted" style="margin-bottom:0">В текущем тестовом контуре мы проверяем лабораторные результаты, историю, динамику и помощника. Этот модуль будет подключён на следующем этапе.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">
        <button class="btn primary" data-route-action="labs">К анализам</button>
        <button class="btn ghost" data-route-action="dashboard">На главную</button>
      </div>
    </section>
  `;
}

markDemoNavigation("appointments");
markDemoNavigation("visits");

window.Pages.appointments = async function renderAppointments() {
  renderDemoUnavailable(
    "Запись к врачу",
    "Онлайн-запись к специалистам показана в интерфейсе как направление развития продукта, но в закрытом демо-контуре не подключена к реальному расписанию медицинской организации."
  );
};

window.Pages.visits = async function renderVisits() {
  renderDemoUnavailable(
    "Врачи и приёмы",
    "Раздел врачей и приёмов пока не связан с медицинской информационной системой и не содержит реального расписания или врачебных событий."
  );
};
