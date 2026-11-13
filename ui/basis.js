// PR Hunter · Gemeinsame Bausteine (Katalog, Anpassungen, Einheit, Formate, Symbole, Sheet, Scheiben, Ton).
import { html, useState, useEffect, useRef, useLayoutEffect, render } from '../vendor/htm-preact.js';
import { pauseAnteil, pausePlus, pauseMinus, pauseGesamt } from '../js/pausenbalken.js';
export { pauseAnteil, pausePlus, pauseMinus };
/** Farbe der Pause nach Restzeit (03.11.), fließend: grün bis 1:00, dann über Gelb (0:30) nach Rot (0:00); vorbei = grün („Los!“). */
export const pausenFarbe = (rest) => {
  if (rest <= 0 || rest >= 60) return 'hsl(145 62% 58%)';
  const farbton = rest >= 30 ? 45 + ((rest - 30) / 30) * 100 : -6 + (rest / 30) * 51;     // 145 grün → 45 gelb → −6 rot
  return `hsl(${farbton.toFixed(1)} ${rest >= 30 ? 70 : 82}% ${rest >= 30 ? 56 : 62}%)`;
};
import { scheiben, KG_PRO_LB, STANDARD_SCHEIBEN } from '../js/rechnen.js';
import { pauseFuer, STANDARD_PAUSEN } from '../js/programm.js';
import { kanon } from '../js/daten.js';

export { html, useState, useEffect, useRef };
export const fmt = (n, stellen = 2) => n == null || Number.isNaN(n) ? '–' : n.toLocaleString(ANZEIGE.sprache === 'en' ? 'en-GB' : 'de-DE', { maximumFractionDigits: stellen });
/** Prozent mit Vorzeichen: +5, −5, ±0 (echtes Minuszeichen). */
export const vz = (p) => (p > 0 ? `+${fmt(p, 0)}` : p < 0 ? `−${fmt(-p, 0)}` : '±0');
/** 283: immer zwei Nachkommastellen (Tempo in m/s: 0,30 statt 0,3). */
export const fmt2 = (n) => n == null || Number.isNaN(n) ? '–' : n.toLocaleString(ANZEIGE.sprache === 'en' ? 'en-GB' : 'de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  if (e.ms) teile.push(`${fmt2(e.ms)} m/s`);
  if (mitTyp && e.technik) teile.push(e.technik === 'gut' ? 'Technik 👍' : 'Technik 👎');
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
/** Echte Langhantel (nicht Multipresse, SZ-Stange, Trap Bar) – nur dort Aufwärm- und Scheiben-Tipps (03.11.). */
export const langhantel = (key) => uebung(key)?.lt === 'barbell' && (uebung(key)?.eq ?? 'barbell') === 'barbell';
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
// 309: Körpergewicht + Zusatz (Klimmzug, Dips mit Gewicht) wahlweise als Gesamtlast oder nur Zusatzgewicht.
// Ein Schalter für alle Ansichten (Übungsseite, Verlauf, Training), je Gerät gemerkt. Gerechnet wird immer mit der
// Gesamtlast; „Zusatz“ zieht beim Anzeigen das Körpergewicht des jeweiligen Tages ab.
// #################################################################
export const mitZusatzLast = (key) => uebung(key)?.lt === 'bodyweight_plus';
let KG_MODUS = speicher.lies('prh-kg-modus') === 'zusatz' ? 'zusatz' : 'gesamt';
export const kgModus = () => KG_MODUS;
export function setzeKgModus(m) {
  KG_MODUS = m === 'zusatz' ? 'zusatz' : 'gesamt';
  speicher.schreib('prh-kg-modus', KG_MODUS);
  dispatchEvent(new Event('prh-kg-modus'));
}
/** Zeichnet neu, sobald irgendwo umgeschaltet wird (alle offenen Ansichten bleiben gleich). */
export function useKgModus() {
  const [m, setM] = useState(KG_MODUS);
  useEffect(() => { const f = () => setM(KG_MODUS); addEventListener('prh-kg-modus', f); return () => removeEventListener('prh-kg-modus', f); }, []);
  return m;
}
/** Körpergewicht hinter einem ausgewerteten Satz (last = Körpergewicht + Zusatz), sonst null. */
export const koerperVon = (s) => (s && s.last != null && s.kg != null ? s.last - s.kg : null);
/** Gesamtwert (Last oder e1RM) in der gewählten Sicht: bei „Zusatz“ ohne das Körpergewicht. */
export const kgSicht = (key, gesamt, koerper) => (gesamt == null || KG_MODUS !== 'zusatz' || !mitZusatzLast(key) || !(koerper > 0)
  ? gesamt : Math.round((gesamt - koerper) * 10) / 10);
/** Gewicht eines ausgewerteten Satzes als Text: Gesamt „120 kg (+35)“, Zusatz „+35 kg“, ohne Zusatz „Körpergewicht“. */
export function kgSatzText(key, s) {
  const zusatz = s.kg ?? 0, gesamt = s.last;
  if (!mitZusatzLast(key) || gesamt == null || KG_MODUS === 'zusatz') {
    return zusatz > 0 ? `${mitZusatzLast(key) ? '+' : ''}${gw(zusatz)} ${ANZEIGE.einheit}` : mitZusatzLast(key) || koerperUebung(key) ? deEn('Körpergewicht', 'Bodyweight') : s.kg != null ? `${gw(zusatz)} ${ANZEIGE.einheit}` : '–';
  }
  return `${gw(gesamt)} ${ANZEIGE.einheit}${zusatz > 0 ? ` (+${gw(zusatz)})` : ` (${deEn('KG', 'BW')})`}`;
}
/** Umschalter Gesamt | Zusatz – nur bei Übungen mit Körpergewicht + Zusatz zeigen. */
export function KgModusSchalter({ klein = false }) {
  const m = useKgModus();
  return html`<div class=${`seg kg-modus ${klein ? 'klein' : ''}`} role="group" aria-label=${deEn('Gewicht anzeigen als', 'Show weight as')}>
    <button aria-pressed=${String(m === 'gesamt')} onClick=${(e) => { e.stopPropagation(); setzeKgModus('gesamt'); }}>${deEn('Gesamt', 'Total')}</button>
    <button aria-pressed=${String(m === 'zusatz')} onClick=${(e) => { e.stopPropagation(); setzeKgModus('zusatz'); }}>${deEn('Zusatz', 'Added')}</button></div>`;
}

// #################################################################
// Ton am Pausenende: in der App erzeugt (Web Audio, keine Tondateien). Wählbar in Einstellungen → Training.
// Jeder Ton: Liste von [Start s, Frequenz Hz, Dauer s, Lautstärke, Wellenform]; „aus“ = nur Vibration.
// #################################################################
// Töne am Pausenende – alle im Browser erzeugt (keine Dateien). Note: [Start s, Frequenz Hz, Dauer s, Lautstärke, Welle, Zielfrequenz?]
// Welle 'rausch' = gefiltertes Rauschen um die Frequenz (Startschuss, Klirren); mit Zielfrequenz gleitet der Ton (Laser, Power-up).
const ton = (gruppe, name, en, noten) => ({ gruppe, name, en, noten });
const folge = (fs, abstand, dauer, laut, welle, ab = 0) => fs.map((f, i) => [ab + i * abstand, f, dauer, laut, welle]);
export const TON_GRUPPEN = [['klassisch', 'Klassisch', 'Classic'], ['gym', 'Gym und Sport', 'Gym and sport'], ['arcade', 'Arcade und Retro', 'Arcade and retro'],
  ['musik', 'Musikalisch', 'Musical'], ['sanft', 'Sanft', 'Soft'], ['laut', 'Laut', 'Loud'], ['still', 'Ohne Ton', 'Silent']];
export const TOENE = {
  // Klassisch
  piep: ton('klassisch', 'Piep', 'Beep', [[0, 784, 0.18, 0.25, 'sine'], [0.22, 784, 0.18, 0.25, 'sine'], [0.44, 1046, 0.18, 0.25, 'sine']]),
  doppelpiep: ton('klassisch', 'Doppelpiep', 'Double beep', [[0, 1568, 0.09, 0.2, 'square'], [0.13, 1568, 0.09, 0.2, 'square']]),
  wecker: ton('klassisch', 'Digitalwecker', 'Digital alarm', [0, 0.5].flatMap((ab) => folge([2093, 2093, 2093, 2093], 0.09, 0.06, 0.13, 'square', ab))),
  glocke: ton('klassisch', 'Glocke', 'Bell', [[0, 1318, 1.1, 0.22, 'sine'], [0, 3638, 0.5, 0.05, 'sine'], [0.45, 1318, 1.1, 0.18, 'sine'], [0.45, 3638, 0.5, 0.04, 'sine']]),
  gong: ton('klassisch', 'Gong', 'Gong', [[0, 196, 1.8, 0.32, 'sine'], [0, 392, 1.4, 0.12, 'sine'], [0, 523, 0.9, 0.06, 'triangle']]),
  klingel: ton('klassisch', 'Fahrradklingel', 'Bike bell', [[0, 2637, 0.35, 0.16, 'triangle'], [0, 3951, 0.25, 0.05, 'sine'], [0.18, 2637, 0.5, 0.16, 'triangle'], [0.18, 3951, 0.3, 0.05, 'sine']]),
  // Gym und Sport
  boxglocke: ton('gym', 'Ringglocke (Boxen)', 'Boxing bell', [0, 0.28, 0.56].flatMap((t) => [[t, 1175, 0.9, 0.24, 'sine'], [t, 2945, 0.5, 0.07, 'sine'], [t, 4400, 0.25, 0.03, 'sine']])),
  pfiff: ton('gym', 'Schiedsrichterpfiff', 'Referee whistle', Array.from({ length: 14 }, (_, i) => [i * 0.035, i % 2 ? 2950 : 2700, 0.04, 0.12, 'sine']).concat([[0.55, 2800, 0.35, 0.12, 'sine']])),
  startschuss: ton('gym', 'Startschuss', 'Starting pistol', [[0, 1800, 0.35, 0.6, 'rausch'], [0, 120, 0.25, 0.3, 'sine', 50]]),
  eisen: ton('gym', 'Eisen (Scheiben klirren)', 'Iron plates', [[0, 523, 0.6, 0.12, 'sine'], [0, 1397, 0.45, 0.08, 'sine'], [0, 2311, 0.3, 0.06, 'sine'], [0, 3150, 0.25, 0.04, 'sine'], [0, 5000, 0.12, 0.2, 'rausch'],
    [0.16, 587, 0.5, 0.1, 'sine'], [0.16, 1480, 0.35, 0.06, 'sine'], [0.16, 4500, 0.1, 0.15, 'rausch']]),
  buzzer: ton('gym', 'Hallen-Buzzer', 'Arena buzzer', [[0, 220, 0.9, 0.12, 'square'], [0, 233, 0.9, 0.1, 'sawtooth']]),
  hupe: ton('gym', 'Hupe', 'Horn', [[0, 440, 0.32, 0.14, 'square'], [0.4, 440, 0.32, 0.14, 'square']]),
  // Arcade und Retro
  muenze: ton('arcade', 'Münze', 'Coin', [[0, 988, 0.08, 0.14, 'square'], [0.08, 1319, 0.4, 0.14, 'square']]),
  levelup: ton('arcade', 'Level up', 'Level up', folge([523, 659, 784, 1046, 1319, 1568], 0.07, 0.1, 0.13, 'square').concat([[0.45, 2093, 0.35, 0.12, 'square']])),
  powerup: ton('arcade', 'Power-up', 'Power-up', [[0, 300, 0.45, 0.13, 'square', 1400], [0.1, 450, 0.4, 0.06, 'triangle', 1800]]),
  laser: ton('arcade', 'Laser', 'Laser', [[0, 1600, 0.22, 0.14, 'sawtooth', 180], [0.25, 1600, 0.22, 0.12, 'sawtooth', 180]]),
  sprung: ton('arcade', 'Sprung', 'Jump', [[0, 380, 0.16, 0.15, 'square', 900]]),
  extraleben: ton('arcade', 'Extraleben', '1-up', folge([1319, 1568, 2637, 2093, 2349, 3136], 0.09, 0.09, 0.12, 'square')),
  // Musikalisch
  aufstieg: ton('musik', 'Aufstieg', 'Rise', [[0, 523, 0.14, 0.22, 'triangle'], [0.12, 659, 0.14, 0.22, 'triangle'], [0.24, 784, 0.14, 0.22, 'triangle'], [0.36, 1046, 0.3, 0.24, 'triangle']]),
  fanfare: ton('musik', 'Fanfare', 'Fanfare', [[0, 392, 0.12, 0.16, 'sawtooth'], [0.13, 392, 0.12, 0.16, 'sawtooth'], [0.26, 392, 0.12, 0.16, 'sawtooth'], [0.4, 523, 0.6, 0.18, 'sawtooth'], [0.4, 659, 0.6, 0.08, 'triangle']]),
  harfe: ton('musik', 'Harfe', 'Harp', folge([523, 659, 784, 1046, 1318, 1568], 0.06, 1.2, 0.12, 'sine')),
  xylophon: ton('musik', 'Xylophon', 'Xylophone', folge([1046, 1318, 1568, 2093], 0.11, 0.35, 0.2, 'triangle')),
  kalimba: ton('musik', 'Kalimba', 'Kalimba', [[0, 1318, 0.6, 0.2, 'sine'], [0, 2636, 0.15, 0.05, 'sine'], [0.18, 1760, 0.7, 0.2, 'sine'], [0.18, 3520, 0.15, 0.05, 'sine']]),
  sieg: ton('musik', 'Sieg', 'Victory', [[0, 784, 0.15, 0.18, 'triangle'], [0.15, 988, 0.15, 0.18, 'triangle'], [0.3, 1175, 0.15, 0.18, 'triangle'],
    [0.45, 1568, 0.8, 0.2, 'triangle'], [0.45, 1175, 0.8, 0.1, 'sine'], [0.45, 988, 0.8, 0.08, 'sine']]),
  // Sanft
  tropfen: ton('sanft', 'Tropfen', 'Drop', [[0, 1400, 0.14, 0.22, 'sine', 500], [0.3, 1200, 0.14, 0.18, 'sine', 450]]),
  blubb: ton('sanft', 'Blubb', 'Bubble', [[0, 300, 0.1, 0.25, 'sine', 900], [0.14, 350, 0.1, 0.22, 'sine', 1000]]),
  windspiel: ton('sanft', 'Windspiel', 'Wind chimes', [[0, 2093, 1.4, 0.06, 'sine'], [0.12, 2637, 1.3, 0.05, 'sine'], [0.27, 3136, 1.2, 0.05, 'sine'], [0.4, 2349, 1.3, 0.05, 'sine'], [0.55, 2793, 1.2, 0.04, 'sine']]),
  klangschale: ton('sanft', 'Klangschale', 'Singing bowl', [[0, 523, 2.8, 0.2, 'sine'], [0, 1046, 2.2, 0.06, 'sine'], [0, 1571, 1.6, 0.04, 'sine'], [0, 527, 2.8, 0.1, 'sine']]),
  sanft: ton('sanft', 'Sanfter Wecker', 'Gentle alarm', folge([660, 660, 880], 0.38, 0.32, 0.14, 'sine')),
  // Laut
  alarm: ton('laut', 'Alarm', 'Alarm', [0, 0.3, 0.6].map((t) => [t, 600, 0.26, 0.14, 'square', 1300])),
  sirene: ton('laut', 'Sirene', 'Siren', [[0, 650, 0.45, 0.13, 'sawtooth', 1300], [0.45, 1300, 0.45, 0.13, 'sawtooth', 650], [0.9, 650, 0.45, 0.13, 'sawtooth', 1300]]),
  stadion: ton('laut', 'Stadionhorn', 'Stadium horn', [[0, 233, 1.1, 0.16, 'sawtooth'], [0, 349, 1.1, 0.12, 'sawtooth'], [0, 466, 1.1, 0.08, 'square']]),
  // Neu 03.11.: weitere Timer-Töne (kurz, klar erkennbar, auch über Handy-Lautsprecher)
  countdown: ton('klassisch', 'Countdown 3-2-1', 'Countdown 3-2-1', [[0, 660, 0.14, 0.22, 'sine'], [0.45, 660, 0.14, 0.22, 'sine'], [0.9, 660, 0.14, 0.22, 'sine'], [1.35, 1320, 0.55, 0.26, 'sine']]),
  kuechenwecker: ton('klassisch', 'Küchenwecker', 'Kitchen timer', [0, 0.85].flatMap((ab) => Array.from({ length: 16 }, (_, i) => [ab + i * 0.04, i % 2 ? 2900 : 2600, 0.035, 0.1, 'triangle']))),
  sonar: ton('klassisch', 'Sonar', 'Sonar ping', [[0, 1180, 1.2, 0.22, 'sine'], [0, 2360, 0.4, 0.04, 'sine'], [0.6, 1180, 0.9, 0.07, 'sine']]),
  startampel: ton('gym', 'Startampel', 'Race lights', [[0, 440, 0.22, 0.16, 'sawtooth'], [0.5, 440, 0.22, 0.16, 'sawtooth'], [1.0, 440, 0.22, 0.16, 'sawtooth'], [1.5, 880, 0.6, 0.18, 'sawtooth'], [1.5, 1320, 0.6, 0.06, 'sine']]),
  torhorn: ton('gym', 'Torhorn (Eishockey)', 'Goal horn', [[0, 175, 1.6, 0.15, 'sawtooth'], [0, 220, 1.6, 0.12, 'sawtooth'], [0, 262, 1.6, 0.09, 'square'], [0, 350, 1.6, 0.06, 'sawtooth']]),
  kettlebell: ton('gym', 'Kettlebell-Klang', 'Kettlebell clang', [[0, 370, 0.9, 0.12, 'sine'], [0, 1013, 0.7, 0.08, 'sine'], [0, 1847, 0.5, 0.06, 'sine'], [0, 2960, 0.3, 0.04, 'sine'], [0, 4200, 0.08, 0.18, 'rausch']]),
  stoppuhr: ton('gym', 'Stoppuhr', 'Stopwatch', [[0, 6000, 0.02, 0.35, 'rausch'], [0.12, 6000, 0.02, 0.35, 'rausch'], [0.35, 1760, 0.12, 0.18, 'sine'], [0.5, 1760, 0.12, 0.18, 'sine'], [0.65, 2349, 0.35, 0.2, 'sine']]),
  bereitlos: ton('arcade', 'Bereit – los!', 'Ready, go!', [[0, 392, 0.14, 0.12, 'square'], [0.3, 392, 0.14, 0.12, 'square'], [0.6, 784, 0.4, 0.14, 'square'], [0.6, 1175, 0.4, 0.05, 'square']]),
  explosion: ton('arcade', '8-Bit-Explosion', '8-bit explosion', [[0, 800, 0.6, 0.35, 'rausch'], [0, 200, 0.5, 0.18, 'square', 40]]),
  bonus: ton('arcade', 'Bonus-Runde', 'Bonus round', folge([784, 988, 1175, 1568, 1175, 988, 784, 988, 1175, 1568, 2093], 0.045, 0.06, 0.1, 'square')),
  marimba: ton('musik', 'Marimba', 'Marimba', [[0, 784, 0.45, 0.22, 'sine'], [0, 3136, 0.05, 0.06, 'sine'], [0.15, 988, 0.45, 0.22, 'sine'], [0.15, 3952, 0.05, 0.06, 'sine'], [0.3, 1175, 0.6, 0.22, 'sine'], [0.3, 4700, 0.05, 0.05, 'sine']]),
  synth: ton('musik', 'Synth-Akkord', 'Synth chord', [[0, 262, 1.2, 0.07, 'sawtooth'], [0, 330, 1.2, 0.06, 'sawtooth'], [0, 392, 1.2, 0.06, 'sawtooth'], [0, 494, 1.2, 0.05, 'sawtooth'], [0, 131, 1.2, 0.1, 'sine']]),
  bassdrop: ton('musik', 'Bass-Drop', 'Bass drop', [[0, 1200, 0.5, 0.08, 'sawtooth', 150], [0.5, 3000, 0.15, 0.12, 'rausch'], [0.5, 160, 0.9, 0.4, 'sine', 45], [0.5, 320, 0.5, 0.12, 'triangle', 90]]),
  glockenspiel: ton('musik', 'Glockenspiel', 'Glockenspiel', folge([2093, 1760, 1568, 1318, 1568, 2093], 0.1, 0.5, 0.1, 'sine')),
  lofi: ton('musik', 'Lo-Fi', 'Lo-fi', folge([659, 523, 392], 0.16, 0.7, 0.15, 'triangle').concat([[0.32, 196, 0.8, 0.08, 'sine']])),
  vogel: ton('sanft', 'Morgenvogel', 'Morning bird', [[0, 2600, 0.08, 0.1, 'sine', 3600], [0.1, 2700, 0.08, 0.1, 'sine', 3800], [0.35, 3000, 0.12, 0.09, 'sine', 2200], [0.6, 2600, 0.08, 0.1, 'sine', 3600], [0.7, 2700, 0.08, 0.1, 'sine', 3800]]),
  herzschlag: ton('sanft', 'Herzschlag', 'Heartbeat', [0, 0.85].flatMap((ab) => [[ab, 120, 0.18, 0.45, 'sine', 60], [ab, 240, 0.08, 0.1, 'sine'], [ab + 0.22, 110, 0.2, 0.35, 'sine', 55], [ab + 0.22, 220, 0.08, 0.08, 'sine']])),
  schulklingel: ton('laut', 'Schulklingel', 'School bell', Array.from({ length: 30 }, (_, i) => [i * 0.03, i % 2 ? 1920 : 1800, 0.03, 0.1, 'square'])),
  oldtimer: ton('laut', 'Oldtimer-Hupe', 'Vintage horn', [[0, 300, 0.25, 0.15, 'sawtooth', 500], [0.25, 500, 0.5, 0.15, 'sawtooth', 430], [0.25, 250, 0.5, 0.08, 'square', 215]]),
  tatuetata: ton('laut', 'Tatütata', 'Two-tone siren', [0, 0.6, 1.2].flatMap((ab) => [[ab, 440, 0.28, 0.13, 'square'], [ab + 0.3, 587, 0.28, 0.13, 'square']])),
  aus: ton('still', 'Nur Vibration', 'Vibration only', []),
};
export const tonName = (id) => { const t = TOENE[id] ?? TOENE.piep; return ANZEIGE.sprache === 'en' ? t.en : t.name; };
let audio;
export function tonFreigeben() { try { audio ??= new AudioContext(); audio.state === 'suspended' && audio.resume(); } catch { /* kein Ton im Rahmen */ } }
/** Ton spielen (Standard: der gewählte), dazu Vibration. */
export function piep(art = ANZEIGE.ton) {
  try {
    tonFreigeben();
    for (const [t, f, dauer, laut, welle, fEnde] of (TOENE[art] ?? TOENE.piep).noten) {
      const g = audio.createGain(), s = audio.currentTime + t;
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(laut, s + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, s + dauer);
      let quelle;
      if (welle === 'rausch') {           // gefiltertes Rauschen (Startschuss, Klirren)
        const puffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * dauer), audio.sampleRate), d = puffer.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        quelle = audio.createBufferSource(); quelle.buffer = puffer;
        const filter = audio.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = f; filter.Q.value = 0.8;
        quelle.connect(filter).connect(g);
      } else {
        quelle = audio.createOscillator(); quelle.type = welle; quelle.frequency.setValueAtTime(f, s);
        if (fEnde) quelle.frequency.exponentialRampToValueAtTime(fEnde, s + dauer);     // gleitender Ton
        quelle.connect(g);
      }
      g.connect(audio.destination); quelle.start(s); quelle.stop(s + dauer + 0.02);
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
/** Zeichen eines Werkzeugs (Rechner/Timer) für Seitenmenü und Rechner-Auswahl. */
export const werkzeugIcon = (k) => I[`w-${k}`] ?? I.rechner;
export const I = {
  papierkorb: svg(html`<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>`),
  heute: svg(html`<path d="M2.5 12h3M18.5 12h3M5.5 7.5v9M18.5 7.5v9M8.5 5v14M15.5 5v14M8.5 12h7"/>`),
  // untere Leiste: klare Linien-Symbole ohne Flächen, gleiche optische Größe
  tabHeute: svg(html`<path d="M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11"/>`),
  tabProgramme: svg(html`<rect x="5" y="4.5" width="14" height="16" rx="2.5"/><path d="M9 4.5h6M8.5 10h7M8.5 13.5h7M8.5 17h4"/>`),
  tabVerlauf: svg(html`<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none"/>`),
  tabFeed: svg(html`<circle cx="9" cy="9" r="3"/><path d="M3.5 19c.7-3 2.9-4.6 5.5-4.6s4.8 1.6 5.5 4.6"/><path d="M15.5 6.4a3 3 0 0 1 0 5.2M17.5 14.6c1.6.6 2.6 2 3 4.4"/>`),
  tabStatistik: svg(html`<path d="M4 19.5h16"/><path d="M5 15.5l4.5-4.5 3.5 3 6-6.5"/><path d="M15 7.5h4v4"/>`),
  programme: svg(html`<rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M7.5 9h9M7.5 13h9M7.5 17h5"/>`),
  verlauf: svg(html`<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>`),
  statistik: svg(html`<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>`),
  technik: svg(html`<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6h.01"/>`),
  rechner: svg(html`<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8.5 7.5h7M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"/>`),
  // Werkzeuge im Seitenmenü und in der Rechner-Auswahl – je Rechner ein eigenes Zeichen
  'w-1rm': svg(html`<path d="M2.5 13h19"/><rect x="5" y="8" width="3" height="10" rx="1"/><rect x="16" y="8" width="3" height="10" rx="1"/><path d="M9.5 5.5 12 3l2.5 2.5"/>`),
  'w-scheiben': svg(html`<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M7.6 8.4a5.6 5.6 0 0 1 2.7-2"/>`),
  'w-rpe': svg(html`<path d="M3.5 17a8.5 8.5 0 1 1 17 0"/><path d="M12 17l4.2-5.2"/><circle cx="12" cy="17" r="1.2"/>`),
  'w-prozent': svg(html`<path d="M18.5 5.5l-13 13"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>`),
  'w-koerper': svg(html`<path d="M2.5 3.5h19M6.5 3.5 9.5 12h5l3-8.5M12 12v4.5M12 16.5 10 21M12 16.5l2 4.5"/><circle cx="12" cy="8" r="1.9"/>`),
  'w-warm': svg(html`<path d="M12 21.5a6.5 6.5 0 0 0 6.5-6.5c0-3.8-2.6-6-4-9.5-1.6 1.8-2.3 3.5-2.3 5.5-1.1-.5-1.9-1.5-2.3-3C7.8 9.8 5.5 12 5.5 15a6.5 6.5 0 0 0 6.5 6.5Z"/>`),
  'w-punkte': svg(html`<path d="M3 20.5h18M4.5 20.5v-6h5v6M9.5 20.5V8.5h5v12M14.5 20.5v-8h5v8"/>`),
  'w-versuche': svg(html`<path d="M10.5 6h9.5M10.5 12h9.5M10.5 18h9.5"/><path d="M3.5 6l1.4 1.4L7.5 4.8M3.5 12l1.4 1.4 2.6-2.6"/><circle cx="5.3" cy="18" r="1.6"/>`),
  'w-wettkampf': svg(html`<path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5.5a2.5 2.5 0 0 0 2.6 4M16 6h2.5a2.5 2.5 0 0 1-2.6 4M12 13v3.5M9 20.5h6M10 16.5h4v4h-4z"/>`),
  'w-timer': svg(html`<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.8M10 2.5h4M12 2.5V6M18.3 6.7l1.5-1.5"/>`),
  'w-video': svg(html`<rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="M15.5 10.5l6-3v9l-6-3z"/>`),
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
  uhr: svg(html`<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>`),
  blitz: svg(html`<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>`),
  verbindung: svg(html`<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`),
  zahnrad: svg(html`<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>`),
  verlauf_uebung: svg(html`<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4M12 7v5l3 2"/>`),
  extern: svg(html`<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`),
  kopieren: svg(html`<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>`),
  import: svg(html`<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>`),
  weiter: svg(html`<path d="M9 6l6 6-6 6"/>`),
  feed: svg(html`<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14c2.4.2 4 1.7 4.5 4.5"/>`),
};

/** 312: ganze Pause als Text – „von 3:00“, nach −30/+30 „von 4:00 · +1:00“. */
function pauseGesamtText(timer) {
  const { gesamt, plus } = pauseGesamt(timer);
  const d = plus ? ` · ${plus > 0 ? '+' : '−'}${mmss(Math.abs(plus))}` : '';
  return deEn(`von ${mmss(gesamt)}${d}`, `of ${mmss(gesamt)}${d}`);
}
/** Pausen-Timer: rechnet mit der Endzeit (stimmt auch nach gesperrtem Bildschirm), Ton und Vibration am Ende. */
/** Kopf im Training, laufende Pause: Countdown statt Trainingszeit (die steht klein daneben). */
export function KopfZeit({ timer, start }) {
  useTakt(true, 250);
  const rest = (timer.ende - Date.now()) / 1000;
  // Pause vorbei: „Los!“ leuchtet grün, daneben wie lange schon drüber
  return html`<div class=${`kopf-zeit ${rest > 0 ? '' : 'los'}`} style=${`--pausenfarbe:${pausenFarbe(rest)}`}><span class="kopf-punkt" aria-hidden="true"></span>
    <span class="clock kopf-countdown tab-num">${rest > 0 ? mmss(rest) : 'Los!'}</span>${rest > 0 ? html`<small class=${`pause-gesamt kopf tab-num ${pauseGesamt(timer).plus ? 'geaendert' : ''}`}>${pauseGesamtText(timer)}</small>` : null}
    <span class="kopf-zeit-neben">${rest > 0 ? (timer.grund ?? 'Pause') : html`Pause vorbei <span class="los-ueber tab-num">${`+${mmss(-rest)}`}</span>`}<small class="tab-num kopf-trainingszeit">${`⏱ ${uhr((Date.now() - start) / 1000)}`}</small></span></div>`;
}
/** Kopf im Training, laufende Pause: nächster Satz, −30/+30 und dünner grüner Balken – ersetzt die rote Timer-Leiste. */
export function KopfPause({ timer, setTimer }) {
  useTakt(true, 250);
  const rest = (timer.ende - Date.now()) / 1000, anteil = pauseAnteil(timer);
  useEffect(() => { if (rest <= 0 && !timer.fertig) { piep(); setTimer({ ...timer, fertig: true }); } }, [rest <= 0]);
  return html`<div class=${`kopf-pause ${rest <= 0 ? 'over' : ''}`} style=${`--pausenfarbe:${pausenFarbe(rest)}`} role="timer" aria-live="off">
    <span class="kopf-naechster"><span class="kopf-pfeil">➜</span><b class="pdock-satz">${timer.naechster}</b>${timer.naechsterUebung ? html`<span class="kopf-uebung">${timer.naechsterUebung}</span>` : null}</span>
    <span class="pdock-knoepfe">
      <button onClick=${() => setTimer(pauseMinus(timer))} aria-label="30 Sekunden weniger">−30</button>
      <button onClick=${() => setTimer(pausePlus(timer))} aria-label="30 Sekunden mehr">+30</button>
      <button class="kopf-zu" onClick=${() => setTimer(null)} aria-label="Pause beenden"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></span>
    <i class="kopf-balken" style=${`transform:scaleX(${anteil})`}></i>
  </div>`;
}

/** Leiste unten außerhalb des Trainings (03.11.): kompakt, Glasfläche, dünner Fortschrittsbalken; Übungsname ganz. */
function PausenDock({ timer, setTimer, oeffnen, zusatz, fortschritt = null }) {
  const rest = (timer.ende - Date.now()) / 1000, anteil = pauseAnteil(timer), z = zusatz(), f = fortschritt?.();
  return html`<div class=${`pdock ${rest <= 0 ? 'over' : ''}`} style=${`--pausenfarbe:${pausenFarbe(rest)}`} role="timer" aria-live="off">
    <div class="pdock-haupt" onClick=${oeffnen} role=${oeffnen ? 'button' : null} tabIndex=${oeffnen ? 0 : null} aria-label=${oeffnen ? 'Zum laufenden Training' : null}>
      <div class="pdock-zeit" title=${timer.grund ?? 'Pause'}><span class="pdock-punkt" aria-hidden="true"></span>
        ${rest > 0 ? (() => {   // 312: ganze Pause untereinander („von 4:30“, „+0:30“) – Block bleibt so schmal wie der Countdown
          const { gesamt, plus } = pauseGesamt(timer);
          return html`<span class="zeit-block"><b class="tab-num">${mmss(rest)}</b><small class="pause-gesamt tab-num">${deEn(`von ${mmss(gesamt)}`, `of ${mmss(gesamt)}`)}</small>
            ${plus ? html`<small class="pause-gesamt geaendert tab-num">${`${plus > 0 ? '+' : '−'}${mmss(Math.abs(plus))}`}</small>` : null}</span>`;
        })()
          : html`<span class="los-block"><b>Los!</b><small class="los-ueber tab-num">${`+${mmss(-rest)}`}</small></span>`}</div>
      <div class="pdock-info">
        <b class="pdock-uebung">${timer.naechsterUebung ?? timer.naechster}</b>
        <span class="pdock-meta">${timer.naechsterUebung ? html`<span class="pdock-satz">${timer.naechster}</span>` : null}<span>${z}</span></span>
      </div>
    </div>
    <div class="pdock-knoepfe">
      <button onClick=${() => setTimer(pauseMinus(timer))} aria-label="30 Sekunden weniger">−30</button>
      <button onClick=${() => setTimer(pausePlus(timer))} aria-label="30 Sekunden mehr">+30</button>
    </div>
    ${f?.length ? html`<div class="pdock-fortschritt" role="progressbar" aria-label="Erledigte Sätze je Übung">${f.map(([fertig, alle], i) => html`<span key=${i} style=${`flex:${alle}`}><i style=${`transform:scaleX(${alle ? fertig / alle : 0})`}></i></span>`)}</div>` : null}
    <i class="pdock-balken" style=${`transform:scaleX(${anteil})`}></i>
  </div>`;
}

export function PausenTimer({ timer, setTimer, kopf = false, oeffnen = null, zusatz = null, fortschritt = null }) {   // zusatz(): zweite Zeile (laufendes Training)
  useTakt(true, 250);
  const rest = (timer.ende - Date.now()) / 1000;
  useEffect(() => { if (rest <= 0 && !timer.fertig) { piep(); setTimer({ ...timer, fertig: true }); } }, [rest <= 0]);
  const C = 2 * Math.PI * 16, anteil = pauseAnteil(timer);
  // 169: außerhalb des Trainings öffnet ein Tipp auf Ring oder Zeit das laufende Training
  const auf = oeffnen ? { onClick: oeffnen, role: 'button', tabIndex: 0, style: 'cursor:pointer', 'aria-label': 'Zum laufenden Training' } : {};
  if (zusatz) return html`<${PausenDock} timer=${timer} setTimer=${setTimer} oeffnen=${oeffnen} zusatz=${zusatz} fortschritt=${fortschritt}/>`;
  return html`<div class=${`timer ${rest <= 0 ? 'over' : ''} ${kopf ? 'im-kopf' : ''}`} role="timer" aria-live="off">
    <div class="timer-auf" ...${auf}><svg class="ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" style="stroke:currentColor;opacity:.2" stroke-width="4"/>
      <circle cx="20" cy="20" r="16" fill="none" style="stroke:currentColor" stroke-width="4" stroke-linecap="round" stroke-dasharray=${C} stroke-dashoffset=${C * (1 - anteil)} transform="rotate(-90 20 20)"/>
      ${zusatz ? html`<text x="20" y="21" text-anchor="middle" dominant-baseline="middle" font-size="15">${rest > 0 ? '⏱️' : '🔔'}</text>` : null}</svg>
    ${zusatz ? html`<div class="timer-text">
        <div class="timer-zeile1"><span class="t">${rest > 0 ? mmss(rest) : 'Los!'}</span><span class="timer-label">${rest > 0 ? (timer.grund ? `Pause · ${timer.grund}` : 'Pause') : 'Pause vorbei'}</span></div>
        <div class="s">${`➜ ${timer.naechster}${timer.naechsterUebung ? ` · ${timer.naechsterUebung}` : ''}`}</div>
        <div class="s timer-zusatz">${zusatz()}</div></div>`
      : html`<div style="min-width:0"><div class="t">${rest > 0 ? mmss(rest) : 'Los!'}</div>
      <div class="s">${rest <= 0 ? 'Pause vorbei' : pauseGesamt(timer).plus ? `Pause ${pauseGesamtText(timer)} · nächster: ${timer.naechster}`
        : `Pause${timer.grund ? ` (${timer.grund})` : ''} · nächster: ${timer.naechster}`}</div></div>`}</div>
    <button onClick=${() => setTimer(pauseMinus(timer))} aria-label="30 Sekunden weniger">−30</button>
    <button onClick=${() => setTimer(pausePlus(timer))} aria-label="30 Sekunden mehr">+30</button>
    <button onClick=${() => setTimer(null)} aria-label="Pause beenden" style="min-width:40px">${I.zu}</button>
  </div>`;
}

/** Kopieren mit Rückfall: klappt die Zwischenablage nicht, wird das Textfeld markiert. */
export async function kopiere(text, feld) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    // zweiter Weg (ältere Browser, fehlende Freigabe): unsichtbares Textfeld markieren und kopieren
    try {
      const f = document.createElement('textarea');
      f.value = text; f.setAttribute('readonly', ''); Object.assign(f.style, { position: 'fixed', top: '0', left: '0', opacity: '0' });
      document.body.append(f); f.select(); const ok = document.execCommand('copy'); f.remove();
      if (ok) return true;
    } catch { /* weiter unten */ }
    if (feld) { feld.focus(); feld.select(); } return false;
  }
}

/**
 * Fensterplatz der App (einmal in app.js): Fenster aus Karten heraus öffnen, deren backdrop-filter position:fixed sonst
 * einsperren würde. zeigeFenster((zu) => html`<…/>`) zeigt eins; zu() schließt es.
 */
/** Zustand, der einen Seitenwechsel übersteht (sessionStorage, nur diese Sitzung) – z. B. halb ausgefüllte Generatoren. */
export function useSitzung(schluessel, start) {
  const anfang = () => (typeof start === 'function' ? start() : start);
  const [w, setW] = useState(() => { try { const s = sessionStorage.getItem(schluessel); return s != null ? JSON.parse(s) : anfang(); } catch { return anfang(); } });
  const setze = (n) => setW((alt) => {
    const neu = typeof n === 'function' ? n(alt) : n;
    try { if (neu == null) sessionStorage.removeItem(schluessel); else sessionStorage.setItem(schluessel, JSON.stringify(neu)); } catch { /* egal */ }
    return neu;
  });
  return [w, setze];
}
export const sitzungLeeren = (vorne) => { try { for (const k of Object.keys(sessionStorage)) if (k.startsWith(vorne)) sessionStorage.removeItem(k); } catch { /* egal */ } };

/** Unterreiter der aktuellen Seite (Statistik, Feed): Wischen blättert erst dort, am Ende auf die nächste Seite. */
export const UNTERREITER = {};
/** Für Seiten mit Reitern (je Seite gemerkt, auch wenn die Seite beim Wischen als Nachbar kurz mitläuft). */
/** Karte zur Seite wegwischen (Hinweise auf „Heute“): Klasse kein-wisch an die Karte, ...props darauf, weg() nach dem
 *  Hinauswischen. Der Klick direkt nach einem Wischen löst nichts aus (geklickt() prüfen). */
export function useWegwischen(weg) {
  const karte = useRef(null), zug = useRef(null), gewischt = useRef(0);
  const ausblenden = (richtung = 1) => {
    const el = karte.current;
    if (el) { el.style.transition = 'transform .22s ease, opacity .22s ease'; el.style.transform = `translateX(${richtung * 110}%)`; el.style.opacity = '0'; }
    setTimeout(weg, 220);
  };
  const props = {
    ref: karte,
    ontouchstart: (e) => { const t = e.touches[0]; zug.current = { x: t.clientX, y: t.clientY, dx: 0, waagrecht: null }; },
    ontouchmove: (e) => {
      const z = zug.current, el = karte.current; if (!z || !el) return;
      const t = e.touches[0], dx = t.clientX - z.x, dy = t.clientY - z.y;
      if (z.waagrecht == null && Math.max(Math.abs(dx), Math.abs(dy)) > 8) z.waagrecht = Math.abs(dx) > Math.abs(dy);
      if (!z.waagrecht) return;
      z.dx = dx; el.style.transition = 'none'; el.style.transform = `translateX(${dx}px)`; el.style.opacity = String(Math.max(0.2, 1 - Math.abs(dx) / el.offsetWidth));
    },
    ontouchend: () => {
      const z = zug.current, el = karte.current; zug.current = null; if (!z || !el || !z.waagrecht) return;
      gewischt.current = Date.now();
      if (Math.abs(z.dx) > el.offsetWidth * 0.33) { ausblenden(Math.sign(z.dx)); return; }
      el.style.transition = 'transform .18s ease, opacity .18s ease'; el.style.transform = ''; el.style.opacity = '';
    },
  };
  return { props, ausblenden, geklickt: () => Date.now() - gewischt.current > 400 };
}

/**
 * Frei verschiebbare Kachel (03.11.): Ziehen verschiebt (achsen 'y' oder 'xy'), waagrechtes Wischen ruft wischX (nur bei
 * achsen 'y'), gedrückt halten ruft lang. Ein normaler Tipp bleibt ein Klick; nach Ziehen/Halten wird der Klick verschluckt.
 * ablegen(rect) bekommt die neue Lage. Rückgabe { props, geklickt() }.
 */
// wischFedernd: die Kachel geht nur ein Stück mit (höchstens 70 px), wischLive(dx) meldet den Weg, ab 70 px Fingerweg löst wischX aus,
// danach federt sie zurück. langLos: wie lang, aber erst beim Loslassen (dort gilt das Antippen als Nutzer-Aktion – nötig zum Öffnen anderer Apps).
export function useZiehen({ achsen = 'xy', lang = null, wischX = null, ablegen = null, wischFedernd = false, wischLive = null, langLos = null, langMs = 480 }) {
  const ref = useRef(null), z = useRef(null), sperre = useRef(0);
  const ende = (abbruch) => {
    const s = z.current, el = ref.current; z.current = null;
    if (!s || !el) return;
    clearTimeout(s.t);
    if (!s.art) return;                                       // Tipp: der Klick läuft normal
    sperre.current = Date.now();
    if (s.art === 'lang') { if (!abbruch) langLos?.(); return; }
    if (s.art === 'wisch' && wischFedernd) {
      const weit = !abbruch && Math.abs(s.dx / s.z) > 70;
      el.style.transition = 'transform .22s cubic-bezier(.2, .9, .3, 1.2)'; el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; }, 240);
      wischLive?.(0);
      if (weit) wischX?.(Math.sign(s.dx));
      return;
    }
    if (s.art === 'wisch') {
      if (!abbruch && Math.abs(s.dx / s.z) > el.offsetWidth * 0.33) {
        el.style.transition = 'transform .2s ease, opacity .2s ease'; el.style.transform = `translateX(${Math.sign(s.dx) * 110}%)`; el.style.opacity = '0';
        const richtung = Math.sign(s.dx);
        setTimeout(() => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; wischX?.(richtung); }, 200);
      } else { el.style.transition = 'transform .18s ease, opacity .18s ease'; el.style.transform = ''; el.style.opacity = ''; }
      return;
    }
    const r = el.getBoundingClientRect();
    el.style.transition = ''; el.style.transform = '';
    ablegen?.(r);
  };
  const props = {
    ref,
    onPointerDown: (e) => {
      if (e.button > 0 || e.target.closest('button:not(.ziehbar), input, a')) return;      // Knöpfe (−30/+30), Regler, Links nicht
      // Zoom der Textgröße (html { zoom }): Verschiebungen sind CSS-Pixel × Zoom – ohne Ausgleich lief die Bubble dem Finger nach (09.11.)
      const s = { x: e.clientX, y: e.clientY, id: e.pointerId, art: null, dx: 0, dy: 0, z: parseFloat(getComputedStyle(document.documentElement).zoom) || 1 };
      s.t = setTimeout(() => { if (z.current === s && !s.art) { s.art = 'lang'; sperre.current = Date.now(); vibriere(25); lang?.(); } }, langMs);
      if (langLos) e.currentTarget.style.webkitTouchCallout = 'none';
      z.current = s;
    },
    onPointerMove: (e) => {
      const s = z.current, el = ref.current;
      if (!s || s.id !== e.pointerId || s.art === 'lang' || !el) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (!s.art) {
        if (Math.hypot(dx, dy) < 9) return;
        clearTimeout(s.t);
        s.art = achsen === 'y' && wischX && Math.abs(dx) > Math.abs(dy) ? 'wisch' : 'ziehen';
        try { el.setPointerCapture(e.pointerId); } catch { /* egal */ }
      }
      s.dx = dx; s.dy = dy;
      el.style.transition = 'none';
      const zx = dx / s.z, zy = dy / s.z;
      if (s.art === 'wisch' && wischFedernd) { el.style.transform = `translateX(${Math.sign(zx) * Math.min(70, Math.abs(zx) * 0.55)}px)`; wischLive?.(zx); }
      else if (s.art === 'wisch') { el.style.transform = `translateX(${zx}px)`; el.style.opacity = String(Math.max(0.2, 1 - Math.abs(zx) / el.offsetWidth)); }
      else el.style.transform = achsen === 'y' ? `translateY(${zy}px)` : `translate(${zx}px, ${zy}px)`;
    },
    onPointerUp: () => ende(false),
    onPointerCancel: () => ende(true),
    onClickCapture: (e) => { if (Date.now() - sperre.current < 450) { e.stopPropagation(); e.preventDefault(); } },
  };
  return { props, geklickt: () => Date.now() - sperre.current >= 450 };
}

/** Kleiner Zwischenspeicher (Gerät) für Listen vom Server: sofort zeigen, im Hintergrund neu laden (03.11.). */
export const zwischen = {
  lies(k) { try { return JSON.parse(localStorage.getItem(`prh-zw-${k}`)); } catch { return null; } },
  schreib(k, v) { try { localStorage.setItem(`prh-zw-${k}`, JSON.stringify(v)); } catch { /* voll – egal */ } },
};

/** Beim Abbilden der Nachbar-Kategorie fürs Wischen: welcher Unterreiter gezeichnet werden soll (sonst leer). */
export const UNTER_VORSCHAU = {};
export function useUnterReiter(seite, liste, aktiv, waehle) {
  const i = liste.findIndex(([k]) => k === aktiv);
  useEffect(() => {
    if (UNTER_VORSCHAU[seite]) return;               // Abbild für das Wischen – nicht als echter Reiter melden
    UNTERREITER[seite] = { aktiv, zurueck: i > 0 ? () => waehle(liste[i - 1][0]) : null, weiter: i >= 0 && i < liste.length - 1 ? () => waehle(liste[i + 1][0]) : null,
      zurueckKey: i > 0 ? liste[i - 1][0] : null, weiterKey: i >= 0 && i < liste.length - 1 ? liste[i + 1][0] : null };
  });
  useEffect(() => () => { delete UNTERREITER[seite]; }, []);
}

let fensterSetzen = null;
export function FensterHost() {
  const [f, setF] = useState(null);
  fensterSetzen = setF;
  return f ? f(() => setF(null)) : null;
}
export const zeigeFenster = (f) => fensterSetzen?.(() => f);

/** Bottom-Sheet. Eigener Eintrag in der Historie: der Zurück-Knopf schließt das Sheet statt die Ansicht zu wechseln. */
/** Zeichnet den Inhalt direkt unter <body> – für Fenster in Karten mit backdrop-filter (dort wäre position:fixed an die Karte gebunden). */
// useLayoutEffect, nicht useEffect: aus einem useEffect heraus gezeichnet, gingen die Effekte des Inhalts verloren
// (Preact leert die Effekt-Warteschlange nach dem Durchlauf) – Wischen zum Schließen und Zurück-Taste fehlten dann.
export function Portal({ children }) {
  const ziel = useRef(null);
  useLayoutEffect(() => { const d = document.createElement('div'); document.body.append(d); ziel.current = d; render(children, d); return () => { render(null, d); d.remove(); }; }, []);
  useLayoutEffect(() => { if (ziel.current) render(children, ziel.current); });
  return null;
}

// #################################################################
// 254: Verlauf, ohne aus der App zu fallen. Chrome markiert einen Eintrag als überspringbar, wenn von ihm aus ohne
// Nutzer-Aktion ein neuer angelegt wird (pushState im popstate, nach Timern, beim Öffnen) – ein späteres Zurück springt
// dann darüber hinweg und schließt die App. Deshalb: Zurück abbrechen = vorwärts dorthin, wo man herkam (kein neuer
// Eintrag); Ebenen, die ohne Antippen aufgehen, bekommen keinen Eintrag, ein Zurück schließt dann nur sie.
// #################################################################
export const mitNutzerAktion = () => !navigator.userActivation || navigator.userActivation.isActive;
let still = 0, stillUhr = null;
const ohneEintrag = [];                 // Schließer offener Ebenen ohne eigenen Verlaufseintrag (oberste zuletzt)
/** Zurück rückgängig machen: einen Schritt vorwärts; das popstate dazu sieht niemand. */
export function zurueckAbbrechen() {
  still++; clearTimeout(stillUhr); stillUhr = setTimeout(() => { still = 0; }, 600);
  history.forward();
}
/** Eintrag für eine Ebene (Fenster, Menü): mit Nutzer-Aktion per pushState, sonst ohne Eintrag (Rückgabe: Abmelden). */
export function ebeneEintragen(st, schliessen) {
  if (mitNutzerAktion()) { history.pushState(st, ''); return null; }
  ohneEintrag.push(schliessen);
  return () => { const i = ohneEintrag.indexOf(schliessen); if (i >= 0) ohneEintrag.splice(i, 1); };
}
/** Neue Ansicht: mit Nutzer-Aktion als neuer Eintrag, sonst den aktuellen ersetzen (Markierung der untersten Ebene bleibt). */
export function ansichtEintragen(st, url) {
  if (mitNutzerAktion()) history.pushState(st, '', url);
  else history.replaceState(history.state?.wurzel ? { ...st, wurzel: true } : st, '', url);
}
// 260: auf einer Hauptseite (Reiter unten) bleibt Zurück auf der Seite – es führt nicht in andere Reiter oder früher
// geöffnete Seiten. Innerhalb der Seite (Unterseiten, Fenster) geht Zurück wie gewohnt.
const HAUPTSEITEN = new Set(['heute', 'programme', 'verlauf', 'feed', 'statistik']);
let ansichtJetzt = null;
export const setzeAnsichtJetzt = (a) => { ansichtJetzt = a; };
addEventListener('popstate', (e) => {
  if (still > 0) { still--; e.stopImmediatePropagation(); return; }
  if (!ohneEintrag.length && HAUPTSEITEN.has(ansichtJetzt) && e.state?.ansicht && e.state.ansicht !== ansichtJetzt) { e.stopImmediatePropagation(); zurueckAbbrechen(); return; }
  if (ohneEintrag.length) { e.stopImmediatePropagation(); const zu = ohneEintrag.pop(); zurueckAbbrechen(); zu(); return; }
  // unterste Ebene (Schutz-Eintrag beim ersten Antippen): nie aus der App, zurück auf die Ansicht darüber
  if (e.state?.wurzel) { e.stopImmediatePropagation(); zurueckAbbrechen(); }
});

export function Sheet({ zu, children, label = 'Dialog', voll = false }) {
  const zuRef = useRef(zu);
  zuRef.current = zu;
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && zuRef.current();
    // eigene Kennung je Sheet: Zurück aus der Bildlupe (Zustand mit derselben Kennung) lässt das Sheet offen (156)
    const id = (Number(history.state?.sheet) || 0) + 1;
    let perZurueck = false;
    const pop = (e) => { if (e.state?.sheet === id) return; perZurueck = true; zuRef.current(); };
    // 254: ohne Antippen geöffnet (z. B. Warnung im Zurück) → kein Eintrag; Zurück schließt dann nur dieses Fenster
    const ohne = ebeneEintragen({ ...(history.state ?? {}), sheet: id }, () => { perZurueck = true; zuRef.current(); });
    addEventListener('keydown', k);
    if (!ohne) addEventListener('popstate', pop);
    return () => {
      removeEventListener('keydown', k); removeEventListener('popstate', pop);
      if (ohne) { ohne(); return; }
      if (!perZurueck && history.state?.sheet === id) history.back();      // per Knopf geschlossen: Eintrag wieder entfernen
    };
  }, []);
  // Nach unten wegziehen: nur wenn der Inhalt ganz oben steht und die Geste eindeutig nach unten geht
  const ref = useRef(null), zug = useRef(null);
  const start = (e) => {
    // am Griff bzw. festen Fensterkopf (bleiben beim Scrollen oben stehen) immer, sonst nur, wenn der Inhalt ganz oben steht
    const griff = !!e.target.closest?.('.grab, .sheet-kopf');
    if (e.touches.length !== 1 || (ref.current.scrollTop > 0 && !griff) || e.target.closest?.('.zuschnitt, input[type="range"], .sv-buehne, .sv-kurve')) return;
    const t = e.touches[0];
    zug.current = { x: t.clientX, y: t.clientY, dy: 0, aktiv: false, t0: Date.now(), griff };
  };
  const ziehe = (e) => {
    const z = zug.current, s = ref.current;
    if (!z) return;
    const t = e.touches[0], dy = t.clientY - z.y, dx = t.clientX - z.x;
    if (!z.aktiv) {
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      if (dy <= 0 || Math.abs(dx) > dy || (s.scrollTop > 0 && !z.griff)) { zug.current = null; return; }
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
    <div class=${`sheet ${voll ? 'voll' : ''}`} ref=${ref} role="dialog" aria-modal="true" aria-label=${label}><div class="grab"></div>${children}</div>
  </div>`;
}

export function Scheiben({ kg, stange = stangeKg(), liste = null, neuAb = null }) {
  // liste: feste Beladung (202, Scheibenwechsel sparen); neuAb: ab dieser Stelle frisch aufgesteckt (hervorgehoben)
  const l = liste ?? scheiben(kg, { stange, inventar: scheibenKg() }).proSeite;
  if (!l.length) return html`<span class="muted">leere Stange</span>`;
  return html`<span class="plates">${l.map((w, i) => html`<span key=${i} class=${`pl ${neuAb != null && i >= neuAb ? 'neu' : ''}`} data-w=${w}>${gw(w)}</span>`)}</span>`;
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
  </div>`;
}
