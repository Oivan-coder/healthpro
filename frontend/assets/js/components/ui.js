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
    if (flag === "normal") return "Норма";
    if (flag === "high") return "Выше";
    if (flag === "low") return "Ниже";
    return flag;
  }

  function iconClass(level) {
    if (level === "ok") return "ok";
    if (level === "warn") return "warn";
    if (level === "purple") return "purple";
    return "";
  }

  function labValue(lab) {
    return `${lab.latestValue}${lab.unit ? " " + lab.unit : ""}`;
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

  function openModal(id) {
    document.getElementById("modalBackdrop").classList.add("show");
    document.getElementById(id).classList.add("show");
  }

  function closeModals() {
    document.getElementById("modalBackdrop").classList.remove("show");
    document.querySelectorAll(".modal").forEach(m => m.classList.remove("show"));
  }

  function setRouteTitle(route) {
    const titles = {
      dashboard: ["Главная", "Личный кабинет пациента"],
      labs: ["Лабораторная диагностика", "Показатели и динамика"],
      "lab-history": ["История анализов", "Все лабораторные наблюдения"],
      appointments: ["Запись", "Выбор врача и времени"],
      visits: ["Приемы", "Медицинские события"],
      reports: ["Документы", "Заключения и файлы"],
      import: ["Импорт", "Загрузка лабораторных данных"],
      integration: ["Интеграция", "Контур МИС/ЛИС"],
      profile: ["Профиль", "Данные пациента"]
    };
    const [caption, title] = titles[route] || titles.dashboard;
    document.getElementById("routeCaption").textContent = caption;
    document.getElementById("routeTitle").textContent = title;
  }

  function renderEmpty(text) {
    return `<div class="card"><p class="muted">${text}</p></div>`;
  }

  return { root, statusClass, statusText, iconClass, labValue, sparkline, toast, openModal, closeModals, setRouteTitle, renderEmpty };
})();
