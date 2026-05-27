import { api } from "./api.js";

export async function renderAdmin(container) {
  container.innerHTML = `
    <div class="page-title">⚙️ Admin</div>
    <div id="admin-content"><div class="spinner"></div></div>
  `;

  await loadAdmin();
}

async function loadAdmin() {
  const el = document.getElementById("admin-content");
  try {
    const [stats, users] = await Promise.all([api.adminStats(), api.adminUsers()]);
    el.innerHTML = renderStats(stats) + renderUsers(users) + renderStickerSection();
    bindAdmin(users);
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

function renderStats(s) {
  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num">${s.active_users}</div><div class="stat-label">Aktive Nutzer</div></div>
      <div class="stat-card">
        <div class="stat-num" style="color:${s.pending_users > 0 ? 'var(--chain)' : 'var(--green)'}">${s.pending_users}</div>
        <div class="stat-label">Ausstehend</div>
      </div>
      <div class="stat-card"><div class="stat-num">${s.total_stickers}</div><div class="stat-label">Sticker</div></div>
      <div class="stat-card"><div class="stat-num">${s.total_users}</div><div class="stat-label">Alle Nutzer</div></div>
    </div>`;
}

function renderUsers(users) {
  if (!users.length) return `<div class="empty-state"><div class="empty-icon">👥</div>Noch keine Nutzer</div>`;

  const rows = users.map(u => {
    let statusBadge = u.is_admin
      ? `<span class="status-badge status-admin">Admin</span>`
      : u.is_active
        ? `<span class="status-badge status-active">Aktiv</span>`
        : `<span class="status-badge status-pending">Ausstehend</span>`;

    const actions = [];
    if (!u.is_admin) {
      if (!u.is_active) {
        actions.push(`<button class="btn btn-sm btn-primary" onclick="window._adminAction('approve',${u.id})">✓ Freischalten</button>`);
      } else {
        actions.push(`<button class="btn btn-sm btn-outline" onclick="window._adminAction('revoke',${u.id})">Sperren</button>`);
      }
      actions.push(`<button class="btn btn-sm btn-outline" onclick="window._adminAction('makeAdmin',${u.id})">→ Admin</button>`);
      actions.push(`<button class="btn btn-sm btn-danger" onclick="window._adminAction('delete',${u.id})">🗑</button>`);
    }

    const date = new Date(u.created_at).toLocaleDateString("de-CH");
    return `<tr>
      <td><strong>${u.nickname}</strong></td>
      <td>${statusBadge}</td>
      <td>${date}</td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap">${actions.join("")}</div></td>
    </tr>`;
  }).join("");

  return `
    <div class="section-card" style="margin-bottom:16px">
      <h3>👥 Benutzerverwaltung</h3>
      <div style="overflow-x:auto">
        <table class="admin-table">
          <thead><tr><th>Nickname</th><th>Status</th><th>Registriert</th><th>Aktionen</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function renderStickerSection() {
  return `
    <div class="section-card">
      <h3>🎴 Sticker-Verwaltung</h3>
      <div style="padding:12px 16px">
        <p style="font-size:.85rem;color:var(--muted);margin-bottom:10px">
          Fehlende Sticker hinzufügen oder bestehende korrigieren.
        </p>
        <button class="btn btn-outline btn-sm" onclick="window._loadAdminStickers()">Sticker laden & bearbeiten</button>
      </div>
      <div id="admin-sticker-list"></div>
      <div class="inline-form" id="add-sticker-form" style="display:none">
        <input id="ns-code"    placeholder="Code (z.B. SUI 21)"   style="width:120px" />
        <input id="ns-country" placeholder="Land"                  style="width:120px" />
        <input id="ns-desc"    placeholder="Beschreibung"          style="flex:1" />
        <select id="ns-cat">
          <option value="team">Team</option>
          <option value="special">Spezial</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="window._addSticker()">Hinzufügen</button>
      </div>
    </div>`;
}

function bindAdmin(users) {
  window._adminAction = async (action, id) => {
    const labels = {
      approve: "Freischalten?",
      revoke:  "Sperren?",
      delete:  "Löschen? Alle Sticker-Daten werden entfernt.",
      makeAdmin: "Als Admin festlegen?",
    };
    if (!confirm(labels[action] || "Fortfahren?")) return;
    try {
      if (action === "approve")   await api.approveUser(id);
      if (action === "revoke")    await api.revokeUser(id);
      if (action === "delete")    await api.deleteUser(id);
      if (action === "makeAdmin") await api.makeAdmin(id);
      await loadAdmin();
    } catch (e) {
      alert("Fehler: " + e.message);
    }
  };

  window._loadAdminStickers = async () => {
    const listEl = document.getElementById("admin-sticker-list");
    const formEl = document.getElementById("add-sticker-form");
    listEl.innerHTML = `<div class="spinner"></div>`;
    formEl.style.display = "flex";
    try {
      const stickers = await api.adminStickers();
      const last10 = stickers.slice(-20);
      listEl.innerHTML = `
        <div style="padding:10px 16px;font-size:.8rem;color:var(--muted)">
          Letzte 20 Einträge (von ${stickers.length} gesamt):
        </div>
        <div style="overflow-x:auto">
          <table class="admin-table">
            <thead><tr><th>Code</th><th>Land</th><th>Beschreibung</th><th>Foil</th><th></th></tr></thead>
            <tbody>
              ${last10.map(s => `
                <tr>
                  <td><strong>${s.code}</strong></td>
                  <td>${s.country_name || s.category}</td>
                  <td>${s.description || ""}</td>
                  <td>${s.is_foil ? "✨" : ""}</td>
                  <td><button class="btn btn-sm btn-danger" onclick="window._deleteSticker(${s.id},'${s.code}')">🗑</button></td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    } catch (e) {
      listEl.innerHTML = `<div class="alert alert-error" style="margin:10px">${e.message}</div>`;
    }
  };

  window._addSticker = async () => {
    const code    = document.getElementById("ns-code").value.trim();
    const country = document.getElementById("ns-country").value.trim();
    const desc    = document.getElementById("ns-desc").value.trim();
    const cat     = document.getElementById("ns-cat").value;
    if (!code) { alert("Code ist Pflichtfeld"); return; }
    try {
      await api.createSticker({ code, category: cat, country_name: country || null,
        description: desc || null, is_foil: false });
      document.getElementById("ns-code").value = "";
      document.getElementById("ns-country").value = "";
      document.getElementById("ns-desc").value = "";
      await window._loadAdminStickers();
    } catch (e) {
      alert("Fehler: " + e.message);
    }
  };

  window._deleteSticker = async (id, code) => {
    if (!confirm(`Sticker ${code} löschen?`)) return;
    try {
      await api.deleteSticker(id);
      await window._loadAdminStickers();
    } catch (e) {
      alert("Fehler: " + e.message);
    }
  };
}
