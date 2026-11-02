// PR Hunter · Trainingsverlauf aus anderen Apps importieren (Wunsch 166): 1. in der alten App exportieren,
// 2. Datei direkt hochladen (Strong, Hevy, eigenes CSV) oder per KI-Befehl ins PR-Hunter-Format bringen, 3. prüfen:
// unbekannte Übungen Schritt für Schritt zuordnen (gemerkt), Duplikate (gleiches Datum + Übung + Sätze) überspringen,
// Vorschau „x neu, y schon vorhanden“, dann speichern.
import { html, useState, useRef, I, kopiere, katalogListe, nameVon, datumKurz, speicher } from './basis.js';
import { KI_ANLEITUNG_TRAININGS, leseTrainingsCsv, ohneDuplikate } from '../js/import.js';
import { UebungenZuordnen, ladeZuordnung, merkeZuordnung } from './programme.js';

export const IMPORT_HINWEIS_WEG = 'prh-import-hinweis';
export const importHinweisOffen = () => speicher.lies(IMPORT_HINWEIS_WEG) !== '1';

export function TrainingsImport({ zurueck, vorhandene, importieren }) {
  const [text, setText] = useState('');
  const [ergebnis, setErgebnis] = useState(null);
  const [kopiert, setKopiert] = useState(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState(null);
  const anleitung = useRef(null);
  const pruefe = (zu = ladeZuordnung(), t = text) => setErgebnis(leseTrainingsCsv(t, katalogListe(), zu));
  if (ergebnis?.unbekannt?.length) {
    return html`<${UebungenZuordnen} liste=${ergebnis.unbekannt} platz=${false} abbrechen=${() => setErgebnis(null)}
      fertig=${(wahl) => { const zu = { ...ladeZuordnung(), ...wahl }; merkeZuordnung(zu); pruefe(zu); }}/>`;
  }
  const geprueft = ergebnis && !ergebnis.fehler.length ? ohneDuplikate(ergebnis.trainings, vorhandene) : null;
  const saetze = geprueft ? geprueft.neu.reduce((a, t) => a + t.uebungen.reduce((b, u) => b + u.saetze.length, 0), 0) : 0;
  const datei = async (f) => { if (!f) return; const t = await f.text(); setText(t); pruefe(ladeZuordnung(), t); };
  const los = async () => {
    setLaeuft(true);
    try { await importieren(geprueft.neu); setFertig({ trainings: geprueft.neu.length, saetze }); setErgebnis(null); setText(''); }
    finally { setLaeuft(false); }
  };
  return html`<div class="screen">
    <header class="topbar unter">
      <button class="iconbtn" onClick=${zurueck} aria-label="Zurück">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">Aus einer anderen App</div><h1 class="h1" style="font-size:26px">Trainings importieren</h1></div>
    </header>
    ${fertig ? html`<section class="hint immer gut">${I.check}<span class="t">${`${fertig.trainings} Trainings importiert`}</span><span></span>
      <p>${`${fertig.saetze} Sätze sind jetzt im Verlauf und in der Statistik. Sie werden mit dem Konto abgeglichen.`}</p></section>` : null}
    <section class="card pad stack">
      <span class="viz-t">1 · In der alten App exportieren</span>
      <p class="muted" style="margin:0;font-size:14px">JEFIT, Strong, Hevy, Fitbod & Co. bieten in den Einstellungen einen Export als CSV- oder Textdatei. JEFIT-, Strong- und Hevy-Dateien gehen direkt, alles andere über die KI.</p>
    </section>
    <section class="card pad stack">
      <span class="viz-t">2 · Datei hochladen oder per KI umwandeln</span>
      <label class="btn btn-chalk btn-block datei-knopf">${I.import} Datei wählen (CSV)<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange=${(e) => datei(e.currentTarget.files?.[0])}/></label>
      <details class="ki-weg"><summary>Andere App oder Excel? Mit KI-Befehl umwandeln</summary>
        <p class="muted" style="margin:6px 0;font-size:13.5px">Befehl kopieren, in ChatGPT, Claude o. Ä. einfügen, die Exportdatei bzw. den Inhalt anhängen. Die Antwort (CSV) unten einfügen.</p>
        <button class="btn btn-soft btn-block" onClick=${async () => setKopiert(await kopiere(KI_ANLEITUNG_TRAININGS, anleitung.current))}>${I.kopieren} KI-Befehl kopieren</button>
        ${kopiert === true ? html`<span class="muted" style="font-size:13px">Kopiert.</span>` : null}
        <textarea ref=${anleitung} class="code" readonly rows="5" aria-label="KI-Befehl" value=${KI_ANLEITUNG_TRAININGS}></textarea>
      </details>
      <label for="ti-feld" class="muted" style="font-size:13px">Oder den Inhalt hier einfügen:</label>
      <textarea id="ti-feld" class="code" rows="7" placeholder="datum;uebung;kg;wdh;rpe;notiz" value=${text} onInput=${(e) => { setText(e.currentTarget.value); setErgebnis(null); setFertig(null); }}></textarea>
      <button class="btn btn-chalk btn-block" disabled=${!text.trim()} onClick=${() => pruefe()}>Prüfen</button>
    </section>
    ${ergebnis?.fehler.length ? html`<section class="hint">${I.warn}<span class="t">${`${ergebnis.fehler.length} ${ergebnis.fehler.length === 1 ? 'Problem' : 'Probleme'} – nichts importiert`}</span><span></span>
      <ul style="margin:0;padding-left:18px">${ergebnis.fehler.slice(0, 12).map((f) => html`<li key=${f}>${f}</li>`)}</ul></section>` : null}
    ${geprueft ? html`<section class="card pad stack">
      <span class="viz-t">3 · Vorschau</span>
      <div class="prog-meta"><div><b>${geprueft.neu.length}</b><span>Trainings neu</span></div><div><b>${saetze}</b><span>Sätze</span></div><div><b>${geprueft.doppelt}</b><span>schon vorhanden</span></div></div>
      ${geprueft.neu.length ? html`<span class="muted" style="font-size:13px">${`${datumKurz(geprueft.neu[0].datum)}${geprueft.neu[0].datum.slice(0, 4)} bis ${datumKurz(geprueft.neu.at(-1).datum)}${geprueft.neu.at(-1).datum.slice(0, 4)}`}</span>
        <div class="ti-vorschau">${geprueft.neu.slice(-3).reverse().map((t) => html`<div key=${t.datum}><b>${datumKurz(t.datum)}</b><span>${t.uebungen.map((u) => `${nameVon(u.key)} ${u.saetze.length}×`).join(' · ')}</span></div>`)}</div>
        <button class="btn btn-go btn-block" disabled=${laeuft} onClick=${los}>${laeuft ? 'Speichert …' : `${geprueft.neu.length} Trainings importieren`}</button>`
        : html`<p class="muted" style="margin:0">Alles schon vorhanden – nichts zu importieren.</p>`}
    </section>` : null}
  </div>`;
}

/** Hinweis auf „Heute“ für neue Konten ohne Trainings (166). */
export function ImportHinweis({ oeffnen }) {
  const [weg, setWeg] = useState(false);
  if (weg) return null;
  return html`<section class="card pad stack import-hinweis">
    <div class="row between"><b>Schon Trainings in einer anderen App?</b><button class="iconbtn klein" aria-label="Hinweis ausblenden" onClick=${() => { speicher.schreib(IMPORT_HINWEIS_WEG, '1'); setWeg(true); }}>${I.zu}</button></div>
    <span class="muted" style="font-size:13px">JEFIT, Strong, Hevy & Co.: Verlauf exportieren und hier importieren – deine Rekorde und Statistik sind sofort da.</span>
    <button class="btn btn-soft btn-block" onClick=${oeffnen}>${I.import} Trainings importieren</button>
  </section>`;
}
