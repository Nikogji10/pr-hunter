// PR Hunter · Auswertungsstand aus den gespeicherten Trainings: Kalender, Verlauf, Statistik, Vorschläge im Training.
// Gerechnet wird wie in der Datenbank-View v_sets: nur erledigte Sätze, Aufwärmsätze zählen nicht,
// Körpergewichtsübungen über die Gesamtlast (Körpergewicht aus dem Training, sonst der zeitlich nächste Messwert).
//
// Lokales Training (IndexedDB, Abgleich über js/sync.js):
//   { id, clientId, datum: 'JJJJ-MM-TT', start, ende (ISO), sessionRpe, koerpergewicht, notiz, quelle, runId, woche, tagOffset,
//     uebungen: [{ id, key, notiz, saetze: [{ id, typ, kg, wdh, rpe, fertig, zeit, geplant }] }], offen, geloescht }
import { e1rm } from './rechnen.js';

// Jefit kannte keine Wettkampfübungen: diese Einträge zählen als Wettkampf-Kniebeuge, -Bankdrücken, -Kreuzheben
export const GLEICH = {
  barbell_squat: 'competition_squat',
  'barbell_bench_press_-_medium_grip': 'competition_bench_press',
  barbell_deadlift: 'competition_deadlift',
};
export const kanon = (key) => GLEICH[key] ?? key;
export const HAUPT = { squat: 'competition_squat', bench: 'competition_bench_press', dead: 'competition_deadlift' };
const LIFTS = Object.keys(HAUPT);
const AKTUELL_TAGE = 84;            // aktuelle Form (Vorschläge, INOL, harte Sätze): bester Wert der letzten 12 Wochen
const REKORD_WDH = 10;

export const plusTage = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const wochentag = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();   // 0 = So
export const montagVon = (iso) => plusTage(iso, -((wochentag(iso) + 6) % 7));
export const tageZwischen = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
const zahl = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
const datumKurz = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const satzText = (s, mitKg = false) => `${zahl(s.kg ?? 0)}${mitKg ? ' kg' : ''} × ${s.wdh}${s.rpe != null && !mitKg ? ` @ ${zahl(s.rpe)}` : ''}`;
/** Bester Satz: höchstes e1RM, ohne e1RM das höchste Gewicht, dann mehr Wdh. */
const besser = (a, b) => !b || (a.e1rm ?? -1) > (b.e1rm ?? -1)
  || ((a.e1rm ?? -1) === (b.e1rm ?? -1) && ((a.kg ?? 0) > (b.kg ?? 0) || ((a.kg ?? 0) === (b.kg ?? 0) && (a.wdh ?? 0) > (b.wdh ?? 0))));

/** Körpergewicht zum Datum: zeitlich nächster Messwert, bei gleichem Abstand der spätere (wie v_sets). */
export function koerperAm(datum, messwerte) {
  let best = null, abstand = Infinity;
  for (const m of messwerte) {
    if (!(m.kg > 0)) continue;
    const a = Math.abs(tageZwischen(m.datum, datum));
    if (a < abstand || (a === abstand && m.datum > best.datum)) { best = m; abstand = a; }
  }
  return best?.kg ?? null;
}

const KOERPER = new Set(['bodyweight_plus', 'bodyweight_minus']);
/** Satz für die Auswertung: last = Gesamtlast (bei Körpergewichtsübungen Körpergewicht ± Zusatz). */
function satzWerte(s, art, koerper, formel = 'rpe') {
  const kg = s.kg ?? null, wdh = s.wdh ?? null, rpe = s.rpe ?? null;
  let last = kg;
  if (KOERPER.has(art)) last = koerper > 0 ? (art === 'bodyweight_plus' ? koerper + (kg ?? 0) : koerper - (kg ?? 0)) : null;
  return { kg, wdh, rpe, typ: s.typ ?? 'working', last, e1rm: e1rm(last, wdh, rpe, formel), notiz: s.notiz ?? null, extra: s.extra ?? null };
}

/**
 * Auswertungsstand für die Oberfläche (gleiche Formen wie die Beispieldaten des Prototyps).
 * trainings: lokale Trainings; messwerte: [{ datum, kg }] aus body_metrics; heute: 'JJJJ-MM-TT'.
 */
export function erstelleStand(trainings, { heute, katalog = [], messwerte = [], koerpergewicht = null, urlaub = null, minWochen = 52, formel = 'rpe' } = {}) {
  const art = new Map(katalog.map((e) => [e.k, e.lt]));
  const basis = new Map(katalog.map((e) => [e.k, e.b]));
  const liftVon = (key) => ({ squat: 'squat', bench: 'bench', deadlift: 'dead' })[basis.get(key)] ?? 'andere';

  // #################################################################
  // Trainings zu Tagen zusammenfassen (an einem Datum können mehrere Einheiten liegen)
  // #################################################################
  const sortiert = trainings.filter((t) => !t.geloescht && t.datum)
    .sort((a, b) => a.datum.localeCompare(b.datum) || String(a.start ?? '').localeCompare(String(b.start ?? '')));
  const tage = new Map();
  for (const t of sortiert) {
    const koerper = t.koerpergewicht ?? koerperAm(t.datum, messwerte) ?? koerpergewicht;
    const uebungen = [];
    for (const u of t.uebungen ?? []) {
      const key = kanon(u.key);
      const fertig = (u.saetze ?? []).filter((s) => s.fertig !== false).map((s) => satzWerte(s, art.get(u.key) ?? art.get(key), koerper, formel));
      if (!fertig.length) continue;
      uebungen.push({ key, lift: liftVon(key), saetze: fertig.filter((s) => s.typ !== 'warmup'), aufwaermen: fertig.filter((s) => s.typ === 'warmup'),
        e1rm: null, notiz: u.notiz ?? null, supersatz: u.supersatz ?? null });
    }
    if (!uebungen.length) continue;                   // ohne erledigten Satz kein Trainingstag
    const minuten = t.start && t.ende ? Math.max(1, Math.round((Date.parse(t.ende) - Date.parse(t.start)) / 60000)) : null;
    const tag = tage.get(t.datum) ?? { datum: t.datum, uebungen: [], einheiten: [], dauer: null, sessionRpe: null, tonnage: 0, _rpe: [], notizen: [], bereitschaft: null };
    if (t.notiz) tag.notizen.push(t.notiz);
    if (t.bereitschaft) tag.bereitschaft = t.bereitschaft;
    tag.uebungen.push(...uebungen);
    tag.einheiten.push(t.id);
    if (minuten != null) tag.dauer = (tag.dauer ?? 0) + minuten;
    if (t.sessionRpe != null) tag._rpe.push([t.sessionRpe, minuten]);
    tag.tonnage += uebungen.reduce((a, u) => a + u.saetze.reduce((b, s) => b + (s.kg ?? 0) * (s.wdh ?? 0), 0), 0);
    tage.set(t.datum, tag);
  }
  for (const tag of tage.values()) {
    // Session-RPE mehrerer Einheiten: nach Minuten gewichtet, ohne Dauer die letzte Angabe
    const mitDauer = tag._rpe.filter(([, m]) => m > 0);
    tag.sessionRpe = mitDauer.length
      ? Math.round((mitDauer.reduce((a, [r, m]) => a + r * m, 0) / mitDauer.reduce((a, [, m]) => a + m, 0)) * 10) / 10
      : tag._rpe.at(-1)?.[0] ?? null;
    delete tag._rpe;
  }
  const tagListe = [...tage.values()];

  // #################################################################
  // Tagesbestwerte je Übung, Referenz-e1RM (aktuelle Form am jeweiligen Tag)
  // #################################################################
  const verlauf = new Map();          // key → [[datum, bestes e1RM des Tages, bester Satz]]
  for (const tag of tagListe) {
    for (const u of tag.uebungen) {
      let top = null;
      for (const s of u.saetze) if (s.e1rm != null && besser(s, top)) top = s;
      if (!top) continue;
      const l = verlauf.get(u.key) ?? [];
      const letzte = l.at(-1);
      if (letzte?.[0] === tag.datum) { if (besser(top, letzte[2])) l[l.length - 1] = [tag.datum, top.e1rm, top]; }
      else l.push([tag.datum, top.e1rm, top]);
      verlauf.set(u.key, l);
    }
  }
  const referenz = (key, datum) => {
    let m = null;
    for (const [d, w] of verlauf.get(key) ?? []) {
      if (d > datum) break;
      if (tageZwischen(d, datum) < AKTUELL_TAGE && (m == null || w > m)) m = w;
    }
    return m;
  };
  for (const tag of tagListe) for (const u of tag.uebungen) u.e1rm = referenz(u.key, tag.datum);

  // #################################################################
  // Wochenreihen: ab der ersten Trainingswoche (mindestens minWochen) bis zur aktuellen Woche
  // #################################################################
  const letzteWoche = montagVon(heute);
  const ersteWoche = montagVon(sortiert[0]?.datum && sortiert[0].datum < heute ? sortiert[0].datum : heute);
  const anzahl = Math.max(minWochen, tageZwischen(ersteWoche, letzteWoche) / 7 + 1);
  const wochen = Array.from({ length: anzahl }, (_, i) => plusTage(letzteWoche, (i - anzahl + 1) * 7));
  const wocheVon = (datum) => { const i = Math.floor(tageZwischen(wochen[0], datum) / 7); return i >= 0 && i < anzahl ? i : -1; };
  const reihe = (key) => {
    const l = verlauf.get(key);
    if (!l) return null;
    const w = Array(anzahl).fill(null);
    for (const [d, v] of l) { const i = wocheVon(d); if (i >= 0 && (w[i] == null || v > w[i])) w[i] = v; }
    return w;
  };
  const e1rmWoche = Object.fromEntries(LIFTS.map((l) => [l, reihe(HAUPT[l]) ?? Array(anzahl).fill(null)]));
  const volumenWoche = wochen.map((woche) => ({ woche, squat: 0, bench: 0, dead: 0, andere: 0 }));
  const trainingsTage = {};
  for (const tag of tagListe) {
    const i = wocheVon(tag.datum);
    for (const u of tag.uebungen) {
      if (i >= 0) volumenWoche[i][u.lift] += u.saetze.reduce((a, s) => a + (s.kg ?? 0) * (s.wdh ?? 0), 0);
    }
    trainingsTage[tag.datum] = { lifts: LIFTS.filter((l) => tag.uebungen.some((u) => u.lift === l)), tonnage: Math.round(tag.tonnage) };
  }

  // #################################################################
  // Rekorde: schwerstes Gewicht mit mindestens r Wdh (1–10) je Hauptlift, Rekord-Feed, letzte Leistung, Bestwerte
  // #################################################################
  const REKORDE = {}, feed = [];
  for (const l of LIFTS) {
    const beste = Array(REKORD_WDH).fill(null);
    let laufend = null;
    for (const tag of tagListe) {
      for (const u of tag.uebungen) {
        if (u.key !== HAUPT[l]) continue;
        for (const s of u.saetze) {
          if (!(s.kg > 0) || !(s.wdh > 0)) continue;
          for (let r = 1; r <= Math.min(s.wdh, REKORD_WDH); r++) if (!beste[r - 1] || s.kg > beste[r - 1][0]) beste[r - 1] = [s.kg, tag.datum];
        }
      }
      const top = verlauf.get(HAUPT[l])?.find(([d]) => d === tag.datum);
      if (top) {
        if (laufend != null && top[1] > laufend) feed.push({ datum: tag.datum, lift: l, text: satzText(top[2], true), e1rm: top[1] });
        if (laufend == null || top[1] > laufend) laufend = top[1];
      }
    }
    REKORDE[l] = beste;
  }
  const PR_FEED = feed.sort((a, b) => b.datum.localeCompare(a.datum) || b.e1rm - a.e1rm).slice(0, 5);

  const LETZTES = {}, BEST_E1RM = {}, E1RM_AKTUELL = {}, ZULETZT = {};
  for (const tag of tagListe) for (const u of tag.uebungen) ZULETZT[u.key] = tag.datum;     // aufsteigend: am Ende steht das letzte Datum
  for (const [key, l] of verlauf) {
    const [d, , s] = l.at(-1);
    LETZTES[key] = [satzText(s), datumKurz(d)];
    BEST_E1RM[key] = Math.max(...l.map(([, w]) => w));
    E1RM_AKTUELL[key] = referenz(key, heute) ?? l.at(-1)[1];   // länger nicht trainiert: letzter bekannter Wert
  }
  // Übungen ohne e1RM (Zeit, Körpergewicht ohne Messwert) trotzdem mit letzter Leistung
  for (const tag of tagListe) {
    for (const u of tag.uebungen) {
      if (verlauf.has(u.key) || !u.saetze.length) continue;
      const s = u.saetze.reduce((a, b) => (besser(b, a) ? b : a), null);
      LETZTES[u.key] = [satzText(s), datumKurz(tag.datum)];
    }
  }
  for (const [alt, neu] of Object.entries(GLEICH)) {
    for (const ziel of [LETZTES, BEST_E1RM, E1RM_AKTUELL, ZULETZT]) if (ziel[neu] != null) ziel[alt] = ziel[neu];
  }

  /** Rekordtafel einer Übung: schwerstes Gewicht mit mindestens r Wdh (1–10) samt Datum, dazu bestes e1RM. */
  const rekordeVon = (key) => {
    const k = kanon(key), beste = Array(REKORD_WDH).fill(null);
    for (const tag of tagListe) {
      for (const u of tag.uebungen) {
        if (u.key !== k) continue;
        for (const s of u.saetze) {
          if (!(s.wdh > 0) || s.kg == null) continue;
          for (let r = 1; r <= Math.min(s.wdh, REKORD_WDH); r++) if (!beste[r - 1] || s.kg > beste[r - 1][0]) beste[r - 1] = [s.kg, tag.datum];
        }
      }
    }
    const top = verlauf.get(k)?.reduce((m, x) => (!m || x[1] > m[1] ? x : m), null);
    return { wdh: beste, e1rm: top ? { wert: top[1], datum: top[0], satz: top[2] } : null };
  };

  const gewichte = [...messwerte, ...sortiert.filter((t) => t.koerpergewicht > 0).map((t) => ({ datum: t.datum, kg: t.koerpergewicht }))]
    .filter((m) => m.kg > 0 && m.datum <= heute).sort((a, b) => a.datum.localeCompare(b.datum));
  return {
    HEUTE: heute, URLAUB: urlaub, wochen, e1rmWoche, volumenWoche, trainingsTage, REKORDE, PR_FEED, LETZTES, BEST_E1RM, E1RM_AKTUELL, ZULETZT,
    KOERPERGEWICHT: gewichte.at(-1)?.kg ?? koerpergewicht, KOERPERVERLAUF: gewichte,
    trainingAm: (d) => tage.get(d) ?? null,
    verlaufUebung: (key) => reihe(kanon(key)),
    rekordeVon,
  };
}

/** Letzter Wert einer Wochenreihe mit Lücken (null = in der Woche nicht trainiert). */
export const letzterWert = (reihe) => { for (let i = (reihe?.length ?? 0) - 1; i >= 0; i--) if (reihe[i] != null) return reihe[i]; return null; };
export const ersterWert = (reihe) => reihe?.find((v) => v != null) ?? null;
