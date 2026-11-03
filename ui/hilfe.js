// PR Hunter · Datenschutz & Impressum, Feedback/Fehler melden, Nutzer melden (Wunsch 126 a/d/e), Sicherung als JSON
// (126 b) und Plan-Termine als Kalenderdatei mit Erinnerung (126 f – echte Push-Erinnerungen bräuchten einen Server).
import { html, useState, I, Sheet } from './basis.js';

export const APP_VERSION = () => document.querySelector('meta[name="prh-version"]')?.content ?? (navigator.serviceWorker?.controller ? 'sw' : 'dev');
const geraet = () => `${navigator.userAgent.slice(0, 180)} · ${innerWidth}×${innerHeight}`;

/** Feedback, Fehler oder Meldung über einen Nutzer an den Betreiber (Tabelle feedback, Update 24). */
export function FeedbackSheet({ art: start = 'feedback', betrifft = null, name = null, vorText = '', senden, zu }) {
  const [art, setArt] = useState(start);
  const [text, setText] = useState(vorText ? `${vorText}\n\n` : '');
  const [status, setStatus] = useState(null);
  const los = async () => {
    setStatus('…');
    try { await senden({ art, text: text.trim(), betrifft, version: APP_VERSION(), geraet: geraet() }); setStatus('ok'); }
    catch (e) { setStatus(e.message); }
  };
  return html`<${Sheet} zu=${zu} label="Feedback">
    <span class="eyebrow">${art === 'meldung' ? 'Nutzer melden' : 'Feedback'}</span>
    <h2 class="h2" style="margin:0">${art === 'meldung' ? `${name ?? 'Nutzer'} melden` : 'Was können wir besser machen?'}</h2>
    ${art === 'meldung' ? null : html`<div class="seg" role="group" aria-label="Art">${[['feedback', 'Idee / Lob'], ['fehler', 'Fehler melden']].map(([k, t]) => html`<button key=${k} aria-pressed=${String(art === k)} onClick=${() => setArt(k)}>${t}</button>`)}</div>`}
    ${status === 'ok' ? html`<div class="hint immer gut">${I.check}<span class="t">Danke – ist angekommen.</span><span></span></div>
      <button class="btn btn-soft btn-block" onClick=${zu}>Schließen</button>` : html`
      <textarea class="text" rows="6" placeholder=${art === 'fehler' ? 'Was ist passiert? Was hast du davor gemacht?' : art === 'meldung' ? 'Was ist vorgefallen?' : 'Deine Idee oder Rückmeldung …'}
        value=${text} onInput=${(e) => setText(e.currentTarget.value)}></textarea>
      <span class="muted" style="font-size:12px">${art === 'fehler' ? 'App-Version und Gerät werden automatisch mitgeschickt.' : art === 'meldung' ? 'Die Meldung sieht nur der Betreiber. Blockieren geht zusätzlich in der Freundesliste.' : 'Geht direkt an den Entwickler.'}</span>
      ${status && status !== '…' ? html`<p class="fehler" style="margin:0">${status}</p>` : null}
      <button class="btn btn-chalk btn-block" disabled=${!text.trim() || status === '…'} onClick=${los}>${status === '…' ? 'Sendet …' : 'Senden'}</button>`}
  <//>`;
}

/** Datenschutzerklärung und Impressum (126 a). Die Angaben zum Betreiber muss Niko eintragen (IMPRESSUM). */
const IMPRESSUM = { name: '[Name des Betreibers]', anschrift: '[Straße Hausnummer, PLZ Ort]', kontakt: '[E-Mail-Adresse für Anfragen]' };
export function Datenschutz({ zurueck }) {
  return html`<div class="screen datenschutz">
    <header class="topbar unter"><button class="iconbtn" onClick=${zurueck} aria-label="Zurück">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">Rechtliches</div><h1 class="h1" style="font-size:26px">Datenschutz & Impressum</h1></div></header>
    <section class="card pad stack">
      <span class="viz-t">Impressum</span>
      <p style="margin:0">${IMPRESSUM.name}<br/>${IMPRESSUM.anschrift}<br/>${IMPRESSUM.kontakt}</p>
      <span class="muted" style="font-size:12.5px">PR Hunter ist ein privates, nicht kommerzielles Projekt.</span>
    </section>
    <section class="card pad stack">
      <span class="viz-t">Welche Daten gespeichert werden</span>
      <p style="margin:0">E-Mail-Adresse (Anmeldung per Code), Anzeigename, Vorname, Profilbild, Einstellungen, Trainings (Übungen, Sätze, Gewichte, Wiederholungen, RPE, Notizen), Programme, Körpergewicht und Bereitschaftsangaben. Ohne Konto gibt es keine Nutzung.</p>
      <span class="viz-t">Wozu</span>
      <p style="margin:0">Nur, um die App bereitzustellen: Training planen, Verlauf und Statistik zeigen, zwischen Geräten abgleichen. Keine Werbung, kein Tracking, keine Weitergabe zu Werbezwecken.</p>
      <span class="viz-t">Wo</span>
      <p style="margin:0">Daten liegen bei Supabase (Datenbank und Anmeldung, Rechenzentrum London, Auftragsverarbeitung nach Art. 28 DSGVO) und auf deinem Gerät (Offline-Speicher). Die App selbst wird über GitHub Pages ausgeliefert; dabei verarbeitet GitHub technisch die IP-Adresse.</p>
      <span class="viz-t">Freunde</span>
      <p style="margin:0">Was Freunde sehen (Feed, Kalender, Vergleich), stellst du je Freund ein. Wer nichts teilt, sieht auch nichts.</p>
      <span class="viz-t">Deine Rechte</span>
      <p style="margin:0">Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit (Export als CSV und JSON unter Einstellungen → Konto) und Widerspruch. Konto löschen: Einstellungen → Konto; die Trainingsdaten werden nach 14 Tagen endgültig gelöscht, bis dahin kannst du es dir anders überlegen. Beschwerden bei der zuständigen Datenschutz-Aufsichtsbehörde.</p>
      <span class="viz-t">Kontakt</span>
      <p style="margin:0">${IMPRESSUM.kontakt} oder in der App über „Feedback senden“.</p>
      <span class="muted" style="font-size:12px">Stand: November 2026</span>
    </section>
  </div>`;
}

/** Kalenderdatei (.ics) mit den nächsten Plantagen, Erinnerung am Trainingstag um 9 Uhr (126 f). */
export function kalenderDatei(tage, titelVon) {
  const z = (d) => d.replace(/-/g, '');
  const stempel = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ereignisse = tage.map((t) => [
    'BEGIN:VEVENT', `UID:prh-${t.datum}-${t.offset}@pr-hunter`, `DTSTAMP:${stempel}`, `DTSTART;VALUE=DATE:${z(t.datum)}`,
    `SUMMARY:${titelVon(t).replace(/[,;]/g, ' ')}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Training heute', 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT',
  ].join('\r\n'));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PR Hunter//DE', ...ereignisse, 'END:VCALENDAR'].join('\r\n');
}

export function herunterladen(inhalt, name, typ) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([inhalt], { type: typ }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Banner bei neuer App-Version (126 g): der Service Worker hat übernommen, die Seite läuft noch mit dem alten Stand. */
export function NeueVersion() {
  return html`<button class="neue-version" onClick=${() => location.reload()}>${I.neuLaden ?? '↻'}<span>Neue Version da – tippen zum Neu laden</span></button>`;
}
