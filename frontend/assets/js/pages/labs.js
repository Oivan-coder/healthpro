window.Pages = window.Pages || {};

window.LabState = {
  group: "Все",
  query: "",
  selectedCode: "GLU"
};

window.Pages.labs = async function renderLabs() {
  const data = await HealthAPI.labs();
  const groups = data.groups;
  let labs = data.labs;

  if (LabState.group !== "Все") labs = labs.filter(x => x.group === LabState.group);
  if (LabState.query) {
    const q = LabState.query.toLowerCase();
    labs = labs.filter(x => `${x.name} ${x.group} ${x.code} ${x.loinc}`.toLowerCase().includes(q));
  }

  if (!labs.find(x => x.code === LabState.selectedCode)) LabState.selectedCode = labs[0]?.code || data.labs[0].code;
  const selected = data.labs.find(x => x.code === LabState.selectedCode) || data.labs[0];

  UI.root().innerHTML = `
    <section class="metric-strip">
      <div class="card metric-card"><div class="label">Справочник</div><div class="kpi-number">${data.catalog.length}</div><p class="muted">показателей</p></div>
      <div class="card metric-card"><div class="label">Отклонения</div><div class="kpi-number">${data.labs.filter(x=>x.flag!=="normal").length}</div><p class="muted">требуют внимания</p></div>
      <div class="card metric-card"><div class="label">Группы</div><div class="kpi-number">${groups.length-1}</div><p class="muted">разделов</p></div>
      <div class="card metric-card"><div class="label">LOINC</div><div class="kpi-number">${data.catalog.filter(x=>x.loinc).length}</div><p class="muted">кодов заполнено</p></div>
    </section>

    <div class="toolbar">
      <input id="labSearch" placeholder="Поиск: глюкоза, ТТГ, CRP, LOINC..." value="${LabState.query}">
      <button class="btn ghost" id="scrollToChart">К графику</button>
    </div>

    <div class="tabs">
      ${groups.map(g => `<button class="tab ${g===LabState.group ? "active":""}" data-lab-group="${g}">${g}</button>`).join("")}
    </div>

    <section class="lab-layout">
      <div class="card">
        <div class="label">Показатели</div>
        <h2>${LabState.group}</h2>
        <div class="lab-list">
          ${labs.map(lab => `
            <button class="lab-card ${lab.code===LabState.selectedCode ? "active":""}" data-lab-code="${lab.code}">
              <div class="lab-card-head">
                <div>
                  <div class="lab-name">${lab.name}</div>
                  <small class="muted">${lab.code} • ${lab.group}</small>
                </div>
                <span class="status ${UI.statusClass(lab.flag)}">${UI.statusText(lab.flag)}</span>
              </div>
              <div class="lab-value">${UI.labValue(lab)}</div>
              <small class="muted">Референс: ${lab.low}–${lab.high} ${lab.unit}</small>
              ${UI.sparkline(lab)}
            </button>
          `).join("") || UI.renderEmpty("Ничего не найдено.")}
        </div>
      </div>

      <div class="card lab-detail" id="labChartAnchor">
        <div class="detail-head">
          <div>
            <div class="label">${selected.group} • ${selected.code} • LOINC ${selected.loinc}</div>
            <h2>${selected.name}</h2>
            <p class="muted">Последнее значение: ${selected.latestDate}</p>
          </div>
          <div>
            <div class="detail-value">${UI.labValue(selected)}</div>
            <span class="status ${UI.statusClass(selected.flag)}">${UI.statusText(selected.flag)}</span>
          </div>
        </div>

        <div class="interpretation">
          <b>Пациентское пояснение</b>
          <p class="muted">${selected.interpretation}</p>
        </div>

        <div class="tile-grid">
          <div class="tile"><span class="label">Референс</span><b>${selected.low}–${selected.high} ${selected.unit}</b></div>
          <div class="tile"><span class="label">Код ЛИС</span><b>${selected.code}</b></div>
          <div class="tile"><span class="label">LOINC</span><b>${selected.loinc}</b></div>
          <div class="tile"><span class="label">Тип</span><b>${selected.graphable ? "График" : "Текст"}</b></div>
        </div>

        <canvas id="labChart" class="chart"></canvas>
      </div>
    </section>
  `;

  document.querySelectorAll("[data-lab-group]").forEach(btn => btn.onclick = () => {
    LabState.group = btn.dataset.labGroup;
    window.App.render();
  });

  document.querySelectorAll("[data-lab-code]").forEach(btn => btn.onclick = () => {
    LabState.selectedCode = btn.dataset.labCode;
    window.App.render();
  });

  document.getElementById("labSearch").oninput = (e) => {
    LabState.query = e.target.value;
    window.App.render();
  };

  document.getElementById("scrollToChart").onclick = () => {
    document.getElementById("labChartAnchor").scrollIntoView({ behavior: "smooth", block: "start" });
  };

  setTimeout(() => Charts.drawLabChart(document.getElementById("labChart"), selected), 20);
};

window.Pages["lab-history"] = async function renderLabHistory() {
  const rows = await HealthAPI.labHistory();

  UI.root().innerHTML = `
    <section class="card">
      <div class="label">Структурированные лабораторные наблюдения</div>
      <h2>История значений по датам</h2>
      <p class="muted">Это демонстрация того, как данные будут храниться в собственной БД-витрине после интеграции с МИС/ЛИС.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Дата</th><th>Группа</th><th>Код</th><th>Показатель</th><th>Значение</th><th>Референс</th><th>Статус</th><th>LOINC</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>${row.date}</td>
                <td>${row.group}</td>
                <td><b>${row.code}</b></td>
                <td>${row.name}</td>
                <td><b>${row.value} ${row.unit}</b></td>
                <td>${row.low}–${row.high} ${row.unit}</td>
                <td><span class="status ${UI.statusClass(row.flag)}">${UI.statusText(row.flag)}</span></td>
                <td>${row.loinc}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
};
