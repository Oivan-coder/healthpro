
window.Pages = window.Pages || {};
function markDemoNavigation(route) {
  document.querySelectorAll(`[data-route="${route}"]`).forEach(link => {
    link.classList.add("demo-only-nav");
    if (!link.querySelector(".demo-nav-badge")) {
      const badge = document.createElement("span");
      badge.className = "demo-nav-badge"; badge.textContent = "Демо"; link.append(badge);
    }
  });
}
function renderDemoUnavailable(title, description) {
  UI.root().innerHTML = `<section class="cabinet-page demo-placeholder">
    <span class="demo-module-icon" aria-hidden="true">＋</span>
    <span class="eyebrow">Модуль в разработке</span>
    <h2>${Cabinet.escape(title)}</h2>
    <p>${Cabinet.escape(description)}</p>
    <p class="section-note">Модуль предусмотрен, но временно недоступен в закрытом демо-контуре. Анализы, история и профиль работают.</p>
    <button class="btn primary" data-route-action="labs" data-lab-mode="reports">Вернуться к анализам</button>
  </section>`;
}
["appointments","visits","reports"].forEach(markDemoNavigation);
Pages.appointments = async () => renderDemoUnavailable("Запись к врачу","Здесь можно будет выбрать специалиста и удобное время. Расписание клиники пока не подключено.");
Pages.visits = async () => renderDemoUnavailable("Врачи","Здесь будут специалисты и сведения о приёмах. Данные клиники пока не подключены.");
