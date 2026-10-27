// PR Hunter · Block-Generator (Funktionskatalog „Block-Generator“): Kniebeuge und Kreuzheben, optional Bankdrücken,
// mit Top-Satz und Back-offs für genau die Wochen bis zu einem Termin. Prozente der Wochentypen 1:1 aus Nikos
// korrigiertem Hybrid (programme/pr_hybrid_candito_pana.json, W1–W6, gegen Excel geprüft); alle Werte in % vom
// Trainingsmax, nur der Test rechnet vom echten 1RM. Jeder Wert wird gegen die Pana-Grenzen geprüft.
import { rechneFormel, leseWdh, ableiten } from './programm.js';

/** Pana-Grenzen in % vom Trainingsmax je Wdh-Zahl. */
export const PANA = {
  top: { 1: [88, 100], 2: [86, 95], 3: [82, 92], 4: [79, 87], 5: [76, 84] },
  backoff: { 3: [80, 86], 4: [76, 82], 5: [72, 80], 6: [68, 78] },
};
const MAX_SPRUNG = 5;          // Top-Satz steigt höchstens 5 Prozentpunkte pro Woche
const WELLE = 2.5;             // zweite Welle: +2,5 % auf Top-Satz und Back-off

// [Sätze, Wdh, % vom TM, RPE-Text]. s = Kniebeuge (auch Bank-Haupteinheit), d = Kreuzheben, *Var = Zweiteinheit
export const WOCHENTYPEN = {
  wiedereinstieg: { titel: 'Wiedereinstieg', top: [1, 3, 82, '3-4 RIR'], backoff: [3, 6, 68, 'RPE 6'], dTop: [1, 1, 88, 'RPE 6-7'], dBackoff: [2, 4, 76, 'RPE 6'],
    sSingle: [1, 1, 70, 'RPE 6'], sVar: [1, 4, 65, 'RPE 6'], dVar: [2, 4, 60, 'RPE 6'], notiz: 'Nach einer Pause: alle Hauptwerte an der unteren Pana-Grenze.' },
  einstieg: { titel: 'Einstieg', top: [1, 3, 84, '3 RIR'], backoff: [3, 6, 70, 'RPE 6-8'], dTop: [1, 1, 89, 'RPE 7'], dBackoff: [2, 4, 76, 'RPE 6-8'],
    sSingle: [1, 1, 75, 'RPE 6-7'], sVar: [1, 4, 68, 'RPE 6-7'], dVar: [2, 4, 65, 'RPE 6'] },
  aufbau: { titel: 'Aufbau', top: [1, 3, 86, '2 RIR'], backoff: [3, 6, 72, 'RPE 6-8'], dTop: [1, 1, 92, 'RPE 7.5-8'], dBackoff: [2, 4, 78, 'RPE 6-8'],
    sSingle: [1, 1, 77.5, 'RPE 6-7'], sVar: [1, 4, 70, 'RPE 6-7'], dVar: [2, 4, 67.5, 'RPE 6-7'] },
  ueberlastung: { titel: 'Überlastung', top: [1, 3, 89, '1-2 RIR'], backoff: [3, 6, 75, 'RPE 6-8'], dTop: [1, 1, 95, 'RPE 8-8.5'], dBackoff: [2, 3, 80, 'RPE 6-8'],
    sSingle: [1, 1, 80, 'RPE 6-7'], sVar: [1, 4, 72, 'RPE 6-7'], dVar: [2, 4, 70, 'RPE 7'] },
  peak: { titel: 'Peak-Vorbereitung', top: [1, 3, 91, 'RPE 8-8.5'], backoff: [2, 4, 76, 'RPE 7'], dTop: [1, 1, 92, 'RPE 8-8.5'], dBackoff: [2, 3, 80, 'RPE 7'],
    sSingle: [1, 1, 80, 'RPE 6-7'], sVar: [2, 3, 67, 'RPE 6'], dVar: [2, 3, 65, 'RPE 6'] },
};
const TEST = { titel: 'Test', test: [1, '1-2', 97.5, 'RPE 9-10'], var: [2, 3, 62.5, 'RPE 5-6'],
  notiz: 'Test, max. 2 Wdh. Nach 1 Wdh stoppen, wenn sie langsam war.' };
const DELOAD = { titel: 'Deload', s1: [3, 3, 60, 'RPE 5-6'], d1: [2, 3, 55, 'RPE 5'], s2: [2, 3, 55, 'RPE 5'], d2: [2, 3, 60, 'RPE 5-6'] };
const TECHNIK = [3, 3, 65, 'RPE 5-6'];
const KH_LEICHT = [3, 2, 65, 'RPE 5-6'];

export const STANDARD_VARIANTEN = { squat: 'competition_squat_pause', dead: 'conventional_deadlift_deficit_paused' };

// #################################################################
// Wochenaufbau (Nikos Regeln, Wunsch 40): Unterkörpertage nach der Häufigkeit von Kniebeuge/Kreuzheben, Abstand
// mindestens 3 Tage (vor einer leichten Einheit 2), schwere Kniebeuge und schweres Kreuzheben an verschiedenen Tagen,
// kein Kreuzheben an Fr + Sa hintereinander. Bankdrücken 2–4×: höchstens zwei eigene Oberkörpertage, weitere
// Bankeinheiten leichter an Unterkörpertagen (Variante höchstens RPE 8,5).
// Offsets ab Wochenbeginn (0 = erster Trainingstag, meist Montag).
// #################################################################
export const UNTEN_TAGE = { 1: [0], 2: [0, 4], 3: [0, 3, 5] };
export const OBEN_TAGE = { 1: [2, 4], 2: [2, 5], 3: [1, 4] };
// Bankeinheiten in der Reihenfolge ihrer Vergabe: schwer (Top/Back-off), Volumen, enge Bank, leichte Technik
const BANK_VOLUMEN = (t, plus) => [3, 5, t.backoff[2] + 4 + plus, 'RPE 7-8'];
const BANK_ENG = (plus) => [3, 6, 68 + plus, 'RPE 7-8.5'];
const BANK_LEICHT = [3, 3, 70, 'RPE 6-7'];
// Zubehör wie im Candito/Pana-Oberkörpertag; Gewichte schlägt die App aus dem e1RM vor
const OBEN_ZUBEHOER = [
  { exercise_key: 'bent_over_barbell_row', groups: [{ sets: '3', reps: '8', load: null, rpe: 'RPE 7-8' }] },
  { exercise_key: 'standing_military_press', groups: [{ sets: '3', reps: '6-8', load: null, rpe: 'RPE 7-8' }] },
  { exercise_key: 'weighted_pull_ups', groups: [{ sets: '3', reps: '6-8', load: null, rpe: 'RPE 7-8' }] },
  ...[1, 2].map((n) => ({ exercise: `Isolation ${n}`, slot: { label: `Zusatz Oberkörper ${n}`, families: ['triceps', 'curl', 'shoulder_iso', 'fly'] },
    groups: [{ sets: '3', reps: '10-15', load: null, rpe: 'RPE 8' }] })),
];
const BEIN_ZUBEHOER = [1, 2].map((n) => ({ exercise: `Beine ${n}`, slot: { label: `Zusatz Beine ${n}`, families: ['leg_iso'] },
  groups: [{ sets: '3', reps: '10-15', load: null, rpe: 'RPE 8' }] }));

/** Häufigkeiten aus der Eingabe (älteres Feld „einheiten“ gilt für Kniebeuge und Kreuzheben). */
export function haeufigkeiten(e) {
  const alt = Math.min(3, Math.max(1, e.einheiten ?? 2));
  const lim = (v, lo, hi, std) => Math.min(hi, Math.max(lo, v ?? std));
  return { squat: lim(e.proWoche?.squat, 1, 3, alt), dead: lim(e.proWoche?.dead, 1, 3, alt), bench: lim(e.proWoche?.bench, 2, 4, 2) };
}

/** Wochenfolge der Aufbauwochen (vor dem Abschluss). Kurz: erst fällt der Einstieg weg, dann die Peak-Vorbereitung. */
export function wochenFolge(anzahl, { abschluss = 'test', wiedereinstieg = false } = {}) {
  const aufbau = anzahl - (abschluss === 'keiner' ? 0 : 1) - (wiedereinstieg ? 1 : 0);
  if (aufbau < 1 || anzahl > 12) throw new Error(`${anzahl} Wochen passen nicht (2–12 Wochen, mindestens eine Aufbauwoche).`);
  const typ = (t, welle = 0) => ({ typ: t, welle });
  let folge;
  if (aufbau === 1) folge = [typ('aufbau')];
  else if (aufbau === 2) folge = [typ('aufbau'), typ('ueberlastung')];
  else if (aufbau === 3) folge = [typ('aufbau'), typ('ueberlastung'), typ('peak')];
  else {
    folge = [typ('einstieg')];
    // Der Katalog kennt nur eine zweite Welle (+2,5 %); weitere Aufbauwochen wiederholen deren Werte (eine dritte
    // Welle mit +5 % läge beim Kreuzheben-Back-off über der Pana-Grenze)
    for (let i = 0; i < aufbau - 2; i++) folge.push(typ(i % 2 === 0 ? 'aufbau' : 'ueberlastung', Math.min(1, Math.floor(i / 2))));
    folge.push(typ('peak'));
  }
  if (wiedereinstieg) folge.unshift(typ('wiedereinstieg'));
  if (abschluss !== 'keiner') folge.push(typ(abschluss));
  return folge;
}

/** Wochen bis zu einem Enddatum (volle Wochen ab Start). */
export const wochenBis = (start, ende) => Math.floor((Date.parse(`${ende}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / (7 * 864e5));

const zahl = (x) => Math.round(x * 1000) / 1000;
const last = (v, tm, p) => `R(${v}*${zahl(tm)}*${zahl(p / 100)})`;
const gruppe = ([sets, reps, , rpe], load, note = null) => ({ sets: String(sets), reps: String(reps), load, rpe, ...(note ? { note } : {}) });

/**
 * Programm im App-Format erzeugen. e: { wochen, abschluss ('test'|'deload'|'keiner'), urlaubDanach,
 * bank ('keine'|'top'|'candito', früher mitBank), bankVorlage (Candito Advanced Bench, nur bei bank 'candito'),
 * einheiten (1–3), tm (Anteil, z. B. 0.95), varianten { squat, dead }, wiedereinstieg, name }.
 * Rückgabe { programm, pruefung: { fehler, hinweise } }. Mit Fehlern gilt der Block als nicht speicherbar.
 */
export function generiere(e) {
  const abschluss = e.urlaubDanach && e.abschluss === 'deload' ? 'keiner' : e.abschluss ?? 'test';
  const folge = wochenFolge(e.wochen, { abschluss, wiedereinstieg: !!e.wiedereinstieg });
  const tm = e.tm ?? 0.95, f = haeufigkeiten(e), zubehoer = e.zubehoer !== false;
  const varianten = { ...STANDARD_VARIANTEN, ...(e.varianten ?? {}) };
  const bank = e.bank ?? (e.mitBank ? 'top' : 'keine');
  const L = Math.max(f.squat, f.dead), unten = UNTEN_TAGE[L];
  if (L === 1) f.bench = Math.min(f.bench, 3);            // ein Unterkörpertag trägt höchstens eine zusätzliche Bankeinheit
  const hinweise = [];
  if (e.urlaubDanach && e.abschluss === 'deload') hinweise.push('Danach folgt Urlaub: kein Deload davor, die Pause übernimmt das.');
  const candito = bank === 'candito' ? canditoWochen(e.bankVorlage, e.wochen) : null;
  if (candito) hinweise.push('Bankdrücken und Oberkörper-Zubehör 1:1 aus Candito Advanced Bench (Woche 6 = deren Deload); das neue Bank-Max kommt aus dem AMRAP in Woche 5.');
  const mitBank = bank === 'top';
  const weeks = folge.map((w, i) => {
    const o = i * 7, days = [];
    const tag = (offset, items) => { const d = days.find((x) => x.offset === offset); if (d) d.items.push(...items); else days.push({ offset, items }); };
    if (w.typ === 'test') {
      tag(o, [{ exercise_key: 'competition_squat', role: 'test', groups: [gruppe(TEST.test, `R(S*${zahl(TEST.test[2] / 100)})`, TEST.notiz)] },
        { exercise_key: 'competition_deadlift', role: 'secondary', groups: [gruppe(TEST.var, last('D', tm, TEST.var[2]))] }]);
      if (mitBank) tag(o + 2, [{ exercise_key: 'competition_bench_press', role: 'test', groups: [gruppe(TEST.test, `R(B*${zahl(TEST.test[2] / 100)})`, TEST.notiz)] }]);
      tag(o + 4, [{ exercise_key: 'competition_deadlift', role: 'test', groups: [gruppe(TEST.test, `R(D*${zahl(TEST.test[2] / 100)})`, TEST.notiz)] },
        { exercise_key: 'competition_squat', role: 'secondary', groups: [gruppe(TEST.var, last('S', tm, TEST.var[2]))] }]);
    } else if (w.typ === 'deload') {
      tag(o, [{ exercise_key: 'competition_squat', role: null, groups: [gruppe(DELOAD.s1, last('S', tm, DELOAD.s1[2]))] },
        { exercise_key: 'competition_deadlift', role: null, groups: [gruppe(DELOAD.d1, last('D', tm, DELOAD.d1[2]))] }]);
      if (mitBank) tag(o + 2, [{ exercise_key: 'competition_bench_press', role: null, groups: [gruppe(DELOAD.s1, last('B', tm, DELOAD.s1[2]))] }]);
      tag(o + 4, [{ exercise_key: 'competition_squat', role: null, groups: [gruppe(DELOAD.s2, last('S', tm, DELOAD.s2[2]))] },
        { exercise_key: 'competition_deadlift', role: null, groups: [gruppe(DELOAD.d2, last('D', tm, DELOAD.d2[2]))] }]);
    } else {
      const t = WOCHENTYPEN[w.typ], plus = w.welle * WELLE;
      const mit = (a) => [a[0], a[1], a[2] + plus, a[3]];
      const haupt = (key, v, top, backoff) => [
        { exercise_key: key, role: 'top', groups: [gruppe(mit(top), last(v, tm, mit(top)[2]))] },
        { exercise_key: key, role: 'backoff', groups: [gruppe(mit(backoff), last(v, tm, mit(backoff)[2]))] }];
      const zweit = (key, v, a, note = null) => ({ exercise_key: key, role: 'secondary', groups: [gruppe(a, last(v, tm, a[2]), note)] });
      // Unterkörper: Tag 1 schwere Kniebeuge (+ Kreuzheben-Variante), letzter bzw. mittlerer Tag schweres Kreuzheben
      // (+ Technik-Single und Kniebeuge-Variante), bei drei Tagen am Ende die leichten Einheiten
      const kbTag = o + unten[0], khTag = o + unten[Math.min(1, L - 1)];
      tag(kbTag, haupt('competition_squat', 'S', t.top, t.backoff));
      if (f.dead >= 2) tag(kbTag, [zweit(varianten.dead, 'D', t.dVar)]);
      if (f.squat >= 2) tag(khTag, [zweit('competition_squat', 'S', t.sSingle, 'Technik-Single'), zweit(varianten.squat, 'S', t.sVar)]);
      tag(khTag, haupt('competition_deadlift', 'D', t.dTop, t.dBackoff));
      if (L === 3) {
        if (f.squat === 3) tag(o + unten[2], [zweit('competition_squat', 'S', TECHNIK, 'Leicht – Technik')]);
        if (f.dead === 3) tag(o + unten[2], [zweit('competition_deadlift', 'D', KH_LEICHT, 'Leicht – Technik')]);
      }
      if (mitBank) {
        // Bank: schwer und Volumen an den Oberkörpertagen, weitere Einheiten leichter an Unterkörpertagen
        const einheitenBank = [haupt('competition_bench_press', 'B', t.top, t.backoff), [zweit('competition_bench_press', 'B', BANK_VOLUMEN(t, plus), 'Volumen')],
          [zweit('close-grip_barbell_bench_press', 'B', BANK_ENG(plus), 'Variante, höchstens RPE 8,5')], [zweit('competition_bench_press', 'B', BANK_LEICHT, 'Leicht – Technik')]]
          .slice(0, f.bench);
        const oben = OBEN_TAGE[L].slice(0, Math.min(2, f.bench));
        oben.forEach((d, j) => tag(o + d, [...einheitenBank[j], ...(zubehoer ? structuredClone(OBEN_ZUBEHOER) : [])]));
        einheitenBank.slice(oben.length).forEach((b, j) => tag(o + unten[j % L], b));
      }
      if (zubehoer && !candito) for (const d of unten.slice(0, L)) if (days.some((x) => x.offset === o + d)) tag(o + d, structuredClone(BEIN_ZUBEHOER));
      if (t.notiz) days[0].notes = [t.notiz];
    }
    if (candito) for (const d of candito[i]) tag(o + d.offset, structuredClone(d.items));
    days.sort((a, b) => a.offset - b.offset);
    const titel = w.typ === 'test' ? TEST.titel : w.typ === 'deload' ? DELOAD.titel : WOCHENTYPEN[w.typ].titel + (w.welle ? ` (Welle ${w.welle + 1}, +${w.welle * WELLE} %)` : '');
    return { week: i + 1, title: `Woche ${i + 1} – ${titel}`, typ: w.typ, days };
  });
  const programm = {
    id: `generator-${Date.now()}`, name: e.name || `Generator ${e.wochen} Wochen`,
    source: 'Block-Generator: Wochentypen aus dem korrigierten Hybrid, Pana-Grenzen',
    inputs: ['S', 'D', ...(mitBank ? ['B'] : candito ? ['B', 'G'] : [])], weeks,
    settings: { cut_mode: { reduce_sets: 1, min_sets: 1 } },
    rules: {
      generator: { wochen: e.wochen, abschluss: e.abschluss ?? 'test', urlaubDanach: !!e.urlaubDanach, tm, proWoche: f, zubehoer, varianten, bank, wiedereinstieg: !!e.wiedereinstieg },
      // gleicher Test wie im Hybrid (1–2 Wdh @ 97,5 %), daher dieselbe Projektion
      projection: { method: 'divide', table: { 1: 1, 2: 0.96, 3: 0.92, 4: 0.89, 5: 0.86, 6: 0.84, 7: 0.81 }, round_to: 'inc', min_reps: 2,
        max_increase: { S: 0.02, D: 0.02 }, source: 'Wie im Hybrid: MROUND(Testgewicht ÷ %1RM; inc), unter 2 Wdh altes Max, Kniebeuge/Kreuzheben höchstens +2 %.' },
    },
  };
  if (candito) programm.rules.projection_bench = { ...e.bankVorlage.rules.projection, week: 5, lift: 'B' };
  const pruefung = pruefePana(programm);
  return { programm, pruefung: { fehler: pruefung.fehler, hinweise: [...hinweise, ...pruefung.hinweise] } };
}

/** Bankdrücken- und Oberkörper-Einträge der Candito-Wochen 1–6 (ohne Taper-Alternative), Offsets relativ zur Woche. */
function canditoWochen(vorlage, wochen) {
  if (wochen !== 6) throw new Error('Candito Advanced Bench passt nur zu genau 6 Wochen.');
  if (!vorlage?.weeks) throw new Error('Die Vorlage Candito Advanced Bench fehlt.');
  const unten = (it) => it.exercise_key === 'competition_squat' || it.exercise_key === 'competition_deadlift' || !!it.slot?.families?.includes('hinge');
  return vorlage.weeks.filter((w) => !w.alternative_to).slice(0, 6).map((w, i) => w.days
    .map((d) => ({ offset: d.offset - i * 7, items: d.items.filter((it) => !unten(it)) }))
    .filter((d) => d.items.length));
}

/**
 * Pana-Prüfung eines beliebigen Programms: Top-Sätze und Back-offs mit fester Wdh-Zahl gegen die Grenzen in % vom
 * Trainingsmax; Sprünge des Top-Satzes je Übung (höchster Top-Satz der Woche) über 5 Prozentpunkte von Woche zu Woche.
 * Test- und Deload-Wochen sind ausgenommen. Trainingsmax: params.TM_BULK (Hybrid v3, Lasten über TS/TD),
 * sonst rules.generator.tm, sonst 1. Back-off ist ein Eintrag mit role backoff oder eine Gruppe mit cut = backoff (v3).
 * Der Variantenfaktor VF zählt nicht mit: Pana gilt für die nominellen Prozent der Variante.
 */
export function pruefePana(programm) {
  const params = programm.params;
  const tm = params ? params.TM_BULK ?? 1 : programm.rules?.generator?.tm ?? 1, fehler = [], hinweise = [];
  const prozent = (load, v) => {
    try {
      const werte = { S: 0, D: 0, B: 0, G: 0, [v]: 10000 };
      const env = params ? { ...ableiten(programm, werte, { inc: 1e-9 }), VF: 1 } : werte;
      return (rechneFormel(load, env, 1e-9) / 10000 / tm) * 100;
    } catch { return null; }
  };
  const variable = (load) => {
    const t = load ?? '';
    if (/\bTS\b/.test(t)) return 'S';
    if (/\bTD\b/.test(t)) return 'D';
    return ['S', 'D', 'B'].find((v) => new RegExp(`\\b${v}\\b`).test(t));
  };
  const topJeWoche = {};                       // Übung → { Woche: höchster Top-Satz in % }
  for (const w of programm.weeks) {
    if (w.typ === 'test' || w.typ === 'deload' || /deload|test|taper/i.test(w.title ?? '')) continue;
    for (const d of w.days) for (const it of d.items) {
      for (const g of it.groups) {
        const rolle = g.cut === 'backoff' ? 'backoff' : it.role;
        if (rolle !== 'top' && rolle !== 'backoff') continue;
        const v = variable(g.load), wdh = leseWdh(g.reps);
        if (!v || wdh?.min == null || wdh.min !== wdh.max) continue;
        const p = prozent(g.load, v), grenze = PANA[rolle][wdh.min];
        if (p == null) continue;
        const r = Math.round(p * 10) / 10;
        const art = rolle === 'top' ? 'Top-Satz' : 'Back-off';
        if (!grenze) hinweise.push(`W${w.week} ${it.exercise_key}: ${art} mit ${wdh.min} Wdh hat keine Pana-Grenze.`);
        else if (r < grenze[0] - 1e-9 || r > grenze[1] + 1e-9) fehler.push(`W${w.week} ${it.exercise_key}: ${art} ${wdh.min} Wdh @ ${r} % liegt außerhalb ${grenze[0]}–${grenze[1]} %.`);
        if (rolle === 'top') { const m = (topJeWoche[it.exercise_key ?? v] ??= {}); m[w.week] = Math.max(m[w.week] ?? -Infinity, r); }
      }
    }
  }
  for (const [key, m] of Object.entries(topJeWoche)) {
    const wochen = Object.keys(m).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < wochen.length; i++) {
      const sprung = m[wochen[i]] - m[wochen[i - 1]];
      if (wochen[i] === wochen[i - 1] + 1 && sprung > MAX_SPRUNG + 1e-9) {
        fehler.push(`${key}: Top-Satz springt von W${wochen[i - 1]} auf W${wochen[i]} um ${Math.round(sprung * 10) / 10} Prozentpunkte (höchstens ${MAX_SPRUNG}).`);
      }
    }
  }
  return { fehler, hinweise };
}
