// PR Hunter · Kraft + Cardio kombinieren (Wünsche 239–247): Wochenraster (je Tag Kraft, Cardio, beides oder Ruhetag),
// Vorschlag einer erholungsfreundlichen Verteilung, Prüfung der Woche und Kraft-Vorlagen für Hybrid-Athleten
// (Grundübungen zuerst, Isolationen zuletzt, Muskelgruppen im Wechsel, Oberkörper dabei). Pure Funktionen.
import { UNTEN_TAGE, OBEN_TAGE } from './generator.js';
import { SPLITS } from './bodybuilding.js';

/** Tagesarten im Raster; Antippen wechselt in dieser Reihenfolge. */
export const ARTEN = ['ruhe', 'kraft', 'cardio', 'beides'];
export const hatKraft = (a) => a === 'kraft' || a === 'beides';
export const hatCardio = (a) => a === 'cardio' || a === 'beides';

/** Fokus: Volumen-Faktor für Cardio und höchstens so viele harte Cardio-Einheiten je Woche. */
export const FOKUS = {
  kraft: { faktor: 0.8, hart: 1, uebungen: 6 },
  mix: { faktor: 1, hart: 2, uebungen: 5 },
  cardio: { faktor: 1.1, hart: 2, uebungen: 4 },
};

/**
 * Bewertung eines Wochenrasters (kleiner = besser). bein[i]: Krafttag i ist ein Beintag. Strafpunkte für: beides am
 * selben Tag, kein Ruhetag, zwei Beintage hintereinander, lange Einheit nicht am Wochenende, Beintag direkt nach der
 * langen Einheit, Cardio direkt vor einem Beintag (dort darf es nur locker sein).
 */
export function wertung(woche, bein = woche.map(() => true), { hart = 1 } = {}) {
  let s = 0;
  const nur = woche.map((a) => a === 'cardio'), lang = nur.lastIndexOf(true);
  const beinTag = (i) => hatKraft(woche[(i + 7) % 7]) && bein[(i + 7) % 7];
  woche.forEach((a, i) => {
    if (a === 'beides') s += bein[i] ? 4 : 3;             // Cardio nach dem Krafttraining lieber an Oberkörpertagen
    if (beinTag(i) && beinTag(i + 1)) s += 2;
    else if (hatKraft(a) && hatKraft(woche[(i + 1) % 7])) s += 0.5;
    if (nur[i] && beinTag(i + 1)) s += 0.7;
    if (a === 'ruhe' && woche[(i + 1) % 7] === 'ruhe') s += 0.3;
    if (nur[i] && nur[(i + 1) % 7]) s += 0.3;
  });
  if (!woche.includes('ruhe')) s += 4;
  // genug reine Cardio-Tage, die nicht vor einem Beintag liegen – für die harte(n) und die lange Einheit
  const frei = woche.filter((a, i) => nur[i] && !beinTag(i + 1)).length, noetig = Math.min(nur.filter(Boolean).length, hart + 1);
  if (frei < noetig) s += 1.5 * (noetig - frei);
  if (lang >= 0 && lang < 5) s += 1;
  if (lang >= 0 && beinTag(lang + 1)) s += 1;
  return s;
}

/**
 * Vorschlag: beste Verteilung von nKraft Kraft- und nCardio Cardio-Tagen. fest = feste Krafttage (Wochentage 0–6,
 * z. B. aus dem Bodybuilding-Generator) – dann werden nur die Cardio-Tage gesucht. Durchsucht alle 4^7 Raster.
 */
const MERKER = new Map();
export function wochenVorschlag(nKraft, nCardio, opt = {}) {
  const schluessel = JSON.stringify([nKraft, nCardio, opt.fest ?? null, opt.bein ?? null, opt.beinFolge ?? null, opt.hart ?? 1]);
  if (!MERKER.has(schluessel)) { if (MERKER.size > 500) MERKER.clear(); MERKER.set(schluessel, suche(nKraft, nCardio, opt)); }
  return [...MERKER.get(schluessel)];
}
function suche(nKraft, nCardio, { fest = null, bein = null, beinFolge = null, hart = 1 } = {}) {
  let beste = null, besteS = Infinity;
  const w = new Array(7);
  const b = bein ? [...bein] : new Array(7).fill(true);
  // feste Krafttage: je Tag nur zwei Möglichkeiten (Kraft/beides bzw. Ruhe/Cardio)
  if (fest && !beinFolge) {
    for (let code = 0; code < 2 ** 7; code++) {
      let z = 0;
      for (let i = 0; i < 7; i++) { const an = (code >> i) & 1; w[i] = fest.includes(i) ? (an ? 'beides' : 'kraft') : (an ? 'cardio' : 'ruhe'); if (an) z++; }
      if (z !== nCardio) continue;
      const s = wertung(w, b, { hart });
      if (s < besteS - 1e-9) { besteS = s; beste = [...w]; }
    }
    return beste ?? new Array(7).fill('ruhe').map((_, i) => (fest.includes(i) ? 'kraft' : 'ruhe'));
  }
  for (let code = 0; code < 4 ** 7; code++) {
    let c = code, k = 0, z = 0;
    for (let i = 0; i < 7; i++) { w[i] = ARTEN[c % 4]; c = Math.floor(c / 4); if (hatKraft(w[i])) k++; if (hatCardio(w[i])) z++; }
    if (k !== nKraft || z !== nCardio) continue;
    if (fest && w.some((a, i) => hatKraft(a) !== fest.includes(i))) continue;
    if (beinFolge) { let j = 0; for (let i = 0; i < 7; i++) b[i] = hatKraft(w[i]) ? beinFolge[j++] !== false : false; }
    const s = wertung(w, b, { hart });
    if (s < besteS - 1e-9) { besteS = s; beste = [...w]; }
  }
  return beste ?? new Array(7).fill('ruhe');
}

/**
 * Hinweise zu einer Woche: woche (Raster), bein (Beintage), einheiten = Cardio-Einheiten der Woche mit wt (0–6) und typ.
 * Liefert [{ art: 'warn' | 'info' | 'gut', de, en }].
 */
export function pruefeWoche(woche, bein, einheiten = []) {
  const WT = [['Mo', 'Mon'], ['Di', 'Tue'], ['Mi', 'Wed'], ['Do', 'Thu'], ['Fr', 'Fri'], ['Sa', 'Sat'], ['So', 'Sun']];
  const aus = [], beinTag = (i) => hatKraft(woche[(i + 7) % 7]) && bein[(i + 7) % 7];
  if (!woche.includes('ruhe')) aus.push({ art: 'warn', de: 'Kein Ruhetag – mindestens einer pro Woche hilft der Erholung.', en: 'No rest day – at least one per week helps recovery.' });
  // gleiche Hinweise in einer Zeile zusammenfassen (z. B. „Mo–Di, Do–Fr“)
  const paare = [];
  for (let i = 0; i < 7; i++) if (beinTag(i) && beinTag(i + 1)) paare.push(i);
  const liste = (sp) => paare.map((i) => `${WT[i][sp]}–${WT[(i + 1) % 7][sp]}`).join(', ');
  if (paare.length) aus.push({ art: 'warn', de: `Beintage direkt hintereinander: ${liste(0)}.`, en: `Leg days back to back: ${liste(1)}.` });
  const vorBein = einheiten.filter((e) => ['intervalle', 'tempo', 'lang', 'wettkampf'].includes(e.typ) && beinTag(e.wt + 1));
  if (vorBein.length) aus.push({ art: 'warn', de: `Harte oder lange Cardio-Einheit am Tag vor dem Beintag: ${vorBein.map((e) => WT[e.wt][0]).join(', ')}.`, en: `Hard or long cardio the day before leg day: ${vorBein.map((e) => WT[e.wt][1]).join(', ')}.` });
  for (const e of einheiten) {
    if (e.typ !== 'lang' || beinTag(e.wt + 1) || !hatKraft(woche[(e.wt + 1) % 7])) continue;
    aus.push({ art: 'info', de: `${WT[(e.wt + 1) % 7][0]}: Krafttraining nach der langen Einheit – Oberkörper geht gut.`, en: `${WT[(e.wt + 1) % 7][1]}: strength after the long session – upper body works well.` });
  }
  if (woche.includes('beides')) aus.push({ art: 'info', de: 'Kraft + Cardio am selben Tag: erst Kraft, dann Cardio – kurz und locker.', en: 'Strength + cardio on the same day: strength first, then easy, short cardio.' });
  if (!aus.some((x) => x.art === 'warn')) aus.unshift({ art: 'gut', de: 'Erholung passt: harte Einheiten liegen nicht vor Beintagen.', en: 'Recovery looks good: hard sessions stay away from leg days.' });
  return aus;
}

// ---------------------------------------------------------------------------------------------------------------
// Krafttage wie die Generatoren sie legen (Wochentag 0 = Montag = Blockstart) – mit den echten Beintagen
// ---------------------------------------------------------------------------------------------------------------
/** Bodybuilding-Generator: Tage je Anzahl (wie js/bodybuilding.js) und passender Split. */
export const BB_WT = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
export const bbSplit = (n) => (n <= 3 ? 'gk' : n === 4 ? 'ul' : 'ppl');
const BEIN_GRUPPEN = new Set(['quads', 'beinbeuger', 'gesaess']);
export function bbTage(n, split = bbSplit(n)) {
  const tage = BB_WT[Math.min(6, Math.max(2, n))], s = SPLITS[split] ?? SPLITS.gk;
  const bein = new Array(7).fill(false);
  tage.forEach((wt, i) => { bein[wt] = s.tage[i % s.tage.length][1].some((g) => BEIN_GRUPPEN.has(g)); });
  return { tage, bein, split };
}
/** Powerlifting-Generator: n = 3, 4 oder 5 Tage → Kniebeuge/Kreuzheben je (n − 2)× pro Woche, Bank 2×; Beine nur an den Unterkörpertagen. */
export const PL_TAGE = [3, 4, 5];
export function plTage(n) {
  const L = Math.min(3, Math.max(1, n - 2)), unten = UNTEN_TAGE[L], oben = OBEN_TAGE[L];
  const bein = new Array(7).fill(false);
  for (const wt of unten) bein[wt] = true;
  return { tage: [...new Set([...unten, ...oben])].sort((a, b) => a - b), bein, proWoche: { squat: L, dead: L, bench: 2 } };
}

/** Wochen von start (Montag) bis zum Wettkampfdatum, die Woche des Wettkampfs eingeschlossen. */
export const wochenBis = (start, datum) => Math.max(1, Math.floor((Date.parse(`${datum}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / (7 * 864e5)) + 1);
/** Empfohlene Mindestdauer je Wettkampfziel (Wochen). */
export const MIN_WOCHEN = { '5k': 4, '10k': 6, hm: 8, m: 12, rennen: 6 };

// ---------------------------------------------------------------------------------------------------------------
// Kraft-Vorlagen: je Tag Grundübungen zuerst (Unter- und Oberkörper im Wechsel), am Ende Isolation und Rumpf
// ---------------------------------------------------------------------------------------------------------------
const GK_A = ['barbell_squat', 'dumbbell_bench_press', 'romanian_deadlift', 'seated_cable_rows'];
const GK_B = ['dumbbell_bulgarian_split_squat', 'wide-grip_lat_pulldown', 'barbell_hip_thrust', 'seated_dumbbell_press'];
const GK_C = ['leg_press', 'incline_dumbbell_press', 'single_leg_deadlift_dumbbell', 'one-arm_dumbbell_row'];
const OK_A = ['barbell_bench_press_-_medium_grip', 'seated_cable_rows', 'seated_dumbbell_press', 'wide-grip_lat_pulldown', 'side_lateral_raise', 'ez-bar_curl'];
const OK_B = ['incline_dumbbell_press', 'one-arm_dumbbell_row', 'standing_military_press', 'pullups', 'triceps_pushdown_-_rope_attachment', 'side_lateral_raise'];
const UK_A = ['barbell_squat', 'romanian_deadlift', 'dumbbell_bulgarian_split_squat', 'lying_leg_curls'];
const UK_B = ['leg_press', 'barbell_hip_thrust', 'single_leg_deadlift_dumbbell', 'leg_extensions'];
/** Abschluss je Sportart: [Isolation Unterkörper, Rumpf] für Tag A bzw. B. */
const ABSCHLUSS = {
  lauf: [['single_leg_calf_raise_dumbbell', 'side_plank_hip_abduction'], ['tibialis_raise', 'dead_bug']],
  rad: [['standing_calf_raises', 'pallof_press'], ['lying_leg_curls', 'dead_bug']],
};
const ISO = new Set(['lying_leg_curls', 'leg_extensions', 'side_lateral_raise', 'ez-bar_curl', 'triceps_pushdown_-_rope_attachment',
  'single_leg_calf_raise_dumbbell', 'standing_calf_raises', 'tibialis_raise', 'side_plank_hip_abduction', 'dead_bug', 'pallof_press']);
export const istIsolation = (k) => ISO.has(k);

/** 238/243: Kraft für Läufer bzw. Radfahrer als zwei kurze Einheiten (A/B, je 5 Übungen, ~20 min). */
export const LAEUFER_KRAFT = {
  lauf: { A: ['dumbbell_bulgarian_split_squat', 'pushups', 'single_leg_deadlift_dumbbell', 'one-arm_dumbbell_row', 'single_leg_calf_raise_dumbbell'],
    B: ['dumbbell_step_ups', 'wide-grip_lat_pulldown', 'single_leg_hip_thrust', 'seated_dumbbell_press', 'side_plank_hip_abduction'] },
  rad: { A: ['barbell_squat', 'pushups', 'barbell_hip_thrust', 'one-arm_dumbbell_row', 'pallof_press'],
    B: ['dumbbell_bulgarian_split_squat', 'wide-grip_lat_pulldown', 'single_leg_deadlift_dumbbell', 'seated_dumbbell_press', 'dead_bug'] },
};

const u = (key, saetze, wdh, rpe) => ({ key, saetze: String(saetze), wdh, rpe: String(rpe) });

/**
 * Kraft-Tage für den Kombi-Plan: anzahl 1–6, fokus kraft|mix|cardio, sport lauf|rad (beides → lauf).
 * Liefert [{ name, bein, uebungen }] im Format des Eigenen Plans.
 */
export function kraftVorlage({ anzahl, fokus = 'mix', sport = 'lauf', en = false }) {
  const deEnText = (de, e) => (en ? e : de);
  const sp = sport === 'rad' ? 'rad' : 'lauf', [abA, abB] = ABSCHLUSS[sp], f = FOKUS[fokus] ?? FOKUS.mix;
  const tag = (name, liste, bein) => {
    // Grundübungen zuerst (alle, höchstens n − 1), dann Isolation/Rumpf bis n
    const n = fokus === 'cardio' ? liste.length : Math.min(liste.length, f.uebungen), gu = liste.filter((k) => !ISO.has(k)), iso = liste.filter((k) => ISO.has(k));
    const g = gu.slice(0, iso.length ? Math.min(gu.length, n - 1) : n), gewaehlt = [...g, ...iso.slice(0, n - g.length)];
    return { name, bein, uebungen: gewaehlt.map((k) => (ISO.has(k) ? u(k, fokus === 'cardio' ? 2 : 3, '10-15', 8)
      : u(k, fokus === 'kraft' ? 4 : 3, fokus === 'kraft' ? '5-8' : '8-10', fokus === 'kraft' ? 8 : 7))) };
  };
  if (fokus === 'cardio') {
    const lk = LAEUFER_KRAFT[sp];
    return Array.from({ length: anzahl }, (_, i) => tag(i % 2 ? deEnText('Kraft B', 'Strength B') : deEnText('Kraft A', 'Strength A'), i % 2 ? lk.B : lk.A, true));
  }
  const gk = [[deEnText('Ganzkörper A', 'Full body A'), [...GK_A, ...abA]], [deEnText('Ganzkörper B', 'Full body B'), [...GK_B, ...abB]], [deEnText('Ganzkörper C', 'Full body C'), [...GK_C, ...abA]]];
  const ok = [[deEnText('Oberkörper A', 'Upper A'), OK_A, false], [deEnText('Unterkörper A', 'Lower A'), [...UK_A, ...abA], true], [deEnText('Oberkörper B', 'Upper B'), OK_B, false], [deEnText('Unterkörper B', 'Lower B'), [...UK_B, ...abB], true]];
  // 3 Tage: 2× Ganzkörper + 1× Oberkörper – Beine nicht an jedem Krafttag, damit harte Cardio-Einheiten Platz haben
  const folge = anzahl <= 2 ? gk.slice(0, anzahl).map(([n, l]) => [n, l, true]) : anzahl === 3 ? [[...gk[0], true], [...gk[1], true], ok[0]] : [...ok, ...gk.slice(0, anzahl - 4).map(([n, l]) => [n, l, true])];
  return folge.map(([n, l, b]) => tag(n, l, b));
}
