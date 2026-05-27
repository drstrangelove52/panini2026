import { api } from "./api.js";

const EVENT_STYLE = {
  LOGIN:         { label: "Login",         color: "#15803d" },
  LOGIN_FAIL:    { label: "Login Fehler",  color: "#b91c1c" },
  REGISTER:      { label: "Registrierung", color: "#1d4ed8" },
  REGISTER_FAIL: { label: "Reg. Fehler",   color: "#b91c1c" },
};

export async function renderLog(container) {
  container.innerHTML = `
    <div class="page-title" style="display:flex;align-items:center;justify-content:space-between">
      <span>🔐 Zugriffslog</span>
      <button class="btn btn-outline btn-sm" id="btn-refresh-log">Aktualisieren</button>
    </div>
    <div id="log-content"><div class="spinner"></div></div>
  `;
  document.getElementById("btn-refresh-log").addEventListener("click", () => loadLog());
  await loadLog();
}

async function loadLog() {
  const el = document.getElementById("log-content");
  if (!el) return;
  el.innerHTML = `<div class="spinner"></div>`;
  try {
    const events = await api.securityLog();
    if (!events.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔐</div>Noch keine Einträge</div>`;
      return;
    }
    const rows = events.map(e => {
      const s = EVENT_STYLE[e.event] || { label: e.event, color: "var(--muted)" };
      const ts = new Date(e.timestamp).toLocaleString("de-CH");
      return `<tr>
        <td style="white-space:nowrap;font-size:.78rem">${ts}</td>
        <td><span style="font-weight:700;color:${s.color}">${s.label}</span></td>
        <td>${e.nickname || "–"}</td>
        <td style="font-family:monospace;font-size:.78rem">${e.ip || "–"}</td>
        <td style="font-size:.75rem;color:var(--muted)">${e.details || ""}</td>
      </tr>`;
    }).join("");
    el.innerHTML = `
      <div style="font-size:.78rem;color:var(--muted);padding:4px 0 8px">
        ${events.length} Einträge (max. 200)
      </div>
      <div style="overflow-x:auto">
        <table class="admin-table">
          <thead><tr><th>Zeit</th><th>Ereignis</th><th>Nickname</th><th>IP</th><th>Details</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}
