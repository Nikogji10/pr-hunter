// PR Hunter · Ausdauer-Pläne (Wunsch 235/236): Ziel → Wochen mit konkreten Einheiten und Tempo-/Wattbereichen aus der
// aktuellen Form. Laufen: Bereiche aus der 5-km-Zeit (übliche Trainingslehre: locker ≈ 25–38 % langsamer als 5-km-Tempo,
// Schwelle ≈ 6–9 % langsamer, Intervalle ≈ 5-km-Tempo). Rad: Zonen in % der FTP. Umfang +8 %/Woche, jede 4. Woche leichter,
// vor Wettkämpfen 2 Wochen Tapering. Harte Einheiten nicht am Tag vor einem schweren Beintag (Hybrid). Pure Funktionen.

const TAG = 864e5;
export const plusTage = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * TAG).toISOString().slice(0, 10);
export const wochentag = (d) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;          // 0 = Montag
export const naechsterMontag = (d) => plusTage(d, (7 - wochentag(d)) % 7 || 7);

/** Ziele je Sportart: [id, de, en, Strecke in m | null]. */
export const ZIELE = {
  lauf: [['5k', '5 km', '5 km', 5000], ['10k', '10 km', '10 km', 10000], ['hm', 'Halbmarathon', 'Half marathon', 21097], ['m', 'Marathon', 'Marathon', 42195], ['fit', 'Fitter werden', 'Get fitter', null]],
  rad: [['ftp', 'FTP steigern', 'Raise FTP', null], ['grundlage', 'Grundlage', 'Base fitness', null], ['rennen', 'Rennen / Event', 'Race / event', null]],
};

/** Lauf-Tempobereiche (s/km) aus der 5-km-Zeit in s. */
export function paceZonen(t5k) {
  const p = t5k / 5, b = (a, z) => [Math.round(p * a), Math.round(p * z)];
  return { locker: b(1.25, 1.38), lang: b(1.25, 1.35), marathon: b(1.13, 1.17), tempo: b(1.06, 1.09), intervall: b(0.98, 1.01), steigerung: b(0.9, 0.94) };
}
/** Rad-Wattbereiche aus der FTP. */
export function wattZonen(ftp) {
  const b = (a, z) => [Math.round(ftp * a), Math.round(ftp * z)];
  return { locker: b(0.56, 0.75), tempo: b(0.76, 0.87), sweetspot: b(0.88, 0.94), schwelle: b(0.95, 1.05), vo2: b(1.06, 1.2) };
}

const MIN_KM = { '5k': 12, '10k': 18, hm: 25, m: 35, fit: 10 };
const LANG_MAX = { '5k': 12, '10k': 16, hm: 21, m: 32, fit: 14 };
const runde = (x, s = 0.5) => Math.round(x / s) * s;

/** Umfang je Woche: +8 %, jede 4. Woche ×0,75, bei Wettkampf-Zielen die letzten 2 Wochen ×0,7 und ×0,5. */
export function wochenUmfang(basis, wochen, { tapering = true } = {}) {
  const aus = [];
  let stufe = basis;
  for (let w = 0; w < wochen; w++) {
    const leicht = (w + 1) % 4 === 0;
    let x = leicht ? stufe * 0.75 : stufe;
    if (tapering && w === wochen - 2) x = stufe * 0.7;
    if (tapering && w === wochen - 1) x = stufe * 0.5;
    aus.push(Math.round(x * 10) / 10);
    if (!leicht) stufe *= 1.08;
  }
  return aus;
}

/** Wochenmuster (Reihenfolge innerhalb der Woche, letzter Tag = lang). */
const MUSTER = { 1: ['lang'], 2: ['hart', 'lang'], 3: ['locker', 'hart', 'lang'], 4: ['locker', 'hart', 'locker', 'lang'], 5: ['locker', 'hart', 'locker', 'hart2', 'lang'], 6: ['locker', 'hart', 'locker', 'hart2', 'locker', 'lang'], 7: ['locker', 'hart', 'locker', 'hart2', 'locker', 'locker', 'lang'] };

/** Harte Einheit je Ziel und Woche (abwechselnd Intervalle/Tempo); Werte in Metern bzw. Minuten. */
function harteEinheit(ziel, w, zweite = false) {
  const intervallWoche = (w % 2 === 0) !== zweite;
  if (ziel === 'm') return intervallWoche ? { typ: 'tempo', zone: 'marathon', km: runde(8 + w * 0.8, 1) } : { typ: 'tempo', zone: 'tempo', wdh: 3, strecke: 3000, pause: 120 };
  if (ziel === 'hm') return intervallWoche ? { typ: 'intervalle', zone: 'intervall', wdh: 5, strecke: 1000, pause: 120 } : { typ: 'tempo', zone: 'tempo', wdh: 2 + (w > 3 ? 1 : 0), strecke: 3000, pause: 120 };
  if (ziel === '10k') return intervallWoche ? { typ: 'intervalle', zone: 'intervall', wdh: Math.min(6, 4 + Math.floor(w / 2)), strecke: 1000, pause: 120 } : { typ: 'tempo', zone: 'tempo', km: runde(4 + w * 0.5, 1) };
  if (ziel === '5k') return intervallWoche ? { typ: 'intervalle', zone: 'intervall', wdh: Math.min(8, 5 + Math.floor(w / 2)), strecke: 800, pause: 90 } : { typ: 'tempo', zone: 'tempo', km: runde(3 + w * 0.4, 1) };
  return intervallWoche ? { typ: 'intervalle', zone: 'intervall', wdh: 6, strecke: 400, pause: 90 } : { typ: 'tempo', zone: 'tempo', km: 3 };
}
const harteKm = (h) => (h.km ?? (h.wdh * h.strecke) / 1000) + 3;     // mit Ein- und Auslaufen

/** Rad-Einheit je Rolle und Woche (Dauer in Minuten). */
function radEinheit(rolle, ziel, w) {
  if (rolle === 'lang') return { typ: 'lang', zone: 'locker', min: Math.round(Math.min(240, 90 + w * 12) / 5) * 5 };
  if (rolle === 'locker') return { typ: 'locker', zone: 'locker', min: Math.round(Math.min(90, 50 + w * 5) / 5) * 5 };
  const vo2 = ziel === 'rennen' ? w % 2 === 0 : ziel === 'ftp' ? w % 3 === 2 : false;
  if (vo2) return { typ: 'intervalle', zone: 'vo2', wdh: Math.min(6, 4 + Math.floor(w / 3)), dauer: 4, pause: 4 };
  if (ziel === 'grundlage') return { typ: 'tempo', zone: 'tempo', wdh: 2, dauer: Math.min(30, 15 + w * 2), pause: 5 };
  return { typ: 'tempo', zone: w % 2 === 0 ? 'sweetspot' : 'schwelle', wdh: w % 2 === 0 ? 3 : 2, dauer: Math.min(20, 10 + w * 2), pause: 5 };
}

/**
 * Plan erzeugen. tage: Wochentage 0–6 (Mo–So) der Ausdauer-Einheiten. beinTag(datum) → true, wenn dort ein schweres
 * Beintraining geplant ist (Kniebeuge/Kreuzheben) – harte Einheiten rücken dann auf einen anderen Tag der Woche.
 */
export function erzeugePlan({ sport, ziel, start, wochen, tage, t5k = null, ftp = null, startKm = null, beinTag = () => false }) {
  const tg = [...new Set(tage)].sort((a, b) => a - b), n = Math.min(7, tg.length || 3), muster = MUSTER[n];
  const rennen = sport === 'lauf' ? ZIELE.lauf.find(([id]) => id === ziel)?.[3] : null;
  const umfang = sport === 'lauf' ? wochenUmfang(Math.max(startKm ?? 0, MIN_KM[ziel] ?? 12), wochen, { tapering: !!rennen }) : null;
  const einheiten = [];
  for (let w = 0; w < wochen; w++) {
    const mo = plusTage(start, 7 * w);
    // Rollen auf die Wochentage legen, harte Einheiten nicht vor einem Beintag (Tausch mit einem lockeren Tag)
    const rollen = [...muster];
    for (let i = 0; i < rollen.length; i++) {
      if (!rollen[i].startsWith('hart') || !beinTag(plusTage(mo, tg[i] + 1))) continue;
      const j = rollen.findIndex((r, k) => r === 'locker' && !beinTag(plusTage(mo, tg[k] + 1)));
      if (j >= 0) [rollen[i], rollen[j]] = [rollen[j], rollen[i]];
    }
    const letzte = w === wochen - 1;
    rollen.forEach((rolle, i) => {
      const datum = plusTage(mo, tg[i] ?? 6), basis = { id: `${datum}-${i}`, datum, woche: w + 1, sport };
      if (sport === 'rad') { einheiten.push({ ...basis, ...radEinheit(rolle, ziel, w) }); return; }
      const km = umfang[w];
      if (letzte && rennen && rolle === 'lang') { einheiten.push({ ...basis, typ: 'wettkampf', zone: 'intervall', km: Math.round(rennen / 100) / 10 }); return; }
      if (rolle === 'lang') { einheiten.push({ ...basis, typ: 'lang', zone: 'lang', km: Math.max(4, runde(Math.min(LANG_MAX[ziel] ?? 14, km * 0.3), 1)) }); return; }
      if (rolle.startsWith('hart')) { const h = harteEinheit(ziel, w, rolle === 'hart2'); einheiten.push({ ...basis, ...h, gesamtKm: runde(harteKm(h)) }); return; }
      einheiten.push({ ...basis, typ: 'locker', zone: 'locker', km: 0 });             // Rest des Umfangs, unten verteilt
    });
    if (sport === 'lauf') {
      const dieWoche = einheiten.filter((e) => e.woche === w + 1), fest = dieWoche.reduce((s, e) => s + (e.typ === 'locker' ? 0 : e.gesamtKm ?? e.km ?? 0), 0);
      const locker = dieWoche.filter((e) => e.typ === 'locker');
      for (const e of locker) e.km = Math.max(3, runde((umfang[w] - fest) / locker.length));
    }
  }
  return { sport, ziel, start, wochen, tage: tg, t5k, ftp, einheiten, zonen: sport === 'lauf' && t5k ? paceZonen(t5k) : sport === 'rad' && ftp ? wattZonen(ftp) : null };
}

/** Gehört eine erledigte Einheit (aus der Ausdauer-Liste) zu einer geplanten? Gleicher Tag, gleiche Sportart. */
export const erledigt = (geplant, liste, sportVon) => liste.some((a) => !a.geloescht && a.datum === geplant.datum && sportVon(a.art) === geplant.sport);

/** Geplante Einheit als Ausdauer-Eintrag (Dauer aus dem Tempo-Mittel geschätzt, beim Rad aus der Planung). */
export function alsEintrag(e, plan, id) {
  const km = e.gesamtKm ?? e.km ?? null, z = plan.zonen?.[e.zone];
  const dauer = e.sport === 'rad' ? (e.min ?? (e.wdh ? e.wdh * (e.dauer + e.pause) + 25 : 60)) * 60 : km && z ? Math.round(km * (z[0] + z[1]) / 2) : null;
  return { id, quelle: 'manuell', art: e.sport === 'rad' ? 'rennrad' : 'lauf', datum: e.datum, typ: e.typ, titel: null, distanz_m: e.sport === 'lauf' && km ? Math.round(km * 1000) : null, dauer_s: dauer, geloescht: false };
}

/** 238: Kraft-Ergänzung für Läufer bzw. Radfahrer (2× pro Woche ~15 min): [Katalog-Schlüssel, Sätze × Wdh, wofür de, en]. */
export const KRAFT_ERGAENZUNG = {
  lauf: [
    ['single_leg_calf_raise_dumbbell', '3 × 12–15', 'Waden und Achillessehne – häufigste Laufbeschwerden', 'calves and Achilles – the most common running complaints'],
    ['dumbbell_bulgarian_split_squat', '3 × 8–10', 'einbeinige Kraft und Kniestabilität', 'single-leg strength and knee stability'],
    ['single_leg_deadlift_dumbbell', '3 × 8', 'Beinbeuger, Gesäß und Gleichgewicht', 'hamstrings, glutes and balance'],
    ['copenhagen_plank', '3 × 20–30 s', 'Adduktoren und Leiste', 'adductors and groin'],
    ['side_plank_hip_abduction', '3 × 10', 'Hüftstabilität (Knie knickt nicht ein)', 'hip stability (knee does not cave in)'],
    ['tibialis_raise', '2 × 15–20', 'Schienbein – gegen Schienbeinkantensyndrom', 'shins – against shin splints'],
  ],
  rad: [
    ['dumbbell_bulgarian_split_squat', '3 × 8–10', 'Tretkraft je Bein, Ausgleich links/rechts', 'pedalling power per leg, left/right balance'],
    ['barbell_hip_thrust', '3 × 8–10', 'Gesäß – oft schwach bei Radfahrern', 'glutes – often weak in cyclists'],
    ['single_leg_deadlift_dumbbell', '3 × 8', 'hintere Kette gegen das viele Sitzen', 'posterior chain against all the sitting'],
    ['dead_bug', '3 × 10', 'Rumpf für ruhigen Oberkörper', 'core for a quiet upper body'],
    ['pallof_press', '3 × 10', 'Rumpf gegen Verdrehen', 'core against rotation'],
    ['standing_calf_raises', '2 × 15', 'Waden für den Druckpunkt', 'calves for the push'],
  ],
};

/** 238: dieselben Ergänzungen als Vorschläge im Bodybuilding-Generator, je Muskelgruppe und Sportart. */
export const KRAFT_JE_GRUPPE = {
  quads: { lauf: ['dumbbell_bulgarian_split_squat', 'dumbbell_step_ups'], rad: ['dumbbell_bulgarian_split_squat', 'dumbbell_step_ups'] },
  beinbeuger: { lauf: ['single_leg_deadlift_dumbbell', 'assisted_nordic_curl_band'], rad: ['single_leg_deadlift_dumbbell'] },
  gesaess: { lauf: ['single_leg_hip_thrust'], rad: ['barbell_hip_thrust', 'single_leg_hip_thrust'] },
  waden: { lauf: ['single_leg_calf_raise_dumbbell', 'tibialis_raise'], rad: ['standing_calf_raises'] },
  bauch: { lauf: ['side_plank_hip_abduction'], rad: ['dead_bug', 'pallof_press'] },
};

/** Vorschläge einer Gruppe für die gewählten Sportarten: [[key, ['lauf'|'rad', …]], …]. */
export function kraftVorschlaege(gruppe, sports) {
  const m = new Map();
  for (const s of sports) for (const k of KRAFT_JE_GRUPPE[gruppe]?.[s] ?? []) m.set(k, [...(m.get(k) ?? []), s]);
  return [...m];
}
