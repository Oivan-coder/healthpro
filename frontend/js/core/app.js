window.App = (() => {
  let currentRoute = "dashboard";
  let currentUser = null;
  let renderCorrectionPending = false;
  const compactNavigation = window.matchMedia("(max-width: 1180px)");

  function closeProfileMenu() {
    const menu = document.getElementById("profileMenu");
    menu.hidden = true;
    menu.classList.remove("show");
    document.getElementById("avatarMenuBtn").setAttribute("aria-expanded", "false");
  }

  function setSidebarOpen(open, restoreFocus = false) {
    const expanded = Boolean(open && compactNavigation.matches);
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("open", expanded);
    sidebar.toggleAttribute("inert", compactNavigation.matches && !expanded);
    document.body.classList.toggle("nav-open", expanded);
    document.querySelector(".workspace").toggleAttribute("inert", expanded);
    document.getElementById("bottomNav").toggleAttribute("inert", expanded);
    document.getElementById("navOverlay").hidden = !expanded;
    const button = document.getElementById("menuBtn");
    button.setAttribute("aria-expanded", String(expanded));
    if (expanded) {
      closeProfileMenu();
      const firstLink = sidebar.querySelector(".nav-link.active:not([hidden])") || sidebar.querySelector(".nav-link:not([hidden])");
      firstLink?.focus({ preventScroll: true });
    } else if (restoreFocus) {
      button.focus({ preventScroll: true });
    }
  }

  function syncRouteNavigation() {
    document.querySelectorAll(".nav-link, .bottom-link").forEach((item) => {
      const active = item.dataset.route === currentRoute;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  }

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
      "admin-users": Pages["admin-users"],
      "manual-lab-entry": Pages["manual-lab-entry"]
    };
  }

  function userRoutes() {
    return new Set(["dashboard", "labs", "lab-history", "appointments", "visits", "reports", "assistant", "profile"]);
  }

  function testerRoutes() {
    return new Set([...userRoutes(), "manual-lab-entry"]);
  }

  function adminRoutes() {
    return new Set(["admin-users", "manual-lab-entry", "integration"]);
  }

  function defaultRoute() {
    return currentUser?.role === "admin" ? "admin-users" : "dashboard";
  }

  function routeAllowed(route) {
    if (!currentUser) return false;
    if (currentUser.role === "admin") return adminRoutes().has(route);
    if (currentUser.role === "tester") return testerRoutes().has(route);
    return userRoutes().has(route);
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
    const showBottomNav = !isLogin && currentUser && currentUser.role !== "admin";
    document.getElementById("bottomNav").style.display = showBottomNav ? "" : "none";
    document.body.classList.toggle("has-bottom-nav", showBottomNav);
    setSidebarOpen(false);
    closeProfileMenu();
  }

  function applyRoleNavigation() {
    const isAdmin = currentUser?.role === "admin";
    const canEnterLabs = isAdmin || currentUser?.role === "tester";
    document.querySelectorAll("[data-admin-only]").forEach((element) => { element.hidden = !isAdmin; });
    document.querySelectorAll("[data-user-only]").forEach((element) => { element.hidden = isAdmin; });
    document.querySelectorAll("[data-lab-entry-only]").forEach((element) => { element.hidden = !canEnterLabs; });
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
    syncRouteNavigation();
    await render();
  }

  function showLogin(message = "", success = false) {
    currentUser = null;
    PatientStorage.clearPatientSessionState();
    setLoginMode(true);
    setLoginHash();
    UI.closeModals();
    const error = document.getElementById("loginError");
    if (error) {
      error.classList.toggle("is-success", success);
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
    errorElement.classList.remove("is-success");
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
        showLogin("Пароль изменён. Войдите с новым паролем.", true);
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
      closeProfileMenu();
      navigate(action.dataset.routeAction);
    });

    setSidebarOpen(false);
    document.getElementById("menuBtn").onclick = () => setSidebarOpen(!document.getElementById("sidebar").classList.contains("open"));
    document.getElementById("closeSidebarBtn").onclick = () => setSidebarOpen(false, true);
    document.getElementById("navOverlay").onclick = () => setSidebarOpen(false, true);
    compactNavigation.addEventListener("change", () => setSidebarOpen(false));

    document.addEventListener("keydown", (event) => {
      const sidebar = document.getElementById("sidebar");
      if (event.key === "Escape") {
        if (sidebar.classList.contains("open")) setSidebarOpen(false, true);
        else if (!document.getElementById("profileMenu").hidden) {
          closeProfileMenu();
          document.getElementById("avatarMenuBtn").focus();
        }
      }
      if (event.key === "Tab" && sidebar.classList.contains("open")) {
        const items = [...sidebar.querySelectorAll("button, a[href]")].filter(item => !item.hidden);
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    document.getElementById("avatarMenuBtn").onclick = (event) => {
      event.stopPropagation();
      const menu = document.getElementById("profileMenu");
      menu.hidden = !menu.hidden;
      menu.classList.toggle("show", !menu.hidden);
      event.currentTarget.setAttribute("aria-expanded", String(!menu.hidden));
    };

    document.body.addEventListener("click", (event) => {
      if (!event.target.closest(".top-actions")) {
        closeProfileMenu();
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
    syncRouteNavigation();
    setSidebarOpen(false);
    await render();
    if (currentUser && !currentUser.mustChangePassword) {
      UI.root().focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
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
