window.App = (() => {
  let currentRoute = "dashboard";
  let renderCorrectionPending = false;
  const DEMO_AUTH_KEYS = {
    authenticated: "isDemoAuthenticated",
    patientId: "demoPatientId",
    patientName: "demoPatientName",
    patientProfile: "demoPatientProfile",
    misCard: "demoMisCard"
  };
  const DEMO_PATIENTS = {
    alexey: { id: "alexey", name: "Алексей Петров", initials: "АП", profile: "Метаболический риск", misCard: "MIS-248019" },
    anna: { id: "anna", name: "Анна Смирнова", initials: "АС", profile: "Анемия / железодефицит", misCard: "MIS-391204" },
    dmitry: { id: "dmitry", name: "Дмитрий Орлов", initials: "ДО", profile: "Печеночные ферменты", misCard: "MIS-582771" }
  };
  let selectedDemoPatientId = normalizeDemoPatientId(localStorage.getItem(DEMO_AUTH_KEYS.patientId));

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
      profile: Pages.profile
    };
  }

  function init() {
    installWindowWheelFallback();
    bindLogin();
    bindNavigation();
    bindModals();

    document.getElementById("avatarMenuBtn").textContent = "АП";
    document.getElementById("syncTime").textContent = "Откройте лабораторию, чтобы посмотреть динамику.";
    const initialRoute = routeFromHash();
    if (isDemoAuthenticated()) {
      document.getElementById("avatarMenuBtn").textContent = selectedDemoPatient().initials;
      currentRoute = routeRenderers()[initialRoute] ? initialRoute : "dashboard";
      setLoginMode(false);
      setHashForRoute(currentRoute);
      render();
      return;
    }

    currentRoute = "dashboard";
    setLoginMode(true);
    setLoginHash();
    updateApiMode();
  }

  function selectedDemoPatient() {
    selectedDemoPatientId = normalizeDemoPatientId(selectedDemoPatientId);
    return DEMO_PATIENTS[selectedDemoPatientId];
  }

  function normalizeDemoPatientId(patientId) {
    return DEMO_PATIENTS[patientId] ? patientId : "alexey";
  }

  function updateDemoPatientPicker() {
    const patient = selectedDemoPatient();
    document.querySelectorAll("[data-demo-patient-id]").forEach((card) => {
      card.classList.toggle("active", card.dataset.demoPatientId === patient.id);
    });
    const misCard = document.getElementById("demoMisCard");
    const profile = document.getElementById("demoPatientProfile");
    if (misCard) misCard.textContent = patient.misCard;
    if (profile) profile.textContent = `${patient.profile} • данные подключены в демо-режиме.`;
  }

  function routeFromHash() {
    return window.location.hash.replace("#", "");
  }

  function isDemoAuthenticated() {
    return localStorage.getItem(DEMO_AUTH_KEYS.authenticated) === "true";
  }

  // Demo-auth only: stores a local demo session, not production authentication.
  function setDemoAuthenticated() {
    const patient = selectedDemoPatient();
    localStorage.setItem(DEMO_AUTH_KEYS.authenticated, "true");
    localStorage.setItem(DEMO_AUTH_KEYS.patientId, patient.id);
    localStorage.setItem(DEMO_AUTH_KEYS.patientName, patient.name);
    localStorage.setItem(DEMO_AUTH_KEYS.patientProfile, patient.profile);
    localStorage.setItem(DEMO_AUTH_KEYS.misCard, patient.misCard);
    document.getElementById("avatarMenuBtn").textContent = patient.initials;
  }

  function clearDemoAuthenticated() {
    localStorage.removeItem(DEMO_AUTH_KEYS.authenticated);
    localStorage.removeItem(DEMO_AUTH_KEYS.patientId);
    localStorage.removeItem(DEMO_AUTH_KEYS.patientName);
    localStorage.removeItem(DEMO_AUTH_KEYS.patientProfile);
    localStorage.removeItem(DEMO_AUTH_KEYS.misCard);
    selectedDemoPatientId = "alexey";
    updateDemoPatientPicker();
  }

  function clearSessionContext() {
    PatientStorage.clearPatientSessionState();
  }

  function setHashForRoute(route) {
    if (window.location.hash !== `#${route}`) {
      window.history.replaceState(null, "", `#${route}`);
    }
  }

  function setLoginHash() {
    if (window.location.hash !== "#login") {
      window.history.replaceState(null, "", "#login");
    }
  }

  function installWindowWheelFallback() {
    // assistant scroll fix: global wheel fallback breaks native trackpad scrolling in chat panes.
    return;
    document.addEventListener("wheel", (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;
      // assistant scroll fix: keep wheel events inside message pane
      if (event.target.closest(".assistant-page")) return;
      const interactiveScroll = event.target.closest(".lab-list, .attention-list, .reports-list, .history-list, .assistant-messages, .assistant-indicator-list, .table-wrap, .tabs, .metric-strip, .lab-hero-stats, .date-strip, .slot-grid, .modal.show");
      if (interactiveScroll) return;
      const root = document.scrollingElement || document.documentElement;
      const canScroll = root.scrollHeight > window.innerHeight;
      if (!canScroll || !event.deltaY) return;
      event.preventDefault();
      window.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: "auto" });
    }, { capture: true, passive: false });
  }

  function setLoginMode(isLogin) {
    document.body.classList.toggle("is-login", isLogin);
    document.body.classList.toggle("is-app", !isLogin);
    document.getElementById("loginView").classList.toggle("hidden", !isLogin);
    document.getElementById("appView").classList.toggle("hidden", isLogin);
    document.getElementById("bottomNav").style.display = isLogin ? "none" : "";
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("open");
    const profileMenu = document.getElementById("profileMenu");
    if (profileMenu) {
      profileMenu.hidden = true;
      profileMenu.classList.remove("show");
    }
    if (isLogin && window.UI) UI.closeModals();
  }

  function bindLogin() {
    document.getElementById("loginForm").addEventListener("submit", handleLoginSubmit);
    window.addEventListener("hashchange", handleRegisterHash);
    updateDemoPatientPicker();

    document.querySelectorAll("[data-demo-patient-id]").forEach(card => {
      card.onclick = () => {
        const nextPatientId = normalizeDemoPatientId(card.dataset.demoPatientId);
        if (nextPatientId !== selectedDemoPatientId) clearSessionContext();
        selectedDemoPatientId = nextPatientId;
        updateDemoPatientPicker();
      };
    });

    document.querySelectorAll("[data-auth-tab]").forEach(btn => {
      btn.onclick = () => {
        const tab = btn.dataset.authTab;
        hideAuthMessages();
        document.querySelectorAll("[data-auth-tab]").forEach(item => item.classList.toggle("active", item === btn));
        document.querySelectorAll(".auth-panel").forEach(panel => {
          panel.classList.remove("active");
          panel.hidden = true;
        });
        const activePanel = document.getElementById(tab === "login" ? "loginPanel" : "registerPanel");
        activePanel.hidden = false;
        activePanel.classList.add("active");
      };
    });

    document.getElementById("registerDemoBtn").onclick = handleRegisterSubmit;

    document.querySelectorAll("[data-legal-modal]").forEach(btn => {
      btn.onclick = () => UI.openModal(btn.dataset.legalModal);
    });
  }

  async function handleLoginSubmit(e) {
      e.preventDefault();
      hideAuthMessages();
      if (!document.getElementById("loginConsent").checked) {
        UI.toast("Подтвердите согласие на обработку данных");
        return;
      }
      const code = document.getElementById("smsCodeInput").value.trim();
      if (code !== "1234") {
        document.getElementById("loginError").hidden = false;
        UI.toast("Введите демо-код 1234");
        return;
      }
      setDemoAuthenticated();
      currentRoute = "dashboard";
      setHashForRoute(currentRoute);
      setLoginMode(false);
      await render();
  }

  function handleRegisterSubmit(e) {
    e.preventDefault();
    showRegisterDemoMessage();
  }

  function handleRegisterHash() {
    if (window.location.hash !== "#register-demo") return;
    showRegisterDemoMessage();
  }

  function showRegisterDemoMessage() {
    const consent = document.getElementById("registerConsent");
    if (!consent.checked) {
      UI.toast("Подтвердите согласие на обработку данных");
      return;
    }
    const message = document.getElementById("registerDemoMessage");
    message.hidden = false;
    message.removeAttribute("hidden");
    UI.toast("Регистрация в демо-версии имитируется");
  }

  function hideAuthMessages() {
    const loginError = document.getElementById("loginError");
    if (loginError) loginError.hidden = true;
  }

  function bindNavigation() {
    document.body.addEventListener("pointerdown", (event) => {
      const navButton = event.target.closest(".nav-link[data-route], .bottom-link[data-route]");
      if (!navButton) return;
      event.preventDefault();
      navigate(navButton.dataset.route);
    }, true);

    document.querySelectorAll("[data-route]").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const route = btn.dataset.route;
        navigate(route);
      };
    });

    document.body.addEventListener("click", (e) => {
      const action = e.target.closest("[data-route-action]");
      if (action) {
        e.preventDefault();
        if (window.LabState && action.dataset.labMode) {
          LabState.mode = action.dataset.labMode;
          LabState.group = "Все";
          LabState.onlyAbnormal = false;
        }
        if (window.LabState && action.dataset.labCode) {
          LabState.selectedCode = action.dataset.labCode;
        }
        navigate(action.dataset.routeAction);
        return;
      }

      const routeButton = e.target.closest("[data-route]");
      if (routeButton) {
        e.preventDefault();
        navigate(routeButton.dataset.route);
      }
    });

    document.getElementById("menuBtn").onclick = () => {
      document.getElementById("sidebar").classList.toggle("open");
    };

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

    const quickSyncBtn = document.getElementById("quickSyncBtn");
    if (quickSyncBtn) quickSyncBtn.onclick = () => render();

    const openApiModalBtn = document.getElementById("openApiModalBtn");
    if (openApiModalBtn) openApiModalBtn.onclick = () => UI.openModal("apiModal");

    document.getElementById("goVisitsBtn").onclick = () => {
      UI.closeModals();
      navigate("visits");
    };

    window.addEventListener("hashchange", () => {
      const route = window.location.hash.replace("#", "");
      if (route === "register-demo") {
        handleRegisterHash();
        return;
      }
      if (!isDemoAuthenticated()) {
        setLoginMode(true);
        if (route !== "login") setLoginHash();
        return;
      }
      if (route === "login") {
        logout();
        return;
      }
      if (route && routeRenderers()[route]) navigate(route);
    });
  }

  function bindModals() {
    document.getElementById("modalBackdrop").onclick = UI.closeModals;
    document.querySelectorAll("[data-close-modal]").forEach(btn => btn.onclick = UI.closeModals);
  }

  async function navigate(route) {
    if (!isDemoAuthenticated()) {
      currentRoute = "dashboard";
      setLoginMode(true);
      setLoginHash();
      return;
    }
    const renderers = routeRenderers();
    if (!renderers[route]) route = "dashboard";
    currentRoute = route;
    setHashForRoute(route);
    document.querySelectorAll(".nav-link").forEach(x => x.classList.toggle("active", x.dataset.route === route));
    document.querySelectorAll(".bottom-link").forEach(x => x.classList.toggle("active", x.dataset.route === route));
    document.getElementById("sidebar").classList.remove("open");
    await render();
  }

  function logout() {
    clearDemoAuthenticated();
    clearSessionContext();
    currentRoute = "dashboard";
    setLoginHash();
    setLoginMode(true);
    document.querySelectorAll(".nav-link").forEach(x => x.classList.toggle("active", x.dataset.route === "dashboard"));
    document.querySelectorAll(".bottom-link").forEach(x => x.classList.toggle("active", x.dataset.route === "dashboard"));
    UI.setRouteTitle("dashboard");
  }

  async function render() {
    if (!isDemoAuthenticated()) {
      setLoginMode(true);
      setLoginHash();
      return;
    }
    UI.setRouteTitle(currentRoute);
    const renderers = routeRenderers();
    const routeAtStart = currentRoute;
    const renderer = renderers[currentRoute] || renderers.dashboard;
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
      updateApiMode();
      const state = HealthAPI.apiMode();
      if (["demo_context_required", "invalid_demo_patient"].includes(error.code || error.message || state.lastErrorCode)) {
        UI.root().innerHTML = `
          <section class="api-alert">
            <b>Демо-пациент не выбран. Вернитесь на экран входа.</b><br>
            <button class="btn primary" id="backToDemoPatientsBtn">К выбору пациента</button>
          </section>
        `;
        const backBtn = document.getElementById("backToDemoPatientsBtn");
        if (backBtn) backBtn.onclick = logout;
        return;
      }
      UI.root().innerHTML = `
        <section class="api-alert">
          <b>Не удалось загрузить данные.</b><br>
          Проверьте, что кабинет запущен, и обновите страницу.
        </section>
      `;
    }
  }

  function updateApiMode() {
    const state = HealthAPI.apiMode();
    const label = state.label;
    const syncStatus = document.getElementById("syncStatusText");
    const apiModePill = document.getElementById("apiModePill");
    const syncTime = document.getElementById("syncTime");
    const isUnavailable = state.mode === "unavailable";
    if (syncStatus) syncStatus.textContent = isUnavailable ? "Кабинет временно недоступен" : "Результаты обновлены";
    if (apiModePill) {
      apiModePill.textContent = label;
      apiModePill.classList.toggle("backend", state.mode === "backend");
      apiModePill.classList.toggle("local", state.mode !== "backend");
      apiModePill.title = isUnavailable ? "Кабинет временно недоступен" : "Данные обновлены";
    }
    if (syncTime) {
      syncTime.textContent = isUnavailable
        ? "Попробуйте обновить страницу позже."
        : "Откройте лабораторию, чтобы посмотреть динамику.";
    }
  }

  return { init, navigate, render, updateApiMode, handleLoginSubmit, handleRegisterSubmit, logout };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", App.init);
} else {
  App.init();
}
