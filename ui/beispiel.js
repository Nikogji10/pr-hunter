// PR Hunter · Beispieldaten für Demo und Rendertests (fester Zufallsstartwert, bei jedem Laden gleich).
// Gewichte der Beispiel-Trainings rechnet der echte Rechenkern aus einem Beispiel-e1RM.
import { lastFuer, e1rm } from '../js/rechnen.js';

export const HEUTE = '2026-11-30';
export const URLAUB = { von: '2026-11-14', bis: '2026-11-27', name: 'Thailand' };
export const KOERPERGEWICHT = 88;

function zufall(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const plusTage = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const wochentag = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();   // 0 = So
const imUrlaub = (iso) => iso >= URLAUB.von && iso <= URLAUB.bis;

// #################################################################
// e1RM je Woche (52 Wochen bis zur Woche vor Thailand)
// #################################################################
const LETZTE_WOCHE = '2026-11-09';
const ZIEL = { squat: [193, 214.5], bench: [138, 156], dead: [203, 225] };
export const wochen = Array.from({ length: 52 }, (_, i) => plusTage(LETZTE_WOCHE, (i - 51) * 7));
export const e1rmWoche = (() => {
  const r = zufall(7), aus = {};
  for (const [lift, [a, b]] of Object.entries(ZIEL)) {
    let bisher = a;
    aus[lift] = wochen.map((_, i) => {
      if (i === 51) return b;
      const trend = a + (b - a) * Math.pow(i / 51, 0.85);
      bisher = Math.max(bisher - 1.5, Math.round((trend + (r() - 0.55) * 4) * 2) / 2);
      return Math.min(bisher, b - 1.5);                  // Endwert ist ein klarer neuer Bestwert
    });
  }
  // Bankdrücken tritt seit 5 Wochen auf der Stelle (zeigt die Plateau-Erkennung)
  aus.bench.splice(46, 6, 155.5, 155, 155.5, 155, 155.5, 156);
  return aus;
})();

// Wochenvolumen in kg je Lift (Deload alle 6 Wochen)
export const volumenWoche = (() => {
  const r = zufall(11);
  return wochen.map((w, i) => {
    const f = i % 6 === 5 ? 0.5 : 1;
    return { woche: w, squat: Math.round((6200 + r() * 2600) * f), bench: Math.round((7400 + r() * 2800) * f),
      dead: Math.round((3000 + r() * 1800) * f), andere: Math.round((6000 + r() * 3800) * f) };
  });
})();

// #################################################################
// Trainingstage (für Kalender, Heatmap, Verlauf)
// #################################################################
const PLAN_WT = { 1: ['squat', 'bench'], 2: ['bench'], 4: ['bench'], 5: ['squat', 'bench', 'dead'], 6: ['bench'] };
export const trainingsTage = (() => {
  const r = zufall(23), tage = {};
  for (let d = plusTage(HEUTE, -52 * 7); d < HEUTE; d = plusTage(d, 1)) {
    const lifts = PLAN_WT[wochentag(d)];
    if (!lifts || d >= URLAUB.von || r() < 0.1) continue;     // ab Urlaubsbeginn kein Training bis zum Blockstart
    tage[d] = { lifts, tonnage: Math.round(3500 + r() * 7000) };
  }
  return tage;
})();

function e1rmAm(lift, iso) {
  const naechste = wochen.findIndex((w) => w > iso);
  return e1rmWoche[lift][naechste === -1 ? 51 : Math.max(0, naechste - 1)];
}

/** Beispiel-Training eines Tages: Hauptsätze aus dem Beispiel-e1RM (RTS-Tabelle), dazu Zubehör. */
export function trainingAm(iso) {
  const tag = trainingsTage[iso];
  if (!tag) return null;
  const r = zufall(Number(iso.replaceAll('-', '')));
  const satz = (lift, wdh, rpe) => ({ kg: lastFuer(e1rmAm(lift, iso), wdh, rpe), wdh, rpe });
  const uebungen = [];
  const wt = wochentag(iso);
  if (tag.lifts.includes('squat')) {
    uebungen.push({ key: 'competition_squat', lift: 'squat', saetze: wt === 1
      ? [satz('squat', 3, 8), ...Array(3).fill(0).map(() => satz('squat', 6, 7))]
      : [satz('squat', 1, 7), satz('squat', 4, 6.5)] });
  }
  uebungen.push({ key: 'competition_bench_press', lift: 'bench', saetze: Array(3).fill(0).map(() => satz('bench', 3, 7 + Math.round(r()) * 0.5)) });
  if (tag.lifts.includes('dead')) {
    uebungen.push({ key: 'competition_deadlift', lift: 'dead', saetze: [satz('dead', 1, 7.5), satz('dead', 4, 7), satz('dead', 4, 7)] });
  }
  if (wt === 2 || wt === 6) {
    uebungen.push({ key: 'bent_over_barbell_row', lift: 'andere', saetze: Array(3).fill(0).map(() => ({ kg: 100, wdh: 8, rpe: 8 })) });
    uebungen.push({ key: 'standing_military_press', lift: 'andere', saetze: Array(3).fill(0).map(() => ({ kg: 62.5, wdh: 8, rpe: 8 })) });
  } else {
    uebungen.push({ key: 'leg_press', lift: 'andere', saetze: Array(3).fill(0).map(() => ({ kg: 180, wdh: 12, rpe: 7 })) });
  }
  const tonnage = uebungen.reduce((a, u) => a + u.saetze.reduce((b, s) => b + s.kg * s.wdh, 0), 0);
  for (const u of uebungen) u.e1rm = u.lift === 'andere' ? null : e1rmAm(u.lift, iso);
  return { datum: iso, uebungen, dauer: 55 + Math.round(r() * 45), gefuehl: 6 + Math.round(r() * 3),
    sessionRpe: 6 + Math.round(r() * 6) / 2, tonnage };
}

// #################################################################
// Rekorde und Bestwerte
// #################################################################
export const REKORDE = {
  squat: [[200, '2026-11-06'], [195, '2026-11-13'], [190, '2026-09-24'], [182.5, '2026-10-16'], [177.5, '2026-10-02'], [170, '2026-09-18'], [162.5, '2026-09-04'], [160, '2026-08-21'], [150, '2026-08-07'], [145, '2026-07-31']],
  bench: [[150, '2026-09-26'], [145, '2026-11-12'], [140, '2026-10-22'], [137.5, '2026-10-15'], [135, '2026-08-23'], [127.5, '2026-10-08'], [122.5, '2026-09-19'], [120, '2026-09-05'], [115, '2026-08-29'], [110, '2026-08-15']],
  dead: [[205, '2026-09-28'], [200, '2026-11-13'], [197.5, '2026-08-21'], [192.5, '2026-11-06'], [187.5, '2026-05-22'], [180, '2026-09-11'], [172.5, '2026-08-14'], [165, '2026-07-31'], [155, '2026-07-17'], [150, '2026-07-03']],
};
export const PR_FEED = [
  { datum: '2026-11-13', lift: 'dead', text: '200 kg × 2', e1rm: e1rm(200, 2) },
  { datum: '2026-11-12', lift: 'bench', text: '145 kg × 2', e1rm: e1rm(145, 2) },
  { datum: '2026-11-06', lift: 'squat', text: '200 kg × 1', e1rm: 200 },
  { datum: '2026-10-22', lift: 'bench', text: '140 kg × 3', e1rm: e1rm(140, 3) },
  { datum: '2026-10-16', lift: 'squat', text: '182,5 kg × 4', e1rm: e1rm(182.5, 4) },
];
export const LETZTES = {
  competition_squat: ['170 × 3 @ 7,5', '13.11.'], competition_bench_press: ['110 × 3', '12.11.'],
  'close-grip_barbell_bench_press': ['100 × 8 @ 9', '09.11.'], conventional_deadlift_pause_below_knee: ['135 × 4 @ 6', '13.11.'],
  competition_deadlift: ['200 × 2 @ 9', '13.11.'], leg_press: ['180 × 12 @ 7', '06.11.'],
};
export const BEST_E1RM = {
  competition_squat: e1rmWoche.squat[51], competition_bench_press: e1rmWoche.bench[51], competition_deadlift: e1rmWoche.dead[51],
  'close-grip_barbell_bench_press': 138, conventional_deadlift_pause_below_knee: 182, competition_squat_pause: 180,
};
// Für „Gewicht nach RPE“ bei Übungen ohne Prozentvorgabe
// Körpergewichtsübungen: e1RM der Gesamtlast (Körpergewicht + Zusatz)
export const E1RM_ZUBEHOER = {
  'close-grip_barbell_bench_press': 136, incline_dumbbell_press: 46, bent_over_barbell_row: 128, standing_military_press: 82,
  weighted_neutral_grip_pull_up: 130, weighted_pull_ups: 132, leg_press: 240, romanian_deadlift: 168, seated_leg_curl: 72, leg_extensions: 92,
  dumbbell_bulgarian_split_squat: 60, bench_press_low_pin: 150, bench_press_high_pin: 172,
};

/** Wochenverlauf des e1RM einer Übung (für den Fortschritt-Knopf im Training). */
export function verlaufUebung(key) {
  const lift = { competition_squat: 'squat', competition_bench_press: 'bench', competition_deadlift: 'dead' }[key];
  if (lift) return e1rmWoche[lift];
  const ziel = BEST_E1RM[key] ?? E1RM_ZUBEHOER[key];
  if (!ziel) return null;
  const r = zufall(key.length * 31);
  return wochen.map((_, i) => Math.round((ziel * (0.9 + 0.1 * i / 51) + (r() - 0.5) * 3) * 2) / 2);
}

/** Kompletter Beispielstand für ui/stand.js (Demo und Rendertests ohne Anmeldung). */
export function beispielStand() {
  const lift = { competition_squat: 'squat', competition_bench_press: 'bench', competition_deadlift: 'dead' };
  const ZULETZT = Object.fromEntries(Object.entries(LETZTES).map(([k, [, d]]) => [k, `2026-${d.slice(3, 5)}-${d.slice(0, 2)}`]));
  const KOERPERVERLAUF = wochen.map((w, i) => ({ datum: w, kg: Math.round((91 - (3 * i) / (wochen.length - 1) + Math.sin(i / 3) * 0.4) * 10) / 10 }));
  KOERPERVERLAUF[KOERPERVERLAUF.length - 1].kg = KOERPERGEWICHT;
  return { HEUTE, URLAUB, wochen, e1rmWoche, volumenWoche, trainingsTage, REKORDE, PR_FEED, LETZTES, BEST_E1RM,
    E1RM_AKTUELL: E1RM_ZUBEHOER, ZULETZT, KOERPERGEWICHT, KOERPERVERLAUF, DEMO: true, trainingAm, verlaufUebung,
    rekordeVon: (key) => ({ wdh: lift[key] ? REKORDE[lift[key]] : Array(10).fill(null),
      e1rm: BEST_E1RM[key] ? { wert: BEST_E1RM[key], datum: '2026-11-13', satz: null } : null }) };
}
