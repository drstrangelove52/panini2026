import { api } from "./api.js";

const EVENT_STYLE = {
  ACCESS:        { label: "Seitenaufruf",  color: "var(--muted)" },
  LOGIN:         { label: "Login",         color: "#15803d" },
  LOGIN_FAIL:    { label: "Login Fehler",  color: "#b91c1c" },
  REGISTER:      { label: "Registrierung", color: "#1d4ed8" },
  REGISTER_FAIL: { label: "Reg. Fehler",   color: "#b91c1c" },
};

/** Flag image + code — works on Windows (no emoji flag support there) */
function flagHtml(code) {
  if (!code || code.length !== 2) return "–";
  const lower = code.toLowerCase();
  return `<img src="https://flagcdn.com/16x12/${lower}.png"
               width="16" height="12" alt="${code}"
               style="vertical-align:middle;margin-right:4px;border-radius:1px"
               onerror="this.style.display='none'"
         >${code}`;
}

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

    const foreignCount = events.filter(e => e.country_code && e.country_code !== "CH").length;

    const rows = events.map(e => {
      const s  = EVENT_STYLE[e.event] || { label: e.event, color: "var(--muted)" };
      const ts = new Date(e.timestamp).toLocaleString("de-CH", { timeZone: "Europe/Zurich" });
      const isForeign = e.country_code && e.country_code !== "CH";
      const flag = flagHtml(e.country_code || "");
      const rowBg = isForeign ? "background:#fff1f2" : "";
      const warn  = isForeign ? `<span title="Ausländischer Zugriff!" style="color:#b91c1c">⚠️</span> ` : "";

      return `<tr style="${rowBg}">
        <td style="white-space:nowrap;font-size:.78rem">${ts}</td>
        <td>${warn}<span style="font-weight:700;color:${s.color}">${s.label}</span></td>
        <td>${e.nickname || "–"}</td>
        <td style="font-family:monospace;font-size:.78rem">${e.ip || "–"}</td>
        <td style="font-size:.9rem">${flag}</td>
        <td style="font-size:.75rem;color:var(--muted)">${e.details || ""}</td>
      </tr>`;
    }).join("");

    const foreignBanner = foreignCount > 0
      ? `<div style="background:#fff1f2;border:1.5px solid #fca5a5;border-radius:8px;
                     padding:8px 12px;margin-bottom:10px;font-size:.85rem;color:#b91c1c">
           ⚠️ <strong>${foreignCount} Zugriff${foreignCount > 1 ? "e" : ""}</strong>
           aus dem Ausland in den letzten 200 Einträgen
         </div>`
      : "";

    el.innerHTML = `
      ${foreignBanner}
      <div style="font-size:.78rem;color:var(--muted);padding:4px 0 8px">
        ${events.length} Einträge (max. 200)
      </div>
      <div style="overflow-x:auto">
        <table class="admin-table">
          <thead><tr><th>Zeit</th><th>Ereignis</th><th>Nickname</th><th>IP</th><th>Land</th><th>Details</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}
