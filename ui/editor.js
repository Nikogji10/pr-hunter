// PR Hunter · Programm-Editor (Funktionskatalog „Bearbeiten“): Wochen und Tage, Übungen tauschen, hinzufügen,
// entfernen und umsortieren, Sätze/Wdh/Last/RPE ändern, Tage verschieben, Wochen duplizieren. Speichern überschreibt
// das Programm (keine Versionen, Nikos Entscheidung 23.10.2026); bei Pana-Warnungen vorher nachfragen.
import { html, useState, I, Sheet, nameVon, datumKurz, katalogListe, rollenText, sprache } from './basis.js';
import { leseSaetze, leseWdh, formelNamen } from '../js/programm.js';
import { lastText, textZuLast, leseRpeFeld, pruefeProgrammJson } from '../js/import.js';
import { pruefePana } from '../js/generator.js';
import { DIENSTE, plusTage } from './stand.js';
import { INFO, kurzTitel, PARAMETER } from './plan.js';
import { UebungSuche } from './suche.js';
import { dupliziereWoche, loescheWoche, bereinigt } from '../js/bearbeiten.js';

const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const rpeEingabe = (r) => (r == null ? '' : String(r).replace(/^RPE\s*/i, ''));

// #################################################################
// Eingabefelder, die den getippten Text behalten und erst gültige Werte übernehmen
// #################################################################
function Feld({ label, wert, lies, setze, breit = false, halb = false, platzhalter = '' }) {
  const [text, setText] = useState(wert);
  const [falsch, setFalsch] = useState(false);
  return html`<label class=${`ed-feld ${breit ? 'breit' : ''} ${halb ? 'halb' : ''}`}><span>${label}</span>
    <input type="text" class=${falsch ? 'falsch' : ''} value=${text} placeholder=${platzhalter} autocomplete="off"
      onInput=${(e) => { const t = e.currentTarget.value; setText(t); const r = lies(t); setFalsch(!!r.fehler); if (!r.fehler) setze(r.wert); }}/></label>`;
}
const liesSaetze = (t) => (!t.trim() ? { fehler: true } : leseSaetze(t.trim())?.text ? { fehler: true } : { wert: t.trim() });
const liesWdh = (t) => {
  const s = t.trim().replace(/^amrap\s*/i, 'MR');
  return !s ? { fehler: true } : leseWdh(s)?.text ? { fehler: true } : { wert: s };
};
const liesLast = (namen) => (t) => { const r = textZuLast(t, namen); return r.fehler ? { fehler: true } : { wert: r.load }; };
const liesRpe = (t) => { const r = leseRpeFeld(t); return r.fehler ? { fehler: true } : { wert: r.rpe }; };
const liesZahl = (t) => { const n = Number(t.trim().replace(',', '.')); return t.trim() && Number.isFinite(n) && n >= 0 ? { wert: n } : { fehler: true }; };

function Gruppe({ g, setze, entfernen, namen }) {
  return html`<div class="ed-gruppe">
    <${Feld} label="Sätze" wert=${g.sets ?? ''} lies=${liesSaetze} setze=${(v) => setze({ sets: v })}/>
    <${Feld} label="Wdh" wert=${g.reps ?? ''} lies=${liesWdh} setze=${(v) => setze({ reps: v })}/>
    <${Feld} label="Last" wert=${lastText(g.load)} lies=${liesLast(namen)} platzhalter="frei" setze=${(v) => setze({ load: v })}/>
    <button class="mini-btn" aria-label="Satzgruppe entfernen" onClick=${entfernen}>×</button>
    <${Feld} label="RPE" halb=${true} wert=${rpeEingabe(g.rpe)} lies=${liesRpe} platzhalter="–" setze=${(v) => setze({ rpe: v })}/>
    <${Feld} label="Notiz" halb=${true} wert=${g.note ?? ''} lies=${(t) => ({ wert: t.trim() || null })} setze=${(v) => setze({ note: v })}/>
  </div>`;
}

export function Editor({ datei, programm, start = null, zurueck, toast }) {
  const [def, setDef] = useState(() => structuredClone(programm));
  const [wi, setWi] = useState(0);
  const [geaendert, setGeaendert] = useState(false);
  const [sheet, setSheet] = useState(null);       // { art: 'tausch' | 'neu', di, ii } | { art: 'speichern' | 'verwerfen' | 'woche-weg' }
  const [speichert, setSpeichert] = useState(false);
  const [stand, setStand] = useState(0);          // erzwingt neue Eingabefelder nach Umbauten (Feld hält eigenen Text)
  const aendere = (fn, neuAufbauen = false) => {
    setDef((d) => { const n = structuredClone(d); fn(n); return n; });
    setGeaendert(true);
    if (neuAufbauen) setStand((s) => s + 1);
  };
  const w = def.weeks[Math.min(wi, def.weeks.length - 1)];
  const wIndex = def.weeks.indexOf(w);
  // Belegte Tage: die eigene Woche und alle anderen außer Alternativwochen bzw. der Woche, die diese Alternative ersetzt
  const belegt = new Set(def.weeks.filter((x) => x === w || (x.alternative_to == null && x.week !== w.alternative_to)).flatMap((x) => x.days.map((d) => d.offset)));
  const tagName = (o) => (start ? `${WT[new Date(`${plusTage(start, o)}T00:00:00Z`).getUTCDay()]} ${datumKurz(plusTage(start, o))}` : `Tag ${o + 1}`);
  const pana = pruefePana(def);
  const speichern = async () => {
    const geprueft = pruefeProgrammJson(bereinigt(def), katalogListe());
    if (geprueft.fehler.length) { toast({ titel: 'Nicht gespeichert', text: geprueft.fehler[0] }); return; }
    setSpeichert(true);
    try {
      await DIENSTE.programmSpeichern(datei, geprueft.programm);
      setGeaendert(false); setSheet(null);
      toast({ titel: 'Gespeichert', text: 'Gilt ab der nächsten Einheit; erledigte Trainings bleiben, wie sie waren.' });
    } catch (e) { toast({ titel: 'Nicht gespeichert', text: e.message }); }
    finally { setSpeichert(false); }
  };
  const verschiebe = (di, um) => aendere((n) => {
    const d = n.weeks[wIndex].days[di];
    d.offset += um;
    n.weeks[wIndex].days.sort((a, b) => a.offset - b.offset);
  });
  const neuerTag = () => {
    const ab = w.days.length ? Math.max(...w.days.map((d) => d.offset)) + 1 : wIndex * 7;
    let o = ab; while (belegt.has(o)) o += 1;
    aendere((n) => { n.weeks[wIndex].days.push({ offset: o, items: [], notes: [] }); });
  };
  return html`<div class="screen">
    <header class="topbar unter">
      <button class="iconbtn" onClick=${() => (geaendert ? setSheet({ art: 'verwerfen' }) : zurueck())} aria-label="Zurück">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">Bearbeiten${geaendert ? ' · nicht gespeichert' : ''}</div><h1 class="h1" style="font-size:24px">${INFO[datei].kurz}</h1></div>
    </header>
    ${def.params ? html`<details class="card pad" key=${`p-${stand}`}>
      <summary class="row between" style="cursor:pointer;list-style:none"><span class="viz-t">Parameter</span><span class="muted" style="font-size:13px">Trainingsmax ${String(def.params.TM_BULK ?? '–').replace('.', ',')} · Cut ${String(def.params.TM_CUT ?? '–').replace('.', ',')}</span></summary>
      <div class="ed-param">${Object.entries(def.params).map(([k, v]) => typeof v === 'boolean'
        ? html`<label key=${k} class="schalter breit" for=${`par-${k}`}><span><b>${PARAMETER[k]?.[0] ?? k}</b><br/><span class="muted" style="font-size:12px">${PARAMETER[k]?.[1] ?? ''}</span></span>
            <input type="checkbox" id=${`par-${k}`} checked=${v} onChange=${(e) => { const x = e.currentTarget.checked; aendere((n) => { n.params[k] = x; }); }}/></label>`
        : html`<${Feld} key=${k} label=${`${PARAMETER[k]?.[0] ?? k}${PARAMETER[k] ? ` (${PARAMETER[k][1]})` : ''}`} wert=${String(v).replace('.', ',')} lies=${liesZahl}
            setze=${(x) => aendere((n) => { n.params[k] = x; })}/>`)}</div>
      <p class="muted" style="margin:8px 0 0;font-size:12.5px">Gelten für alle Wochen. Trainingsmax wird zuerst gerundet, dann mit den Prozent der Woche gerechnet.</p>
    </details>` : null}
    <div class="ed-wochen" role="tablist" aria-label="Wochen">${def.weeks.map((x, i) => html`<button key=${x.week} class="chip" role="tab" aria-pressed=${String(i === wIndex)}
      onClick=${() => setWi(i)}>W${x.week}${x.alternative_to ? '*' : ''}</button>`)}</div>
    <section class="card pad stack" key=${`w${wIndex}-${stand}`}>
      <${Feld} label=${`Titel Woche ${w.week}`} breit=${true} wert=${w.title ?? ''} lies=${(t) => ({ wert: t })} setze=${(v) => aendere((n) => { n.weeks[wIndex].title = v; })}/>
      ${w.alternative_to ? html`<span class="muted" style="font-size:13px">* Alternative zu Woche ${w.alternative_to} (beim Blockstart wählbar).</span>` : null}
      <div class="row wrap" style="gap:6px">
        ${!w.alternative_to ? html`<button class="btn btn-soft btn-sm" onClick=${() => { setDef((d) => dupliziereWoche(d, wIndex)); setGeaendert(true); setWi(wIndex + 1); setStand((s) => s + 1); }}>Woche duplizieren</button>` : null}
        ${def.weeks.length > 1 ? html`<button class="btn btn-gefahr btn-sm" onClick=${() => setSheet({ art: 'woche-weg' })}>Woche löschen</button>` : null}
        <button class="btn btn-soft btn-sm" onClick=${neuerTag}>＋ Tag</button>
      </div>
      ${w.days.map((d, di) => html`<div class="ed-tag" key=${`${d.offset}-${di}`}>
        <div class="row between"><b>${tagName(d.offset)}</b>
          <span class="row" style="gap:4px">
            <button class="mini-btn" aria-label="Einen Tag früher" disabled=${d.offset === 0 || belegt.has(d.offset - 1)} onClick=${() => verschiebe(di, -1)}>‹</button>
            <button class="mini-btn" aria-label="Einen Tag später" disabled=${belegt.has(d.offset + 1)} onClick=${() => verschiebe(di, 1)}>›</button>
            <button class="mini-btn" aria-label="Tag entfernen" onClick=${() => aendere((n) => { n.weeks[wIndex].days.splice(di, 1); }, true)}>×</button></span></div>
        ${d.items.map((it, ii) => html`<div class="ed-item" key=${`${ii}-${it.exercise_key ?? it.slot?.label}`}>
          <div class="row between" style="align-items:flex-start;gap:8px">
            <button class="ed-name" onClick=${() => setSheet({ art: 'tausch', di, ii })}>${it.exercise_key ? nameVon(it.exercise_key, it.exercise) : `${it.slot?.label ?? it.exercise} (frei)`} <span class="muted">⇄</span></button>
            <span class="row" style="gap:4px;flex:none">
              <button class="mini-btn" aria-label="Nach oben" disabled=${ii === 0} onClick=${() => aendere((n) => { const l = n.weeks[wIndex].days[di].items; [l[ii - 1], l[ii]] = [l[ii], l[ii - 1]]; }, true)}>↑</button>
              <button class="mini-btn" aria-label="Nach unten" disabled=${ii === d.items.length - 1} onClick=${() => aendere((n) => { const l = n.weeks[wIndex].days[di].items; [l[ii + 1], l[ii]] = [l[ii], l[ii + 1]]; }, true)}>↓</button>
              <button class="mini-btn" aria-label="Übung entfernen" onClick=${() => aendere((n) => { n.weeks[wIndex].days[di].items.splice(ii, 1); }, true)}>×</button></span></div>
          <label class="ed-feld"><span>Rolle</span><select value=${it.role ?? ''} onChange=${(e) => aendere((n) => { const v = e.currentTarget.value; const x = n.weeks[wIndex].days[di].items[ii]; if (v) x.role = v; else delete x.role; })}>
            <option value="">–</option>${Object.entries(rollenText).map(([k, t]) => html`<option key=${k} value=${k}>${t}</option>`)}</select></label>
          ${it.groups.map((g, gi) => html`<${Gruppe} key=${gi} g=${g} namen=${formelNamen(def)}
            setze=${(teil) => aendere((n) => { const x = n.weeks[wIndex].days[di].items[ii].groups[gi]; for (const [k, v] of Object.entries(teil)) { if (v == null) delete x[k]; else x[k] = v; } })}
            entfernen=${() => aendere((n) => { n.weeks[wIndex].days[di].items[ii].groups.splice(gi, 1); }, true)}/>`)}
          <button class="link" style="align-self:flex-start" onClick=${() => aendere((n) => { const l = n.weeks[wIndex].days[di].items[ii].groups; l.push({ ...structuredClone(l.at(-1) ?? { sets: '3', reps: '5' }) }); }, true)}>＋ Satzgruppe</button>
        </div>`)}
        <button class="btn btn-soft btn-sm" onClick=${() => setSheet({ art: 'neu', di })}>＋ Übung</button>
      </div>`)}
    </section>
    ${pana.fehler.length ? html`<section class="hint">${I.warn}<span class="t">Pana-Prüfung: ${pana.fehler.length} ${pana.fehler.length === 1 ? 'Warnung' : 'Warnungen'}</span><span></span>
      <ul style="margin:0;padding-left:18px;font-size:13.5px">${pana.fehler.slice(0, 8).map((f) => html`<li key=${f}>${f}</li>`)}</ul></section>` : null}
    <button class="btn btn-chalk btn-block" disabled=${!geaendert || speichert} onClick=${() => (pana.fehler.length ? setSheet({ art: 'speichern' }) : speichern())}>${speichert ? 'Speichert …' : 'Speichern'}</button>
    <span class="muted" style="font-size:12.5px;text-align:center">Last als 84%S, 80%B+2,5 oder 100kg · Wdh 5, 8-12 oder AMRAP · RPE 8, 7-8 oder 2 RIR${def.rules?.generator
      ? ` · Prozent vom echten 1RM, das Trainingsmax (${Math.round(def.rules.generator.tm * 100)} %) ist schon eingerechnet` : ''}</span>

    ${sheet?.art === 'tausch' || sheet?.art === 'neu' ? html`<${Sheet} zu=${() => setSheet(null)} label=${sheet.art === 'neu' ? 'Übung hinzufügen' : 'Übung tauschen'}>
      <h2 class="h2">${sheet.art === 'neu' ? 'Übung hinzufügen' : 'Übung tauschen'}</h2>
      <${UebungSuche} id="ed-suche" onWahl=${(key) => {
        aendere((n) => {
          const items = n.weeks[wIndex].days[sheet.di].items;
          const name = (sprache() === 'en' ? katalogListe().find((e) => e.k === key)?.en : katalogListe().find((e) => e.k === key)?.de) ?? key;
          if (sheet.art === 'neu') items.push({ exercise: name, exercise_key: key, groups: [{ sets: '3', reps: '8', load: null, rpe: 'RPE 8' }] });
          else { const x = items[sheet.ii]; x.exercise_key = key; x.exercise = name; delete x.slot; }
        }, true);
        setSheet(null);
      }}/>
      <p class="muted" style="margin:0;font-size:13px">${sheet.art === 'tausch' ? 'Sätze, Wdh und Last bleiben; bei einer Prozentlast prüfen, ob sie zur neuen Übung passt.' : 'Startet mit 3 × 8 @ RPE 8 – danach anpassen.'}</p>
    <//>` : null}
    ${sheet?.art === 'speichern' ? html`<${Sheet} zu=${() => setSheet(null)} label="Speichern">
      <h2 class="h2">Trotz Pana-Warnungen speichern?</h2>
      <p class="fehler">${pana.fehler.length} ${pana.fehler.length === 1 ? 'Wert liegt' : 'Werte liegen'} außerhalb der Pana-Grenzen (siehe Liste).</p>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setSheet(null)}>Abbrechen</button>
        <button class="btn btn-chalk" style="flex:1" disabled=${speichert} onClick=${speichern}>${speichert ? 'Speichert …' : pana.fehler.length ? 'Trotzdem speichern' : 'Speichern'}</button></div>
    <//>` : null}
    ${sheet?.art === 'verwerfen' ? html`<${Sheet} zu=${() => setSheet(null)} label="Änderungen verwerfen">
      <h2 class="h2">Änderungen verwerfen?</h2>
      <p style="margin:0">Nicht gespeicherte Änderungen gehen verloren.</p>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setSheet(null)}>Weiter bearbeiten</button>
        <button class="btn btn-gefahr" style="flex:1" onClick=${zurueck}>Verwerfen</button></div>
    <//>` : null}
    ${sheet?.art === 'woche-weg' ? html`<${Sheet} zu=${() => setSheet(null)} label="Woche löschen">
      <h2 class="h2">${`Woche ${w.week} löschen?`}</h2>
      <p style="margin:0">${w.alternative_to ? 'Die Alternative verschwindet.' : 'Die folgenden Wochen rücken eine Woche nach vorn.'} ${kurzTitel(w.title)} · ${w.days.length} Tage.</p>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setSheet(null)}>Abbrechen</button>
        <button class="btn btn-gefahr" style="flex:1" onClick=${() => { setDef((d) => loescheWoche(d, wIndex)); setGeaendert(true); setWi(Math.max(0, wIndex - 1)); setStand((s) => s + 1); setSheet(null); }}>Löschen</button></div>
    <//>` : null}
  </div>`;
}
