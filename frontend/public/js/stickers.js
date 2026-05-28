import { api } from "./api.js";

// Positionen werden komplett per CSS (album-pos-N Klassen) gesteuert

let allStickers = [];
let haveQtyMap = new Map(); // sticker_id → quantity
let wantSet = new Set();
let currentTab = "have"; // "have" | "want"
let pendingHaveAdd = [], pendingHaveRem = [], pendingWantAdd = [], pendingWantRem = [];
let saveTimer = null;
let activePopover = null;

export async function renderStickers(container) {
  container.innerHTML = `
    <div class="page-title">Meine Sticker</div>
    <div id="album-stats"></div>
    <div class="tabs">
      <button id="tab-have" class="active" onclick="window._switchTab('have')">📦 Doppelte</button>
      <button id="tab-want" onclick="window._switchTab('want')">🔍 Fehlende</button>
    </div>
    <div id="mode-banner"></div>
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
    closePopover();
    document.getElementById("tab-have").classList.toggle("active", tab === "have");
    document.getElementById("tab-want").classList.toggle("active", tab === "want");
    updateModeBanner();
    renderList(document.getElementById("sticker-search").value);
  };

  document.getElementById("sticker-search").addEventListener("input", e => {
    closePopover();
    renderList(e.target.value);
  });

  try {
    const [stickers, haveItems, wantIds] = await Promise.all([
      api.stickers(),
      api.myHave(),
      api.myWant(),
    ]);
    allStickers = stickers;
    haveQtyMap = new Map(haveItems.map(h => [h.sticker_id, h.quantity]));
    wantSet = new Set(wantIds);
  } catch (e) {
    document.getElementById("sticker-list").innerHTML =
      `<div class="alert alert-error">${e.message}</div>`;
    return;
  }

  renderStats();
  updateModeBanner();
  renderList("");
}

function stickerStateCls(inHave, inWant) {
  if (inHave && inWant) return "both";
  if (inHave) return "have";
  if (inWant) return "want";
  return "";
}

function updateModeBanner() {
  const el = document.getElementById("mode-banner");
  if (!el) return;
  const isHave = currentTab === "have";
  el.className = "mode-banner " + (isHave ? "mode-have" : "mode-want");
  el.innerHTML = isHave
    ? `<span class="mode-dot have"></span> Tippen markiert als <strong>Doppelt</strong> <span class="mode-legend"><span class="mode-dot have"></span>Doppelt &nbsp; <span class="mode-dot want"></span>Fehlend</span>`
    : `<span class="mode-dot want"></span> Tippen markiert als <strong>Fehlend</strong> <span class="mode-legend"><span class="mode-dot have"></span>Doppelt &nbsp; <span class="mode-dot want"></span>Fehlend</span>`;
}

function renderStats() {
  const el = document.getElementById("album-stats");
  if (!el || !allStickers.length) return;
  const total = allStickers.length;
  const missing = wantSet.size;
  const duplicates = haveQtyMap.size;
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
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSticker(parseInt(btn.dataset.id), btn);
    });
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
  const marked = stickers.filter(s => haveQtyMap.has(s.id) || wantSet.has(s.id)).length;
  const isTeam = stickers.length > 0 && stickers[0].category === "team";

  let btns = "";
  if (isTeam) {
    btns = stickers.map(s => {
      const inHave = haveQtyMap.has(s.id);
      const inWant = wantSet.has(s.id);
      const qty = haveQtyMap.get(s.id) || 0;
      const stateCls = stickerStateCls(inHave, inWant);
      const foilCls = s.is_foil ? " foil" : "";
      const qtyBadge = qty > 1 ? `<span class="qty-badge">×${qty}</span>` : "";
      return `<button class="sticker-btn album-btn album-pos-${s.number} ${stateCls}${foilCls}"
        data-id="${s.id}"
        title="${s.description || ""}">
        <span class="s-code">${s.code}</span>
        <span class="s-desc">${s.description || ""}</span>
        ${qtyBadge}
      </button>`;
    }).join("") +
    `<div class="album-page-sep"></div>`;
  } else {
    btns = stickers.map(s => {
      const inHave = haveQtyMap.has(s.id);
      const inWant = wantSet.has(s.id);
      const qty = haveQtyMap.get(s.id) || 0;
      const stateCls = stickerStateCls(inHave, inWant);
      const foilCls = s.is_foil ? " foil" : "";
      const qtyBadge = qty > 1 ? `<span class="qty-badge">×${qty}</span>` : "";
      return `<button class="sticker-btn ${stateCls}${foilCls}" data-id="${s.id}" title="${s.description || ""}">
        <span class="s-code">${s.code}</span>
        <span class="s-desc">${s.description || ""}</span>
        ${qtyBadge}
      </button>`;
    }).join("");
  }

  const gridClass = isTeam ? "sticker-grid sticker-grid-album hidden" : "sticker-grid hidden";

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
      <div class="${gridClass}">${btns}</div>
    </div>`;
}

function updateStickerBtn(id) {
  const btn = document.querySelector(`.sticker-btn[data-id="${id}"]`);
  if (!btn) return;
  const inHave = haveQtyMap.has(id);
  const inWant = wantSet.has(id);
  const qty = haveQtyMap.get(id) || 0;

  // Update state classes
  btn.className = btn.className
    .replace(/\bhave\b|\bwant\b|\bboth\b/g, "").trim();
  const stateCls = stickerStateCls(inHave, inWant).trim();
  if (stateCls) btn.classList.add(...stateCls.split(" ").filter(Boolean));

  // Update qty badge
  let badge = btn.querySelector(".qty-badge");
  if (qty > 1) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "qty-badge";
      btn.appendChild(badge);
    }
    badge.textContent = `×${qty}`;
  } else if (badge) {
    badge.remove();
  }
}

async function toggleSticker(id, btnEl) {
  const isHave = currentTab === "have";

  if (isHave) {
    if (haveQtyMap.has(id)) {
      // Already marked — show qty popover instead of toggling
      showQtyPopover(id, btnEl);
      return;
    }
    // First tap: add with qty=1
    haveQtyMap.set(id, 1);
    pendingHaveAdd.push(id);
  } else {
    // Want tab: simple toggle
    if (wantSet.has(id)) {
      wantSet.delete(id);
      pendingWantRem.push(id);
    } else {
      wantSet.add(id);
      pendingWantAdd.push(id);
    }
  }

  updateStickerBtn(id);
  renderStats();
  scheduleSave();
}

// ── Qty popover ────────────────────────────────────────────────────────────

function showQtyPopover(id, btnEl) {
  closePopover();

  const qty = haveQtyMap.get(id) || 1;
  const pop = document.createElement("div");
  pop.className = "qty-popover";
  pop.innerHTML = `
    <button class="qty-pop-btn" data-action="minus">−</button>
    <span class="qty-pop-val">${qty}</span>
    <button class="qty-pop-btn" data-action="plus">+</button>
    <button class="qty-pop-close" title="Schliessen">✕</button>
  `;

  document.body.appendChild(pop);
  activePopover = pop;

  // Position: fixed to viewport. Prefer below the button, fall back to above.
  const rect = btnEl.getBoundingClientRect();
  const popH = pop.offsetHeight || 54;
  const popW = pop.offsetWidth  || 170;
  const gap  = 8;
  const NAV  = 72; // bottom nav height

  let top;
  if (rect.bottom + gap + popH < window.innerHeight - NAV) {
    top = rect.bottom + gap;               // fits below
  } else {
    top = Math.max(64, rect.top - popH - gap); // above button (min: below header)
  }

  let left = rect.left + rect.width / 2 - popW / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));

  pop.style.top  = `${top}px`;
  pop.style.left = `${left}px`;

  const valEl = pop.querySelector(".qty-pop-val");

  pop.querySelector("[data-action=minus]").addEventListener("click", async (e) => {
    e.stopPropagation();
    const cur = haveQtyMap.get(id) || 1;
    const next = cur - 1;
    if (next <= 0) {
      haveQtyMap.delete(id);
      closePopover();
    } else {
      haveQtyMap.set(id, next);
      valEl.textContent = next;
    }
    updateStickerBtn(id);
    renderStats();
    try { await api.setHaveQty(id, next); } catch (e) { console.error(e); }
  });

  pop.querySelector("[data-action=plus]").addEventListener("click", async (e) => {
    e.stopPropagation();
    const cur = haveQtyMap.get(id) || 1;
    const next = cur + 1;
    haveQtyMap.set(id, next);
    valEl.textContent = next;
    updateStickerBtn(id);
    renderStats();
    try { await api.setHaveQty(id, next); } catch (e) { console.error(e); }
  });

  pop.querySelector(".qty-pop-close").addEventListener("click", (e) => {
    e.stopPropagation();
    closePopover();
  });

  // Close when clicking outside
  setTimeout(() => {
    document.addEventListener("click", _outsideClick);
  }, 0);
}

function _outsideClick(e) {
  if (activePopover && !activePopover.contains(e.target)) {
    closePopover();
  }
}

function closePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
  document.removeEventListener("click", _outsideClick);
}

// ── Debounced bulk save ────────────────────────────────────────────────────

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
