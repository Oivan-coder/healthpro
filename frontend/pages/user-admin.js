window.Pages = window.Pages || {};

window.Pages["admin-users"] = async function renderAdminUsers() {
  const root = UI.root();
  const result = await HealthAPI.adminListUsers();
  const users = result?.users || [];

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ru-RU");
  };

  root.innerHTML = `
    <section class="grid-2">
      <div class="card">
        <div class="label">Закрытый демо-контур</div>
        <h2>Создать пользователя</h2>
        <p class="muted">Учётная запись будет сохранена в MySQL. Временный пароль в открытом виде не хранится.</p>

        <form id="createDemoUserForm" class="form-stack">
          <label>ФИО
            <input id="newUserDisplayName" value="Иванов Иван Иванович" required />
          </label>
          <label>Логин
            <input id="newUserLogin" value="ivanov" autocomplete="off" required />
          </label>
          <label>Временный пароль
            <input id="newUserPassword" type="password" minlength="10" autocomplete="new-password" required />
          </label>
          <label>Роль
            <select id="newUserRole">
              <option value="user">Пользователь</option>
              <option value="admin">Администратор</option>
            </select>
          </label>
          <label>Тестовый профиль пациента
            <input id="newUserPatientId" value="p_001" />
          </label>
          <p class="muted">Для обычного пользователя укажите синтетический patient_id. Для администратора поле можно оставить пустым.</p>
          <button class="btn primary" type="submit">Создать учётную запись</button>
        </form>
      </div>

      <div class="card">
        <div class="label">Правила доступа</div>
        <h2>Как работает демо-контур</h2>
        <div class="list">
          <div class="row-card"><div class="icon-bubble ok">✓</div><div><b>Серверный вход</b><div class="muted">Сессия создаётся backend и хранится в защищённой cookie.</div></div></div>
          <div class="row-card"><div class="icon-bubble ok">✓</div><div><b>Временный пароль</b><div class="muted">При первом входе система потребует установить новый.</div></div></div>
          <div class="row-card"><div class="icon-bubble ok">✓</div><div><b>Синтетические данные</b><div class="muted">Учётки и данные тестовые, механизм хранения настоящий.</div></div></div>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top:16px">
      <div class="section-head">
        <div>
          <div class="label">Администрирование</div>
          <h2>Пользователи</h2>
        </div>
        <span class="status info">${users.length} учётных записей</span>
      </div>
      <div class="table-wrap user-table-wrap" tabindex="0" role="region" aria-label="Пользователи, таблицу можно прокручивать по горизонтали">
        <table>
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Логин</th>
              <th>Роль</th>
              <th>Статус</th>
              <th>Профиль</th>
              <th>Последний вход</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            ${users.map((user) => `
              <tr>
                <td><b>${escapeHtml(user.displayName)}</b>${user.mustChangePassword ? `<br><small class="muted">ожидается смена пароля</small>` : ""}</td>
                <td>${escapeHtml(user.login)}</td>
                <td>${user.role === "admin" ? "Администратор" : "Пользователь"}</td>
                <td><span class="status ${user.status === "active" ? "ok" : "warn"}">${user.status === "active" ? "Активен" : "Заблокирован"}</span></td>
                <td>${escapeHtml(user.patientId || "—")}</td>
                <td>${formatDate(user.lastLoginAt)}</td>
                <td>
                  <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn ghost small" data-reset-password="${escapeHtml(user.id)}">Сбросить пароль</button>
                    <button class="btn ${user.status === "active" ? "ghost" : "secondary"} small" data-set-status="${escapeHtml(user.id)}" data-next-status="${user.status === "active" ? "blocked" : "active"}">${user.status === "active" ? "Заблокировать" : "Разблокировать"}</button>
                  </div>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="7" class="muted">Пользователей пока нет.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;

  document.getElementById("newUserRole").onchange = (event) => {
    const patientInput = document.getElementById("newUserPatientId");
    if (event.target.value === "admin") patientInput.value = "";
    else if (!patientInput.value) patientInput.value = "p_001";
  };

  document.getElementById("createDemoUserForm").onsubmit = async (event) => {
    event.preventDefault();
    try {
      await HealthAPI.adminCreateUser({
        displayName: document.getElementById("newUserDisplayName").value.trim(),
        login: document.getElementById("newUserLogin").value.trim(),
        temporaryPassword: document.getElementById("newUserPassword").value,
        role: document.getElementById("newUserRole").value,
        patientId: document.getElementById("newUserPatientId").value.trim() || null
      });
      UI.toast("Пользователь создан");
      await window.App.render();
    } catch (error) {
      const messages = {
        login_already_exists: "Такой логин уже существует",
        password_too_short: "Пароль должен быть не короче 10 символов",
        invalid_patient_id: "Указан неизвестный тестовый профиль"
      };
      UI.toast(messages[error.code] || "Не удалось создать пользователя");
    }
  };

  root.querySelectorAll("[data-set-status]").forEach((button) => {
    button.onclick = async () => {
      try {
        await HealthAPI.adminSetUserStatus(button.dataset.setStatus, button.dataset.nextStatus);
        UI.toast(button.dataset.nextStatus === "blocked" ? "Пользователь заблокирован" : "Пользователь разблокирован");
        await window.App.render();
      } catch (error) {
        UI.toast(error.code === "cannot_block_self" ? "Нельзя заблокировать собственную учётную запись" : "Не удалось изменить статус");
      }
    };
  });

  root.querySelectorAll("[data-reset-password]").forEach((button) => {
    button.onclick = async () => {
      const temporaryPassword = window.prompt("Введите новый временный пароль (не менее 10 символов)");
      if (!temporaryPassword) return;
      try {
        await HealthAPI.adminResetPassword(button.dataset.resetPassword, temporaryPassword);
        UI.toast("Временный пароль установлен");
        await window.App.render();
      } catch (error) {
        UI.toast(error.code === "password_too_short" ? "Пароль должен быть не короче 10 символов" : "Не удалось сбросить пароль");
      }
    };
  });
};
