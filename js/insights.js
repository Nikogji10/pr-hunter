// PR Hunter · Trainings-Analysen wie die „Insights“ in Jefit (Wunsch 181): Serie, letzte Einheit (Muskeln, Score,
// Intensität, Erholung, Zeitnutzung), 1RM-Veränderung, Sätze je Muskel, Trainingszeit, Wochenvergleich.
// Reine Rechnungen ohne Oberfläche; Muskeln und Pausen kommen als Funktionen herein (Katalog/Einstellungen der App).
import { montagVon, plusTage, tageZwischen } from './daten.js';
export { montagVon };

/** Katalogmuskeln (free-exercise-db) → Gruppen der Analyse. */
export const GRUPPE_VON = {
  chest: 'brust', lats: 'ruecken', 'middle back': 'ruecken', 'lower back': 'ruecken', traps: 'ruecken', neck: 'ruecken',
  shoulders: 'schultern', biceps: 'bizeps', triceps: 'trizeps', forearms: 'unterarme',
  quadriceps: 'beine', hamstrings: 'beine', adductors: 'beine', abductors: 'beine', glutes: 'gesaess', calves: 'waden', abdominals: 'bauch',
};
export const IDEAL = [10, 20];          // harte Sätze je Muskel und Woche für Muskelaufbau

const zahl = (x) => (x == null || x === '' ? null : Number(x));
const ms = (x) => (x == null ? null : typeof x === 'number' ? x : Date.parse(x));
/** Gleiche Näherung wie die Rekord-Chronik (Epley), nur bis 12 Wdh sinnvoll. */
export const e1 = (s) => (s.kg > 0 && s.wdh > 0 && s.wdh <= 12 ? (s.kg * (30 + s.wdh)) / 30 : null);

/**
 * Trainings der App (oder Tage aus den Beispieldaten) → Einheiten: { datum, start, ende (ms), uebungen: [{ key, saetze }] },
 * nur erledigte Arbeitssätze, nach Datum sortiert.
 */
export function normiere(trainings) {
  return trainings.filter((t) => t && !t.geloescht && t.datum).map((t) => ({
    datum: t.datum, start: ms(t.start), ende: ms(t.ende),
    uebungen: (t.uebungen ?? []).map((u) => ({ key: u.key, saetze: (u.saetze ?? []).filter((s) => s.fertig !== false && s.typ !== 'warmup')
      .map((s) => ({ kg: zahl(s.kg), wdh: zahl(s.wdh), rpe: zahl(s.rpe), zeit: ms(s.zeit) })) })).filter((u) => u.saetze.length),
  })).filter((e) => e.uebungen.length).sort((a, b) => a.datum.localeCompare(b.datum) || (a.start ?? 0) - (b.start ?? 0));
}

export const minuten = (e) => (e.start && e.ende && e.ende > e.start ? (e.ende - e.start) / 60000 : null);
const volumen = (e) => e.uebungen.reduce((a, u) => a + u.saetze.reduce((b, s) => b + (s.kg > 0 ? s.kg : 0) * (s.wdh ?? 0), 0), 0);
const saetzeVon = (e) => e.uebungen.reduce((a, u) => a + u.saetze.length, 0);

/** Rekorde: Tag, an dem eine Übung ihr bestes e1RM übertrifft (erster Tag zählt nicht). */
export function rekorde(einheiten) {
  const best = new Map(), aus = [];
  for (const e of einheiten) {
    const heute = new Map();
    for (const u of e.uebungen) for (const s of u.saetze) { const w = e1(s); if (w != null && w > (heute.get(u.key) ?? -Infinity)) heute.set(u.key, w); }
    for (const [key, w] of heute) {
      const vorher = best.get(key);
      if (vorher != null && w > vorher) aus.push({ datum: e.datum, key, e1rm: w, vorher });
      if (vorher == null || w > vorher) best.set(key, w);
    }
  }
  return aus;
}

// #################################################################
// a) Trainings-Serie: Wochen in Folge mit mindestens einem Training
// #################################################################
/** Wochen in Folge mit mindestens einem Training (laufende Woche darf noch leer sein) – gleiche Zahl auf Heute und in der Analyse. */
export function wochenSerie(daten, heute) {
  const wochen = new Set(daten.map((d) => montagVon(d)));
  let w = montagVon(heute);
  if (!wochen.has(w)) w = plusTage(w, -7);
  let aktuell = 0, beginn = null;
  while (wochen.has(w)) { aktuell += 1; beginn = w; w = plusTage(w, -7); }
  let laengste = 0, lauf = 0, vor = null;
  for (const x of [...wochen].sort()) { lauf = vor && tageZwischen(vor, x) === 7 ? lauf + 1 : 1; laengste = Math.max(laengste, lauf); vor = x; }
  return { aktuell, beginn, laengste };
}

/** Alle Trainingstage und -stunden seit Beginn. Trainings ohne Start/Ende (z. B. Import) zählen mit der mittleren Dauer der übrigen. */
export function gesamt(einheiten) {
  const tage = new Set(einheiten.map((e) => e.datum)).size;
  const mins = einheiten.map(minuten).filter((m) => m != null && m < 600);
  const ohne = einheiten.length - mins.length;
  const sortiert = [...mins].sort((a, b) => a - b), mitte = sortiert.length ? sortiert[Math.floor(sortiert.length / 2)] : 60;
  return { tage, stunden: (mins.reduce((a, b) => a + b, 0) + ohne * mitte) / 60, geschaetzt: ohne > 0 };
}

export function serie(einheiten, heute) {
  const { aktuell, beginn, laengste } = wochenSerie(einheiten.map((e) => e.datum), heute);
  const inSerie = beginn ? einheiten.filter((e) => e.datum >= beginn) : [];
  const tage = [...new Set(inSerie.map((e) => e.datum))];
  const mins = inSerie.map(minuten).filter((m) => m != null);
  const rek = beginn ? rekorde(einheiten).filter((r) => r.datum >= beginn).length : 0;
  // Kalenderraster: höchstens 26 Wochen, Stufe 1–4 nach Trainingsdauer (ohne Zeiten nach Volumen)
  // Raster: Wochen der laufenden Serie (höchstens 26), ohne Serie die letzten 12 Wochen
  const ab = !beginn ? plusTage(montagVon(heute), -11 * 7) : beginn > plusTage(montagVon(heute), -25 * 7) ? beginn : plusTage(montagVon(heute), -25 * 7);
  const jeTag = new Map();
  for (const e of einheiten) if (e.datum >= ab) jeTag.set(e.datum, (jeTag.get(e.datum) ?? 0) + (minuten(e) ?? volumen(e) / 100));
  const max = Math.max(1, ...jeTag.values());
  const raster = [];
  for (let m = ab; m <= montagVon(heute); m = plusTage(m, 7)) {
    raster.push({ montag: m, tage: Array.from({ length: 7 }, (_, i) => {
      const d = plusTage(m, i), v = jeTag.get(d);
      return { datum: d, zukunft: d > heute, stufe: !v ? 0 : v / max < 0.35 ? 1 : v / max < 0.6 ? 2 : v / max < 0.85 ? 3 : 4 };
    }) });
  }
  const zeit14 = Array.from({ length: 14 }, (_, i) => { const d = plusTage(heute, i - 13); return { datum: d, min: einheiten.filter((e) => e.datum === d).reduce((a, e) => a + (minuten(e) ?? 0), 0) }; });
  const zaehler = new Map();
  for (const e of inSerie) for (const u of e.uebungen) zaehler.set(u.key, (zaehler.get(u.key) ?? 0) + 1);
  const top = [...zaehler].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key, n]) => ({ key, n }));
  return { wochen: aktuell, laengste, beginn, tage: tage.length, gesamt: gesamt(einheiten), tageProWoche: aktuell ? tage.length / aktuell : 0,
    minutenSchnitt: mins.length ? mins.reduce((a, b) => a + b, 0) / mins.length : null, rekordeProWoche: aktuell ? rek / aktuell : 0, raster, zeit14, top };
}

/** Alle Trainings von … bis zusammen: Muskelgruppen (Summen), Ø Score/Intensität/Erholung/Zeitnutzung, Zeit summiert. */
export function wochenEinheitAnalyse(einheiten, von, bis, opts) {
  const stufe = (v) => (v < 0.4 ? 'niedrig' : v < 0.75 ? 'mittel' : 'hoch');
  const mittel = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
  const liste = [];
  einheiten.forEach((e, i) => { if (e.datum >= von && e.datum <= bis) liste.push({ e, a: einheitAnalyse(einheiten.slice(0, i + 1), bis, opts) }); });
  if (!liste.length) return { anzahl: 0, von, bis };
  const gruppen = new Map();
  for (const { a } of liste) for (const m of a.muskeln) {
    const x = gruppen.get(m.gruppe) ?? { gruppe: m.gruppe, volumen: 0, saetze: 0, minuten: 0, rekorde: 0 };
    x.volumen += m.volumen; x.saetze += m.saetze; x.minuten += m.minuten; x.rekorde += m.rekorde;
    gruppen.set(m.gruppe, x);
  }
  const mitZeit = liste.filter(({ a }) => a.zeit);
  const summe = (k) => mitZeit.reduce((s, { a }) => s + a.zeit[k], 0);
  const sek = summe('gesamt'), frei = summe('ungenutzt'), saetze = mitZeit.reduce((s, { e }) => s + saetzeVon(e), 0);
  const zeit = mitZeit.length ? { gesamt: sek, aktiv: summe('aktiv'), pause: summe('pause'), laden: summe('laden'), ungenutzt: frei,
    nutzung: sek ? (sek - frei) / sek : 0, mehrPauseJeSatz: saetze ? frei / saetze : 0 } : null;
  const intens = mittel(liste.map(({ a }) => a.intensitaet.wert)), erhol = mittel(liste.map(({ a }) => a.erholung.wert));
  const nutz = mittel(liste.filter(({ a }) => a.nutzung).map(({ a }) => a.nutzung.wert));
  return { anzahl: liste.length, von, bis, minuten: liste.reduce((s, { e }) => s + (minuten(e) ?? 0), 0),
    muskeln: [...gruppen.values()].sort((a, b) => b.saetze - a.saetze || b.volumen - a.volumen),
    score: Math.round(mittel(liste.map(({ a }) => a.score))),
    intensitaet: { wert: intens, stufe: stufe(intens) }, erholung: { wert: erhol, stufe: stufe(erhol), belastet: liste.reduce((s, { a }) => s + a.erholung.belastet, 0) },
    nutzung: nutz == null ? null : { wert: nutz, stufe: stufe(nutz) }, zeit,
    einheiten: liste.map(({ e, a }) => ({ e, z: a.zeit })) };
}

// #################################################################
// e) Trainingszeit: aktiv / Pause / Laden / ungenutzt
// #################################################################
export function zeitAnalyse(e, pauseVon) {
  const gesamt = minuten(e);
  if (gesamt == null) return null;
  const sek = gesamt * 60;
  let aktiv = 0, pause = 0, laden = 0;
  for (const u of e.uebungen) {
    u.saetze.forEach((s, i) => {
      aktiv += Math.max(20, (s.wdh ?? 5) * 4);                      // ca. 4 s je Wiederholung
      laden += 15;                                                   // Scheiben, Gerät einstellen
      if (i < u.saetze.length - 1) pause += pauseVon(u.key) ?? 120;  // geplante Pause zwischen den Sätzen
    });
  }
  const genutzt = Math.min(sek, aktiv + pause + laden);
  const n = saetzeVon(e);
  return { gesamt: sek, aktiv: Math.min(aktiv, sek), pause: Math.min(pause, Math.max(0, sek - aktiv)), laden: Math.min(laden, Math.max(0, sek - aktiv - pause)),
    ungenutzt: Math.max(0, sek - genutzt), nutzung: sek ? genutzt / sek : 0, mehrPauseJeSatz: n ? Math.max(0, sek - genutzt) / n : 0 };
}

// #################################################################
// b) Letzte Einheit: Muskeln, Score, Intensität, Erholung, Zeitnutzung
// #################################################################
export function einheitAnalyse(einheiten, heute, { muskelnVon, pauseVon }) {
  const e = einheiten.at(-1);
  if (!e) return null;
  const rek = rekorde(einheiten).filter((r) => r.datum === e.datum);
  const gruppen = new Map();
  const gruppenVon = (key) => [...new Set((muskelnVon(key) ?? []).map((m) => GRUPPE_VON[m]).filter(Boolean))];
  for (const u of e.uebungen) {
    const gs = gruppenVon(u.key);
    const zeiten = u.saetze.map((s) => s.zeit).filter(Boolean);
    const dauer = zeiten.length > 1 ? (Math.max(...zeiten) - Math.min(...zeiten)) / 60000 + 1 : u.saetze.length * 2.5;
    for (const g of gs) {
      const x = gruppen.get(g) ?? { gruppe: g, volumen: 0, saetze: 0, minuten: 0, rekorde: 0 };
      x.volumen += u.saetze.reduce((a, s) => a + (s.kg > 0 ? s.kg : 0) * (s.wdh ?? 0), 0);
      x.saetze += u.saetze.length; x.minuten += dauer / gs.length;
      x.rekorde += rek.filter((r) => r.key === u.key).length;
      gruppen.set(g, x);
    }
  }
  const muskeln = [...gruppen.values()].sort((a, b) => b.saetze - a.saetze || b.volumen - a.volumen);
  // Intensität aus der RPE (ohne RPE: Anteil am bisherigen besten e1RM)
  const rpes = e.uebungen.flatMap((u) => u.saetze.map((s) => s.rpe)).filter((r) => r != null);
  let intens;
  if (rpes.length) intens = Math.max(0, Math.min(1, (rpes.reduce((a, b) => a + b, 0) / rpes.length - 5) / 5));
  else {
    const best = new Map();
    for (const x of einheiten.slice(0, -1)) for (const u of x.uebungen) for (const s of u.saetze) { const w = e1(s); if (w != null) best.set(u.key, Math.max(best.get(u.key) ?? 0, w)); }
    const ant = e.uebungen.flatMap((u) => u.saetze.map((s) => (best.get(u.key) && s.kg > 0 ? e1(s) / best.get(u.key) : null))).filter((v) => v != null);
    intens = ant.length ? Math.max(0, Math.min(1, (ant.reduce((a, b) => a + b, 0) / ant.length - 0.7) / 0.3)) : 0.5;
  }
  // Erholung: Gruppen dieser Einheit, die in den 2 Tagen davor schon dran waren
  const davor = einheiten.filter((x) => x !== e && x.datum < e.datum && tageZwischen(x.datum, e.datum) <= 2);
  const vorher = new Set(davor.flatMap((x) => x.uebungen.flatMap((u) => gruppenVon(u.key))));
  const belastet = muskeln.filter((m) => vorher.has(m.gruppe)).length;
  const erhol = muskeln.length ? 1 - belastet / muskeln.length : 1;
  const zeit = zeitAnalyse(e, pauseVon);
  const nutz = zeit ? Math.max(0, Math.min(1, zeit.nutzung)) : null;
  const letzte10 = einheiten.slice(-11, -1).map(volumen).filter((v) => v > 0);
  const volRel = letzte10.length ? Math.min(1, volumen(e) / (letzte10.reduce((a, b) => a + b, 0) / letzte10.length)) : 0.7;
  const score = Math.round(100 * (0.35 * intens + 0.25 * erhol + 0.2 * (nutz ?? 0.6) + 0.2 * volRel));
  const stufe = (v) => (v < 0.4 ? 'niedrig' : v < 0.75 ? 'mittel' : 'hoch');
  const woche = einheiten.filter((x) => x.datum >= montagVon(heute) && x.datum <= heute);
  return { einheit: e, muskeln, score, intensitaet: { wert: intens, stufe: stufe(intens) }, erholung: { wert: erhol, stufe: stufe(erhol), belastet },
    zeit, nutzung: nutz == null ? null : { wert: nutz, stufe: stufe(nutz) },
    woche: { anzahl: woche.length, minuten: woche.reduce((a, x) => a + (minuten(x) ?? 0), 0) } };
}

// #################################################################
// c) 1RM-Veränderung der letzten 7 Tage
// #################################################################
export function einsRmAnalyse(einheiten, heute, tage = 7) {
  const ab = plusTage(heute, -(tage - 1));
  const vorher = new Map(), neu = new Map();
  for (const e of einheiten) {
    for (const u of e.uebungen) for (const s of u.saetze) {
      const w = e1(s); if (w == null) continue;
      if (e.datum < ab) { const v = vorher.get(u.key); if (!v || w > v.wert) vorher.set(u.key, { wert: w, datum: e.datum }); }
      else if (e.datum <= heute) { const n = neu.get(u.key); if (!n || w > n.wert) neu.set(u.key, { wert: w, datum: e.datum }); }
    }
  }
  const aenderungen = [...neu].filter(([k]) => vorher.has(k)).map(([key, n]) => ({ key, neu: n, vorher: vorher.get(key), diff: n.wert - vorher.get(key).wert, prozent: (n.wert / vorher.get(key).wert - 1) * 100 }));
  const proTag = Array.from({ length: tage }, (_, i) => { const d = plusTage(ab, i); return { datum: d, diff: aenderungen.filter((a) => a.neu.datum === d).reduce((s, a) => s + a.diff, 0) }; });
  return { summe: aenderungen.reduce((s, a) => s + a.diff, 0), proTag, top: aenderungen.filter((a) => a.diff > 0).sort((a, b) => b.prozent - a.prozent).slice(0, 3), anzahl: aenderungen.length };
}

// #################################################################
// d) Sätze je Muskel in den letzten 7 Tagen (Hauptmuskeln)
// #################################################################
export function saetzeJeMuskel(einheiten, heute, muskelnVon, tage = 7) {
  const ab = plusTage(heute, -(tage - 1)), z = new Map();
  for (const e of einheiten) {
    if (e.datum < ab || e.datum > heute) continue;
    for (const u of e.uebungen) for (const g of new Set((muskelnVon(u.key) ?? []).map((m) => GRUPPE_VON[m]).filter(Boolean))) z.set(g, (z.get(g) ?? 0) + u.saetze.length);
  }
  const liste = [...z].map(([gruppe, saetze]) => ({ gruppe, saetze })).sort((a, b) => b.saetze - a.saetze);
  return { liste, erreicht: liste.filter((x) => x.saetze >= IDEAL[0]), unter: liste.filter((x) => x.saetze < IDEAL[0]).sort((a, b) => a.saetze - b.saetze) };
}

// #################################################################
// f) Diese Woche gegen letzte Woche
// #################################################################
export function wochenVergleich(einheiten, heute, { abgeschlossen = false } = {}) {
  // abgeschlossen: letzte volle Woche gegen die davor (die laufende Woche erst, wenn sie vorbei ist)
  const m = plusTage(montagVon(heute), abgeschlossen ? -7 : 0), vor = plusTage(m, -7);
  if (abgeschlossen) heute = plusTage(m, 6);
  const rek = rekorde(einheiten);
  const werte = (von, bis) => {
    const es = einheiten.filter((e) => e.datum >= von && e.datum <= bis);
    const mins = es.map(minuten).filter((x) => x != null);
    return { einheiten: es.length, rekorde: rek.filter((r) => r.datum >= von && r.datum <= bis).length,
      volumen: es.length ? es.reduce((a, e) => a + volumen(e), 0) / es.length : 0, minuten: mins.length ? mins.reduce((a, b) => a + b, 0) / mins.length : 0 };
  };
  return { diese: werte(m, heute), letzte: werte(vor, plusTage(m, -1)), von: m, bis: heute, abgeschlossen };
}

// #################################################################
// g) Bewegungsmuster: Sätze je Muster in einer Woche (Sechseck + Drücken/Ziehen je Tag, wie Jefit)
// #################################################################
/** Reihenfolge im Sechseck: oben, dann im Uhrzeigersinn – Gegenüber liegen Kniebeuge/Hinge, Drücken/Ziehen vertikal, Ziehen/Drücken horizontal. */
export const MUSTER = ['squat', 'vPush', 'hPull', 'hinge', 'vPull', 'hPush'];
const MUSTER_VON_ART = { squat: 'squat', squat_machine: 'squat', lunge: 'squat', deadlift: 'hinge', hinge: 'hinge',
  bench: 'hPush', push_up: 'hPush', dip: 'hPush', fly: 'hPush', press: 'vPush', row: 'hPull', pull_up: 'vPull', pulldown: 'vPull' };

/** Muster einer Übung aus ihrer Katalog-Art (f); Aufrechtrudern zählt zur Schulter, nicht zum Rudern. */
export const musterVon = (art, key = '') => (/upright|aufrecht/i.test(key) ? null : MUSTER_VON_ART[art] ?? null);

/** Sätze je Muster und Wochentag ab montag (7 Tage); artVon(key) liefert die Katalog-Art. */
export function bewegungsmuster(einheiten, montag, artVon) {
  const leer = () => Object.fromEntries(MUSTER.map((m) => [m, 0]));
  const tage = Array.from({ length: 7 }, (_, i) => ({ datum: plusTage(montag, i), ...leer() }));
  const summe = leer();
  for (const e of einheiten) {
    const i = tageZwischen(montag, e.datum);
    if (i < 0 || i > 6) continue;
    for (const u of e.uebungen) {
      const m = musterVon(artVon(u.key), u.key);
      if (m) { tage[i][m] += u.saetze.length; summe[m] += u.saetze.length; }
    }
  }
  const push = summe.hPush + summe.vPush, pull = summe.hPull + summe.vPull, unter = summe.squat + summe.hinge;
  return { tage, summe, push, pull, ober: push + pull, unter, gesamt: push + pull + unter };
}

/** Ø je Trainingswoche über den ganzen Verlauf: alle Sätze je Muster und Wochentag ÷ Zahl der Wochen mit Training. */
export function bewegungsmusterSchnitt(einheiten, artVon) {
  const wochen = [...new Set(einheiten.map((e) => montagVon(e.datum)))];
  if (!wochen.length) return { ...bewegungsmuster([], '2000-01-03', artVon), wochen: 0 };
  // alle Wochen auf eine Woche legen (Datum relativ zum eigenen Montag), dann teilen
  const B = '2000-01-03';                                                   // ein Montag
  const gefaltet = einheiten.map((e) => ({ ...e, datum: plusTage(B, tageZwischen(montagVon(e.datum), e.datum)) }));
  const b = bewegungsmuster(gefaltet, B, artVon), n = wochen.length, teile = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? v / n : v]));
  return { tage: b.tage.map(teile), summe: teile(b.summe), push: b.push / n, pull: b.pull / n, ober: b.ober / n, unter: b.unter / n, gesamt: b.gesamt / n, wochen: n };
}
