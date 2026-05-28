import { api } from "./api.js";

let allStickers    = [];
let haveQtyMap     = new Map(); // sticker_id → quantity (1=im Album, ≥2=hat Doppelte)
let wantSet        = new Set(); // sticker_id → explizit gesucht
let pendingHaveAdd = [], pendingHaveRem = [];
let pendingWantAdd = [], pendingWantRem = [];
let saveTimer      = null;
let activePopover  = null;

export async function renderStickers(container) {
  container.innerHTML = `
    <div class="page-title">Meine Sticker</div>
    <div id="album-stats"></div>
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
    haveQtyMap  = new Map(haveItems.map(h => [h.sticker_id, h.quantity]));
    wantSet     = new Set(wantIds);
  } catch (e) {
    document.getElementById("sticker-list").innerHTML =
      `<div class="alert alert-error">${e.message}</div>`;
    return;
  }

  renderStats();
  renderList("");
}

// ── Stats ──────────────────────────────────────────────────────────────────────

function renderStats() {
  const el = document.getElementById("album-stats");
  if (!el || !allStickers.length) return;
  const total      = allStickers.length;
  const collected  = haveQtyMap.size;
  const duplicates = [...haveQtyMap.values()].filter(q => q >= 2).length;
  const fehlend    = total - collected;
  const pct        = Math.round(collected / total * 100);
  el.innerHTML = `
    <div class="album-stats">
      <div class="stats-progress-bar">
        <div class="stats-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="stats-label">${collected} von ${total} Stickern im Album (${pct}%)</div>
      <div class="stats-badges">
        <span class="stats-badge collected">${collected} Im Album</span>
        <span class="stats-badge duplicates">${duplicates} Doppelte</span>
        <span class="stats-badge missing">${fehlend} Fehlend</span>
      </div>
    </div>`;
}

// ── State helper ───────────────────────────────────────────────────────────────

function stickerStateCls(id) {
  const qty = haveQtyMap.get(id) || 0;
  if (qty >= 2) return "duplicate";
  if (qty === 1) return "collected";
  if (wantSet.has(id)) return "want";
  return "";
}

// ── List rendering ─────────────────────────────────────────────────────────────

function renderList(query) {
  const container = document.getElementById("sticker-list");
  if (!container) return;

  const q = query.toLowerCase().trim();
  const filtered = allStickers.filter(s => {
    if (!q) return true;
    return s.code.toLowerCase().includes(q) ||
           (s.country_name  || "").toLowerCase().includes(q) ||
           (s.description   || "").toLowerCase().includes(q);
  });

  const groups       = {};
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
  if (specialGroup.length) html += renderGroup("Spezial-Sticker", "Spezial", "", specialGroup);
  for (const [, g] of Object.entries(groups)) {
    html += renderGroup(g.name, g.stickers[0]?.country_code || "", `Gruppe ${g.group}`, g.stickers);
  }
  if (!html) html = `<div class="empty-state"><div class="empty-icon">🔍</div>Keine Sticker gefunden</div>`;

  container.innerHTML = html;

  container.querySelectorAll(".sticker-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      toggleSticker(parseInt(btn.dataset.id), btn);
    });
  });

  container.querySelectorAll(".country-header").forEach(header => {
    const grid = header.nextElementSibling;
    // Auto-open if group has any marked sticker (collected, duplicate or wanted)
    const hasMarked = grid.querySelector(".sticker-btn.collected, .sticker-btn.duplicate, .sticker-btn.want");
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
  const isTeam = stickers.length > 0 && stickers[0].category === "team";
  const marked = stickers.filter(s => haveQtyMap.has(s.id)).length;

  const makeBtn = s => {
    const qty      = haveQtyMap.get(s.id) || 0;
    const stateCls = stickerStateCls(s.id);
    const foilCls  = s.is_foil ? " foil" : "";
    const spares   = qty >= 2 ? qty - 1 : 0;
    const badge    = spares > 0 ? `<span class="qty-badge">×${spares}</span>` : "";
    const extraCls = isTeam ? `album-btn album-pos-${s.number} ` : "";
    return `<button class="sticker-btn ${extraCls}${stateCls}${foilCls}"
      data-id="${s.id}" title="${s.description || ""}">
      <span class="s-code">${s.code}</span>
      <span class="s-desc">${s.description || ""}</span>
      ${badge}
    </button>`;
  };

  let btns = stickers.map(s => makeBtn(s)).join("");
  if (isTeam) btns += `<div class="album-page-sep"></div>`;

  const gridClass  = isTeam ? "sticker-grid sticker-grid-album hidden" : "sticker-grid hidden";
  const countLabel = marked > 0 ? `✓ ${marked}` : "";

  return `
    <div class="country-group">
      <div class="country-header">
        <span class="country-name">${name}${code ? ` (${code})` : ""}</span>
        <span class="country-meta">
          <span>${countLabel}</span>
          <span>${meta}</span>
          <span class="chevron">▾</span>
        </span>
      </div>
      <div class="${gridClass}">${btns}</div>
    </div>`;
}

// ── Button update ──────────────────────────────────────────────────────────────

function updateStickerBtn(id) {
  const btn = document.querySelector(`.sticker-btn[data-id="${id}"]`);
  if (!btn) return;

  btn.className = btn.className
    .replace(/\bcollected\b|\bduplicate\b|\bwant\b/g, "").trim();
  const stateCls = stickerStateCls(id);
  if (stateCls) btn.classList.add(stateCls);

  const qty    = haveQtyMap.get(id) || 0;
  const spares = qty >= 2 ? qty - 1 : 0;
  let badge = btn.querySelector(".qty-badge");
  if (spares > 0) {
    if (!badge) { badge = document.createElement("span"); badge.className = "qty-badge"; btn.appendChild(badge); }
    badge.textContent = `×${spares}`;
  } else if (badge) {
    badge.remove();
  }
}

// ── Toggle (cycle: none → want → have → popover) ──────────────────────────────

function toggleSticker(id, btnEl) {
  const qty = haveQtyMap.get(id) || 0;

  if (qty > 0) {
    // Grün → Qty-Popover (Doppelte / Entfernen)
    showQtyPopover(id, btnEl);
    return;
  }

  if (wantSet.has(id)) {
    // Blau → Grün: gefunden! Von Wunschliste ins Album
    wantSet.delete(id);
    pendingWantRem.push(id);
    haveQtyMap.set(id, 1);
    pendingHaveAdd.push(id);
  } else {
    // Grau → Blau: suche ich
    wantSet.add(id);
    pendingWantAdd.push(id);
  }

  updateStickerBtn(id);
  renderStats();
  scheduleSave();
}

// ── Qty popover ────────────────────────────────────────────────────────────────

function showQtyPopover(id, btnEl) {
  closePopover();

  const qty  = haveQtyMap.get(id) || 1;
  const pop  = document.createElement("div");
  pop.className = "qty-popover";
  pop.innerHTML = `
    <div class="qty-pop-info">${qty <= 1 ? "Im Album – noch kein Doppelter" : `${qty - 1} Doppelter`}</div>
    <button class="qty-pop-btn" data-action="minus">−</button>
    <span class="qty-pop-val">${qty}</span>
    <button class="qty-pop-btn" data-action="plus">+</button>
    <button class="qty-pop-close" title="Schliessen">✕</button>
  `;

  document.body.appendChild(pop);
  activePopover = pop;

  const rect = btnEl.getBoundingClientRect();
  const popH = pop.offsetHeight || 54;
  const popW = pop.offsetWidth  || 190;
  const gap  = 8;
  const NAV  = 72;

  let top = (rect.bottom + gap + popH < window.innerHeight - NAV)
    ? rect.bottom + gap
    : Math.max(64, rect.top - popH - gap);
  let left = rect.left + rect.width / 2 - popW / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));

  pop.style.top  = `${top}px`;
  pop.style.left = `${left}px`;

  const valEl    = pop.querySelector(".qty-pop-val");
  const infoEl   = pop.querySelector(".qty-pop-info");
  const minusBtn = pop.querySelector("[data-action=minus]");

  function sync(q) {
    infoEl.textContent = q <= 1 ? "Im Album – noch kein Doppelter" : `${q - 1} Doppelter`;
    if (q === 1) { minusBtn.textContent = "🗑"; minusBtn.classList.add("qty-pop-remove"); }
    else         { minusBtn.textContent = "−";  minusBtn.classList.remove("qty-pop-remove"); }
  }
  sync(qty);

  minusBtn.addEventListener("click", async e => {
    e.stopPropagation();
    const cur  = haveQtyMap.get(id) || 1;
    const next = cur - 1;
    if (next <= 0) { haveQtyMap.delete(id); closePopover(); }
    else           { haveQtyMap.set(id, next); valEl.textContent = next; sync(next); }
    pendingHaveRem.push(id);
    updateStickerBtn(id);
    renderStats();
    try { await api.setHaveQty(id, next); } catch (err) { console.error(err); }
  });

  pop.querySelector("[data-action=plus]").addEventListener("click", async e => {
    e.stopPropagation();
    const cur  = haveQtyMap.get(id) || 1;
    const next = cur + 1;
    haveQtyMap.set(id, next);
    valEl.textContent = next;
    sync(next);
    updateStickerBtn(id);
    renderStats();
    try { await api.setHaveQty(id, next); } catch (err) { console.error(err); }
  });

  pop.querySelector(".qty-pop-close").addEventListener("click", e => {
    e.stopPropagation();
    closePopover();
  });

  setTimeout(() => document.addEventListener("click", _outsideClick), 0);
}

function _outsideClick(e) {
  if (activePopover && !activePopover.contains(e.target)) closePopover();
}

function closePopover() {
  if (activePopover) { activePopover.remove(); activePopover = null; }
  document.removeEventListener("click", _outsideClick);
}

// ── Debounced save ─────────────────────────────────────────────────────────────

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const haveAdd = [...new Set(pendingHaveAdd)];
      const haveRem = [...new Set(pendingHaveRem)];
      const wantAdd = [...new Set(pendingWantAdd)];
      const wantRem = [...new Set(pendingWantRem)];

      if (haveAdd.length || haveRem.length) {
        await api.bulkHave(haveAdd, haveRem);
        pendingHaveAdd = []; pendingHaveRem = [];
      }
      if (wantAdd.length || wantRem.length) {
        await api.bulkWant(wantAdd, wantRem);
        pendingWantAdd = []; pendingWantRem = [];
      }

      const ind = document.getElementById("save-indicator");
      if (ind) { ind.style.display = "block"; setTimeout(() => { ind.style.display = "none"; }, 1500); }
    } catch (e) {
      console.error("Save failed:", e);
    }
  }, 600);
}
