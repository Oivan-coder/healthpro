window.Pages = window.Pages || {};

window.Pages.reports = async function renderReports() {
  const data = await HealthAPI.reports();

  UI.root().innerHTML = `
    <section class="medical-folder">
      <div class="folder-hero feed-card">
        <div>
          <div class="label">Медицинская папка</div>
          <h2>Документы и заключения</h2>
          <p class="muted">Здесь собраны файлы, связанные с анализами и консультациями. PDF можно открыть или скачать для приема.</p>
        </div>
        <button class="btn secondary" data-route-action="labs" data-lab-mode="reports">К анализам</button>
      </div>

      <section class="folder-grid">
        <div class="feed-card">
          <div class="label">Заключения</div>
          <h2>Врачебные рекомендации</h2>
          <div class="document-card-grid">
          ${data.reports.map(r => `
            <article class="document-card">
              <div class="document-card-head">
                <span class="status ${r.status==="Новое" ? "info" : "ok"}">${r.status}</span>
                <span class="pill">Заключение</span>
              </div>
              <div>
                <h3>${r.title}</h3>
                <p class="muted">${r.date}</p>
              </div>
              <p><b>${r.doctor}</b></p>
              <p class="muted document-card-text">${r.text}</p>
              <div class="document-actions single">
                <button class="btn secondary" type="button" data-route-action="assistant">Обсудить с врачом</button>
              </div>
            </article>
          `).join("")}
          </div>
        </div>

        <aside class="feed-card">
          <div class="label">Файлы</div>
          <h2>PDF и справки</h2>
          <div class="folder-list">
          ${data.docs.map(d => `
            <article class="document-row folder-item">
              <div class="icon-bubble">${d.icon}</div>
              <div class="folder-item-main">
                <b>${d.title}</b>
                <div class="folder-item-meta">
                  <span>${d.date}</span>
                  <span>${d.type || "PDF"}</span>
                  <span>${d.size || "размер уточняется"}</span>
                </div>
              </div>
              <span class="pill">${d.type || "PDF"}</span>
              <div class="document-actions">
                <button class="btn ghost document-download-btn" data-document-action="open" data-document-id="${d.id}" data-document-title="${d.title}">Открыть</button>
                <a class="btn secondary document-download-btn" data-document-action="download" href="${HealthAPI.documentDownloadUrl(d.id)}" download>Скачать PDF</a>
              </div>
            </article>
          `).join("")}
          </div>
        </aside>
      </section>
    </section>
  `;

  document.querySelectorAll("[data-document-id]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.documentId;
      const url = HealthAPI.documentDownloadUrl(id);
      if (btn.dataset.documentAction === "open") {
        const viewer = window.open("about:blank", "_blank");
        if (viewer) viewer.opener = null;
        try {
          const response = await fetch(url);
          if (!response.ok) {
            if (viewer) viewer.close();
            UI.toast("PDF будет доступен после подключения МИС/ЛИС.");
            return;
          }
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          if (viewer) viewer.location.href = objectUrl;
          UI.toast("Документ открыт");
        } catch (error) {
          if (viewer) viewer.close();
          UI.toast("PDF будет доступен после подключения МИС/ЛИС.");
        }
        return;
      }
    };
  });
};
