import { api } from "./api.js";

let allStickers = [];
let haveSet = new Set();
let wantSet = new Set();
let currentTab = "have"; // "have" | "want"
let pendingHaveAdd = [], pendingHaveRem = [], pendingWantAdd = [], pendingWantRem = [];
let saveTimer = null;

export async function renderStickers(container) {
  container.innerHTML = `
    <div class="page-title">Meine Sticker</div>
    <div id="album-stats"></div>
    <div class="tabs">
      <button id="tab-have" class="active" onclick="window._switchTab('have')">📦 Doppelte</button>
      <button id="tab-want" onclick="window._switchTab('want')">🔍 Suche</button>
    </div>
    <div class="legend">
      <div class="legend-item"><div class="legend-dot have"></div> Markiert</div>
      <div class="legend-item"><div class="legend-dot want"></div> Markiert</div>
      <div style="color:var(--muted);font-size:.78rem">Sticker antippen zum Markieren</div>
    </div>
    <div class="search-bar">
      <input id="sticker-search" type="search" placeholder="Suche: GER 1, Torwart, ..." />
    </div>
    <div id="sticker-list"><div class="spinner"></div></div>
    <div id="save-indicator" style="
      position:fixed;bottom:76px;right:16px;
      background:var(--green);color:#fff;
      padding:6px 12px;border-radius:8px;
      font-size:.8rem;font-weight:600;
      display:none;z-index:200;
    ">Gespeichert ✓</div>
  `;

  window._switchTab = (tab) => {
    currentTab = tab;
    document.getElementById("tab-have").classList.toggle("active", tab === "have");
    document.getElementById("tab-want").classList.toggle("active", tab === "want");
    renderList(document.getElementById("sticker-search").value);
  };

  document.getElementById("sticker-search").addEventListener("input", e => {
    renderList(e.target.value);
  });

  try {
    [allStickers, haveSet, wantSet] = await Promise.all([
      api.stickers(),
      api.myHave().then(ids => new Set(ids)),
      api.myWant().then(ids => new Set(ids)),
    ]);
  } catch (e) {
    document.getElementById("sticker-list").innerHTML =
      `<div class="alert alert-error">${e.message}</div>`;
    return;
  }

  renderStats();
  renderList("");
}

function renderStats() {
  const el = document.getElementById("album-stats");
  if (!el || !allStickers.length) return;
  const total = allStickers.length;
  const missing = wantSet.size;
  const duplicates = haveSet.size;
  const collected = total - missing;
  const pct = Math.round(collected / total * 100);
  el.innerHTML = `
    <div class="album-stats">
      <div class="stats-progress-bar">
        <div class="stats-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="stats-label">${collected} von ${total} Stickern gesammelt (${pct}%)</div>
      <div class="stats-badges">
        <span class="stats-badge collected">${collected} Gesammelt</span>
        <span class="stats-badge duplicates">${duplicates} Doppelte</span>
        <span class="stats-badge missing" onclick="window._switchTab('want')" style="cursor:pointer">${missing} Fehlend</span>
      </div>
    </div>`;
}

function renderList(query) {
  const container = document.getElementById("sticker-list");
  if (!container) return;

  const q = query.toLowerCase().trim();
  const filtered = allStickers.filter(s => {
    if (!q) return true;
    return s.code.toLowerCase().includes(q) ||
           (s.country_name || "").toLowerCase().includes(q) ||
           (s.description || "").toLowerCase().includes(q);
  });

  // Group by country
  const groups = {};
  const specialGroup = [];
  for (const s of filtered) {
    if (s.category === "special") {
      specialGroup.push(s);
    } else {
      const key = s.country_code;
      if (!groups[key]) groups[key] = { name: s.country_name, group: s.group_name, stickers: [] };
      groups[key].stickers.push(s);
    }
  }

  let html = "";

  if (specialGroup.length) {
    html += renderGroup("Spezial-Sticker", "Spezial", "", specialGroup);
  }

  for (const [code, g] of Object.entries(groups)) {
    html += renderGroup(`${g.name} (${code})`, code, `Gruppe ${g.group}`, g.stickers);
  }

  if (!html) {
    html = `<div class="empty-state"><div class="empty-icon">🔍</div>Keine Sticker gefunden</div>`;
  }

  container.innerHTML = html;

  // Bind click events
  container.querySelectorAll(".sticker-btn").forEach(btn => {
    btn.addEventListener("click", () => toggleSticker(parseInt(btn.dataset.id)));
  });

  // Expand groups with marked stickers by default
  container.querySelectorAll(".country-header").forEach(header => {
    const grid = header.nextElementSibling;
    const hasMarked = grid.querySelector(".sticker-btn.have, .sticker-btn.want");
    if (hasMarked || q) {
      header.classList.add("open");
      grid.classList.remove("hidden");
    } else {
      grid.classList.add("hidden");
    }
    header.addEventListener("click", () => {
      header.classList.toggle("open");
      grid.classList.toggle("hidden");
    });
  });
}

function renderGroup(name, code, meta, stickers) {
  const marked = stickers.filter(s =>
    (currentTab === "have" ? haveSet : wantSet).has(s.id)
  ).length;

  const btns = stickers.map(s => {
    const inHave = haveSet.has(s.id);
    const inWant = wantSet.has(s.id);
    let cls = "";
    if (currentTab === "have" && inHave) cls = "have";
    else if (currentTab === "want" && inWant) cls = "want";
    if (s.is_foil) cls += " foil";
    const num = s.number || "";
    return `<button class="sticker-btn ${cls}" data-id="${s.id}" title="${s.description || ""}">
      <span class="s-code">${s.code}</span>
      <span class="s-desc">${s.description || ""}</span>
    </button>`;
  }).join("");

  return `
    <div class="country-group">
      <div class="country-header">
        <span class="country-name">${name}</span>
        <span class="country-meta">
          <span>${marked > 0 ? `✓ ${marked}` : ""}</span>
          <span>${meta}</span>
          <span class="chevron">▾</span>
        </span>
      </div>
      <div class="sticker-grid hidden">${btns}</div>
    </div>`;
}

async function toggleSticker(id) {
  const isHave = currentTab === "have";
  const set = isHave ? haveSet : wantSet;

  if (set.has(id)) {
    set.delete(id);
    if (isHave) { pendingHaveRem.push(id); }
    else        { pendingWantRem.push(id); }
  } else {
    set.add(id);
    if (isHave) { pendingHaveAdd.push(id); }
    else        { pendingWantAdd.push(id); }
  }

  const btn = document.querySelector(`.sticker-btn[data-id="${id}"]`);
  if (btn) {
    btn.classList.toggle(currentTab === "have" ? "have" : "want", set.has(id));
  }

  renderStats();
  scheduleSave();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const promises = [];
      if (pendingHaveAdd.length || pendingHaveRem.length) {
        promises.push(api.bulkHave([...new Set(pendingHaveAdd)], [...new Set(pendingHaveRem)]));
        pendingHaveAdd = []; pendingHaveRem = [];
      }
      if (pendingWantAdd.length || pendingWantRem.length) {
        promises.push(api.bulkWant([...new Set(pendingWantAdd)], [...new Set(pendingWantRem)]));
        pendingWantAdd = []; pendingWantRem = [];
      }
      await Promise.all(promises);
      const ind = document.getElementById("save-indicator");
      if (ind) {
        ind.style.display = "block";
        setTimeout(() => { ind.style.display = "none"; }, 1500);
      }
    } catch (e) {
      console.error("Save failed:", e);
    }
  }, 600);
}
