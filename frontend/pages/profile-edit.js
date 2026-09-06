window.Pages = window.Pages || {};

window.Pages.profile = async function renderEditableProfile() {
  const [data, passkeyData] = await Promise.all([
    HealthAPI.summary(),
    HealthAPI.passkeysSupported() ? HealthAPI.listPasskeys().catch(() => ({ passkeys: [] })) : Promise.resolve({ passkeys: [] })
  ]);
  const p = data.patient;
  const passkeys = passkeyData.passkeys || [];
  const initials = String(p.name || "Пациент").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const sexText = p.sex === "female" ? "женский" : p.sex === "male" ? "мужской" : "не указан";
  const value = Cabinet.display;
  const escapeHtml = (item) => String(item ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const birthDateInput = (() => {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(p.birthDate || ""));
    return match ? `${match[3]}-${match[2]}-${match[1]}` : /^\d{4}-\d{2}-\d{2}$/.test(String(p.birthDate || "")) ? p.birthDate : "";
  })();
  const birth = birthDateInput ? new Date(birthDateInput + "T00:00:00") : null;
  const now = new Date();
  const age = birth && !Number.isNaN(birth.getTime()) ? now.getFullYear() - birth.getFullYear() - Number(now.getMonth() < birth.getMonth() || now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate()) : null;
  const isTester = App.user()?.role === "tester";

  UI.root().innerHTML = `<div class="cabinet-page profile-page">
    <section class="profile-columns">
      <div class="workspace-section">
        <div class="profile-identity">
          <div class="profile-avatar-large">${escapeHtml(initials)}</div>
          <div>
            <div class="eyebrow">Пациент</div>
            <h2>${escapeHtml(p.name)}</h2>
            <p class="muted">${age === null || age < 0 ? "Возраст не указан" : `${age} ${Cabinet.plural(age,"год","года","лет")}`} • ${sexText} • ${escapeHtml(value(p.clinic))}</p>
          </div>
          <button class="btn primary" id="profileEditBtn" type="button">Редактировать</button>
        </div>

        <div class="patient-fields" id="profileInfoView">
          <div class="patient-field"><span>Дата рождения</span><b>${escapeHtml(value(p.birthDate))}</b></div>
          <div class="patient-field"><span>Телефон</span><b>${escapeHtml(value(p.phone))}</b></div>
          <div class="patient-field"><span>Карта пациента</span><b>${escapeHtml(value(p.misCard))}</b></div>
          <div class="patient-field"><span>Полис</span><b>${escapeHtml(value(p.policy))}</b></div>
          <div class="patient-field"><span>Клиника</span><b>${escapeHtml(value(p.clinic))}</b></div>
          <div class="patient-field"><span>Регион</span><b>${escapeHtml(value(p.region))}</b></div>
        </div>

        <form id="profileEditForm" class="form-stack" hidden style="margin-top:18px">
          <div class="profile-form-grid">
            <label>ФИО<input id="profileName" value="${escapeHtml(p.name)}" maxlength="160" required /></label>
            <label>Дата рождения<input id="profileBirthDate" type="date" value="${escapeHtml(birthDateInput)}" required /></label>
            <label>Пол<select id="profileSex" required><option value="female" ${p.sex === "female" ? "selected" : ""}>Женский</option><option value="male" ${p.sex === "male" ? "selected" : ""}>Мужской</option></select></label>
            <label>Телефон<input id="profilePhone" type="tel" value="${escapeHtml(p.phone || "")}" maxlength="64" placeholder="+7 999 000-00-00" /></label>
            <label>Полис<input id="profilePolicy" value="${escapeHtml(p.policy || "")}" maxlength="128" /></label>
            <label>Клиника<input id="profileClinic" value="${escapeHtml(p.clinic || "")}" maxlength="255" /></label>
            <label>Регион<input id="profileRegion" value="${escapeHtml(p.region || "")}" maxlength="255" /></label>
            <label>Карта пациента<input value="${escapeHtml(value(p.misCard))}" readonly aria-readonly="true" /><small>Идентификатор карты меняется только через клинику.</small></label>
          </div>
          <p class="auth-error" id="profileEditError" role="alert" hidden></p>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="profileSaveBtn" type="submit">Сохранить изменения</button><button class="btn ghost" id="profileCancelBtn" type="button">Отмена</button></div>
        </form>

        <section class="profile-security-card" style="margin-top:18px;padding:18px;border:1px solid #e1e8eb;border-radius:18px;background:#fbfdfd">
          <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap">
            <div><div class="eyebrow">Безопасность</div><h3 style="margin:4px 0 6px">Вход по Face ID / отпечатку</h3><p class="muted" style="margin:0">Биометрия остаётся на устройстве. Атлас хранит только защищённый публичный ключ.</p></div>
            ${HealthAPI.passkeysSupported() ? '<button class="btn secondary" id="passkeySetupBtn" type="button">Настроить вход</button>' : '<span class="muted">Устройство не поддерживает Passkeys</span>'}
          </div>
          <div id="passkeyList" style="display:grid;gap:8px;margin-top:14px">
            ${passkeys.length ? passkeys.map((item) => `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid #e6ecef"><div><b>${escapeHtml(item.label || "Face ID / отпечаток")}</b><div class="muted" style="font-size:12px">Passkey подключён</div></div><button class="btn ghost small" data-delete-passkey="${escapeHtml(item.id)}" type="button">Удалить</button></div>`).join("") : '<p class="muted" style="margin:0">Быстрый вход пока не настроен.</p>'}
          </div>
          <p class="auth-error" id="passkeyError" role="alert" hidden style="margin-top:10px"></p>
        </section>
      </div>

      <aside class="workspace-section access-section">
        <h2>Доступ и данные</h2>
        <p class="section-note">Закрытое демо · Синтетические данные</p>
        <dl class="access-list">
          <div><dt>Лаборатория</dt><dd>Доступно</dd></div>
          ${isTester ? '<div><dt>Ввод результатов</dt><dd>Доступно</dd></div>' : ""}
          <div><dt>Запись к врачу</dt><dd class="demo-nav-badge">Демо</dd></div>
          <div><dt>Врачи</dt><dd class="demo-nav-badge">Демо</dd></div>
          <div><dt>Документы</dt><dd class="demo-nav-badge">Демо</dd></div>
        </dl>
        <p class="section-note">Карта пациента доступна только для чтения.</p>
      </aside>
    </section>

    <nav class="quick-links" aria-label="Действия профиля">
      <button class="btn ghost" data-route-action="labs" data-lab-mode="reports">Мои анализы</button>
      ${isTester ? '<button class="btn ghost" data-route-action="manual-lab-entry">Ввод результатов</button>' : ""}
      <button class="btn ghost" id="profileLogoutBtn">Выйти из кабинета</button>
    </nav></div>`;

  const editButton = document.getElementById("profileEditBtn");
  const form = document.getElementById("profileEditForm");
  const infoView = document.getElementById("profileInfoView");
  const errorElement = document.getElementById("profileEditError");
  function setEditing(editing) { form.hidden = !editing; infoView.hidden = editing; editButton.hidden = editing; if (editing) document.getElementById("profileName").focus(); else editButton.focus(); }
  editButton.onclick = () => setEditing(true);
  document.getElementById("profileCancelBtn").onclick = () => setEditing(false);
  document.getElementById("profileLogoutBtn").onclick = () => window.App.logout();

  const passkeyButton = document.getElementById("passkeySetupBtn");
  const passkeyError = document.getElementById("passkeyError");
  if (passkeyButton) passkeyButton.onclick = async () => {
    passkeyButton.disabled = true;
    passkeyError.hidden = true;
    try {
      await HealthAPI.registerPasskey();
      UI.toast("Вход по Face ID / отпечатку настроен");
      await window.App.render();
    } catch (error) {
      passkeyError.textContent = error.name === "NotAllowedError" || error.code === "passkey_cancelled" ? "Настройка отменена." : "Не удалось настроить быстрый вход на этом устройстве.";
      passkeyError.hidden = false;
      passkeyButton.disabled = false;
    }
  };
  document.querySelectorAll("[data-delete-passkey]").forEach((button) => {
    button.onclick = async () => { button.disabled = true; try { await HealthAPI.deletePasskey(button.dataset.deletePasskey); UI.toast("Способ входа удалён"); await window.App.render(); } catch (error) { button.disabled = false; } };
  });

  form.onsubmit = async (event) => {
    event.preventDefault();
    errorElement.hidden = true;
    const saveButton = document.getElementById("profileSaveBtn");
    saveButton.disabled = true;
    saveButton.textContent = "Сохраняем…";
    try {
      await HealthAPI.updatePatient({
        name: document.getElementById("profileName").value.trim(), birthDate: document.getElementById("profileBirthDate").value,
        sex: document.getElementById("profileSex").value, phone: document.getElementById("profilePhone").value.trim(),
        policy: document.getElementById("profilePolicy").value.trim(), clinic: document.getElementById("profileClinic").value.trim(), region: document.getElementById("profileRegion").value.trim()
      });
      UI.toast("Профиль обновлён");
      await window.App.render();
    } catch (error) {
      const messages = { profile_edit_not_available: "Этот демонстрационный профиль доступен только для чтения.", invalid_profile_name: "Проверьте ФИО.", invalid_birth_date: "Проверьте дату рождения.", invalid_profile_sex: "Проверьте пол.", profile_field_too_long: "Одно из полей заполнено слишком длинным значением." };
      errorElement.textContent = messages[error.code] || "Не удалось сохранить изменения.";
      errorElement.hidden = false;
      saveButton.disabled = false;
      saveButton.textContent = "Сохранить изменения";
    }
  };
};