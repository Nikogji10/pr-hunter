// PR Hunter · Plateau-Hilfe (Wunsch 208): Stillstand der wichtigsten Übungen (die meistgenutzten der letzten 12 Wochen)
// mit konkretem Vorschlag je Übungsart. Wochenbestwert e1RM (ohne RPE) über 26 Wochen, Stillstand = seit mindestens 4
// Trainingswochen kein neuer Bestwert (im Cut 8 – dort ist Halten schon gut).
import { e1rm } from './rechnen.js';
import { plateau } from './auswertung.js';

const WOCHE = 7 * 864e5;
const montag = (iso) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.getTime(); };

/**
 * einheiten: normierte Trainings ([{ datum, uebungen: [{ key, saetze: [{ kg, wdh, typ }] }] }]).
 * istIso(key) → Isolation? Rückgabe: [{ key, wochen, best, art: 'grund' | 'iso', vorschlag: [de, en] }], wichtigste zuerst.
 */
export function stillstaende(einheiten, { heute, istIso = () => false, cut = false, anzahl = 6 } = {}) {
  const jetzt = montag(heute), ab12 = jetzt - 12 * WOCHE, ab26 = jetzt - 26 * WOCHE;
  const haeufig = new Map(), reihen = new Map();
  for (const e of einheiten) {
    const m = montag(e.datum);
    if (m < ab26) continue;
    for (const u of e.uebungen) {
      if (m >= ab12) haeufig.set(u.key, (haeufig.get(u.key) ?? 0) + 1);
      const best = Math.max(-Infinity, ...u.saetze.filter((s) => s.typ !== 'warmup' && s.kg > 0 && s.wdh > 0 && s.wdh <= 15).map((s) => e1rm(s.kg, s.wdh)));
      if (!Number.isFinite(best)) continue;
      const w = Math.round((m - ab26) / WOCHE), r = reihen.get(u.key) ?? Array(27).fill(null);
      r[w] = Math.max(r[w] ?? -Infinity, best);
      reihen.set(u.key, r);
    }
  }
  const wichtig = [...haeufig.entries()].filter(([k, n]) => n >= 4 && reihen.has(k)).sort((a, b) => b[1] - a[1]).slice(0, anzahl).map(([k]) => k);
  return wichtig.map((key) => {
    const p = plateau(reihen.get(key), { wochen: cut ? 8 : 4 });
    if (!p.plateau) return null;
    const iso = istIso(key);
    const vorschlag = cut ? ['Im Cut ist Halten schon ein Erfolg – Technik sauber halten, nach dem Cut wieder steigern.', 'In a cut, holding is already a win – keep technique clean, push again after the cut.']
      : iso ? ['2 Sätze mehr pro Woche oder eine andere Variante (Kabel statt Kurzhantel), 10–15 Wdh bis kurz vor Versagen.', '2 more sets per week or another variation (cable instead of dumbbell), 10–15 reps close to failure.']
      : p.wochenOhneRekord >= 8 ? ['Eine Deload-Woche, danach 4 Wochen eine Variante (Pause, Tempo) mit niedrigerem Wdh-Bereich.', 'One deload week, then 4 weeks of a variation (pause, tempo) with a lower rep range.']
      : ['Wdh-Bereich wechseln (z. B. 3–5 statt 6–8) oder eine Variante (Pause, Pins) für 4 Wochen einbauen.', 'Change the rep range (e.g. 3–5 instead of 6–8) or add a variation (pause, pins) for 4 weeks.'];
    return { key, wochen: p.wochenOhneRekord, best: p.best, art: iso ? 'iso' : 'grund', vorschlag };
  }).filter(Boolean);
}
