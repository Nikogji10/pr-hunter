// PR Hunter · Ausdauer-Pläne (Wunsch 235/236): Ziel → Wochen mit konkreten Einheiten und Tempo-/Wattbereichen aus der
// aktuellen Form. Laufen: Bereiche aus der 5-km-Zeit (übliche Trainingslehre: locker ≈ 25–38 % langsamer als 5-km-Tempo,
// Schwelle ≈ 6–9 % langsamer, Intervalle ≈ 5-km-Tempo). Rad: Zonen in % der FTP. Umfang +8 %/Woche, jede 4. Woche leichter,
// vor Wettkämpfen 2 Wochen Tapering. Harte Einheiten nicht am Tag vor einem schweren Beintag (Hybrid). Pure Funktionen.

import { LAEUFER_KRAFT, wochenVorschlag, hatKraft, hatCardio } from './kombiplan.js';

const TAG = 864e5;
export const plusTage = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * TAG).toISOString().slice(0, 10);
export const wochentag = (d) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;          // 0 = Montag
export const naechsterMontag = (d) => plusTage(d, (7 - wochentag(d)) % 7 || 7);

/** Ziele je Sportart: [id, de, en, Strecke in m | null]. */
export const ZIELE = {
  lauf: [['fit', 'Fit bleiben', 'Stay fit', null], ['ausdauer', 'Ausdauer verbessern', 'Build endurance', null], ['abnehmen', 'Abnehmen', 'Lose weight', null],
    ['5k', '5 km', '5K', 5000], ['10k', '10 km', '10K', 10000], ['hm', 'Halbmarathon', 'Half marathon', 21097], ['m', 'Marathon', 'Marathon', 42195]],
  rad: [['fit', 'Fit bleiben', 'Stay fit', null], ['grundlage', 'Ausdauer verbessern', 'Build endurance', null], ['abnehmen', 'Abnehmen', 'Lose weight', null],
    ['ftp', 'FTP steigern', 'Raise FTP', null], ['rennen', 'Rennen / Event', 'Race / event', null]],
};
/** 247: Ziele ohne Strecke laufen nach Zeit (Dauer je Sitzung), Wettkampf-Ziele können ein Datum haben. */
export const ZEIT_ZIELE = new Set(['fit', 'ausdauer', 'abnehmen']);
export const RENN_ZIELE = new Set(['5k', '10k', 'hm', 'm', 'rennen']);
/** Kurzbeschreibung je Ziel (Wizard). */
export const ZIEL_TEXT = {
  fit: ['Kurze, lockere Einheiten, einmal pro Woche etwas zügiger.', 'Short easy sessions, once a week a bit faster.'],
  ausdauer: ['Mehr Umfang Woche für Woche, eine lange und eine zügige Einheit.', 'More volume week by week, one long and one faster session.'],
  grundlage: ['Mehr Umfang Woche für Woche, eine lange und eine zügige Einheit.', 'More volume week by week, one long and one faster session.'],
  abnehmen: ['Viel locker im Fettstoffwechsel-Bereich, am Wochenende länger.', 'Mostly easy, fat-burning zone, longer at the weekend.'],
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

const MIN_KM = { '5k': 12, '10k': 18, hm: 25, m: 35, fit: 10, ausdauer: 12, abnehmen: 10 };
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
const fuenf = (x) => Math.max(5, Math.round(x / 5) * 5);
function radEinheit(rolle, ziel, w, dauer = null, f = 1) {
  if (rolle === 'lang') return { typ: 'lang', zone: 'locker', min: dauer ? fuenf(Math.min(240, Math.max(dauer + 30, dauer * 1.5 * f))) : fuenf(Math.min(240, 90 + w * 12)) };
  if (rolle === 'locker') return { typ: 'locker', zone: 'locker', min: dauer ? fuenf(dauer * f) : fuenf(Math.min(90, 50 + w * 5)) };
  if (ziel === 'fit' || ziel === 'abnehmen') return { typ: 'tempo', zone: 'tempo', wdh: 2, dauer: fuenf(Math.max(5, (dauer ?? 45) / 4)), pause: 5 };
  const vo2 = ziel === 'rennen' ? w % 2 === 0 : ziel === 'ftp' ? w % 3 === 2 : false;
  if (vo2) return { typ: 'intervalle', zone: 'vo2', wdh: Math.min(6, 4 + Math.floor(w / 3)), dauer: 4, pause: 4 };
  if (ziel === 'grundlage') return { typ: 'tempo', zone: 'tempo', wdh: 2, dauer: Math.min(30, 15 + w * 2), pause: 5 };
  return { typ: 'tempo', zone: w % 2 === 0 ? 'sweetspot' : 'schwelle', wdh: w % 2 === 0 ? 3 : 2, dauer: Math.min(20, 10 + w * 2), pause: 5 };
}

/** Lauf nach Zeit (247): Einheit je Rolle in Minuten; f = Steigerungsfaktor der Woche. */
function zeitLauf(rolle, ziel, dauer, f, w) {
  const d = dauer ?? 40, lang = ziel === 'abnehmen' ? 1.5 : 1.6;
  if (rolle === 'lang') return ziel === 'fit' ? { typ: 'locker', zone: 'locker', min: fuenf(d * f) } : { typ: 'lang', zone: 'lang', min: fuenf(Math.min(150, d * lang * f)) };
  if (rolle.startsWith('hart')) return ziel === 'ausdauer' ? { typ: 'tempo', zone: 'tempo', min: fuenf(d), wdh: 2, dauer: Math.min(20, 8 + w) }
    : { typ: 'fahrtspiel', zone: 'locker', min: fuenf(d), wdh: Math.min(10, 6 + Math.floor(w / 2)), dauer: 1 };
  return { typ: 'locker', zone: 'locker', min: fuenf(d * f) };
}
const STEIGERUNG_MAX = { fit: 1.15, abnehmen: 1.3, ausdauer: 1.4, grundlage: 1.4 };
const HART = (r) => r.startsWith('hart') || r === 'lang';

/**
 * Plan erzeugen. tage: Wochentage 0–6 (Mo–So) der Ausdauer-Einheiten. beinTag(datum) → true, wenn dort ein schweres
 * Beintraining geplant ist – harte Einheiten rücken dann auf einen anderen Tag der Woche. kraftTag(datum) → true, wenn
 * dort Krafttraining ist (Cardio danach: nur locker und kurz). dauer = Minuten je Sitzung (Zeit-Ziele, Obergrenze für
 * lockere Läufe), fokus kraft|mix|cardio, rennDatum = Wettkampftag (bestimmt die Wochenzahl).
 */
export function erzeugePlan({ sport, ziel, start, wochen, tage, t5k = null, ftp = null, startKm = null, beinTag = () => false, kraftTag = () => false,
  dauer = null, fokus = 'mix', rennDatum = null, jeWoche = null, raster = null }) {
  if (rennDatum) wochen = Math.max(1, Math.floor((Date.parse(`${rennDatum}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / (7 * 864e5)) + 1);
  const tg = [...new Set(tage)].sort((a, b) => a - b), n = Math.min(7, tg.length || 3);
  // Fokus Kraft: höchstens eine harte Einheit je Woche
  const muster = MUSTER[n].map((r) => (fokus === 'kraft' && r === 'hart2' ? 'locker' : r));
  const fak = { kraft: 0.8, mix: 1, cardio: 1.1 }[fokus] ?? 1;
  const zeit = ZEIT_ZIELE.has(ziel);
  const rennen = sport === 'lauf' ? ZIELE.lauf.find(([id]) => id === ziel)?.[3] : null;
  const wettkampf = !!rennen || (sport === 'rad' && ziel === 'rennen' && !!rennDatum);
  const umfang = sport === 'lauf' && !zeit ? wochenUmfang(Math.max(startKm ?? 0, MIN_KM[ziel] ?? 12) * fak, wochen, { tapering: !!rennen }) : null;
  const steig = wochenUmfang(100, wochen, { tapering: wettkampf }).map((x) => Math.min(STEIGERUNG_MAX[ziel] ?? 1.5, x / 100));
  const zonen = sport === 'lauf' && t5k ? paceZonen(t5k) : sport === 'rad' && ftp ? wattZonen(ftp) : null;
  const maxKm = sport === 'lauf' && dauer && zonen ? Math.max(3, runde((dauer * 60) / ((zonen.locker[0] + zonen.locker[1]) / 2))) : null;
  const einheiten = [];
  // Cardio-Tage je Woche neu: wechseln die Krafttage von Woche zu Woche (Powerlifting, eigener Block), kommt Cardio auf die
  // Ruhetage der jeweiligen Woche. Passen die Krafttage zum Raster aus dem Planer, gilt die dort gewählte Verteilung.
  const tageDerWoche = (mo) => {
    if (!jeWoche) return tg;
    const tag = (i) => plusTage(mo, i), fest = [0, 1, 2, 3, 4, 5, 6].filter((i) => kraftTag(tag(i)));
    if (raster && fest.join() === raster.map((a, i) => (hatKraft(a) ? i : null)).filter((x) => x != null).join()) return raster.map((a, i) => (hatCardio(a) ? i : null)).filter((x) => x != null);
    const bein = [0, 1, 2, 3, 4, 5, 6].map((i) => !!beinTag(tag(i)));
    const v = wochenVorschlag(fest.length, Math.min(7, jeWoche), { fest, bein, hart: jeWoche >= 5 && fokus !== 'kraft' ? 2 : 1 });
    return v.map((a, i) => (hatCardio(a) ? i : null)).filter((x) => x != null);
  };
  for (let w = 0; w < wochen; w++) {
    const mo = plusTage(start, 7 * w), tgW = tageDerWoche(mo), tagVon = (i) => plusTage(mo, tgW[i] ?? 6);
    const rollen = [...(tgW.length === muster.length ? muster : MUSTER[Math.max(1, Math.min(7, tgW.length))].map((r) => (fokus === 'kraft' && r === 'hart2' ? 'locker' : r)))];
    // harte und lange Einheiten nicht an Krafttage (dort nur locker danach) – Tausch mit einem lockeren Tag ohne Kraft
    for (let i = 0; i < rollen.length; i++) {
      if (!HART(rollen[i]) || !kraftTag(tagVon(i))) continue;
      const j = rollen.findIndex((r, k) => r === 'locker' && !kraftTag(tagVon(k)));
      if (j >= 0) [rollen[i], rollen[j]] = [rollen[j], rollen[i]];
    }
    // harte Einheiten nicht vor einem Beintag (Tausch mit einem lockeren Tag)
    for (let i = 0; i < rollen.length; i++) {
      if (!HART(rollen[i]) || !beinTag(plusTage(tagVon(i), 1))) continue;
      const j = rollen.findIndex((r, k) => r === 'locker' && !beinTag(plusTage(tagVon(k), 1)) && (!kraftTag(tagVon(k)) || kraftTag(tagVon(i))));
      if (j >= 0) { [rollen[i], rollen[j]] = [rollen[j], rollen[i]]; continue; }
      // kein lockerer Tag frei: die lange Einheit tauscht mit einer harten auf einem freien Tag; harte Einheiten, die
      // trotzdem vor dem Beintag landen, werden locker (Beine sollen zum schweren Training frisch sein)
      if (rollen[i] === 'lang') {
        const h = rollen.findIndex((r, k) => r.startsWith('hart') && !beinTag(plusTage(tagVon(k), 1)) && !kraftTag(tagVon(k)));
        if (h >= 0) [rollen[i], rollen[h]] = [rollen[h], rollen[i]];
      }
      if (rollen[i].startsWith('hart')) rollen[i] = 'locker';
    }
    const letzte = w === wochen - 1;
    rollen.forEach((rolle0, i) => {
      const datum = tagVon(i), nachKraft = kraftTag(datum), basis = { id: `${datum}-${i}`, datum, woche: w + 1, sport, ...(nachKraft ? { nachKraft: true } : {}) };
      // an Krafttagen bleibt nur eine lockere, kurze Einheit
      const rolle = nachKraft && HART(rolle0) ? 'locker' : rolle0;
      if (letzte && wettkampf && !rennDatum && rolle === 'lang') { einheiten.push({ ...basis, typ: 'wettkampf', zone: 'intervall', ...(rennen ? { km: Math.round(rennen / 100) / 10 } : {}) }); return; }
      if (sport === 'rad') {
        const e = { ...basis, ...radEinheit(rolle, ziel, w, dauer, steig[w]) };
        if (nachKraft && e.min) e.min = Math.min(e.min, 30);
        einheiten.push(e); return;
      }
      if (zeit) { const e = { ...basis, ...zeitLauf(rolle, ziel, dauer, steig[w], w) }; if (nachKraft) e.min = Math.min(e.min, 30); einheiten.push(e); return; }
      const km = umfang[w];
      if (rolle === 'lang') { einheiten.push({ ...basis, typ: 'lang', zone: 'lang', km: Math.max(4, runde(Math.min(LANG_MAX[ziel] ?? 14, km * 0.3), 1)) }); return; }
      if (rolle.startsWith('hart')) { const h = harteEinheit(ziel, w, rolle === 'hart2'); einheiten.push({ ...basis, ...h, gesamtKm: runde(harteKm(h)) }); return; }
      einheiten.push({ ...basis, typ: 'locker', zone: 'locker', km: 0 });             // Rest des Umfangs, unten verteilt
    });
    if (umfang) {
      const dieWoche = einheiten.filter((e) => e.woche === w + 1), fest = dieWoche.reduce((s, e) => s + (e.typ === 'locker' ? 0 : e.gesamtKm ?? e.km ?? 0), 0);
      const locker = dieWoche.filter((e) => e.typ === 'locker');
      for (const e of locker) e.km = Math.min(e.nachKraft ? 5 : Infinity, maxKm ?? Infinity, Math.max(3, runde((umfang[w] - fest) / locker.length)));
    }
  }
  // 242: Wettkampf am eingetragenen Tag – danach nichts mehr, die zwei Tage davor nur locker
  if (rennDatum) {
    const vorher = plusTage(rennDatum, -2);
    for (let i = einheiten.length - 1; i >= 0; i--) {
      const e = einheiten[i];
      if (e.datum >= rennDatum) { einheiten.splice(i, 1); continue; }
      if (e.datum >= vorher && e.typ !== 'locker') {
        const { wdh, strecke, pause, dauer: _d, gesamtKm, ...rest } = e;
        einheiten[i] = { ...rest, typ: 'locker', zone: 'locker', ...(sport === 'rad' ? { min: 40 } : e.km == null ? { min: 25 } : { km: 4 }) };
      }
    }
    einheiten.push({ id: `${rennDatum}-r`, datum: rennDatum, woche: wochen, sport, typ: 'wettkampf', zone: 'intervall', ...(rennen ? { km: Math.round(rennen / 100) / 10 } : {}) });
  }
  return { sport, ziel, start, wochen, tage: tg, t5k, ftp, einheiten, zonen, ...(rennDatum ? { rennDatum } : {}) };
}

/** Plan mit dem aktuellen Kraftplan neu rechnen (Parameter gespeichert; Krafttage können sich ändern). */
export function aktuellerPlan(plan, { kraftTag, beinTag } = {}) {
  if (!plan?.param) return plan;
  try { return { ...erzeugePlan({ ...plan.param, kraftTag: kraftTag ?? (() => false), beinTag: beinTag ?? (() => false) }), param: plan.param, woche: plan.woche, bein: plan.bein }; }
  catch { return plan; }
}

/** Gehört eine erledigte Einheit (aus der Ausdauer-Liste) zu einer geplanten? Gleicher Tag, gleiche Sportart. */
export const erledigt = (geplant, liste, sportVon) => liste.some((a) => !a.geloescht && a.datum === geplant.datum && sportVon(a.art) === geplant.sport);

/** Geplante Einheit als Ausdauer-Eintrag (Dauer aus dem Tempo-Mittel geschätzt, beim Rad aus der Planung). */
export function alsEintrag(e, plan, id) {
  const km = e.gesamtKm ?? e.km ?? null, z = e.zielBereich ?? plan.zonen?.[e.zone];
  const dauer = e.sport === 'rad' ? (e.min ?? (e.wdh ? e.wdh * (e.dauer + e.pause) + 25 : 60)) * 60 : km && z ? Math.round(km * (z[0] + z[1]) / 2) : e.min ? e.min * 60 : null;
  return { id, quelle: 'manuell', art: e.sport === 'rad' ? 'rennrad' : 'lauf', datum: e.datum, typ: e.typ, titel: null, distanz_m: e.sport === 'lauf' && km ? Math.round(km * 1000) : null, dauer_s: dauer, geloescht: false };
}

/** 238/243: Kraft für Läufer bzw. Radfahrer – zwei kurze Einheiten A/B (je 5 Übungen, Grundübungen zuerst, Ober- und
 * Unterkörper im Wechsel); Übungen aus js/kombiplan.js, hier mit Sätzen und Zweck: { sport: { A|B: [[key, Sätze, de, en]] } }. */
const KRAFT_ZWECK = {
  dumbbell_bulgarian_split_squat: ['3 × 8–10', 'einbeinige Kraft und Kniestabilität', 'single-leg strength and knee stability'],
  pushups: ['3 × 10–15', 'Oberkörper und Rumpfspannung', 'upper body and core tension'],
  single_leg_deadlift_dumbbell: ['3 × 8', 'Beinbeuger, Gesäß und Gleichgewicht', 'hamstrings, glutes and balance'],
  'one-arm_dumbbell_row': ['3 × 10', 'Rücken für aufrechte Haltung', 'back for an upright posture'],
  single_leg_calf_raise_dumbbell: ['3 × 12–15', 'Waden und Achillessehne', 'calves and Achilles'],
  dumbbell_step_ups: ['3 × 8–10', 'Kraft beim Abdruck', 'push-off power'],
  'wide-grip_lat_pulldown': ['3 × 10', 'Rücken und Armzug', 'back and arm drive'],
  single_leg_hip_thrust: ['3 × 10', 'Gesäß – stabilisiert Hüfte und Knie', 'glutes – stabilise hip and knee'],
  seated_dumbbell_press: ['3 × 10', 'Schultern', 'shoulders'],
  side_plank_hip_abduction: ['2 × 10', 'Hüftstabilität (Knie knickt nicht ein)', 'hip stability (knee does not cave in)'],
  barbell_squat: ['3 × 6–8', 'Tretkraft', 'pedalling power'],
  barbell_hip_thrust: ['3 × 8–10', 'Gesäß – oft schwach bei Radfahrern', 'glutes – often weak in cyclists'],
  pallof_press: ['2 × 10', 'Rumpf gegen Verdrehen', 'core against rotation'],
  dead_bug: ['2 × 10', 'Rumpf für ruhigen Oberkörper', 'core for a quiet upper body'],
};
export const KRAFT_ERGAENZUNG = Object.fromEntries(Object.entries(LAEUFER_KRAFT).map(([sp, ab]) => [sp,
  Object.fromEntries(Object.entries(ab).map(([x, l]) => [x, l.map((k) => [k, ...(KRAFT_ZWECK[k] ?? ['3 × 10', '', ''])])]))]));

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

/**
 * 237: geplante Einheit als intervals.icu-Workout (Textformat, je Schritt eine Zeile „- Dauer/Strecke Ziel“). Mit
 * „Upload planned workouts“ in der Garmin-Verbindung von intervals.icu landet es auf der Uhr. Laufen mit Tempobereich
 * (mm:ss/km Pace), Rad mit Watt; ohne Bereiche Zonen (Z2 …). Liefert { name, typ, text, dauer_s }.
 */
export function intervalsWorkout(e, plan) {
  const z = plan?.zonen ?? null, lauf = e.sport === 'lauf';
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const ziel = (zone, ersatz) => {
    const b = (zone === e.zone && e.zielBereich) || z?.[zone];      // 250: importierte Einheiten bringen ihr Ziel mit
    if (!b) return ersatz;
    return lauf ? `${mmss(b[0])}-${mmss(b[1])}/km Pace` : `${b[0]}-${b[1]}w`;
  };
  const locker = ziel('locker', lauf ? 'Z2 Pace' : 'Z2');
  const strecke = (m) => (m >= 1000 ? `${Math.round(m / 100) / 10}km` : `${m}mtr`);
  const NAME = { locker: 'Locker', lang: 'Lang', tempo: 'Tempo', intervalle: 'Intervalle', fahrtspiel: 'Fahrtspiel', wettkampf: 'Wettkampf' };
  const zeilen = [];
  if (e.typ === 'wettkampf') zeilen.push(e.km ? `- ${e.km}km ${ziel('intervall', 'Z4 Pace')}` : `- 60m ${ziel('schwelle', 'Z4')}`);
  else if (e.typ === 'fahrtspiel') zeilen.push(`- 10m ${locker}`, '', `${e.wdh}x`, `- ${e.dauer}m ${ziel('tempo', 'Z4 Pace')}`, `- 2m ${locker}`, '', `- ${Math.max(5, e.min - 10 - e.wdh * (e.dauer + 2))}m ${locker}`);
  else if (lauf && e.wdh && e.strecke) zeilen.push(`- 2km ${locker}`, '', `${e.wdh}x`, `- ${strecke(e.strecke)} ${ziel(e.zone, 'Z4 Pace')}`, `- ${Math.round(e.pause / 60 * 10) / 10}m ${locker}`, '', `- 1.5km ${locker}`);
  else if (e.wdh && e.dauer) zeilen.push(`- ${lauf ? 10 : 15}m ${locker}`, '', `${e.wdh}x`, `- ${e.dauer}m ${ziel(e.zone, lauf ? 'Z4 Pace' : 'Z4')}`, `- ${lauf ? 3 : e.pause}m ${locker}`, '', `- 10m ${locker}`);
  else if (e.typ === 'tempo' && e.km) zeilen.push(`- 2km ${locker}`, `- ${e.km}km ${ziel(e.zone, 'Z3 Pace')}`, `- 1.5km ${locker}`);
  else if (e.km) zeilen.push(`- ${e.km}km ${ziel(e.zone, 'Z2 Pace')}`);
  else zeilen.push(`- ${e.min ?? 45}m ${ziel(e.zone, lauf ? 'Z2 Pace' : 'Z2')}`);
  const eintrag = alsEintrag(e, plan ?? {}, null);
  return { name: `PR Hunter · ${NAME[e.typ] ?? 'Einheit'}`, typ: lauf ? 'Run' : 'Ride', text: zeilen.join('\n'), dauer_s: eintrag.dauer_s ?? null };
}
