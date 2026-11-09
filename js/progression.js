// PR Hunter · Progression je Übung (Wünsche 255/256, 09.11.2026). Ein eigener Plan ist eine Musterwoche plus Wochenzahl;
// jede Übung trägt ihre Progression, die App rechnet daraus die Wochen aus:
//   fest – jede Woche gleich (wie bisher), in einer Deload-Woche halbe Sätze
//   bb   – Wdh-Bereich + RPE wie der Bodybuilding-Generator: Grundübungen RPE 7–8 → 9–9,5, Isolationen RPE 9 (letzter
//          Satz bis 10, Spitze 10), ab der zweiten Hälfte ein Satz mehr, Deload halbe Sätze @ RPE 6–7
//   pl   – Top-Satz/Back-off nach den Wochentypen des Block-Generators (Pana-geprüft, js/generator.js), Rolle je Übung:
//          schwer (Top-Satz + Back-offs), variation (dasselbe mit 90 % der Last, Variationen rotieren), leicht (Technik)
//   candito – Platzhalter für Advanced Bench: die Bankeinheiten kommen Woche für Woche aus der Candito-Vorlage
// Der Powerlifting-Generator (plMusterwoche) erzeugt genau so eine Musterwoche – danach lässt sie sich frei ergänzen.
import { WOCHENTYPEN, TEST, DELOAD, TECHNIK, KH_LEICHT, BANK_LEICHT, WELLE, wochenFolge, canditoWochen, pruefePana } from './generator.js';

/** Wochentage je Anzahl Trainingstage (Offsets ab Montag), Pausen verteilt. */
export const WOCHENTAGE = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
export const FORTLAUFEND = 52;                               // „fortlaufend“ = ein Jahr, nur ohne Progression
export const HAUPT_KEY = { S: 'competition_squat', B: 'competition_bench_press', D: 'competition_deadlift' };
export const VF_VARIATION = 0.9;                             // Variation: Top-Satz/Back-off mit 90 % der Last des Wettkampflifts
const RAMPE = ['7-8', '8', '8.5', '9', '9-9.5'];             // RPE der Grundübungen über die Aufbauwochen (wie Bodybuilding)
const ISO = new Set(['curl', 'shoulder_iso', 'triceps', 'leg_iso', 'fly', 'forearm', 'core', 'neck', 'shrug']);
const RANG = { schwer: 0, candito: 0, variation: 1, leicht: 2 };
const LIFT_FOLGE = { S: 0, B: 1, D: 2 };

/** Isolationsübung (für die Bodybuilding-Progression) nach der Familie im Katalog. */
export const istIsolation = (familie) => ISO.has(familie);

/** RPE einer Grundübung in Aufbauwoche i von n. */
export const bbRpe = (i, n) => (n <= 1 ? '8' : RAMPE[Math.round((i * (RAMPE.length - 1)) / (n - 1))]);

/** Hat die Musterwoche Progression? { pl, bb, candito } */
export function arten(tage) {
  const alle = tage.flatMap((t) => t.uebungen);
  return { pl: alle.some((u) => u.prog === 'pl'), bb: alle.some((u) => u.prog === 'bb'), candito: alle.some((u) => u.prog === 'candito') };
}

/** Wochenfolge: mit Powerlifting die des Generators (Einstieg … Peak, Test/Deload), sonst Aufbau + Deload. */
export function wochenPlan(wochen, { pl = false, bb = false, abschluss = 'test' } = {}) {
  if (pl) return wochenFolge(wochen, { abschluss });
  const deload = bb && abschluss !== 'keiner' && wochen > 1;
  return Array.from({ length: wochen }, (_, i) => ({ typ: deload && i === wochen - 1 ? 'deload' : 'aufbau', welle: 0 }));
}

const zahl = (x) => Math.round(x * 1000) / 1000;
const last = (v, tm, p, vf = 1) => `R(${v}*${zahl(tm * vf)}*${zahl(p / 100)})`;
const gruppe = ([sets, reps, , rpe], load, note = null) => ({ sets: String(sets), reps: String(reps), load, rpe, ...(note ? { note } : {}) });
const rpeText = (r) => (r ? `RPE ${String(r).replace(',', '.').replace(/^RPE\s*/i, '')}` : null);

/** Einträge einer Powerlifting-Übung in einer Woche (null = fällt in dieser Woche weg). */
function plEintraege(u, key, w, tm) {
  const v = u.lift ?? 'S', kh = v === 'D', rolle = u.rolle ?? 'schwer';
  if (w.typ === 'test') {
    if (rolle === 'schwer') return [{ exercise_key: key, role: 'test', groups: [gruppe(TEST.test, `R(${v}*${zahl(TEST.test[2] / 100)})`, TEST.notiz)] }];
    if (rolle === 'variation') return [{ exercise_key: key, role: 'secondary', groups: [gruppe(TEST.var, last(v, tm, TEST.var[2], VF_VARIATION))] }];
    return null;
  }
  if (w.typ === 'deload') {
    if (rolle === 'leicht') return null;
    const a = rolle === 'schwer' ? (kh ? DELOAD.d1 : DELOAD.s1) : (kh ? DELOAD.d2 : DELOAD.s2);
    return [{ exercise_key: key, role: null, groups: [gruppe(a, last(v, tm, a[2], rolle === 'schwer' ? 1 : VF_VARIATION))] }];
  }
  const t = WOCHENTYPEN[w.typ], plus = (w.welle ?? 0) * WELLE;
  const mit = (a) => [a[0], a[1], a[2] + plus, a[3]];
  const top = mit(kh ? t.dTop : t.top), bo = mit(kh ? t.dBackoff : t.backoff);
  if (rolle === 'schwer') return [{ exercise_key: key, role: 'top', groups: [gruppe(top, last(v, tm, top[2]))] },
    { exercise_key: key, role: 'backoff', groups: [gruppe(bo, last(v, tm, bo[2]))] }];
  if (rolle === 'variation') return [{ exercise_key: key, role: 'secondary',
    groups: [gruppe(top, last(v, tm, top[2], VF_VARIATION), 'Top-Satz'), gruppe(bo, last(v, tm, bo[2], VF_VARIATION), 'Back-off')] }];
  const a = kh ? KH_LEICHT : v === 'B' ? BANK_LEICHT : TECHNIK;
  return [{ exercise_key: key, role: 'secondary', groups: [gruppe(a, last(v, tm, a[2]), 'Leicht – Technik')] }];
}

/** Gruppe einer Übung mit fester oder Bodybuilding-Progression. */
function satzGruppe(u, w, bbIdx, bbAnzahl) {
  const s = Math.max(1, Number(u.saetze) || 3);
  const reps = String(u.wdh || (u.prog === 'bb' ? (u.iso ? '8-12' : '6-10') : '8-12'));
  if (w.typ === 'deload' || w.typ === 'test') return { sets: String(Math.max(1, Math.ceil(s / 2))), reps, rpe: 'RPE 6-7', note: 'Deload – locker, Technik' };
  if (u.prog !== 'bb') return { sets: String(s), reps, rpe: rpeText(u.rpe) };
  const spitze = bbAnzahl > 1 && bbIdx === bbAnzahl - 1, zweite = bbAnzahl > 1 && bbIdx >= Math.ceil(bbAnzahl / 2);
  const sets = zweite ? Math.min(s + 1, Math.max(s, 4)) : s;
  if (u.iso) return { sets: String(sets), reps, rpe: spitze ? 'RPE 10' : 'RPE 9', ...(spitze ? {} : { note: 'Letzter Satz bis RPE 10' }) };
  return { sets: String(sets), reps, rpe: `RPE ${bbRpe(bbIdx, bbAnzahl)}` };
}

const TITEL = { test: 'Test', deload: 'Deload' };

/**
 * Programm im App-Format aus der Musterwoche. e: { name, wochen, tage: [{ name, wt?, uebungen: [{ key, saetze, wdh, rpe,
 * prog ('fest'|'bb'|'pl'|'candito'), rolle, lift ('S'|'B'|'D'), iso, rotation [keys], slot, slots }] }], abschluss
 * ('test'|'deload'|'keiner'), tm, canditoVorlage }.
 */
export function eigenerPlanAus(e) {
  const tage = e.tage ?? [], art = arten(tage), progressiv = art.pl || art.bb || art.candito;
  const wochen = progressiv ? Math.min(12, Math.max(art.pl ? 2 : 1, e.wochen ?? 6)) : Math.max(1, e.wochen ?? 6);
  const abschluss = e.abschluss ?? (art.pl ? 'test' : 'deload'), tm = e.tm ?? 0.95;
  const folge = progressiv ? wochenPlan(wochen, { ...art, abschluss: art.pl ? abschluss : abschluss === 'test' ? 'deload' : abschluss }) : Array.from({ length: wochen }, () => ({ typ: 'aufbau', welle: 0 }));
  const aufbau = folge.filter((w) => w.typ !== 'test' && w.typ !== 'deload').length;
  const candito = art.candito ? canditoWochen(e.canditoVorlage, wochen) : null;
  const offsets = tage.every((t) => Number.isInteger(t.wt)) ? tage.map((t) => t.wt) : WOCHENTAGE[tage.length] ?? WOCHENTAGE[3];
  let bbIdx = -1;
  const weeks = folge.map((w, i) => {
    if (w.typ !== 'test' && w.typ !== 'deload') bbIdx++;
    const days = tage.map((t, ti) => ({ offset: i * 7 + offsets[ti], label: t.name, items: t.uebungen.flatMap((u) => {
      const key = u.rotation?.length ? u.rotation[(i * (u.slots ?? 1) + (u.slot ?? 0)) % u.rotation.length] : u.key;
      if (u.prog === 'candito') return [];                        // kommt unten aus der Vorlage
      if (u.prog === 'pl') return plEintraege(u, key, w, tm) ?? [];
      return [{ exercise_key: key, role: null, groups: [satzGruppe(u, w, bbIdx, aufbau)] }];
    }) }));
    if (candito) {
      // Advanced Bench: k-ter Bank-Tag der Vorlage → k-ter Tag mit Platzhalter (überzählige an den letzten)
      const ziele = tage.map((t, ti) => (t.uebungen.some((u) => u.prog === 'candito') ? ti : -1)).filter((x) => x >= 0);
      [...candito[i]].sort((a, b) => a.offset - b.offset).forEach((d, k) => days[ziele[Math.min(k, ziele.length - 1)]].items.push(...structuredClone(d.items)));
    }
    const titel = art.pl ? TITEL[w.typ] ?? WOCHENTYPEN[w.typ].titel + (w.welle ? ` (Welle ${w.welle + 1}, +${w.welle * WELLE} %)` : '')
      : progressiv ? (w.typ === 'deload' ? 'Deload' : bbIdx === aufbau - 1 && aufbau > 1 ? 'Spitze' : bbIdx === 0 ? 'Einstieg' : 'Aufbau') : null;
    const woche = { week: i + 1, title: titel ? `Woche ${i + 1} – ${titel}` : `Woche ${i + 1}`, typ: w.typ, days: days.filter((d) => d.items.length) };
    if (art.pl && WOCHENTYPEN[w.typ]?.notiz && woche.days[0]) woche.days[0].notes = [WOCHENTYPEN[w.typ].notiz];
    return woche;
  });
  const lifte = new Set(tage.flatMap((t) => t.uebungen).filter((u) => u.prog === 'pl').map((u) => u.lift ?? 'S'));
  if (candito) { lifte.add('B'); lifte.add('G'); }
  const inputs = ['S', 'D', 'B', 'G'].filter((l) => lifte.has(l));
  const programm = {
    id: `eigen-${Date.now()}`, name: e.name || `Eigener Plan ${tage.length}×/Woche`,
    source: progressiv ? 'Eigener Plan mit Progression je Übung' : 'Eigener Plan', kategorie: art.pl || art.candito ? 'powerlifting' : art.bb ? 'bodybuilding' : 'eigen',
    inputs, weeks, settings: { cut_mode: { reduce_sets: 1, min_sets: 1 } },
    rules: { eigen: { wochen, tage: tage.length, abschluss, tm, muster: structuredClone(tage) },
      ...(art.pl && abschluss === 'test' ? { projection: { method: 'divide', table: { 1: 1, 2: 0.96, 3: 0.92, 4: 0.89, 5: 0.86, 6: 0.84, 7: 0.81 }, round_to: 'inc', min_reps: 2,
        max_increase: { S: 0.02, D: 0.02 }, source: 'Wie im Block-Generator: MROUND(Testgewicht ÷ %1RM; inc), unter 2 Wdh altes Max, Kniebeuge/Kreuzheben höchstens +2 %.' } } : {}) },
  };
  if (candito) programm.rules.projection_bench = { ...e.canditoVorlage.rules.projection, week: wochen - 1, lift: 'B' };
  return programm;
}

/** Pana-Prüfung des fertigen Plans (Top-Satz/Back-off der schweren Einheiten). */
export const pruefeEigenen = (programm) => pruefePana(programm);

/**
 * Powerlifting-Generator: Musterwoche aus der Häufigkeit je Lift (0–5) und den Variationen. Je Lift: 1. Einheit schwer
 * (Wettkampfübung, Top-Satz + Back-offs), 2. und 3. Variation (gewählte Variationen rotieren, ohne Wahl der Wettkampflift
 * mit 90 %), ab der 4. leicht (Technik). Schwere Kniebeuge und schweres Kreuzheben an verschiedenen Tagen, Einheiten
 * gleichmäßig über die Woche. bank: 'top' | 'candito' (Advanced Bench – proWoche.B = Bank-Tage der Vorlage).
 * Rückgabe: Tage [{ uebungen }] (Namen setzt die Oberfläche).
 */
export function plMusterwoche({ proWoche = {}, varianten = {}, tage = null, bank = 'top' } = {}) {
  const n = Object.fromEntries(['S', 'B', 'D'].map((l) => [l, Math.max(0, Math.min(5, Math.round(proWoche[l] ?? 0)))]));
  const T = Math.max(1, Math.min(6, Math.max(tage ?? 0, n.S, n.B, n.D, 1)));
  const inhalt = Array.from({ length: T }, () => []);
  const schwerUnten = new Set();
  for (const l of ['D', 'S', 'B']) {
    if (!n[l]) continue;
    let best = null;
    for (let s = 0; s < T; s++) {
      const tl = [...new Set(Array.from({ length: n[l] }, (_, i) => (s + Math.floor((i * T) / n[l])) % T))];
      if (tl.length < n[l]) continue;
      for (let r = 0; r < tl.length; r++) {
        const reihe = [...tl.slice(r), ...tl.slice(0, r)];
        let kosten = reihe.reduce((a, d) => a + inhalt[d].length, 0) + r * 0.01 + s * 0.001;
        if (l !== 'B' && schwerUnten.has(reihe[0])) kosten += 10;
        if (!best || kosten < best.kosten) best = { kosten, reihe };
      }
    }
    const V = (varianten[l] ?? []).filter(Boolean), slots = Math.min(Math.max(0, n[l] - 1), 2);
    best.reihe.forEach((d, i) => {
      if (l === 'B' && bank === 'candito') { inhalt[d].push({ key: HAUPT_KEY.B, prog: 'candito', rolle: 'candito', lift: 'B' }); return; }
      if (i === 0) { inhalt[d].push({ key: HAUPT_KEY[l], prog: 'pl', rolle: 'schwer', lift: l }); if (l !== 'B') schwerUnten.add(d); return; }
      if (i <= 2) {
        const j = i - 1;
        inhalt[d].push(V.length ? { key: V[j % V.length], prog: 'pl', rolle: 'variation', lift: l, ...(V.length > 1 ? { rotation: V, slot: j, slots } : {}) }
          : { key: HAUPT_KEY[l], prog: 'pl', rolle: 'variation', lift: l });
        return;
      }
      inhalt[d].push({ key: HAUPT_KEY[l], prog: 'pl', rolle: 'leicht', lift: l });
    });
  }
  for (const t of inhalt) t.sort((a, b) => RANG[a.rolle] - RANG[b.rolle] || LIFT_FOLGE[a.lift] - LIFT_FOLGE[b.lift]);
  return inhalt.map((uebungen, i) => ({ wt: WOCHENTAGE[T][i], uebungen }));
}

/**
 * Plan-Voreinstellung (256): belegt die Progression jeder Übung vor. modus: 'keine' | 'bb' | 'pl' | 'beides'.
 * info(key) → { lift: 'S'|'B'|'D'|null, iso, wettkampf } aus dem Katalog. Powerlifting: Lifts Top-Satz/Back-off (erste
 * Einheit des Lifts in der Woche schwer, weitere Variation), übriges fest; Beides: übriges Bodybuilding.
 */
export function progressionSetzen(tage, modus, info) {
  const gesehen = new Set();
  return tage.map((t) => ({ ...t, uebungen: t.uebungen.map((u) => {
    if (u.prog === 'candito') return u;
    const i = info(u.key) ?? {}, basis = { ...u, iso: !!i.iso };
    delete basis.rolle; delete basis.lift; delete basis.rotation; delete basis.slot; delete basis.slots;
    if ((modus === 'pl' || modus === 'beides') && i.lift) {
      const rolle = gesehen.has(i.lift) || !i.wettkampf ? 'variation' : 'schwer';
      gesehen.add(i.lift);
      return { ...basis, prog: 'pl', rolle, lift: i.lift, ...(u.rotation ? { rotation: u.rotation, slot: u.slot, slots: u.slots } : {}) };
    }
    return { ...basis, prog: modus === 'bb' || modus === 'beides' ? 'bb' : 'fest' };
  }) }));
}
