const APP_URL = "https://panini.pob.li:8443";
const QR_URL  = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(APP_URL)}`;

export function renderInfo(container) {
  container.innerHTML = `
    <div class="page-title">ℹ️ Info & Hilfe</div>

    <div class="info-card">
      <h3>🎴 Was ist das hier?</h3>
      <p>
        Diese App hilft euch beim Verwalten und Tauschen eurer
        <strong>Panini FIFA WM 2026</strong>-Sticker.
        Markiert eure Doppelten und Fehlenden — die App findet automatisch
        passende Tauschpartner in der Gruppe.
      </p>
    </div>

    <div class="info-card">
      <h3>🕹️ So funktioniert es</h3>
      <div class="info-steps">
        <div class="info-step">
          <span class="info-step-icon">📦</span>
          <div>
            <strong>Doppelte erfassen</strong><br>
            Im Tab <em>Doppelte</em> auf einen Sticker tippen = als doppelt markieren.
            Nochmals tippen = Anzahl anpassen (−&nbsp;/&nbsp;+).
          </div>
        </div>
        <div class="info-step">
          <span class="info-step-icon">🔍</span>
          <div>
            <strong>Fehlende markieren</strong><br>
            Im Tab <em>Fehlende</em> auf einen Sticker tippen = als fehlend markieren.
          </div>
        </div>
        <div class="info-step">
          <span class="info-step-icon">🤝</span>
          <div>
            <strong>Tauschen</strong><br>
            Im Bereich <em>Tauschen</em> werden automatisch passende
            Tauschpartner vorgeschlagen — perfekte Tausche grün,
            Ketten orange, einseitige Angebote blau.
          </div>
        </div>
      </div>
    </div>

    <div class="info-card info-card-qr">
      <h3>👥 Freunde einladen</h3>
      <p style="margin-bottom:14px">
        Scannt den QR-Code oder schickt den Link weiter.
        Nach der Registrierung muss der Admin das Konto freischalten.
      </p>
      <div class="qr-wrap">
        <img class="qr-img" src="${QR_URL}" alt="QR-Code für ${APP_URL}"
             onerror="this.outerHTML='<div class=qr-fallback>QR-Code konnte nicht geladen werden</div>'" />
        <div class="qr-url">${APP_URL}</div>
      </div>
    </div>

    <div class="info-card">
      <h3>🔒 Datenschutz</h3>
      <ul class="info-list">
        <li>Nur <strong>Nickname</strong> und <strong>Passwort</strong> — keine E-Mail-Adresse.</li>
        <li>Registrierung erfordert Freischaltung durch den Admin.</li>
        <li>Alle Daten bleiben auf dem eigenen Server (panini.pob.li).</li>
        <li>Keine Werbung, kein Tracking, kein Drittanbieter.</li>
      </ul>
    </div>

    <div style="text-align:center;font-size:.75rem;color:var(--muted);padding:8px 0 4px;line-height:1.8">
      Panini WM 2026 Tauschbörse<br>
      Entwickelt von <strong style="color:var(--text)">Martin Nigg</strong> · Made with ❤️ for the family
    </div>
  `;
}
