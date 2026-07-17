window.Pages = window.Pages || {};

const sampleImport = [
  { "code": "GLU", "value": 6.0, "date": "15.05.2026" },
  { "code": "CHOL", "value": 5.4, "date": "15.05.2026" },
  { "code": "CRP", "value": 4.2, "date": "15.05.2026" },
  { "code": "VITD", "value": 25, "date": "15.05.2026" }
];

window.Pages.import = async function renderImport() {
  const data = await HealthAPI.labs();
  const validation = window.ImportState?.validation || { validCount: 0, errorCount: 0, errors: [], valid: [] };

  UI.root().innerHTML = `
    <section class="import-layout">
      <div class="card">
        <div class="label">${HealthAPI.apiMode().mode === "backend" ? "Backend API" : "Локальное демо"} • пилотный импорт</div>
        <h2>Загрузка лабораторных данных</h2>
        <p class="muted">Формат повторяет структурированную выгрузку из ЛИС/МИС. Проверка не ставит диагнозы, а контролирует техническое качество данных.</p>

        <textarea id="importText">${JSON.stringify(sampleImport, null, 2)}</textarea>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
          <button class="btn secondary" id="fillSampleBtn">Вставить пример</button>
          <button class="btn ghost" id="validateBtn">Проверить данные</button>
          <button class="btn primary" id="importBtn">Импортировать</button>
        </div>
      </div>

      <aside class="card">
        <div class="label">Результат проверки</div>
        <h2>Контроль качества</h2>
        <div class="metric-strip import-metrics">
          <div class="card flat metric-card"><div class="label">Валидно</div><div class="kpi-number">${validation.validCount}</div></div>
          <div class="card flat metric-card"><div class="label">Ошибки</div><div class="kpi-number">${validation.errorCount}</div></div>
          <div class="card flat metric-card"><div class="label">Новых</div><div class="kpi-number">${validation.validCount}</div></div>
        </div>
        <div class="list">
          <div class="row-card"><div class="icon-bubble ok">✓</div><div><b>code</b><div class="muted">должен быть в справочнике</div></div></div>
          <div class="row-card"><div class="icon-bubble ok">✓</div><div><b>value</b><div class="muted">числовое значение</div></div></div>
          <div class="row-card"><div class="icon-bubble ok">✓</div><div><b>date</b><div class="muted">обязательная дата результата</div></div></div>
          <div class="row-card"><div class="icon-bubble warn">!</div><div><b>duplicate_observation</b><div class="muted">такая точка уже есть в истории</div></div></div>
        </div>
      </aside>
    </section>

    <section class="card" style="margin-top:16px">
      <div class="label">Ошибки валидации</div>
      <h2>Что нужно исправить перед импортом</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Строка</th><th>Ошибка</th><th>Code</th><th>Value</th><th>Date</th></tr></thead>
          <tbody>
            ${(validation.errors || []).map(error => `
              <tr>
                <td>${Number(error.index) + 1}</td>
                <td><span class="status warn">${error.code}</span></td>
                <td>${error.item?.code || "—"}</td>
                <td>${error.item?.value ?? "—"}</td>
                <td>${error.item?.date || "—"}</td>
              </tr>
            `).join("") || `<tr><td colspan="5" class="muted">После проверки здесь появятся ошибки или подтверждение, что данные готовы к импорту.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    <section class="card" style="margin-top:16px">
      <div class="label">Справочник MVP</div>
      <h2>Показатели первой очереди</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Код</th><th>Название</th><th>Группа</th><th>Единица</th><th>Референс</th><th>LOINC</th></tr></thead>
          <tbody>
            ${data.catalog.map(item => `
              <tr><td><b>${item.code}</b></td><td>${item.name}</td><td>${item.group}</td><td>${item.unit}</td><td>${item.low}–${item.high}</td><td>${item.loinc}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;

  document.getElementById("fillSampleBtn").onclick = () => {
    document.getElementById("importText").value = JSON.stringify(sampleImport, null, 2);
  };

  document.getElementById("validateBtn").onclick = async () => {
    try {
      const items = JSON.parse(document.getElementById("importText").value);
      window.ImportState = { validation: await HealthAPI.validateLabs(Array.isArray(items) ? items : []) };
      UI.toast(window.ImportState.validation.errorCount ? "Есть ошибки валидации" : "Данные готовы к импорту");
      window.App.render();
    } catch (error) {
      UI.toast("Ошибка JSON");
    }
  };

  document.getElementById("importBtn").onclick = async () => {
    try {
      const items = JSON.parse(document.getElementById("importText").value);
      const result = await HealthAPI.importLabObservations(Array.isArray(items) ? items : []);
      window.ImportState = { validation: result };
      UI.toast(`Импортировано: ${result.imported || result.validCount || 0}`);
      window.App.navigate("labs");
    } catch (error) {
      UI.toast("Ошибка JSON");
    }
  };
};

window.Pages.integration = async function renderIntegration() {
  const [status, audit] = await Promise.all([
    HealthAPI.getIntegrationStatus(),
    HealthAPI.getAuditEvents().catch(() => ({ events: [] }))
  ]);
  const auditEvents = audit.events || [];

  UI.root().innerHTML = `
    <section class="integration-hero">
      <div>
        <div class="label">Интеграция с клиникой</div>
        <h2>Как Атлас здоровья принимает лабораторные данные</h2>
        <p class="muted">Атлас здоровья принимает структурированные данные из МИС/ЛИС и показывает пациенту исследования, показатели, динамику и следующие действия.</p>
      </div>
      <div class="integration-actions">
        <a class="btn primary" href="${HealthAPI.integrationDownloadUrl("/integration/examples/lab-report-full-example.json")}">Скачать пример JSON</a>
        <a class="btn secondary" href="${HealthAPI.integrationDownloadUrl("/integration/examples/lab-export-fields.csv")}">Скачать список полей</a>
        <a class="btn ghost" href="${HealthAPI.integrationDownloadUrl("/integration/protocol/lab-report")}">Скачать API-протокол</a>
      </div>
    </section>

    <section class="card">
      <div class="label">Поток данных</div>
      <h2>От МИС/ЛИС к кабинету пациента</h2>
      <div class="flow-line clinic-flow">
        <span>МИС/ЛИС</span><i></i><span>JSON / CSV / XML / API</span><i></i><span>backend Атласа здоровья</span><i></i><span>MySQL</span><i></i><span>Личный кабинет пациента</span>
      </div>
    </section>

    <section class="card" style="margin-top:16px">
      <div class="section-head">
        <div>
          <div class="label">Demo/admin-only</div>
          <h2>Журнал действий</h2>
          <p class="muted">Минимальный audit log для пилотного контура. Это не production SIEM.</p>
        </div>
        <span class="status info">${auditEvents.length} событий</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Время</th><th>Событие</th><th>Пациент</th><th>Ресурс</th><th>Статус</th></tr></thead>
          <tbody>
            ${auditEvents.map(event => `
              <tr>
                <td>${new Date(event.createdAt).toLocaleString("ru-RU")}</td>
                <td><b>${event.eventType}</b></td>
                <td>${event.patientId || "—"}</td>
                <td>${event.resourceType}:${event.resourceId || "—"}</td>
                <td><span class="status ${event.status === "success" ? "ok" : "warn"}">${event.status}</span></td>
              </tr>
            `).join("") || `<tr><td colspan="5" class="muted">Событий пока нет. Скачайте PDF, импортируйте отчет или создайте запись.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    <section class="grid-2" style="margin-top:16px">
      <div class="card">
        <div class="label">Готово в MVP</div>
        <h2>Что уже можно показать</h2>
        <div class="list">
          ${[
            "Backend API",
            "MySQL",
            "Большой лабораторный справочник",
            "Модель исследования / тесты / отчеты / наблюдения",
            "Patient-only UI",
            "Импорт JSON лабораторного отчета",
            "Unmapped-коды для ручного сопоставления"
          ].map(item => `<div class="row-card"><div class="icon-bubble ok">✓</div><div><b>${item}</b><div class="muted">работает в демо-контуре</div></div></div>`).join("")}
        </div>
      </div>

      <div class="card">
        <div class="label">Что нужно от клиники</div>
        <h2>Минимум для пилота</h2>
        <div class="list">
          <div class="row-card"><div class="icon-bubble">1</div><div><b>Тестовая или обезличенная выгрузка</b><div class="muted">20–50 лабораторных отчетов</div></div></div>
          <div class="row-card"><div class="icon-bubble">2</div><div><b>Справочник локальных кодов ЛИС/МИС</b><div class="muted">коды услуг, тестов, единицы, референсы</div></div></div>
          <div class="row-card"><div class="icon-bubble">3</div><div><b>Пример структуры данных</b><div class="muted">JSON, CSV, XML или описание API</div></div></div>
          <div class="row-card"><div class="icon-bubble">4</div><div><b>Контакт инженера МИС/ЛИС</b><div class="muted">для уточнения маппинга и формата</div></div></div>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top:16px">
      <div class="label">Границы первого этапа</div>
      <h2>Что не нужно для первого демо-пилота</h2>
      <div class="grid-3">
        ${[
          "Доступ к промышленной МИС",
          "Реальные персональные данные",
          "Промышленная интеграция"
        ].map(item => `<div class="interpretation soft"><b>${item}</b><p class="muted">На первом этапе достаточно тестовой или обезличенной выгрузки.</p></div>`).join("")}
      </div>
    </section>

    <section class="card" style="margin-top:16px">
      <div class="section-head">
        <div>
          <div class="label">Материалы для инженера</div>
          <h2>Файлы для старта обмена</h2>
          <p class="muted">Рабочее техническое имя проекта в коде и путях может оставаться <code>health-id</code>.</p>
        </div>
        <span class="status ok">${status.mode === "mysql" ? "демо-БД подключена" : "демо-контур"}</span>
      </div>
      <div class="grid-3">
        <a class="card flat download-card" href="${HealthAPI.integrationDownloadUrl("/integration/examples/lab-report-full-example.json")}"><b>Пример JSON</b><span class="muted">полный лабораторный отчет</span></a>
        <a class="card flat download-card" href="${HealthAPI.integrationDownloadUrl("/integration/examples/lab-export-fields.csv")}"><b>Список полей</b><span class="muted">минимальный CSV для выгрузки</span></a>
        <a class="card flat download-card" href="${HealthAPI.integrationDownloadUrl("/integration/protocol/lab-report")}"><b>Черновик API-протокола</b><span class="muted">endpoint, поля и безопасный scope</span></a>
      </div>
    </section>
  `;
};

window.Pages.profile = async function renderProfile() {
  const data = await HealthAPI.summary();
  const p = data.patient;
  const initials = p.name.split(" ").map(part => part[0]).slice(0, 2).join("");

  UI.root().innerHTML = `
    <section class="profile-layout">
      <div class="profile-card card">
        <div class="profile-hero-card">
          <div class="profile-avatar-large">${initials}</div>
          <div>
            <div class="label">Пациент</div>
            <h2>${p.name}</h2>
            <p class="muted">${p.age} года • ${p.sex} • ${p.clinic}</p>
          </div>
        </div>

        <div class="profile-info-grid">
          <div class="profile-info-item"><span>Дата рождения</span><b>${p.birthDate}</b></div>
          <div class="profile-info-item"><span>Телефон</span><b>${p.phone}</b></div>
          <div class="profile-info-item"><span>Карта пациента</span><b>${p.misCard}</b></div>
          <div class="profile-info-item"><span>Полис</span><b>${p.policy}</b></div>
        </div>

        <div class="profile-note">
          <div class="icon-bubble ok">✓</div>
          <div>
            <b>Карта клиники привязана</b>
            <p class="muted">По этой карте в кабинет попадают исследования, документы и записи пациента.</p>
          </div>
        </div>
      </div>

      <div class="profile-card card">
        <div class="section-head">
          <div>
            <div class="label">Доступ и данные</div>
            <h2>Что подключено</h2>
          </div>
          <span class="status ok">активно</span>
        </div>

        <div class="profile-status-list">
          <div class="profile-status-item">
            <div class="icon-bubble ok">✓</div>
            <div><b>Лаборатория</b><span>исследования, показатели внимания и динамика доступны в разделе “Лаборатория”</span></div>
          </div>
          <div class="profile-status-item">
            <div class="icon-bubble ok">✓</div>
            <div><b>Документы</b><span>заключения и файлы собраны в отдельном разделе</span></div>
          </div>
          <div class="profile-status-item">
            <div class="icon-bubble ok">✓</div>
            <div><b>Запись к врачу</b><span>можно выбрать специальность, врача и удобное время</span></div>
          </div>
          <div class="profile-status-item">
            <div class="icon-bubble ok">→</div>
            <div><b>Следующий шаг</b><span>при смене клиники привяжите новую карту пациента</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="profile-actions card">
      <div>
        <div class="label">Быстрые действия</div>
        <h2>Что можно открыть дальше</h2>
      </div>
      <div class="profile-action-buttons">
        <button class="btn primary" data-route-action="labs" data-lab-mode="abnormal">Показатели внимания</button>
        <button class="btn secondary" data-route-action="reports">Документы</button>
        <button class="btn ghost" data-route-action="appointments">Записаться</button>
        <button class="btn ghost" id="profileLogoutBtn">Выйти</button>
      </div>
    </section>
  `;

  document.getElementById("profileLogoutBtn").onclick = () => window.App.logout();
};
