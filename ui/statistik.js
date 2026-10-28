// PR Hunter · Statistik. Ein Zeitraumfilter oben gilt für alles darunter (Belastung: höchstens 26 Wochen).
// Gerechnet wird mit den getesteten Funktionen aus js/auswertung.js; Daten aus ui/stand.js (echt oder Demo).
import { html, useState, fmt, gw, gwE, einheit, inAnzeige, LIFT, liftName, deEn, I, datumKurz, uebung, MUSKEL_DE, speicher, nameVon } from './basis.js';
import { e1rm } from '../js/rechnen.js';
import { dots, ipfGl } from '../js/punkte.js';
import { kraftprofil, inol, harteSaetzeJeMuskel, fosterWoche, sessionLast, plateau, INOL_RICHTWERT, gewichtImZeitraum, ANTEIL_GESCHAETZT,
  erholung, muskelGewichte, ERHOLUNG, rekordChronik } from '../js/auswertung.js';
import { SYMMETRIC_RECHNER } from '../js/verweise.js';
import { LinienChart, StapelSaeulen, Heatmap, Sparkline, ZonenBalken, Rangliste } from './diagramme.js';
import { KoerperKarte, ErholungKarte } from './koerper.js';
import { Zielprognose, Vergleich } from './vergleich.js';
import { wochen, e1rmWoche, volumenWoche, trainingsTage, trainingAm, REKORDE, PR_FEED, URLAUB, HEUTE, DEMO, KOERPERVERLAUF, plusTage, imUrlaub, E1RM_AKTUELL, ZULETZT } from './stand.js';
import { uebersetze } from './sprache.js';
import { koerperAm, montagVon, tageZwischen, kanon } from '../js/daten.js';
import { rpeTrend } from '../js/block.js';

const LIFTS = ['squat', 'bench', 'dead'];
const BEREICHE = [['4 Wo.', 4], ['3 Mon.', 13], ['6 Mon.', 26], ['1 Jahr', 52], ['Alles', 0]];   // kurz: alle Filter in eine Reihe
const FORM_WOCHEN = 12;


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
const STAT_REITER = [['kraft', 'Kraft'], ['profil', 'Profil'], ['belastung', 'Belastung'], ['training', 'Training'], ['koerper', 'Körper']];

export function Statistik({ einst, setEinst = null, blockStart = null, trainings = [] }) {
  const [reiter, setReiter] = useState(() => speicher.lies('prh-stat-reiter') ?? 'kraft');
  const waehleReiter = (k) => { setReiter(k); speicher.schreib('prh-stat-reiter', k); scrollTo({ top: 0 }); };
  const [bereich, setBereich] = useState(52);
  const [rekLift, setRekLift] = useState('squat');
  // Zeitraum in Wochen: 0 = alles, -1 = seit Beginn des aktiven Blocks
  const blockWochen = blockStart && blockStart <= HEUTE ? Math.floor(tageZwischen(montagVon(blockStart), montagVon(HEUTE)) / 7) + 1 : null;
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
  const erholt = erholung(erholEintraege, jetztMs);
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
  const hinweise = [];
  const plateaus = LIFTS.map((l) => [l, plateau(e1rmWoche[l].slice(-n))]).filter(([, p]) => p.plateau);
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
    hinweise.push({ t: deEn(`Schwächster Lift im Verhältnis: ${liftName(l)}`, `Weakest lift relatively: ${liftName(l)}`),
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
      <nav class="reiter" role="tablist" aria-label="Bereich">${STAT_REITER.map(([k, t]) => html`<button key=${k} role="tab" aria-selected=${String(reiter === k)} onClick=${() => waehleReiter(k)}>${t}</button>`)}</nav></header>
    ${reiter === 'profil' ? null : html`<div class="filter einreihig" role="group" aria-label="Zeitraum">${bereiche.map(([t, w]) => html`<button key=${t} class="chip" aria-pressed=${String(bereich === w)} onClick=${() => setBereich(w)}>${t}</button>`)}</div>`}

    <div class="reiter-inhalt statistik-inhalt" key=${reiter}>
    ${reiter === 'kraft' ? html`
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
    ${hinweise.length ? html`<section class="stack" style="gap:8px">${hinweise.map((h) => html`<div key=${h.t} class="hint">${I.warn}<span class="t">${h.t}</span><span></span><p>${h.text}</p></div>`)}</section>` : null}
    <${LinienChart} titel="e1RM-Verlauf" unter="Bester Satz je Woche" x=${x} serien=${serien} einheit=${einheit()}/>
    ${hat(totalReihe) ? html`<${LinienChart} titel="Total" unter="Summe der besten e1RM der jeweils letzten 12 Wochen" x=${x} serien=${[{ id: 'total', name: 'Total', farbe: 'var(--ink)', werte: ab(totalReihe).map(inAnzeige) }]} einheit=${einheit()} hoehe=${180}/>` : null}
    ${hat(dotsReihe) ? html`<${LinienChart} titel="Punkte" unter="DOTS und IPF GL aus Total und Körpergewicht (zeitlich nächster Messwert)" x=${x}
      serien=${[{ id: 'dots', name: 'DOTS', farbe: 'var(--lift-bench)', werte: ab(dotsReihe) }, { id: 'gl', name: 'IPF GL', farbe: 'var(--lift-squat)', werte: ab(glReihe) }]} einheit="" hoehe=${180}/>` : null}
    ${hat(relativ) ? html`<${LinienChart} titel="Relative Stärke" unter="Total ÷ Körpergewicht" x=${x} serien=${[{ id: 'rel', name: 'Total ÷ KG', farbe: 'var(--lift-dead)', werte: ab(relativ) }]} einheit="×" stellen=${2} hoehe=${170}/>` : null}
    <${Zielprognose} aktuell=${aktuell} ziele=${einst.ziele ?? {}} setZiel=${setEinst ? (key, kg) => setEinst({ ...einst, ziele: { ...(einst.ziele ?? {}), [key]: kg } }) : null}/>
    <section class="card pad stack">
      <div class="row between"><span class="viz-t">Neue Rekorde</span><span class="muted" style="font-size:12.5px">e1RM</span></div>
      ${!PR_FEED.length ? html`<p class="muted" style="margin:0;font-size:14px">Noch keine Rekorde in Kniebeuge, Bankdrücken oder Kreuzheben.</p>` : null}
      ${PR_FEED.map((p) => html`<div key=${p.datum + p.lift} class="row">
        <span class="medaille">PR</span>
        <div style="flex:1;min-width:0"><b>${LIFT[p.lift].name} · ${p.satz ? `${gwE(p.satz.kg)} × ${p.satz.wdh}` : p.text}</b><div class="muted" style="font-size:12.5px">${datumKurz(p.datum)}</div></div>
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
        <tbody>${REKORDE[rekLift].map((r, i) => r ? html`<tr key=${i}><td>${i + 1}</td><td class="k">${gwE(r[0])}</td><td class="muted">${datumKurz(r[1])}</td><td>${gw(e1rm(r[0], i + 1), 1)}</td></tr>`
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
        <div class="viz-u"><span>Nach der veröffentlichten Methode von Symmetric Strength</span> · ${`${gwE(kg)} Körpergewicht`}</div></div>
        <div class="dots-wert"><div class="eyebrow">Gesamt</div><b>${fmt(profil.gesamt, 1)}</b></div></div>
      <${KoerperKarte} muskeln=${profil.muskeln} quellen=${profil.quellen}/>
      <div class="stack" style="gap:10px">${LIFTS.map((l) => profil.lifts[l] && html`<div key=${l} class="stufe-zeile">
        <span class="row" style="gap:6px"><i class="dot" style=${`background:${LIFT[l].farbe}`}></i><b>${LIFT[l].name}</b></span>
        <span class="stufe-spur"><i style=${`width:${Math.min(100, (profil.lifts[l].wert / 125) * 100)}%`}></i></span>
        <span class="stufe-text"><b>${fmt(profil.lifts[l].wert, 1)}</b> ${profil.lifts[l].stufe}</span>
        <span class="muted stufe-naechste"><b class=${profil.lifts[l].wert >= profil.gesamt ? 'pz-auf' : 'pz-ab'}>${`${profil.lifts[l].wert >= profil.gesamt ? '+' : '−'}${fmt(Math.abs((profil.lifts[l].wert / profil.gesamt - 1) * 100), 0)} % zum Schnitt`}</b>
          ${' · '}<span>${profil.lifts[l].naechste ? `noch ${gwE(profil.lifts[l].naechste.fehlenKg, 1)} e1RM bis „${profil.lifts[l].naechste.name}“` : 'höchste Stufe'}</span></span>
      </div>`)}</div>
      ${profil.uebungen.length ? html`<div class="stack unterteil" style="gap:10px"><span class="eyebrow">Weitere Übungen · Näherung</span>
        ${profil.uebungen.slice(0, 10).map((u) => html`<div key=${u.key} class="stufe-zeile">
          <span class="rl-name">${u.name}</span>
          <span class="stufe-spur geschaetzt"><i style=${`width:${Math.min(100, Math.max(0, (u.wert / 125) * 100))}%`}></i></span>
          <span class="stufe-text"><b>${fmt(u.wert, 1)}</b> ${u.stufe}</span>
          <span class="muted stufe-naechste">${`e1RM ${gwE(u.e1rm, 1)}`}${u.begrenzt ? html`<span title="Wert auf ±20 um den Schnitt der drei Lifts begrenzt">${' · '}<span>begrenzt</span></span>` : null}</span></div>`)}</div>` : null}
      <details class="ab-sollist"><summary><span>So wird gerechnet</span><span class="woche-pfeil" aria-hidden="true">${I.weiter}</span></summary>
      <p class="muted" style="margin:0;font-size:12.5px">Kniebeuge, Bankdrücken und Kreuzheben nach der Methode von Symmetric Strength. Weitere Übungen (Klimmzug, Rudern, Schulterdrücken, Waden, Arme …) sind eine eigene Näherung: Jede Übung wird über ihr typisches Verhältnis zum Kreuzheben bei gleicher Stärke umgerechnet, zählt halb so viel und liegt höchstens 20 Punkte über oder unter dem Schnitt deiner drei Lifts („begrenzt“: Maschinen zeigen je Gerät andere Gewichte, viele Wdh ergeben ein zu hohes e1RM). Bauch kommt aus Kniebeuge und Kreuzheben. Genau prüfen: bei Symmetric Strength.</p>
      <p class="muted" style="margin:0;font-size:12.5px">Punkte: Wert je Lift nach Symmetric Strength, Körpergewicht eingerechnet (100 = „Herausragend“). „% zum Schnitt“ zeigt, welcher Lift stärker oder schwächer ist als deine drei im Mittel. Die Stufen sind die von Symmetric Strength in eigener Übersetzung – Strength Level zählt anders (z. B. „Advanced“ dort ≠ „Stark“ hier).</p></details>
      <div class="row wrap"><a class="btn btn-soft btn-sm" href=${SYMMETRIC_RECHNER} target="_blank" rel="noopener">Symmetric Strength ${I.extern}</a>
        <a class="btn btn-soft btn-sm" href="https://strengthlevel.com/strength-standards" target="_blank" rel="noopener">Strength Level ${I.extern}</a></div>
    </section>
    <${Vergleich} freigegeben=${!!einst.vergleich}/>`
    : reiter === 'belastung' ? html`
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
    <${StapelSaeulen} titel="Volumen" unter=${gruppe > 1 ? 'Bewegte kg je 4 Wochen' : 'Bewegte kg je Woche'} daten=${saeulen} serien=${volSerien}/>
    ${mitDauer.length ? html`<section class="kacheln">
      <div class="kachel"><span class="l">Trainingszeit</span><b>${fmt(zeitGesamt / 60, 1)}</b><span class="muted" style="font-size:12px">Stunden im Zeitraum</span></div>
      <div class="kachel"><span class="l">Ø je Einheit</span><b>${fmt(zeitGesamt / mitDauer.length, 0)}</b><span class="muted" style="font-size:12px">Minuten</span></div>
      <div class="kachel"><span class="l">Längste</span><b>${fmt(Math.max(...mitDauer.map((t) => t.dauer)), 0)}</b><span class="muted" style="font-size:12px">Minuten</span></div>
    </section>
    <${StapelSaeulen} titel="Trainingszeit" unter=${`Ø Minuten je Trainingstag, gruppiert je ${gruppe > 1 ? `${gruppe} Wochen` : 'Woche'} · ${mitDauer.length} Einheiten mit Dauer`} daten=${zeitSaeulen}
      serien=${[{ id: 'min', name: 'Minuten', farbe: 'var(--acc)' }]} einheit="min"/>` : null}
    <${Heatmap} titel="Trainingskalender" unter="Jeder Tag eine Kachel, kräftiger = mehr bewegt" von=${von} wochenAnzahl=${n} tage=${trainingsTage}
      markiere=${imUrlaub}/>`
    : html`
    ${hat(gemessen) ? html`<${KoerperStatistik} x=${x} werte=${ab(gemessen)} von=${x[0]} ziel=${einst.gewichtZiel}/>` : null}
      ${!hat(gemessen) ? html`<section class="card pad"><p class="muted" style="margin:0">Noch kein Körpergewicht im Zeitraum – auf „Heute“ mit −/+ eintragen.</p></section>` : null}`}
    </div>
  </div>`;
}

/** Körpergewicht im Zeitraum: Kacheln (aktuell, Veränderung, Trend je Woche, Spanne) und Verlauf mit Ziellinie. */
function KoerperStatistik({ x, werte, von, ziel }) {
  const g = gewichtImZeitraum(KOERPERVERLAUF, von);
  const [exakt, setExakt] = useState(false);              // jede Messung statt Wochendurchschnitt
  const mess = KOERPERVERLAUF.filter((m) => m.datum >= von);
  const vz = (d, st = 1) => (d == null ? '–' : `${d > 0 ? '+' : d < 0 ? '−' : '±'}${gw(Math.abs(d), st)}`);
  return html`<section class="stack" style="gap:8px">
    ${g ? html`<div class="kacheln vier">
      <div class="kachel"><span class="l">Aktuell</span><b>${gw(g.aktuell, 1)}</b><span class="muted" style="font-size:12px">${einheit()}${ziel ? ` · Ziel ${gw(ziel, 1)}` : ''}</span></div>
      <div class="kachel"><span class="l">Im Zeitraum</span><b>${vz(g.veraenderung)}</b><span class="muted" style="font-size:12px">${deEn("seit", "since")} ${datumKurz(g.seit)}</span></div>
      <div class="kachel"><span class="l">Trend</span><b>${vz(g.proWoche, 2)}</b><span class="muted" style="font-size:12px">${einheit()} je Woche</span></div>
      <div class="kachel"><span class="l">Spanne</span><b>${gw(g.max - g.min, 1)}</b><span class="muted" style="font-size:12px">${gw(g.min, 1)}–${gw(g.max, 1)}</span></div>
    </div>` : null}
    <div class="filter einreihig" role="group" aria-label="Darstellung"><button class="chip" aria-pressed=${String(!exakt)} onClick=${() => setExakt(false)}>Wochendurchschnitt</button>
      <button class="chip" aria-pressed=${String(exakt)} onClick=${() => setExakt(true)}>Jede Messung</button></div>
    <${LinienChart} titel="Körpergewicht" unter=${exakt ? `${mess.length} Messungen im Zeitraum` : `Durchschnitt je Woche · ${g?.anzahl ?? 0} Messungen im Zeitraum`} x=${exakt ? mess.map((m) => m.datum) : x}
      serien=${[{ id: 'kg', name: 'Körpergewicht', farbe: 'var(--acc)', werte: (exakt ? mess.map((m) => m.kg) : werte).map(inAnzeige) }]} einheit=${einheit()} hoehe=${180}
      referenz=${ziel ? { wert: inAnzeige(ziel), text: `Ziel ${gw(ziel, 1)}` } : null}/>
  </section>`;
}
