window.App = (() => {
  let currentRoute = "dashboard";
  let currentUser = null;
  let renderCorrectionPending = false;

  function routeRenderers() {
    return {
      dashboard: Pages.dashboard,
      labs: Pages.labs,
      "lab-history": Pages["lab-history"],
      appointments: Pages.appointments,
      visits: Pages.visits,
      reports: Pages.reports,
      assistant: Pages.assistant,
      integration: Pages.integration,
      profile: Pages.profile,
      "admin-users": Pages["admin-users"]
    };
  }

  function userRoutes() {
    return new Set(["dashboard", "labs", "lab-history", "appointments", "visits", "reports", "assistant", "profile"]);
  }

  function adminRoutes() {
    return new Set(["admin-users", "integration"]);
  }

  function defaultRoute() {
    return currentUser?.role === "admin" ? "admin-users" : "dashboard";
  }

  function routeAllowed(route) {
    if (!currentUser) return false;
    return currentUser.role === "admin" ? adminRoutes().has(route) : userRoutes().has(route);
  }

  function routeFromHash() {
    return window.location.hash.replace("#", "");
  }

  function setHashForRoute(route) {
    if (window.location.hash !== `#${route}`) window.history.replaceState(null, "", `#${route}`);
  }

  function setLoginHash() {
    if (window.location.hash !== "#login") window.history.replaceState(null, "", "#login");
  }

  function initials(name) {
    const parts = String(name || "АЗ").trim().split(/\s+/).filter(Boolean);
    return (parts.slice(0, 2).map((part) => part[0]).join("") || "АЗ").toUpperCase();
  }

  async function init() {
    bindLogin();
    bindNavigation();
    bindModals();
    bindPasswordChange();

    try {
      const result = await HealthAPI.me();
      await acceptAuthenticatedUser(result.user, { restoreRoute: true });
    } catch (error) {
      showLogin(error.status && error.status !== 401 ? "Сервис временно недоступен" : "");
    }
  }

  function setLoginMode(isLogin) {
    document.body.classList.toggle("is-login", isLogin);
    document.body.classList.toggle("is-app", !isLogin);
    document.getElementById("loginView").classList.toggle("hidden", !isLogin);
    document.getElementById("appView").classList.toggle("hidden", isLogin);
    const showBottomNav = !isLogin && currentUser?.role === "user";
    document.getElementById("bottomNav").style.display = showBottomNav ? "" : "none";
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("open");
    const profileMenu = document.getElementById("profileMenu");
    if (profileMenu) {
      profileMenu.hidden = true;
      profileMenu.classList.remove("show");
    }
  }

  function applyRoleNavigation() {
    const isAdmin = currentUser?.role === "admin";
    document.querySelectorAll("[data-admin-only]").forEach((element) => { element.hidden = !isAdmin; });
    document.querySelectorAll("[data-user-only]").forEach((element) => { element.hidden = isAdmin; });
    document.getElementById("bottomNav").style.display = isAdmin ? "none" : "";
  }

  function updateIdentity() {
    const avatar = document.getElementById("avatarMenuBtn");
    if (avatar) avatar.textContent = initials(currentUser?.displayName);
    const menuUser = document.getElementById("profileMenuUser");
    if (menuUser) menuUser.textContent = currentUser ? `${currentUser.displayName} · ${currentUser.login}` : "";
    PatientStorage.setCurrentPatientId(currentUser?.patientId || "");
  }

  async function acceptAuthenticatedUser(user, options = {}) {
    currentUser = user;
    updateIdentity();
    applyRoleNavigation();
    setLoginMode(false);

    if (currentUser.mustChangePassword) {
      currentRoute = defaultRoute();
      UI.setRouteTitle(currentRoute);
      UI.root().innerHTML = `<section class="card"><div class="label">Безопасность</div><h2>Требуется смена временного пароля</h2><p class="muted">После смены пароля необходимо будет войти заново.</p></section>`;
      openPasswordChangeModal();
      return;
    }

    const requestedRoute = options.restoreRoute ? routeFromHash() : defaultRoute();
    currentRoute = routeAllowed(requestedRoute) && routeRenderers()[requestedRoute] ? requestedRoute : defaultRoute();
    setHashForRoute(currentRoute);
    await render();
  }

  function showLogin(message = "") {
    currentUser = null;
    PatientStorage.clearPatientSessionState();
    setLoginMode(true);
    setLoginHash();
    UI.closeModals();
    const error = document.getElementById("loginError");
    if (error) {
      error.textContent = message || "";
      error.hidden = !message;
    }
  }

  function bindLogin() {
    document.getElementById("loginForm").addEventListener("submit", handleLoginSubmit);
    document.querySelectorAll("[data-legal-modal]").forEach((button) => {
      button.onclick = () => UI.openModal(button.dataset.legalModal);
    });
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    const errorElement = document.getElementById("loginError");
    errorElement.hidden = true;
    const login = document.getElementById("loginInput").value.trim();
    const password = document.getElementById("passwordInput").value;
    if (!login || !password) return;

    try {
      const result = await HealthAPI.login(login, password);
      await acceptAuthenticatedUser(result.user);
    } catch (error) {
      const messages = {
        invalid_credentials: "Неверный логин или пароль.",
        user_blocked: "Учётная запись заблокирована администратором."
      };
      errorElement.textContent = messages[error.code] || "Не удалось выполнить вход.";
      errorElement.hidden = false;
    }
  }

  function openPasswordChangeModal() {
    document.getElementById("passwordChangeError").hidden = true;
    UI.openModal("passwordChangeModal");
    setTimeout(() => document.getElementById("currentPasswordInput")?.focus(), 0);
  }

  function bindPasswordChange() {
    document.getElementById("passwordChangeForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const errorElement = document.getElementById("passwordChangeError");
      errorElement.hidden = true;
      const currentPassword = document.getElementById("currentPasswordInput").value;
      const newPassword = document.getElementById("newPasswordInput").value;
      const confirmation = document.getElementById("newPasswordConfirmInput").value;

      if (newPassword !== confirmation) {
        errorElement.textContent = "Новые пароли не совпадают.";
        errorElement.hidden = false;
        return;
      }

      try {
        await HealthAPI.changePassword(currentPassword, newPassword);
        document.getElementById("currentPasswordInput").value = "";
        document.getElementById("newPasswordInput").value = "";
        document.getElementById("newPasswordConfirmInput").value = "";
        showLogin("Пароль изменён. Войдите с новым паролем.");
      } catch (error) {
        const messages = {
          invalid_current_password: "Текущий пароль указан неверно.",
          password_too_short: "Новый пароль должен быть не короче 10 символов."
        };
        errorElement.textContent = messages[error.code] || "Не удалось изменить пароль.";
        errorElement.hidden = false;
      }
    });
  }

  function bindNavigation() {
    document.body.addEventListener("pointerdown", (event) => {
      const navButton = event.target.closest(".nav-link[data-route], .bottom-link[data-route]");
      if (!navButton || navButton.hidden) return;
      event.preventDefault();
      navigate(navButton.dataset.route);
    }, true);

    document.body.addEventListener("click", (event) => {
      const action = event.target.closest("[data-route-action]");
      if (!action || action.hidden) return;
      event.preventDefault();
      if (window.LabState && action.dataset.labMode) {
        LabState.mode = action.dataset.labMode;
        LabState.group = "Все";
        LabState.onlyAbnormal = false;
      }
      if (window.LabState && action.dataset.labCode) LabState.selectedCode = action.dataset.labCode;
      navigate(action.dataset.routeAction);
    });

    document.getElementById("menuBtn").onclick = () => document.getElementById("sidebar").classList.toggle("open");

    document.getElementById("avatarMenuBtn").onclick = (event) => {
      event.stopPropagation();
      const menu = document.getElementById("profileMenu");
      menu.hidden = !menu.hidden;
      menu.classList.toggle("show", !menu.hidden);
    };

    document.body.addEventListener("click", (event) => {
      if (!event.target.closest(".top-actions")) {
        const menu = document.getElementById("profileMenu");
        menu.hidden = true;
        menu.classList.remove("show");
      }
    });

    document.getElementById("logoutBtn").onclick = logout;
    document.getElementById("goVisitsBtn").onclick = () => {
      UI.closeModals();
      navigate("visits");
    };

    window.addEventListener("hashchange", () => {
      if (!currentUser) {
        setLoginHash();
        return;
      }
      if (currentUser.mustChangePassword) {
        openPasswordChangeModal();
        return;
      }
      const route = routeFromHash();
      if (route === "login") {
        logout();
        return;
      }
      if (routeAllowed(route) && routeRenderers()[route]) navigate(route);
      else navigate(defaultRoute());
    });
  }

  function bindModals() {
    document.getElementById("modalBackdrop").onclick = () => {
      if (currentUser?.mustChangePassword) return;
      UI.closeModals();
    };
    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.onclick = () => UI.closeModals();
    });
  }

  async function navigate(route) {
    if (!currentUser) {
      showLogin();
      return;
    }
    if (currentUser.mustChangePassword) {
      openPasswordChangeModal();
      return;
    }
    if (!routeAllowed(route) || !routeRenderers()[route]) route = defaultRoute();
    currentRoute = route;
    setHashForRoute(route);
    document.querySelectorAll(".nav-link").forEach((item) => item.classList.toggle("active", item.dataset.route === route));
    document.querySelectorAll(".bottom-link").forEach((item) => item.classList.toggle("active", item.dataset.route === route));
    document.getElementById("sidebar").classList.remove("open");
    await render();
  }

  async function logout() {
    try { await HealthAPI.logout(); } catch (error) { /* session may already be gone */ }
    showLogin();
    document.getElementById("passwordInput").value = "";
  }

  async function render() {
    if (!currentUser) {
      showLogin();
      return;
    }
    if (currentUser.mustChangePassword) {
      openPasswordChangeModal();
      return;
    }

    UI.setRouteTitle(currentRoute);
    const renderers = routeRenderers();
    const routeAtStart = currentRoute;
    const renderer = renderers[currentRoute] || renderers[defaultRoute()];

    try {
      if (typeof renderer !== "function") throw new Error(`Renderer is not registered for route: ${currentRoute}`);
      await renderer();
      if (routeAtStart !== currentRoute && !renderCorrectionPending) {
        renderCorrectionPending = true;
        await render();
        renderCorrectionPending = false;
        return;
      }
      updateApiMode();
    } catch (error) {
      if (error.status === 401 || error.code === "authentication_required") {
        showLogin("Сессия завершена. Войдите снова.");
        return;
      }
      if (error.code === "password_change_required") {
        currentUser.mustChangePassword = true;
        openPasswordChangeModal();
        return;
      }
      updateApiMode();
      UI.root().innerHTML = `
        <section class="api-alert">
          <b>Не удалось загрузить данные.</b><br>
          Попробуйте обновить страницу позже.
        </section>
      `;
    }
  }

  function updateApiMode() {
    const state = HealthAPI.apiMode();
    const syncStatus = document.getElementById("syncStatusText");
    const syncTime = document.getElementById("syncTime");
    const isUnavailable = state.mode === "unavailable";
    if (syncStatus) syncStatus.textContent = isUnavailable ? "Кабинет временно недоступен" : "Кабинет готов";
    if (syncTime) syncTime.textContent = isUnavailable ? "Попробуйте обновить страницу позже." : "Данные закрытого демо-контура.";
  }

  function user() {
    return currentUser;
  }

  return { init, navigate, render, updateApiMode, handleLoginSubmit, logout, user };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", App.init);
} else {
  App.init();
}
