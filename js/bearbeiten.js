// PR Hunter · Umbauten an einem Programm für den Editor (ui/editor.js): Wochen duplizieren und löschen mit
// Nachrücken der Tage, Wochennummern neu vergeben, benötigte Maxe aus den Lastformeln.

/** Wochennummern neu vergeben (1, 2, …) und Verweise alternative_to mitziehen. */
export function nummeriere(weeks) {
  const neu = new Map(weeks.map((w, i) => [w.week, i + 1]));
  return weeks.map((w, i) => ({ ...w, week: i + 1, title: (w.title ?? '').replace(/^(Woche|Week) \d+/, (m, wort) => `${wort} ${i + 1}`),
    ...(w.alternative_to != null ? { alternative_to: neu.get(w.alternative_to) ?? w.alternative_to } : {}) }));
}

// Liegt Woche i hinter der Stelle ab? Eine Alternativwoche liegt dort, wo die Woche liegt, die sie ersetzt.
const dahinter = (weeks, i, ab) => {
  const ziel = weeks[i].alternative_to != null ? weeks.findIndex((x) => x.week === weeks[i].alternative_to) : i;
  return (ziel < 0 ? i : ziel) > ab;
};

/** Woche duplizieren: Kopie direkt dahinter, alle folgenden Tage rücken eine Woche nach hinten. */
export function dupliziereWoche(prog, wi) {
  const weeks = structuredClone(prog.weeks);
  const kopie = structuredClone(weeks[wi]);
  delete kopie.alternative_to;
  for (const d of kopie.days) d.offset += 7;
  for (let i = wi + 1; i < weeks.length; i++) if (dahinter(weeks, i, wi)) for (const d of weeks[i].days) d.offset += 7;
  weeks.splice(wi + 1, 0, { ...kopie, week: weeks[wi].week + 0.5 });
  return { ...prog, weeks: nummeriere(weeks) };
}

/** Woche löschen: die folgenden Tage rücken eine Woche nach vorn (außer bei einer Alternativwoche, die nichts belegt). */
export function loescheWoche(prog, wi) {
  const weeks = structuredClone(prog.weeks);
  if (!weeks[wi].alternative_to) for (let i = wi + 1; i < weeks.length; i++) if (dahinter(weeks, i, wi)) for (const d of weeks[i].days) d.offset -= 7;
  const [weg] = weeks.splice(wi, 1);
  return { ...prog, weeks: nummeriere(weeks.filter((w) => w.alternative_to !== weg.week)) };
}

/** Zum Speichern: leere Tage weg, Maxe aus den Formeln. */
export const bereinigt = (prog) => {
  const p = { ...prog, weeks: prog.weeks.map((w) => ({ ...w, days: w.days.filter((d) => d.items.length) })) };
  return { ...p, inputs: eingabenVon(p) };
};

/** Maxe, die das Programm braucht: die bisherigen plus alle Variablen in den Lastformeln. */
export function eingabenVon(prog) {
  const v = new Set(prog.inputs ?? []);
  for (const w of prog.weeks) for (const d of w.days) for (const it of d.items) for (const g of it.groups) for (const x of String(g.load ?? '').match(/\b[SBDG]\b/g) ?? []) v.add(x);
  return ['S', 'B', 'D', 'G'].filter((x) => v.has(x));
}
