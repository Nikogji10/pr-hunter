// PR Hunter · RPE-Genauigkeit (Wunsch 215): Wie gut schätzt du RPE? Jeder Satz mit RPE 6–9,5 ergibt über die RTS-Tabelle ein
// geschätztes 1RM. Verglichen wird mit dem tatsächlichen Bestwert aus harten Sätzen (RPE ≥ 9,5) derselben Übung in ±21
// Tagen. Liegt die Schätzung darüber, waren die Sätze in Wahrheit schwerer → RPE zu niedrig angegeben (und umgekehrt).
// Faustregel: 1 RPE ≈ 3 % e1RM.
import { e1rm } from './rechnen.js';

const TAG = 864e5, PRO_RPE = 0.033;
const median = (l) => { const s = [...l].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Rückgabe { gesamt: { abweichung, n }, je: { lift: { abweichung, n } } } – abweichung in RPE: > 0 = zu niedrig angegeben. */
export function rpeGenauigkeit(einheiten, { liftVon = () => 'andere', fenster = 21, minimum = 5 } = {}) {
  const saetze = einheiten.flatMap((e) => e.uebungen.flatMap((u) => u.saetze.filter((s) => s.kg > 0 && s.wdh >= 1 && s.wdh <= 10 && s.rpe != null)
    .map((s) => ({ t: Date.parse(`${e.datum}T00:00:00Z`), key: u.key, kg: s.kg, wdh: s.wdh, rpe: s.rpe }))));
  const hart = saetze.filter((s) => s.rpe >= 9.5).map((s) => ({ ...s, wert: e1rm(s.kg, s.wdh, s.rpe, 'rpe') }));
  const je = {}, alle = [];
  for (const s of saetze) {
    if (s.rpe < 6 || s.rpe >= 9.5) continue;
    const ref = Math.max(-Infinity, ...hart.filter((h) => h.key === s.key && Math.abs(h.t - s.t) <= fenster * TAG).map((h) => h.wert));
    if (!Number.isFinite(ref) || ref <= 0) continue;
    const abw = (e1rm(s.kg, s.wdh, s.rpe, 'rpe') / ref - 1) / PRO_RPE;
    if (Math.abs(abw) > 4) continue;                                     // Ausreißer (Tippfehler, andere Technik)
    (je[liftVon(s.key)] ??= []).push(abw); alle.push(abw);
  }
  const fass = (l) => (l.length >= minimum ? { abweichung: Math.round(median(l) * 10) / 10, n: l.length } : null);
  return { gesamt: fass(alle), je: Object.fromEntries(Object.entries(je).map(([k, l]) => [k, fass(l)]).filter(([, v]) => v)) };
}
