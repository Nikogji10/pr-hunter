// PR Hunter · Tempo-Statistik (Wunsch 279) aus Sätzen mit Hantel-Tempo (Satz-Video oder Feld „Tempo (m/s)“).
// 1. Gewicht ↔ Tempo (Load-Velocity-Profil): Gerade durch das Tempo der schnellsten Wdh je Satz, e1RM = Gewicht, bei dem die
//    Gerade das Mindesttempo (MVT) erreicht. MVT-Richtwerte aus der VBT-Literatur (Kniebeuge ~0,30, Bank ~0,17,
//    Kreuzheben ~0,15 m/s) – individuell verschieden, daher als Schätzung.
// 2. Gefühlte RPE ↔ Tempo der letzten Wdh.
// 3. Tempo beim häufigsten Gewicht über die Zeit (gleiche Last schneller = stärker).
export const MVT = { squat: 0.3, bench: 0.17, dead: 0.15 };

/** Sätze mit Tempo aus Trainingstagen: [{ datum, key, lift, kg, wdh, rpe, beste, letzte, verlust }]. */
export function tempoSaetze(tage) {
  const aus = [];
  for (const t of tage) for (const u of t.uebungen ?? []) for (const s of u.saetze ?? []) {
    const v = s.extra?.tempo?.v?.length ? s.extra.tempo.v : s.extra?.ms > 0 ? [s.extra.ms] : null;
    if (!v || !((s.last ?? s.kg) > 0)) continue;
    aus.push({ datum: t.datum, key: u.key, lift: u.lift, kg: s.last ?? s.kg, wdh: s.wdh, rpe: s.rpe ?? null,
      beste: Math.max(...v), letzte: v.at(-1), verlust: s.extra?.tempo?.vl ?? null });
  }
  return aus;
}

/** Lineare Regression y = a + b·x → { a, b, r2 } oder null (zu wenig Punkte oder keine Streuung). */
export function gerade(punkte) {
  const n = punkte.length;
  if (n < 2) return null;
  const mx = punkte.reduce((s, p) => s + p.x, 0) / n, my = punkte.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of punkte) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; }
  if (!(sxx > 0)) return null;
  const b = sxy / sxx, a = my - b * mx;
  return { a, b, r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 1 };
}

/**
 * Load-Velocity-Profil: saetze [{ kg, beste }], mvt in m/s. Mindestens 3 Sätze, Gewichtsspanne ≥ 10 % und fallende Gerade.
 * Rückgabe { a, b, r2, e1rm (kg, auf 0,5) } oder { fehlt: 'saetze' | 'spanne' | 'steigung' }.
 */
export function lastTempoProfil(saetze, mvt) {
  if (saetze.length < 3) return { fehlt: 'saetze' };
  const kg = saetze.map((s) => s.kg), lo = Math.min(...kg), hi = Math.max(...kg);
  if (hi < lo * 1.1) return { fehlt: 'spanne' };
  const g = gerade(saetze.map((s) => ({ x: s.kg, y: s.beste })));
  if (!g || g.b >= 0) return { fehlt: 'steigung' };
  const e1rm = mvt > 0 ? Math.round(((mvt - g.a) / g.b) * 2) / 2 : null;
  return { ...g, e1rm: e1rm > hi * 0.9 && e1rm < hi * 2 ? e1rm : null };
}

/** RPE ↔ Tempo der letzten Wdh: Punkte und Gerade (ab 3 Sätzen mit RPE). */
export function rpeTempo(saetze) {
  const p = saetze.filter((s) => s.rpe != null && s.letzte > 0).map((s) => ({ x: s.letzte, y: s.rpe }));
  return { punkte: p, gerade: p.length >= 3 ? gerade(p) : null };
}

/** Häufigstes Gewicht (auf 2,5 kg) und je Tag das beste Tempo damit: { kg, reihe: [{ datum, v }] } oder null. */
export function tempoBeiGewicht(saetze) {
  if (!saetze.length) return null;
  const zaehl = {};
  for (const s of saetze) { const k = Math.round(s.kg / 2.5) * 2.5; zaehl[k] = (zaehl[k] ?? 0) + 1; }
  const kg = Number(Object.entries(zaehl).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0][0]);
  const jeTag = {};
  for (const s of saetze) if (Math.abs(s.kg - kg) <= 1.25) jeTag[s.datum] = Math.max(jeTag[s.datum] ?? 0, s.beste);
  const reihe = Object.entries(jeTag).sort(([a], [b]) => a.localeCompare(b)).map(([datum, v]) => ({ datum, v }));
  return reihe.length ? { kg, reihe } : null;
}
