// PR Hunter · Gemeinsame Bausteine (Katalog, Anpassungen, Einheit, Formate, Symbole, Sheet, Scheiben, Ton).
import { html, useState, useEffect } from '../vendor/htm-preact.js';
import { scheiben, KG_PRO_LB, STANDARD_SCHEIBEN } from '../js/rechnen.js';
import { pauseFuer, STANDARD_PAUSEN } from '../js/programm.js';
import { kanon } from '../js/daten.js';

export { html, useState, useEffect };
export const fmt = (n, stellen = 2) => n == null || Number.isNaN(n) ? '–' : n.toLocaleString(ANZEIGE.sprache === 'en' ? 'en-GB' : 'de-DE', { maximumFractionDigits: stellen });

// #################################################################
// Anzeige: Sprache, Einheit, Stange/Scheiben und persönliche Übungsanpassungen (von app.js gesetzt).
// Intern ist alles kg; nur Anzeige und Eingabe rechnen in die gewählte Einheit um.
// #################################################################
const ANZEIGE = { sprache: 'de', einheit: 'kg', stange: 20, scheiben: STANDARD_SCHEIBEN, anpassung: {}, inc: 2.5, formel: 'rpe' };
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
const WT = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const d = (iso) => new Date(`${iso}T00:00:00Z`);
export const datumLang = (iso) => `${WT[d(iso).getUTCDay()]}, ${d(iso).getUTCDate()}. ${MON[d(iso).getUTCMonth()]}`;
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
export const wtKurz = (iso) => WT[d(iso).getUTCDay()].slice(0, 2);
export const monatName = (jahr, monat) => `${MON[monat]} ${jahr}`;

export const LIFT = {
  squat: { name: 'Kniebeuge', kurz: 'KB', farbe: 'var(--lift-squat)' },
  bench: { name: 'Bankdrücken', kurz: 'BD', farbe: 'var(--lift-bench)' },
  dead: { name: 'Kreuzheben', kurz: 'KH', farbe: 'var(--lift-dead)' },
  andere: { name: 'Zubehör', kurz: '+', farbe: 'var(--andere)' },
};
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

let audio;
export function tonFreigeben() { try { audio ??= new AudioContext(); } catch { /* kein Ton im Rahmen */ } }
export function piep() {
  try {
    tonFreigeben();
    for (const t of [0, 0.22, 0.44]) {
      const o = audio.createOscillator(), g = audio.createGain(), s = audio.currentTime + t;
      o.frequency.value = t < 0.4 ? 784 : 1046; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.25, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.18); o.connect(g).connect(audio.destination); o.start(s); o.stop(s + 0.2);
    }
  } catch { /* kein Ton im Rahmen */ }
  try { navigator.vibrate?.([180, 80, 180]); } catch { /* iPhone kann es nicht */ }
}
export function useTakt(aktiv, ms = 250) {
  const [, setN] = useState(0);
  useEffect(() => { if (!aktiv) return; const id = setInterval(() => setN((n) => n + 1), ms); return () => clearInterval(id); }, [aktiv, ms]);
}

const svg = (pfad) => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pfad}</svg>`;
export const I = {
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
  suche: svg(html`<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>`),
  warn: svg(html`<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/>`),
  plus: svg(html`<path d="M12 5v14M5 12h14"/>`),
  zahnrad: svg(html`<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>`),
  verlauf_uebung: svg(html`<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4M12 7v5l3 2"/>`),
  extern: svg(html`<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`),
  kopieren: svg(html`<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>`),
  import: svg(html`<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>`),
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
    <div style="min-width:0"><div class="t">${rest > 0 ? mmss(rest) : 'Los!'}</div><div class="s">${rest > 0 ? `Pause · nächster: ${timer.naechster}` : 'Pause vorbei'}</div></div>
    <button onClick=${() => setTimer({ ...timer, ende: timer.ende - 30000 })} aria-label="30 Sekunden weniger">−30</button>
    <button onClick=${() => setTimer({ ...timer, ende: Math.max(timer.ende, Date.now()) + 30000, fertig: false, dauer: timer.dauer + 30 })} aria-label="30 Sekunden mehr">+30</button>
    <button onClick=${() => setTimer(null)} aria-label="Pause beenden" style="min-width:40px">${I.zu}</button>
  </div>`;
}

/** Kopieren mit Rückfall: klappt die Zwischenablage nicht, wird das Textfeld markiert. */
export async function kopiere(text, feld) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { if (feld) { feld.focus(); feld.select(); } return false; }
}

export function Sheet({ zu, children, label = 'Dialog' }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && zu(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  return html`<div class="backdrop" onClick=${(e) => e.target === e.currentTarget && zu()}>
    <div class="sheet" role="dialog" aria-modal="true" aria-label=${label}><div class="grab"></div>${children}</div>
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

/** Fortschritt eines Blocks als beladene Hantel: jede Woche eine Scheibe, innen Woche 1. */
export function BlockHantel({ wochen, aktuell }) {
  const n = wochen.length, b = Math.min(13, 96 / n), teile = [];
  for (let i = 0; i < n; i++) {
    const zustand = i + 1 < aktuell ? 'fertig' : i + 1 === aktuell ? 'jetzt' : 'offen';
    const st = zustand === 'fertig' ? 'fill:var(--ink)' : zustand === 'jetzt' ? 'fill:url(#raendel);stroke:var(--ink);stroke-width:2' : 'fill:transparent;stroke:var(--line);stroke-width:1.5';
    const xr = 230 + i * (b + 3), xl = 110 - b - i * (b + 3);
    teile.push(html`<g key=${i}>
      <rect x=${xr} y="14" width=${b} height="92" rx="2.5" style=${st}/><rect x=${xl} y="14" width=${b} height="92" rx="2.5" style=${st}/>
      <text x=${xr + b / 2} y="122" text-anchor="middle" style=${`fill:${zustand === 'offen' ? 'var(--muted)' : 'var(--ink)'};font:800 10px var(--f)`}>${i + 1}</text></g>`);
  }
  return html`<div class="hantel"><svg viewBox="0 0 340 128" role="img" aria-label=${`Woche ${aktuell} von ${n}`}>
    <defs><pattern id="raendel" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="5" height="5" style="fill:var(--raised)"/><rect width="1.6" height="5" style="fill:var(--ink)"/></pattern></defs>
    <rect x="4" y="57" width="332" height="6" rx="3" style="fill:var(--axis)"/>
    <rect x="114" y="46" width="5" height="28" rx="1.5" style="fill:var(--muted)"/><rect x="221" y="46" width="5" height="28" rx="1.5" style="fill:var(--muted)"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((k) => html`<line key=${k} x1=${140 + k * 5} x2=${144 + k * 5} y1="57" y2="63" style="stroke:var(--line)"/>`)}
    ${teile}
  </svg></div>`;
}
