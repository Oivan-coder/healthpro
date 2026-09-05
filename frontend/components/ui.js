if (!document.querySelector('link[data-atlas-responsive-fixes]')) {
  const responsiveStyles = document.createElement('link');
  responsiveStyles.rel = 'stylesheet';
  responsiveStyles.href = './css/responsive-fixes.css?v=adaptive-1';
  responsiveStyles.dataset.atlasResponsiveFixes = 'true';
  document.head.appendChild(responsiveStyles);
}

window.UI = (() => {
  const root = () => document.getElementById("pageRoot");

  function statusClass(flag) {
    if (flag === "normal" || flag === "ok") return "ok";
    if (flag === "high" || flag === "low" || flag === "warn") return "warn";
    if (flag === "danger") return "danger";
    if (flag === "purple") return "purple";
    return "info";
  }

  function statusText(flag) {
    if (flag === "normal") return "В обычном диапазоне";
    if (flag === "high") return "Выше обычного диапазона";
    if (flag === "low") return "Ниже обычного диапазона";
    if (flag === "warn") return "Требует внимания";
    return flag;
  }

  function iconClass(level) {
    if (level === "ok") return "ok";
    if (level === "warn") return "warn";
    if (level === "purple") return "purple";
    return "";
  }

  function labValue(lab) {
    return `<span class="lab-value-number">${lab.latestValue}</span>${lab.unit ? `<small class="lab-value-unit">${lab.unit}</small>` : ""}`;
  }

  function firstName(patient) {
    return (patient?.name || "Пациент").split(" ")[0] || "Пациент";
  }

  function attentionText(count) {
    if (count === 1) return "1 показатель стоит обсудить с врачом";
    if (count > 1 && count < 5) return `${count} показателя стоит обсудить с врачом`;
    return `${count} показателей стоит обсудить с врачом`;
  }

  function numericValue(value) {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function referenceRangeBar(item) {
    const value = numericValue(item.latestValue ?? item.value);
    const low = numericValue(item.low);
    const high = numericValue(item.high);
    const unit = item.unit || "";
    if (value === null || low === null || high === null || high <= low) {
      return `
        <div class="reference-range-bar textual">
          <span>${statusText(item.flag || "info")}</span>
          <small>${item.latestValue ?? item.value ?? "значение уточняется"} ${unit}</small>
        </div>
      `;
    }
    const span = high - low;
    const min = low - span * 0.45;
    const max = high + span * 0.45;
    const toPct = (num) => Math.max(2, Math.min(98, ((num - min) / Math.max(0.001, max - min)) * 100));
    const normalLeft = toPct(low);
    const normalRight = toPct(high);
    const marker = toPct(value);
    return `
      <div class="reference-range-bar ${statusClass(item.flag)}">
        <div class="range-track">
          <i class="range-normal" style="left:${normalLeft}%;width:${Math.max(8, normalRight - normalLeft)}%"></i>
          <i class="range-marker" style="left:${marker}%"></i>
        </div>
        <div class="range-labels">
          <span>${low} ${unit}</span>
          <b>${value} ${unit}</b>
          <span>${high} ${unit}</span>
        </div>
      </div>
    `;
  }

  function labIndicatorCard(lab, options = {}) {
    const previous = lab.history?.[1];
    const previousText = previous ? `Предыдущее: ${previous.value} ${lab.unit || ""}` : "Динамика появится после следующего результата";
    return `
      <article class="lab-indicator-card ${statusClass(lab.flag)}">
        <div class="indicator-top">
          <div>
            <h3>${lab.name}</h3>
            <p class="muted">${lab.group || "Показатель"}${lab.latestDate ? ` • ${lab.latestDate}` : ""}</p>
          </div>
          <span class="status ${statusClass(lab.flag)}">${statusText(lab.flag)}</span>
        </div>
        <div class="indicator-value">${lab.latestValue}<small>${lab.unit || ""}</small></div>
        ${referenceRangeBar(lab)}
        <div class="indicator-footer">
          <span>${previousText}</span>
          <button class="btn ghost small" data-route-action="labs" data-lab-mode="tests" ${lab.code ? `data-lab-code="${lab.code}"` : ""}>Динамика</button>
        </div>
        ${options.action ? `<div class="indicator-action">${options.action}</div>` : ""}
      </article>
    `;
  }

  function reportSummaryCard(report, options = {}) {
    const attention = report.abnormalCount || 0;
    return `
      <article class="report-summary-card ${attention ? "warn" : "ok"}">
        <div class="report-card-head">
          <div>
            <h3>${report.name}</h3>
            <p class="muted">${report.date} • результат готов</p>
          </div>
          <span class="status ${attention ? "warn" : "ok"}">${attention ? "Требует внимания" : "Спокойно"}</span>
        </div>
        <p>${attention ? "Есть показатели выше или ниже обычного диапазона." : "Результат готов, без заметных отклонений."}</p>
        <div class="report-mini-grid">
          <span><b>${report.testCount || 0}</b><small>показателей</small></span>
          <span><b>${attention}</b><small>для обсуждения</small></span>
        </div>
        ${options.button || ""}
      </article>
    `;
  }

  function sparkline(lab) {
    const values = lab.history.map(x => x.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const points = values.map((v, i) => {
      const x = i * 74 / Math.max(1, values.length - 1) + 2;
      const y = 29 - ((v - min) / Math.max(.001, max - min)) * 22 + 2;
      return `${x},${y}`;
    }).join(" ");
    const color = lab.flag === "normal" ? "#34c759" : "#ff9500";
    return `<svg class="sparkline" viewBox="0 0 80 36" preserveAspectRatio="none">
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  function toast(text) {
    const el = document.getElementById("toast");
    el.textContent = text;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1800);
  }

  let activeModal = null;
  let modalTrigger = null;
  let modalBackground = [];
  const focusableSelector = "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

  function updateModalViewport() {
    if (!activeModal) return;
    const viewport = window.visualViewport;
    document.documentElement.style.setProperty("--dialog-viewport-height", `${viewport?.height || window.innerHeight}px`);
    document.documentElement.style.setProperty("--dialog-viewport-top", `${viewport?.offsetTop || 0}px`);
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal || modal === activeModal) return;
    if (!activeModal) {
      modalTrigger = document.activeElement;
      modalBackground = [...document.querySelectorAll("#loginView, #appView, #bottomNav")]
        .map(element => ({ element, wasInert: element.hasAttribute("inert") }));
      modalBackground.forEach(({ element }) => element.setAttribute("inert", ""));
    } else {
      activeModal.classList.remove("show");
    }
    activeModal = modal;
    document.body.classList.add("modal-open");
    document.getElementById("modalBackdrop").classList.add("show");
    modal.classList.add("show");
    updateModalViewport();
    (modal.querySelector(focusableSelector) || modal).focus({ preventScroll: true });
  }

  function closeModals() {
    document.getElementById("modalBackdrop").classList.remove("show");
    document.querySelectorAll(".modal").forEach(m => m.classList.remove("show"));
    document.body.classList.remove("modal-open");
    modalBackground.forEach(({ element, wasInert }) => element.toggleAttribute("inert", wasInert));
    modalBackground = [];
    activeModal = null;
    if (modalTrigger?.isConnected && !modalTrigger.closest("[hidden], .hidden, [inert]")) {
      modalTrigger.focus({ preventScroll: true });
    }
    modalTrigger = null;
  }

  document.addEventListener("keydown", (event) => {
    if (!activeModal) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (activeModal.dataset.dismissible !== "false") closeModals();
    } else if (event.key === "Tab") {
      const items = [...activeModal.querySelectorAll(focusableSelector)].filter(item => !item.closest("[hidden]"));
      const first = items[0] || activeModal;
      const last = items[items.length - 1] || activeModal;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === activeModal)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === activeModal)) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  window.visualViewport?.addEventListener("resize", updateModalViewport);
  window.visualViewport?.addEventListener("scroll", updateModalViewport);
  window.addEventListener("resize", updateModalViewport);

  function setRouteTitle(route) {
    const titles = {
      dashboard: ["Сегодня", "Лента здоровья"],
      labs: ["Анализы", "Исследования и динамика"],
      "lab-history": ["История", "Динамика анализов"],
      appointments: ["Записаться", "Выбор врача и времени"],
      visits: ["Врачи", "Приемы и события"],
      reports: ["Документы", "Заключения и файлы"],
      assistant: ["Помощник", "Ответы по базе знаний"],
      import: ["Импорт", "Загрузка лабораторных данных"],
      integration: ["Интеграция", "Контур МИС/ЛИС"],
      profile: ["Профиль", "Данные пациента"],
      "admin-users": ["Администрирование", "Пользователи демо-контура"]
    };
    const [caption, title] = titles[route] || titles.dashboard;
    document.getElementById("routeCaption").textContent = caption;
    document.getElementById("routeTitle").textContent = title;
  }

  function renderEmpty(text) {
    return `<div class="card"><p class="muted">${text}</p></div>`;
  }

  return { root, statusClass, statusText, iconClass, labValue, firstName, attentionText, referenceRangeBar, labIndicatorCard, reportSummaryCard, sparkline, toast, openModal, closeModals, setRouteTitle, renderEmpty };
})();
