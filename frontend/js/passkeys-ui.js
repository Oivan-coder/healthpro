(() => {
  function showMessage(text) {
    const error = document.getElementById("loginError");
    if (!error) return;
    error.classList.remove("is-success");
    error.textContent = text;
    error.hidden = false;
  }

  function installPasskeyButton() {
    if (!window.HealthAPI?.passkeysSupported?.()) return;
    const loginForm = document.getElementById("loginForm");
    const passwordLabel = document.getElementById("passwordInput")?.closest("label");
    const primaryButton = loginForm?.querySelector('button[type="submit"]');
    if (!loginForm || !passwordLabel || !primaryButton || document.getElementById("passkeyLoginBtn")) return;

    const separator = document.createElement("div");
    separator.style.cssText = "display:flex;align-items:center;gap:10px;color:#83909f;font-size:12px;margin:2px 0";
    separator.innerHTML = '<span style="height:1px;background:#e1e7ea;flex:1"></span><span>или</span><span style="height:1px;background:#e1e7ea;flex:1"></span>';

    const button = document.createElement("button");
    button.id = "passkeyLoginBtn";
    button.type = "button";
    button.className = "btn secondary wide";
    button.textContent = "Войти по Face ID / отпечатку";
    button.style.minHeight = "48px";

    primaryButton.insertAdjacentElement("afterend", separator);
    separator.insertAdjacentElement("afterend", button);

    const savedLogin = String(localStorage.getItem("atlas.passkeyLogin") || "").trim();
    const loginInput = document.getElementById("loginInput");
    if (savedLogin && loginInput && !loginInput.value) loginInput.value = savedLogin;

    button.addEventListener("click", async () => {
      const login = String(loginInput?.value || "").trim();
      if (!login) {
        showMessage("Сначала укажите логин.");
        loginInput?.focus();
        return;
      }
      button.disabled = true;
      const original = button.textContent;
      button.textContent = "Подтвердите на устройстве…";
      try {
        await HealthAPI.loginWithPasskey(login);
        localStorage.setItem("atlas.passkeyLogin", login);
        window.location.reload();
      } catch (error) {
        const messages = {
          passkey_not_available: "Для этой учётной записи быстрый вход ещё не настроен.",
          passkey_authentication_failed: "Не удалось подтвердить вход.",
          passkey_unsupported: "Это устройство не поддерживает быстрый вход.",
          password_change_required: "Сначала войдите по паролю и смените временный пароль."
        };
        showMessage(error?.name === "NotAllowedError" ? "Вход отменён." : (messages[error?.code] || "Не удалось войти по Face ID / отпечатку."));
        button.disabled = false;
        button.textContent = original;
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installPasskeyButton);
  else installPasskeyButton();
})();
