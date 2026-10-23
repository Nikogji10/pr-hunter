// PR Hunter · Block-Generator (Funktionskatalog „Block-Generator“): Eingaben, Prüfung gegen die Pana-Grenzen,
// Wochenübersicht in kg und Speichern als eigenes Programm. Die Rechnung steckt in js/generator.js.
import { html, useState, fmt, I, datumKurz, katalogListe, nameVon, gw, einheit, ZahlFeld } from './basis.js';
import { generiere, wochenBis, STANDARD_VARIANTEN } from '../js/generator.js';
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
    bank: null, einheiten: 2, tm: einst.cut ? 0.92 : 0.95, varianten: { ...STANDARD_VARIANTEN }, wiedereinstieg: false, ...(vorgabe ?? {}) };
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
  const wochen = f.dauer === 'datum' ? (f.ende ? wochenBis(f.start, f.ende) : null) : f.wochen;
  // Bankdrücken: Candito Advanced Bench ist Standard, wenn die Dauer passt (6 Wochen), sonst ohne Bank; eine Wahl bleibt
  const bank = f.bank ?? (wochen === 6 && vorlagen.candito_int_adv_bench ? 'candito' : 'keine');
  const bankGeht = wochen === 6 && !!vorlagen.candito_int_adv_bench;
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
    <header class="topbar">
      <button class="iconbtn" onClick=${zurueck} aria-label="Zurück zu den Programmen">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">Top-Satz und Back-off bis zum Termin</div><h1 class="h1" style="font-size:26px">Block-Generator</h1></div>
    </header>
    <section class="card pad stack">
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
    </section>
    <section class="card pad stack">
      <span class="viz-t">Aufbau</span>
      <span class="eyebrow">Bankdrücken</span>
      <div class="seg" role="group" aria-label="Bankdrücken">${[['keine', 'Ohne'], ['top', 'Top-Satz/Back-off'], ['candito', 'Candito Adv. Bench']].map(([v, t]) => html`<button key=${v}
        aria-pressed=${String(bankWirklich === v)} disabled=${v === 'candito' && !bankGeht} onClick=${() => setze('bank', v)}>${t}</button>`)}</div>
      ${!bankGeht ? html`<span class="muted" style="font-size:12.5px">Candito Advanced Bench passt nur bei genau 6 Wochen.</span>` : null}
      <span class="eyebrow">Einheiten je Lift und Woche</span>
      ${seg('einheiten', [[1, '1'], [2, '2'], [3, '3']], 'Einheiten je Lift')}
      <span class="eyebrow">Trainingsmax</span>
      ${seg('tm', [[0.95, '95 % (Aufbau)'], [0.92, '92 % (Cut)'], [1, '100 %']], 'Trainingsmax')}
      ${f.einheiten >= 2 ? html`<div class="filter-zeile">${auswahl('squat')}${auswahl('dead')}</div>` : null}
    </section>
    <section class="card pad stack">
      <span class="viz-t">Maxe (echtes 1RM)</span>
      <div class="fields">${(p?.inputs ?? ['S', 'D']).map((k) => html`<${ZahlFeld} key=${k} id=${`g-${k}`} label=${`${MAX_NAME[k]} (${einheit()})`} kg=${true}
        wert=${werte[k]} setze=${(v) => setWerte((w) => ({ ...w, [k]: v }))}/>`)}</div>
      <span class="muted" style="font-size:12.5px">Gerechnet wird vom Trainingsmax (${fmt((f.tm ?? 0.95) * 100)} %), der Test vom echten 1RM. Beim Blockstart lassen sich die Maxe noch ändern.</span>
    </section>
    ${fehler ? html`<p class="fehler">${fehler}</p>` : null}
    ${erg?.pruefung.fehler.length ? html`<section class="hint">${I.warn}<span class="t">Außerhalb der Pana-Grenzen – nicht speicherbar</span><span></span>
      <ul style="margin:0;padding-left:18px;font-size:13.5px">${erg.pruefung.fehler.map((x) => html`<li key=${x}>${x}</li>`)}</ul></section>` : null}
    ${erg?.pruefung.hinweise.length ? html`<section class="card pad stack" style="gap:6px">${erg.pruefung.hinweise.map((x) => html`<span key=${x} class="muted" style="font-size:13.5px">${x}</span>`)}</section>` : null}
    ${p && vollstaendig ? html`<section class="card pad stack">
      <div class="row between"><span class="viz-t">Vorschau</span><span class="muted" style="font-size:13px">${wl.length} Wochen · ${tage.length} Einheiten · bis ${datumKurz(tage.at(-1).datum)}</span></div>
      <div style="overflow-x:auto"><table class="rec gen-tab"><thead><tr><th>W</th><th>Typ</th><th>KB Top</th><th>KB Back-off</th><th>KH Top</th><th>KH Back-off</th></tr></thead>
        <tbody>${p.weeks.map((w) => {
          const wt = tage.filter((t) => t.woche === w.week);
          const finde = (key, rolle) => satzText(wt.find((t) => t.uebungen.some((u) => u.key === key && u.rolle === rolle)), key, rolle);
          const test = w.typ === 'test', del = w.typ === 'deload';
          return html`<tr key=${w.week}><td>${w.week}</td><td>${TYP_NAME[w.typ] ?? kurzTitel(w.title)}${w.title.includes('Welle') ? ' ²' : ''}</td>
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
  </div>`;
}
