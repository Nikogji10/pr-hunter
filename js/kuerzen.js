// PR Hunter · „Wenig Zeit“ (Wunsch 192): laufendes Training auf eine Zielzeit kürzen. Hauptübungen (Kniebeuge, Bank,
// Kreuzheben und ihre Varianten) bleiben unverändert; beim Zubehör in dieser Reihenfolge, bis es passt:
// 1. höchstens 2 offene Sätze je Übung, 2. Zubehör paarweise als Supersatz, 3. Pausen beim Zubehör −30 % (Training merkt
// sich kurz: true), 4. die letzten Zubehörübungen ganz weglassen. Schätzung je offenem Satz: Pause + 40 s Satz.

const SATZ_S = 40;

/** Geschätzte Restdauer in Minuten. pauseFuer(karte, gruppe) → Sekunden. */
export function restMinuten(karten, pauseFuer, { kurz = false, istHaupt = () => false } = {}) {
  let s = 0;
  const runden = new Map();
  for (const k of karten) {
    if (!k.key) continue;
    for (const g of k.gruppen) {
      const offen = g.saetze.filter((x) => !x.erledigt).length;
      const p = pauseFuer(k, g) * (kurz && !istHaupt(k.key) ? 0.7 : 1);
      if (k.supersatz) { const r = runden.get(k.supersatz) ?? { saetze: 0, pause: 0 }; r.saetze += offen; r.pause = Math.max(r.pause, p); r.runden = Math.max(r.runden ?? 0, offen); runden.set(k.supersatz, r); }
      else s += offen * (SATZ_S + p);
    }
  }
  for (const r of runden.values()) s += r.saetze * SATZ_S + r.runden * r.pause;
  return Math.round(s / 60);
}

/** Kürzt auf ziel Minuten. Rückgabe { karten, schritte: [Text-Schlüssel], entfernt: [keys], minuten }. */
export function kuerzeTraining(kartenAlt, ziel, pauseFuer, istHaupt) {
  const karten = structuredClone(kartenAlt), schritte = [], entfernt = [];
  const zubehoer = () => karten.filter((k) => k.key && !istHaupt(k.key) && k.gruppen.some((g) => g.saetze.some((s) => !s.erledigt)));
  const dauer = (kurz = false) => restMinuten(karten, pauseFuer, { kurz, istHaupt });
  if (dauer() <= ziel || !zubehoer().length) return { karten, schritte, entfernt, minuten: dauer(), kurz: false, nurHaupt: !zubehoer().length };
  // 1. höchstens 2 offene Sätze je Zubehörübung
  let gekuerzt = false;
  for (const k of zubehoer()) for (const g of k.gruppen) {
    const offen = g.saetze.filter((s) => !s.erledigt);
    if (offen.length > 2) { g.saetze = [...g.saetze.filter((s) => s.erledigt), ...offen.slice(0, 2)]; gekuerzt = true; }
  }
  if (gekuerzt) schritte.push('saetze');
  // 2. Zubehör ohne Supersatz paarweise zusammenfassen
  if (dauer() > ziel) {
    const frei = zubehoer().filter((k) => !k.supersatz);
    let nr = Math.max(0, ...karten.map((k) => k.supersatz ?? 0));
    for (let i = 0; i + 1 < frei.length; i += 2) { nr += 1; frei[i].supersatz = nr; frei[i + 1].supersatz = nr; }
    // nebeneinander stellen, damit der Supersatz in der Reihenfolge stimmt
    for (let i = 0; i + 1 < frei.length; i += 2) {
      const a = karten.indexOf(frei[i]), b = karten.indexOf(frei[i + 1]);
      if (b !== a + 1) { karten.splice(b, 1); karten.splice(a + 1, 0, frei[i + 1]); }
    }
    if (frei.length > 1) schritte.push('supersatz');
  }
  // 3. kürzere Pausen beim Zubehör
  let kurz = false;
  if (dauer() > ziel && zubehoer().length) { kurz = true; schritte.push('pausen'); }
  // 4. letzte Zubehörübungen weglassen (Supersatz-Partner zusammen)
  while (dauer(kurz) > ziel) {
    const letzte = zubehoer().at(-1);
    if (!letzte) break;
    const weg = letzte.supersatz ? karten.filter((k) => k.supersatz === letzte.supersatz && !istHaupt(k.key)) : [letzte];
    for (const k of weg) {
      if (k.gruppen.some((g) => g.saetze.some((s) => s.erledigt))) { for (const g of k.gruppen) g.saetze = g.saetze.filter((s) => s.erledigt); }
      else karten.splice(karten.indexOf(k), 1);
      entfernt.push(k.key);
    }
  }
  if (entfernt.length) schritte.push('weg');
  return { karten, schritte, entfernt, minuten: dauer(kurz), kurz };
}
