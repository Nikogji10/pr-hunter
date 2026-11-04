// PR Hunter · Ausdauer (Wünsche 222–229): Läufe und Radfahrten – Arten, Tempo, Wochensummen, Bestzeiten, Belastung,
// Leistungskurve und FTP. Pure Funktionen (ohne DOM), damit testbar. Einheit = Zeile aus public.ausdauer:
// { id, quelle, art, datum, start, titel, typ, dauer_s, distanz_m, hoehe_m, puls_avg, puls_max, watt_avg, watt_np, watt_max,
//   watt_echt, kj, kadenz, rpe, geraet, notiz, details: { splits, best, kurve }, geloescht }

/** Arten je Sportart. sport: lauf | rad. */
export const ARTEN = [
  { id: 'lauf', sport: 'lauf', de: 'Lauf', en: 'Run', icon: '🏃' },
  { id: 'trail', sport: 'lauf', de: 'Trail', en: 'Trail run', icon: '⛰️' },
  { id: 'laufband', sport: 'lauf', de: 'Laufband', en: 'Treadmill', icon: '🏃' },
  { id: 'rennrad', sport: 'rad', de: 'Rennrad', en: 'Road bike', icon: '🚴' },
  { id: 'gravel', sport: 'rad', de: 'Gravel', en: 'Gravel', icon: '🚴' },
  { id: 'mtb', sport: 'rad', de: 'MTB', en: 'MTB', icon: '🚵' },
  { id: 'rolle', sport: 'rad', de: 'Rolle', en: 'Indoor', icon: '🚲' },
  { id: 'ebike', sport: 'rad', de: 'E-Bike', en: 'E-bike', icon: '🚲' },
];
export const art = (id) => ARTEN.find((a) => a.id === id) ?? ARTEN[0];
export const sportVon = (id) => art(id).sport;

/** Art der Einheit; rpe = Ersatz, wenn keine RPE eingetragen ist (für die Belastung). */
export const TYPEN = [
  { id: 'locker', de: 'Locker', en: 'Easy', rpe: 3 },
  { id: 'lang', de: 'Lang', en: 'Long', rpe: 4 },
  { id: 'tempo', de: 'Tempo', en: 'Tempo', rpe: 6 },
  { id: 'intervalle', de: 'Intervalle', en: 'Intervals', rpe: 8 },
  { id: 'wettkampf', de: 'Wettkampf', en: 'Race', rpe: 9 },
];

/** Welche Sportarten die Einstellung zeigt (einst.ausdauer: null | 'lauf' | 'rad' | 'beides'). */
export const sportarten = (wahl) => (wahl === 'beides' ? ['lauf', 'rad'] : wahl === 'lauf' || wahl === 'rad' ? [wahl] : []);
export const sichtbar = (liste, wahl) => {
  const s = sportarten(wahl);
  return (liste ?? []).filter((a) => !a.geloescht && s.includes(sportVon(a.art)));
};

/** Pace in s/km (Laufen) bzw. km/h (Rad). */
export const paceSek = (a) => (a.distanz_m > 0 && a.dauer_s > 0 ? a.dauer_s / (a.distanz_m / 1000) : null);
export const kmh = (a) => (a.distanz_m > 0 && a.dauer_s > 0 ? (a.distanz_m / 1000) / (a.dauer_s / 3600) : null);

/** „1:23:45“ bzw. „45:12“ */
export function dauerText(s) {
  if (s == null || !Number.isFinite(s)) return '–';
  const r = Math.round(s), h = Math.floor(r / 3600), m = Math.floor((r % 3600) / 60), sek = r % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sek).padStart(2, '0')}` : `${m}:${String(sek).padStart(2, '0')}`;
}
/** „5:12 /km“ */
export const paceText = (sPerKm) => (sPerKm == null ? '–' : `${dauerText(sPerKm)} /km`);

/** Eingabe „1:05:30“, „45:00“, „45“ (Minuten) → Sekunden. */
export function dauerLesen(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  if (!t) return null;
  const teile = t.split(':').map(Number);
  if (teile.some((x) => !Number.isFinite(x) || x < 0)) return null;
  if (teile.length === 1) return Math.round(teile[0] * 60);
  if (teile.length === 2) return Math.round(teile[0] * 60 + teile[1]);
  if (teile.length === 3) return Math.round(teile[0] * 3600 + teile[1] * 60 + teile[2]);
  return null;
}

const TAG = 864e5;
const plus = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * TAG).toISOString().slice(0, 10);
export const montag = (d) => plus(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));

/** Summen je Woche (Montag) und Sportart: km, Sekunden, Höhenmeter, Anzahl. */
export function wochen(liste, { von, bis }) {
  const w = {};
  for (let d = montag(von); d <= bis; d = plus(d, 7)) w[d] = { woche: d, lauf: leer(), rad: leer() };
  for (const a of liste) {
    if (a.geloescht || a.datum < montag(von) || a.datum > bis) continue;
    const z = w[montag(a.datum)]?.[sportVon(a.art)];
    if (!z) continue;
    z.km += (a.distanz_m ?? 0) / 1000; z.s += a.dauer_s ?? 0; z.hm += a.hoehe_m ?? 0; z.n++;
  }
  return Object.values(w);
}
const leer = () => ({ km: 0, s: 0, hm: 0, n: 0 });

/** Lauf-Bestzeiten: aus Strava-Bestzeiten (details.best: [{ name, m, s }]) bzw. ganzen Läufen nahe der Strecke (±3 %, auf die Strecke umgerechnet). */
export const STRECKEN = [[1000, '1 km'], [5000, '5 km'], [10000, '10 km'], [21097, 'HM'], [42195, 'M']];
export function bestzeiten(liste) {
  const best = {};
  const nimm = (m, s, a) => { if (s > 0 && (!best[m] || s < best[m].s)) best[m] = { s, datum: a.datum, id: a.id }; };
  for (const a of liste) {
    if (a.geloescht || sportVon(a.art) !== 'lauf' || a.art === 'laufband') continue;
    for (const b of a.details?.best ?? []) if (STRECKEN.some(([m]) => m === b.m)) nimm(b.m, b.s, a);
    for (const [m] of STRECKEN) if (a.distanz_m >= m * 0.99 && a.distanz_m <= m * 1.03 && a.dauer_s) nimm(m, Math.round(a.dauer_s * (m / a.distanz_m)), a);
  }
  return STRECKEN.filter(([m]) => best[m]).map(([m, name]) => ({ m, name, ...best[m] }));
}

/** Belastung einer Einheit wie beim Krafttraining (Foster): Minuten × RPE; ohne RPE Ersatz nach Typ (locker 3 … Wettkampf 9). */
export function last(a) {
  if (!a.dauer_s) return 0;
  const rpe = a.rpe ?? TYPEN.find((t) => t.id === a.typ)?.rpe ?? 4;
  return Math.round((a.dauer_s / 60) * rpe);
}

/** Rad: Training Stress Score aus gewichteter Leistung und FTP (null ohne Watt/FTP). */
export function tss(a, ftp) {
  const np = a.watt_np ?? a.watt_avg;
  if (!ftp || !np || !a.dauer_s) return null;
  const intensitaet = np / ftp;
  return Math.round((a.dauer_s * np * intensitaet) / (ftp * 3600) * 100);
}

/** Leistungskurve: beste Watt je Dauer über alle Fahrten (details.kurve: { "5": 900, "60": 450, "300": 330, "1200": 290 }). */
export const KURVE = [[5, '5 s'], [60, '1 min'], [300, '5 min'], [1200, '20 min'], [3600, '60 min']];
export function leistungskurve(liste, { von = '0000' } = {}) {
  const b = {};
  for (const a of liste) {
    if (a.geloescht || sportVon(a.art) !== 'rad' || a.datum < von) continue;
    for (const [s] of KURVE) { const w = a.details?.kurve?.[s]; if (w > 0 && (!b[s] || w > b[s].w)) b[s] = { w, datum: a.datum, echt: a.watt_echt !== false }; }
  }
  return KURVE.filter(([s]) => b[s]).map(([s, name]) => ({ s, name, ...b[s] }));
}
/** FTP-Schätzung: 95 % der besten 20 Minuten (letzte 12 Wochen). */
export function ftpSchaetzung(liste, heute) {
  const k = leistungskurve(liste, { von: plus(heute, -84) }).find((x) => x.s === 1200);
  return k ? { ftp: Math.round(k.w * 0.95), aus: k } : null;
}

/** Aus einer Leistungs-Zeitreihe (Watt je Sekunde) die besten Mittelwerte je Dauer – für Strava-Streams und FIT-Dateien. */
export function kurveAusReihe(watt) {
  const aus = {};
  if (!watt?.length) return aus;
  for (const [s] of KURVE) {
    if (watt.length < s) continue;
    let summe = 0, best = 0;
    for (let i = 0; i < watt.length; i++) { summe += watt[i] ?? 0; if (i >= s) summe -= watt[i - s] ?? 0; if (i >= s - 1) best = Math.max(best, summe / s); }
    aus[s] = Math.round(best);
  }
  return aus;
}

/** Gewichtete Leistung (wie Normalized Power): 30-s-Mittel, ^4, Mittel, ^¼. */
export function gewichteteLeistung(watt) {
  if (!watt || watt.length < 30) return null;
  const m = [];
  let summe = 0;
  for (let i = 0; i < watt.length; i++) { summe += watt[i] ?? 0; if (i >= 30) summe -= watt[i - 30] ?? 0; if (i >= 29) m.push(summe / 30); }
  return Math.round(Math.pow(m.reduce((s, x) => s + x ** 4, 0) / m.length, 0.25));
}

/** Form-Kurve aus Tageslasten: Fitness (42 Tage), Ermüdung (7 Tage), Frische = Fitness − Ermüdung. lasten: { datum: last } */
export function form(lasten, { von, bis, ab = null }) {
  let fit = 0, erm = 0;
  const kf = 1 - Math.exp(-1 / 42), ke = 1 - Math.exp(-1 / 7), aus = [];
  const start = ab ?? Object.keys(lasten).sort()[0] ?? von;
  for (let d = start < von ? start : von; d <= bis; d = plus(d, 1)) {
    const l = lasten[d] ?? 0;
    fit += (l - fit) * kf; erm += (l - erm) * ke;
    if (d >= von) aus.push({ datum: d, fitness: Math.round(fit), ermuedung: Math.round(erm), frische: Math.round(fit - erm) });
  }
  return aus;
}

/** Beine: Ausdauer der letzten 72 h als Ermüdung (0–1) – für Erholung und Hinweise vor dem Beintag. */
export function beinBelastung(liste, jetzt) {
  let summe = 0;
  for (const a of liste) {
    if (a.geloescht) continue;
    const t = a.start ? Date.parse(a.start) : Math.min(jetzt, Date.parse(`${a.datum}T12:00:00Z`));   // ohne Uhrzeit: mittags, heute höchstens jetzt
    const h = (jetzt - t) / 36e5;
    if (h < 0 || h > 72) continue;
    summe += last(a) * (1 - h / 72) * (sportVon(a.art) === 'lauf' ? 1 : 0.7) * (1 + Math.min(1, (a.hoehe_m ?? 0) / 1000));
  }
  return Math.min(1, summe / 600);
}
