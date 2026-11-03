// PR Hunter · Notiz-Chips beim Beenden (Wunsch 210): kurze Anlässe mit einem Tipp, vorne in der Trainingsnotiz
// („Schlecht geschlafen · Rücken zwickt · eigener Text“). Gespeichert als Text in workouts.notes – keine neue Spalte;
// erkannt werden beide Sprachen, damit die Statistik danach filtern kann.

export const NOTIZ_CHIPS = [
  ['schlaf', 'Schlecht geschlafen', 'Slept badly'], ['muede', 'Müde', 'Tired'], ['stress', 'Viel Stress', 'Lots of stress'],
  ['zwickt', 'Etwas zwickt', 'Something hurts'], ['krank', 'Angeschlagen', 'Under the weather'], ['eilig', 'Wenig Zeit', 'Short on time'],
  ['stark', 'Fühlte mich stark', 'Felt strong'], ['super', 'Super Tag', 'Great day'],
];
const TRENNER = ' · ';
const VON_TEXT = new Map(NOTIZ_CHIPS.flatMap(([id, de, en]) => [[de.toLowerCase(), id], [en.toLowerCase(), id]]));

/** Notiz → { ids: Chip-Kennungen vorne, rest: freier Text }. */
export function chipsAus(notiz) {
  const teile = String(notiz ?? '').split(TRENNER), ids = [];
  while (teile.length && VON_TEXT.has(teile[0].trim().toLowerCase())) ids.push(VON_TEXT.get(teile.shift().trim().toLowerCase()));
  return { ids: [...new Set(ids)], rest: teile.join(TRENNER).trim() };
}

/** Chips + freier Text → Notiz (oder null, wenn beides leer). */
export function mitChips(ids, rest, en = false) {
  const texte = NOTIZ_CHIPS.filter(([id]) => ids.includes(id)).map(([, de, e]) => (en ? e : de));
  const t = [...texte, String(rest ?? '').trim()].filter(Boolean).join(TRENNER);
  return t || null;
}
