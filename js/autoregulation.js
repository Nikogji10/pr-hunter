// PR Hunter · Autoregulation für Zubehörübungen (Wunsch 183, Option, standardmäßig aus): Gewicht der nächsten Einheit
// aus der RPE der letzten, Deload-Vorschlag, wenn die Leistung dreimal hintereinander fällt. Kniebeuge, Bankdrücken und
// Kreuzheben (samt Wettkampf-Varianten) steuert weiter der Plan.
import { e1rm, mround } from './rechnen.js';

const bester = (sitzung) => sitzung.saetze.filter((s) => s.kg > 0 && s.wdh > 0).sort((a, b) => b.kg - a.kg || b.wdh - a.wdh)[0] ?? null;

/**
 * sitzungen: Einheiten einer Übung, älteste zuerst: [{ datum, saetze: [{ kg, wdh, rpe }] }] (nur Arbeitssätze).
 * ziel: { rpe (Ziel-RPE, Standard 8), wdhOben (obere Wdh-Zahl der Vorgabe), inc (Gewichtsschritt) }.
 * Rückgabe: { kg, art: 'mehr' | 'halten' | 'weniger' | 'deload', text: [de, en] } oder null (zu wenig Daten).
 */
export function autoregulation(sitzungen, { rpe: zielRpe = 8, wdhOben = null, inc = 2.5 } = {}) {
  const mit = sitzungen.filter((s) => bester(s));
  if (!mit.length) return null;
  const letzte = bester(mit.at(-1));
  // Leistung fällt: bestes e1RM der letzten drei Einheiten jedes Mal niedriger und zusammen mindestens 5 %
  const e = mit.slice(-3).map((s) => e1rm(bester(s).kg, bester(s).wdh));
  if (e.length === 3 && e[1] < e[0] && e[2] < e[1] && e[2] <= e[0] * 0.95) {
    return { kg: mround(letzte.kg * 0.9, inc), art: 'deload', text: ['Leistung 3× gefallen – Deload −10 %', 'Performance dropped 3× – deload −10 %'] };
  }
  const rpes = mit.at(-1).saetze.map((s) => s.rpe).filter((r) => r != null);
  if (rpes.length) {
    const r = Math.max(...rpes), d = zielRpe - r;
    if (d >= 1.5) return { kg: mround(letzte.kg + 2 * inc, inc), art: 'mehr', text: [`Zuletzt RPE ${r} – zwei Schritte mehr`, `Last RPE ${r} – two steps up`] };
    if (d >= 0.5) return { kg: mround(letzte.kg + inc, inc), art: 'mehr', text: [`Zuletzt RPE ${r} – ein Schritt mehr`, `Last RPE ${r} – one step up`] };
    if (d <= -1) return { kg: Math.max(inc, mround(letzte.kg - inc, inc)), art: 'weniger', text: [`Zuletzt RPE ${r} – ein Schritt weniger`, `Last RPE ${r} – one step down`] };
    return { kg: letzte.kg, art: 'halten', text: [`Zuletzt RPE ${r} – Gewicht halten`, `Last RPE ${r} – keep the weight`] };
  }
  // ohne RPE: obere Wdh-Zahl geschafft → mehr, sonst halten
  if (wdhOben && letzte.wdh >= wdhOben) return { kg: mround(letzte.kg + inc, inc), art: 'mehr', text: [`Zuletzt ${letzte.wdh} Wdh geschafft – ein Schritt mehr`, `Hit ${letzte.wdh} reps last time – one step up`] };
  return { kg: letzte.kg, art: 'halten', text: ['Gewicht von zuletzt halten', 'Keep last time\'s weight'] };
}
