import { api, setAuth } from "./api.js";

export function renderAuth(onSuccess) {
  return `
    <div id="auth-view">
      <div class="form-card" id="login-form">
        <h2>⚽ Anmelden</h2>
        <div id="auth-alert"></div>
        <div class="form-group">
          <label>Nickname</label>
          <input id="login-nick" type="text" placeholder="Dein Nickname" autocomplete="username" />
        </div>
        <div class="form-group">
          <label>Passwort</label>
          <input id="login-pw" type="password" placeholder="Passwort" autocomplete="current-password" />
        </div>
        <button class="btn btn-primary" id="btn-login">Anmelden</button>
        <div class="form-switch">Noch kein Konto? <a id="show-register">Registrieren</a></div>
      </div>

      <div class="form-card" id="register-form" style="display:none">
        <h2>🎴 Registrieren</h2>
        <div id="reg-alert"></div>
        <div class="form-group">
          <label>Nickname</label>
          <input id="reg-nick" type="text" placeholder="z.B. MaxMuster" autocomplete="username" />
          <small style="color:var(--muted);font-size:.78rem">2-20 Zeichen, Buchstaben/Zahlen/_/-</small>
        </div>
        <div class="form-group">
          <label>Passwort</label>
          <input id="reg-pw" type="password" placeholder="Mindestens 4 Zeichen" autocomplete="new-password" />
        </div>
        <button class="btn btn-primary" id="btn-register">Registrieren</button>
        <div class="form-switch">Schon ein Konto? <a id="show-login">Anmelden</a></div>
      </div>
    </div>
  `;
}

export function bindAuth(onSuccess) {
  document.getElementById("show-register").onclick = () => {
    document.getElementById("login-form").style.display = "none";
    document.getElementById("register-form").style.display = "block";
  };
  document.getElementById("show-login").onclick = () => {
    document.getElementById("register-form").style.display = "none";
    document.getElementById("login-form").style.display = "block";
  };

  document.getElementById("btn-login").onclick = async () => {
    const nick = document.getElementById("login-nick").value.trim();
    const pw   = document.getElementById("login-pw").value;
    const alert = document.getElementById("auth-alert");
    alert.innerHTML = "";
    if (!nick || !pw) { showAlert(alert, "Bitte alle Felder ausfüllen", "error"); return; }
    try {
      const data = await api.login(nick, pw);
      setAuth(data.access_token, data.user);
      onSuccess(data.user);
    } catch (e) {
      showAlert(alert, e.message, "error");
    }
  };

  document.getElementById("btn-register").onclick = async () => {
    const nick = document.getElementById("reg-nick").value.trim();
    const pw   = document.getElementById("reg-pw").value;
    const alert = document.getElementById("reg-alert");
    alert.innerHTML = "";
    if (!nick || !pw) { showAlert(alert, "Bitte alle Felder ausfüllen", "error"); return; }
    try {
      await api.register(nick, pw);
      showAlert(alert,
        "Registrierung erfolgreich! Der Admin wird dein Konto in Kürze freischalten.",
        "success");
      document.getElementById("reg-nick").value = "";
      document.getElementById("reg-pw").value = "";
    } catch (e) {
      showAlert(alert, e.message, "error");
    }
  };

  // Enter key support
  ["login-nick","login-pw"].forEach(id => {
    document.getElementById(id).addEventListener("keydown", e => {
      if (e.key === "Enter") document.getElementById("btn-login").click();
    });
  });
  ["reg-nick","reg-pw"].forEach(id => {
    document.getElementById(id).addEventListener("keydown", e => {
      if (e.key === "Enter") document.getElementById("btn-register").click();
    });
  });
}

export function showAlert(el, msg, type) {
  el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
}
