// PR Hunter · Block-Generator (Funktionskatalog „Block-Generator“): Eingaben, Prüfung gegen die Pana-Grenzen,
// Wochenübersicht in kg und Speichern als eigenes Programm. Die Rechnung steckt in js/generator.js.
import { html, useState, useEffect, fmt, I, datumKurz, katalogListe, nameVon, gw, einheit, ZahlFeld, LIFT, liftVon, wtKurz } from './basis.js';
import { generiere, wochenBis, STANDARD_VARIANTEN, haeufigkeiten } from '../js/generator.js';
import { Schritte, useSchritte } from './bbgenerator.js';
import { HEUTE, plusTage } from './stand.js';
import { montagVon } from '../js/daten.js';
import { MAX_NAME, startMaxe, kurzTitel, blockTage, wochenListe, TagPlan } from './plan.js';

const TYP_NAME = { wiedereinstieg: 'Wiedereinstieg', einstieg: 'Einstieg', aufbau: 'Aufbau', ueberlastung: 'Überlastung', peak: 'Peak-Vorbereitung', test: 'Test', deload: 'Deload' };
const BASIS = { squat: ['squat', 'competition_squat'], dead: ['deadlift', 'competition_deadlift'] };
const varianten = (lift) => katalogListe().filter((e) => (e.b === BASIS[lift][0] && e.lt === 'barbell' && e.k !== BASIS[lift][1]) || e.k === STANDARD_VARIANTEN[lift])
  .sort((a, b) => nameVon(a.k).localeCompare(nameVon(b.k)));

/** Startwerte des Formulars; eine Generator-Einstellung (rules.generator eines gespeicherten Programms) hat Vorrang. */
function startFormular(einst, vorgabe) {
  const montag = montagVon(HEUTE);
  return { name: '', start: montag === HEUTE ? HEUTE : plusTage(montag, 7), dauer: 'wochen', wochen: 5, ende: '', abschluss: 'test', urlaubDanach: false,
    bank: null, proWoche: { squat: 2, dead: 2, bench: 2 }, zubehoer: true, tm: einst.cut ? 0.92 : 0.95, varianten: { ...STANDARD_VARIANTEN }, wiedereinstieg: false,
    ...(vorgabe ?? {}), ...(vorgabe && !vorgabe.proWoche ? { proWoche: haeufigkeiten(vorgabe) } : {}) };
}

/** Inhalt eines Tages in Worten: „Kniebeuge schwer · Kreuzheben Variante · Zubehör“. */
function tagInhalt(items) {
  const teile = [];
  for (const i of items) {
    if (!i.exercise_key || ['bent_over_barbell_row', 'standing_military_press', 'weighted_pull_ups'].includes(i.exercise_key)) { if (!teile.includes('Zubehör')) teile.push('Zubehör'); continue; }
    const lift = LIFT[liftVon(i.exercise_key)]?.name ?? nameVon(i.exercise_key);
    const note = i.groups[0]?.note ?? '';
    if (note === 'Technik-Single' || i.role === 'backoff') continue;
    const art = i.role === 'top' ? 'schwer' : i.role === 'test' ? 'Test' : /Leicht/.test(note) ? 'leicht' : /Volumen/.test(note) ? 'Volumen'
      : /^competition_(squat|bench_press|deadlift)$/.test(i.exercise_key) ? '' : 'Variante';
    teile.push(art ? `${lift} ${art}` : lift);
  }
  return teile.filter((t, k) => teile.indexOf(t) === k).join(' · ');
}

/** Kurzform einer Planzeile für die Übersicht: „1×3 · 167,5“. */
function satzText(tag, key, rolle) {
  const u = tag?.uebungen.find((x) => x.key === key && x.rolle === rolle);
  const g = u?.gruppen[0];
  if (!g) return null;
  const s = g.saetze?.min === g.saetze?.max ? g.saetze?.min : `${g.saetze?.min}–${g.saetze?.max}`;
  const w = g.wdh?.text ?? (g.wdh?.min === g.wdh?.max ? g.wdh?.min : `${g.wdh?.min}–${g.wdh?.max}`);
  return `${s}×${w} · ${g.kg != null ? gw(g.kg) : '–'}`;
}

export function GeneratorAnsicht({ zurueck, einst, speichern, vorlagen = {}, vorgabe = null }) {
  const [f, setF] = useState(() => startFormular(einst, vorgabe));
  const [werte, setWerte] = useState(() => { const s = startMaxe(); return { S: s.S, D: s.D, B: s.B, G: s.G }; });
  const setze = (k, v) => setF((alt) => ({ ...alt, [k]: v }));
  // Schritt für Schritt statt alles auf einmal; jeder Schritt beginnt oben
  const [schritt, weiter, zurueckSchritt] = useSchritte();
  const wochen = f.dauer === 'datum' ? (f.ende ? wochenBis(f.start, f.ende) : null) : f.wochen;
  // Bankdrücken: Advanced Bench ist Standard ab 4 Wochen, sonst ohne Bank; eine Wahl bleibt
  const bank = f.bank ?? (wochen >= 4 && vorlagen.candito_int_adv_bench ? 'candito' : 'keine');
  const bankGeht = wochen >= 4 && !!vorlagen.candito_int_adv_bench;
  const bankWirklich = bank === 'candito' && !bankGeht ? 'keine' : bank;
  let erg = null, fehler = null;
  try {
    if (wochen == null) fehler = 'Enddatum eintragen.';
    else erg = generiere({ ...f, wochen, bank: bankWirklich, bankVorlage: vorlagen.candito_int_adv_bench,
      name: f.name.trim() || (f.dauer === 'datum' && f.ende ? `Block bis ${datumKurz(f.ende)}` : `Generator ${wochen} Wochen`) });
  } catch (e) { fehler = e.message; }
  const p = erg?.programm;
  const vollstaendig = p && p.inputs.every((k) => werte[k] > 0);
  let tage = [];
  try { tage = vollstaendig ? blockTage(p, { start: f.start, werte, cut: einst.cut }) : []; } catch (e) { fehler = e.message; }
  const wl = wochenListe(tage);
  const speicherbar = p && !erg.pruefung.fehler.length && !fehler;
  const seg = (k, optionen, label) => html`<div class="seg" role="group" aria-label=${label}>${optionen.map(([v, t, aus]) => html`<button key=${String(v)}
    aria-pressed=${String(f[k] === v)} disabled=${!!aus} onClick=${() => setze(k, v)}>${t}</button>`)}</div>`;
  const auswahl = (lift) => html`<label class="auswahl"><span>Variante ${lift === 'squat' ? 'Kniebeuge' : 'Kreuzheben'}</span>
    <select value=${f.varianten[lift]} onChange=${(e) => setze('varianten', { ...f.varianten, [lift]: e.currentTarget.value })}>
      ${varianten(lift).map((e) => html`<option key=${e.k} value=${e.k}>${nameVon(e.k)}</option>`)}</select></label>`;
  return html`<div class="screen">
    <header class="topbar unter">
      <button class="iconbtn" onClick=${zurueck} aria-label="Zurück zu den Programmen">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">Fortgeschritten · Top-Satz und Back-off</div><h1 class="h1" style="font-size:26px">Powerlifting-Generator</h1></div>
    </header>
    <${Schritte} schritt=${schritt} namen=${['Dauer', 'Aufbau', 'Maxe', 'Vorschau']}/>
    ${schritt === 1 ? html`<section class="card pad stack">
      <span class="viz-t">Dauer</span>
      <label class="field" for="g-start"><span class="label">Start</span><input id="g-start" type="date" value=${f.start} onInput=${(e) => setze('start', e.currentTarget.value)}/></label>
      ${seg('dauer', [['wochen', 'Anzahl Wochen'], ['datum', 'Bis zu einem Datum']], 'Dauer angeben als')}
      ${f.dauer === 'wochen' ? html`<div class="filter">${Array.from({ length: 11 }, (_, i) => i + 2).map((n) => html`<button key=${n} class="chip"
          aria-pressed=${String(f.wochen === n)} onClick=${() => setze('wochen', n)}>${n}</button>`)}</div>`
        : html`<label class="field" for="g-ende"><span class="label">Ende (z. B. Urlaubsbeginn)</span><input id="g-ende" type="date" value=${f.ende} onInput=${(e) => setze('ende', e.currentTarget.value)}/></label>
          ${wochen != null ? html`<span class="muted" style="font-size:13px">${wochen} volle Wochen ab ${datumKurz(f.start)}</span>` : null}`}
      <span class="eyebrow">Abschluss</span>
      ${seg('abschluss', [['test', 'Test'], ['deload', 'Deload'], ['keiner', 'Keiner']], 'Abschluss')}
      <label class="schalter" for="g-urlaub"><span><b>Danach Urlaub oder Pause</b><br/><span class="muted" style="font-size:13px">Dann kein Deload davor – die Pause übernimmt das.</span></span>
        <input type="checkbox" id="g-urlaub" checked=${f.urlaubDanach} onChange=${(e) => setze('urlaubDanach', e.currentTarget.checked)}/></label>
      <label class="schalter" for="g-wieder"><span><b>Wiedereinstiegswoche</b><br/><span class="muted" style="font-size:13px">Leichte erste Woche nach einer Pause, alle Werte an der unteren Pana-Grenze.</span></span>
        <input type="checkbox" id="g-wieder" checked=${f.wiedereinstieg} onChange=${(e) => setze('wiedereinstieg', e.currentTarget.checked)}/></label>
    </section>` : null}
    ${schritt === 2 ? html`<section class="card pad stack">
      <span class="viz-t">Aufbau</span>
      <span class="eyebrow">Bankdrücken</span>
      <div class="seg" role="group" aria-label="Bankdrücken">${[['keine', 'Ohne'], ['top', 'Top-Satz/Back-off'], ['candito', 'Advanced Bench']].map(([v, t]) => html`<button key=${v}
        aria-pressed=${String(bankWirklich === v)} disabled=${v === 'candito' && !bankGeht} onClick=${() => setze('bank', v)}>${t}</button>`)}</div>
      ${!bankGeht ? html`<span class="muted" style="font-size:12.5px">Advanced Bench braucht mindestens 4 Wochen.</span>` : null}
      <span class="eyebrow">Wie oft pro Woche</span>
      ${[['squat', 'Kniebeuge', [1, 2, 3]], ['dead', 'Kreuzheben', [1, 2, 3]], ...(bankWirklich === 'top' ? [['bench', 'Bankdrücken', [2, 3, 4]]] : [])].map(([lift, name, werte]) => html`
        <div class="pro-woche" key=${lift}><span>${name}</span><div class="seg" role="group" aria-label=${`${name} pro Woche`}>${werte.map((n) => html`<button key=${n}
          aria-pressed=${String(f.proWoche[lift] === n)} disabled=${lift === 'bench' && n === 4 && Math.max(f.proWoche.squat, f.proWoche.dead) === 1}
          onClick=${() => setze('proWoche', { ...f.proWoche, [lift]: n })}>${`${n}×`}</button>`)}</div></div>`)}
      <span class="muted" style="font-size:12.5px">Bei 3× Kniebeuge oder Kreuzheben: schwer, Variante, leicht. Unterkörpertage mindestens 3 Tage auseinander (vor leichten 2), schwere Kniebeuge und schweres Kreuzheben an verschiedenen Tagen. Bank ab 3× zusätzlich leicht an Unterkörpertagen.</span>
      ${Math.max(f.proWoche.squat, f.proWoche.dead) === 3 || (bankWirklich === 'top' && f.proWoche.bench >= 3) ? html`<label class="schalter" for="g-weniger"><span><b>Schwere Wochen: ein Tag weniger</b><br/>
        <span class="muted" style="font-size:12.5px">In Überlastung und Peak entfällt die leichte Technik-Einheit – z. B. Aufbau 5 Tage, schwere Wochen 4.</span></span>
        <input type="checkbox" id="g-weniger" checked=${!!f.schwerWeniger} onChange=${(ev) => setze('schwerWeniger', ev.currentTarget.checked)}/></label>` : null}
      <label class="schalter" for="g-zubehoer"><span><b>Zubehör</b><br/><span class="muted" style="font-size:12.5px">Oberkörpertag mit Rudern, Schulterdrücken, Klimmzug mit Gewicht und 2 Isolationen; Unterkörpertage mit 2 Bein-Isolationen.</span></span>
        <input type="checkbox" id="g-zubehoer" checked=${f.zubehoer !== false} onChange=${(e) => setze('zubehoer', e.currentTarget.checked)}/></label>
      <span class="eyebrow">Trainingsmax</span>
      ${seg('tm', [[0.95, '95 % (Aufbau)'], [0.92, '92 % (Cut)'], [1, '100 %']], 'Trainingsmax')}
      ${f.proWoche.squat >= 2 || f.proWoche.dead >= 2 ? html`<div class="filter-zeile">${f.proWoche.squat >= 2 ? auswahl('squat') : html`<span></span>`}${f.proWoche.dead >= 2 ? auswahl('dead') : null}</div>` : null}
    </section>` : null}
    ${schritt === 3 ? html`<section class="card pad stack">
      <span class="viz-t">Maxe (echtes 1RM)</span>
      <div class="fields">${(p?.inputs ?? ['S', 'D']).map((k) => html`<${ZahlFeld} key=${k} id=${`g-${k}`} label=${`${MAX_NAME[k]} (${einheit()})`} kg=${true}
        wert=${werte[k]} setze=${(v) => setWerte((w) => ({ ...w, [k]: v }))}/>`)}</div>
      <span class="muted" style="font-size:12.5px">Gerechnet wird vom Trainingsmax (${fmt((f.tm ?? 0.95) * 100)} %), der Test vom echten 1RM. Beim Blockstart lassen sich die Maxe noch ändern.</span>
    </section>` : null}
    ${schritt === 4 ? html`
    ${fehler ? html`<p class="fehler">${fehler}</p>` : null}
    ${erg?.pruefung.fehler.length ? html`<section class="hint">${I.warn}<span class="t">Außerhalb der Pana-Grenzen – nicht speicherbar</span><span></span>
      <ul style="margin:0;padding-left:18px;font-size:13.5px">${erg.pruefung.fehler.map((x) => html`<li key=${x}>${x}</li>`)}</ul></section>` : null}
    ${erg?.pruefung.hinweise.length ? html`<section class="card pad stack" style="gap:6px">${erg.pruefung.hinweise.map((x) => html`<span key=${x} class="muted" style="font-size:13.5px">${x}</span>`)}</section>` : null}
    ${p && vollstaendig ? html`<section class="card pad stack">
      <div class="row between"><span class="viz-t">Vorschau</span><span class="muted" style="font-size:13px">${wl.length} Wochen · ${tage.length} Einheiten · bis ${datumKurz(tage.at(-1).datum)}</span></div>
      ${(() => { const w = p.weeks.find((x) => !['test', 'deload'].includes(x.typ) && x.week > 1) ?? p.weeks[0];
        return html`<div class="wochenplan"><span class="eyebrow">${`Typische Woche (Woche ${w.week}) · ${w.days.length} Trainingstage`}</span>
          ${w.days.map((d) => html`<div key=${d.offset} class="wp-zeile"><b>${wtKurz(plusTage(f.start, d.offset))}</b><span>${tagInhalt(d.items)}</span></div>`)}</div>`; })()}
      <div style="overflow-x:auto"><table class="rec gen-tab"><thead><tr><th>W</th><th>Typ</th><th>Tage</th><th>KB Top</th><th>KB Back-off</th><th>KH Top</th><th>KH Back-off</th></tr></thead>
        <tbody>${p.weeks.map((w) => {
          const wt = tage.filter((t) => t.woche === w.week);
          const finde = (key, rolle) => satzText(wt.find((t) => t.uebungen.some((u) => u.key === key && u.rolle === rolle)), key, rolle);
          const test = w.typ === 'test', del = w.typ === 'deload';
          return html`<tr key=${w.week}><td>${w.week}</td><td>${TYP_NAME[w.typ] ?? kurzTitel(w.title)}${w.title.includes('Welle') ? ' ²' : ''}</td><td>${w.days.length}</td>
            <td>${del ? satzText(wt[0], 'competition_squat', null) : finde('competition_squat', test ? 'test' : 'top') ?? '–'}</td><td>${test || del ? '–' : finde('competition_squat', 'backoff') ?? '–'}</td>
            <td>${del ? satzText(wt[0], 'competition_deadlift', null) : finde('competition_deadlift', test ? 'test' : 'top') ?? '–'}</td><td>${test || del ? '–' : finde('competition_deadlift', 'backoff') ?? '–'}</td></tr>`;
        })}</tbody></table></div>
      <span class="muted" style="font-size:12px">Sätze×Wdh · ${einheit()}. ² = zweite Welle (+2,5 %).${einst.cut ? ' Cut-Modus aktiv: Back-offs und Varianten einen Satz weniger.' : ''}</span>
      ${wl.map((w, i) => {
        const wt = tage.filter((t) => t.woche === w);
        return html`<details key=${w} class="woche"><summary><span><b>Woche ${i + 1}</b> <span class="muted">· ${kurzTitel(p.weeks[i].title)}</span></span>
          <span class="muted" style="font-size:13px">${datumKurz(wt[0].datum)} – ${datumKurz(wt.at(-1).datum)}</span></summary>
          ${wt.map((t) => html`<${TagPlan} key=${t.offset} tag=${t}/>`)}</details>`;
      })}
    </section>` : null}
    <button class="btn btn-chalk btn-block" disabled=${!speicherbar} onClick=${() => speichern(p, { werte, start: f.start, quelle: 'generator' })}>Als eigenes Programm speichern</button>
    <span class="muted" style="font-size:12.5px;text-align:center">Danach lässt es sich bearbeiten, teilen und als Block starten.</span>
    ` : null}
    <div class="row schritt-knoepfe">${schritt > 1 ? html`<button class="btn btn-soft" style="flex:1" onClick=${zurueckSchritt}>Zurück</button>` : null}
      ${schritt < 4 ? html`<button class="btn btn-chalk" style="flex:1.6" onClick=${weiter}>Weiter</button>` : null}</div>
  </div>`;
}
