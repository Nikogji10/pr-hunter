// PR Hunter · Scheibenwechsel sparen (Wunsch 202). Scheiben liegen als Stapel je Seite (innen → außen); umstecken heißt
// die äußeren abnehmen, bis der gemeinsame innere Teil übrig ist, dann neue aufstecken.
// 1. Aufwärmen: jede Stufe möglichst nur durch Aufstecken erreichen (statt jedes Mal die beste Einzelbeladung).
// 2. Zwei Gewichte an einer Stange (Top-Satz/Back-off oder zu zweit): das schwere so laden, dass das leichte nur durch
//    Abnehmen der äußeren Scheiben entsteht.
import { scheiben } from './rechnen.js';

/** Handgriffe je Seite von Beladung a nach b (Abnehmen + Aufstecken). */
export function umbauten(a, b) {
  let gleich = 0;
  while (gleich < a.length && gleich < b.length && a[gleich] === b[gleich]) gleich++;
  return a.length - gleich + b.length - gleich;
}

const lade = (kg, o) => scheiben(kg, o).proSeite;

/**
 * Beladungen für aufsteigende Gewichte mit wenig Umbauten: je Stufe die günstigere von „vorige + außen dazu“ und
 * „beste Einzelbeladung“. Rückgabe { stufen: [{ kg, scheiben, handgriffe }], summe, summeStandard }.
 */
export function stapelFolge(gewichte, o = {}) {
  const stange = o.stange ?? 20;
  let vorher = [], summe = 0, summeStandard = 0, standardVorher = [];
  const stufen = gewichte.map((kg) => {
    const standard = lade(kg, o);
    summeStandard += umbauten(standardVorher, standard); standardVorher = standard;
    const diff = (kg - stange) / 2 - vorher.reduce((s, x) => s + x, 0);
    const dazu = diff > 0 ? lade(stange + 2 * diff, o) : null;
    const anbau = dazu && Math.abs(stange + 2 * [...vorher, ...dazu].reduce((s, x) => s + x, 0) - kg) < 0.01 ? [...vorher, ...dazu] : null;
    const wahl = anbau && umbauten(vorher, anbau) < umbauten(vorher, standard) ? anbau : standard;
    const h = umbauten(vorher, wahl);
    summe += h; vorher = wahl;
    return { kg, scheiben: wahl, handgriffe: h };
  });
  return { stufen, summe, summeStandard };
}

/** Zwei Gewichte an einer Stange: schwer = leicht + außen. Rückgabe { leicht, schwer, aussen, handgriffe, handgriffeStandard }. */
export function zweiGewichte(a, b, o = {}) {
  const stange = o.stange ?? 20, leichtKg = Math.min(a, b), schwerKg = Math.max(a, b);
  const leicht = lade(leichtKg, o), aussen = lade(stange + (schwerKg - leichtKg), o);
  const schwer = [...leicht, ...aussen];
  const standardSchwer = lade(schwerKg, o);
  return { leicht, schwer, aussen, handgriffe: aussen.length, handgriffeStandard: umbauten(standardSchwer, leicht) };
}
