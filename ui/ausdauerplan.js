// PR Hunter · Ausdauer-Pläne (Wunsch 235/236, 239–247): Plan-Karte unter Programme → Cardio, Wochenübersicht Kraft +
// Cardio (Programme → Woche), Einheit mit Schritten (Tempo-/Wattbereiche), „Heute geplant“ auf der Ausdauer-Kachel.
// Erstellt wird im Planer (ui/planer.js). Erledigt = Einheit gleicher Sportart am selben Tag.
import { html, useState, useEffect, Sheet, Portal, deEn, sprache, datumKurz, datumLang, fmt, nameVon, UebungsBild } from './basis.js';
import { HEUTE, DIENSTE } from './stand.js';
import { ZIELE, wochentag, erledigt, paceZonen, wattZonen, plusTage, intervalsWorkout } from '../js/ausdauerplan.js';
import { sichtbar, sportarten, sportVon, dauerText } from '../js/ausdauer.js';
import { pruefeWoche, hatKraft } from '../js/kombiplan.js';

const WT = [['Mo', 'Mon'], ['Di', 'Tue'], ['Mi', 'Wed'], ['Do', 'Thu'], ['Fr', 'Fri'], ['Sa', 'Sat'], ['So', 'Sun']];
const L = (de, en) => deEn(de, en);
const pace = (b) => `${dauerText(b[0])}–${dauerText(b[1])} /km`;
const watt = (b) => `${b[0]}–${b[1]} W`;
export const WT_NAME = WT;
const TYPNAME = { locker: ['Locker', 'Easy'], lang: ['Lang', 'Long'], tempo: ['Tempo', 'Tempo'], intervalle: ['Intervalle', 'Intervals'], wettkampf: ['Wettkampf', 'Race'], fahrtspiel: ['Fahrtspiel', 'Fartlek'] };
const ZONENNAME = { locker: ['locker', 'easy'], lang: ['lange Läufe', 'long runs'], steigerung: ['Steigerungen', 'strides'], marathon: ['Marathontempo', 'marathon pace'], tempo: ['Schwelle', 'threshold'], intervall: ['5-km-Tempo', '5K pace'], sweetspot: ['Sweet Spot', 'sweet spot'], schwelle: ['Schwelle', 'threshold'], vo2: ['VO2max', 'VO2max'] };

/** Text einer geplanten Einheit: Titel, Kurzzeile, Schritte. */
export function beschreibung(e, plan) {
  const z = e.zielBereich ?? plan.zonen?.[e.zone], ziel = z ? (e.sport === 'lauf' ? pace(z) : watt(z)) : '';
  const zn = ZONENNAME[e.zone] ? L(...ZONENNAME[e.zone]) : '';
  const titel = L(...(TYPNAME[e.typ] ?? ['Einheit', 'Session']));
  const nk = e.nachKraft ? L(' · nach dem Krafttraining', ' · after strength') : '';
  const b0 = beschreibungRoh(e, plan, z, ziel, zn, titel), b = e.notiz ? { ...b0, schritte: [...b0.schritte, e.notiz] } : b0;
  return nk ? { ...b, zeile: b.zeile + nk } : b;
}
function beschreibungRoh(e, plan, z, ziel, zn, titel) {
  if (e.typ === 'wettkampf' && !e.km) return { titel, zeile: L('Dein Wettkampf', 'Your race'), schritte: [L('Locker einfahren bzw. einlaufen, ein paar kurze Steigerungen', 'Easy warm-up with a few short pickups'), L('Viel Erfolg!', 'Good luck!')] };
  if (e.typ === 'fahrtspiel') return { titel, zeile: `${e.min} min · ${e.wdh} × ${e.dauer} min ${L('zügig', 'fast')}`,
    schritte: [L('10 min locker', '10 min easy'), L(`${e.wdh} × ${e.dauer} min zügig, dazwischen 2 min locker`, `${e.wdh} × ${e.dauer} min fast, 2 min easy between`), L(`Rest locker – insgesamt ${e.min} min`, `Rest easy – ${e.min} min in total`)] };
  if (e.sport === 'lauf' && e.min && e.km == null && !e.gesamtKm) {
    if (e.wdh) return { titel, zeile: `${e.min} min · ${e.wdh} × ${e.dauer} min ${zn}${ziel ? ` · ${ziel}` : ''}`,
      schritte: [L('10 min locker einlaufen', '10 min easy warm-up'), L(`${e.wdh} × ${e.dauer} min ${zn}${ziel ? ` (${ziel})` : ''}, dazwischen 3 min Trabpause`, `${e.wdh} × ${e.dauer} min ${zn}${ziel ? ` (${ziel})` : ''}, 3 min jog between`), L('Rest locker auslaufen', 'Easy cool-down')] };
    return { titel, zeile: `${e.min} min${ziel ? ` · ${ziel}` : ''}`, schritte: [e.typ === 'lang' ? L(`${e.min} min ruhig – lieber zu langsam als zu schnell`, `${e.min} min relaxed – better too slow than too fast`)
      : L(`${e.min} min locker – Unterhaltungstempo`, `${e.min} min easy – conversational pace`)] };
  }
  if (e.sport === 'rad' && !e.wdh && !e.min && e.km) return { titel, zeile: `${fmt(e.km, 1)} km${ziel ? ` · ${ziel}` : ''}`, schritte: [L(`${fmt(e.km, 1)} km gleichmäßig${ziel ? ` (${ziel})` : ''}`, `${fmt(e.km, 1)} km steady${ziel ? ` (${ziel})` : ''}`)] };
  if (e.sport === 'rad') {
    if (e.wdh) return { titel, zeile: `${e.wdh} × ${e.dauer} min ${zn}${ziel ? ` · ${ziel}` : ''}`,
      schritte: [L('15 min locker einfahren', '15 min easy warm-up'), L(`${e.wdh} × ${e.dauer} min ${zn}${ziel ? ` (${ziel})` : ''}, dazwischen ${e.pause} min locker`, `${e.wdh} × ${e.dauer} min ${zn}${ziel ? ` (${ziel})` : ''}, ${e.pause} min easy between`), L('10 min ausfahren', '10 min cool-down')] };
    return { titel, zeile: `${e.min < 60 ? `${e.min} min` : `${dauerText(e.min * 60)} h`.replace(':00 h', ' h')} ${zn}${ziel ? ` · ${ziel}` : ''}`, schritte: [L(`${e.min} min gleichmäßig ${zn}${ziel ? ` (${ziel})` : ''} – unterhalten muss gehen`, `${e.min} min steady ${zn}${ziel ? ` (${ziel})` : ''} – you should be able to talk`)] };
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

/** Programme → Cardio: aktueller Plan mit Woche, nächsten Einheiten, allen Wochen – oder Knopf zum Planer. */
export function AusdauerPlanKarte({ einst, setEinst, liste, plan = einst.ausdauerPlan, eintragen, zuUebung = null, neu }) {
  const [einheit, setEinheit] = useState(null), [alle, setAlle] = useState(false), [beenden, setBeenden] = useState(false);
  const l = sichtbar(liste, einst.ausdauer);
  // 237: mit intervals.icu verbunden → Plan als Workouts in den Kalender (von dort auf Garmin & Co.)
  const [iv, setIv] = useState(false), [uhr, setUhr] = useState(null);
  useEffect(() => { let an = true; DIENSTE.intervalsStatus?.().then((s) => an && setIv(!!s?.verbunden)).catch(() => {}); return () => { an = false; }; }, []);
  const anUhr = async () => {
    setUhr({ laeuft: true });
    try {
      const r = await DIENSTE.intervalsAktion('plan', { einheiten: plan.einheiten.filter((e) => e.datum >= HEUTE).map((e) => ({ id: e.id, datum: e.datum, ...intervalsWorkout(e, plan) })) });
      setUhr({ text: L(`${r?.gesendet ?? 0} Einheiten in deinem intervals.icu-Kalender. Auf die Uhr kommen sie, wenn dort unter Garmin „Upload planned workouts“ an ist.`,
        `${r?.gesendet ?? 0} sessions in your intervals.icu calendar. They reach your watch if “Upload planned workouts” is on in its Garmin settings.`) });
    } catch (x) { setUhr({ fehler: x.message }); }
  };
  const ist = (e) => erledigt(e, l, sportVon);
  const fenster = html`${einheit ? html`<${Portal}><${EinheitSheet} e=${einheit} plan=${plan} fertig=${ist(einheit)} eintragen=${eintragen} zu=${() => setEinheit(null)}/><//>` : null}`;
  if (!plan) return html`<section class="card pad stack ap-karte">
    <div><span class="viz-t">${L('Ausdauer-Plan', 'Cardio plan')}</span><div class="viz-u">${L('Ziel wählen – die App plant Läufe bzw. Fahrten mit Tempo- oder Wattvorgaben aus deiner Form, passend zum Kraftplan.', 'Pick a goal – the app plans runs or rides with pace or power targets from your form, fitting your strength plan.')}</div></div>
    <button class="btn btn-chalk btn-block" onClick=${neu}>${L('+ Ausdauer-Plan erstellen', '+ Create cardio plan')}</button>
    ${fenster}</section>`;
  const zielName = (plan.name ?? L(...(ZIELE[plan.sport].find(([id]) => id === plan.ziel) ?? ['', '', '']).slice(1, 3))) + (plan.rennDatum ? ` · ${datumKurz(plan.rennDatum)}` : '');
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
    ${iv ? html`<button class="btn btn-soft btn-block" disabled=${!!uhr?.laeuft} onClick=${anUhr}>${uhr?.laeuft ? L('Wird gesendet …', 'Sending …') : L('⌚ An die Uhr senden', '⌚ Send to watch')}</button>
      ${uhr?.text ? html`<span class="muted" style="font-size:12.5px">${uhr.text}</span>` : uhr?.fehler ? html`<span class="warn-text" style="font-size:12.5px">${uhr.fehler}</span>` : null}` : null}
    ${beenden ? html`<div class="strava-trennen"><span>${L('Plan beenden? Erledigte Einheiten bleiben im Verlauf.', 'End plan? Completed sessions stay in History.')}</span>
      <button class="btn btn-gefahr btn-sm" onClick=${() => { if (iv) DIENSTE.intervalsAktion?.('planLoeschen').catch(() => {}); setEinst({ ...einst, ausdauerPlan: null }); }}>${L('Plan beenden', 'End plan')}</button></div>` : null}
    ${fenster}</section>`;
}

/** 239/240: Programme → Woche – Kraft und Cardio der aktuellen Woche nebeneinander, mit Erholungs-Hinweisen. */
/** Einen Tag der Woche anpassen: Krafttag oder Cardio-Einheit auf einen anderen Tag dieser Woche, Cardio weglassen. */
function TagAnpassen({ datum, tage, kraft, cardio, plan, einst, setEinst, kraftVerschieben, zu }) {
  const anpassungen = einst.ausdauerPlan?.anpassungen ?? {};
  const setze = (id, wert) => { const a = { ...anpassungen }; if (wert) a[id] = wert; else delete a[id]; setEinst({ ...einst, ausdauerPlan: { ...einst.ausdauerPlan, anpassungen: a } }); };
  const ziele = tage.filter((d) => d !== datum && d >= HEUTE);
  const tagKnoepfe = (wahl) => html`<div class="pl-chips">${ziele.map((d) => html`<button key=${d} onClick=${() => { wahl(d); zu(); }}>${`${L(...WT[wochentag(d)])} ${datumKurz(d)}`}</button>`)}</div>`;
  return html`<${Sheet} zu=${zu} label=${L('Tag anpassen', 'Adjust day')}>
    <div class="sheet-kopf"><h2 class="h2">${datumLang(datum)}</h2></div>
    ${kraft ? html`<div class="stack" style="gap:8px"><b>💪 ${kraft.label ?? L('Krafttraining', 'Strength')}</b>
      ${kraftVerschieben && kraft.offset != null ? html`<span class="muted" style="font-size:12.5px">${L('Auf einen anderen Tag dieser Woche:', 'To another day this week:')}</span>${tagKnoepfe((d) => kraftVerschieben(kraft.offset, { datum: d }))}`
        : html`<span class="muted" style="font-size:12.5px">${L('Krafttage verschiebst du, sobald der Block läuft (und kein Training offen ist).', 'You can move strength days once the block is running (and no workout is open).')}</span>`}</div>` : null}
    ${cardio.map((e) => { const b = beschreibung(e, plan); return html`<div key=${e.id} class="stack" style="gap:8px"><b>${e.sport === 'lauf' ? '🏃' : '🚴'} ${b.titel} <small class="muted">${b.zeile}</small></b>
      ${einst.ausdauerPlan ? html`<span class="muted" style="font-size:12.5px">${L('Auf einen anderen Tag dieser Woche:', 'To another day this week:')}</span>${tagKnoepfe((d) => setze(e.id, { datum: d }))}
        <div class="row" style="gap:8px"><button class="btn btn-soft btn-sm" style="flex:1" onClick=${() => { setze(e.id, { weg: true }); zu(); }}>${L('Diese Woche weglassen', 'Skip this week')}</button>
          ${e.verschoben ? html`<button class="btn btn-soft btn-sm" style="flex:1" onClick=${() => { setze(e.id, null); zu(); }}>${L('Zurück auf den Plan', 'Back to plan')}</button>` : null}</div>` : null}</div>`; })}
    ${!kraft && !cardio.length ? html`<span class="muted">${L('Ruhetag – nichts geplant.', 'Rest day – nothing planned.')}</span>` : null}
  <//>`;
}

export function WochenKarte({ plan, planTage = [], kraftTag, beinTag, liste = [], einst, setEinst = null, kraftVerschieben = null, eintragen, neu }) {
  const [einheit, setEinheit] = useState(null), [versatz, setVersatz] = useState(0), [anpassen, setAnpassen] = useState(null);
  const mo = plusTage(HEUTE, -wochentag(HEUTE) + 7 * versatz), tage = Array.from({ length: 7 }, (_, i) => plusTage(mo, i));
  const l = sichtbar(liste, einst.ausdauer);
  const cardio = (d) => plan?.einheiten.filter((e) => e.datum === d) ?? [];
  const kraft = (d) => planTage.find((t) => t.datum === d) ?? (kraftTag(d) ? { geplant: true } : null);
  const woche = tage.map((d) => { const k = !!kraft(d), c = cardio(d).length > 0; return k && c ? 'beides' : k ? 'kraft' : c ? 'cardio' : 'ruhe'; });
  const hinweise = pruefeWoche(woche, tage.map(beinTag), tage.flatMap((d, i) => cardio(d).map((e) => ({ wt: i, typ: e.typ }))));
  const leer = !plan && !planTage.length;
  return html`<section class="card pad stack kw-karte">
    <div class="row between"><span class="viz-t">${versatz === 0 ? L('Diese Woche', 'This week') : versatz === 1 ? L('Nächste Woche', 'Next week') : versatz === -1 ? L('Letzte Woche', 'Last week') : `${datumKurz(mo)} – ${datumKurz(tage[6])}`}</span>
      <span class="row" style="gap:6px"><button class="iconbtn klein" aria-label=${L('Woche zurück', 'Previous week')} disabled=${versatz <= -26} onClick=${() => setVersatz(versatz - 1)}>‹</button>
        <button class="iconbtn klein" aria-label=${L('Woche vor', 'Next week')} disabled=${versatz >= 8} onClick=${() => setVersatz(versatz + 1)}>›</button></span></div>
    ${leer ? html`<span class="muted" style="font-size:13px">${L('Noch kein Plan. Im Planer legst du fest, an welchen Tagen Kraft, Cardio oder Ruhe ist.', 'No plan yet. In the planner you choose which days are strength, cardio or rest.')}</span>`
      : tage.map((d, i) => { const k = kraft(d), c = cardio(d);
        return html`<div key=${d} class=${`kw-zeile ${d === HEUTE ? 'heute' : ''} ${d < HEUTE ? 'vorbei' : ''}`}>
          <span class="kw-tag"><b>${L(...WT[i])}</b><small>${datumKurz(d)}</small>${setEinst && d >= HEUTE ? html`<button class="kw-aendern" onClick=${() => setAnpassen(d)}>${L('Ändern', 'Edit')}</button>` : null}</span>
          <span class="kw-inhalt">
            ${k ? html`<span class="kw-kraft">💪 ${k.label ?? L('Krafttraining', 'Strength')}${beinTag(d) ? html` <small>${L('· Beine', '· legs')}</small>` : null}</span>` : null}
            ${c.map((e) => { const b = beschreibung(e, plan); return html`<button key=${e.id} class=${`kw-cardio ${erledigt(e, l, sportVon) ? 'fertig' : ''}`} onClick=${() => setEinheit(e)}>${e.sport === 'lauf' ? '🏃' : '🚴'} <b>${b.titel}</b> <small>${b.zeile}</small></button>`; })}
            ${!k && !c.length ? html`<span class="muted kw-ruhe">${L('Ruhetag', 'Rest day')}</span>` : null}
          </span></div>`; })}
    ${leer ? null : html`<div class="stack" style="gap:4px">${hinweise.map((h, i) => html`<span key=${i} class=${`kw-hinweis ${h.art}`}>${h.art === 'warn' ? '⚠️ ' : h.art === 'gut' ? '✓ ' : 'ℹ️ '}${L(h.de, h.en)}</span>`)}</div>`}
    <button class="btn btn-chalk btn-block" onClick=${neu}>${L('Neuen Plan erstellen', 'Create new plan')}</button>
    ${einheit ? html`<${Portal}><${EinheitSheet} e=${einheit} plan=${plan} fertig=${erledigt(einheit, l, sportVon)} eintragen=${eintragen} zu=${() => setEinheit(null)}/><//>` : null}
    ${anpassen ? html`<${Portal}><${TagAnpassen} datum=${anpassen} tage=${tage} kraft=${planTage.find((t) => t.datum === anpassen) ?? null} cardio=${cardio(anpassen)} plan=${plan}
      einst=${einst} setEinst=${setEinst} kraftVerschieben=${kraftVerschieben} zu=${() => setAnpassen(null)}/><//>` : null}
  </section>`;
}

/** Für die Ausdauer-Kachel auf „Heute“: heutige bzw. nächste geplante Einheit. */
export function naechsteGeplante(plan) {
  if (!plan) return null;
  return plan.einheiten.find((e) => e.datum >= HEUTE) ?? null;
}
export { paceZonen, wattZonen };
