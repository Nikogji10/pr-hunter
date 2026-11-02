// PR Hunter · Erfolge und Abzeichen (Wunsch 184): Stufen je Kategorie, berechnet aus dem Trainingsverlauf (normiert wie
// in js/insights.js). Kniebeuge, Bank, Kreuzheben (schwerster Satz) nur bei Powerlifting.
import { rekorde, wochenSerie, gesamt } from './insights.js';

export const KATEGORIEN = [
  { id: 'trainings', icon: '💪', name: ['Trainings', 'Workouts'], stufen: [1, 10, 25, 50, 100, 250, 500, 1000], text: (n) => [`${n} ${n === 1 ? 'Training' : 'Trainings'}`, `${n} ${n === 1 ? 'workout' : 'workouts'}`] },
  { id: 'tonnen', icon: '🏗️', name: ['Bewegt', 'Lifted'], stufen: [10, 100, 500, 1000, 2500, 5000], text: (n) => [`${n} t bewegt`, `${n} t lifted`] },
  { id: 'serie', icon: '🔥', name: ['Serie', 'Streak'], stufen: [4, 10, 26, 52, 104], text: (n) => [`${n} Wochen am Stück`, `${n}-week streak`] },
  { id: 'rekorde', icon: '🏆', name: ['Rekorde', 'PRs'], stufen: [10, 50, 100, 250, 500], text: (n) => [`${n} Rekorde`, `${n} PRs`] },
  { id: 'stunden', icon: '⏱️', name: ['Trainingszeit', 'Time trained'], stufen: [10, 50, 100, 250, 500], text: (n) => [`${n} Stunden`, `${n} hours`] },
  { id: 'squat', icon: '🥇', pl: true, name: ['Kniebeuge', 'Squat'], stufen: [100, 140, 180, 200, 220, 250, 300], text: (n) => [`Kniebeuge ${n} kg`, `Squat ${n} kg`] },
  { id: 'bench', icon: '🥇', pl: true, name: ['Bankdrücken', 'Bench'], stufen: [60, 80, 100, 120, 140, 160, 200], text: (n) => [`Bankdrücken ${n} kg`, `Bench ${n} kg`] },
  { id: 'dead', icon: '🥇', pl: true, name: ['Kreuzheben', 'Deadlift'], stufen: [100, 140, 180, 200, 250, 300], text: (n) => [`Kreuzheben ${n} kg`, `Deadlift ${n} kg`] },
];

/** Messwerte je Kategorie. liftVon(key) → 'squat' | 'bench' | 'dead' | 'andere'. */
export function erfolgsWerte(einheiten, liftVon = () => 'andere') {
  const g = gesamt(einheiten), best = { squat: 0, bench: 0, dead: 0 };
  for (const e of einheiten) for (const u of e.uebungen) {
    const l = liftVon(u.key);
    if (l in best) for (const s of u.saetze) if (s.wdh >= 1 && s.kg > best[l]) best[l] = s.kg;
  }
  return {
    trainings: einheiten.length,
    tonnen: einheiten.reduce((a, e) => a + e.uebungen.reduce((b, u) => b + u.saetze.reduce((c, s) => c + (s.kg > 0 ? s.kg : 0) * (s.wdh ?? 0), 0), 0), 0) / 1000,
    serie: einheiten.length ? wochenSerie(einheiten.map((e) => e.datum), einheiten.at(-1).datum).laengste : 0,
    rekorde: rekorde(einheiten).length,
    stunden: g.stunden,
    ...best,
  };
}

/** Je Kategorie: erreichte Stufe, nächste Stufe, Fortschritt (0–1); dazu alle erreichten Abzeichen-Kennungen. */
export function erfolge(einheiten, { liftVon, powerlifting = true } = {}) {
  const w = erfolgsWerte(einheiten, liftVon);
  const liste = KATEGORIEN.filter((k) => powerlifting || !k.pl).map((k) => {
    const wert = w[k.id] ?? 0, erreicht = k.stufen.filter((s) => wert >= s), naechste = k.stufen.find((s) => wert < s) ?? null;
    const vorher = erreicht.at(-1) ?? 0;
    return { ...k, wert, stufe: erreicht.at(-1) ?? null, anzahl: erreicht.length, naechste,
      fortschritt: naechste ? Math.max(0, Math.min(1, (wert - vorher) / (naechste - vorher))) : 1 };
  });
  const abzeichen = liste.flatMap((k) => k.stufen.filter((s) => k.wert >= s).map((s) => `${k.id}-${s}`));
  return { liste, abzeichen, gesamt: liste.reduce((a, k) => a + k.stufen.length, 0) };
}

/** Abzeichen, die mit dem neuen Stand dazugekommen sind (für die Rückmeldung nach dem Training). */
export function neueAbzeichen(vorher, nachher) {
  const alt = new Set(vorher.abzeichen);
  return nachher.liste.flatMap((k) => k.stufen.filter((s) => k.wert >= s && !alt.has(`${k.id}-${s}`)).slice(-1).map((s) => ({ id: `${k.id}-${s}`, icon: k.icon, text: k.text(s) })));
}
