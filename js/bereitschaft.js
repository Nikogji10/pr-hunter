// PR Hunter · 311: Readiness-Check im Verlauf – Antworten je Tag bzw. je Woche, Schnitte und Vergleich mit dem
// Zeitraum davor. Werte wie eingegeben (1–5): Schlaf und Energie hoch = gut, Stress und Muskelkater niedrig = gut.
import { bereitschaftsWert } from './auswertung.js';
import { montagVon } from './daten.js';

export const BEREIT_FELDER = ['sleep', 'energy', 'stress', 'soreness'];
/** true = hoher Wert ist gut (Schlaf, Energie, Gesamtwert), false = niedriger Wert ist gut (Stress, Muskelkater). */
export const HOCH_GUT = { wert: true, sleep: true, energy: true, stress: false, soreness: false };

const gueltig = (v) => typeof v === 'number' && v >= 1 && v <= 5;
const mittel = (l) => (l.length ? Math.round((l.reduce((a, b) => a + b, 0) / l.length) * 10) / 10 : null);

/** Ein Eintrag je Tag mit Check (mehrere Trainings am Tag gemittelt), aufsteigend: { datum, n, sleep, energy, stress, soreness, wert }. */
export function bereitschaftsTage(trainings) {
  const tage = new Map();
  for (const t of trainings ?? []) {
    const r = t?.bereitschaft;
    if (!t || t.geloescht || !t.datum || !r || !BEREIT_FELDER.some((k) => gueltig(r[k]))) continue;
    const l = tage.get(t.datum) ?? [];
    l.push(r);
    tage.set(t.datum, l);
  }
  return [...tage.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([datum, l]) => zusammen(datum, l));
}

/** Wochenmittel (Montag als Datum) aus Tageseinträgen. */
export function bereitschaftJeWoche(tage) {
  const wochen = new Map();
  for (const e of tage) {
    const m = montagVon(e.datum);
    const l = wochen.get(m) ?? [];
    l.push(e);
    wochen.set(m, l);
  }
  return [...wochen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([datum, l]) => ({ ...zusammen(datum, l), n: l.reduce((a, e) => a + (e.n ?? 1), 0) }));
}

function zusammen(datum, liste) {
  const e = { datum, n: liste.length };
  for (const k of BEREIT_FELDER) e[k] = mittel(liste.map((r) => r[k]).filter(gueltig));
  e.wert = bereitschaftsWert(e);
  return e;
}

/** Schnitt je Feld über Einträge (null, wenn kein Wert). */
export function bereitschaftsSchnitt(eintraege) {
  const s = {};
  for (const k of ['wert', ...BEREIT_FELDER]) s[k] = mittel(eintraege.map((e) => e[k]).filter((v) => v != null));
  return s;
}

/** Veränderung je Feld gegenüber einem früheren Schnitt; besser = in die gute Richtung (Stress/Muskelkater: gesunken). */
export function bereitschaftsTrend(jetzt, vorher) {
  const t = {};
  for (const k of ['wert', ...BEREIT_FELDER]) {
    if (jetzt?.[k] == null || vorher?.[k] == null) { t[k] = null; continue; }
    const d = Math.round((jetzt[k] - vorher[k]) * 10) / 10;
    t[k] = { d, besser: d === 0 ? null : (d > 0) === HOCH_GUT[k] };
  }
  return t;
}

/** Stufe eines Werts für die Farbe: 'gut' | 'mittel' | 'schlecht' (Schwellen 3,5 und 2,5, bei Stress/Muskelkater gespiegelt). */
export function bereitschaftsStufe(k, v) {
  if (v == null) return null;
  const g = HOCH_GUT[k] ? v : 6 - v;
  return g >= 3.5 ? 'gut' : g >= 2.5 ? 'mittel' : 'schlecht';
}
