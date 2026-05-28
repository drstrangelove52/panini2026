import { api } from "./api.js";

export async function renderTrades(container) {
  container.innerHTML = `
    <div class="page-title">Tauschbörse</div>
    <div id="trades-content"><div class="spinner"></div></div>
  `;

  let trades, pending;
  try {
    [trades, pending] = await Promise.all([api.trades(), api.tradePending()]);
  } catch (e) {
    document.getElementById("trades-content").innerHTML =
      `<div class="alert alert-error">${e.message}</div>`;
    return;
  }

  const el = document.getElementById("trades-content");

  // ── Pending banners (partner already confirmed, waiting for me) ───────────
  let pendingHtml = pending.map(p => renderPendingBanner(p)).join("");

  if (!trades.length && !pending.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🤝</div>
        <strong>Noch keine Tauschoptionen</strong><br>
        <span style="font-size:.85rem">Trage deine Doppelten und Wünsche ein, um Matches zu sehen.</span>
      </div>`;
    return;
  }

  const counts = { perfect: 0, chain: 0, one_sided: 0 };
  trades.forEach(t => counts[t.type] = (counts[t.type] || 0) + 1);

  let html = pendingHtml;

  if (trades.length) {
    html += `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        ${counts.perfect  ? `<span class="trade-badge perfect">${counts.perfect} Perfekt</span>` : ""}
        ${counts.chain    ? `<span class="trade-badge chain">${counts.chain} Kette</span>` : ""}
        ${counts.one_sided? `<span class="trade-badge one_sided">${counts.one_sided} Einseitig</span>` : ""}
      </div>`;
  }

  trades.forEach((t, i) => {
    html += renderTradeCard(t, i);
  });

  el.innerHTML = html;

  // ── Pending banner buttons ────────────────────────────────────────────────
  el.querySelectorAll(".btn-pending-confirm").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      btn.disabled = true; btn.textContent = "…";
      try {
        await api.confirmPending(btn.dataset.id);
        renderTrades(container);
      } catch (err) {
        btn.disabled = false; btn.textContent = "Bestätigen ✓";
        btn.insertAdjacentHTML("afterend",
          `<div class="alert alert-error" style="margin-top:6px;font-size:.82rem">${err.message}</div>`);
      }
    });
  });

  el.querySelectorAll(".btn-pending-dismiss").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await api.dismissPending(btn.dataset.id);
      renderTrades(container);
    });
  });

  el.querySelectorAll(".trade-header").forEach(h => {
    h.addEventListener("click", () => {
      h.classList.toggle("open");
      const body = h.nextElementSibling;
      body.classList.toggle("open");
    });
  });

  el.querySelectorAll(".btn-confirm-trade").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const give_ids    = JSON.parse(btn.dataset.give);
      const receive_ids = JSON.parse(btn.dataset.receive);
      const partner     = btn.dataset.partner;
      const partner_id  = parseInt(btn.dataset.partnerId);
      btn.disabled = true;
      btn.textContent = "…";
      try {
        await api.confirmTrade(give_ids, receive_ids, partner_id);
        btn.closest(".trade-action").innerHTML = `
          <div class="alert alert-success" style="margin:0;font-size:.85rem;text-align:left">
            ✓ Gespeichert! Bitte erinnere <strong>${partner}</strong>,
            den Tausch in der App ebenfalls zu bestätigen.
          </div>`;
        setTimeout(() => renderTrades(container), 4000);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Tausch durchgeführt ✓";
        const errDiv = document.createElement("div");
        errDiv.className = "alert alert-error";
        errDiv.style.cssText = "margin-top:6px;font-size:.82rem";
        errDiv.textContent = err.message;
        btn.closest(".trade-action").appendChild(errDiv);
      }
    });
  });

  // Auto-open first perfect trade
  const first = el.querySelector(".trade-header");
  if (first) {
    first.classList.add("open");
    first.nextElementSibling.classList.add("open");
  }
}

function renderTradeCard(t, i) {
  const badge = `<span class="trade-badge ${t.type}">${t.label}</span>`;

  let summary = "";
  let body = "";

  if (t.type === "perfect" || t.type === "one_sided") {
    const p = t.partners[0];
    const isPerfect = t.type === "perfect";

    // Section header wording: commanding for confirmed trades, neutral for one-sided hints
    const giveLabel = isPerfect
      ? `Du gibst an ${p.nickname}`
      : `Deine Doppelten, die ${p.nickname} sucht`;
    const recvLabel = isPerfect
      ? `${p.nickname} gibt dir`
      : `Doppelte von ${p.nickname}, die du suchst`;

    summary = `${p.nickname}`;
    const giveSection = p.give.length ? `
      <div class="trade-section">
        <h4>${giveLabel}</h4>
        <div class="sticker-chips">
          ${p.give.map(s => chipHtml(s)).join("")}
        </div>
      </div>` : "";
    const recvSection = p.receive.length ? `
      <div class="trade-section">
        <h4>${recvLabel}</h4>
        <div class="sticker-chips">
          ${p.receive.map(s => chipHtml(s)).join("")}
        </div>
      </div>` : "";

    if (!isPerfect && !p.give.length) {
      summary = `${p.nickname} hat was du suchst`;
    } else if (!isPerfect && !p.receive.length) {
      summary = `${p.nickname} sucht was du hast`;
    }

    if (isPerfect) {
      const giveIds = JSON.stringify(p.give.map(s => s.id));
      const recvIds = JSON.stringify(p.receive.map(s => s.id));
      body = giveSection + recvSection + `
        <div class="trade-action" style="margin-top:12px">
          <div style="font-size:.72rem;color:var(--muted);margin-bottom:6px;text-align:right">
            Beide müssen dies separat bestätigen
          </div>
          <div style="text-align:right">
            <button class="btn btn-confirm-trade"
                    data-give='${giveIds}' data-receive='${recvIds}'
                    data-partner="${p.nickname}"
                    data-partner-id="${p.user_id}">
              Tausch durchgeführt ✓
            </button>
          </div>
        </div>`;
    } else {
      body = giveSection + recvSection;
    }
  } else if (t.type === "chain") {
    const users = [...new Set(t.chain.flatMap(s => [s.from_user, s.to_user]))].filter(u => u !== "Du");
    summary = `Du + ${users.join(" + ")}`;
    body = t.chain.map(step => `
      <div class="chain-step">
        <span class="users"><b>${step.from_user}</b></span>
        <span class="arrow">→</span>
        <span class="users"><b>${step.to_user}</b></span>
        <div class="sticker-chips" style="margin-left:auto">
          ${step.stickers.map(s => chipHtml(s)).join("")}
        </div>
      </div>`).join("");
  }

  return `
    <div class="trade-card ${t.type}">
      <div class="trade-header">
        ${badge}
        <span class="trade-summary">${summary}</span>
        <span class="trade-chevron">▾</span>
      </div>
      <div class="trade-body">${body}</div>
    </div>`;
}

function chipHtml(s) {
  return `<span class="sticker-chip${s.is_foil ? " foil" : ""}" title="${s.description || ""}">${s.code}</span>`;
}

function renderPendingBanner(p) {
  const receiveChips = p.i_receive.map(s => chipHtml(s)).join("") || "–";
  const giveChips    = p.i_give.map(s => chipHtml(s)).join("") || "–";
  return `
    <div class="pending-trade-notice">
      <div class="pending-trade-header">
        🤝 <strong>${p.confirmer_nickname}</strong> hat den Tausch bereits bestätigt und wartet auf dich
      </div>
      <div class="pending-trade-row">
        <span class="pending-trade-label">Du erhältst von ${p.confirmer_nickname}:</span>
        <div class="sticker-chips">${receiveChips}</div>
      </div>
      ${p.i_give.length ? `
      <div class="pending-trade-row">
        <span class="pending-trade-label">Du gibst an ${p.confirmer_nickname}:</span>
        <div class="sticker-chips">${giveChips}</div>
      </div>` : ""}
      <div class="pending-trade-btns">
        <button class="btn btn-sm btn-outline btn-pending-dismiss" data-id="${p.id}">
          Schliessen
        </button>
        <button class="btn btn-sm btn-primary btn-pending-confirm" data-id="${p.id}">
          Bestätigen ✓
        </button>
      </div>
    </div>`;
}
