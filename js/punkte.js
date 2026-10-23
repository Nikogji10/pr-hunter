// PR Hunter · Punkteformeln für Total und Körpergewicht (Männer m, Frauen w).
// DOTS (Tim Konertz, wie OpenPowerlifting), IPF GoodLift für Classic Powerlifting (Stand 2020), Wilks (Original 1990er).
import { runde } from './rechnen.js';

const DOTS = {
  m: { k: [-0.000001093, 0.0007391293, -0.1918759221, 24.0900756, -307.75076], min: 40, max: 210 },
  w: { k: [-0.0000010706, 0.0005158568, -0.1126655495, 13.6175032, -57.96288], min: 40, max: 150 },
};
/** DOTS-Punkte; Körpergewicht wird wie bei OpenPowerlifting auf den gültigen Bereich begrenzt. */
export function dots(total, kg, geschlecht = 'm') {
  if (!(total > 0) || !(kg > 0)) return null;
  const { k, min, max } = DOTS[geschlecht];
  const b = Math.min(max, Math.max(min, kg));
  return runde((total * 500) / (k[0] * b ** 4 + k[1] * b ** 3 + k[2] * b ** 2 + k[3] * b + k[4]), 2);
}

const GL = { m: [1199.72839, 1025.18162, 0.00921], w: [610.32796, 1045.59282, 0.03048] };
/** IPF-GoodLift-Punkte (Classic Powerlifting, also ohne Equipment). */
export function ipfGl(total, kg, geschlecht = 'm') {
  if (!(total > 0) || !(kg > 35)) return null;
  const [a, b, c] = GL[geschlecht];
  return runde((total * 100) / (a - b * Math.exp(-c * kg)), 2);
}

const WILKS = {
  m: [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 7.01863e-6, -1.291e-8],
  w: [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 4.731582e-5, -9.054e-8],
};
export function wilksPunkte(total, kg, geschlecht = 'm') {
  if (!(total > 0) || !(kg > 0)) return null;
  const k = WILKS[geschlecht];
  return runde((total * 500) / k.reduce((s, c, i) => s + c * kg ** i, 0), 2);
}

/** Versuchsplaner: aus dem Ziel für den 3. Versuch ca. 91 % und 96 % (Strategie nach Matt Gary), gerundet auf die Steigerung. */
export function versuche(ziel, inc = 2.5) {
  if (!(ziel > 0)) return null;
  const r = (x) => Math.round(x / inc) * inc;
  return [r(ziel * 0.91), r(ziel * 0.96), r(ziel)];
}
