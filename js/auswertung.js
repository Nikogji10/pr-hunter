// PR Hunter · Auswertungen für die Statistik: Kraftprofil, harte Sätze, INOL, Trainingsbelastung, Plateau.
// Quellen stehen bei jeder Funktion; Werte, die nur aus Sekundärquellen stammen, sind als Richtwert markiert.
import { rtsPct, runde } from './rechnen.js';

// #################################################################
// Kraftprofil nach der veröffentlichten Methode von Symmetric Strength (symmetricstrength.com/about#methodology):
// jeder Lift → das Powerlifting-Total, das er nahelegt (Männer: Kniebeuge = 87 %, Bank = 65 % vom Kreuzheben),
// bewertet mit Wilks; Liftwert = ein Viertel davon. Reproduziert deren Standardtabelle (Test: 80 kg).
// Schulterdrücken, Klimmzug und Rudern veröffentlicht Symmetric Strength nicht → nur per Link.
// #################################################################
const WILKS_MAENNER = [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 7.01863e-6, -1.291e-8];
export const ANTEIL_AM_KREUZHEBEN = { squat: 0.87, bench: 0.65, dead: 1 };
const TOTAL_JE_KREUZHEBEN = 1 + 0.87 + 0.65;
export const STUFEN = [[125, 'Weltklasse'], [112.5, 'Elite'], [100, 'Herausragend'], [87.5, 'Fortgeschritten'],
  [75, 'Versiert'], [60, 'Mittelstufe'], [45, 'Einsteiger'], [30, 'Untrainiert'], [-Infinity, 'Unter Untrainiert']];

/** Wilks-Koeffizient (Originalformel, Männer). */
export function wilks(koerperKg) {
  return 500 / WILKS_MAENNER.reduce((a, c, i) => a + c * koerperKg ** i, 0);
}

export function liftWert(lift, e1rmKg, koerperKg) {
  if (!(e1rmKg > 0) || !(koerperKg > 0)) return null;
  return ((e1rmKg / ANTEIL_AM_KREUZHEBEN[lift]) * TOTAL_JE_KREUZHEBEN * wilks(koerperKg)) / 4;
}

/** Last, die für einen Liftwert nötig ist (z. B. für „noch x kg bis zur nächsten Stufe“). */
export const lastFuerWert = (lift, wert, koerperKg) => ((wert * 4) / wilks(koerperKg) / TOTAL_JE_KREUZHEBEN) * ANTEIL_AM_KREUZHEBEN[lift];

export function stufe(wert) {
  const i = STUFEN.findIndex(([grenze]) => wert >= grenze);
  return { name: STUFEN[i][1], naechste: i > 0 ? { name: STUFEN[i - 1][1], grenze: STUFEN[i - 1][0] } : null };
}

/** Eigene, einfache Zuordnung der Lifts zu Muskelgruppen (nicht die unveröffentlichte von Symmetric Strength). */
export const MUSKELN = {
  quadrizeps: ['squat'], gesaess: ['squat', 'dead'], adduktoren: ['squat'], beinbeuger: ['dead'], ruecken_unten: ['dead'],
  trapez: ['dead'], unterarme: ['dead'], brust: ['bench'], schulter_vorn: ['bench'], trizeps: ['bench'],
  latissimus: [], bizeps: [], schulter_seite: [], bauch: [], waden: [],
};

export function kraftprofil(e1rms, koerperKg) {
  const lifts = {};
  for (const lift of Object.keys(ANTEIL_AM_KREUZHEBEN)) {
    const wert = liftWert(lift, e1rms[lift], koerperKg);
    if (wert == null) continue;
    const s = stufe(wert);
    lifts[lift] = { e1rm: e1rms[lift], wert: runde(wert, 1), stufe: s.name, naechste: s.naechste && {
      name: s.naechste.name, fehlenKg: runde(lastFuerWert(lift, s.naechste.grenze, koerperKg) - e1rms[lift], 1) } };
  }
  const werte = Object.values(lifts).map((l) => l.wert);
  const muskeln = Object.fromEntries(Object.entries(MUSKELN).map(([m, quellen]) => {
    const w = quellen.map((l) => lifts[l]?.wert).filter((x) => x != null);
    return [m, w.length ? runde(w.reduce((a, b) => a + b, 0) / w.length, 1) : null];
  }));
  return { lifts, gesamt: werte.length ? runde(werte.reduce((a, b) => a + b, 0) / werte.length, 1) : null, muskeln };
}

// #################################################################
// Harte Sätze: Arbeitssatz mit RPE ≥ 7. Ohne RPE geschätzt: Last mindestens so hoch wie für diese Wdh @ RPE 7.
// satz.last (falls gesetzt) ist die Gesamtlast bei Körpergewichtsübungen, passend zum e1RM der Gesamtlast.
// #################################################################
export function istHart(satz, e1rmKg) {
  if (satz.typ === 'warmup' || !(satz.wdh > 0)) return false;
  if (satz.rpe != null) return satz.rpe >= 7;
  const pct = rtsPct(satz.wdh, 7);
  return e1rmKg > 0 && pct != null && (satz.last ?? satz.kg) >= e1rmKg * pct - 1e-9;
}

/** eintraege: [{ muskeln: [Hauptmuskeln], saetze: [...], e1rm }] → harte Sätze je Muskel (Hauptmuskel zählt 1). */
export function harteSaetzeJeMuskel(eintraege) {
  const aus = {};
  for (const e of eintraege) {
    const n = e.saetze.filter((s) => istHart(s, e.e1rm)).length;
    for (const m of e.muskeln ?? []) aus[m] = (aus[m] ?? 0) + n;
  }
  return aus;
}

// #################################################################
// INOL nach Hristov: Wdh / (100 − %1RM) je Satz, summiert je Übung und Einheit. Sätze ab 100 % zählen nicht.
// Richtwert (nur Sekundärquelle, Hristov-Zusammenfassungen): je Einheit 0,4–1,0; je Woche über 4 sehr hart.
// #################################################################
export const INOL_RICHTWERT = { einheit: [0.4, 1.0], wocheSehrHart: 4, quelle: 'Hristov, nach Sekundärquellen' };
export function inol(saetze, e1rmKg) {
  if (!(e1rmKg > 0)) return null;
  let summe = 0;
  for (const s of saetze) {
    const kg = s.last ?? s.kg;
    if (s.typ === 'warmup' || !(kg > 0) || !(s.wdh > 0)) continue;
    const pct = (kg / e1rmKg) * 100;
    if (pct < 100) summe += s.wdh / (100 - pct);
  }
  return runde(summe, 2);
}

// #################################################################
// Trainingsbelastung nach Foster (session-RPE): Last = Session-RPE (1–10) × Minuten.
// Woche: Summe; Monotonie = Mittel der 7 Tageslasten / Standardabweichung (Stichprobe); Strain = Summe × Monotonie.
// #################################################################
export const sessionLast = (rpe, minuten) => (rpe > 0 && minuten > 0 ? rpe * minuten : 0);

export function fosterWoche(tageslasten) {
  const n = tageslasten.length;
  const summe = tageslasten.reduce((a, b) => a + b, 0);
  const mittel = summe / n;
  const sd = Math.sqrt(tageslasten.reduce((a, x) => a + (x - mittel) ** 2, 0) / (n - 1));
  const monotonie = sd > 0 ? mittel / sd : null;
  return { last: summe, monotonie: monotonie == null ? null : runde(monotonie, 2), strain: monotonie == null ? null : runde(summe * monotonie, 0) };
}

// #################################################################
// Plateau: Wochen mit Training, seit das beste e1RM zuletzt um mehr als die Toleranz stieg.
// #################################################################
export function plateau(wochenwerte, { wochen = 4, toleranz = 0.005 } = {}) {
  let best = -Infinity, seit = 0;
  for (const v of wochenwerte) {
    if (v == null) continue;
    if (v > best * (1 + toleranz) || best === -Infinity) { best = v; seit = 0; } else seit += 1;
  }
  return { best: best === -Infinity ? null : best, wochenOhneRekord: seit, plateau: seit >= wochen };
}

// #################################################################
// Zielprognose: lineare Regression über die Wochen-e1RM (nur Wochen mit Wert) der letzten `fenster` Wochen.
// Rückgabe { ziel, aktuell, proWoche, wochen, datum, punkte } oder ein Grund, warum es keine Prognose gibt.
// #################################################################
export function zielprognose(wochenStart, werte, ziel, { fenster = 26, minPunkte = 6 } = {}) {
  const pkt = [];
  const ab = Math.max(0, werte.length - fenster);
  for (let i = ab; i < werte.length; i++) if (werte[i] != null) pkt.push([i, werte[i]]);
  if (pkt.length < minPunkte) return { grund: 'zuWenig', punkte: pkt.length };
  const n = pkt.length, mx = pkt.reduce((a, p) => a + p[0], 0) / n, my = pkt.reduce((a, p) => a + p[1], 0) / n;
  const sxx = pkt.reduce((a, p) => a + (p[0] - mx) ** 2, 0), sxy = pkt.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0);
  const steigung = sxx > 0 ? sxy / sxx : 0;
  const letzte = werte.length - 1;
  const aktuell = my + steigung * (letzte - mx);              // Trendwert dieser Woche, nicht der letzte Ausreißer
  if (ziel <= aktuell) return { grund: 'erreicht', aktuell: runde(aktuell, 1), proWoche: runde(steigung, 2), punkte: n };
  if (steigung <= 0.05) return { grund: 'keinTrend', aktuell: runde(aktuell, 1), proWoche: runde(steigung, 2), punkte: n };
  const wochen = Math.ceil((ziel - aktuell) / steigung);
  const d = new Date(`${wochenStart[letzte]}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + wochen * 7);
  return { ziel, aktuell: runde(aktuell, 1), proWoche: runde(steigung, 2), wochen, datum: d.toISOString().slice(0, 10), punkte: n };
}

// #################################################################
// Readiness-Check vor dem Training: Schlaf, Stress, Muskelkater, Energie je 1–5 (Schema: workouts.readiness).
// Wert 1–5, hoch = bereit (Stress und Muskelkater zählen umgekehrt). Hinweis ab einem Wert unter 3.
// #################################################################
export const BEREITSCHAFT = [
  ['sleep', 'Schlaf', ['sehr schlecht', 'sehr gut']], ['stress', 'Stress', ['keiner', 'sehr hoch']],
  ['soreness', 'Muskelkater', ['keiner', 'stark']], ['energy', 'Energie', ['leer', 'voll da']],
];
export function bereitschaftsWert(r) {
  if (!r) return null;
  const teile = [r.sleep, r.stress != null ? 6 - r.stress : null, r.soreness != null ? 6 - r.soreness : null, r.energy].filter((x) => x >= 1 && x <= 5);
  return teile.length ? runde(teile.reduce((a, b) => a + b, 0) / teile.length, 1) : null;
}
/** Empfehlung: ab Wert < 3 Gewichte 5 % leichter; unter 2 dazu Back-offs kürzen. */
export function bereitschaftsHinweis(wert) {
  if (wert == null || wert >= 3) return null;
  return wert < 2 ? { leichter: true, text: 'Heute deutlich angeschlagen: Gewichte 5 % leichter, Top-Satz höchstens RPE 7, den letzten Back-off streichen.' }
    : { leichter: true, text: 'Nicht ganz frisch: Gewichte 5 % leichter oder Top-Satz höchstens RPE 8. Fühlen sich die Aufwärmsätze gut an, normal weitermachen.' };
}
