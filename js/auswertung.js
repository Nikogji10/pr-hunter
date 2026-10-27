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

/** Muskelgruppen des Diagramms mit den Wettkampf-Lifts, die sie hauptsächlich trainieren (eigene, einfache Zuordnung;
 *  die Gewichte und abgeleiteten Muskeln stehen in SBD_MUSKELN, weitere Übungen in ANTEIL_GESCHAETZT). */
export const MUSKELN = {
  quadrizeps: ['squat'], gesaess: ['squat', 'dead'], adduktoren: ['squat'], beinbeuger: ['dead'], ruecken_unten: ['dead'],
  trapez: ['dead'], unterarme: ['dead'], brust: ['bench'], schulter_vorn: ['bench'], trizeps: ['bench'],
  latissimus: [], bizeps: [], schulter_seite: [], bauch: [], waden: [],
};

// #################################################################
// Weitere Übungen (eigene Näherung, in der App gekennzeichnet): Symmetric Strength bewertet auch Schulterdrücken,
// Klimmzug, Rudern usw., indem jede Übung über ihr Verhältnis zum Kreuzheben bei gleicher Stärke in dasselbe
// Total umgerechnet wird; ein Muskel ist der gewichtete Mittelwert der Übungen, die ihn trainieren. Deren Verhältnisse
// sind unveröffentlicht – hier stehen eigene Richtwerte (typische Standardtabellen, z. B. Schulterdrücken ≈ 65 % vom
// Bankdrücken = 0,42 vom Kreuzheben). Körpergewichtsübungen rechnen mit der Gesamtlast, Kurzhanteln je Hand.
// Je Übung: [Anteil am Kreuzheben, { Muskel: Gewicht }].
// #################################################################
export const ANTEIL_GESCHAETZT = {
  front_barbell_squat: [0.70, { quadrizeps: 1, gesaess: 0.5, bauch: 0.5 }],
  competition_squat_pause: [0.82, { quadrizeps: 1, gesaess: 1, adduktoren: 0.5 }],
  hack_squat: [0.95, { quadrizeps: 1, gesaess: 0.5 }],
  romanian_deadlift: [0.78, { beinbeuger: 1, gesaess: 1, ruecken_unten: 0.5 }],
  'stiff-legged_barbell_deadlift': [0.75, { beinbeuger: 1, ruecken_unten: 0.5 }],
  barbell_hip_thrust: [1.0, { gesaess: 1 }], barbell_glute_bridge: [0.95, { gesaess: 1 }],
  leg_extensions: [0.5, { quadrizeps: 1 }],
  lying_leg_curls: [0.33, { beinbeuger: 1 }], seated_leg_curl: [0.38, { beinbeuger: 1 }],
  standing_calf_raises: [0.9, { waden: 1 }], seated_calf_raise: [0.55, { waden: 1 }], calf_press_on_the_leg_press_machine: [1.1, { waden: 1 }],
  standing_barbell_calf_raise: [0.6, { waden: 1 }],
  standing_military_press: [0.42, { schulter_vorn: 1, schulter_seite: 0.5, trizeps: 0.5 }],
  barbell_shoulder_press: [0.42, { schulter_vorn: 1, schulter_seite: 0.5, trizeps: 0.5 }],
  seated_barbell_military_press: [0.44, { schulter_vorn: 1, schulter_seite: 0.5, trizeps: 0.5 }],
  push_press: [0.55, { schulter_vorn: 1, trizeps: 0.5 }],
  dumbbell_shoulder_press: [0.17, { schulter_vorn: 1, schulter_seite: 0.5 }], seated_dumbbell_press: [0.17, { schulter_vorn: 1, schulter_seite: 0.5 }],
  'barbell_incline_bench_press_-_medium_grip': [0.54, { brust: 1, schulter_vorn: 1 }],
  'close-grip_barbell_bench_press': [0.6, { trizeps: 1, brust: 0.5 }],
  incline_dumbbell_press: [0.21, { brust: 1, schulter_vorn: 0.5 }], dumbbell_bench_press: [0.25, { brust: 1, trizeps: 0.5 }],
  parallel_bar_dip: [0.75, { trizeps: 1, brust: 1 }], weighted_triceps_dip: [0.75, { trizeps: 1, brust: 1 }], 'dips_-_triceps_version': [0.75, { trizeps: 1, brust: 0.5 }],
  'dips_-_chest_version': [0.75, { brust: 1, trizeps: 0.5 }],
  barbell_skull_crusher: [0.25, { trizeps: 1 }], 'ez-bar_skullcrusher': [0.25, { trizeps: 1 }],
  'triceps_pushdown_-_rope_attachment': [0.28, { trizeps: 1 }], 'triceps_pushdown_-_v-bar_attachment': [0.32, { trizeps: 1 }],
  weighted_pull_ups: [0.6, { latissimus: 1, bizeps: 0.5 }], pullups: [0.6, { latissimus: 1, bizeps: 0.5 }], 'chin-up': [0.62, { latissimus: 1, bizeps: 1 }],
  'wide-grip_lat_pulldown': [0.48, { latissimus: 1 }],
  bent_over_barbell_row: [0.55, { latissimus: 1, trapez: 0.5, schulter_seite: 0.5 }], pendlay_row: [0.52, { latissimus: 1, trapez: 0.5, schulter_seite: 0.5 }],
  't-bar_row_with_handle': [0.6, { latissimus: 1, trapez: 0.5 }], seated_cable_rows: [0.52, { latissimus: 1, trapez: 0.5 }],
  'one-arm_dumbbell_row': [0.27, { latissimus: 1 }],
  barbell_shrug: [0.95, { trapez: 1 }],
  barbell_curl: [0.3, { bizeps: 1 }], 'ez-bar_curl': [0.3, { bizeps: 1 }], preacher_curl: [0.25, { bizeps: 1 }],
  reverse_barbell_curl: [0.22, { unterarme: 1, bizeps: 0.5 }], hammer_curls: [0.12, { bizeps: 1, unterarme: 0.5 }], dumbbell_bicep_curl: [0.11, { bizeps: 1 }],
  'palms-up_barbell_wrist_curl_over_a_bench': [0.27, { unterarme: 1 }],
  side_lateral_raise: [0.07, { schulter_seite: 1 }], face_pull: [0.18, { schulter_seite: 1, trapez: 0.5 }],
  butterfly: [0.45, { brust: 1 }],
};
// Die Wettkampf-Lifts nach der veröffentlichten Methode, mit Gewicht je Muskel; Bauch aus Kniebeuge und Kreuzheben abgeleitet
const SBD_MUSKELN = {
  squat: { quadrizeps: 1, gesaess: 1, adduktoren: 1, ruecken_unten: 0.5, bauch: 0.5 },
  dead: { beinbeuger: 1, ruecken_unten: 1, trapez: 1, unterarme: 1, gesaess: 1, bauch: 0.5 },
  bench: { brust: 1, schulter_vorn: 1, trizeps: 1 },
};
const GEWICHT_GESCHAETZT = 0.5;      // eine geschätzte Übung zählt halb so viel wie ein Wettkampf-Lift

/** Wert einer weiteren Übung: wie ein Lift, nur mit dem geschätzten Anteil am Kreuzheben. */
export function uebungsWert(key, e1rmKg, koerperKg) {
  const a = ANTEIL_GESCHAETZT[key];
  if (!a || !(e1rmKg > 0) || !(koerperKg > 0)) return null;
  return ((e1rmKg / a[0]) * TOTAL_JE_KREUZHEBEN * wilks(koerperKg)) / 4;
}

/**
 * Kraftprofil: Lifts (Kniebeuge, Bank, Kreuzheben) nach Symmetric Strength, Gesamt = Mittel der drei.
 * weitere: [{ key, e1rm, name }] – zusätzliche trainierte Übungen; färben die Muskeln mit (geschätzt, halbes Gewicht).
 * muskeln: { Muskel: Wert | null }, quellen: { Muskel: [{ name, wert, geschaetzt }] }.
 */
export function kraftprofil(e1rms, koerperKg, weitere = []) {
  const lifts = {};
  for (const lift of Object.keys(ANTEIL_AM_KREUZHEBEN)) {
    const wert = liftWert(lift, e1rms[lift], koerperKg);
    if (wert == null) continue;
    const s = stufe(wert);
    lifts[lift] = { e1rm: e1rms[lift], wert: runde(wert, 1), stufe: s.name, naechste: s.naechste && {
      name: s.naechste.name, fehlenKg: runde(lastFuerWert(lift, s.naechste.grenze, koerperKg) - e1rms[lift], 1) } };
  }
  const werte = Object.values(lifts).map((l) => l.wert);
  const beitraege = Object.fromEntries(Object.keys(MUSKELN).map((m) => [m, []]));
  for (const [lift, ms] of Object.entries(SBD_MUSKELN)) {
    if (!lifts[lift]) continue;
    for (const [m, g] of Object.entries(ms)) beitraege[m].push({ name: lift, wert: lifts[lift].wert, gewicht: g, geschaetzt: false });
  }
  const uebungen = [];
  for (const u of weitere) {
    const wert = uebungsWert(u.key, u.e1rm, koerperKg);
    if (wert == null) continue;
    uebungen.push({ key: u.key, name: u.name ?? u.key, e1rm: u.e1rm, wert: runde(wert, 1), stufe: stufe(wert).name });
    for (const [m, g] of Object.entries(ANTEIL_GESCHAETZT[u.key][1])) beitraege[m].push({ name: u.name ?? u.key, wert, gewicht: g * GEWICHT_GESCHAETZT, geschaetzt: true });
  }
  const muskeln = {}, quellen = {};
  for (const [m, b] of Object.entries(beitraege)) {
    const summe = b.reduce((a, x) => a + x.gewicht, 0);
    muskeln[m] = summe > 0 ? runde(b.reduce((a, x) => a + x.wert * x.gewicht, 0) / summe, 1) : null;
    quellen[m] = b.map(({ name, wert, geschaetzt }) => ({ name, wert: runde(wert, 1), geschaetzt }));
  }
  return { lifts, gesamt: werte.length ? runde(werte.reduce((a, b) => a + b, 0) / werte.length, 1) : null, muskeln, quellen,
    uebungen: uebungen.sort((a, b) => b.wert - a.wert) };
}

// #################################################################
// Muskel-Erholung (Ampel wie „Muscle Recovery“ in Jefit, eigene Näherung): jeder Arbeitssatz lädt seine Muskeln
// (Hauptmuskel 1, mitarbeitende 0,5) mit einer Last nach Anstrengung – ab RPE 8 1, RPE 6–7,5 0,7, darunter 0,4,
// ohne RPE 0,8 – die linear über 72 Stunden abklingt. Restlast ab 4 = rot (stark ermüdet), ab 1,5 = gelb
// (teilweise erholt), sonst grau (erholt). Beispiel: 8 harte Kniebeugesätze sind nach 24 h noch rot, nach 48 h gelb.
// #################################################################
export const ERHOLUNG = { stunden: 72, rot: 4, gelb: 1.5 };
const KATALOG_MUSKEL = {
  quadriceps: { quadrizeps: 1 }, glutes: { gesaess: 1 }, adductors: { adduktoren: 1 }, abductors: { gesaess: 0.5 }, hamstrings: { beinbeuger: 1 },
  'lower back': { ruecken_unten: 1 }, 'middle back': { latissimus: 1, trapez: 0.5 }, lats: { latissimus: 1 }, traps: { trapez: 1 }, neck: { trapez: 0.5 },
  forearms: { unterarme: 1 }, chest: { brust: 1 }, shoulders: { schulter_vorn: 1, schulter_seite: 1 }, triceps: { trizeps: 1 }, biceps: { bizeps: 1 },
  abdominals: { bauch: 1 }, calves: { waden: 1 },
};
const BASIS_LIFT = { squat: 'squat', bench: 'bench', deadlift: 'dead' };

/** Muskelgruppen einer Übung mit Gewicht: Wettkampf-Lifts und ihre Varianten wie der Lift, bekannte Übungen aus
 *  ANTEIL_GESCHAETZT, sonst die Hauptmuskeln des Katalogs. eintrag = Katalogeintrag ({ b, m }). */
export function muskelGewichte(key, eintrag) {
  if (BASIS_LIFT[eintrag?.b]) return SBD_MUSKELN[BASIS_LIFT[eintrag.b]];
  if (ANTEIL_GESCHAETZT[key]) return ANTEIL_GESCHAETZT[key][1];
  const aus = {};
  for (const m of eintrag?.m ?? []) for (const [g, w] of Object.entries(KATALOG_MUSKEL[m] ?? {})) aus[g] = Math.max(aus[g] ?? 0, w);
  return aus;
}

const satzLast = (s) => (s.rpe == null ? 0.8 : s.rpe >= 8 ? 1 : s.rpe >= 6 ? 0.7 : 0.4);
const restVon = (eintraege, ms) => {
  const rest = {};
  for (const e of eintraege) {
    const anteil = 1 - (ms - e.zeit) / (ERHOLUNG.stunden * 3600e3);
    if (anteil <= 0 || anteil > 1) continue;
    const last = e.saetze.filter((s) => s.typ !== 'warmup' && s.wdh > 0).reduce((a, s) => a + satzLast(s), 0) * anteil;
    for (const [m, g] of Object.entries(e.muskeln)) rest[m] = (rest[m] ?? 0) + last * g;
  }
  return rest;
};

/**
 * eintraege: [{ zeit: ms (Ende des Trainings), muskeln: { Gruppe: Gewicht }, saetze: [{ rpe, wdh, typ }] }].
 * Rückgabe je Muskelgruppe mit Restlast: { last, stufe: 'rot'|'gelb'|'grau', stunden } – stunden bis „erholt“ (grau).
 */
export function erholung(eintraege, jetztMs) {
  const jetzt = restVon(eintraege, jetztMs), aus = {};
  for (const [m, last] of Object.entries(jetzt)) {
    let h = 0;
    while (h < ERHOLUNG.stunden && (restVon(eintraege, jetztMs + h * 3600e3)[m] ?? 0) >= ERHOLUNG.gelb) h += 1;
    aus[m] = { last: runde(last, 2), stufe: last >= ERHOLUNG.rot ? 'rot' : last >= ERHOLUNG.gelb ? 'gelb' : 'grau', stunden: h };
  }
  return aus;
}

// #################################################################
// Rekord-Chronik: jeder Trainingstag, an dem eine Übung ein höheres e1RM als je zuvor erreicht (der erste Tag einer
// Übung zählt nicht – da gibt es nichts zu schlagen). Gleiche Regel wie der Feed (db/15_feed.sql), je Übung und Tag ein Rekord.
// tage: [{ datum, uebungen: [{ key, saetze: [{ e1rm }] }] }] aufsteigend → [{ datum, key, e1rm, vorher }]
// #################################################################
export function rekordChronik(tage) {
  const best = new Map(), aus = [];
  for (const t of tage) {
    const heute = new Map();
    for (const u of t.uebungen) {
      // ohne gespeichertes e1RM (Beispieldaten): Epley aus Gewicht × Wdh, wie die App Rekorde rechnet
      const m = Math.max(-Infinity, ...u.saetze.map((s) => s.e1rm ?? (s.kg > 0 && s.wdh > 0 ? (s.kg * (30 + s.wdh)) / 30 : -Infinity)));
      if (m > (heute.get(u.key) ?? -Infinity)) heute.set(u.key, m);
    }
    for (const [key, m] of heute) {
      if (!Number.isFinite(m)) continue;
      const vorher = best.get(key);
      if (vorher != null && m > vorher) aus.push({ datum: t.datum, key, e1rm: m, vorher });
      if (vorher == null || m > vorher) best.set(key, m);
    }
  }
  return aus;
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

// #################################################################
// Körpergewicht im Zeitraum: Start, aktuell, Veränderung, Min/Max, Trend in kg je Woche (Regression über die Messtage)
// #################################################################
export function gewichtImZeitraum(messwerte, von) {
  const m = messwerte.filter((x) => x.datum >= von && x.kg > 0);
  if (!m.length) return null;
  const t0 = Date.parse(`${m[0].datum}T00:00:00Z`);
  const pkt = m.map((x) => [(Date.parse(`${x.datum}T00:00:00Z`) - t0) / 864e5, x.kg]);
  const n = pkt.length, mx = pkt.reduce((a, p) => a + p[0], 0) / n, my = pkt.reduce((a, p) => a + p[1], 0) / n;
  const sxx = pkt.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  const steigung = sxx > 0 ? pkt.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / sxx : 0;
  return { start: m[0].kg, aktuell: m.at(-1).kg, veraenderung: runde(m.at(-1).kg - m[0].kg, 1), min: Math.min(...m.map((x) => x.kg)),
    max: Math.max(...m.map((x) => x.kg)), proWoche: n >= 3 ? runde(steigung * 7, 2) : null, anzahl: n, seit: m[0].datum };
}
