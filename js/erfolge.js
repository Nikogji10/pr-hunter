// PR Hunter · Erfolge und Abzeichen (Wunsch 184, überarbeitet 03.11.): Stufen je Kategorie aus dem Trainingsverlauf.
// Kniebeuge, Bank, Kreuzheben und Total: bestes e1RM der Wettkampf-Übung (wie Statistik/Rekorde) – keine Varianten
// (Brett-, Pin-, Schräg-Bank zählten vorher mit und ergaben zu hohe Werte). Nur bei Powerlifting.
// Stufen so gewählt, dass sie für Einsteiger wie Fortgeschrittene Sinn ergeben; der Balken zeigt den Gesamtweg.
import { rekorde, wochenSerie, gesamt } from './insights.js';
import { HAUPT, kanon } from './daten.js';
import { e1rm } from './rechnen.js';

export const KATEGORIEN = [
  { id: 'trainings', icon: '💪', name: ['Trainings', 'Workouts'], stufen: [1, 10, 25, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000], text: (n) => [`${n} ${n === 1 ? 'Training' : 'Trainings'}`, `${n} ${n === 1 ? 'workout' : 'workouts'}`] },
  { id: 'tonnen', icon: '🏗️', name: ['Bewegt', 'Lifted'], stufen: [1, 10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000], text: (n) => [`${n} t bewegt`, `${n} t lifted`] },
  { id: 'serie', icon: '🔥', name: ['Serie', 'Streak'], stufen: [2, 4, 8, 12, 26, 39, 52, 78, 104, 156], text: (n) => [`${n} Wochen am Stück`, `${n}-week streak`] },
  { id: 'rekorde', icon: '🏆', name: ['Rekorde', 'PRs'], stufen: [1, 10, 25, 50, 100, 250, 500, 750, 1000, 1500], text: (n) => [`${n} Rekorde`, `${n} PRs`] },
  { id: 'stunden', icon: '⏱️', name: ['Trainingszeit', 'Time trained'], stufen: [1, 10, 25, 50, 100, 250, 500, 750, 1000, 1500], text: (n) => [`${n} Stunden`, `${n} hours`] },
  { id: 'squat', icon: '🥇', pl: true, kg: true, name: ['Kniebeuge', 'Squat'], stufen: [40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300], text: (n) => [`Kniebeuge ${n} kg`, `Squat ${n} kg`] },
  { id: 'bench', icon: '🥇', pl: true, kg: true, name: ['Bankdrücken', 'Bench'], stufen: [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200], text: (n) => [`Bankdrücken ${n} kg`, `Bench ${n} kg`] },
  { id: 'dead', icon: '🥇', pl: true, kg: true, name: ['Kreuzheben', 'Deadlift'], stufen: [60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 350], text: (n) => [`Kreuzheben ${n} kg`, `Deadlift ${n} kg`] },
  { id: 'total', icon: '🏅', pl: true, kg: true, name: ['Total', 'Total'], stufen: [150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800], text: (n) => [`Total ${n} kg`, `Total ${n} kg`] },
];

const LIFT_VON_HAUPT = (key) => Object.keys(HAUPT).find((l) => HAUPT[l] === kanon(key)) ?? null;

/** Messwerte je Kategorie (Lifts: bestes e1RM der Wettkampf-Übung aus 1–10 Wdh). */
export function erfolgsWerte(einheiten) {
  const g = gesamt(einheiten), best = { squat: 0, bench: 0, dead: 0 };
  for (const e of einheiten) for (const u of e.uebungen) {
    const l = LIFT_VON_HAUPT(u.key);
    if (l) for (const s of u.saetze) if (s.kg > 0 && s.wdh >= 1 && s.wdh <= 10) best[l] = Math.max(best[l], e1rm(s.kg, s.wdh));
  }
  for (const l of Object.keys(best)) best[l] = Math.round(best[l] * 10) / 10;
  return {
    trainings: einheiten.length,
    tonnen: einheiten.reduce((a, e) => a + e.uebungen.reduce((b, u) => b + u.saetze.reduce((c, s) => c + (s.kg > 0 ? s.kg : 0) * (s.wdh ?? 0), 0), 0), 0) / 1000,
    serie: einheiten.length ? wochenSerie(einheiten.map((e) => e.datum), einheiten.at(-1).datum).laengste : 0,
    rekorde: rekorde(einheiten).length,
    stunden: g.stunden,
    ...best,
    total: best.squat && best.bench && best.dead ? Math.round((best.squat + best.bench + best.dead) * 10) / 10 : 0,
  };
}

/** Je Kategorie: aktueller Wert, erreichte und nächste Stufe, Fortschritt über alle Stufen (0–1); dazu die Abzeichen. */
export function erfolge(einheiten, { powerlifting = true } = {}) {
  const w = erfolgsWerte(einheiten);
  const liste = KATEGORIEN.filter((k) => powerlifting || !k.pl).map((k) => {
    const wert = w[k.id] ?? 0, erreicht = k.stufen.filter((s) => wert >= s), naechste = k.stufen.find((s) => wert < s) ?? null;
    const vorher = erreicht.at(-1) ?? 0, teil = naechste ? Math.max(0, Math.min(1, (wert - vorher) / (naechste - vorher))) : 0;
    return { ...k, wert, stufe: erreicht.at(-1) ?? null, anzahl: erreicht.length, naechste,
      fortschritt: naechste ? (erreicht.length + teil) / k.stufen.length : 1 };
  });
  const abzeichen = liste.flatMap((k) => k.stufen.filter((s) => k.wert >= s).map((s) => `${k.id}-${s}`));
  return { liste, abzeichen, gesamt: liste.reduce((a, k) => a + k.stufen.length, 0) };
}

/** Abzeichen, die mit dem neuen Stand dazugekommen sind (für die Rückmeldung nach dem Training). */
export function neueAbzeichen(vorher, nachher) {
  const alt = new Set(vorher.abzeichen);
  return nachher.liste.flatMap((k) => k.stufen.filter((s) => k.wert >= s && !alt.has(`${k.id}-${s}`)).slice(-1).map((s) => ({ id: `${k.id}-${s}`, icon: k.icon, text: k.text(s) })));
}
