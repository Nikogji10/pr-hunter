// PR Hunter · Spotify-Bubble (Wunsch 267, 09.11.2026): schwebt wie die Mini-Leiste des Trainings, frei verschiebbar.
// Eingeklappt rund mit Albumcover und grünem Fortschrittsring (gedrückt halten öffnet Spotify), angetippt eine flache Leiste
// über die ganze Breite im Spotify-Stil: Cover, Titel, Zurück / Abspielen-Pause / Weiter, darunter die Zeitleiste zum Spulen. An und aus in Einstellungen → Kalender und Verbindungen → Spotify.
import { html, useState, useEffect, useRef, deEn, useZiehen, kopiere } from './basis.js';
import { verbunden, verbinden, trennen, wiedergabe, naechsterTitel, steuern, rueckkehr, clientId, setzeClientId, rueckAdresse, SPOTIFY_CLIENT_ID, spotifyOeffnen } from '../js/spotify.js';

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
  shuffle: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3.5c2 0 3.2.9 4.3 2.6l1.4 2.2c1.1 1.7 2.3 2.6 4.3 2.6H20M4 17h3.5c1.3 0 2.3-.4 3.1-1.2M13.4 8.2c.8-.8 1.8-1.2 3.1-1.2H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  repeat: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11V9.5A2.5 2.5 0 0 1 7.5 7H19M16.5 4.5 19 7l-2.5 2.5M19 13v1.5a2.5 2.5 0 0 1-2.5 2.5H5M7.5 19.5 5 17l2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
// 267: Hintergrund der Leiste in der Farbe des Covers (Mittelwert, abgedunkelt) – wie „Now Playing“ bei Spotify
const FARBEN = new Map();
function farbeVon(url) {
  if (!url) return Promise.resolve(null);
  if (FARBEN.has(url)) return Promise.resolve(FARBEN.get(url));
  return new Promise((ok) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 12;
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 12, 12);
        const d = x.getImageData(0, 0, 12, 12).data; let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { const hell = (d[i] + d[i + 1] + d[i + 2]) / 3; if (hell < 16 || hell > 245) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
        const f = n ? [r / n, g / n, b / n].map((v) => Math.round(v * 0.62)) : null;   // abdunkeln, damit weiße Schrift lesbar bleibt
        const farbe = f ? `rgb(${f.join(',')})` : null;
        FARBEN.set(url, farbe); ok(farbe);
      } catch { FARBEN.set(url, null); ok(null); }        // Bild ohne Freigabe (CORS): Standardfarbe
    };
    img.onerror = () => { FARBEN.set(url, null); ok(null); };
    img.src = url;
  });
}
const WIEDERHOLEN = ['off', 'context', 'track'];
const B = 66;                                               // Durchmesser der Bubble
const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const lage = () => { try { return JSON.parse(localStorage.getItem('prh-spotify-pos') ?? 'null'); } catch { return null; } };
const zoom = () => parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
const grenze = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));

/**
 * Schwebende Bubble. Zeigt sich nur, wenn eingeschaltet und verbunden. Lage als Anteil des Bildschirms (wie die
 * Trainingsleiste), beim Setzen durch den App-Zoom geteilt – sonst sprang sie nach dem Loslassen. Immer ganz im Bild.
 */
export function SpotifyBubble({ an }) {
  const [p, setP] = useState(undefined);                   // undefined = lädt, null = kein aktives Gerät
  const [auf, setAuf] = useState(false);
  const [fehler, setFehler] = useState(null);
  const [pos, setPos] = useState(lage);
  const [spulen, setSpulen] = useState(null);               // Position beim Ziehen der Zeitleiste (ms)
  const [farbe, setFarbe] = useState(null), [als, setAls] = useState(null);   // Cover-Farbe, nächster Titel
  const [, tick] = useState(0);
  const laeuft = useRef(false), karte = useRef(null);
  const aktiv = an && verbunden();
  const holen = () => { if (laeuft.current || document.hidden) return; laeuft.current = true;
    wiedergabe().then((x) => { setP(x); setFehler(null); }).catch((e) => setFehler(e.status === 403 ? 'premium' : 'netz')).finally(() => { laeuft.current = false; }); };
  useEffect(() => {
    if (!aktiv) return;
    holen();
    const iv = setInterval(holen, auf ? 3000 : 6000), t = setInterval(() => tick((n) => n + 1), 500);
    const sicht = () => { if (!document.hidden) holen(); };
    const groesse = () => tick((n) => n + 1);
    document.addEventListener('visibilitychange', sicht); addEventListener('resize', groesse);
    return () => { clearInterval(iv); clearInterval(t); document.removeEventListener('visibilitychange', sicht); removeEventListener('resize', groesse); };
  }, [aktiv, auf]);
  useEffect(() => { let weg = false; farbeVon(p?.bild).then((f) => { if (!weg) setFarbe(f); }); return () => { weg = true; }; }, [p?.bild]);
  // „Als Nächstes“ bei jedem Titelwechsel (und alle 30 s, falls die Warteschlange sich ändert)
  useEffect(() => {
    if (!aktiv || !auf || !p?.link) { setAls(null); return; }
    let weg = false;
    const laden = () => naechsterTitel().then((n) => { if (!weg) setAls(n); }).catch(() => { if (!weg) setAls(null); });
    laden(); const iv = setInterval(laden, 30000);
    return () => { weg = true; clearInterval(iv); };
  }, [aktiv, auf, p?.link]);
  const merken = (n) => { setPos(n); try { localStorage.setItem('prh-spotify-pos', JSON.stringify(n)); } catch { /* egal */ } };
  // Bubble frei verschieben (immer ganz im Bild), gedrückt halten öffnet Spotify
  const ziehen = useZiehen({ achsen: 'xy', lang: spotifyOeffnen, ablegen: (r) => merken({
    x: grenze(r.left / innerWidth, 0, (innerWidth - r.width) / innerWidth), y: grenze(r.top / innerHeight, 0, (innerHeight - r.height) / innerHeight) }) });
  // große Leiste: volle Breite, nur senkrecht verschieben
  // Wischen nach links = nächster Titel, nach rechts = vorheriger (wie der Miniplayer von Spotify)
  const ziehenKarte = useZiehen({ achsen: 'y', wischX: (r) => tu(r < 0 ? 'next' : 'previous'), ablegen: (r) => merken({ ...(pos ?? {}), y: grenze(r.top / innerHeight, 0, (innerHeight - r.height) / innerHeight) }) });
  if (!aktiv || p === undefined) return null;
  const tu = (was, wert) => {
    if (p) setP({ ...p, spielt: was === 'play' ? true : was === 'pause' ? false : p.spielt, ...(was === 'seek' ? { position: wert, zeit: Date.now() } : {}),
      ...(was === 'shuffle' ? { shuffle: wert } : {}), ...(was === 'repeat' ? { wiederholen: wert } : {}) });
    steuern(was, wert).then(() => setTimeout(holen, 450)).catch((e) => setFehler(e.status === 403 ? 'premium' : e.status === 404 ? 'geraet' : 'netz'));
  };
  const jetzt = spulen ?? (p ? Math.min(p.dauer, p.position + (p.spielt ? Date.now() - p.zeit : 0)) : 0), anteil = p?.dauer ? jetzt / p.dauer : 0;
  const z = zoom(), C = 2 * Math.PI * 25;
  if (!auf) {
    const x = pos ? grenze(pos.x, 0, (innerWidth - B * z) / innerWidth) : null, y = pos ? grenze(pos.y, 0, (innerHeight - B * z) / innerHeight) : null;
    return html`<button class="sp-bubble kein-wisch ziehbar" ...${ziehen.props} style=${pos ? `left:${(x * innerWidth) / z}px;top:${(y * innerHeight) / z}px;right:auto;bottom:auto` : ''}
        onClick=${() => { if (ziehen.geklickt()) setAuf(true); }} aria-label=${p?.titel ? `Spotify: ${p.titel}` : 'Spotify'}>
      ${p?.bild ? html`<img src=${p.bild} alt=""/>` : html`<span class="sp-logo">${LOGO}</span>`}
      <svg class="sp-ring" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="25" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="3"/>
        <circle cx="28" cy="28" r="25" fill="none" stroke=${GRUEN} stroke-width="3" stroke-linecap="round" stroke-dasharray=${C} stroke-dashoffset=${C * (1 - anteil)} transform="rotate(-90 28 28)"/></svg>
      ${p?.spielt ? html`<span class="sp-wellen" aria-hidden="true"><i></i><i></i><i></i></span>` : null}
    </button>`;
  }
  const hinweis = fehler === 'premium' ? deEn('Steuern geht nur mit Spotify Premium.', 'Controls need Spotify Premium.')
    : fehler === 'geraet' || (!p && !fehler) ? deEn('Kein aktives Gerät – Spotify einmal öffnen.', 'No active device – open Spotify once.')
    : fehler === 'netz' ? deEn('Spotify nicht erreichbar.', 'Spotify not reachable.') : null;
  // Höhe der Leiste ist etwa 92 px; oben an der Bubble, aber ganz im Bild
  const hoehe = (karte.current?.offsetHeight ?? 92) * z;
  const top = pos ? grenze(pos.y * innerHeight, 8 * z, innerHeight - hoehe - 8 * z) / z : null;
  return html`<div class="sp-karte kein-wisch" ...${{ ...ziehenKarte.props, ref: (el) => { karte.current = el; ziehenKarte.props.ref.current = el; } }}
      style=${`${top != null ? `top:${top}px;bottom:auto;` : ''}${farbe ? `--sp-farbe:${farbe};` : ''}`} role="group" aria-label="Spotify">
    <div class="sp-zeile">
      <button class="sp-cover-knopf" onClick=${spotifyOeffnen} aria-label=${deEn('In Spotify öffnen', 'Open in Spotify')}>
        ${p?.bild ? html`<img class="sp-cover" src=${p.bild} alt=""/>` : html`<span class="sp-cover sp-cover-leer">${LOGO}</span>`}</button>
      <div class="sp-text"><b>${p?.titel ?? 'Spotify'}</b><span><i class="sp-mini-logo">${LOGO}</i>${p?.kuenstler || (p?.geraet ? deEn(`auf ${p.geraet}`, `on ${p.geraet}`) : hinweis ?? '')}</span></div>
      <div class="sp-knoepfe">
        <button onClick=${() => tu('previous')} disabled=${!p} aria-label=${deEn('Vorheriger Titel', 'Previous track')}>${ICON.previous}</button>
        <button class="sp-play" onClick=${() => tu(p?.spielt ? 'pause' : 'play')} aria-label=${p?.spielt ? deEn('Pause', 'Pause') : deEn('Abspielen', 'Play')}>${p?.spielt ? ICON.pause : ICON.play}</button>
        <button onClick=${() => tu('next')} disabled=${!p} aria-label=${deEn('Nächster Titel', 'Next track')}>${ICON.next}</button></div>
      <button class="sp-zu" onClick=${() => setAuf(false)} aria-label=${deEn('Einklappen', 'Collapse')}>${ICON.zu}</button></div>
    ${p?.dauer ? html`<div class="sp-zeit">
      <button class=${`sp-klein ${p.shuffle ? 'an' : ''}`} onClick=${() => tu('shuffle', !p.shuffle)} aria-pressed=${String(!!p.shuffle)} aria-label=${deEn('Zufällige Wiedergabe', 'Shuffle')}>${ICON.shuffle}</button>
      <span>${mmss(jetzt)}</span>
      <input class="sp-regler" type="range" min="0" max=${p.dauer} step="1000" value=${jetzt} style=${`--anteil:${anteil * 100}%`} aria-label=${deEn('Position im Titel', 'Position in track')}
        onInput=${(e) => setSpulen(Number(e.currentTarget.value))} onChange=${(e) => { const w = Number(e.currentTarget.value); setSpulen(null); tu('seek', w); }}/>
      <span>${mmss(p.dauer)}</span>
      <button class=${`sp-klein ${p.wiederholen !== 'off' ? 'an' : ''}`} onClick=${() => tu('repeat', WIEDERHOLEN[(WIEDERHOLEN.indexOf(p.wiederholen) + 1) % 3])}
        aria-label=${p.wiederholen === 'track' ? deEn('Titel wiederholen', 'Repeat track') : p.wiederholen === 'context' ? deEn('Alles wiederholen', 'Repeat all') : deEn('Wiederholen aus', 'Repeat off')}>
        ${ICON.repeat}${p.wiederholen === 'track' ? html`<i class="sp-eins">1</i>` : null}</button></div>` : null}
    ${als ? html`<span class="sp-als"><b>${deEn('Als Nächstes', 'Next up')}</b> ${als.titel}${als.kuenstler ? ` · ${als.kuenstler}` : ''}</span>` : null}
    ${hinweis && p ? html`<span class="sp-hinweis">${hinweis}</span>` : null}
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
