// PR Hunter · Formkurve bis zum Wettkampf (Wunsch 269). Fitness-Ermüdungs-Modell nach Banister in der Form, wie es
// Trainingsanalyse-Programme nutzen: Fitness = gleitender Schnitt der Tageslast über 42 Tage, Ermüdung über 7 Tage,
// Form = Fitness − Ermüdung (am Morgen eines Tages, also aus den Werten des Vortags). Form in % der Fitness, damit die Zahl
// unabhängig davon ist, wie viel jemand trainiert.
// Tageslast = INOL der Arbeitssätze in Kniebeuge, Bankdrücken, Kreuzheben und ihren Varianten. Die gibt es für den ganzen
// Verlauf (die Session-RPE fehlt im Jefit-Verlauf). Künftige Tage kommen aus dem Plan des aktiven Blocks.
// Schätzung: Zeitkonstanten und Zonen stammen aus dem Ausdauersport und sind für Kraftsport nicht eigens geprüft.
import { rtsPct } from './rechnen.js';
import { plusTage } from './daten.js';

export const FORM_MODELL = { fitness: 42, ermuedung: 7, quelle: 'Banister (1975), Zeitkonstanten 42 / 7 Tage' };
// Zonen der Form in % der Fitness (Obergrenze). Rechenbeispiel: 1 Woche halbes Volumen ≈ +26 %, 1 Woche Pause ≈ +57 %.
export const FORM_ZONEN = [['muede', -10], ['training', 10], ['frisch', 50], ['pause', Infinity]];
const SBD = new Set(['squat', 'bench', 'dead']);
const MAX_PCT = 95;                      // Sätze ab 95 % zählen wie 95 % (INOL wäre bei 100 % unendlich)

/** INOL eines Satzes: Wdh ÷ (100 − % vom e1RM). Der Anteil ist gedeckelt auf das, was bei der Wdh-Zahl höchstens geht
 *  (RTS bei RPE 10, z. B. 5 Wdh ≤ 86,3 %) und auf 95 % – sonst ergäbe ein zu niedriges e1RM riesige Lasten. */
export function satzLast(wdh, anteil) {
  if (!(wdh > 0) || !(anteil > 0)) return 0;
  const moeglich = rtsPct(Math.round(wdh), 10) ?? 1;
  return wdh / (100 - Math.min(anteil * 100, moeglich * 100, MAX_PCT));
}

/** Last eines Trainings: uebungen [{ lift, saetze: [{ kg, last, wdh, typ }], e1rm }] – nur SBD und Varianten, ohne Aufwärmen. */
export function trainingsLast(uebungen) {
  let summe = 0;
  for (const u of uebungen ?? []) {
    if (!SBD.has(u.lift) || !(u.e1rm > 0)) continue;
    for (const s of u.saetze ?? []) if (s.typ !== 'warmup') summe += satzLast(s.wdh, (s.last ?? s.kg) / u.e1rm);
  }
  return summe;
}

/** Last eines Plantags (planeBlock): je Gruppe Sätze × INOL aus kg ÷ e1RM, sonst aus Wdh @ RPE (RTS-Tabelle).
 *  liftVon(key) → 'squat' | 'bench' | 'dead' | 'andere', e1rmVon(key) → kg oder null. */
export function planLast(tag, { liftVon, e1rmVon }) {
  let summe = 0;
  for (const u of tag?.uebungen ?? []) {
    if (!u.key || !SBD.has(liftVon(u.key))) continue;
    const max = e1rmVon(u.key);
    for (const g of u.gruppen ?? []) {
      const n = g.saetze?.max ?? g.saetze?.min ?? (g.saetze?.text ? 1 : 0);
      const wdh = g.wdh?.max ?? g.wdh?.min ?? g.wdh?.ziel ?? (g.wdh?.amrap ? 5 : null);
      if (!(n > 0) || !(wdh > 0)) continue;
      const rpe = g.rpe ? g.rpe.max ?? g.rpe.min : null;
      const anteil = g.kg > 0 && max > 0 ? g.kg / max : rpe != null ? rtsPct(wdh, rpe) : null;
      if (anteil) summe += n * satzLast(wdh, anteil);
    }
  }
  return summe;
}

const a = (tau) => 1 - Math.exp(-1 / tau);

/**
 * Verlauf je Tag von `von` bis `bis`. lasten: { 'JJJJ-MM-TT': last } (fehlende Tage = 0). Das Modell läuft ab dem frühesten
 * Tag mit Last, damit die Fitness am Anfang des Ausschnitts schon eingeschwungen ist.
 * Rückgabe [{ datum, fitness, ermuedung, form, pct }] – Werte am Morgen des Tages; pct = null, solange kaum Fitness da ist.
 */
export function formVerlauf(lasten, { von, bis, modell = FORM_MODELL } = {}) {
  const tage = Object.keys(lasten).filter((d) => lasten[d] > 0).sort();
  if (!tage.length || !von || !bis || von > bis) return [];
  const af = a(modell.fitness), ae = a(modell.ermuedung);
  let fit = 0, ermued = 0, maxFit = 0;
  const aus = [];
  for (let d = tage[0] < von ? tage[0] : von; d <= bis; d = plusTage(d, 1)) {
    if (d >= von) {
      // pct erst, wenn die Fitness mindestens 20 % ihres bisherigen Höchstwerts erreicht (sonst riesige Prozente aus fast nichts)
      const pct = fit > 0 && fit >= 0.2 * maxFit ? Math.round(((fit - ermued) / fit) * 100) : null;
      aus.push({ datum: d, fitness: fit, ermuedung: ermued, form: fit - ermued, pct });
    }
    const w = lasten[d] ?? 0;
    fit += (w - fit) * af;
    ermued += (w - ermued) * ae;
    maxFit = Math.max(maxFit, fit);
  }
  return aus;
}

/** Zone einer Form in %: 'muede' | 'training' | 'frisch' | 'pause' (null ohne Wert). */
export const formZone = (pct) => (pct == null ? null : FORM_ZONEN.find(([, bis]) => pct < bis)[0]);

/**
 * Auswertung zum Wettkampf: Form heute, am Wettkampftag, höchste Form bis dahin und ein Hinweis-Schlüssel.
 * verlauf aus formVerlauf (ohne Plan nur bis heute – dann gibt es keinen Wert am Wettkampftag), heute/wettkampf als Datum,
 * planEnde = letzter Plantag oder null. luecke: Plan endet mehr als 2 Tage vor dem Wettkampf (danach ohne Training gerechnet).
 * hinweis: 'passt' | 'muede' | 'zufrueh' | 'pause' | null (ohne Wettkampf oder ohne Vorschau).
 */
export function formZumWettkampf(verlauf, { heute, wettkampf = null, planEnde = null }) {
  const am = (d) => verlauf.find((v) => v.datum === d) ?? null;
  const jetzt = am(heute);
  if (!wettkampf || wettkampf < heute) return { heute: jetzt, wettkampf: null, hoch: null, hinweis: null, luecke: false };
  const wk = am(wettkampf);
  const bis = verlauf.filter((v) => v.datum >= heute && v.datum <= wettkampf && v.pct != null);
  const hoch = bis.reduce((b, v) => (!b || v.pct > b.pct ? v : b), null);
  const luecke = !!planEnde && planEnde < plusTage(wettkampf, -2);
  let hinweis = null;
  if (wk?.pct != null) {
    const z = formZone(wk.pct);
    // Vorher schon frisch (über 3 Tage vorher, 10 Punkte über dem Wettkampftag), am Wettkampftag nicht mehr: zu früh entlastet
    // (Spitze heute, z. B. nach einem Urlaub, zählt nicht: dann ist der Rat „Volumen senken“, nicht „später entlasten“)
    if (hoch && hoch.pct >= 10 && hoch.datum > heute && hoch.datum < plusTage(wettkampf, -3) && hoch.pct - wk.pct >= 10 && z !== 'frisch') hinweis = 'zufrueh';
    else hinweis = z === 'frisch' ? 'passt' : z === 'pause' ? 'pause' : 'muede';
  }
  return { heute: jetzt, wettkampf: wk, hoch, hinweis, luecke };
}
