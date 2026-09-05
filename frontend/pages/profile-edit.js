window.Pages = window.Pages || {};

window.Pages.profile = async function renderEditableProfile() {
  const data = await HealthAPI.summary();
  const p = data.patient;
  const initials = String(p.name || "Пациент").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const sexText = p.sex === "female" ? "женский" : p.sex === "male" ? "мужской" : "не указан";
  const value = (item) => item === null || item === undefined || item === "null" ? "—" : String(item);
  const escapeHtml = (item) => String(item ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const birthDateInput = (() => {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(p.birthDate || ""));
    return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
  })();

  UI.root().innerHTML = `
    <section class="profile-layout">
      <div class="profile-card card">
        <div class="profile-hero-card">
          <div class="profile-avatar-large">${escapeHtml(initials)}</div>
          <div>
            <div class="label">Пациент</div>
            <h2>${escapeHtml(p.name)}</h2>
            <p class="muted">${Number(p.age || 0)} лет • ${sexText} • ${escapeHtml(value(p.clinic))}</p>
          </div>
          <button class="btn secondary" id="profileEditBtn" type="button">Редактировать</button>
        </div>

        <div class="profile-info-grid" id="profileInfoView">
          <div class="profile-info-item"><span>Дата рождения</span><b>${escapeHtml(value(p.birthDate))}</b></div>
          <div class="profile-info-item"><span>Телефон</span><b>${escapeHtml(value(p.phone))}</b></div>
          <div class="profile-info-item"><span>Карта пациента</span><b>${escapeHtml(value(p.misCard))}</b></div>
          <div class="profile-info-item"><span>Полис</span><b>${escapeHtml(value(p.policy))}</b></div>
        </div>

        <form id="profileEditForm" class="form-stack" hidden style="margin-top:18px">
          <div class="grid-2">
            <label>ФИО
              <input id="profileName" value="${escapeHtml(p.name)}" maxlength="160" required />
            </label>
            <label>Дата рождения
              <input id="profileBirthDate" type="date" value="${escapeHtml(birthDateInput)}" required />
            </label>
            <label>Пол
              <select id="profileSex" required>
                <option value="female" ${p.sex === "female" ? "selected" : ""}>Женский</option>
                <option value="male" ${p.sex === "male" ? "selected" : ""}>Мужской</option>
              </select>
            </label>
            <label>Телефон
              <input id="profilePhone" type="tel" value="${escapeHtml(p.phone || "")}" maxlength="64" placeholder="+7 999 000-00-00" />
            </label>
            <label>Полис
              <input id="profilePolicy" value="${escapeHtml(p.policy || "")}" maxlength="128" />
            </label>
            <label>Клиника
              <input id="profileClinic" value="${escapeHtml(p.clinic || "")}" maxlength="255" />
            </label>
            <label>Регион
              <input id="profileRegion" value="${escapeHtml(p.region || "")}" maxlength="255" />
            </label>
            <label>Карта пациента
              <input value="${escapeHtml(p.misCard || "")}" disabled />
              <small>Идентификатор карты меняется только через клинику.</small>
            </label>
          </div>
          <p class="auth-error" id="profileEditError" role="alert" hidden></p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn primary" id="profileSaveBtn" type="submit">Сохранить изменения</button>
            <button class="btn ghost" id="profileCancelBtn" type="button">Отмена</button>
          </div>
        </form>

        <div class="profile-note">
          <div class="icon-bubble ok">✓</div>
          <div>
            <b>Карта клиники привязана</b>
            <p class="muted">По этой карте в кабинет попадают исследования пациента.</p>
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
            <div><b>Лаборатория</b><span>исследования, показатели внимания и динамика доступны</span></div>
          </div>
          <div class="profile-status-item">
            <div class="icon-bubble warn">Демо</div>
            <div><b>Документы</b><span>раздел предусмотрен, но в закрытом демо временно недоступен</span></div>
          </div>
          <div class="profile-status-item">
            <div class="icon-bubble warn">Демо</div>
            <div><b>Запись к врачу</b><span>раздел предусмотрен, но в закрытом демо временно недоступен</span></div>
          </div>
          <div class="profile-status-item">
            <div class="icon-bubble ok">✓</div>
            <div><b>Профиль</b><span>контактные и основные данные можно редактировать самостоятельно</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="profile-actions card">
      <div>
        <div class="label">Быстрые действия</div>
        <h2>Управление кабинетом</h2>
      </div>
      <div class="profile-action-buttons">
        <button class="btn primary" data-route-action="labs" data-lab-mode="abnormal">Показатели внимания</button>
        <button class="btn ghost" id="profileLogoutBtn">Выйти</button>
      </div>
    </section>
  `;

  const editButton = document.getElementById("profileEditBtn");
  const form = document.getElementById("profileEditForm");
  const infoView = document.getElementById("profileInfoView");
  const errorElement = document.getElementById("profileEditError");

  function setEditing(editing) {
    form.hidden = !editing;
    infoView.hidden = editing;
    editButton.hidden = editing;
  }

  editButton.onclick = () => setEditing(true);
  document.getElementById("profileCancelBtn").onclick = () => setEditing(false);
  document.getElementById("profileLogoutBtn").onclick = () => window.App.logout();

  form.onsubmit = async (event) => {
    event.preventDefault();
    errorElement.hidden = true;
    const saveButton = document.getElementById("profileSaveBtn");
    saveButton.disabled = true;
    saveButton.textContent = "Сохраняем…";
    try {
      await HealthAPI.updatePatient({
        name: document.getElementById("profileName").value.trim(),
        birthDate: document.getElementById("profileBirthDate").value,
        sex: document.getElementById("profileSex").value,
        phone: document.getElementById("profilePhone").value.trim(),
        policy: document.getElementById("profilePolicy").value.trim(),
        clinic: document.getElementById("profileClinic").value.trim(),
        region: document.getElementById("profileRegion").value.trim()
      });
      UI.toast("Профиль обновлён");
      await window.App.render();
    } catch (error) {
      const messages = {
        invalid_profile_name: "Проверьте ФИО.",
        invalid_birth_date: "Проверьте дату рождения.",
        invalid_profile_sex: "Проверьте пол.",
        profile_field_too_long: "Одно из полей заполнено слишком длинным значением."
      };
      errorElement.textContent = messages[error.code] || "Не удалось сохранить изменения.";
      errorElement.hidden = false;
      saveButton.disabled = false;
      saveButton.textContent = "Сохранить изменения";
    }
  };
};
