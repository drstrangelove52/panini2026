import { api } from "./api.js";

export async function renderTrades(container) {
  container.innerHTML = `
    <div class="page-title">Tauschbörse</div>
    <div id="trades-content"><div class="spinner"></div></div>
  `;

  let trades;
  try {
    trades = await api.trades();
  } catch (e) {
    document.getElementById("trades-content").innerHTML =
      `<div class="alert alert-error">${e.message}</div>`;
    return;
  }

  const el = document.getElementById("trades-content");

  if (!trades.length) {
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

  let html = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      ${counts.perfect  ? `<span class="trade-badge perfect">${counts.perfect} Perfekt</span>` : ""}
      ${counts.chain    ? `<span class="trade-badge chain">${counts.chain} Kette</span>` : ""}
      ${counts.one_sided? `<span class="trade-badge one_sided">${counts.one_sided} Einseitig</span>` : ""}
    </div>
  `;

  trades.forEach((t, i) => {
    html += renderTradeCard(t, i);
  });

  el.innerHTML = html;

  el.querySelectorAll(".trade-header").forEach(h => {
    h.addEventListener("click", () => {
      h.classList.toggle("open");
      const body = h.nextElementSibling;
      body.classList.toggle("open");
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
    summary = `${p.nickname}`;
    const giveSection = p.give.length ? `
      <div class="trade-section">
        <h4>Du gibst an ${p.nickname}</h4>
        <div class="sticker-chips">
          ${p.give.map(s => chipHtml(s)).join("")}
        </div>
      </div>` : "";
    const recvSection = p.receive.length ? `
      <div class="trade-section">
        <h4>${p.nickname} gibt dir</h4>
        <div class="sticker-chips">
          ${p.receive.map(s => chipHtml(s)).join("")}
        </div>
      </div>` : "";

    if (t.type === "one_sided" && !p.give.length) {
      summary = `${p.nickname} hat was du suchst`;
    } else if (t.type === "one_sided" && !p.receive.length) {
      summary = `${p.nickname} sucht was du hast`;
    }

    body = giveSection + recvSection;
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
