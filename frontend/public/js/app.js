import { api, isLoggedIn, isAdmin, isActive, getUser, clearAuth, setAuth } from "./api.js";
import { renderAuth, bindAuth } from "./auth.js";
import { renderStickers } from "./stickers.js";
import { renderTrades } from "./trades.js";
import { renderAdmin } from "./admin.js";
import { renderLog } from "./log.js";
import { renderInfo } from "./info.js";

let currentPage = "stickers";

async function boot() {
  api.logAccess(); // fire-and-forget: log page visit with geo, no await needed

  if (!isLoggedIn()) {
    showAuth();
    return;
  }

  // Verify token is still valid
  try {
    const user = await api.me();
    setAuth(localStorage.getItem("token"), user);
  } catch {
    clearAuth();
    showAuth();
    return;
  }

  showApp();
}

function showAuth() {
  document.getElementById("header").style.display = "none";
  document.getElementById("bottom-nav").style.display = "none";
  document.getElementById("app").innerHTML = renderAuth();
  bindAuth((user) => {
    setAuth(localStorage.getItem("token"), user);
    showApp();
  });
}

function showApp() {
  const user = getUser();
  document.getElementById("header").style.display = "flex";
  document.getElementById("user-nick").textContent = user?.nickname || "";
  document.getElementById("bottom-nav").style.display = "flex";

  const adminTab = document.getElementById("nav-admin");
  if (adminTab) adminTab.style.display = isAdmin() ? "flex" : "none";
  const logTab = document.getElementById("nav-log");
  if (logTab) logTab.style.display = isAdmin() ? "flex" : "none";

  if (!isActive()) {
    document.getElementById("app").innerHTML = `
      <div class="pending-banner">
        <div style="font-size:2rem">⏳</div>
        <h3 style="margin:8px 0">Warte auf Freischaltung</h3>
        <p style="font-size:.88rem">Dein Konto wird vom Admin freigeschaltet. Bitte etwas Geduld.</p>
        <button class="btn btn-outline btn-sm" style="margin-top:12px" id="btn-refresh-status">Status prüfen</button>
      </div>`;
    document.getElementById("btn-refresh-status").onclick = async () => {
      try {
        const u = await api.me();
        setAuth(localStorage.getItem("token"), u);
        if (u.is_active) showApp();
        else alert("Noch nicht freigeschaltet.");
      } catch { clearAuth(); showAuth(); }
    };
    return;
  }

  navigateTo(currentPage);
}

function navigateTo(page) {
  currentPage = page;
  window.scrollTo(0, 0); // always return to top when switching pages

  // Update nav
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.page === page);
  });

  const main = document.getElementById("app");
  switch (page) {
    case "stickers": renderStickers(main);  break;
    case "trades":   renderTrades(main);    break;
    case "info":     renderInfo(main);      break;
    case "admin":    renderAdmin(main);     break;
    case "log":      renderLog(main);       break;
  }
}

// Wire nav buttons
document.querySelectorAll(".nav-btn").forEach(b => {
  b.addEventListener("click", () => navigateTo(b.dataset.page));
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  if (await appConfirm("Abmelden?")) {
    clearAuth();
    showAuth();
  }
});

boot();

// Custom confirm dialog – works on iOS PWA (native confirm() is blocked there)
window.appConfirm = function(msg) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-box">
        <p class="confirm-msg">${msg}</p>
        <div class="confirm-btns">
          <button class="btn btn-outline conf-no">Abbrechen</button>
          <button class="btn btn-danger conf-yes">OK</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".conf-no").onclick  = () => { overlay.remove(); resolve(false); };
    overlay.querySelector(".conf-yes").onclick = () => { overlay.remove(); resolve(true);  };
  });
};
