// PR Hunter · Pausen-Balken (03.11.): Anteil = Restzeit ÷ (Ende − Beginn) – läuft gleichmäßig auf null. ±30 s verschieben nur das Ende;
// +30 nach Ablauf startet eine neue kurze Pause (Beginn = jetzt), damit der Balken wieder voll ist.
const pauseBeginn = (t) => t.beginn ?? t.ende - t.dauer * 1000;
export const pauseAnteil = (t) => { const ganz = t.ende - pauseBeginn(t); return ganz > 0 ? Math.max(0, Math.min(1, (t.ende - Date.now()) / ganz)) : 0; };
export const pauseMinus = (t) => ({ ...t, beginn: pauseBeginn(t), ende: t.ende - 30000, dauer: Math.max(0, t.dauer - 30) });
export const pausePlus = (t) => {
  const jetzt = Date.now(), vorbei = t.ende <= jetzt;
  return { ...t, beginn: vorbei ? jetzt : pauseBeginn(t), ende: (vorbei ? jetzt : t.ende) + 30000, fertig: false, dauer: vorbei ? 30 : t.dauer + 30 };
};

