// PR Hunter · RPE-Genauigkeit (Wunsch 215): Wie gut schätzt du RPE? Jeder Satz mit RPE 6–8,5 ergibt über die RTS-Tabelle ein
// geschätztes 1RM. Verglichen wird mit dem Bestwert aus harten Sätzen (RPE ≥ 9 – nah am Versagen schätzt man am
// genauesten) derselben Übung in ±21 Tagen. Liegt die Schätzung darüber, waren die Sätze in Wahrheit schwerer → RPE zu
// niedrig angegeben (und umgekehrt). Faustregel: 1 RPE ≈ 3 % e1RM.
// 03.11.: Bezug ab RPE 9 statt 9,5 und je Kategorie ab 3 Vergleichen – vorher kamen bei kaum jemandem genug Daten zusammen.
import { e1rm } from './rechnen.js';

const TAG = 864e5, PRO_RPE = 0.033, HART = 9;
const median = (l) => { const s = [...l].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Rückgabe { gesamt: { abweichung, n } | null, je: { kategorie: { abweichung | null, n, mitRpe } } } – abweichung in RPE:
 *  > 0 = zu niedrig angegeben. n = Vergleiche, mitRpe = Sätze mit RPE-Angabe (für den Hinweis, was fehlt). */
export function rpeGenauigkeit(einheiten, { liftVon = () => 'andere', fenster = 21, minimum = 5, minimumJe = 3 } = {}) {
  const saetze = einheiten.flatMap((e) => e.uebungen.flatMap((u) => u.saetze.filter((s) => s.kg > 0 && s.wdh >= 1 && s.wdh <= 10 && s.rpe != null)
    .map((s) => ({ t: Date.parse(`${e.datum}T00:00:00Z`), key: u.key, kg: s.kg, wdh: s.wdh, rpe: s.rpe }))));
  const hart = saetze.filter((s) => s.rpe >= HART).map((s) => ({ ...s, wert: e1rm(s.kg, s.wdh, s.rpe, 'rpe') }));
  const je = {}, alle = [];
  const kat = (key) => (je[liftVon(key)] ??= { l: [], mitRpe: 0 });
  for (const s of saetze) {
    kat(s.key).mitRpe++;
    if (s.rpe < 6 || s.rpe >= HART) continue;
    const ref = Math.max(-Infinity, ...hart.filter((h) => h.key === s.key && Math.abs(h.t - s.t) <= fenster * TAG).map((h) => h.wert));
    if (!Number.isFinite(ref) || ref <= 0) continue;
    const abw = (e1rm(s.kg, s.wdh, s.rpe, 'rpe') / ref - 1) / PRO_RPE;
    if (Math.abs(abw) > 4) continue;                                     // Ausreißer (Tippfehler, andere Technik)
    kat(s.key).l.push(abw); alle.push(abw);
  }
  const rund = (l) => Math.round(median(l) * 10) / 10;
  return {
    gesamt: alle.length >= minimum ? { abweichung: rund(alle), n: alle.length } : null,
    je: Object.fromEntries(Object.entries(je).map(([k, { l, mitRpe }]) => [k, { abweichung: l.length >= minimumJe ? rund(l) : null, n: l.length, mitRpe }])),
  };
}
