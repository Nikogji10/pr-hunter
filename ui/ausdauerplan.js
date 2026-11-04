// PR Hunter · Ausdauer-Pläne (Wunsch 235/236): Assistent (Ziel, Wochen, Tage, Form), Plan-Karte unter Programme,
// Einheit mit Schritten (Tempo-/Wattbereiche), „Heute geplant“ auf der Ausdauer-Kachel. Erledigt = Einheit gleicher
// Sportart am selben Tag (eingetragen, Datei oder intervals.icu/Strava).
import { html, useState, Sheet, Portal, deEn, sprache, datumKurz, datumLang, fmt, nameVon, UebungsBild } from './basis.js';
import { HEUTE } from './stand.js';
import { ZIELE, erzeugePlan, naechsterMontag, wochentag, erledigt, paceZonen, wattZonen, KRAFT_ERGAENZUNG } from '../js/ausdauerplan.js';
import { bestzeiten, prognosen, ftpSchaetzung, sichtbar, sportarten, sportVon, dauerText, wochen as wochenSummen, montag } from '../js/ausdauer.js';

const WT = [['Mo', 'Mon'], ['Di', 'Tue'], ['Mi', 'Wed'], ['Do', 'Thu'], ['Fr', 'Fri'], ['Sa', 'Sat'], ['So', 'Sun']];
const L = (de, en) => deEn(de, en);
const pace = (b) => `${dauerText(b[0])}–${dauerText(b[1])} /km`;
const watt = (b) => `${b[0]}–${b[1]} W`;
const TYPNAME = { locker: ['Locker', 'Easy'], lang: ['Lang', 'Long'], tempo: ['Tempo', 'Tempo'], intervalle: ['Intervalle', 'Intervals'], wettkampf: ['Wettkampf', 'Race'] };
const ZONENNAME = { locker: ['locker', 'easy'], lang: ['lange Läufe', 'long runs'], steigerung: ['Steigerungen', 'strides'], marathon: ['Marathontempo', 'marathon pace'], tempo: ['Schwelle', 'threshold'], intervall: ['5-km-Tempo', '5K pace'], sweetspot: ['Sweet Spot', 'sweet spot'], schwelle: ['Schwelle', 'threshold'], vo2: ['VO2max', 'VO2max'] };

/** Text einer geplanten Einheit: Titel, Kurzzeile, Schritte. */
export function beschreibung(e, plan) {
  const z = plan.zonen?.[e.zone], ziel = z ? (e.sport === 'lauf' ? pace(z) : watt(z)) : '';
  const zn = ZONENNAME[e.zone] ? L(...ZONENNAME[e.zone]) : '';
  const titel = L(...(TYPNAME[e.typ] ?? ['Einheit', 'Session']));
  if (e.sport === 'rad') {
    if (e.wdh) return { titel, zeile: `${e.wdh} × ${e.dauer} min ${zn}${ziel ? ` · ${ziel}` : ''}`,
      schritte: [L('15 min locker einfahren', '15 min easy warm-up'), L(`${e.wdh} × ${e.dauer} min ${zn}${ziel ? ` (${ziel})` : ''}, dazwischen ${e.pause} min locker`, `${e.wdh} × ${e.dauer} min ${zn}${ziel ? ` (${ziel})` : ''}, ${e.pause} min easy between`), L('10 min ausfahren', '10 min cool-down')] };
    return { titel, zeile: `${dauerText(e.min * 60)} h ${zn}${ziel ? ` · ${ziel}` : ''}`.replace(':00 h', ' h'), schritte: [L(`${e.min} min gleichmäßig ${zn}${ziel ? ` (${ziel})` : ''} – unterhalten muss gehen`, `${e.min} min steady ${zn}${ziel ? ` (${ziel})` : ''} – you should be able to talk`)] };
  }
  if (e.typ === 'wettkampf') return { titel, zeile: `${fmt(e.km, 1)} km`, schritte: [L('10–15 min einlaufen mit 3–4 Steigerungen', '10–15 min warm-up with 3–4 strides'), L(`${fmt(e.km, 1)} km – Viel Erfolg!`, `${fmt(e.km, 1)} km – good luck!`)] };
  if (e.wdh) {
    const st = e.strecke >= 1000 ? `${fmt(e.strecke / 1000, 1)} km` : `${e.strecke} m`;
    return { titel, zeile: `${e.wdh} × ${st} ${zn}${ziel ? ` · ${ziel}` : ''}`,
      schritte: [L('2 km locker einlaufen, 3 Steigerungen', '2 km easy warm-up, 3 strides'), L(`${e.wdh} × ${st} in ${ziel || zn}, dazwischen ${Math.round(e.pause / 60 * 10) / 10} min Trabpause`, `${e.wdh} × ${st} at ${ziel || zn}, ${Math.round(e.pause / 60 * 10) / 10} min jog between`), L('1–2 km auslaufen', '1–2 km cool-down')] };
  }
  if (e.typ === 'tempo') return { titel, zeile: `${fmt(e.km, 1)} km ${zn}${ziel ? ` · ${ziel}` : ''}`,
    schritte: [L('2 km locker einlaufen', '2 km easy warm-up'), L(`${fmt(e.km, 1)} km am Stück in ${ziel || zn}`, `${fmt(e.km, 1)} km continuous at ${ziel || zn}`), L('1–2 km auslaufen', '1–2 km cool-down')] };
  return { titel, zeile: `${fmt(e.km, 1)} km${ziel ? ` · ${ziel}` : ''}`, schritte: [e.typ === 'lang' ? L(`${fmt(e.km, 1)} km ruhig (${ziel}) – lieber zu langsam als zu schnell`, `${fmt(e.km, 1)} km relaxed (${ziel}) – better too slow than too fast`)
    : L(`${fmt(e.km, 1)} km locker (${ziel}) – Unterhaltungstempo`, `${fmt(e.km, 1)} km easy (${ziel}) – conversational pace`)] };
}

/** Assistent: Sportart, Ziel, Wochen, Wochentage, Form → Vorschau → Start. */
export function PlanAssistent({ wahl, liste, einst, beinTag, starten, zu }) {
  const sports = sportarten(wahl);
  const [sport, setSport] = useState(sports[0] ?? 'lauf');
  const [ziel, setZiel] = useState(sport === 'lauf' ? '10k' : 'ftp');
  const [wochen, setWochen] = useState(8);
  const [tage, setTage] = useState([1, 3, 6]);
  const best = bestzeiten(liste), prog = prognosen(best).find((p) => p.m === 5000);
  const vorschlag5k = prog?.s ?? 1680;
  const [t5k, setT5k] = useState([Math.floor(vorschlag5k / 60), vorschlag5k % 60]);
  const ftpVorschlag = einst.ftp ?? ftpSchaetzung(liste, HEUTE)?.ftp ?? 200;
  const [ftp, setFtp] = useState(String(ftpVorschlag));
  const start = naechsterMontag(HEUTE);
  const startKm = (() => { const w = wochenSummen(liste, { von: montag(new Date(Date.parse(`${HEUTE}T00:00:00Z`) - 28 * 864e5).toISOString().slice(0, 10)), bis: HEUTE }).slice(-4); return w.length ? w.reduce((s, x) => s + x.lauf.km, 0) / w.length : null; })();
  const plan = erzeugePlan({ sport, ziel, start, wochen, tage, t5k: t5k[0] * 60 + (Number(t5k[1]) || 0), ftp: Number(ftp) || null, startKm, beinTag });
  const kmWoche = (w) => plan.einheiten.filter((e) => e.woche === w).reduce((s, e) => s + (e.gesamtKm ?? e.km ?? 0), 0);
  const zeitWoche = (w) => plan.einheiten.filter((e) => e.woche === w).reduce((s, e) => s + (e.min ?? (e.wdh ? e.wdh * (e.dauer + e.pause) + 25 : 0)), 0);
  const tag = (d) => setTage((t) => (t.includes(d) ? t.filter((x) => x !== d) : [...t, d].sort()));
  // Schritt für Schritt: eine Frage je Bildschirm
  const [schritt, setSchritt] = useState(0);
  const SCHRITTE = [L('Ziel', 'Goal'), L('Dauer', 'Length'), L('Tage', 'Days'), L('Form', 'Form'), L('Plan', 'Plan')];
  const kannWeiter = schritt !== 2 || tage.length > 0;
  const inhalt = [
    html`<div class="stack" style="gap:10px"><b class="ap-frage">${L('Was ist dein Ziel?', 'What is your goal?')}</b>
      ${sports.length > 1 ? html`<div class="seg">${sports.map((s) => html`<button key=${s} aria-pressed=${String(sport === s)} onClick=${() => { setSport(s); setZiel(s === 'lauf' ? '10k' : 'ftp'); }}>${s === 'lauf' ? L('🏃 Laufen', '🏃 Running') : L('🚴 Rad', '🚴 Cycling')}</button>`)}</div>` : null}
      <div class="ap-wahl">${ZIELE[sport].map(([id, de, en]) => html`<button key=${id} aria-pressed=${String(ziel === id)} onClick=${() => setZiel(id)}>${L(de, en)}</button>`)}</div></div>`,
    html`<div class="stack" style="gap:10px"><b class="ap-frage">${L('Wie viele Wochen?', 'How many weeks?')}</b>
      <div class="ap-wahl">${[6, 8, 10, 12, 16].map((w) => html`<button key=${w} aria-pressed=${String(wochen === w)} onClick=${() => setWochen(w)}>${L(`${w} Wochen`, `${w} weeks`)}</button>`)}</div>
      <span class="muted" style="font-size:12.5px">${L('Für 5 km reichen 6–8 Wochen, für einen Halbmarathon eher 10–12, für einen Marathon 16.', 'For 5K 6–8 weeks are enough, a half marathon rather 10–12, a marathon 16.')}</span></div>`,
    html`<div class="stack" style="gap:10px"><b class="ap-frage">${L('An welchen Tagen?', 'On which days?')}</b>
      <div class="ap-tage">${WT.map(([de, en], i) => html`<button key=${i} aria-pressed=${String(tage.includes(i))} onClick=${() => tag(i)}>${L(de, en)}</button>`)}</div>
      <span class="muted" style="font-size:12.5px">${L(`${tage.length} pro Woche. Der letzte Tag wird die lange Einheit.`, `${tage.length} per week. The last day becomes the long session.`)}${beinTag ? L(' Harte Einheiten kommen nicht vor deine Beintage im Kraftplan.', ' Hard sessions stay away from the day before your leg days.') : ''}</span></div>`,
    sport === 'lauf' ? html`<div class="stack" style="gap:10px"><b class="ap-frage">${L('Wie schnell läufst du 5 km?', 'How fast do you run 5K?')}</b>
      <div class="au-hms" style="grid-template-columns:1fr 1fr">${[0, 1].map((i) => html`<label key=${i}><input class="text" inputmode="numeric" value=${t5k[i]} onInput=${(e) => { const v = e.currentTarget.value.replace(/\D/g, '').slice(0, 2); setT5k((a) => a.map((x, k) => (k === i ? v : x))); }}/><small>${i ? L('Sek', 's') : 'Min'}</small></label>`)}</div>
      <span class="muted" style="font-size:12.5px">${prog ? L(`Vorschlag aus deinen Bestzeiten (${prog.aus}). Daraus rechnet die App deine Tempobereiche.`, `Suggested from your best times (${prog.aus}). Your pace zones come from it.`) : L('Ungefähr reicht – daraus rechnet die App deine Tempobereiche.', 'A rough value is fine – your pace zones come from it.')}</span></div>`
    : html`<div class="stack" style="gap:10px"><b class="ap-frage">${L('Wie hoch ist deine FTP?', 'What is your FTP?')}</b>
      <label class="field"><span class="label">FTP (W)</span><input class="text" inputmode="numeric" value=${ftp} onInput=${(e) => setFtp(e.currentTarget.value.replace(/\D/g, ''))}/></label>
      <span class="muted" style="font-size:12.5px">${L('Leistung, die du etwa eine Stunde halten kannst. Daraus rechnet die App deine Wattbereiche.', 'Power you can hold for about an hour. Your power zones come from it.')}</span></div>`,
    html`<div class="ap-vorschau">
      <b>${sport === 'lauf' ? L(`${wochen} Wochen · ${tage.length} Läufe/Woche · ${fmt(kmWoche(1), 0)} → ${fmt(Math.max(...Array.from({ length: wochen }, (_, i) => kmWoche(i + 1))), 0)} km/Woche`, `${wochen} weeks · ${tage.length} runs/week · ${fmt(kmWoche(1), 0)} → ${fmt(Math.max(...Array.from({ length: wochen }, (_, i) => kmWoche(i + 1))), 0)} km/week`)
        : L(`${wochen} Wochen · ${tage.length} Fahrten/Woche · ${dauerText(zeitWoche(1) * 60)} h → ${dauerText(Math.max(...Array.from({ length: wochen }, (_, i) => zeitWoche(i + 1))) * 60)} h`, `${wochen} weeks · ${tage.length} rides/week`)}</b>
      <span class="muted" style="font-size:12.5px">${L(`Start ${datumKurz(start)} · Woche 1:`, `Start ${datumKurz(start)} · week 1:`)}</span>
      ${plan.einheiten.filter((e) => e.woche === 1).map((e) => { const b = beschreibung(e, plan); return html`<div key=${e.id} class="ap-zeile"><span>${L(...WT[wochentag(e.datum)])}</span><b>${b.titel}</b><small>${b.zeile}</small></div>`; })}
    </div>`,
  ];
  return html`<${Sheet} zu=${zu} label=${L('Ausdauer-Plan erstellen', 'Create cardio plan')}>
    <div class="sheet-kopf"><h2 class="h2">${L('Ausdauer-Plan', 'Cardio plan')}</h2>
      <div class="ap-schritte">${SCHRITTE.map((s, i) => html`<i key=${i} class=${i < schritt ? 'fertig' : i === schritt ? 'jetzt' : ''} title=${s}></i>`)}</div></div>
    <span class="eyebrow">${L(`Schritt ${schritt + 1} von ${SCHRITTE.length} · ${SCHRITTE[schritt]}`, `Step ${schritt + 1} of ${SCHRITTE.length} · ${SCHRITTE[schritt]}`)}</span>
    ${inhalt[schritt]}
    <div class="row" style="gap:8px">
      ${schritt > 0 ? html`<button class="btn btn-soft" onClick=${() => setSchritt(schritt - 1)}>${L('Zurück', 'Back')}</button>` : null}
      ${schritt < SCHRITTE.length - 1 ? html`<button class="btn btn-chalk" style="flex:1" disabled=${!kannWeiter} onClick=${() => setSchritt(schritt + 1)}>${L('Weiter', 'Next')}</button>`
        : html`<button class="btn btn-chalk" style="flex:1" onClick=${() => { starten(plan); zu(); }}>${L('Plan starten', 'Start plan')}</button>`}</div>
  <//>`;
}

/** Eine geplante Einheit mit Schritten. */
export function EinheitSheet({ e, plan, fertig, eintragen, zu }) {
  const b = beschreibung(e, plan);
  return html`<${Sheet} zu=${zu} label=${b.titel}>
    <div class="sheet-kopf"><h2 class="h2">${e.sport === 'lauf' ? '🏃' : '🚴'} ${b.titel}</h2><small class="muted">${`${datumLang(e.datum)} · ${L('Woche', 'Week')} ${e.woche}/${plan.wochen}`}</small></div>
    <div class="ap-zeile gross"><b>${b.zeile}</b></div>
    <ol class="iv-schritte">${b.schritte.map((s, i) => html`<li key=${i}>${s}</li>`)}</ol>
    ${plan.zonen ? html`<details class="au-bereich"><summary>${L('Deine Bereiche', 'Your zones')}</summary><div class="au-tabelle">
      ${Object.entries(plan.zonen).map(([k, v]) => html`<div key=${k} class="au-zeile zwei"><span>${L(...(ZONENNAME[k] ?? [k, k]))}</span><b>${e.sport === 'lauf' ? pace(v) : watt(v)}</b></div>`)}</div></details>` : null}
    ${fertig ? html`<div class="ap-fertig">✓ ${L('Erledigt', 'Done')}</div>` : html`<button class="btn btn-chalk btn-block" onClick=${() => { eintragen(e); zu(); }}>${L('Als erledigt eintragen', 'Log as done')}</button>`}
  <//>`;
}

/** Programme → Ausdauer-Plan: erstellen bzw. aktuellen Plan mit Woche, nächsten Einheiten, allen Wochen. */
/** 238: Kraft-Ergänzung für Läufer/Radfahrer – Antippen öffnet die Übungsseite. */
function KraftErgaenzung({ sport, zuUebung }) {
  return html`<details class="au-bereich"><summary>${sport === 'lauf' ? L('💪 Kraft für Läufer · 2× pro Woche', '💪 Strength for runners · 2× per week') : L('💪 Kraft für Radfahrer · 2× pro Woche', '💪 Strength for cyclists · 2× per week')}</summary>
    <div class="stack" style="gap:6px;padding-bottom:10px">
      <span class="muted" style="font-size:12.5px">${L('Etwa 15 Minuten, gern nach einer lockeren Einheit oder am Ende des Krafttrainings. Beugt den typischen Überlastungen vor.', 'About 15 minutes, e.g. after an easy session or at the end of strength training. Prevents the typical overuse problems.')}</span>
      ${KRAFT_ERGAENZUNG[sport].map(([k, s, de, en]) => html`<button key=${k} class="ap-uebung" onClick=${() => zuUebung?.(k)}>
        <${UebungsBild} schluessel=${k} groesse=${40}/><span><b>${nameVon(k, k)}</b><small>${`${s} · ${L(de, en)}`}</small></span><span class="muted">›</span></button>`)}
    </div></details>`;
}

export function AusdauerPlanKarte({ einst, setEinst, liste, beinTag, eintragen, zuUebung = null }) {
  const [assistent, setAssistent] = useState(false), [einheit, setEinheit] = useState(null), [alle, setAlle] = useState(false), [beenden, setBeenden] = useState(false);
  const plan = einst.ausdauerPlan, l = sichtbar(liste, einst.ausdauer);
  const ist = (e) => erledigt(e, l, sportVon);
  const starten = (p) => setEinst({ ...einst, ausdauerPlan: p });
  const fenster = html`${assistent ? html`<${Portal}><${PlanAssistent} wahl=${einst.ausdauer} liste=${l} einst=${einst} beinTag=${beinTag} starten=${starten} zu=${() => setAssistent(false)}/><//>` : null}
    ${einheit ? html`<${Portal}><${EinheitSheet} e=${einheit} plan=${plan} fertig=${ist(einheit)} eintragen=${eintragen} zu=${() => setEinheit(null)}/><//>` : null}`;
  if (!plan) return html`<section class="card pad stack ap-karte">
    <div><span class="viz-t">${L('Ausdauer-Plan', 'Cardio plan')}</span><div class="viz-u">${L('Ziel wählen – die App plant Läufe bzw. Fahrten mit Tempo- oder Wattvorgaben aus deiner Form, passend zum Kraftplan.', 'Pick a goal – the app plans runs or rides with pace or power targets from your form, fitting your strength plan.')}</div></div>
    <button class="btn btn-chalk btn-block" onClick=${() => setAssistent(true)}>${L('+ Ausdauer-Plan erstellen', '+ Create cardio plan')}</button>
    ${sportarten(einst.ausdauer).map((s) => html`<${KraftErgaenzung} key=${s} sport=${s} zuUebung=${zuUebung}/>`)}${fenster}</section>`;
  const zielName = L(...(ZIELE[plan.sport].find(([id]) => id === plan.ziel) ?? ['', '', '']).slice(1, 3));
  const woche = Math.min(plan.wochen, Math.max(1, Math.floor((Date.parse(`${HEUTE}T00:00:00Z`) - Date.parse(`${plan.start}T00:00:00Z`)) / (7 * 864e5)) + 1));
  const kommend = plan.einheiten.filter((e) => e.datum >= HEUTE).slice(0, 3), geschafft = plan.einheiten.filter((e) => e.datum < HEUTE && ist(e)).length, faellig = plan.einheiten.filter((e) => e.datum < HEUTE).length;
  const zeile = (e) => { const b = beschreibung(e, plan); return html`<button key=${e.id} class="ap-zeile knopf ${ist(e) ? 'fertig' : ''}" onClick=${() => setEinheit(e)}>
    <span>${e.datum === HEUTE ? L('Heute', 'Today') : `${L(...WT[wochentag(e.datum)])} ${datumKurz(e.datum)}`}</span><b>${ist(e) ? '✓ ' : ''}${b.titel}</b><small>${b.zeile}</small></button>`; };
  return html`<section class="card pad stack ap-karte">
    <div class="row between"><div><span class="viz-t">${`${plan.sport === 'lauf' ? '🏃' : '🚴'} ${zielName}`}</span><div class="viz-u">${L(`Woche ${woche}/${plan.wochen} · ${geschafft}/${faellig} erledigt`, `Week ${woche}/${plan.wochen} · ${geschafft}/${faellig} done`)}</div></div></div>
    <div class="ap-balken"><i style=${`width:${Math.round((woche / plan.wochen) * 100)}%`}></i></div>
    ${kommend.map(zeile)}
    ${alle ? html`<div class="stack" style="gap:4px">${Array.from({ length: plan.wochen }, (_, w) => html`<div key=${w} class="stack" style="gap:2px"><span class="eyebrow">${L(`Woche ${w + 1}`, `Week ${w + 1}`)}</span>${plan.einheiten.filter((e) => e.woche === w + 1).map(zeile)}</div>`)}</div>` : null}
    <div class="row" style="gap:8px"><button class="btn btn-soft" style="flex:1" onClick=${() => setAlle(!alle)}>${alle ? L('Weniger', 'Less') : L('Ganzer Plan', 'Full plan')}</button>
      <button class="btn btn-soft" onClick=${() => setBeenden(!beenden)}>${L('Beenden', 'End')}</button></div>
    <${KraftErgaenzung} sport=${plan.sport} zuUebung=${zuUebung}/>
    ${beenden ? html`<div class="strava-trennen"><span>${L('Plan beenden? Erledigte Einheiten bleiben im Verlauf.', 'End plan? Completed sessions stay in History.')}</span>
      <button class="btn btn-gefahr btn-sm" onClick=${() => setEinst({ ...einst, ausdauerPlan: null })}>${L('Plan beenden', 'End plan')}</button></div>` : null}
    ${fenster}</section>`;
}

/** Für die Ausdauer-Kachel auf „Heute“: heutige bzw. nächste geplante Einheit. */
export function naechsteGeplante(plan) {
  if (!plan) return null;
  return plan.einheiten.find((e) => e.datum >= HEUTE) ?? null;
}
export { paceZonen, wattZonen };
