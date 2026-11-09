// PR Hunter · Eigener Plan: Trainingstage benennen, Übungen selbst auswählen; die Woche ist eine Musterwoche, die sich
// über die gewählte Zahl an Wochen wiederholt. 255/256 (09.11.2026): Progression je Übung – keine (jede Woche gleich),
// Bodybuilding (Wdh-Bereich + RPE), Powerlifting (Top-Satz/Back-off, Rolle schwer/Variation/leicht) – mit Voreinstellung
// für den ganzen Plan. Die Rechnung steckt in js/progression.js. Der Powerlifting- und der Bodybuilding-Generator geben
// ihre Woche hierher weiter, damit sie sich frei ergänzen lässt (z. B. ein Oberkörpertag dazu).
import { html, useState, useEffect, I, nameVon, deEn, useSitzung, uebung, liftVon } from './basis.js';
import { UebungSuche } from './suche.js';
import { Schritte, useSchritte } from './bbgenerator.js';
import { kanon } from '../js/daten.js';
import { eigenerPlanAus, progressionSetzen, istIsolation, arten, HAUPT_KEY, FORTLAUFEND } from '../js/progression.js';
import { pruefePana } from '../js/generator.js';

const BUCHSTABE = 'ABCDEFG';
const neuerTag = (i) => ({ name: deEn(`Tag ${BUCHSTABE[i]}`, `Day ${BUCHSTABE[i]}`), uebungen: [] });
const WT = [['Mo', 'Mon'], ['Di', 'Tue'], ['Mi', 'Wed'], ['Do', 'Thu'], ['Fr', 'Fri'], ['Sa', 'Sat'], ['So', 'Sun']];
const wtName = (t) => (Number.isInteger(t.wt) ? `${deEn(...WT[t.wt])} · ` : '');
const LIFT_ZU = { squat: 'S', bench: 'B', dead: 'D' }, FAMILIE_ZU = { squat: 'S', bench: 'B', deadlift: 'D' };
const WETTKAMPF = new Set([...Object.values(HAUPT_KEY), 'barbell_squat', 'barbell_bench_press_-_medium_grip', 'barbell_deadlift']);

/** Katalogwissen für die Progression: zu welchem Lift gehört die Übung (Langhantel-Kniebeuge/-Bank/-Kreuzheben), Isolation? */
export function uebungInfo(key) {
  const e = uebung(key);
  const lift = LIFT_ZU[liftVon(key)] ?? (e?.lt === 'barbell' ? FAMILIE_ZU[e?.f] : null) ?? null;
  return { lift, iso: istIsolation(e?.f), wettkampf: WETTKAMPF.has(key) || WETTKAMPF.has(kanon(key)) };
}

const MODI = [
  ['keine', '📋', ['Keine', 'None'], ['Jede Woche gleich – steigern über Gewicht und Wdh im Training', 'Same every week – progress via weight and reps in training']],
  ['bb', '🏋️', ['Bodybuilding', 'Bodybuilding'], ['Wdh-Bereich + RPE: die RPE steigt über den Block, das Gewicht kommt aus deinem e1RM', 'Rep range + RPE: RPE rises over the block, weight comes from your e1RM']],
  ['pl', '🏆', ['Powerlifting', 'Powerlifting'], ['Kniebeuge, Bank, Kreuzheben mit Top-Satz und Back-offs, der Rest feste Sätze', 'Squat, bench, deadlift with top set and back-offs, the rest fixed sets']],
  ['beides', '⚖️', ['Beides', 'Both'], ['Die drei Lifts Top-Satz/Back-off, alles andere Bodybuilding', 'The three lifts top set/back-off, everything else bodybuilding']],
];
const ROLLEN = [['schwer', ['Schwer', 'Heavy']], ['variation', ['Variation', 'Variation']], ['leicht', ['Leicht', 'Light']]];

/** Kurztext einer Übung in der Übersicht. */
function beschreibung(u) {
  const rot = u.rotation?.length > 1 ? ` · ${deEn('wechselt mit', 'rotates with')} ${u.rotation.filter((k) => k !== u.key).map((k) => nameVon(k, k)).join(', ')}` : '';
  if (u.prog === 'candito') return 'Advanced Bench';
  if (u.prog === 'pl') return (u.rolle === 'schwer' ? deEn('Top-Satz + Back-offs', 'Top set + back-offs') : u.rolle === 'variation' ? deEn('Variation · Top-Satz + Back-off', 'Variation · top set + back-off')
    : deEn('Leicht · Technik', 'Light · technique')) + rot;
  const s = `${u.saetze || 3} × ${u.wdh || '8-12'}`;
  return u.prog === 'bb' ? `${s} · ${deEn('RPE steigt', 'RPE rises')}` : `${s}${u.rpe ? ` · RPE ${u.rpe}` : ''}`;
}

export function EigenerPlan({ zurueck, speichern, vorlagen = {} }) {
  const [schritt, weiter, zurueckSchritt] = useSchritte('prh-gen-eigen-schritt');
  const [name, setName] = useSitzung('prh-gen-eigen-name', '');
  const [wochen, setWochen] = useSitzung('prh-gen-eigen-wochen', 6);
  const [tage, setTage] = useSitzung('prh-gen-eigen-tage', () => [neuerTag(0), neuerTag(1), neuerTag(2)]);
  const [modus, setModusRoh] = useSitzung('prh-gen-eigen-modus', 'keine');
  const [abschluss, setAbschluss] = useSitzung('prh-gen-eigen-abschluss', 'test');
  const [tm, setTm] = useSitzung('prh-gen-eigen-tm', 0.95);
  const [suche, setSuche] = useState(null);                  // Tag, für den gerade eine Übung gesucht wird
  const [tausch, setTausch] = useState(null);                // [Tag, Übung], die gerade getauscht wird (Platz bleibt)
  const [offen, setOffen] = useState(null);                  // 162: nur ein Tag aufgeklappt
  useEffect(() => window.scrollTo(0, 0), [schritt]);
  const aendere = (i, f) => setTage((alt) => alt.map((t, j) => (j === i ? f(structuredClone(t)) : t)));
  const aendereU = (i, j, f) => aendere(i, (x) => { x.uebungen[j] = f(x.uebungen[j]); return x; });
  const anzahl = (n) => setTage((alt) => Array.from({ length: n }, (_, i) => { const t = alt[i] ?? neuerTag(i); const { wt, ...rest } = t; return n === alt.length ? t : rest; }));
  const art = arten(tage), progressiv = art.pl || art.bb || art.candito || modus !== 'keine', mitPl = art.pl || art.candito || modus === 'pl' || modus === 'beides';
  const wochenWahl = progressiv ? [4, 5, 6, 8, 10, 12] : [4, 6, 8, 12, FORTLAUFEND];
  const wochenJetzt = wochenWahl.includes(wochen) ? wochen : progressiv ? Math.min(12, wochen) : wochen;
  const abschlussJetzt = !mitPl && abschluss === 'test' ? 'deload' : abschluss;
  const setModus = (m) => { setModusRoh(m); setTage((alt) => progressionSetzen(alt, m, uebungInfo)); if (m !== 'keine' && wochen === FORTLAUFEND) setWochen(8); };
  // neue Übung: Progression nach der Voreinstellung; die erste Wettkampf-Einheit eines Lifts ist die schwere
  const neueUebung = (key) => {
    const i = uebungInfo(key), pl = (modus === 'pl' || modus === 'beides') && i.lift;
    const schwerDa = tage.some((t) => t.uebungen.some((u) => u.prog === 'pl' && u.lift === i.lift && u.rolle === 'schwer'));
    if (pl) return { key, prog: 'pl', lift: i.lift, rolle: i.wettkampf && !schwerDa ? 'schwer' : 'variation', iso: false };
    const bb = modus === 'bb' || modus === 'beides';
    return { key, saetze: '3', wdh: bb ? (i.iso ? '8-12' : '6-10') : '8-12', rpe: bb ? '' : '8', prog: bb ? 'bb' : 'fest', iso: i.iso };
  };
  const progWahl = (i, j, p) => aendereU(i, j, (u) => {
    const info = uebungInfo(u.key);
    if (p === 'pl') return { ...u, prog: 'pl', lift: info.lift, rolle: u.rolle ?? (info.wettkampf ? 'schwer' : 'variation') };
    const { rolle, lift, rotation, slot, slots, ...rest } = u;
    return { ...rest, prog: p, iso: info.iso, saetze: rest.saetze || '3', wdh: rest.wdh || (p === 'bb' ? (info.iso ? '8-12' : '6-10') : '8-12'), rpe: p === 'fest' ? rest.rpe || '8' : rest.rpe ?? '' };
  });
  const leer = tage.some((t) => !t.uebungen.length);
  let plan = null, fehler = null;
  if (schritt === 3 && !leer) {
    try { plan = eigenerPlanAus({ name: name.trim(), wochen: wochenJetzt, tage, abschluss: abschlussJetzt, tm, canditoVorlage: vorlagen.candito_int_adv_bench }); } catch (e) { fehler = e.message; }
  }
  const pana = plan ? pruefePana(plan) : { fehler: [] };
  const opt = (aktiv, icon, titel, text, onClick) => html`<button class=${`pl-opt ${aktiv ? 'an' : ''}`} aria-pressed=${String(aktiv)} onClick=${onClick}>
    <span class="pl-ico" aria-hidden="true">${icon}</span><span class="pl-txt"><b>${titel}</b>${text ? html`<small>${text}</small>` : null}</span><span class="pl-radio" aria-hidden="true"></span></button>`;
  const seg = (werte, aktiv, setzen, label) => html`<div class="seg" role="group" aria-label=${label}>${werte.map(([v, t]) => html`<button key=${String(v)} aria-pressed=${String(aktiv === v)} onClick=${() => setzen(v)}>${t}</button>`)}</div>`;
  return html`<div class="screen">
    <header class="topbar unter"><button class="iconbtn" onClick=${zurueck} aria-label="Zurück">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">${deEn('Alles selbst wählen', 'Choose everything yourself')}</div><h1 class="h1">Eigener Plan</h1></div></header>
    <${Schritte} schritt=${schritt} namen=${['Grundlagen', 'Übungen', 'Speichern']}/>

    ${schritt === 1 ? html`<section class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">1</span><span class="viz-t">Tage und Dauer</span></div>
      <span class="eyebrow">Trainingstage pro Woche</span>
      <div class="seg" role="group" aria-label="Trainingstage pro Woche">${[1, 2, 3, 4, 5, 6].map((n) => html`<button key=${n} aria-pressed=${String(tage.length === n)} onClick=${() => anzahl(n)}>${`${n}×`}</button>`)}</div>
      <span class="eyebrow">${deEn('Progression', 'Progression')}</span>
      <div class="pl-optionen">${MODI.map(([m, icon, t, x]) => opt(modus === m, icon, deEn(...t), deEn(...x), () => setModus(m)))}</div>
      <span class="muted" style="font-size:12.5px">${deEn('Gilt als Vorschlag für jede Übung – in Schritt 2 lässt sie sich je Übung ändern.', 'A suggestion for every exercise – change it per exercise in step 2.')}</span>
      <span class="eyebrow">Wie viele Wochen</span>
      ${seg(wochenWahl.map((n) => [n, n === FORTLAUFEND ? 'Fortlaufend' : `${n} Wo.`]), wochenJetzt, setWochen, 'Wochen')}
      ${wochenJetzt === FORTLAUFEND ? html`<span class="muted" style="font-size:12.5px">Ohne festes Ende: die Woche läuft ein Jahr lang weiter, beenden oder ändern geht jederzeit.</span>` : null}
      ${progressiv ? html`<span class="eyebrow">${deEn('Am Ende', 'At the end')}</span>
        ${seg([...(mitPl ? [['test', deEn('Test', 'Test')]] : []), ['deload', 'Deload'], ['keiner', deEn('Ohne', 'None')]], abschlussJetzt, setAbschluss, deEn('Abschluss', 'Finish'))}
        <span class="muted" style="font-size:12.5px">${abschlussJetzt === 'test' ? deEn('Letzte Woche: Test der Lifts (1–2 Wdh @ 97,5 %), daraus die neuen Maxe.', 'Last week: test of the lifts (1–2 reps @ 97.5 %), new maxes from it.')
          : abschlussJetzt === 'deload' ? deEn('Letzte Woche leicht: halbe Sätze, RPE 6–7.', 'Last week light: half the sets, RPE 6–7.') : deEn('Ohne eigene Abschlusswoche.', 'No separate final week.')}</span>` : null}
      ${mitPl ? html`<span class="eyebrow">Trainingsmax</span>
        ${seg([[0.95, '95 % (Aufbau)'], [0.92, '92 % (Cut)'], [1, '100 %']], tm, setTm, 'Trainingsmax')}
        <span class="muted" style="font-size:12.5px">${deEn('Top-Satz und Back-offs rechnen in % vom Trainingsmax, die Maxe trägst du beim Blockstart ein.', 'Top set and back-offs are % of the training max; you enter your maxes when starting the block.')}</span>` : null}
      <span class="eyebrow">Namen der Tage</span>
      ${tage.map((t, i) => html`<input key=${i} class="text" type="text" aria-label=${`Name Tag ${i + 1}`} value=${t.name} onInput=${(e) => { const v = e.currentTarget.value; aendere(i, (x) => ({ ...x, name: v })); }}/>`)}
      <span class="muted" style="font-size:12.5px">Zum Beispiel „Push“, „Pull“, „Beine“ oder „Oberkörper“.</span>
    </section>` : null}

    ${schritt === 2 ? html`${tage.map((t, i) => html`<section key=${i} class=${`card pad stack eigen-tag ${offen === i ? 'auf' : ''}`}>
      <button class="schritt-kopf eigen-tag-kopf" aria-expanded=${String(offen === i)} onClick=${() => { setOffen(offen === i ? null : i); setSuche(null); }}>
        <span class="rechner-nr">${BUCHSTABE[i]}</span><span class="viz-t">${wtName(t)}${t.name}</span>
        <span class="muted" style="margin-left:auto;font-size:12.5px">${t.uebungen.length === 1 ? '1 Übung' : `${t.uebungen.length} Übungen`}</span><span class="ed-pfeil">${offen === i ? '▾' : '▸'}</span></button>
      ${offen !== i ? null : t.uebungen.map((u, j) => { const info = uebungInfo(u.key), prog = u.prog ?? 'fest';
        return html`<div key=${j} class="eigen-uebung"><b>${nameVon(u.key, u.key)}</b>
        <span class="row" style="gap:4px">${u.prog === 'candito' ? null : html`<button class="iconbtn klein" aria-label=${deEn('Übung tauschen', 'Swap exercise')} aria-pressed=${String(tausch?.[0] === i && tausch?.[1] === j)} onClick=${() => { setTausch(tausch?.[0] === i && tausch?.[1] === j ? null : [i, j]); setSuche(null); }}>⇄</button>`}
          <button class="iconbtn klein" aria-label="Übung entfernen" onClick=${() => { setTausch(null); aendere(i, (x) => ({ ...x, uebungen: x.uebungen.filter((_, k) => k !== j) })); }}>${I.zu}</button></span>
        ${tausch?.[0] === i && tausch?.[1] === j ? html`<div class="eigen-tausch"><${UebungSuche} id=${`eigen-tausch-${i}-${j}`} titel=${deEn(`${nameVon(u.key, u.key)} tauschen`, `Swap ${nameVon(u.key, u.key)}`)}
          onWahl=${(key) => { aendereU(i, j, (x) => { const { rotation, slot, slots, ...rest } = x; const ni = uebungInfo(key);
            return x.prog === 'pl' && !ni.lift ? { ...neueUebung(key), prog: 'fest', saetze: '3', wdh: '8-12', rpe: '8' } : { ...rest, key, lift: x.prog === 'pl' ? ni.lift : rest.lift, iso: ni.iso }; }); setTausch(null); }}/></div>` : null}
        ${u.prog === 'candito' ? html`<span class="eigen-prog-info">${deEn('Advanced Bench – Sätze, Gewichte und Wochen kommen aus der Candito-Vorlage.', 'Advanced Bench – sets, weights and weeks come from the Candito template.')}</span>` : html`
          <div class="eigen-prog">${seg([['fest', deEn('Fest', 'Fixed')], ['bb', 'BB'], ...(info.lift ? [['pl', 'PL']] : [])], prog, (p) => progWahl(i, j, p), deEn('Progression', 'Progression'))}</div>
          ${prog === 'pl' ? html`<div class="eigen-prog">${seg(ROLLEN.map(([r, n]) => [r, deEn(...n)]), u.rolle ?? 'schwer', (r) => aendereU(i, j, (x) => ({ ...x, rolle: r })), deEn('Rolle', 'Role'))}</div>
            <span class="eigen-prog-info">${beschreibung(u)}</span>` : html`
            <label>Sätze<input class="text" type="text" inputmode="numeric" value=${u.saetze} onInput=${(e) => { const v = e.currentTarget.value; aendereU(i, j, (x) => ({ ...x, saetze: v })); }}/></label>
            <label>Wdh<input class="text" type="text" value=${u.wdh} onInput=${(e) => { const v = e.currentTarget.value; aendereU(i, j, (x) => ({ ...x, wdh: v })); }}/></label>
            ${prog === 'fest' ? html`<label>RPE<input class="text" type="text" inputmode="decimal" value=${u.rpe} onInput=${(e) => { const v = e.currentTarget.value; aendereU(i, j, (x) => ({ ...x, rpe: v })); }}/></label>`
              : html`<span class="eigen-prog-info">${u.iso ? deEn('RPE 9, letzter Satz bis 10', 'RPE 9, last set to 10') : deEn('RPE 7–8 → 9–9,5', 'RPE 7–8 → 9–9.5')}</span>`}`}`}</div>`; })}
      ${offen !== i ? null : suche === i ? html`<${UebungSuche} id=${`eigen-${i}`} onWahl=${(key) => { aendere(i, (x) => ({ ...x, uebungen: [...x.uebungen, neueUebung(key)] })); setSuche(null); }}/>`
        : html`<button class="btn btn-soft btn-sm" onClick=${() => setSuche(i)}>+ Übung hinzufügen</button>`}
    </section>`)}` : null}

    ${schritt === 3 ? html`<section class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">3</span><span class="viz-t">Überblick</span></div>
      ${tage.map((t, i) => html`<div key=${i} class="wochenplan"><span class="eyebrow">${wtName(t)}${t.name}</span>
        ${t.uebungen.length ? t.uebungen.map((u, j) => html`<div key=${j} class="wp-zeile eigen-zeile"><span>${nameVon(u.key, u.key)}</span><span class="muted">${beschreibung(u)}</span></div>`)
          : html`<span class="muted" style="font-size:13px">Noch keine Übung – zurück zu Schritt 2.</span>`}</div>`)}
      ${plan && progressiv ? html`<div class="eigen-wochen">${plan.weeks.map((w) => html`<span key=${w.week} class=${`ew ${w.typ}`}>${w.title.replace(/^Woche \d+ – /, '') || `W${w.week}`}</span>`)}</div>` : null}
      ${fehler ? html`<p class="fehler" style="margin:0">${fehler}</p>` : null}
      ${pana.fehler.length ? html`<p class="fehler" style="margin:0">${pana.fehler.join(' ')}</p>` : null}
      <label class="field" for="eigen-name"><span class="label">Name (optional)</span>
        <input id="eigen-name" class="text" type="text" placeholder=${`Eigener Plan ${tage.length}×/Woche`} value=${name} onInput=${(e) => setName(e.currentTarget.value)}/></label>
      <button class="btn btn-chalk btn-block" disabled=${leer || !plan} onClick=${() => speichern(plan, { quelle: 'eigen' })}>Plan speichern</button>
      <span class="muted" style="font-size:12.5px">${leer ? 'Jeder Tag braucht mindestens eine Übung.' : plan?.inputs.length ? deEn(`Beim Blockstart trägst du deine Maxe ein (${plan.inputs.join(', ')}); die übrigen Gewichte schlägt die App aus deinem besten e1RM und der RPE vor.`, `When starting the block you enter your maxes (${plan.inputs.join(', ')}); other weights come from your best e1RM and the RPE.`)
        : 'Danach als Block starten – die Gewichte schlägt die App beim Training aus deinem besten e1RM und der RPE vor.'}</span>
    </section>` : null}

    <div class="row schritt-knoepfe">${schritt > 1 ? html`<button class="btn btn-soft" style="flex:1" onClick=${zurueckSchritt}>Zurück</button>` : null}
      ${schritt < 3 ? html`<button class="btn btn-chalk" style="flex:1.6" onClick=${weiter}>Weiter</button>` : null}</div>
  </div>`;
}
