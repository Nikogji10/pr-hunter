// PR Hunter · Pausen-Balken (03.11.): Anteil = Restzeit ÷ (Ende − Beginn) – läuft gleichmäßig auf null.
// Nach −30/+30 ist der Balken wieder voll (Beginn = jetzt) und läuft relativ zur neu angezeigten Zeit ab:
// 4:00 voll → 2:00 halb; +30 → 4:30 voll → 2:15 halb (Nikos Vorgabe).
const pauseBeginn = (t) => t.beginn ?? t.ende - t.dauer * 1000;
export const pauseAnteil = (t) => { const ganz = t.ende - pauseBeginn(t); return ganz > 0 ? Math.max(0, Math.min(1, (t.ende - Date.now()) / ganz)) : 0; };
export const pauseMinus = (t) => {
  const jetzt = Date.now(), ende = Math.max(jetzt, t.ende - 30000);
  return { ...t, beginn: jetzt, ende, dauer: Math.max(0, Math.round((ende - jetzt) / 1000)) };
};
export const pausePlus = (t) => {
  const jetzt = Date.now(), ende = Math.max(t.ende, jetzt) + 30000;
  return { ...t, beginn: jetzt, ende, fertig: false, dauer: Math.round((ende - jetzt) / 1000) };
};
