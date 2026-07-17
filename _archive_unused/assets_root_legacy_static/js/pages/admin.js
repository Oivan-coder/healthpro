window.Pages = window.Pages || {};

const sampleImport = [
  { "code": "GLU", "value": 6.0, "date": "15.05.2026" },
  { "code": "CHOL", "value": 5.4, "date": "15.05.2026" },
  { "code": "CRP", "value": 4.2, "date": "15.05.2026" },
  { "code": "VITD", "value": 25, "date": "15.05.2026" }
];

window.Pages.import = async function renderImport() {
  const data = await HealthAPI.labs();

  UI.root().innerHTML = `
    <section class="import-layout">
      <div class="card">
        <div class="label">Демо-импорт</div>
        <h2>Загрузка лабораторных данных</h2>
        <p class="muted">В пилоте это может быть JSON/CSV-выгрузка из ЛИС/МИС. Позже тот же формат станет API-контрактом.</p>

        <textarea id="importText">${JSON.stringify(sampleImport, null, 2)}</textarea>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
          <button class="btn primary" id="importBtn">Импортировать</button>
          <button class="btn secondary" id="fillSampleBtn">Вставить пример</button>
          <button class="btn ghost" id="exportBtn">Экспортировать текущую БД</button>
        </div>
      </div>

      <aside class="card">
        <div class="label">Контроль качества</div>
        <h2>Что проверяем</h2>
        <div class="list">
          <div class="row-card"><div class="icon-bubble ok">✓</div><div><b>Код показателя</b><div class="muted">должен быть в справочнике</div></div></div>
          <div class="row-card"><div class="icon-bubble ok">✓</div><div><b>Числовое значение</b><div class="muted">для построения графика</div></div></div>
          <div class="row-card"><div class="icon-bubble ok">✓</div><div><b>Дата результата</b><div class="muted">для истории и динамики</div></div></div>
          <div class="row-card"><div class="icon-bubble warn">!</div><div><b>Референсы</b><div class="muted">берутся из справочника MVP</div></div></div>
        </div>
      </aside>
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

  document.getElementById("importBtn").onclick = async () => {
    try {
      const items = JSON.parse(document.getElementById("importText").value);
      await HealthAPI.importLabObservations(Array.isArray(items) ? items : []);
      UI.toast("Данные импортированы");
      window.App.navigate("labs");
    } catch (error) {
      UI.toast("Ошибка JSON");
    }
  };

  document.getElementById("exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(HealthStore.get(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "health-id-demo-db.json";
    link.click();
    URL.revokeObjectURL(url);
  };
};

window.Pages.integration = async function renderIntegration() {
  UI.root().innerHTML = `
    <section class="grid-2">
      <div class="card">
        <div class="label">Пилотная логика</div>
        <h2>Данные клиники → пациентская витрина</h2>
        <p class="muted">Первый этап можно начать без сложной промышленной интеграции: достаточно структурированной выгрузки по 50–200 пациентам и 30–50 лабораторным показателям.</p>
        <div class="code-box">МИС/ЛИС
  ↓ JSON/CSV/API
Health ID import layer
  ↓ нормализация
Собственная БД-витрина
  ↓ API приложения
Личный кабинет пациента</div>
      </div>

      <div class="card">
        <div class="label">Что нужно от клиники</div>
        <h2>Минимальный набор</h2>
        <div class="list">
          <div class="row-card"><div class="icon-bubble">1</div><div><b>Тестовые пациенты</b><div class="muted">50–200 человек для пилота</div></div></div>
          <div class="row-card"><div class="icon-bubble">2</div><div><b>Лабораторные данные</b><div class="muted">30–50 показателей в структурированном виде</div></div></div>
          <div class="row-card"><div class="icon-bubble">3</div><div><b>Инженер МИС/ЛИС</b><div class="muted">1 контакт для выгрузки/интеграции</div></div></div>
          <div class="row-card"><div class="icon-bubble">4</div><div><b>Критерии успеха</b><div class="muted">вовлеченность, повторы, NPS, обращения</div></div></div>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top:16px">
      <div class="label">API-контракт первой очереди</div>
      <h2>Достаточно для PoC</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Метод</th><th>Назначение</th><th>Статус для MVP</th><th>Критерий успеха</th></tr></thead>
          <tbody>
            <tr><td><b>GET /patients/by-card</b></td><td>Поиск пациента по карте МИС</td><td>mock / позже API</td><td>пациент найден и привязан</td></tr>
            <tr><td><b>GET /lab-results</b></td><td>Получение лабораторных результатов</td><td>JSON import</td><td>показатели появились в графиках</td></tr>
            <tr><td><b>GET /visits</b></td><td>Приемы пациента</td><td>mock</td><td>отображение в ЛК</td></tr>
            <tr><td><b>GET /reports</b></td><td>Заключения врачей</td><td>mock/PDF</td><td>документы доступны пациенту</td></tr>
            <tr><td><b>POST /appointments/book</b></td><td>Запись на прием</td><td>заглушка</td><td>заявка создана</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
};

window.Pages.profile = async function renderProfile() {
  const data = await HealthAPI.summary();
  const p = data.patient;

  UI.root().innerHTML = `
    <section class="grid-2">
      <div class="card">
        <div class="label">Пациент</div>
        <h2>${p.name}</h2>
        <div class="tile-grid">
          <div class="tile"><span class="label">Возраст</span><b>${p.age}</b></div>
          <div class="tile"><span class="label">Дата рождения</span><b>${p.birthDate}</b></div>
          <div class="tile"><span class="label">Пол</span><b>${p.sex}</b></div>
          <div class="tile"><span class="label">Телефон</span><b>${p.phone}</b></div>
          <div class="tile"><span class="label">Карта МИС</span><b>${p.misCard}</b></div>
          <div class="tile"><span class="label">ID МИС</span><b>${p.misPatientId}</b></div>
          <div class="tile"><span class="label">Полис</span><b>${p.policy}</b></div>
          <div class="tile"><span class="label">Клиника</span><b>${p.clinic}</b></div>
        </div>
      </div>

      <div class="card">
        <div class="label">Статус MVP</div>
        <h2>Что уже имитируется</h2>
        <div class="list">
          <div class="row-card"><div class="icon-bubble ok">✓</div><div><b>Локальная БД</b><div class="muted">localStorage вместо backend</div></div></div>
          <div class="row-card"><div class="icon-bubble ok">✓</div><div><b>Mock API</b><div class="muted">асинхронные методы вместо сервера</div></div></div>
          <div class="row-card"><div class="icon-bubble ok">✓</div><div><b>Справочник</b><div class="muted">коды, группы, единицы, LOINC</div></div></div>
          <div class="row-card"><div class="icon-bubble warn">→</div><div><b>Следующий шаг</b><div class="muted">заменить mock API на backend + PostgreSQL</div></div></div>
        </div>
      </div>
    </section>
  `;
};
