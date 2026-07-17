window.App = (() => {
  let currentRoute = "dashboard";

  const routeRenderers = {
    dashboard: Pages.dashboard,
    labs: Pages.labs,
    "lab-history": Pages["lab-history"],
    appointments: Pages.appointments,
    visits: Pages.visits,
    reports: Pages.reports,
    import: Pages.import,
    integration: Pages.integration,
    profile: Pages.profile
  };

  function init() {
    HealthStore.init();
    bindLogin();
    bindNavigation();
    bindModals();

    const db = HealthStore.get();
    document.getElementById("patientAvatar").textContent = db.patient.initials;
    document.getElementById("syncTime").textContent = `Синхронизация: ${db.meta.lastSync}`;
  }

  function bindLogin() {
    document.getElementById("loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      HealthStore.update(db => {
        db.patient.phone = document.getElementById("phoneInput").value || db.patient.phone;
        db.patient.misCard = document.getElementById("misCardInput").value || db.patient.misCard;
      });
      document.getElementById("loginView").classList.add("hidden");
      document.getElementById("appView").classList.remove("hidden");
      document.getElementById("bottomNav").style.display = "";
      await render();
    });

    document.getElementById("resetDemoBtn").onclick = async () => {
      await HealthAPI.reset();
      UI.toast("Демо-данные сброшены");
    };
  }

  function bindNavigation() {
    document.querySelectorAll("[data-route]").forEach(btn => {
      btn.addEventListener("click", () => navigate(btn.dataset.route));
    });

    document.body.addEventListener("click", (e) => {
      const action = e.target.closest("[data-route-action]");
      if (action) navigate(action.dataset.routeAction);
    });

    document.getElementById("menuBtn").onclick = () => {
      document.getElementById("sidebar").classList.toggle("open");
    };

    document.getElementById("quickSyncBtn").onclick = () => {
      const db = HealthStore.update(db => {
        db.meta.lastSync = new Date().toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
      });
      document.getElementById("syncTime").textContent = `Синхронизация: ${db.meta.lastSync}`;
      UI.toast("Синхронизация выполнена");
    };

    document.getElementById("openApiModalBtn").onclick = () => UI.openModal("apiModal");
    document.getElementById("goVisitsBtn").onclick = () => {
      UI.closeModals();
      navigate("visits");
    };
  }

  function bindModals() {
    document.getElementById("modalBackdrop").onclick = UI.closeModals;
    document.querySelectorAll("[data-close-modal]").forEach(btn => btn.onclick = UI.closeModals);
  }

  async function navigate(route) {
    currentRoute = route;
    document.querySelectorAll(".nav-link").forEach(x => x.classList.toggle("active", x.dataset.route === route));
    document.querySelectorAll(".bottom-link").forEach(x => x.classList.toggle("active", x.dataset.route === route));
    document.getElementById("sidebar").classList.remove("open");
    await render();
  }

  async function render() {
    UI.setRouteTitle(currentRoute);
    const renderer = routeRenderers[currentRoute] || routeRenderers.dashboard;
    await renderer();
    const db = HealthStore.get();
    document.getElementById("syncTime").textContent = `Синхронизация: ${db.meta.lastSync}`;
  }

  return { init, navigate, render };
})();

document.addEventListener("DOMContentLoaded", App.init);
