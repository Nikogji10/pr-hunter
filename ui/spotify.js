// PR Hunter · Spotify-Bubble (Wunsch 267, 09.11.2026): schwebt wie die Mini-Leiste des Trainings, frei verschiebbar.
// Eingeklappt rund mit Albumcover und grünem Fortschrittsring, angetippt im Spotify-Stil mit Titel, Künstler, Zeitleiste
// und Zurück / Abspielen-Pause / Weiter. An und aus in Einstellungen → Kalender und Verbindungen → Spotify.
import { html, useState, useEffect, useRef, deEn, useZiehen, kopiere } from './basis.js';
import { verbunden, verbinden, trennen, wiedergabe, steuern, rueckkehr, clientId, setzeClientId, rueckAdresse, SPOTIFY_CLIENT_ID } from '../js/spotify.js';

// Rücksprung von der Spotify-Anmeldung sofort beim Laden auswerten (bereinigt die Adresse vor dem Verlauf der App)
export const SPOTIFY_RUECKKEHR = rueckkehr();

const GRUEN = '#1DB954';
const LOGO = html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill=${GRUEN}/><path d="M6.2 9.3c3.9-1.2 8.3-.8 11.6 1.1M6.8 12.4c3.2-.9 6.8-.6 9.6 1M7.5 15.3c2.6-.7 5.3-.5 7.6.8" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const ICON = {
  play: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>`,
  pause: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" fill="currentColor"/></svg>`,
  next: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l8.5 6L6 18zM16 6h2.2v12H16z" fill="currentColor"/></svg>`,
  previous: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6l-8.5 6L18 18zM5.8 6H8v12H5.8z" fill="currentColor"/></svg>`,
  zu: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const lage = () => { try { return JSON.parse(localStorage.getItem('prh-spotify-pos') ?? 'null'); } catch { return null; } };

/** Schwebende Bubble. Zeigt sich nur, wenn eingeschaltet und verbunden. */
export function SpotifyBubble({ an }) {
  const [p, setP] = useState(undefined);                   // undefined = lädt, null = kein aktives Gerät
  const [auf, setAuf] = useState(false);
  const [fehler, setFehler] = useState(null);
  const [pos, setPos] = useState(lage);
  const [, tick] = useState(0);
  const laeuft = useRef(false);
  const aktiv = an && verbunden();
  const holen = () => { if (laeuft.current || document.hidden) return; laeuft.current = true;
    wiedergabe().then((x) => { setP(x); setFehler(null); }).catch((e) => setFehler(e.status === 403 ? 'premium' : 'netz')).finally(() => { laeuft.current = false; }); };
  useEffect(() => {
    if (!aktiv) return;
    holen();
    const iv = setInterval(holen, auf ? 3000 : 6000), t = setInterval(() => tick((n) => n + 1), 1000);
    const sicht = () => { if (!document.hidden) holen(); };
    document.addEventListener('visibilitychange', sicht);
    return () => { clearInterval(iv); clearInterval(t); document.removeEventListener('visibilitychange', sicht); };
  }, [aktiv, auf]);
  const ziehen = useZiehen({ achsen: 'xy', ablegen: (r) => { const n = { x: Math.min(Math.max(r.left / innerWidth, 0), 0.95), y: Math.min(Math.max(r.top / innerHeight, 0), 0.92) };
    setPos(n); try { localStorage.setItem('prh-spotify-pos', JSON.stringify(n)); } catch { /* egal */ } } });
  if (!aktiv || p === undefined) return null;
  const tu = (was) => {
    if (p) setP({ ...p, spielt: was === 'play' ? true : was === 'pause' ? false : p.spielt });
    steuern(was).then(() => setTimeout(holen, 450)).catch((e) => setFehler(e.status === 403 ? 'premium' : e.status === 404 ? 'geraet' : 'netz'));
  };
  const jetzt = p ? Math.min(p.dauer, p.position + (p.spielt ? Date.now() - p.zeit : 0)) : 0, anteil = p?.dauer ? jetzt / p.dauer : 0;
  const stil = pos ? `left:${pos.x * innerWidth}px;top:${pos.y * innerHeight}px;right:auto;bottom:auto` : '';
  const C = 2 * Math.PI * 25;
  if (!auf) return html`<button class="sp-bubble kein-wisch ziehbar" ...${ziehen.props} style=${stil} onClick=${() => { if (ziehen.geklickt()) setAuf(true); }}
      aria-label=${p?.titel ? deEn(`Spotify: ${p.titel}`, `Spotify: ${p.titel}`) : 'Spotify'}>
    ${p?.bild ? html`<img src=${p.bild} alt=""/>` : html`<span class="sp-logo">${LOGO}</span>`}
    <svg class="sp-ring" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="25" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="3"/>
      <circle cx="28" cy="28" r="25" fill="none" stroke=${GRUEN} stroke-width="3" stroke-linecap="round" stroke-dasharray=${C} stroke-dashoffset=${C * (1 - anteil)} transform="rotate(-90 28 28)"/></svg>
    ${p?.spielt ? html`<span class="sp-wellen" aria-hidden="true"><i></i><i></i><i></i></span>` : null}
  </button>`;
  const hinweis = fehler === 'premium' ? deEn('Steuern geht nur mit Spotify Premium.', 'Controls need Spotify Premium.')
    : fehler === 'geraet' || (!p && !fehler) ? deEn('Kein aktives Gerät – Spotify einmal öffnen.', 'No active device – open Spotify once.')
    : fehler === 'netz' ? deEn('Spotify nicht erreichbar.', 'Spotify not reachable.') : null;
  return html`<div class="sp-karte kein-wisch" ...${ziehen.props} style=${stil} role="group" aria-label="Spotify">
    <div class="sp-kopf">
      ${p?.bild ? html`<img class="sp-cover" src=${p.bild} alt=""/>` : html`<span class="sp-cover sp-cover-leer">${LOGO}</span>`}
      <div class="sp-text"><b>${p?.titel ?? 'Spotify'}</b><span>${p?.kuenstler || (p?.geraet ? deEn(`auf ${p.geraet}`, `on ${p.geraet}`) : hinweis ?? '')}</span></div>
      <a class="sp-logo-link" href=${p?.link ?? 'spotify:'} aria-label=${deEn('In Spotify öffnen', 'Open in Spotify')}>${LOGO}</a>
      <button class="sp-zu" onClick=${() => setAuf(false)} aria-label=${deEn('Einklappen', 'Collapse')}>${ICON.zu}</button></div>
    ${p?.dauer ? html`<div class="sp-zeit"><span>${mmss(jetzt)}</span><div class="sp-leiste"><i style=${`width:${anteil * 100}%`}></i></div><span>${mmss(p.dauer)}</span></div>` : null}
    ${hinweis && p ? html`<span class="sp-hinweis">${hinweis}</span>` : null}
    <div class="sp-knoepfe">
      <button onClick=${() => tu('previous')} disabled=${!p} aria-label=${deEn('Vorheriger Titel', 'Previous track')}>${ICON.previous}</button>
      <button class="sp-play" onClick=${() => tu(p?.spielt ? 'pause' : 'play')} aria-label=${p?.spielt ? deEn('Pause', 'Pause') : deEn('Abspielen', 'Play')}>${p?.spielt ? ICON.pause : ICON.play}</button>
      <button onClick=${() => tu('next')} disabled=${!p} aria-label=${deEn('Nächster Titel', 'Next track')}>${ICON.next}</button></div>
  </div>`;
}

/** Einstellungen → Kalender und Verbindungen → Spotify. */
export function SpotifyKarte({ einst, setEinst }) {
  const [id, setId] = useState(clientId());
  const [meldung, setMeldung] = useState(null);
  const [laeuft, setLaeuft] = useState(false);
  const [, neu] = useState(0);
  useEffect(() => { SPOTIFY_RUECKKEHR.then((r) => { if (r) { setMeldung(r.ok ? deEn('Verbunden.', 'Connected.') : deEn(`Nicht verbunden: ${r.fehler}`, `Not connected: ${r.fehler}`)); neu((n) => n + 1); } }); }, []);
  const ist = verbunden();
  const los = async () => { setLaeuft(true); setMeldung(null); try { if (!SPOTIFY_CLIENT_ID) setzeClientId(id); await verbinden(); } catch (e) { setMeldung(e.message); setLaeuft(false); } };
  return html`<section class="card pad stack sp-einst">
    <div class="row between" style="align-items:center"><span class="viz-t sp-titel">${LOGO} Spotify</span>
      ${ist ? html`<span class="iv-ok">● ${deEn('verbunden', 'connected')}</span>` : null}</div>
    <label class="schalter" style="border-top:0;padding-top:0" for="e-spotify"><span><b>${deEn('Spotify-Bubble', 'Spotify bubble')}</b><br/>
      <span class="muted" style="font-size:12.5px">${deEn('Schwebt über der App wie die Trainingsleiste: antippen für Titel und Steuerung, ziehen zum Verschieben. Steuern braucht Spotify Premium.', 'Floats over the app like the workout bar: tap for track and controls, drag to move. Controls need Spotify Premium.')}</span></span>
      <input type="checkbox" id="e-spotify" checked=${!!einst.spotifyBubble} onChange=${(e) => setEinst({ ...einst, spotifyBubble: e.currentTarget.checked })}/></label>
    ${ist ? html`<div class="row" style="gap:8px"><span class="muted" style="flex:1;font-size:12.5px">${deEn('Die Anmeldung gilt nur auf diesem Gerät.', 'The sign-in applies to this device only.')}</span>
        <button class="btn btn-soft btn-sm" onClick=${() => { trennen(); setMeldung(deEn('Getrennt.', 'Disconnected.')); neu((n) => n + 1); }}>${deEn('Trennen', 'Disconnect')}</button></div>`
    : html`${SPOTIFY_CLIENT_ID ? null : html`<ol class="iv-schritte">
        <li>${deEn('Auf ', 'On ')}<a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">developer.spotify.com</a>${deEn(' eine App anlegen (Web API).', ' create an app (Web API).')}</li>
        <li>${deEn('Als Redirect URI genau diese Adresse eintragen:', 'Add exactly this address as redirect URI:')} <button class="link" onClick=${async () => setMeldung((await kopiere(rueckAdresse())) ? deEn('Adresse kopiert.', 'Address copied.') : rueckAdresse())}><code>${rueckAdresse()}</code></button></li>
        <li>${deEn('Unter User Management deine Spotify-E-Mail eintragen (höchstens 5 Personen je App).', 'Under User Management add your Spotify e-mail (at most 5 people per app).')}</li>
        <li>${deEn('Die Client-ID hier einfügen und verbinden.', 'Paste the client ID here and connect.')}</li></ol>
        <input class="text" type="text" autocomplete="off" placeholder="Client-ID" value=${id} onInput=${(e) => setId(e.currentTarget.value)}/>`}
      <button class="btn btn-chalk" disabled=${laeuft || !(SPOTIFY_CLIENT_ID || id.trim().length >= 20)} onClick=${los}>${laeuft ? '…' : deEn('Mit Spotify verbinden', 'Connect with Spotify')}</button>`}
    ${meldung ? html`<span class="muted" style="font-size:12.5px">${meldung}</span>` : null}
  </section>`;
}
