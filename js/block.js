// PR Hunter · Auswertungen zum laufenden Block: Soll-Ist je Woche (geplant vs. gemacht) aus den gespeicherten Trainings.
// Ein Satz trägt seine Vorgabe in `geplant` (Rolle, Wdh-Text, RPE-Bereich, kg) – siehe js/sync.js ausTraining.

const mittel = (a) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : null);
const rpeZiel = (r) => (r == null ? null : typeof r === 'number' ? r : r.max ?? r.min ?? null);

/**
 * Soll-Ist je Blockwoche. tage: Plantage aus planeBlock ({ woche, offset }); trainings: lokale Trainings.
 * Rückgabe: [{ woche, geplant, erledigt, saetze, abweichungKg, rpeIst, rpeSoll, wdhIst, wdhSoll }] in Wochenreihenfolge.
 */
export function sollIst(tage, trainings, blockId) {
  const wochen = [...new Set(tage.map((t) => t.woche))];
  const eigene = trainings.filter((t) => !t.geloescht && t.runId === blockId && t.tagOffset != null);
  return wochen.map((woche) => {
    const plan = tage.filter((t) => t.woche === woche);
    const offsets = new Set(plan.map((t) => t.offset));
    const gemacht = eigene.filter((t) => offsets.has(t.tagOffset));
    const abw = [], rpeIst = [], rpeSoll = [];
    let saetze = 0;
    for (const t of gemacht) {
      for (const u of t.uebungen ?? []) {
        for (const s of u.saetze ?? []) {
          if (s.fertig === false || s.typ === 'warmup') continue;
          saetze += 1;
          if (s.geplant?.kg > 0 && s.kg != null) abw.push(s.kg - s.geplant.kg);
          const soll = rpeZiel(s.geplant?.rpe);
          if (soll != null && s.rpe != null) { rpeIst.push(s.rpe); rpeSoll.push(soll); }
        }
      }
    }
    return { woche, geplant: plan.length, erledigt: new Set(gemacht.map((t) => t.tagOffset)).size, saetze,
      abweichungKg: mittel(abw), rpeIst: mittel(rpeIst), rpeSoll: mittel(rpeSoll) };
  });
}

export const LIFT_KEY = { S: 'competition_squat', B: 'competition_bench_press', D: 'competition_deadlift' };
const ABSCHLUSS = /deload|taper/i;

/**
 * Testwoche eines Programms: die Woche mit Test-Sätzen (role test), sonst eine Woche „Test“ oder „High Intensity“
 * (Candito: Projektion aus Woche 5), sonst die letzte Woche vor Deload/Taper.
 */
export function testWoche(programm) {
  const mitTest = programm.weeks.find((w) => w.days.some((d) => d.items.some((i) => i.role === 'test')));
  if (mitTest) return mitTest.week;
  const benannt = programm.weeks.find((w) => !ABSCHLUSS.test(w.title ?? '') && /\btest\b|high intensity/i.test(w.title ?? ''));
  if (benannt) return benannt.week;
  const ohneAbschluss = programm.weeks.filter((w) => !w.alternative_to && !ABSCHLUSS.test(w.title ?? '') && w.typ !== 'deload');
  return ohneAbschluss.at(-1)?.week ?? null;
}

/** Bester erledigter Satz je Lift (S/B/D) in der Testwoche des Blocks: höchstes Gewicht, bei Gleichstand mehr Wdh. */
export function testErgebnisse(programm, blockId, trainings, woche = testWoche(programm)) {
  const aus = {};
  if (woche == null) return aus;
  for (const t of trainings) {
    if (t.geloescht || t.runId !== blockId || t.woche !== woche) continue;
    for (const u of t.uebungen ?? []) {
      const lift = Object.entries(LIFT_KEY).find(([, k]) => k === u.key)?.[0];
      if (!lift) continue;
      for (const s of u.saetze ?? []) {
        if (s.fertig === false || s.typ === 'warmup' || !(s.kg > 0) || !(s.wdh > 0)) continue;
        const b = aus[lift];
        if (!b || s.kg > b.kg || (s.kg === b.kg && s.wdh > b.wdh)) aus[lift] = { kg: s.kg, wdh: s.wdh, datum: t.datum };
      }
    }
  }
  return aus;
}

/**
 * Neue Maxe nach der Projektionsregel des Programms (rules.projection) aus den Testergebnissen. Generator-Blöcke mit
 * Candito-Bankdrücken haben für die Bank eine eigene Regel (rules.projection_bench mit week und lift).
 */
export function neueMaxe(programm, block, trainings, projiziere, inc = 2.5, { vertrauen = null } = {}) {
  const bank = programm.rules?.projection_bench, aus = {};
  const regeln = [[programm.rules?.projection, testWoche(programm), null], [bank, bank?.week, bank?.lift]];
  for (const [regel, woche, nur] of regeln) {
    if (!regel || woche == null) continue;
    for (const [lift, e] of Object.entries(testErgebnisse(programm, block.id, trainings, woche))) {
      if (nur ? lift !== nur : bank && lift === bank.lift) continue;
      const r = projiziere(regel, { kg: e.kg, wdh: e.wdh, altesMax: block.werte?.[lift] ?? null, lift, inc, vertrauen });
      aus[lift] = { ...e, alt: block.werte?.[lift] ?? null, projiziert: r?.projiziert ?? null, neuesMax: r?.neuesMax ?? null };
    }
  }
  return aus;
}

/** Plantage mit verschobenen und übersprungenen Tagen aus den Block-Optionen. */
export function tageMitOptionen(tage, block) {
  const verschoben = block?.verschoben ?? {}, weg = new Set(block?.uebersprungen ?? []);
  return tage.map((t) => ({ ...t, ...(verschoben[t.offset] ? { datum: verschoben[t.offset], verschoben: true } : {}), ...(weg.has(t.offset) ? { uebersprungen: true } : {}) }))
    .sort((a, b) => (a.datum ?? '').localeCompare(b.datum ?? '') || a.offset - b.offset);
}

/** RPE-Trend je Kalenderwoche über alle Trainings: Ø RPE der Arbeitssätze mit RPE und Ø Ziel-RPE, wo eines geplant war. */
export function rpeTrend(wochen, trainings) {
  const index = new Map(wochen.map((w, i) => [w, i]));
  const ist = wochen.map(() => []), soll = wochen.map(() => []);
  const montag = (iso) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  for (const t of trainings) {
    if (t.geloescht) continue;
    const i = index.get(montag(t.datum));
    if (i == null) continue;
    for (const u of t.uebungen ?? []) for (const s of u.saetze ?? []) {
      if (s.fertig === false || s.typ === 'warmup' || s.rpe == null) continue;
      ist[i].push(s.rpe);
      const z = rpeZiel(s.geplant?.rpe);
      if (z != null) soll[i].push(z);
    }
  }
  return { ist: ist.map(mittel), soll: soll.map(mittel) };
}
