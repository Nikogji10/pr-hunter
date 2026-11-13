// PR Hunter · Statistik. Ein Zeitraumfilter oben gilt für alles darunter (Belastung: höchstens 26 Wochen).
// Gerechnet wird mit den getesteten Funktionen aus js/auswertung.js; Daten aus ui/stand.js (echt oder Demo).
import { html, useState, fmt, gw, gwE, einheit, inAnzeige, LIFT, liftName, deEn, I, datumKurz, datumLang, uebung, MUSKEL_DE, speicher, nameVon, useUnterReiter, UNTER_VORSCHAU, sprache, liftVon, Sheet, ZahlFeld } from './basis.js';
import { e1rm } from '../js/rechnen.js';
import { dots, ipfGl } from '../js/punkte.js';
import { kraftprofil, inol, harteSaetzeJeMuskel, fosterWoche, sessionLast, plateau, INOL_RICHTWERT, gewichtImZeitraum, ANTEIL_GESCHAETZT,
  erholung, muskelGewichte, ERHOLUNG, rekordChronik } from '../js/auswertung.js';
import { SYMMETRIC_RECHNER } from '../js/verweise.js';
import { LinienChart, StapelSaeulen, Heatmap, Sparkline, ZonenBalken, Rangliste } from './diagramme.js';
import { KoerperKarte, ErholungKarte, MUSKEL_NAME, farbeVon } from './koerper.js';
import { Zielprognose, Vergleich } from './vergleich.js';
import { Bestenliste } from './challenges.js';
import { stillstaende } from '../js/stillstand.js';
import { rpeGenauigkeit } from '../js/rpegenauigkeit.js';
import { normiere } from '../js/insights.js';
import { NOTIZ_CHIPS, chipsAus } from '../js/notizchips.js';
import { bereitschaftsWert } from '../js/auswertung.js';
import { ISO_FAMILIEN } from './suche.js';
import { wochen, e1rmWoche, volumenWoche, trainingsTage, trainingAm, REKORDE, PR_FEED, URLAUB, HEUTE, DEMO, KOERPERVERLAUF, plusTage, imUrlaub, E1RM_AKTUELL, ZULETZT, FORM_WOCHEN, DIENSTE } from './stand.js';
import { uebersetze } from './sprache.js';
import { koerperAm, montagVon, tageZwischen, kanon } from '../js/daten.js';
import { rpeTrend } from '../js/block.js';
import { MasseKarte } from './masse.js';
import { ZyklusKarte } from './zyklus.js';
import { AusdauerStatistik } from './ausdauerstatistik.js';
import { erholungsEintraege, sichtbar } from '../js/ausdauer.js';
import { WettkaempfeKarte } from './wettkaempfe.js';
import { Insights } from './insights.js';
import { FormKarte, formDaten } from './formkurve.js';
import { TempoStatistik } from './tempostatistik.js';
import { BereitschaftVerlauf } from './bereitschaftverlauf.js';

const LIFTS = ['squat', 'bench', 'dead'];
const BEREICHE = [['4 Wo.', 4], ['3 Mon.', 13], ['6 Mon.', 26], ['1 Jahr', 52], ['Alles', 0]];   // kurz: alle Filter in eine Reihe
// FORM_WOCHEN aus stand.js (gleiche Zahl wie Bestenliste und Vergleich)


function wochenDaten(x) {
  return x.map((wo) => {
    const tage = Array.from({ length: 7 }, (_, i) => plusTage(wo, i));
    const trainings = tage.map((d) => trainingAm(d)).filter(Boolean);
    const inolJeLift = Object.fromEntries(LIFTS.map((l) => [l, trainings.reduce((a, t) =>
      a + t.uebungen.filter((u) => u.lift === l).reduce((b, u) => b + (inol(u.saetze, u.e1rm) ?? 0), 0), 0)]));
    return { woche: wo, trainings, foster: fosterWoche(tage.map((d) => { const t = trainingAm(d); return t ? sessionLast(t.sessionRpe, t.dauer) : 0; })), inol: inolJeLift };
  });
}

// Reiter: Kraft (Total, Lifts, Verläufe, Ziele, Rekorde) · Profil (Muskeln, Vergleich) · Belastung · Training · Körper
// Statistik startet mit dem Profil (Erholung + Kraftprofil), dann Kraft, Belastung … (Niko 02.11.)
// Ergebnisse teurer Karten merken, solange die Eingaben gleich sind (Reiterwechsel rechnete sonst jedes Mal alles neu)
const MERK = {};
const merke = (name, eingaben, rechne) => { const m = MERK[name]; if (m && m.e.length === eingaben.length && m.e.every((x, i) => x === eingaben[i])) return m.w; const w = rechne(); MERK[name] = { e: eingaben, w }; return w; };
const STAT_REITER = [['profil', 'Profil'], ['analyse', 'Analyse'], ['kraft', 'Kraft'], ['belastung', 'Belastung'], ['training', 'Training'], ['koerper', 'Körper']];

export function Statistik({ einst, setEinst = null, blockStart = null, trainings = [], masse = [], masseSetzen = null, ausdauer = [], planTage = [] }) {
  // 151: einfache Ansicht ohne Kraft (SBD/DOTS) und Kraftprofil
  // einfache Ansicht: ohne Reiter Kraft (SBD/DOTS); Profil mit Erholung und Kraftprofil aus den eigenen Übungen, ohne Vergleich
  const einfach = einst.trainingsart === 'einfach';
  const reiterBasis = einfach ? STAT_REITER.filter(([k]) => k !== 'kraft') : STAT_REITER;
  // 225: Reiter „Ausdauer“ nur, wenn gewählt (vor „Körper“)
  const mitAusdauer = einst.ausdauer ? [...reiterBasis.slice(0, -1), ['ausdauer', deEn('Ausdauer', 'Cardio')], reiterBasis.at(-1)] : reiterBasis;
  // 279: Reiter „Tempo“ (Hantel-Tempo aus Videos), solange das Satz-Video an ist
  const reiterListe = einst.satzVideo !== false ? [...mitAusdauer.slice(0, -1), ['tempo', deEn('Tempo', 'Velocity')], mitAusdauer.at(-1)] : mitAusdauer;
  // beim Öffnen der App Profil (Niko 02.11.); Neuladen bleibt beim gewählten Reiter (Sitzung, 03.11.); Wisch-Bild: Nachbar
  const [reiterRoh, setReiterRoh] = useState(() => UNTER_VORSCHAU.statistik ?? (() => { try { return sessionStorage.getItem('prh-reiter-statistik'); } catch { return null; } })() ?? 'profil');
  const setReiter = (k) => { setReiterRoh(k); try { sessionStorage.setItem('prh-reiter-statistik', k); } catch { /* egal */ } };
  const reiter = reiterListe.some(([k]) => k === reiterRoh) ? reiterRoh : reiterListe[0][0];
  const waehleReiter = (k) => { setReiter(k); scrollTo({ top: 0 }); };
  useUnterReiter('statistik', reiterListe, reiter, waehleReiter);
  // Zeitraum bleibt fürs nächste Mal gespeichert (Gerät); ungültig oder „Block“ ohne aktiven Block → 1 Jahr
  const [bereichRoh, setBereichRoh] = useState(() => { const v = Number(speicher.lies('prh-stat-zeitraum')); return Number.isFinite(v) && speicher.lies('prh-stat-zeitraum') != null ? v : 52; });
  const setBereich = (w) => { setBereichRoh(w); speicher.schreib('prh-stat-zeitraum', String(w)); };
  const [rekLift, setRekLift] = useState('squat');
  // Zeitraum in Wochen: 0 = alles, -1 = seit Beginn des aktiven Blocks
  const blockWochen = blockStart && blockStart <= HEUTE ? Math.floor(tageZwischen(montagVon(blockStart), montagVon(HEUTE)) / 7) + 1 : null;
  const bereich = bereichRoh === -1 ? (blockWochen ? -1 : 52) : [...BEREICHE.map(([, w]) => w)].includes(bereichRoh) ? bereichRoh : 52;
  const n = bereich === 0 ? wochen.length : bereich === -1 ? Math.min(blockWochen ?? 1, wochen.length) : Math.min(bereich, wochen.length);
  const kg = einst.koerpergewicht;
  const bereiche = [...BEREICHE, ...(blockWochen ? [['Block', -1]] : [])];
  const x = wochen.slice(-n);
  const serien = LIFTS.map((l) => ({ id: l, name: LIFT[l].name, farbe: LIFT[l].farbe, werte: e1rmWoche[l].slice(-n).map(inAnzeige) }));
  // Aktuelle Form = bestes Wochen-e1RM der letzten 12 Wochen (eine leichte Woche drückt den Wert nicht),
  // verglichen mit den 12 Wochen vor Beginn des Zeitraums
  const form = (w, ende) => { const t = w.slice(Math.max(0, ende - FORM_WOCHEN), Math.max(0, ende)).filter((v) => v != null); return t.length ? Math.max(...t) : null; };
  const aktuell = Object.fromEntries(LIFTS.map((l) => [l, form(e1rmWoche[l], e1rmWoche[l].length)]));
  const vorher = Object.fromEntries(LIFTS.map((l) => [l, form(e1rmWoche[l], e1rmWoche[l].length - n)]));
  const summe = (o) => (LIFTS.every((l) => o[l] != null) ? LIFTS.reduce((a, l) => a + o[l], 0) : null);
  const total = summe(aktuell), totalVorher = total != null ? summe(vorher) : null;
  const pfeil = (d) => (d >= 0 ? `▲ ${gw(d, 1)}` : `▼ ${gw(-d, 1)}`);
  // Kraftprofil: dazu alle Übungen mit Näherungswert, die in den letzten 26 Wochen trainiert wurden (aktuelle Form)
  const seit = plusTage(HEUTE, -26 * 7);
  const weitere = Object.keys(ANTEIL_GESCHAETZT).filter((k) => E1RM_AKTUELL[k] > 0 && (ZULETZT[k] ?? '') >= seit)
    .map((k) => ({ key: k, e1rm: E1RM_AKTUELL[k], name: nameVon(k) }));
  const profil = kraftprofil(aktuell, kg, weitere);
  // Muskel-Erholung aus den Trainings der letzten 72 Stunden (Ende des Trainings, sonst Beginn, sonst 18 Uhr)
  const jetztMs = Date.now();
  const erholEintraege = trainings.filter((t) => !t.geloescht && t.datum >= plusTage(HEUTE, -4)).flatMap((t) => {
    const zeit = new Date(t.ende ?? t.start ?? `${t.datum}T18:00:00`).getTime();
    return (t.uebungen ?? []).map((u) => ({ zeit, muskeln: muskelGewichte(kanon(u.key), uebung(kanon(u.key)) ?? uebung(u.key)),
      saetze: (u.saetze ?? []).filter((s) => s.fertig !== false) }));
  });
  // Läufe/Radfahrten zählen für die Beine mit (nur wenn Ausdauer gewählt)
  const erholt = erholung([...erholEintraege, ...(einst.ausdauer ? erholungsEintraege(sichtbar(ausdauer, einst.ausdauer), jetztMs) : [])], jetztMs);
  const wd = wochenDaten(x);
  const letzte = wd.at(-1);
  // Volumen: bis 26 Wochen je Woche, bei einem Jahr je 4 Wochen zusammengefasst
  const vol = volumenWoche.slice(-n), gruppe = n > 104 ? 8 : n > 26 ? 4 : 1, saeulen = [];
  for (let i = 0; i < vol.length; i += gruppe) {
    const teil = vol.slice(i, i + gruppe);
    saeulen.push({ label: teil[0].woche, teile: Object.fromEntries(['squat', 'bench', 'dead', 'andere'].map((l) => [l, teil.reduce((a, v) => a + v[l], 0)])) });
  }
  const volSerien = [...LIFTS.map((l) => ({ id: l, name: LIFT[l].name, farbe: LIFT[l].farbe })), { id: 'andere', name: 'Zubehör', farbe: 'var(--andere)' }];
  // Trainingszeit: Minuten je Woche (bzw. je 4/8 Wochen wie beim Volumen), Summe, Ø je Einheit, längste Einheit
  const mitDauer = wd.flatMap((w) => w.trainings).filter((t) => t.dauer > 0);
  const zeitSaeulen = [];
  for (let i = 0; i < wd.length; i += gruppe) {
    const teil = wd.slice(i, i + gruppe);
    // Ø Minuten je Trainingstag (nur Einheiten mit Dauer), nicht die Wochensumme
    const mit = teil.flatMap((w) => w.trainings).filter((t) => t.dauer > 0);
    zeitSaeulen.push({ label: teil[0].woche, teile: { min: mit.length ? Math.round(mit.reduce((a, t) => a + t.dauer, 0) / mit.length) : 0 } });
  }
  const zeitGesamt = mitDauer.reduce((a, t) => a + t.dauer, 0);
  // Rekorde aller Übungen (e1RM ohne RPE): Chronik über den ganzen Verlauf, gezählt im Zeitraum, gruppiert wie das Volumen
  const chronik = rekordChronik(Object.keys(trainingsTage).sort().map((d) => trainingAm(d)).filter(Boolean));
  const prImZeitraum = chronik.filter((r) => r.datum >= (x[0] ?? HEUTE));
  const prSaeulen = [];
  for (let i = 0; i < x.length; i += gruppe) {
    const a = x[i], b = x[i + gruppe] ?? plusTage(HEUTE, 1);
    prSaeulen.push({ label: a, teile: { pr: prImZeitraum.filter((r) => r.datum >= a && r.datum < b).length } });
  }
  const prJeUebung = Object.entries(prImZeitraum.reduce((m, r) => ({ ...m, [r.key]: (m[r.key] ?? 0) + 1 }), {}))
    .map(([key, n]) => ({ name: nameVon(key), wert: n })).sort((a, b) => b.wert - a.wert).slice(0, 6);
  const letzterPr = chronik.at(-1);
  // Frequenz und Kalender
  const montag = plusTage(HEUTE, -((new Date(`${HEUTE}T00:00:00Z`).getUTCDay() + 6) % 7));
  const von = plusTage(montag, -7 * n);
  const imBereich = Object.keys(trainingsTage).filter((d) => d >= von);
  let serie = 0, beste = 0;
  for (let w = 0; w < n; w++) {
    const a = plusTage(von, w * 7), b = plusTage(a, 7);
    const anzahl = imBereich.filter((d) => d >= a && d < b).length;
    if (anzahl >= 3) { serie += 1; beste = Math.max(beste, serie); } else if (!(URLAUB && a <= URLAUB.bis && b > URLAUB.von)) serie = 0;
  }
  // Harte Sätze je Muskel (Durchschnitt je Woche)
  const eintraege = wd.flatMap((w) => w.trainings.flatMap((t) => t.uebungen.map((u) => ({ muskeln: uebung(u.key)?.m ?? [], saetze: u.saetze, e1rm: u.e1rm }))));
  const hart = Object.entries(harteSaetzeJeMuskel(eintraege)).map(([m, v]) => ({ name: MUSKEL_DE[m] ?? m, wert: Math.round((v / n) * 10) / 10 }))
    .sort((a, b) => b.wert - a.wert);
  // Intensität: Arbeitssätze nach % vom e1RM der Übung (aktuelle Form am Trainingstag), Gesamtlast bei Körpergewicht
  const zonen = [[deEn('unter 70 %', 'below 70 %'), 0, 0.7], ['70–80 %', 0.7, 0.8], ['80–90 %', 0.8, 0.9], [deEn('über 90 %', 'above 90 %'), 0.9, Infinity]].map(([name]) => ({ name, wert: 0 }));
  for (const w of wd) for (const t of w.trainings) for (const u of t.uebungen) {
    if (!(u.e1rm > 0)) continue;
    for (const s of u.saetze) {
      const p = (s.last ?? s.kg) / u.e1rm;
      if (p > 0 && s.wdh > 0) zonen[p < 0.7 ? 0 : p < 0.8 ? 1 : p < 0.9 ? 2 : 3].wert += 1;
    }
  }
  // Hinweise
  // Hinweise (124): zuerst Fortschritt (grün), dann Plateau erst nach 8 Trainingswochen ohne neues e1RM (im Cut 12 –
  // Blöcke laufen länger und im Defizit ist Halten schon gut), der schwächste Lift als Tipp statt Warnung
  const hinweise = [];
  const fenster = 8, fort = LIFTS.map((l) => {
    const w = e1rmWoche[l].slice(-n), neu = w.slice(-fenster).filter((v) => v != null), alt = w.slice(0, -fenster).filter((v) => v != null);
    return [l, neu.length && alt.length ? Math.max(...neu) - Math.max(...alt) : null];
  }).filter(([, d]) => d != null && d > 0.5);
  if (fort.length) hinweise.push({ art: 'gut', t: deEn('Fortschritt', 'Progress'),
    text: `${fort.map(([l, d]) => `${liftName(l)} +${gwE(d, 1)}`).join(', ')} ${deEn(`e1RM in den letzten ${fenster} Wochen gegenüber dem Bestwert davor.`, `e1RM in the last ${fenster} weeks over the best before.`)}` });
  const plateaus = LIFTS.map((l) => [l, plateau(e1rmWoche[l].slice(-n), { wochen: einst.cut ? 12 : 8 })]).filter(([, p]) => p.plateau);
  if (plateaus.length) {
    // Zusammengesetzte Hinweise gleich in der Anzeigesprache bauen – Teil für Teil kann der Übersetzer sie nicht
    hinweise.push({ t: plateaus.length === 1 ? deEn(`${liftName(plateaus[0][0])}: kein neues e1RM`, `${liftName(plateaus[0][0])}: no new e1RM`) : deEn('Kein neues e1RM', 'No new e1RM'),
      text: `${plateaus.map(([l, p]) => deEn(`${liftName(l)} seit ${p.wochenOhneRekord} Trainingswochen (Bestwert ${gwE(p.best, 1)})`,
        `${liftName(l)} for ${p.wochenOhneRekord} training weeks (best ${gwE(p.best, 1)})`)).join(', ')}. ${deEn('Hebel: Wiederholungsbereich wechseln, eine Variante (Pause, Pins) einbauen oder eine Deload-Woche einplanen.',
        'Levers: change the rep range, add a variation (pause, pins) or plan a deload week.')}` });
  }
  const liftWerte = Object.entries(profil.lifts).sort((a, b) => a[1].wert - b[1].wert);
  if (liftWerte.length === 3 && profil.gesamt - liftWerte[0][1].wert >= 3) {
    const [l, w] = liftWerte[0];
    // In Prozent zum eigenen Schnitt der drei Lifts (Symmetric Strength gleicht Körpergewicht und Lift aus), statt „Punkte“
    const pz = (x) => `${x >= 0 ? '+' : '−'}${fmt(Math.abs(x), 0)} %`;
    const abw = (ll) => (profil.lifts[ll].wert / profil.gesamt - 1) * 100;
    const andere = liftWerte.slice(1).map(([ll]) => `${liftName(ll)} ${pz(abw(ll))}`).join(', ');
    const naechste = deEn(w.naechste?.name, uebersetze(w.naechste?.name ?? '') ?? w.naechste?.name);
    hinweise.push({ art: 'tipp', t: deEn(`Ausgleich: ${liftName(l)}`, `Balance: ${liftName(l)}`),
      text: deEn(`${liftName(l)} liegt ${fmt(Math.abs(abw(l)), 0)} % unter deinem Schnitt (${andere}). Noch ${gwE(w.naechste?.fehlenKg ?? 0, 1)} e1RM bis zur Stufe „${naechste}“ – Stufen nach Symmetric Strength, nicht Strength Level.`,
        `${liftName(l)} is ${fmt(Math.abs(abw(l)), 0)} % below your average (${andere}). ${gwE(w.naechste?.fehlenKg ?? 0, 1)} e1RM to go until the “${naechste}” level – levels per Symmetric Strength, not Strength Level.`) });
  }
  const belastung = wd.slice(-Math.min(n, 26));
  // Verläufe je Woche: Total aus der aktuellen Form (bestes e1RM der letzten 12 Wochen je Lift), Körpergewicht, Punkte
  const formReihe = Object.fromEntries(LIFTS.map((l) => [l, e1rmWoche[l].map((_, i) => form(e1rmWoche[l], i + 1))]));
  const totalReihe = wochen.map((_, i) => (LIFTS.every((l) => formReihe[l][i] != null) ? LIFTS.reduce((a, l) => a + formReihe[l][i], 0) : null));
  // Wochendurchschnitt: das Gewicht schwankt von Tag zu Tag, ein einzelner Messwert wäre zu zufällig
  const gemessen = wochen.map((wo) => { const m = KOERPERVERLAUF.filter((k) => k.datum >= wo && k.datum < plusTage(wo, 7)); return m.length ? Math.round((m.reduce((a, k) => a + k.kg, 0) / m.length) * 10) / 10 : null; });
  const kgWoche = wochen.map((wo) => (KOERPERVERLAUF.length ? koerperAm(plusTage(wo, 6), KOERPERVERLAUF) : null));
  const relativ = totalReihe.map((t, i) => (t != null && kgWoche[i] ? Math.round((t / kgWoche[i]) * 100) / 100 : null));
  const dotsReihe = totalReihe.map((t, i) => (t != null && kgWoche[i] ? dots(t, kgWoche[i]) : null));
  const glReihe = totalReihe.map((t, i) => (t != null && kgWoche[i] ? ipfGl(t, kgWoche[i]) : null));
  const ab = (r) => r.slice(-n);
  const hat = (r) => ab(r).some((v) => v != null);
  // RPE-Trend: Ø RPE der Arbeitssätze je Woche; Ziel-RPE nur aus Trainings mit Plan (geplant.rpe)
  const rpeIst = wd.map((w) => { const r = w.trainings.flatMap((t) => t.uebungen.flatMap((u) => u.saetze.map((s) => s.rpe))).filter((v) => v != null); return r.length ? Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10 : null; });
  const rpeSoll = rpeTrend(x, trainings).soll;

  if (!imBereich.length) return html`<div class="screen">
    <header class="topbar"><div><div class="eyebrow">Dein Fortschritt</div><h1 class="h1">Statistik</h1></div>${DEMO ? html`<span class="proto">Beispieldaten</span>` : null}</header>
    <div class="filter einreihig" role="group" aria-label="Zeitraum">${bereiche.map(([t, w]) => html`<button key=${t} class="chip" aria-pressed=${String(bereich === w)} onClick=${() => setBereich(w)}>${t}</button>`)}</div>
    <section class="card pad stack"><h2 class="h2">Noch keine Trainings im Zeitraum</h2>
      <p class="muted" style="margin:0">Sobald du Sätze abhakst, erscheinen hier e1RM-Verlauf, Kraftprofil, Belastung, Volumen und Rekorde.${bereich < 52 ? ' Oder einen längeren Zeitraum wählen.' : ''}</p></section>
  </div>`;

  return html`<div class="screen">
    <header class="topbar"><div><div class="eyebrow">Dein Fortschritt</div><h1 class="h1">Statistik</h1></div>${DEMO ? html`<span class="proto">Beispieldaten</span>` : null}
      <nav class=${`reiter ${reiterListe.length > 6 ? 'viele' : ''}`} role="tablist" aria-label="Bereich">${reiterListe.map(([k, t]) => html`<button key=${k} role="tab" aria-selected=${String(reiter === k)} onClick=${() => waehleReiter(k)}>${t}</button>`)}</nav>
      ${/* Zeitraum im feststehenden Kopf: bleibt beim Scrollen sichtbar und filtert alles darunter (Wunsch 123) */ ''}
      ${['profil', 'analyse'].includes(reiter) ? null : html`<div class="filter einreihig kopf-filter" role="group" aria-label="Zeitraum">${bereiche.map(([t, w]) => html`<button key=${t} class="chip" aria-pressed=${String(bereich === w)} onClick=${() => setBereich(w)}>${t}</button>`)}</div>`}</header>

    <div class="reiter-inhalt statistik-inhalt unter-inhalt" key=${reiter}>
    ${reiter === 'ausdauer' ? html`<${AusdauerStatistik} liste=${ausdauer} einst=${einst} setEinst=${setEinst} trainings=${trainings} x=${x}/>`
    : reiter === 'tempo' ? html`<${TempoStatistik} von=${bereich === 0 ? null : x[0] ?? null}/>`
    : reiter === 'analyse' ? html`<${Insights} ausdauer=${ausdauer} einst=${einst} heute=${HEUTE} trainings=${DEMO
        // Beispieldaten: Tage mit fester Uhrzeit, damit Dauer und Zeitnutzung etwas zeigen
        ? Object.keys(trainingsTage).map((d) => { const t = trainingAm(d); return t && { datum: d, start: `${d}T17:00:00Z`, ende: new Date(Date.parse(`${d}T17:00:00Z`) + (60 + (Number(d.slice(8)) % 5) * 12) * 60000).toISOString(), uebungen: t.uebungen }; }).filter(Boolean)
        : trainings}/>`
    : reiter === 'kraft' ? html`
    <section class="card total wichtig">
      <div><div class="eyebrow total-kopf">Total · bestes e1RM, ${FORM_WOCHEN} Wochen</div><div class="wert">${gw(total, 1)}<small>${einheit()}</small></div>
        ${totalVorher != null ? html`<div class=${`delta ${total >= totalVorher ? 'auf' : 'ab'}`}>${pfeil(total - totalVorher)} ${einheit()} ${deEn("seit", "since")} ${datumKurz(x[0])}${x[0].slice(0, 4)}</div>`
          : html`<div class="muted" style="font-size:13px">${total == null ? 'Braucht je einen Satz in Kniebeuge, Bankdrücken und Kreuzheben.' : 'Im Zeitraum nicht alle drei Lifts trainiert.'}</div>`}</div>
      <div class="dots-wert"><div class="eyebrow">DOTS</div><b>${total != null && kg > 0 ? fmt(dots(total, kg), 1) : '–'}</b><span class="muted" style="font-size:12px">${kg > 0 ? `IPF GL ${fmt(ipfGl(total, kg), 1)} · bei ${gwE(kg)}` : 'Körpergewicht fehlt'}</span></div>
    </section>
    <div class="kacheln">${LIFTS.map((l) => {
      const w = e1rmWoche[l].slice(-n), jetzt = aktuell[l], d = jetzt != null && vorher[l] != null ? jetzt - vorher[l] : null;
      return html`<div class="kachel" key=${l}><span class="l"><i class="dot" style=${`background:${LIFT[l].farbe}`}></i>${LIFT[l].name}</span>
        <b>${gw(jetzt, 1)}</b>${d != null ? html`<span class=${`delta ${d >= 0 ? 'auf' : 'ab'}`}>${pfeil(d)}</span>` : null}<${Sparkline} werte=${w} farbe=${LIFT[l].farbe}/></div>`;
    })}</div>
    ${hinweise.length ? html`<section class="stack" style="gap:8px">${hinweise.map((h) => html`<div key=${h.t} class=${`hint ${h.art ?? ''}`}>${h.art === 'gut' ? I.check : h.art === 'tipp' ? I.statistik : I.warn}<span class="t">${h.t}</span><span></span><p>${h.text}</p></div>`)}</section>` : null}
    <${LinienChart} titel="e1RM-Verlauf" unter="Bester Satz je Woche" x=${x} serien=${serien} einheit=${einheit()}/>
    ${hat(totalReihe) ? html`<${LinienChart} titel="Total" unter="Summe der besten e1RM der jeweils letzten 12 Wochen" x=${x} serien=${[{ id: 'total', name: 'Total', farbe: 'var(--ink)', werte: ab(totalReihe).map(inAnzeige) }]} einheit=${einheit()} hoehe=${180}/>` : null}
    ${hat(dotsReihe) ? html`<${LinienChart} titel="Punkte" unter="DOTS und IPF GL aus Total und Körpergewicht (zeitlich nächster Messwert)" x=${x}
      serien=${[{ id: 'dots', name: 'DOTS', farbe: 'var(--lift-bench)', werte: ab(dotsReihe) }, { id: 'gl', name: 'IPF GL', farbe: 'var(--lift-squat)', werte: ab(glReihe) }]} einheit="" hoehe=${180}/>` : null}
    ${hat(relativ) ? html`<${LinienChart} titel="Relative Stärke" unter="Total ÷ Körpergewicht" x=${x} serien=${[{ id: 'rel', name: 'Total ÷ KG', farbe: 'var(--lift-dead)', werte: ab(relativ) }]} einheit="×" stellen=${2} hoehe=${170}/>` : null}
    ${einst.wettkampfErgebnisse !== false && setEinst ? html`<${WettkaempfeKarte} einst=${einst} setEinst=${setEinst}/>` : null}
    <${StillstandKarte} trainings=${trainings} cut=${!!einst.cut}/>
    <${RpeKarte} trainings=${trainings}/>
    <${Zielprognose} aktuell=${aktuell} wettkampf=${einst.wettkampfDatum ?? null} ziele=${einst.ziele ?? {}} setZiel=${setEinst ? (key, kg) => setEinst({ ...einst, ziele: { ...(einst.ziele ?? {}), [key]: kg } }) : null}/>
    <section class="card pad stack">
      <div class="row between"><span class="viz-t">Neue Rekorde</span><span class="muted" style="font-size:12.5px">e1RM</span></div>
      ${!PR_FEED.length ? html`<p class="muted" style="margin:0;font-size:14px">Noch keine Rekorde in Kniebeuge, Bankdrücken oder Kreuzheben.</p>` : null}
      ${PR_FEED.map((p) => html`<div key=${p.datum + p.lift} class="row">
        <span class="medaille">PR</span>
        <div style="flex:1;min-width:0"><b>${LIFT[p.lift].name} · ${p.satz ? `${gwE(p.satz.kg)} × ${p.satz.wdh}` : p.text}</b><div class="muted" style="font-size:12.5px">${datumKurz(p.datum)}${p.datum.slice(0, 4)}</div></div>
        <b class="zahl" style="font-size:22px">${gw(p.e1rm, 1)}</b></div>`)}
    </section>

    <section class="kacheln">
      <div class="kachel"><span class="l">Rekorde</span><b>${prImZeitraum.length}</b><span class="muted" style="font-size:12px">im Zeitraum, alle Übungen</span></div>
      <div class="kachel"><span class="l">Ø je Monat</span><b>${fmt(prImZeitraum.length / Math.max(1, n / 4.35), 1)}</b><span class="muted" style="font-size:12px">Rekorde</span></div>
      <div class="kachel"><span class="l">Letzter</span><b>${letzterPr ? tageZwischen(letzterPr.datum, HEUTE) : '–'}</b><span class="muted" style="font-size:12px">${letzterPr ? `Tage her · ${nameVon(letzterPr.key)}` : 'noch keiner'}</span></div>
    </section>
    ${prImZeitraum.length ? html`<${StapelSaeulen} titel="Rekorde" unter=${`Neue Bestwerte (e1RM) über alle Übungen ${gruppe > 1 ? 'je 4 Wochen' : 'je Woche'}`} daten=${prSaeulen}
      serien=${[{ id: 'pr', name: 'Rekorde', farbe: 'var(--gold)' }]} einheit=""/>
    <${Rangliste} titel="Meiste Rekorde" unter="Übungen mit den meisten neuen Bestwerten im Zeitraum" zeilen=${prJeUebung}/>` : null}
    <section class="card pad">
      <div class="row between" style="margin-bottom:8px"><span class="viz-t">Rekordtafel</span></div>
      <div class="filter" style="margin-bottom:6px">${LIFTS.map((l) => html`<button key=${l} class="chip" aria-pressed=${String(rekLift === l)} onClick=${() => setRekLift(l)}>
        <i class="dot" style=${`background:${LIFT[l].farbe}`}></i>${LIFT[l].name}</button>`)}</div>
      <table class="rec"><thead><tr><th>Wdh</th><th>Gewicht</th><th>Datum</th><th>e1RM</th></tr></thead>
        <tbody>${REKORDE[rekLift].map((r, i) => r ? html`<tr key=${i}><td>${i + 1}</td><td class="k">${gwE(r[0])}</td><td class="muted">${datumKurz(r[1])}${r[1].slice(0, 4)}</td><td>${gw(e1rm(r[0], i + 1), 1)}</td></tr>`
          : html`<tr key=${i}><td>${i + 1}</td><td class="k muted">–</td><td></td><td></td></tr>`)}</tbody></table>
    </section>`
    : reiter === 'profil' ? html`
    <section class="card pad stack">
      <div><span class="viz-t">Erholung</span>
        <div class="viz-u">${`Aus den Trainings der letzten ${ERHOLUNG.stunden} Stunden: Sätze × Anstrengung je Muskel, klingt über ${ERHOLUNG.stunden} h ab`}</div></div>
      <${ErholungKarte} zustand=${erholt}/>
      <p class="muted" style="margin:0;font-size:12.5px">Eigene Näherung wie „Muscle Recovery“ in Jefit: Hauptmuskel zählt voll, mitarbeitende Muskeln halb, Sätze ab RPE 8 mehr als leichte. Gefühl geht vor.</p>
    </section>
    <section class="card pad stack">
      <div class="row between" style="align-items:flex-start"><div><span class="viz-t">Kraftprofil</span>
        <div class="viz-u"><span>${Object.keys(profil.lifts).length ? 'Nach der veröffentlichten Methode von Symmetric Strength' : 'Aus deinen Übungen abgeleitet (Näherung)'}</span> · ${`${gwE(kg)} Körpergewicht`}</div></div>
        <div class="dots-wert"><div class="eyebrow">Gesamt</div><b>${fmt(profil.gesamt, 1)}</b></div></div>
      <${KoerperKarte} muskeln=${profil.muskeln} quellen=${profil.quellen}/>
      <div class="stack" style="gap:10px">${LIFTS.map((l) => profil.lifts[l] && html`<div key=${l} class="stufe-zeile">
        <span class="row" style="gap:6px"><i class="dot" style=${`background:${LIFT[l].farbe}`}></i><b>${LIFT[l].name}</b></span>
        <span class="stufe-spur"><i style=${`width:${Math.min(100, (profil.lifts[l].wert / 125) * 100)}%`}></i></span>
        <span class="stufe-text"><b>${fmt(profil.lifts[l].wert, 1)}</b> ${profil.lifts[l].stufe}</span>
        <span class="muted stufe-naechste"><b class=${profil.lifts[l].wert >= profil.gesamt ? 'pz-auf' : 'pz-ab'}>${`${profil.lifts[l].wert >= profil.gesamt ? '+' : '−'}${fmt(Math.abs((profil.lifts[l].wert / profil.gesamt - 1) * 100), 0)} % zum Schnitt`}</b>
          ${' · '}<span>${profil.lifts[l].naechste ? `noch ${gwE(profil.lifts[l].naechste.fehlenKg, 1)} e1RM bis „${profil.lifts[l].naechste.name}“` : 'höchste Stufe'}</span></span>
      </div>`)}</div>
      <details class="ab-sollist"><summary><span>So wird gerechnet</span><span class="woche-pfeil" aria-hidden="true">${I.weiter}</span></summary>
      <div class="muskel-quellen">${Object.entries(profil.muskeln).filter(([, w]) => w != null).sort((x, y) => y[1] - x[1]).map(([m, w]) => html`<details key=${m} class="muskel-quelle">
        <summary><i style=${`background:${farbeVon(w)}`}></i><b>${MUSKEL_NAME[m]}</b><span class="muskel-wert" style=${`color:${farbeVon(w)}`}>${fmt(w, 1)}</span></summary>
        <ul>${(profil.quellen[m] ?? []).map((q, i) => html`<li key=${i}><span>${LIFT[q.name] ? liftName(q.name) : q.name}${q.geschaetzt ? ' *' : ''}</span><b style=${`color:${farbeVon(q.wert)}`}>${fmt(q.wert, 1)}</b></li>`)}</ul></details>`)}</div>
      <span class="muted" style="font-size:12px">* Näherung über das Verhältnis zum Kreuzheben, zählt halb.</span>
      <p class="muted" style="margin:0;font-size:12.5px">Kniebeuge, Bankdrücken und Kreuzheben nach der Methode von Symmetric Strength. Weitere Übungen (Klimmzug, Rudern, Schulterdrücken, Waden, Arme …) sind eine eigene Näherung: Jede Übung wird über ihr typisches Verhältnis zum Kreuzheben bei gleicher Stärke umgerechnet, zählt halb so viel und liegt höchstens 10 Punkte über oder unter dem Schnitt deiner drei Lifts („begrenzt“: Maschinen zeigen je Gerät andere Gewichte, viele Wdh ergeben ein zu hohes e1RM). Bauch kommt aus Kniebeuge und Kreuzheben. Genau prüfen: bei Symmetric Strength.</p>
      <p class="muted" style="margin:0;font-size:12.5px">Punkte: Wert je Lift nach Symmetric Strength, Körpergewicht eingerechnet (100 = „Herausragend“). „% zum Schnitt“ zeigt, welcher Lift stärker oder schwächer ist als deine drei im Mittel. Die Stufen sind die von Symmetric Strength in eigener Übersetzung – Strength Level zählt anders (z. B. „Advanced“ dort ≠ „Stark“ hier).</p></details>
      <div class="row wrap"><a class="btn btn-soft btn-sm" href=${SYMMETRIC_RECHNER} target="_blank" rel="noopener">Symmetric Strength ${I.extern}</a>
        <a class="btn btn-soft btn-sm" href="https://strengthlevel.com/strength-standards" target="_blank" rel="noopener">Strength Level ${I.extern}</a></div>
    </section>
    ${einfach ? null : html`<${Bestenliste} gruppen=${einst.gruppen ?? []}/>`}
    ${einfach ? null : html`<${Vergleich} freigegeben=${true} ausgeblendet=${Object.keys(einst.freundeAus ?? {}).filter((id) => einst.freundeAus[id]?.vergleich === false)}/>`}`
    : reiter === 'belastung' ? html`
    <${FormKarte} daten=${formDaten(planTage, { wettkampf: einfach ? null : einst.wettkampfDatum ?? null, von: x[0] ?? null })}/>
    ${belastung.some((w) => w.foster.last > 0) ? html`<section class="kacheln">
      <div class="kachel"><span class="l">Belastung</span><b>${fmt(letzte.foster.last, 0)}</b><span class="muted" style="font-size:12px">letzte Woche</span></div>
      <div class="kachel"><span class="l">Monotonie</span><b>${fmt(letzte.foster.monotonie, 2)}</b><span class="muted" style="font-size:12px">Ø ÷ Streuung</span></div>
      <div class="kachel"><span class="l">Strain</span><b>${fmt(letzte.foster.strain, 0)}</b><span class="muted" style="font-size:12px">Last × Monotonie</span></div>
    </section>
    <${StapelSaeulen} titel="Trainingsbelastung" unter=${`Session-RPE × Minuten je Woche (Foster), letzte ${belastung.length} Wochen`}
      daten=${belastung.map((w) => ({ label: w.woche, teile: { last: w.foster.last } }))} serien=${[{ id: 'last', name: 'Belastung', farbe: 'var(--seq-3)' }]} einheit="AU"/>`
    : html`<section class="card pad stack"><span class="viz-t">Trainingsbelastung</span>
      <p class="muted" style="margin:0;font-size:14px">Rechnet mit Session-RPE × Minuten (Foster). Die Session-RPE fragt die App beim Beenden ab; Jefit hat sie nicht gespeichert. Mit den nächsten Trainings füllt sich das hier.</p></section>`}
    <${LinienChart} titel="INOL je Lift" unter=${`Wdh ÷ (100 − % e1RM), summiert je Woche · Richtwert ${INOL_RICHTWERT.quelle}`}
      x=${x} serien=${LIFTS.map((l) => ({ id: l, name: LIFT[l].name, farbe: LIFT[l].farbe, werte: wd.map((w) => Math.round(w.inol[l] * 100) / 100) }))}
      einheit="" stellen=${2} referenz=${{ wert: INOL_RICHTWERT.wocheSehrHart, text: 'über 4 je Woche: sehr hart' }}/>
    ${rpeIst.some((v) => v != null) ? html`<${LinienChart} titel="RPE-Trend" unter=${rpeSoll.some((v) => v != null) ? 'Ø RPE der Arbeitssätze je Woche gegen das geplante Ziel-RPE' : 'Ø RPE der Arbeitssätze je Woche (nur Sätze mit RPE)'} x=${x}
      serien=${[{ id: 'ist', name: 'Ist', farbe: 'var(--lift-squat)', werte: rpeIst }, ...(rpeSoll.some((v) => v != null) ? [{ id: 'soll', name: 'Ziel', farbe: 'var(--muted)', werte: rpeSoll }] : [])]} einheit="" hoehe=${170}/>` : null}
    <${Rangliste} titel="Harte Sätze je Muskel" unter="Ø je Woche, Sätze ab RPE 7 (ohne RPE geschätzt), Hauptmuskel zählt" zeilen=${hart}/>
    <${ZonenBalken} titel="Intensität" unter="Arbeitssätze nach % vom e1RM" zonen=${zonen}/>`
    : reiter === 'training' ? html`
    <section class="kacheln">
      <div class="kachel"><span class="l">Einheiten</span><b>${imBereich.length}</b><span class="muted" style="font-size:12px">im Zeitraum</span></div>
      <div class="kachel"><span class="l">Pro Woche</span><b>${fmt(imBereich.length / n, 1)}</b><span class="muted" style="font-size:12px">im Schnitt</span></div>
      <div class="kachel"><span class="l">Beste Serie</span><b>${beste}</b><span class="muted" style="font-size:12px">Wochen mit 3+</span></div>
    </section>
    <${BereitschaftVerlauf} trainings=${trainings} von=${x[0] ?? HEUTE} aus=${einst.bereitschaft === false}/>
    <${SchlafKarte} trainings=${trainings}/>
    <${StapelSaeulen} titel="Volumen" unter=${gruppe > 1 ? 'Bewegte kg je 4 Wochen' : 'Bewegte kg je Woche'} daten=${saeulen} serien=${volSerien}/>
    ${mitDauer.length ? html`<section class="kacheln">
      <div class="kachel"><span class="l">Trainingszeit</span><b>${fmt(zeitGesamt / 60, 1)}</b><span class="muted" style="font-size:12px">Stunden im Zeitraum</span></div>
      <div class="kachel"><span class="l">Ø je Einheit</span><b>${fmt(zeitGesamt / mitDauer.length, 0)}</b><span class="muted" style="font-size:12px">Minuten</span></div>
      <div class="kachel"><span class="l">Längste</span><b>${fmt(Math.max(...mitDauer.map((t) => t.dauer)), 0)}</b><span class="muted" style="font-size:12px">Minuten</span></div>
    </section>
    <${StapelSaeulen} titel="Trainingszeit" unter=${`Ø Minuten je Trainingstag, gruppiert je ${gruppe > 1 ? `${gruppe} Wochen` : 'Woche'} · ${mitDauer.length} Einheiten mit Dauer`} daten=${zeitSaeulen}
      serien=${[{ id: 'min', name: 'Minuten', farbe: 'var(--acc)' }]} einheit="min"/>` : null}
    <${Heatmap} titel="Trainingskalender" unter="Jeder Tag eine Kachel, kräftiger = mehr bewegt" von=${von} wochenAnzahl=${n} tage=${trainingsTage}
      markiere=${imUrlaub}/>
    <${NotizKarte} trainings=${trainings} von=${x[0] ?? HEUTE}/>
    ${einfach ? html`<${RpeKarte} trainings=${trainings}/>` : null}`
    : html`
    ${hat(gemessen) ? html`<${KoerperStatistik} x=${x} werte=${ab(gemessen)} von=${x[0]} ziel=${einst.gewichtZiel}/>` : null}
      ${!hat(gemessen) ? html`<section class="card pad"><p class="muted" style="margin:0">Noch kein Körpergewicht im Zeitraum – auf „Heute“ mit −/+ eintragen.</p></section>` : null}
      <${MasseKarte} masse=${masse} setzen=${masseSetzen}/>
      <${ZyklusKarte} einst=${einst} setEinst=${setEinst} trainings=${trainings}/>`}
    </div>
  </div>`;
}

/** Körpergewicht im Zeitraum (02.11. „sieht langweilig aus“): große Zahl mit Veränderung, Flächenverlauf mit Ziellinie,
 *  Fortschritt zum Ziel, darunter Trend/Spanne/Messungen. */
function KoerperStatistik({ x, werte, von, ziel }) {
  const g = gewichtImZeitraum(KOERPERVERLAUF, von);
  const [exakt, setExakt] = useState(false);              // jede Messung statt Wochendurchschnitt
  const [bearbeitenRoh, setBearbeitenRoh] = useState(null), [neuKg, setNeuKg] = useState(null);   // 265: Tag ändern/löschen
  const bearbeiten = bearbeitenRoh, setBearbeiten = (m) => { setBearbeitenRoh(m); setNeuKg(null); };
  const mess = KOERPERVERLAUF.filter((m) => m.datum >= von);
  const vz = (d, st = 1) => (d == null ? '–' : `${d > 0 ? '+' : d < 0 ? '−' : '±'}${gw(Math.abs(d), st)}`);
  const punkte = (exakt ? mess.map((m) => [m.datum, m.kg]) : x.map((d, k) => [d, werte[k]])).filter(([, w]) => w != null).map(([d, w]) => [d, inAnzeige(w)]);
  const zielA = ziel ? inAnzeige(ziel) : null;
  // Fortschritt zum Ziel: vom ersten Wert im Zeitraum bis zum Ziel
  const start = punkte[0]?.[1], jetzt = punkte.at(-1)?.[1];
  const anteil = zielA != null && start != null && jetzt != null && start !== zielA ? Math.max(0, Math.min(1, (jetzt - start) / (zielA - start))) : null;
  return html`<section class="stack" style="gap:10px">
    <section class="card pad gw-held">
      <div class="row between"><span class="viz-t">Körpergewicht</span>
        <div class="seg gw-seg" role="group" aria-label="Darstellung"><button aria-pressed=${String(!exakt)} onClick=${() => setExakt(false)}>Woche</button>
          <button aria-pressed=${String(exakt)} onClick=${() => setExakt(true)}>Messungen</button></div></div>
      ${g ? html`<div class="gw-held-zahl"><b class="zahl tab-num">${gw(g.aktuell, 1)}</b><small>${einheit()}</small>
        <span class=${`gw-badge ${g.veraenderung > 0 ? 'auf' : g.veraenderung < 0 ? 'ab' : ''}`}>${`${g.veraenderung > 0 ? '▲' : g.veraenderung < 0 ? '▼' : '●'} ${vz(g.veraenderung)} ${einheit()}`}</span></div>
        <span class="muted" style="font-size:12.5px">${deEn(`seit ${datumKurz(g.seit)} · ${punkte.length} ${exakt ? 'Messungen' : 'Wochen'}`, `since ${datumKurz(g.seit)} · ${punkte.length} ${exakt ? 'measurements' : 'weeks'}`)}</span>` : null}
      <${GewichtFlaeche} punkte=${punkte} ziel=${zielA}/>
      ${anteil != null ? html`<div class="gw-ziel">
        <div class="row between"><span class="muted" style="font-size:12.5px">${`Ziel ${gw(ziel, 1)} ${einheit()}`}</span>
          <b style="font-size:13px">${Math.abs(jetzt - zielA) < 0.05 ? 'erreicht' : `noch ${gw(Math.abs(zielA - jetzt), 1)} ${einheit()}`}</b></div>
        <div class="gw-ziel-spur"><i style=${`width:${Math.round(anteil * 100)}%`}></i></div></div>` : null}
    </section>
    ${g ? html`<div class="kacheln drei">
      <div class="kachel"><span class="l">Trend</span><b>${vz(g.proWoche, 2)}</b><span class="muted" style="font-size:12px">${einheit()} je Woche</span></div>
      <div class="kachel"><span class="l">Tiefster</span><b>${gw(g.min, 1)}</b><span class="muted" style="font-size:12px">${einheit()}</span></div>
      <div class="kachel"><span class="l">Höchster</span><b>${gw(g.max, 1)}</b><span class="muted" style="font-size:12px">${einheit()}</span></div>
    </div>` : null}
    ${mess.length ? html`<details class="card pad gw-liste">
      <summary><span>${deEn('Alle Einträge', 'All entries')}</span><span class="muted">${mess.length}</span><span class="woche-pfeil" aria-hidden="true">${I.weiter}</span></summary>
      <ul>${[...mess].reverse().map((m, i, l) => { const d = l[i + 1] ? m.kg - l[i + 1].kg : null;
        return html`<li key=${m.datum}><button class="gw-zeile" disabled=${!DIENSTE.gewichtAendern} onClick=${() => setBearbeiten(m)}><span>${datumLang(m.datum)}</span>${d != null && Math.abs(d) >= 0.05 ? html`<small>${vz(d)}</small>` : html`<small></small>`}
          <b class="tab-num">${`${gw(m.kg, 1)} ${einheit()}`}</b></button></li>`; })}</ul>
    </details>` : null}
    ${bearbeiten ? html`<${Sheet} zu=${() => setBearbeiten(null)} label=${deEn('Gewicht ändern', 'Edit weight')}>
      <h2 class="h2">${datumLang(bearbeiten.datum)}</h2>
      <${ZahlFeld} id="gw-aendern" label=${deEn('Körpergewicht', 'Body weight')} wert=${neuKg ?? bearbeiten.kg} setze=${setNeuKg} kg=${true}/>
      <div class="row"><button class="btn btn-gefahr" style="flex:1" onClick=${() => { DIENSTE.gewichtAendern(bearbeiten.datum, null); setBearbeiten(null); }}>${deEn('Löschen', 'Delete')}</button>
        <button class="btn btn-chalk" style="flex:1.4" disabled=${!(neuKg > 0)} onClick=${() => { DIENSTE.gewichtAendern(bearbeiten.datum, neuKg); setBearbeiten(null); }}>${deEn('Speichern', 'Save')}</button></div>
      <span class="muted" style="font-size:12.5px">${deEn('Ein Wert je Tag. Gewicht aus einem Training an diesem Tag bleibt dort gespeichert.', 'One value per day. A weight saved with a workout that day stays with the workout.')}</span>
    <//>` : null}
  </section>`;
}

/** Flächendiagramm: Verlauf mit Farbverlauf darunter, letzter Punkt leuchtet, Ziellinie gestrichelt. */
function GewichtFlaeche({ punkte, ziel }) {
  if (punkte.length < 2) return html`<p class="muted" style="margin:0;font-size:13px">Mindestens zwei Werte für einen Verlauf.</p>`;
  const B = 320, H = 150, oben = 14, unten = 22;
  const ws = punkte.map(([, w]) => w).concat(ziel != null ? [ziel] : []);
  let lo = Math.min(...ws), hi = Math.max(...ws);
  const rand = Math.max(0.5, (hi - lo) * 0.15); lo -= rand; hi += rand;
  const px = (k) => (k / (punkte.length - 1)) * B, py = (w) => oben + (1 - (w - lo) / (hi - lo)) * (H - oben - unten);
  const linie = punkte.map(([, w], k) => `${k ? 'L' : 'M'}${px(k).toFixed(1)} ${py(w).toFixed(1)}`).join(' ');
  const flaeche = `${linie} L${B} ${H - unten} L0 ${H - unten} Z`;
  const [ld, lw] = punkte.at(-1);
  const mi = punkte.reduce((m, p) => (p[1] < m[1] ? p : m)), ma = punkte.reduce((m, p) => (p[1] > m[1] ? p : m));
  return html`<svg class="gw-flaeche" viewBox=${`0 0 ${B} ${H}`} preserveAspectRatio="none" role="img" aria-label="Verlauf Körpergewicht">
    <defs><linearGradient id="gw-verlauf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--acc)" stop-opacity=".45"/><stop offset="1" stop-color="var(--acc)" stop-opacity="0"/></linearGradient></defs>
    ${[0.25, 0.5, 0.75].map((f) => html`<line key=${f} x1="0" x2=${B} y1=${oben + f * (H - oben - unten)} y2=${oben + f * (H - oben - unten)} class="gw-gitter"/>`)}
    <path d=${flaeche} fill="url(#gw-verlauf)"/>
    <path d=${linie} class="gw-linie"/>
    ${ziel != null ? html`<line x1="0" x2=${B} y1=${py(ziel)} y2=${py(ziel)} class="gw-ziellinie"/>` : null}
    <circle cx=${px(punkte.length - 1)} cy=${py(lw)} r="5" class="gw-punkt"/>
    <text x="2" y=${H - 6} class="gw-achse">${datumKurz(punkte[0][0])}</text>
    <text x=${B - 2} y=${H - 6} class="gw-achse" text-anchor="end">${datumKurz(ld)}</text>
    <text x=${Math.min(B - 30, Math.max(20, px(punkte.indexOf(ma))))} y=${py(ma[1]) - 6} class="gw-wert" text-anchor="middle">${gw(ma[1], 1)}</text>
    ${mi !== ma ? html`<text x=${Math.min(B - 30, Math.max(20, px(punkte.indexOf(mi))))} y=${py(mi[1]) + 14} class="gw-wert" text-anchor="middle">${gw(mi[1], 1)}</text>` : null}
  </svg>`;
}

/** 208: Stillstand der wichtigsten Übungen mit konkretem Vorschlag. */
function StillstandKarte({ trainings, cut }) {
  const liste = merke('still', [trainings, cut, HEUTE], () => stillstaende(normiere(trainings), { heute: HEUTE, cut, istIso: (k) => ISO_FAMILIEN.has(uebung(k)?.f) }));
  return html`<section class="card pad stack">
    <div><span class="viz-t">${deEn('Stillstand', 'Plateaus')}</span><div class="viz-u">${deEn('Deine meistgenutzten Übungen der letzten 12 Wochen', 'Your most used exercises of the last 12 weeks')}</div></div>
    ${liste.length ? liste.map((s) => html`<div key=${s.key} class="stillstand">
      <div class="row between"><b>${nameVon(s.key)}</b><span class="wochen">${deEn(`seit ${s.wochen} Trainingswochen`, `for ${s.wochen} training weeks`)}</span></div>
      <small>${`${deEn('Bestwert', 'Best')} e1RM ${gwE(s.best, 1)} · ${s.vorschlag[sprache() === 'en' ? 1 : 0]}`}</small></div>`)
      : html`<p class="muted" style="margin:0;font-size:13.5px">${deEn('Kein Stillstand – deine wichtigsten Übungen machen Fortschritt.', 'No plateaus – your main exercises are progressing.')}</p>`}
  </section>`;
}

/** 199: Leistung an guten und schlechten Schlaftagen (der Verlauf steht seit 311 in BereitschaftVerlauf). */
function SchlafKarte({ trainings }) {
  const mit = trainings.filter((t) => !t.geloescht && t.bereitschaft && bereitschaftsWert(t.bereitschaft) != null);
  if (mit.length < 3) return null;
  const mittel = (l, f) => { const v = l.map(f).filter((z) => z != null); return v.length ? Math.round((v.reduce((s, z) => s + z, 0) / v.length) * 10) / 10 : null; };
  // Leistung: bestes e1RM des Tages je Übung relativ zum Bestwert der 90 Tage davor, gemittelt
  const E = normiere(trainings), leistung = (t) => {
    const vorher = E.filter((e) => e.datum < t.datum && e.datum >= plusTage(t.datum, -90)), q = [];
    for (const u of E.find((e) => e.datum === t.datum)?.uebungen ?? []) {
      const best = (l) => Math.max(-Infinity, ...l.filter((s) => s.kg > 0 && s.wdh > 0 && s.wdh <= 12 && s.typ !== 'warmup').map((s) => e1rm(s.kg, s.wdh)));
      const heute = best(u.saetze), alt = Math.max(-Infinity, ...vorher.flatMap((e) => e.uebungen.filter((v) => v.key === u.key)).map((v) => best(v.saetze)));
      if (Number.isFinite(heute) && Number.isFinite(alt) && alt > 0) q.push(heute / alt);
    }
    return q.length ? q.reduce((a, b) => a + b, 0) / q.length : null;
  };
  const gut = mittel(mit.filter((t) => t.bereitschaft.sleep >= 4), leistung), schlecht = mittel(mit.filter((t) => t.bereitschaft.sleep != null && t.bereitschaft.sleep <= 2), leistung);
  const unterschied = gut != null && schlecht != null ? Math.round((gut - schlecht) * 1000) / 10 : null;
  return html`${unterschied != null ? html`<section class="hint immer ${unterschied > 0 ? 'gut' : ''}">${I.info ?? I.warn}<span class="t">${deEn('Schlaf und Leistung', 'Sleep and performance')}</span><span></span>
      <p>${unterschied > 0 ? deEn(`Nach gutem Schlaf (4–5) warst du im Schnitt ${fmt(unterschied, 1)} % stärker als nach schlechtem (1–2).`, `After good sleep (4–5) you were on average ${fmt(unterschied, 1)} % stronger than after poor sleep (1–2).`)
        : deEn('Zwischen guten und schlechten Schlaftagen zeigt sich bei dir bisher kaum ein Unterschied.', 'So far there is hardly any difference between good and poor sleep days.')}</p></section>` : null}`;
}

/** 210: Notiz-Chips im Zeitraum – wie oft, an welchen Tagen. */
function NotizKarte({ trainings, von }) {
  const [wahl, setWahl] = useState(null);
  const im = trainings.filter((t) => !t.geloescht && t.datum >= von && t.notiz).map((t) => ({ t, ...chipsAus(t.notiz) }));
  const zahl = NOTIZ_CHIPS.map(([id, de, en]) => [id, sprache() === 'en' ? en : de, im.filter((x) => x.ids.includes(id)).length]).filter(([, , n]) => n);
  if (!zahl.length) return null;
  const treffer = wahl ? im.filter((x) => x.ids.includes(wahl)).sort((a, b) => b.t.datum.localeCompare(a.t.datum)) : [];
  return html`<section class="card pad stack">
    <div><span class="viz-t">${deEn('Wie war es?', 'How was it?')}</span><div class="viz-u">${deEn('Notiz-Chips beim Beenden im Zeitraum', 'Note chips from finishing in the period')}</div></div>
    <div class="chips-zeile notiz-chips">${zahl.map(([id, text, n]) => html`<button key=${id} class="chip" aria-pressed=${String(wahl === id)} onClick=${() => setWahl(wahl === id ? null : id)} translate="no">${`${text} · ${n}`}</button>`)}</div>
    ${treffer.length ? html`<ul class="notiz-tage">${treffer.slice(0, 12).map((x) => html`<li key=${x.t.id}><b>${datumKurz(x.t.datum)}</b><span class="muted">${x.rest || ''}</span></li>`)}</ul>` : null}
  </section>`;
}

/** 215: Wie gut schätzt du RPE? Abweichung in RPE je Lift (> 0 = zu niedrig angegeben, die Sätze waren schwerer). */
function RpeKarte({ trainings }) {
  // Kniebeuge, Bank, Kreuzheben (mit Varianten) – übrige Übungen getrennt nach Grundübung (Mehrgelenk) und Isolation
  const art = (k) => { const l = liftVon(k); return l !== 'andere' ? l : ISO_FAMILIEN.has(uebung(k)?.f) ? 'isolation' : 'compound'; };
  const r = merke('rpe', [trainings], () => rpeGenauigkeit(normiere(trainings), { liftVon: art }));
  const text = (a) => (Math.abs(a) <= 0.3 ? deEn('passt', 'accurate') : a > 0 ? deEn(`≈ ${fmt(a, 1)} zu niedrig`, `≈ ${fmt(a, 1)} too low`) : deEn(`≈ ${fmt(-a, 1)} zu hoch`, `≈ ${fmt(-a, 1)} too high`));
  const klasse = (a) => (Math.abs(a) <= 0.3 ? 'gut' : Math.abs(a) <= 0.8 ? 'mittel' : 'schlecht');
  // alle fünf Zeilen immer zeigen; ohne Ergebnis steht da, was fehlt
  const fehlt = (j) => (!j?.mitRpe ? deEn('keine RPE-Angaben', 'no RPE logged')
    : deEn('zu wenige Wochen mit leichten und schweren Sätzen', 'too few weeks with easy and hard sets'));
  const zeilen = [['squat', LIFT.squat.name], ['bench', LIFT.bench.name], ['dead', LIFT.dead.name], ['compound', deEn('Grundübungen', 'Compound')], ['isolation', deEn('Isolation', 'Isolation')]];
  return html`<section class="card pad stack">
    <div><span class="viz-t">${deEn('RPE-Genauigkeit', 'RPE accuracy')}</span><div class="viz-u">${deEn('Sätze mit RPE 6–8,5 im Vergleich zu harten Sätzen (RPE ≥ 9) derselben Übung; ≈ = ohne harte Sätze aus leichten und schweren Sätzen derselben Woche', 'Sets at RPE 6–8.5 compared with hard sets (RPE ≥ 9) of the same exercise; ≈ = without hard sets, from easy vs hard sets in the same week')}</div></div>
    ${r.gesamt ? html`<div class=${`rpe-gesamt ${klasse(r.gesamt.abweichung)}`}><b>${text(r.gesamt.abweichung)}</b><span>${deEn(`im Schnitt über ${r.gesamt.n} Sätze`, `on average over ${r.gesamt.n} sets`)}</span></div>` : null}
    <div class="rpe-zeilen">${zeilen.map(([l, n]) => { const j = r.je[l]; return html`<div key=${l} class="rpe-zeile"><span>${n}</span>
      ${j?.abweichung != null ? html`<b class=${klasse(j.abweichung)}>${text(j.abweichung)}</b><small class="muted" title=${j.methode === 'vergleich' ? deEn('aus dem Vergleich leichter und schwerer Sätze', 'from comparing easy and hard sets') : ''}>${`${j.n}×${j.methode === 'vergleich' ? ' ≈' : ''}`}</small>` : html`<small class="muted rpe-fehlt">${fehlt(j)}</small><small></small>`}</div>`; })}</div>
    ${r.gesamt ? html`<span class="muted" style="font-size:12.5px">${Math.abs(r.gesamt.abweichung) <= 0.3 ? deEn('Sehr gut – deine RPE-Angaben passen zu dem, was du wirklich hebst. RPE-basierte Pläne treffen damit die richtigen Gewichte.', 'Very good – your RPE ratings match what you actually lift. RPE-based plans hit the right weights.')
      : r.gesamt.abweichung > 0 ? deEn('Deine Sätze waren schwerer, als du angibst. Gib lieber ehrlich etwas höher an – sonst schlägt die App zu schwere Gewichte vor.', 'Your sets were harder than you rate them. Rate honestly a bit higher – otherwise the app suggests weights that are too heavy.')
      : deEn('Du hattest mehr im Tank, als du angibst. Trau dir mehr zu – oft geht noch 1 Wdh mehr, als es sich anfühlt.', 'You had more in the tank than you rate. Trust yourself more – often there is one more rep than it feels.')}</span>`
    : html`<span class="muted" style="font-size:12.5px">${deEn('Trag bei Arbeitssätzen die RPE ein und ab und zu einen harten Satz (Top-Satz, AMRAP, Test) – dann füllt sich die Karte.', 'Log RPE on working sets and now and then a hard set (top set, AMRAP, test) – then this card fills up.')}</span>`}
  </section>`;
}
