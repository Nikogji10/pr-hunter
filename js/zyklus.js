// PR Hunter · Zyklus-Tracking (Wunsch 220, nur für Frauen, optional): Periodenbeginne eintragen → Zyklustag und Phase,
// Ø Zykluslänge, Leistung je Phase (bestes e1RM des Tages je Übung relativ zum Bestwert der 90 Tage davor).
import { e1rm } from './rechnen.js';

const TAG = 864e5;
const tage = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / TAG);
export const PHASEN = [['menstruation', 'Menstruation', 'Menstruation', '🌑'], ['follikel', 'Follikelphase', 'Follicular phase', '🌒'],
  ['ovulation', 'Eisprung', 'Ovulation', '🌕'], ['luteal', 'Lutealphase', 'Luteal phase', '🌘']];

/** Ø Zykluslänge aus den letzten Beginnen (21–45 Tage zählen), sonst 28. */
export function zyklusLaenge(starts) {
  const s = [...new Set(starts)].sort(), l = [];
  for (let i = 1; i < s.length; i++) { const d = tage(s[i - 1], s[i]); if (d >= 21 && d <= 45) l.push(d); }
  const letzte = l.slice(-6);
  return letzte.length ? Math.round(letzte.reduce((a, b) => a + b, 0) / letzte.length) : 28;
}

/** Phase an einem Tag: { tag (1…), phase, laenge, naechste (Datum) } oder null ohne passenden Beginn davor. */
export function phaseAm(datum, starts) {
  const s = [...new Set(starts)].sort().filter((x) => x <= datum);
  if (!s.length) return null;
  const laenge = zyklusLaenge(starts), tag = tage(s.at(-1), datum) + 1;
  if (tag > laenge + 14) return null;                                // zu lange her – kein verlässlicher Stand
  const eisprung = laenge - 14;
  const phase = tag <= 5 ? 'menstruation' : tag < eisprung - 1 ? 'follikel' : tag <= eisprung + 1 ? 'ovulation' : 'luteal';
  const n = new Date(`${s.at(-1)}T00:00:00Z`); n.setUTCDate(n.getUTCDate() + laenge);
  return { tag, phase, laenge, naechste: n.toISOString().slice(0, 10) };
}

/** Leistung je Phase: Ø Verhältnis bestes e1RM des Tages ÷ Bestwert der 90 Tage davor (je Übung). { phase: { wert, n } } */
export function leistungJePhase(einheiten, starts) {
  const best = (l) => Math.max(-Infinity, ...l.filter((x) => x.kg > 0 && x.wdh > 0 && x.wdh <= 12).map((x) => e1rm(x.kg, x.wdh)));
  const aus = {};
  for (const e of einheiten) {
    const p = phaseAm(e.datum, starts);
    if (!p) continue;
    const vorher = einheiten.filter((v) => v.datum < e.datum && v.datum >= new Date(Date.parse(`${e.datum}T00:00:00Z`) - 90 * TAG).toISOString().slice(0, 10));
    const q = [];
    for (const u of e.uebungen) {
      const heute = best(u.saetze), alt = Math.max(-Infinity, ...vorher.flatMap((v) => v.uebungen.filter((x) => x.key === u.key)).map((x) => best(x.saetze)));
      if (Number.isFinite(heute) && Number.isFinite(alt) && alt > 0) q.push(heute / alt);
    }
    if (!q.length) continue;
    const a = (aus[p.phase] ??= { summe: 0, n: 0 });
    a.summe += q.reduce((x, y) => x + y, 0) / q.length; a.n += 1;
  }
  return Object.fromEntries(Object.entries(aus).map(([k, v]) => [k, { wert: v.summe / v.n, n: v.n }]));
}
