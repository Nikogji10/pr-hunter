// PR Hunter · Jahresrückblick (Wunsch 206): Zahlen eines Kalenderjahres aus den normierten Trainings (js/insights.js).
// Rekorde über den ganzen Verlauf (sonst wäre jeder erste Satz im Jahr ein „Rekord“), gezählt im Jahr.
import { rekorde, wochenSerie, gesamt, minuten } from './insights.js';
import { e1rm } from './rechnen.js';

const vol = (u) => u.saetze.reduce((b, s) => b + (s.kg > 0 ? s.kg : 0) * (s.wdh ?? 0), 0);
const MONATE = [['Januar', 'January'], ['Februar', 'February'], ['März', 'March'], ['April', 'April'], ['Mai', 'May'], ['Juni', 'June'],
  ['Juli', 'July'], ['August', 'August'], ['September', 'September'], ['Oktober', 'October'], ['November', 'November'], ['Dezember', 'December']];
const WOCHENTAGE = [['Sonntag', 'Sunday'], ['Montag', 'Monday'], ['Dienstag', 'Tuesday'], ['Mittwoch', 'Wednesday'], ['Donnerstag', 'Thursday'], ['Freitag', 'Friday'], ['Samstag', 'Saturday']];

/** einheiten: alle normierten Trainings; liftVon(key) → 'squat' | 'bench' | 'dead' | 'andere'. */
export function rueckblick(einheiten, jahr, { liftVon = () => 'andere' } = {}) {
  const J = String(jahr), im = einheiten.filter((e) => e.datum.startsWith(J)), vor = einheiten.filter((e) => e.datum.startsWith(String(jahr - 1)));
  if (!im.length) return null;
  const tonnen = im.reduce((a, e) => a + e.uebungen.reduce((b, u) => b + vol(u), 0), 0) / 1000;
  const saetze = im.reduce((a, e) => a + e.uebungen.reduce((b, u) => b + u.saetze.length, 0), 0);
  const wdh = im.reduce((a, e) => a + e.uebungen.reduce((b, u) => b + u.saetze.reduce((c, s) => c + (s.wdh ?? 0), 0), 0), 0);
  const prs = rekorde(einheiten).filter((r) => r.datum.startsWith(J));
  // beste Rekorde: größter Sprung gegenüber vorher
  const topPrs = [...prs].sort((a, b) => (b.e1rm - b.vorher) - (a.e1rm - a.vorher)).slice(0, 3);
  // Lieblingsübung: in den meisten Trainings
  const haeufig = new Map();
  for (const e of im) for (const k of new Set(e.uebungen.map((u) => u.key))) haeufig.set(k, (haeufig.get(k) ?? 0) + 1);
  const [liebling, lieblingAnzahl] = [...haeufig.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  // Monate: Tonnen und Trainings
  const monate = MONATE.map((n, i) => {
    const m = im.filter((e) => Number(e.datum.slice(5, 7)) === i + 1);
    return { name: n, trainings: m.length, tonnen: m.reduce((a, e) => a + e.uebungen.reduce((b, u) => b + vol(u), 0), 0) / 1000 };
  });
  const staerkster = monate.reduce((a, m, i) => (m.tonnen > monate[a].tonnen ? i : a), 0);
  // Wochentag und Tageszeit
  const wt = Array(7).fill(0);
  for (const e of im) wt[new Date(`${e.datum}T00:00:00Z`).getUTCDay()]++;
  const lieblingsTag = wt.indexOf(Math.max(...wt));
  const stunden = im.map((e) => (e.start ? new Date(e.start).getHours() : null)).filter((h) => h != null);
  const frueh = stunden.filter((h) => h < 12).length, abends = stunden.filter((h) => h >= 17).length;
  const tageszeit = !stunden.length ? null : frueh > stunden.length / 2 ? 'morgens' : abends > stunden.length / 2 ? 'abends' : 'mittags';
  // Hauptlifts: bestes e1RM im ersten Monat mit Daten vs. bestes im Jahr
  const lifts = ['squat', 'bench', 'dead'].map((l) => {
    const werte = im.flatMap((e) => e.uebungen.filter((u) => liftVon(u.key) === l).map((u) => ({ datum: e.datum,
      w: Math.max(-Infinity, ...u.saetze.filter((s) => s.kg > 0 && s.wdh > 0 && s.wdh <= 10).map((s) => e1rm(s.kg, s.wdh))) }))).filter((x) => Number.isFinite(x.w));
    if (werte.length < 2) return null;
    const ersterMonat = werte[0].datum.slice(0, 7), start = Math.max(...werte.filter((x) => x.datum.startsWith(ersterMonat)).map((x) => x.w)), best = Math.max(...werte.map((x) => x.w));
    return { lift: l, start: Math.round(start * 2) / 2, best: Math.round(best * 2) / 2, plus: Math.round((best - start) * 2) / 2 };
  }).filter(Boolean);
  const serieJahr = wochenSerie(im.map((e) => e.datum), im.at(-1).datum).laengste;
  const dauer = im.map(minuten).filter((m) => m != null && m < 600);
  return {
    jahr, trainings: im.length, tage: new Set(im.map((e) => e.datum)).size, stunden: Math.round(gesamt(im).stunden), saetze, wdh,
    tonnen: Math.round(tonnen * 10) / 10, elefanten: Math.round((tonnen / 6) * 10) / 10, autos: Math.round(tonnen / 1.5),
    rekorde: prs.length, topPrs, liebling, lieblingAnzahl, uebungen: haeufig.size, monate, staerkster,
    lieblingsTag: WOCHENTAGE[lieblingsTag], lieblingsTagAnzahl: wt[lieblingsTag], tageszeit, serie: serieJahr,
    laengste: dauer.length ? Math.round(Math.max(...dauer)) : null, lifts,
    vorjahr: vor.length ? { trainings: vor.length, tonnen: Math.round(vor.reduce((a, e) => a + e.uebungen.reduce((b, u) => b + vol(u), 0), 0) / 100) / 10 } : null,
  };
}

/** Titel nach Fleiß: ein Augenzwinkern zum Abschluss. */
export function titelVon(r) {
  if (r.trainings >= 200) return ['Die Maschine', 'The Machine'];
  if (r.trainings >= 150) return ['Eisen-Veteran', 'Iron Veteran'];
  if (r.trainings >= 100) return ['Gym-Stammgast', 'Gym Regular'];
  if (r.rekorde >= 50) return ['Rekordjäger', 'PR Hunter'];
  if (r.trainings >= 50) return ['Auf dem Weg nach oben', 'On the Rise'];
  return ['Der Anfang ist gemacht', 'The Journey Has Begun'];
}
