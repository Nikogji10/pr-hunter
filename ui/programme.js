// PR Hunter · Programme – aktiver Block (Soll-Ist, neue Maxe aus dem Test), Vorlagen und eigene Programme, Detail mit
// Wochenplan, Block starten, Import (KI/CSV oder JSON), Block-Generator, Editor, Kopieren und Teilen.
import { html, useState, fmt, I, Sheet, datumKurz, katalogListe, kopiere, gw, einheit, ZahlFeld } from './basis.js';
import { useRef } from '../vendor/htm-preact.js';
import { KI_ANLEITUNG, leseProgrammCsv, pruefeProgrammJson } from '../js/import.js';
import { pruefePana } from '../js/generator.js';
import { HEUTE, DEMO, DIENSTE, plusTage } from './stand.js';
import { INFO, BEISPIEL_MAXE, MAX_NAME, startMaxe, kurzTitel, blockTage, wochenListe, TagPlan } from './plan.js';
import { GeneratorAnsicht } from './generator.js';
import { Editor } from './editor.js';

export { INFO, NAMEN, blockTage, wochenListe, kurzTitel, TagPlan } from './plan.js';

/** Soll-Ist je Woche des aktiven Blocks: Einheiten, Ø Abweichung vom geplanten Gewicht, Ø RPE gegen Ziel. */
function SollIst({ zeilen }) {
  const mitDaten = zeilen.filter((z) => z.erledigt > 0);
  if (!mitDaten.length) return null;
  const vz = (d) => (d == null ? '–' : `${d > 0 ? '+' : d < 0 ? '−' : '±'}${gw(Math.abs(d), 1)}`);
  return html`<div class="stack" style="gap:6px"><span class="eyebrow">Soll-Ist</span>
    <table class="rec"><thead><tr><th>Woche</th><th>Einheiten</th><th>Δ ${einheit()}</th><th>RPE ist / Ziel</th></tr></thead>
      <tbody>${zeilen.map((z, i) => html`<tr key=${z.woche}><td>${i + 1}</td><td>${z.erledigt}/${z.geplant}</td>
        <td class=${z.abweichungKg > 0 ? 'k' : ''}>${vz(z.abweichungKg)}</td>
        <td>${z.rpeIst != null ? `${fmt(z.rpeIst)} / ${fmt(z.rpeSoll)}` : '–'}</td></tr>`)}</tbody></table>
    <span class="muted" style="font-size:12px">Δ = Ø gemachtes minus geplantes Gewicht je Satz. RPE nur aus Sätzen mit RPE und Ziel.</span></div>`;
}

/** Neue Maxe nach der Projektionsregel des Programms, sobald in der Testwoche Sätze erledigt sind. */
function NeueMaxe({ maxe, planen, vertrauen = null, setVertrauen }) {
  const liste = Object.entries(maxe).filter(([, m]) => m.neuesMax != null || m.projiziert != null);
  if (!liste.length) return null;
  return html`<div class="stack" style="gap:6px"><span class="eyebrow">Neue Maxe aus dem Test</span>
    ${vertrauen != null ? html`<div class="seg" role="group" aria-label="Wiederholungen im Test">
      <button aria-pressed=${String(vertrauen === 1)} onClick=${() => setVertrauen(1)}>Wdh sauber (100 %)</button>
      <button aria-pressed=${String(vertrauen === 0.5)} onClick=${() => setVertrauen(0.5)}>Wdh unsauber (50 %)</button></div>
      <span class="muted" style="font-size:12px">Unsauber: das neue Max geht nur den halben Weg vom alten zum projizierten Wert.</span>` : null}
    <table class="rec"><thead><tr><th>Lift</th><th>Test</th><th>bisher</th><th>neu</th></tr></thead>
      <tbody>${liste.map(([l, m]) => html`<tr key=${l}><td>${MAX_NAME[l]}</td><td class="muted">${gw(m.kg)} × ${m.wdh}</td><td>${gw(m.alt)}</td>
        <td class="k">${m.neuesMax != null ? gw(m.neuesMax) : 'von Hand'}${m.projiziert != null && m.neuesMax !== m.projiziert ? html` <span class="muted">(${gw(m.projiziert)})</span>` : null}</td></tr>`)}</tbody></table>
    <span class="muted" style="font-size:12px">In Klammern der projizierte Wert, wenn die Regel des Programms das neue Max davon abweichen lässt.</span>
    <button class="btn btn-chalk btn-sm" onClick=${planen}>Nächsten Block mit diesen Maxen planen</button></div>`;
}

export function Programme({ programme, info = {}, block, setBlock, erledigt, toast, zuHeute, einst, setEinst, importieren, sollIst = [], neueMaxeFuer = null }) {
  // Vertrauensfaktor der v3-Projektion (rpe10_table): 1,0 bei sauberen Wdh, 0,5 bei unsauberen
  const [vertrauen, setVertrauen] = useState(1);
  const mitVertrauen = programme[block?.datei]?.rules?.projection?.method === 'rpe10_table';
  const neueMaxe = neueMaxeFuer?.(mitVertrauen ? vertrauen : null) ?? {};
  // { art: 'detail' | 'import' | 'generator' | 'editor', datei, werte, start, ausTest, vorgabe }
  const [ansicht, setAnsicht] = useState(null);
  const [beenden, setBeenden] = useState(false);
  const zurListe = () => setAnsicht(null);
  const speichernNeu = async (p, { bearbeiten = false, werte = null, start = null, ...herkunft } = {}) => {
    try {
      const d = await importieren(p, herkunft);
      setAnsicht({ art: bearbeiten ? 'editor' : 'detail', datei: d, werte, start });
      toast({ titel: 'Programm gespeichert', text: p.name });
    } catch (e) { toast({ titel: 'Nicht gespeichert', text: e.message }); }
  };
  if (ansicht?.art === 'import') return html`<${Import} zurueck=${zurListe} speichern=${(p) => speichernNeu(p, { quelle: 'import' })}/>`;
  if (ansicht?.art === 'generator') return html`<${GeneratorAnsicht} zurueck=${zurListe} einst=${einst} speichern=${speichernNeu} vorlagen=${programme} vorgabe=${ansicht.vorgabe}/>`;
  if (ansicht?.art === 'editor' && programme[ansicht.datei]) return html`<${Editor} key=${ansicht.datei} datei=${ansicht.datei} programm=${programme[ansicht.datei]}
    start=${block?.datei === ansicht.datei ? block.start : null}
    zurueck=${() => setAnsicht({ art: 'detail', datei: ansicht.datei })} toast=${toast}/>`;
  if (ansicht?.art === 'detail' && programme[ansicht.datei]) return html`<${Detail} key=${ansicht.datei} datei=${ansicht.datei} prog=${programme[ansicht.datei]} vorgabe=${ansicht.werte}
    ausTest=${!!ansicht.ausTest} startVorschlag=${ansicht.start} block=${block} einst=${einst} setEinst=${setEinst} toast=${toast} zurueck=${zurListe}
    neueVersion=${block?.datei === ansicht.datei && info[ansicht.datei]?.version != null && block.version != null && info[ansicht.datei].version !== block.version ? info[ansicht.datei].version : null}
    umstellen=${(v) => { setBlock({ ...block, version: v }); toast({ titel: `Block auf Version ${v} umgestellt`, text: 'Gilt ab der nächsten Einheit; erledigte Trainings bleiben, wie sie waren.' }); }}
    bearbeiten=${(d) => setAnsicht({ art: 'editor', datei: d })} kopieBearbeiten=${(p) => speichernNeu(p, { bearbeiten: true, quelle: 'kopie', datei: ansicht.datei })}
    zumGenerator=${(vorgabe) => setAnsicht({ art: 'generator', vorgabe })}
    starten=${(b) => { setBlock(b); setAnsicht(null); toast({ titel: 'Block gestartet', text: `${INFO[b.datei].kurz} ab ${datumKurz(b.start)}` }); zuHeute(); }}/>`;
  const aktivTage = block ? blockTage(programme[block.datei], { ...block, cut: einst.cut }) : [];
  const wochen = wochenListe(aktivTage);
  const eigene = Object.keys(programme).filter((d) => d.startsWith('prog:') || d.startsWith('import:'));
  const vorlagen = Object.keys(programme).filter((d) => !eigene.includes(d));
  const karte = (datei) => {
    const p = programme[datei];
    let tage = [], w = [];
    try { tage = blockTage(p, { werte: { ...BEISPIEL_MAXE, ...Object.fromEntries((p.inputs ?? []).map((k) => [k, BEISPIEL_MAXE[k] ?? 100])) } }); w = wochenListe(tage); } catch { /* unvollständiges Programm */ }
    return html`<button key=${datei} class="card prog" onClick=${() => setAnsicht({ art: 'detail', datei })}>
      <div class="row between" style="align-items:flex-start"><h2 class="h2">${INFO[datei].kurz}</h2>${block?.datei === datei ? html`<span class="tag top">Aktiv</span>` : null}</div>
      <p class="muted" style="margin:0;font-size:14px">${INFO[datei].text}</p>
      <div class="prog-meta"><div><b>${w.length}</b><span>Wochen</span></div><div><b>${tage.length}</b><span>Einheiten</span></div>
        <div><b>${w.length ? fmt(tage.length / w.length, 1) : '–'}</b><span>pro Woche</span></div><div><b>${(p.inputs ?? []).join(' ') || '–'}</b><span>Maxe</span></div></div>
      <div class="row wrap" style="gap:6px">${INFO[datei].tags.map((t) => html`<span key=${t} class="tag">${t}</span>`)}${INFO[datei].importiert ? null : html`<span class="tag gold">✓ gegen Excel geprüft</span>`}</div>
    </button>`;
  };
  return html`<div class="screen">
    <header class="topbar"><div><div class="eyebrow">Blöcke und Vorlagen</div><h1 class="h1">Programme</h1></div>${DEMO ? html`<span class="proto">Demo</span>` : null}</header>
    ${block ? html`<section class="card pad stack aktiv">
      <div class="row between"><span class="eyebrow">Aktiver Block</span><span class="tag">${einst.cut ? 'Cut-Modus' : 'Normal'}</span></div>
      <h2 class="h2" style="font-size:26px">${INFO[block.datei].kurz}</h2>
      <div class="prog-meta">
        <div><b>${wochen.length}</b><span>Wochen</span></div>
        <div><b>${aktivTage.length}</b><span>Einheiten</span></div>
        <div><b>${aktivTage.filter((t) => erledigt.has(t.datum)).length}</b><span>erledigt</span></div>
        <div><b>${aktivTage.length ? datumKurz(aktivTage.at(-1).datum) : '–'}</b><span>Ende</span></div>
      </div>
      <div class="row wrap" style="gap:6px">${Object.entries(block.werte).map(([k, v]) => html`<span key=${k} class="chip" style="cursor:default">${MAX_NAME[k]} <b>${gw(v)}</b></span>`)}</div>
      <${SollIst} zeilen=${sollIst}/>
      <${NeueMaxe} maxe=${neueMaxe} vertrauen=${mitVertrauen ? vertrauen : null} setVertrauen=${setVertrauen} planen=${() => setAnsicht({ art: 'detail', datei: block.datei, ausTest: true,
        werte: { ...block.werte, ...Object.fromEntries(Object.entries(neueMaxe).filter(([, m]) => m.neuesMax != null).map(([l, m]) => [l, m.neuesMax])) },
        start: aktivTage.length ? plusTage(aktivTage.at(-1).datum, 3) : HEUTE })}/>
      <div class="row"><button class="btn btn-chalk btn-sm" style="flex:1" onClick=${() => setAnsicht({ art: 'detail', datei: block.datei })}>Plan ansehen</button>
        <button class="btn btn-soft btn-sm" onClick=${() => setBeenden(true)}>Block beenden</button></div>
    </section>` : html`<section class="card pad"><p style="margin:0">Kein aktiver Block. Wähle unten eine Vorlage und starte sie mit deinen Maxen – oder lass dir mit dem Generator einen Block bis zu einem Termin bauen.</p></section>`}
    <div class="row wrap" style="gap:8px">
      <button class="btn btn-soft btn-sm" style="flex:1" onClick=${() => setAnsicht({ art: 'generator' })}>${I.programme} Block-Generator</button>
      <button class="btn btn-soft btn-sm" style="flex:1" onClick=${() => setAnsicht({ art: 'import' })}>${I.import} Importieren</button>
    </div>
    ${eigene.length ? html`<span class="eyebrow" style="margin-top:6px">Eigene Programme</span>${eigene.map(karte)}` : null}
    <span class="eyebrow" style="margin-top:6px">Vorlagen</span>
    ${vorlagen.map(karte)}
    ${beenden ? html`<${Sheet} zu=${() => setBeenden(false)} label="Block beenden">
      <h2 class="h2">Block beenden?</h2>
      <p style="margin:0">Erledigte Trainings bleiben im Verlauf. Der Plan verschwindet aus „Heute“, bis du einen neuen Block startest.</p>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setBeenden(false)}>Abbrechen</button>
        <button class="btn btn-chalk" style="flex:1" onClick=${() => { setBlock(null); setBeenden(false); toast({ titel: 'Block beendet', text: 'Starte eine Vorlage, wenn es weitergeht.' }); }}>Beenden</button></div>
    <//>` : null}
  </div>`;
}

function Detail({ datei, prog, vorgabe, ausTest, startVorschlag, block, einst, setEinst, toast, zurueck, starten, bearbeiten, kopieBearbeiten, zumGenerator, neueVersion = null, umstellen }) {
  const aktiv = block?.datei === datei;
  const eigen = datei.startsWith('prog:') || datei.startsWith('import:');
  const [start, setStart] = useState(aktiv && !vorgabe ? block.start : startVorschlag ?? HEUTE);
  const [werte, setWerte] = useState(() => {
    const s = startMaxe();
    return Object.fromEntries(prog.inputs.map((k) => [k, vorgabe?.[k] ?? (aktiv ? block.werte[k] : null) ?? s[k] ?? null]));
  });
  const [alternativ, setAlternativ] = useState(aktiv ? block.alternativ : false);
  const [sheet, setSheet] = useState(null);                 // 'ersetzen' | 'umbenennen' | 'archivieren'
  const [name, setName] = useState(INFO[datei].kurz);
  const cut = einst.cut;
  const neuStarten = !aktiv || !!vorgabe;
  const alt = prog.weeks.find((w) => w.alternative_to);
  const vollstaendig = prog.inputs.every((k) => werte[k] > 0) && start;
  let tage = [], planFehler = null;
  try { tage = vollstaendig ? blockTage(prog, { start, werte, cut, alternativ }) : []; } catch (e) { planFehler = e.message; }
  const titel = Object.fromEntries(prog.weeks.map((w) => [w.week, kurzTitel(w.title)]));
  const regel = prog.rules?.projection;
  const pana = pruefePana(prog);
  const los = () => starten({ datei, start, werte, alternativ, neu: neuStarten });
  const json = () => JSON.stringify({ ...prog, name: INFO[datei].kurz }, null, 2);
  const teilen = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: `PR Hunter: ${INFO[datei].kurz}`, text: json() }); return; }
    } catch { /* abgebrochen oder nicht erlaubt: kopieren */ }
    toast((await kopiere(json())) ? { titel: 'Kopiert', text: 'Programm als JSON in der Zwischenablage.' } : { titel: 'Kopieren gesperrt', text: 'Bitte „Als JSON kopieren“ nutzen.' });
  };
  return html`<div class="screen">
    <header class="topbar">
      <button class="iconbtn" onClick=${zurueck} aria-label="Zurück zu den Programmen">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">${aktiv && !vorgabe ? 'Aktiver Block' : eigen ? 'Eigenes Programm' : 'Vorlage'}</div><h1 class="h1" style="font-size:26px">${INFO[datei].kurz}</h1></div>
    </header>
    <p class="muted" style="margin:0">${INFO[datei].text}</p>
    ${neueVersion != null && !vorgabe ? html`<section class="card pad stack">
      <span class="viz-t">Neue Version der Vorlage</span>
      <p style="margin:0;font-size:14px">Dein Block läuft mit Version ${block.version}, aktuell ist Version ${neueVersion}. Umstellen ändert die Gewichte ab der nächsten Einheit; erledigte Trainings bleiben unverändert.</p>
      <button class="btn btn-soft btn-sm" onClick=${() => umstellen(neueVersion)}>Auf Version ${neueVersion} umstellen</button>
    </section>` : null}
    ${ausTest ? html`<section class="hint">${I.warn}<span class="t">Neue Maxe übernommen</span><span></span><p>Aus dem Test des letzten Blocks vorgeschlagen. Vor dem Start prüfen; der aktive Block wird dabei beendet.</p></section>` : null}
    <section class="card pad stack">
      <div class="eyebrow">Einrichten</div>
      <label class="field" for="p-start"><span class="label">Startdatum</span><input id="p-start" type="date" value=${start} onInput=${(e) => setStart(e.currentTarget.value)}/></label>
      <div class=${prog.inputs.length === 3 ? 'fields drei' : 'fields'}>${prog.inputs.map((k) => html`<${ZahlFeld} key=${k} id=${`p-${k}`} label=${`${MAX_NAME[k] ?? k} (${einheit()})`} kg=${true}
        wert=${werte[k]} setze=${(v) => setWerte((w) => ({ ...w, [k]: v }))}/>`)}</div>
      <label class="schalter" for="p-cut"><span><b>Cut-Modus</b> <span class="muted" style="font-size:12px">(gilt für alle Programme)</span><br/>
        <span class="muted" style="font-size:13px">Ein Satz weniger bei Back-offs, Varianten und Zubehör. Top-Sätze, Tests und Wettkampf-Hauptsätze bleiben.</span></span>
        <input type="checkbox" id="p-cut" checked=${cut} onChange=${(e) => setEinst({ ...einst, cut: e.currentTarget.checked })}/></label>
      ${alt ? html`<div class="stack" style="gap:8px"><span class="eyebrow">Woche ${alt.alternative_to}</span>
        <div class="seg" role="group" aria-label="Variante Woche 6"><button aria-pressed=${String(!alternativ)} onClick=${() => setAlternativ(false)}>Deload</button>
          <button aria-pressed=${String(alternativ)} onClick=${() => setAlternativ(true)}>Taper + Testtag</button></div></div>` : null}
      ${prog.params ? html`<span class="muted" style="font-size:13px">Trainingsmax ${fmt(prog.params.TM_BULK * 100)} % (Cut ${fmt(prog.params.TM_CUT * 100)} %), zuerst gerundet ·
        Pause-Kniebeuge × ${fmt(prog.params.VF)} · Test ${fmt(prog.params.TEST * 100, 1)} % vom echten 1RM · ändern unter „Bearbeiten“ bzw. „Kopie bearbeiten“</span>` : null}
      ${regel?.source || regel?.formula ? html`<details><summary class="link" style="cursor:pointer">Wie das neue Max nach dem Test berechnet wird</summary>
        <p class="muted" style="margin:6px 0 0;font-size:13px">${regel.method === 'rpe10_table'
          ? 'Projiziert = Testgewicht ÷ %1RM aus der RPE-10-Tabelle (96/92/89/86/84/81 % für 2–7 Wdh), auf die Steigerung gerundet. Unter 2 Wdh bleibt das alte Max; sonst altes Max + (projiziert − alt) × Vertrauen (1,0 bei sauberen, 0,5 bei unsauberen Wdh). Keine Obergrenze.'
          : `${regel.source}${regel.note ? ` ${regel.note}` : ''}`}</p>
        ${prog.rules?.projection_bench ? html`<p class="muted" style="margin:6px 0 0;font-size:13px">Bankdrücken (aus dem AMRAP in Woche ${prog.rules.projection_bench.week}): ${prog.rules.projection_bench.source}</p>` : null}</details>` : null}
    </section>
    ${pana.fehler.length ? html`<section class="hint">${I.warn}<span class="t">${pana.fehler.length} ${pana.fehler.length === 1 ? 'Wert' : 'Werte'} außerhalb der Pana-Grenzen</span><span></span>
      <ul style="margin:0;padding-left:18px;font-size:13.5px">${pana.fehler.slice(0, 8).map((f) => html`<li key=${f}>${f}</li>`)}</ul></section>` : null}
    <section class="card pad">
      <div class="row between" style="margin-bottom:4px"><span class="eyebrow">Wochenplan</span><span class="muted" style="font-size:13px">${tage.length} Einheiten</span></div>
      ${planFehler ? html`<p class="fehler">${planFehler}</p>` : vollstaendig ? wochenListe(tage).map((w, i) => {
        const wt = tage.filter((t) => t.woche === w);
        return html`<details key=${w} class="woche" open=${i === 0}>
          <summary><span><b>Woche ${i + 1}</b> <span class="muted">· ${titel[w]}</span></span><span class="muted" style="font-size:13px">${datumKurz(wt[0].datum)} – ${datumKurz(wt.at(-1).datum)}</span></summary>
          ${wt.map((t) => html`<${TagPlan} key=${t.datum + t.offset} tag=${t}/>`)}
        </details>`;
      }) : html`<p class="muted" style="margin:0">Startdatum und alle Maxe eintragen, dann erscheinen die Gewichte.</p>`}
    </section>
    <button class="btn btn-chalk btn-block" disabled=${!vollstaendig || !!planFehler} onClick=${() => (block && neuStarten ? setSheet('ersetzen') : los())}>${neuStarten ? 'Block starten' : 'Änderungen übernehmen'}</button>
    <section class="card pad stack">
      <span class="viz-t">Programm</span>
      <div class="row wrap" style="gap:8px">
        ${eigen ? html`<button class="btn btn-soft btn-sm" onClick=${() => bearbeiten(datei)}>Bearbeiten</button>
          <button class="btn btn-soft btn-sm" onClick=${() => setSheet('umbenennen')}>Umbenennen</button>`
          : html`<button class="btn btn-soft btn-sm" onClick=${() => kopieBearbeiten({ ...prog, name: `${INFO[datei].kurz} (eigene Fassung)` })}>Kopie bearbeiten</button>`}
        <button class="btn btn-soft btn-sm" onClick=${async () => toast((await kopiere(json())) ? { titel: 'Kopiert', text: 'Programm als JSON in der Zwischenablage – z. B. für Claude.' } : { titel: 'Kopieren gesperrt', text: 'Der Browser erlaubt es hier nicht.' })}>Als JSON kopieren</button>
        <button class="btn btn-soft btn-sm" onClick=${teilen}>Teilen</button>
        ${prog.rules?.generator ? html`<button class="btn btn-soft btn-sm" onClick=${() => zumGenerator(prog.rules.generator)}>Im Generator ändern</button>` : null}
        ${eigen && !aktiv ? html`<button class="btn btn-soft btn-sm" onClick=${() => setSheet('archivieren')}>Archivieren</button>` : null}
      </div>
      <span class="muted" style="font-size:12.5px">Teilen schickt das Programm als JSON (z. B. an den Kumpel); er importiert es und rechnet mit seinen eigenen Maxen.</span>
    </section>
    ${sheet === 'ersetzen' ? html`<${Sheet} zu=${() => setSheet(null)} label="Block ersetzen">
      <h2 class="h2">Aktiven Block ersetzen?</h2>
      <p style="margin:0">${INFO[block.datei].kurz} wird beendet. Erledigte Trainings bleiben im Verlauf.</p>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setSheet(null)}>Abbrechen</button><button class="btn btn-chalk" style="flex:1" onClick=${los}>Ersetzen</button></div>
    <//>` : null}
    ${sheet === 'umbenennen' ? html`<${Sheet} zu=${() => setSheet(null)} label="Umbenennen">
      <h2 class="h2">Umbenennen</h2>
      <label class="field" for="p-name"><span class="label">Name</span><input id="p-name" class="text" type="text" value=${name} onInput=${(e) => setName(e.currentTarget.value)}/></label>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setSheet(null)}>Abbrechen</button>
        <button class="btn btn-chalk" style="flex:1" disabled=${!name.trim()} onClick=${async () => { try { await DIENSTE.programmUmbenennen?.(datei, name.trim()); setSheet(null); toast({ titel: 'Umbenannt', text: name.trim() }); } catch (e) { toast({ titel: 'Nicht umbenannt', text: e.message }); } }}>Speichern</button></div>
    <//>` : null}
    ${sheet === 'archivieren' ? html`<${Sheet} zu=${() => setSheet(null)} label="Archivieren">
      <h2 class="h2">Programm archivieren?</h2>
      <p style="margin:0">Es verschwindet aus der Liste. Alte Blöcke und Trainings bleiben unverändert.</p>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setSheet(null)}>Abbrechen</button>
        <button class="btn btn-chalk" style="flex:1" onClick=${async () => { try { await DIENSTE.programmArchivieren?.(datei); zurueck(); toast({ titel: 'Archiviert', text: INFO[datei].kurz }); } catch (e) { toast({ titel: 'Nicht archiviert', text: e.message }); } }}>Archivieren</button></div>
    <//>` : null}
  </div>`;
}

const BEISPIEL_CSV = KI_ANLEITUNG.split('Beispiel:\n')[1].split('\n\nHier ist')[0];

/** Programm importieren: per KI als CSV (Anleitung kopieren, Antwort einfügen) oder direkt als JSON im App-Format. */
function Import({ zurueck, speichern }) {
  const [art, setArt] = useState('csv');
  const [text, setText] = useState('');
  const [ergebnis, setErgebnis] = useState(null);
  const [kopiert, setKopiert] = useState(null);
  const anleitung = useRef(null);
  const pruefe = () => setErgebnis(art === 'csv' ? leseProgrammCsv(text, katalogListe()) : { ...pruefeProgrammJson(text, katalogListe()), zeilen: null });
  const p = ergebnis?.programm;
  let tage = [];
  try { tage = p ? blockTage(p, { start: HEUTE, werte: { ...BEISPIEL_MAXE } }) : []; } catch { tage = []; }
  return html`<div class="screen">
    <header class="topbar">
      <button class="iconbtn" onClick=${zurueck} aria-label="Zurück zu den Programmen">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">Neues Programm</div><h1 class="h1" style="font-size:26px">Importieren</h1></div>
    </header>
    <div class="seg" role="group" aria-label="Format"><button aria-pressed=${String(art === 'csv')} onClick=${() => { setArt('csv'); setErgebnis(null); }}>Per KI (CSV)</button>
      <button aria-pressed=${String(art === 'json')} onClick=${() => { setArt('json'); setErgebnis(null); }}>JSON</button></div>
    ${art === 'csv' ? html`<section class="card pad stack">
      <span class="viz-t">1 · Anleitung für die KI kopieren</span>
      <p class="muted" style="margin:0;font-size:14px">In ChatGPT, Claude oder eine andere KI einfügen und darunter dein Programm anhängen: Text, Tabelle oder Foto der Excel. Die KI antwortet mit einer CSV im passenden Format.</p>
      <button class="btn btn-chalk btn-block" onClick=${async () => setKopiert(await kopiere(KI_ANLEITUNG, anleitung.current))}>${I.kopieren} Anleitung kopieren</button>
      ${kopiert === true ? html`<span class="muted" style="font-size:13px">Kopiert. Jetzt in der KI einfügen.</span>`
        : kopiert === false ? html`<span class="muted" style="font-size:13px">Kopieren ist hier gesperrt: Der Text unten ist markiert, mit Strg+C bzw. „Kopieren“ übernehmen.</span>` : null}
      <span class="eyebrow">Die Anleitung</span>
      <textarea ref=${anleitung} id="ki-anleitung" class="code" readonly rows="6" aria-label="Anleitung für die KI" value=${KI_ANLEITUNG}></textarea>
    </section>` : html`<section class="card pad stack">
      <span class="viz-t">Programm im App-Format</span>
      <p class="muted" style="margin:0;font-size:14px">Das Format von „Als JSON kopieren“ – geteilt vom Kumpel oder von Claude geschrieben bzw. geändert. Übungen über ihren Schlüssel aus dem Katalog, Lasten als Formeln wie R(S*0.84).</p>
    </section>`}
    <section class="card pad stack">
      <span class="viz-t">${art === 'csv' ? '2 · Antwort der KI einfügen' : 'JSON einfügen'}</span>
      <label for="import-feld" class="muted" style="font-size:13px">${art === 'csv' ? 'Die CSV aus der Antwort (mit oder ohne Codeblock).' : 'Das JSON (mit oder ohne Codeblock).'}</label>
      <textarea id="import-feld" class="code" rows="9" placeholder=${art === 'csv' ? 'woche;tag;uebung;rolle;saetze;wdh;last;rpe;cut;notiz' : '{ "name": "…", "weeks": [ … ] }'} value=${text}
        onInput=${(e) => { setText(e.currentTarget.value); setErgebnis(null); }}></textarea>
      <div class="row">${art === 'csv' ? html`<button class="btn btn-soft" style="flex:1" onClick=${() => { setText(BEISPIEL_CSV); setErgebnis(null); }}>Beispiel einsetzen</button>` : null}
        <button class="btn btn-chalk" style="flex:1" disabled=${!text.trim()} onClick=${pruefe}>Prüfen</button></div>
    </section>
    ${ergebnis?.fehler.length ? html`<section class="hint">${I.warn}<span class="t">${ergebnis.fehler.length} ${ergebnis.fehler.length === 1 ? 'Problem' : 'Probleme'} – nichts importiert</span><span></span>
      <ul style="margin:0;padding-left:18px">${ergebnis.fehler.slice(0, 12).map((f) => html`<li key=${f}>${f}</li>`)}</ul></section>` : null}
    ${p ? html`<section class="card pad stack">
      <span class="viz-t">Vorschau</span>
      <h2 class="h2">${p.name}</h2>
      <div class="prog-meta"><div><b>${wochenListe(tage).length}</b><span>Wochen</span></div><div><b>${tage.length}</b><span>Einheiten</span></div>
        <div><b>${ergebnis.zeilen ?? p.weeks.length}</b><span>${ergebnis.zeilen ? 'Zeilen' : 'Wochen im JSON'}</span></div><div><b>${p.inputs.join(' ') || '–'}</b><span>Maxe</span></div></div>
      <span class="muted" style="font-size:13px">Gewichte mit Beispiel-Maxen gerechnet; beim Starten trägst du deine ein.</span>
      ${tage.filter((t) => t.woche === tage[0]?.woche).map((t) => html`<${TagPlan} key=${t.datum + t.offset} tag=${t}/>`)}
      <button class="btn btn-chalk btn-block" onClick=${() => speichern(p)}>Als eigenes Programm speichern</button>
    </section>` : null}
  </div>`;
}
