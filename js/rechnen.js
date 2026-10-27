// PR Hunter · Rechenkern: reine Funktionen ohne Abhängigkeiten.
// rtsPct, e1rm und lastFuer liefern dieselben Werte wie public.rts_pct, public.e1rm und
// public.load_for in db/01_schema.sql (geprüft in test/rechnen.test.js gegen Sollwerte aus Python).

/** RTS-Tabelle nach Tuchscherer: Anteil vom 1RM für 1–12 Wdh @ RPE 10. */
export const RTS = [1, 0.955, 0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.68];
export const KG_PRO_LB = 0.45359237;
export const STANDARD_SCHEIBEN = [25, 20, 15, 10, 5, 2.5, 1.25];

// Gleitkomma-Puffer: Eingaben haben höchstens 2–4 Nachkommastellen, echte Werte liegen also nie
// so nah an einer Rundungsgrenze; nur Darstellungsfehler (216.85 → 216.8499…) werden ausgeglichen.
const EPS = 1e-9;

/** Kaufmännisch runden (halbe Stelle von null weg), wie round() auf numeric in Postgres. */
export function runde(x, stellen = 0) {
  const f = 10 ** stellen;
  return (Math.sign(x) * Math.floor(Math.abs(x) * f + 0.5 + EPS)) / f;
}

/** Auf das Ladeinkrement runden wie Excel MROUND (so sind die Programmvorlagen geprüft). */
export function mround(x, inc = 2.5) {
  return runde(Math.floor(x / inc + 0.5 + EPS) * inc, 6);
}

/** Anteil vom 1RM für X Wdh @ RPE r: (X + 10 − r) Wdh @ 10, halbe Stufen = Mittel der Nachbarn. */
export function rtsPct(wdh, rpe = null) {
  if (wdh == null || wdh < 1) return null;
  const x = wdh + 10 - (rpe ?? 10);
  if (x < 1 || x > 12) return null;
  return (RTS[Math.floor(x) - 1] + RTS[Math.ceil(x) - 1]) / 2;
}

/**
 * Geschätztes 1RM, auf 0,1 gerundet.
 * 'rpe' (Standard) entspricht public.e1rm: RTS-Tabelle, außerhalb der Tabelle Epley.
 * 'epley' und 'brzycki' rechnen mit Wdh bis zum Versagen = Wdh + (10 − RPE).
 */
export function e1rm(kg, wdh, rpe = null, formel = 'rpe') {
  if (kg == null || wdh == null || wdh < 1 || kg <= 0) return null;
  if (formel === 'rpe') {
    if (wdh === 1 && rpe == null) return kg;
    const pct = rtsPct(wdh, rpe);
    return pct != null ? runde(kg / pct, 1) : runde((kg * (30 + wdh)) / 30, 1);
  }
  const bisVersagen = wdh + (10 - (rpe ?? 10));
  if (bisVersagen <= 1) return kg;
  if (formel === 'epley') return runde((kg * (30 + bisVersagen)) / 30, 1);
  if (formel === 'brzycki') return bisVersagen < 37 ? runde((kg * 36) / (37 - bisVersagen), 1) : null;
  throw new Error(`Unbekannte e1RM-Formel: ${formel}`);
}

/** Gewicht für Wdh @ Ziel-RPE aus einem e1RM (public.load_for). */
export function lastFuer(e1rmKg, wdh, rpe, inc = 2.5) {
  const pct = rtsPct(wdh, rpe);
  return e1rmKg == null || pct == null ? null : mround(e1rmKg * pct, inc);
}

/** Wie lastFuer, aber auch außerhalb der RTS-Tabelle (leichte Sätze, z. B. 10 @ RPE 5): dort Epley mit Wdh bis
 *  Versagen. Nur für Vorschläge im Training; public.load_for (DB) bleibt bei lastFuer. */
export function lastFuerWeit(e1rmKg, wdh, rpe, inc = 2.5) {
  if (e1rmKg == null || wdh == null || wdh < 1) return null;
  const x = wdh + 10 - (rpe ?? 10);
  if (x < 1) return null;
  return mround(e1rmKg * (rtsPct(wdh, rpe) ?? 30 / (30 + x)), inc);
}

/** Wie e1rm mit RPE, außerhalb der RTS-Tabelle Epley mit Wdh bis Versagen (Anzeige am Satz). */
export function e1rmWeit(kg, wdh, rpe = null, formel = 'rpe') {
  if (formel !== 'rpe' || kg == null || wdh == null || wdh < 1 || kg <= 0 || rtsPct(wdh, rpe) != null || rpe == null) return e1rm(kg, wdh, rpe, formel);
  return runde((kg * (30 + wdh + 10 - rpe)) / 30, 1);
}

/**
 * Körpergewicht plus Zusatz (Klimmzug, Dips): das e1RM gilt für die Gesamtlast. Mit dem Zusatzgewicht allein
 * zu rechnen unterschätzt das Max stark (85 kg + 20 kg × 8 @ 8: gesamt 142,1 statt 27,1 für den Zusatz).
 * Ergebnis: { gesamt, zusatz } – zusatz = gesamt − Körpergewicht (negativ = Unterstützung).
 */
export function e1rmKoerper(zusatzKg, wdh, rpe, koerperKg, formel = 'rpe') {
  if (!(koerperKg > 0)) return null;
  const gesamt = e1rm(koerperKg + (zusatzKg ?? 0), wdh, rpe, formel);
  return gesamt == null ? null : { gesamt, zusatz: runde(gesamt - koerperKg, 1) };
}

/** Zusatzgewicht für Wdh @ RPE aus dem e1RM der Gesamtlast (negativ = Unterstützung). */
export function zusatzFuer(e1rmGesamt, wdh, rpe, koerperKg, inc = 1.25) {
  const pct = rtsPct(wdh, rpe);
  if (e1rmGesamt == null || pct == null || !(koerperKg > 0)) return null;
  return mround(e1rmGesamt * pct - koerperKg, inc);
}

/** RPE-Load-Calculator: bekannter Satz → empfohlenes Gewicht für das Ziel. */
export function rpeRechner(bekannt, ziel, inc = 2.5) {
  const basis = e1rm(bekannt.kg, bekannt.wdh, bekannt.rpe);
  return { e1rm: basis, kg: lastFuer(basis, ziel.wdh, ziel.rpe, inc) };
}

/** 1RM-Rechner: Gewicht für 1–10 Wdh @ RPE 10 aus einem e1RM. */
export function wdhTabelle(e1rmKg, formel = 'rpe', inc = 2.5) {
  const zeilen = [];
  for (let wdh = 1; wdh <= 10; wdh++) {
    const anteil = formel === 'rpe' ? rtsPct(wdh, 10)
      : formel === 'epley' ? (wdh === 1 ? 1 : 1 / (1 + wdh / 30))
      : (37 - wdh) / 36;
    const kg = e1rmKg * anteil;
    zeilen.push({ wdh, anteil, kg: runde(kg, 1), kgGerundet: mround(kg, inc) });
  }
  return zeilen;
}

/**
 * Scheibenrechner: Scheiben pro Seite für ein Zielgewicht.
 * Sucht die exakte Kombination mit den wenigsten Scheiben (Gleichstand: schwerere zuerst).
 * Ist das Ziel nicht genau ladbar, das nächstkleinere ladbare Gewicht; `rest` sagt, was fehlt.
 * Das Inventar gilt als paarweise unbegrenzt verfügbar (wie profiles.plates_kg).
 */
export function scheiben(ziel, { stange = 20, inventar = STANDARD_SCHEIBEN } = {}) {
  const proSeite = (ziel - stange) / 2;
  if (!(proSeite > 0)) return { proSeite: [], geladen: stange, rest: runde(ziel - stange, 2) };
  const E = 100; // Rechnen in 0,01-Einheiten
  const soll = Math.floor(proSeite * E + EPS);
  const sorten = [...new Set(inventar)].filter((s) => s > 0).sort((a, b) => b - a);
  const einheiten = sorten.map((s) => Math.round(s * E));
  const anzahl = new Array(soll + 1).fill(Infinity);
  anzahl[0] = 0;
  for (let a = 1; a <= soll; a++) {
    for (const e of einheiten) {
      if (e <= a && anzahl[a - e] + 1 < anzahl[a]) anzahl[a] = anzahl[a - e] + 1;
    }
  }
  let a = soll;
  while (a > 0 && anzahl[a] === Infinity) a--;
  const liste = [];
  while (a > 0) {
    const i = einheiten.findIndex((e) => e <= a && anzahl[a - e] === anzahl[a] - 1);
    liste.push(sorten[i]);
    a -= einheiten[i];
  }
  const geladen = runde(stange + 2 * liste.reduce((s, x) => s + x, 0), 2);
  return { proSeite: liste, geladen, rest: runde(ziel - geladen, 2) };
}

/** Standard-Aufwärmleiter: leere Stange bis ca. 90 % mit sinkenden Wdh. Pro Nutzer anpassbar. */
export const STANDARD_AUFWAERMEN = [
  { anteil: 0, wdh: 10 },
  { anteil: 0.4, wdh: 5 },
  { anteil: 0.55, wdh: 3 },
  { anteil: 0.7, wdh: 2 },
  { anteil: 0.8, wdh: 1 },
  { anteil: 0.9, wdh: 1 },
];

/** Aufwärmsätze vor einem Top-Satz; Stufen, die nicht schwerer als die vorige sind, entfallen. */
export function aufwaermen(topKg, { stange = 20, inc = 2.5, schema = STANDARD_AUFWAERMEN, inventar } = {}) {
  const saetze = [];
  let zuletzt = -Infinity;
  for (const stufe of schema) {
    const kg = Math.max(stange, mround(topKg * stufe.anteil, inc));
    if (kg <= zuletzt || kg >= topKg) continue;
    saetze.push({ kg, wdh: stufe.wdh, scheiben: scheiben(kg, { stange, inventar }).proSeite });
    zuletzt = kg;
  }
  return saetze;
}

/** kg ↔ Anzeigeeinheit. Gespeichert wird immer kg mit 2 Nachkommastellen (numeric(6,2)). */
export function inEinheit(kg, einheit) {
  if (kg == null) return null;
  return einheit === 'lb' ? runde(kg / KG_PRO_LB, 1) : runde(kg, 2);
}

export function ausEinheit(wert, einheit) {
  if (wert == null) return null;
  return runde(einheit === 'lb' ? wert * KG_PRO_LB : wert, 2);
}
