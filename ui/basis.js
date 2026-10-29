// PR Hunter · Gemeinsame Bausteine (Katalog, Anpassungen, Einheit, Formate, Symbole, Sheet, Scheiben, Ton).
import { html, useState, useEffect, useRef } from '../vendor/htm-preact.js';
import { scheiben, KG_PRO_LB, STANDARD_SCHEIBEN } from '../js/rechnen.js';
import { pauseFuer, STANDARD_PAUSEN } from '../js/programm.js';
import { kanon } from '../js/daten.js';

export { html, useState, useEffect, useRef };
export const fmt = (n, stellen = 2) => n == null || Number.isNaN(n) ? '–' : n.toLocaleString(ANZEIGE.sprache === 'en' ? 'en-GB' : 'de-DE', { maximumFractionDigits: stellen });

// #################################################################
// Anzeige: Sprache, Einheit, Stange/Scheiben und persönliche Übungsanpassungen (von app.js gesetzt).
// Intern ist alles kg; nur Anzeige und Eingabe rechnen in die gewählte Einheit um.
// #################################################################
const ANZEIGE = { sprache: 'de', einheit: 'kg', stange: 20, scheiben: STANDARD_SCHEIBEN, anpassung: {}, inc: 2.5, formel: 'rpe', ton: 'piep', vibration: true };
export function setzeAnzeige(neu = {}) { for (const [k, v] of Object.entries(neu)) if (v != null) ANZEIGE[k] = v; }
/** Steigerung für Programmgewichte in kg (aus den Einstellungen; in lb 5 lb usw.). */
export const incStandard = () => ANZEIGE.inc;
export const formel = () => ANZEIGE.formel;
export const sprache = () => ANZEIGE.sprache;
export const einheit = () => ANZEIGE.einheit;
export const stangeKg = () => ANZEIGE.stange;
export const scheibenKg = () => ANZEIGE.scheiben;
export const anpassung = (key) => ANZEIGE.anpassung[key] ?? null;
/** kg → Zahl in der Anzeigeeinheit (lb auf 0,1 gerundet). */
export const inAnzeige = (kg) => (kg == null ? null : ANZEIGE.einheit === 'lb' ? Math.round((kg / KG_PRO_LB) * 10) / 10 : kg);
/** Eingabe in der Anzeigeeinheit → kg. */
export const inKg = (wert) => (wert == null || wert === '' ? null : ANZEIGE.einheit === 'lb' ? Number(wert) * KG_PRO_LB : Number(wert));
/** Gewicht formatiert in der Anzeigeeinheit, ohne Einheit („172,5“ bzw. „380,3“). */
export const gw = (kg, stellen = 2) => fmt(inAnzeige(kg), ANZEIGE.einheit === 'lb' ? 1 : stellen);
/** Text → Zahl (Komma oder Punkt), leer/ungültig → null. */
export const leseZahl = (t) => { const s = String(t ?? '').trim().replace(',', '.'); const n = Number(s); return s === '' || !Number.isFinite(n) ? null : n; };

/**
 * Zahlenfeld für Handys: Textfeld mit Dezimaltastatur, Komma und Punkt erlaubt. Der getippte Text bleibt stehen
 * (ein type=number-Feld mit neu gesetztem Wert verschiebt die Schreibmarke und verwirft das Komma).
 * kg: Wert ist in kg und wird in der Anzeigeeinheit gezeigt und eingegeben.
 */
export function ZahlFeld({ id, label, wert, setze, kg = false, platzhalter = '' }) {
  const zeigen = (w) => (w == null ? '' : String(kg ? Math.round(inAnzeige(w) * 100) / 100 : w).replace('.', ANZEIGE.sprache === 'en' ? '.' : ','));
  const [text, setText] = useState(() => zeigen(wert));
  const [fokus, setFokus] = useState(false);
  useEffect(() => { if (!fokus) setText(zeigen(wert)); }, [wert, fokus, ANZEIGE.einheit]);
  return html`<label class="field" for=${id}><span class="label">${label}</span>
    <input id=${id} type="text" inputmode="decimal" autocomplete="off" placeholder=${platzhalter} value=${text}
      onFocus=${() => setFokus(true)} onBlur=${() => setFokus(false)}
      onInput=${(e) => { const t = e.currentTarget.value; setText(t); const n = leseZahl(t); setze(n == null ? null : kg ? inKg(n) : n); }}/></label>`;
}

/** Bewegte Last kurz: „5,8 t“ bzw. „12,8k lb“. */
export const tonnage = (kg) => (kg == null ? '–' : ANZEIGE.einheit === 'lb' ? `${fmt(inAnzeige(kg) / 1000, 1)}k lb` : `${fmt(kg / 1000, 1)} t`);
/** Gewicht mit Einheit („172,5 kg“). */
export const gwE = (kg, stellen = 2) => (kg == null ? '–' : `${gw(kg, stellen)} ${ANZEIGE.einheit}`);
export const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
/** Trainingsuhr: unter einer Stunde m:ss, danach h:mm:ss (nicht „61:00“). */
export const uhr = (s) => (s < 3600 ? mmss(s) : `${Math.floor(s / 3600)}:${mmss(s % 3600).padStart(5, '0')}`);
/** Dauer in Minuten als Text: „45 min“, ab einer Stunde „1 h 05 min“. */
export const minutenText = (m) => (m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`);
const WT_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MON_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WT_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const en = () => ANZEIGE.sprache === 'en';
const d = (iso) => new Date(`${iso}T00:00:00Z`);
export const datumLang = (iso) => (en() ? `${WT_EN[d(iso).getUTCDay()]}, ${d(iso).getUTCDate()} ${MON_EN[d(iso).getUTCMonth()]}`
  : `${WT_DE[d(iso).getUTCDay()]}, ${d(iso).getUTCDate()}. ${MON_DE[d(iso).getUTCMonth()]}`);
export const datumKurz = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
/** „150×5“ in der Anzeigeeinheit; ohne Gewicht (Körpergewicht ohne Zusatz) „8 Wdh“. */
export const satzKurz = (s) => (s.kg > 0 ? `${gw(s.kg)}×${s.wdh ?? '–'}` : `${s.wdh ?? '–'} Wdh`);
export const rpeKlein = (s) => (s.rpe != null ? html`<small>@${fmt(s.rpe)}</small>` : null);
const GEAR_KURZ = { guertel: 'Gürtel', knie: 'Knie', handgelenk: 'Handg.', ellbogen: 'Ellb.' };
/** Kurzinfo eines Satzes: Satztyp (außer normal), Ausrüstung, Bänder/Ketten, m/s, Notiz. */
export function satzExtras(s, { mitTyp = false } = {}) {
  const e = s.extra ?? {}, teile = [];
  if (mitTyp && TYP_NAME[s.typ]) teile.push(TYP_NAME[s.typ]);
  teile.push(...(e.gear ?? []).map((g) => GEAR_KURZ[g] ?? g));
  if (e.baender) teile.push(`Bänder ${e.baender}`);
  if (e.ketten) teile.push(`Ketten ${gw(e.ketten)} ${ANZEIGE.einheit}`);
  if (e.ms) teile.push(`${fmt(e.ms, 2)} m/s`);
  if (s.notiz) teile.push(`„${s.notiz}“`);
  return teile;
}
const TYP_NAME = { drop: 'Drop', failure: 'Versagen', amrap: 'AMRAP' };
export const wtKurz = (iso) => (en() ? WT_EN : WT_DE)[d(iso).getUTCDay()].slice(0, 2);
export const monatName = (jahr, monat) => `${(en() ? MON_EN : MON_DE)[monat]} ${jahr}`;

export const LIFT = {
  squat: { name: 'Kniebeuge', kurz: 'KB', farbe: 'var(--lift-squat)' },
  bench: { name: 'Bankdrücken', kurz: 'BD', farbe: 'var(--lift-bench)' },
  dead: { name: 'Kreuzheben', kurz: 'KH', farbe: 'var(--lift-dead)' },
  andere: { name: 'Zubehör', kurz: '+', farbe: 'var(--andere)' },
};
/** Liftname in der Anzeigesprache – für zusammengesetzte Texte, die der Übersetzer nicht als Ganzes kennt. */
const LIFT_EN = { squat: 'Squat', bench: 'Bench press', dead: 'Deadlift', andere: 'Accessories' };
export const liftName = (l) => (ANZEIGE.sprache === 'en' ? LIFT_EN[l] : LIFT[l].name);
// Katalog (app/daten/katalog.json), einmal beim Start geladen
const KATALOG = { liste: [], nach: new Map() };
/** Katalog setzen; zusammengeführte Übungen (versteckt) behalten ihren Namen für alte Trainings, sind aber nicht mehr wählbar. */
export function setzeKatalog(liste, versteckt = null) {
  KATALOG.nach = new Map(liste.map((e) => [e.k, e]));
  KATALOG.liste = versteckt?.size ? liste.filter((e) => !versteckt.has(e.k)) : liste;
}
export const katalogListe = () => KATALOG.liste;
export const uebung = (key) => KATALOG.nach.get(key) ?? null;
/** Name in der App-Sprache; ein persönlicher Anzeigename geht vor. */
export const nameVon = (key, ersatz = '–') => anpassung(key)?.name || katalogName(key) || ersatz;
export const katalogName = (key) => (ANZEIGE.sprache === 'en' ? uebung(key)?.en : uebung(key)?.de) ?? null;
export function liftVon(key) {
  const b = uebung(kanon(key))?.b;                  // Jefit-Hauptübungen zählen als Wettkampfübung (js/daten.js)
  return b === 'squat' ? 'squat' : b === 'bench' ? 'bench' : b === 'deadlift' ? 'dead' : 'andere';
}
/** Pause: eigene Pause der Übung, sonst nach Satzart (Top-Satz, Back-off, Isolation) aus den Einstellungen. */
export const pauseVon = (key, rolle = null, pausen = STANDARD_PAUSEN) => anpassung(key)?.pause || pauseFuer(rolle, uebung(key)?.f, pausen);
export const stangeVon = (key) => uebung(key)?.lt === 'barbell';
export const koerperUebung = (key) => uebung(key)?.lt === 'bodyweight_plus' || uebung(key)?.lt === 'bodyweight_minus';
export const MUSKEL_DE = {
  abdominals: 'Bauch', abductors: 'Abduktoren', adductors: 'Adduktoren', biceps: 'Bizeps', calves: 'Waden', chest: 'Brust',
  forearms: 'Unterarme', glutes: 'Gesäß', hamstrings: 'Beinbeuger', lats: 'Latissimus', 'lower back': 'Unterer Rücken',
  'middle back': 'Mittlerer Rücken', neck: 'Nacken', quadriceps: 'Quadrizeps', shoulders: 'Schultern', traps: 'Trapez', triceps: 'Trizeps',
};
/** Kleinster Gewichtsschritt in kg: in lb 5 lb, sonst 2 kg bei Kurzhanteln, 2,5 kg bei allem anderen. */
export const incVon = (key) => (ANZEIGE.einheit === 'lb' ? 5 * KG_PRO_LB : uebung(key)?.lt === 'dumbbell' ? 2 : 2.5);

export const rollenText = { top: 'Top-Satz', backoff: 'Back-off', secondary: 'Zweiteinheit', test: 'Test' };
export const rpeText = (r) => !r ? null : r.text ? r.text : r.min === r.max ? `RPE ${fmt(r.min)}` : `RPE ${fmt(r.min)}–${fmt(r.max)}`;

export const speicher = {
  lies(k) { try { return localStorage.getItem(k); } catch { return null; } },
  schreib(k, v) { try { localStorage.setItem(k, v); } catch { /* ohne Speicher geht es auch */ } },
};

// #################################################################
// Ton am Pausenende: in der App erzeugt (Web Audio, keine Tondateien). Wählbar in Einstellungen → Training.
// Jeder Ton: Liste von [Start s, Frequenz Hz, Dauer s, Lautstärke, Wellenform]; „aus“ = nur Vibration.
// #################################################################
export const TOENE = {
  piep: { name: 'Piep', noten: [[0, 784, 0.18, 0.25, 'sine'], [0.22, 784, 0.18, 0.25, 'sine'], [0.44, 1046, 0.18, 0.25, 'sine']] },
  glocke: { name: 'Glocke', noten: [[0, 1318, 1.1, 0.22, 'sine'], [0, 3638, 0.5, 0.05, 'sine'], [0.45, 1318, 1.1, 0.18, 'sine'], [0.45, 3638, 0.5, 0.04, 'sine']] },
  gong: { name: 'Gong', noten: [[0, 196, 1.8, 0.32, 'sine'], [0, 392, 1.4, 0.12, 'sine'], [0, 523, 0.9, 0.06, 'triangle']] },
  hupe: { name: 'Hupe', noten: [[0, 440, 0.32, 0.14, 'square'], [0.4, 440, 0.32, 0.14, 'square']] },
  aufstieg: { name: 'Aufstieg', noten: [[0, 523, 0.14, 0.22, 'triangle'], [0.12, 659, 0.14, 0.22, 'triangle'], [0.24, 784, 0.14, 0.22, 'triangle'], [0.36, 1046, 0.3, 0.24, 'triangle']] },
  aus: { name: 'Nur Vibration', noten: [] },
};
let audio;
export function tonFreigeben() { try { audio ??= new AudioContext(); audio.state === 'suspended' && audio.resume(); } catch { /* kein Ton im Rahmen */ } }
/** Ton spielen (Standard: der gewählte), dazu Vibration. */
export function piep(art = ANZEIGE.ton) {
  try {
    tonFreigeben();
    for (const [t, f, dauer, laut, welle] of (TOENE[art] ?? TOENE.piep).noten) {
      const o = audio.createOscillator(), g = audio.createGain(), s = audio.currentTime + t;
      o.type = welle; o.frequency.value = f; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(laut, s + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, s + dauer); o.connect(g).connect(audio.destination); o.start(s); o.stop(s + dauer + 0.02);
    }
  } catch { /* kein Ton im Rahmen */ }
  vibriere([180, 80, 180]);
}
/** Vibration der App (Pausenende, Rekord, Training starten/beenden) – abschaltbar in Einstellungen → Training.
 *  Beim Antippen von Tabs und Menüs vibriert die App nicht; das ist das Berührungs-Feedback von Android. */
export function vibriere(muster) { if (ANZEIGE.vibration !== false) try { navigator.vibrate?.(muster); } catch { /* iPhone kann es nicht */ } }
/** Text in der App-Sprache für Stellen, die der Übersetzer nicht erreicht (Benachrichtigungen). */
export const deEn = (de, enText) => (ANZEIGE.sprache === 'en' ? enText : de);
export function useTakt(aktiv, ms = 250) {
  const [, setN] = useState(0);
  useEffect(() => { if (!aktiv) return; const id = setInterval(() => setN((n) => n + 1), ms); return () => clearInterval(id); }, [aktiv, ms]);
}

const svg = (pfad) => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pfad}</svg>`;
export const I = {
  papierkorb: svg(html`<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>`),
  heute: svg(html`<path d="M2.5 12h3M18.5 12h3M5.5 7.5v9M18.5 7.5v9M8.5 5v14M15.5 5v14M8.5 12h7"/>`),
  programme: svg(html`<rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M7.5 9h9M7.5 13h9M7.5 17h5"/>`),
  verlauf: svg(html`<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>`),
  statistik: svg(html`<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>`),
  rechner: svg(html`<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8.5 7.5h7M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"/>`),
  check: svg(html`<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="3"/>`),
  theme: svg(html`<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>`),
  zu: svg(html`<path d="M6 6l12 12M18 6L6 18"/>`),
  runter: svg(html`<path d="M6 9l6 6 6-6"/>`),
  zurueck: svg(html`<path d="M15 6l-6 6 6 6"/>`),
  chart: svg(html`<path d="M4 19h16M5 15l4-4 3 3 7-7"/>`),
  tausch: svg(html`<path d="M7 7h11l-3-3M17 17H6l3 3"/>`),
  neu: svg(html`<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>`),
  teilen: svg(html`<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>`),
  suche: svg(html`<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>`),
  warn: svg(html`<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/>`),
  plus: svg(html`<path d="M12 5v14M5 12h14"/>`),
  zahnrad: svg(html`<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>`),
  verlauf_uebung: svg(html`<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4M12 7v5l3 2"/>`),
  extern: svg(html`<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`),
  kopieren: svg(html`<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>`),
  import: svg(html`<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>`),
  weiter: svg(html`<path d="M9 6l6 6-6 6"/>`),
  feed: svg(html`<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14c2.4.2 4 1.7 4.5 4.5"/>`),
};

/** Pausen-Timer: rechnet mit der Endzeit (stimmt auch nach gesperrtem Bildschirm), Ton und Vibration am Ende. */
export function PausenTimer({ timer, setTimer, kopf = false }) {
  useTakt(true, 250);
  const rest = (timer.ende - Date.now()) / 1000;
  useEffect(() => { if (rest <= 0 && !timer.fertig) { piep(); setTimer({ ...timer, fertig: true }); } }, [rest <= 0]);
  const C = 2 * Math.PI * 16, anteil = Math.max(0, Math.min(1, rest / timer.dauer));
  return html`<div class=${`timer ${rest <= 0 ? 'over' : ''} ${kopf ? 'im-kopf' : ''}`} role="timer" aria-live="off">
    <svg class="ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" style="stroke:currentColor;opacity:.2" stroke-width="4"/>
      <circle cx="20" cy="20" r="16" fill="none" style="stroke:currentColor" stroke-width="4" stroke-linecap="round" stroke-dasharray=${C} stroke-dashoffset=${C * (1 - anteil)} transform="rotate(-90 20 20)"/></svg>
    <div style="min-width:0"><div class="t">${rest > 0 ? mmss(rest) : 'Los!'}</div>
      <div class="s">${rest <= 0 ? 'Pause vorbei' : timer.start0 && timer.dauer !== timer.start0 ? `Pause ${mmss(timer.dauer)} gesamt · nächster: ${timer.naechster}`
        : `Pause · nächster: ${timer.naechster}`}</div></div>
    <button onClick=${() => setTimer({ ...timer, ende: timer.ende - 30000, dauer: Math.max(0, timer.dauer - 30) })} aria-label="30 Sekunden weniger">−30</button>
    <button onClick=${() => setTimer({ ...timer, ende: Math.max(timer.ende, Date.now()) + 30000, fertig: false, dauer: timer.dauer + 30 })} aria-label="30 Sekunden mehr">+30</button>
    <button onClick=${() => setTimer(null)} aria-label="Pause beenden" style="min-width:40px">${I.zu}</button>
  </div>`;
}

/** Kopieren mit Rückfall: klappt die Zwischenablage nicht, wird das Textfeld markiert. */
export async function kopiere(text, feld) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { if (feld) { feld.focus(); feld.select(); } return false; }
}

/** Bottom-Sheet. Eigener Eintrag in der Historie: der Zurück-Knopf schließt das Sheet statt die Ansicht zu wechseln. */
export function Sheet({ zu, children, label = 'Dialog' }) {
  const zuRef = useRef(zu);
  zuRef.current = zu;
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && zuRef.current();
    // eigene Kennung je Sheet: Zurück aus der Bildlupe (Zustand mit derselben Kennung) lässt das Sheet offen (156)
    const id = (Number(history.state?.sheet) || 0) + 1;
    let perZurueck = false;
    const pop = (e) => { if (e.state?.sheet === id) return; perZurueck = true; zuRef.current(); };
    history.pushState({ ...(history.state ?? {}), sheet: id }, '');
    addEventListener('keydown', k);
    addEventListener('popstate', pop);
    return () => {
      removeEventListener('keydown', k); removeEventListener('popstate', pop);
      if (!perZurueck && history.state?.sheet === id) history.back();      // per Knopf geschlossen: Eintrag wieder entfernen
    };
  }, []);
  // Nach unten wegziehen: nur wenn der Inhalt ganz oben steht und die Geste eindeutig nach unten geht
  const ref = useRef(null), zug = useRef(null);
  const start = (e) => {
    if (e.touches.length !== 1 || ref.current.scrollTop > 0 || e.target.closest?.('.zuschnitt, input[type="range"]')) return;
    const t = e.touches[0];
    zug.current = { x: t.clientX, y: t.clientY, dy: 0, aktiv: false, t0: Date.now() };
  };
  const ziehe = (e) => {
    const z = zug.current, s = ref.current;
    if (!z) return;
    const t = e.touches[0], dy = t.clientY - z.y, dx = t.clientX - z.x;
    if (!z.aktiv) {
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      if (dy <= 0 || Math.abs(dx) > dy || s.scrollTop > 0) { zug.current = null; return; }
      z.aktiv = true; s.classList.add('zieht');
    }
    z.dy = Math.max(0, dy);
    s.style.transform = `translateY(${z.dy}px)`;
    if (e.cancelable) e.preventDefault();
  };
  const loslassen = () => {
    const z = zug.current, s = ref.current;
    zug.current = null;
    if (!z?.aktiv) return;
    s.classList.remove('zieht');
    const schnell = z.dy > 50 && Date.now() - z.t0 < 250;
    if (schnell || z.dy > Math.min(140, s.offsetHeight * 0.3)) {
      s.style.transition = 'transform .16s ease-in'; s.style.transform = 'translateY(100%)';
      setTimeout(() => zuRef.current(), 150);
    } else {
      s.style.transition = 'transform .2s ease'; s.style.transform = '';
    }
  };
  useEffect(() => {
    // direkt registriert: touchmove muss preventDefault dürfen (passive: false)
    const s = ref.current, plan = [['touchstart', start], ['touchmove', ziehe], ['touchend', loslassen], ['touchcancel', loslassen]];
    for (const [typ, f] of plan) s.addEventListener(typ, f, { passive: false });
    return () => { for (const [typ, f] of plan) s.removeEventListener(typ, f); };
  }, []);
  return html`<div class="backdrop" onClick=${(e) => e.target === e.currentTarget && zu()}>
    <div class="sheet" ref=${ref} role="dialog" aria-modal="true" aria-label=${label}><div class="grab"></div>${children}</div>
  </div>`;
}

export function Scheiben({ kg, stange = stangeKg() }) {
  const s = scheiben(kg, { stange, inventar: scheibenKg() });
  if (!s.proSeite.length) return html`<span class="muted">leere Stange</span>`;
  return html`<span class="plates">${s.proSeite.map((w, i) => html`<span key=${i} class="pl" data-w=${w}>${gw(w)}</span>`)}</span>`;
}

const PH = { 25: 96, 20: 96, 15: 96, 10: 96, 5: 62, 2.5: 50, 1.25: 42 }, PB = { 25: 14, 20: 12, 15: 10, 10: 9, 5: 8, 2.5: 7, 1.25: 6 };
const PF = { 25: 'var(--p25)', 20: 'var(--p20)', 15: 'var(--p15)', 10: 'var(--p10)', 5: 'var(--p5)', 2.5: 'var(--p2)', 1.25: 'var(--p1)' };
export function Hantel({ kg, stange = stangeKg() }) {
  const s = scheiben(kg, { stange, inventar: scheibenKg() });
  const teile = []; let r = 228, l = 112;
  for (const [i, w] of s.proSeite.entries()) {
    const b = PB[w] ?? 8, h = PH[w] ?? 50, f = `fill:${PF[w] ?? 'var(--muted)'}`;
    teile.push(html`<rect key=${'r' + i} x=${r} y=${55 - h / 2} width=${b} height=${h} rx="2" style=${f}/>`);
    teile.push(html`<rect key=${'l' + i} x=${l - b} y=${55 - h / 2} width=${b} height=${h} rx="2" style=${f}/>`);
    r += b + 1.5; l -= b + 1.5;
  }
  return html`<div class="barbell" role="img" aria-label=${`Hantel mit ${gwE(kg)}`}>
    <svg viewBox="0 0 340 110">
      <rect x="6" y="52" width="328" height="6" rx="3" style="fill:var(--axis)"/>
      <rect x="0" y="49" width="118" height="12" rx="3" style="fill:var(--line)"/>
      <rect x="222" y="49" width="118" height="12" rx="3" style="fill:var(--line)"/>
      <rect x="114" y="40" width="5" height="30" rx="1.5" style="fill:var(--muted)"/>
      <rect x="221" y="40" width="5" height="30" rx="1.5" style="fill:var(--muted)"/>
      ${teile}
    </svg>
    ${s.rest > 0 ? html`<p class="muted" style="margin:6px 0 0;text-align:center;font-size:13px">Nicht genau ladbar: geladen ${gwE(s.geladen)}, es fehlen ${gwE(s.rest)}.</p>` : null}
  </div>`;
}

/**
 * Fortschritt eines Blocks als beladene Hantel: jede Woche eine Scheibe in Wettkampffarben (innen Woche 1, rot 25 →
 * blau 20 → gelb 15 → grün 10 → weiß 5 → schwarz 2,5). Erledigte Wochen voll mit Glanz, die aktuelle glüht,
 * kommende sind nur angedeutet.
 */
const BLOCK_FARBEN = ['var(--p25)', 'var(--p20)', 'var(--p15)', 'var(--p10)', 'var(--p5)', 'var(--p2)'];
const BLOCK_HOEHEN = [100, 100, 100, 100, 76, 64];
export function BlockHantel({ wochen, aktuell }) {
  const n = wochen.length, b = Math.min(14, 98 / n), abstand = 2.5, teile = [], zahlen = [];
  for (let i = 0; i < n; i++) {
    const zustand = i + 1 < aktuell ? 'fertig' : i + 1 === aktuell ? 'jetzt' : 'offen';
    const farbe = BLOCK_FARBEN[i % 6], h = BLOCK_HOEHEN[i % 6], y = 62 - h / 2;
    const xr = 231 + i * (b + abstand), xl = 109 - b - i * (b + abstand);
    for (const [seite, x] of [['r', xr], ['l', xl]]) {
      teile.push(html`<g key=${`${seite}${i}`} class=${zustand === 'jetzt' ? 'jetzt' : ''} style=${zustand === 'jetzt' ? `filter:drop-shadow(0 0 7px ${farbe})` : ''}>
        <rect x=${x} y=${y} width=${b} height=${h} rx="2.5" style=${`fill:${farbe};opacity:${zustand === 'offen' ? 0.14 : 1}`}/>
        ${zustand === 'offen'
          ? html`<rect x=${x + 0.6} y=${y + 0.6} width=${b - 1.2} height=${h - 1.2} rx="2" style=${`fill:none;stroke:${farbe};stroke-width:1.2;opacity:.55`}/>`
          : html`<rect x=${x} y=${y} width=${b} height=${h} rx="2.5" style="fill:url(#glanz)"/>
            <rect x=${x} y=${y} width=${b} height=${h} rx="2.5" style="fill:none;stroke:rgba(0,0,0,.45);stroke-width:1"/>`}
      </g>`);
    }
    zahlen.push(html`<text key=${`z${i}`} x=${xr + b / 2} y="126" text-anchor="middle"
      style=${`fill:${zustand === 'jetzt' ? 'var(--acc-text)' : zustand === 'offen' ? 'var(--muted)' : 'var(--ink)'};font:800 ${zustand === 'jetzt' ? 11.5 : 10}px var(--f)`}>${i + 1}</text>`);
  }
  return html`<div class="hantel"><svg viewBox="0 0 340 132" role="img" aria-label=${`Woche ${aktuell} von ${n}`}>
    <defs>
      <linearGradient id="glanz" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".22" stop-color="#fff" stop-opacity=".1"/>
        <stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
      <linearGradient id="stahl" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#C9CED6"/><stop offset=".45" stop-color="#7B828C"/><stop offset="1" stop-color="#2E333A"/></linearGradient>
    </defs>
    <rect x="2" y="58.5" width="336" height="7" rx="3.5" style="fill:url(#stahl)"/>
    <rect x="104" y="47" width="6" height="30" rx="1.5" style="fill:url(#stahl)"/><rect x="230" y="47" width="6" height="30" rx="1.5" style="fill:url(#stahl)"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((k) => html`<line key=${k} x1=${124 + k * 5} x2=${128 + k * 5} y1="58.5" y2="65.5" style="stroke:rgba(0,0,0,.35)"/>`)}
    ${teile}${zahlen}
  </svg></div>`;
}

/** Profilbild rund; ohne Bild die Initialen auf rotem Grund. */
export function Avatar({ bild, name, groesse = 40 }) {
  const initialen = (name ?? '?').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((t) => t[0].toUpperCase()).join('') || '?';
  return bild ? html`<img class="avatar" src=${bild} alt="" style=${`width:${groesse}px;height:${groesse}px`}/>`
    : html`<span class="avatar leer" style=${`width:${groesse}px;height:${groesse}px;font-size:${Math.round(groesse * 0.38)}px`} aria-hidden="true">${initialen}</span>`;
}

// Übungsbild aus der Free Exercise DB (gemeinfrei); ohne Bild ein Hantel-Symbol in der Farbe des Lifts
const BILD_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
export const bildVon = (key) => { const i = uebung(key)?.i ?? uebung(kanon(key))?.i; return i ? `${BILD_URL}${encodeURIComponent(i)}/0.jpg` : null; };
/** Beide Bilder (Start- und Endposition) einer Übung aus dem Katalog; Varianten ohne Foto nehmen die der Grundübung. */
export const bilderVon = (key) => { const i = uebung(key)?.i ?? uebung(kanon(key))?.i; return i ? [0, 1].map((n) => `${BILD_URL}${encodeURIComponent(i)}/${n}.jpg`) : []; };
/** Große Ansicht öffnen (BildLupe hört darauf, eingebunden in app.js). */
export const zeigeBild = (urls, name = '') => dispatchEvent(new CustomEvent('prh-bild', { detail: { urls, name } }));

// Antippen vergrößert (auch innerhalb von Knöpfen: Klick wird nicht weitergereicht)
export function UebungsBild({ schluessel, groesse = 44, zoom = true }) {
  const [kaputt, setKaputt] = useState(false);
  const url = bildVon(schluessel), lift = liftVon(schluessel);
  const masse = `width:${groesse}px;height:${groesse}px`;
  if (!url || kaputt) {
    return html`<span class="uebung-bild leer" style=${`${masse};color:${lift === 'andere' ? 'var(--ink-2)' : LIFT[lift].farbe}`} aria-hidden="true">${I.heute}</span>`;
  }
  const gross = (e) => { e.stopPropagation(); e.preventDefault(); zeigeBild(bilderVon(schluessel), nameVon(schluessel)); };
  if (!zoom) return html`<img class="uebung-bild" src=${url} alt="" loading="lazy" decoding="async" style=${masse} onError=${() => setKaputt(true)}/>`;
  return html`<img class="uebung-bild zoombar" src=${url} alt="" role="button" aria-label="Bild vergrößern" loading="lazy" decoding="async" style=${masse}
    onClick=${gross} onError=${() => setKaputt(true)}/>`;
}

/** Vollbild-Ansicht der Übungsbilder; Tippen oder Zurück schließt. */
export function BildLupe() {
  const [bild, setBild] = useState(null);
  // eigener Verlaufseintrag: die Zurück-Taste des Handys schließt nur das Bild
  useEffect(() => {
    const h = (e) => { setBild(e.detail); history.pushState({ ...history.state, lupe: true }, ''); };
    const zu = (e) => { if (!e.state?.lupe) setBild(null); };
    addEventListener('prh-bild', h); addEventListener('popstate', zu);
    return () => { removeEventListener('prh-bild', h); removeEventListener('popstate', zu); };
  }, []);
  if (!bild) return null;
  return html`<div class="bild-lupe" role="dialog" aria-label=${bild.name || 'Bild'} onClick=${() => (history.state?.lupe ? history.back() : setBild(null))}>
    ${bild.name ? html`<b>${bild.name}</b>` : null}
    <div class="bild-lupe-bilder">${bild.urls.map((u, i) => html`<img key=${i} src=${u} alt="" onError=${(ev) => { ev.currentTarget.style.display = 'none'; }}/>`)}</div>
    <span class="muted">Tippen zum Schließen</span>
  </div>`;
}
