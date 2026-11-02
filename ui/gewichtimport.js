// PR Hunter · Körpergewicht aus anderen Apps (Yazio, Samsung Health, Apple Health, Waage, Excel): Datei wählen oder per
// KI-Befehl umwandeln (geht auch mit Screenshots), prüfen, Vorschau „x neu, y schon vorhanden“, übernehmen.
// Tage, die schon einen Wert haben, bleiben – außer „abweichende überschreiben“ ist an.
import { html, useState, useRef, I, kopiere, datumKurz, gw, einheit, sprache } from './basis.js';
import { KI_ANLEITUNG_GEWICHT, KI_ANLEITUNG_GEWICHT_EN, leseGewichtCsv, gewichtAbgleich } from '../js/import.js';

export function GewichtImport({ zurueck, vorhandene = [], importieren }) {
  const [text, setText] = useState('');
  const [ergebnis, setErgebnis] = useState(null);
  const [ueberschreiben, setUeberschreiben] = useState(false);
  const [kopiert, setKopiert] = useState(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState(null);
  const anleitung = useRef(null);
  const befehl = sprache() === 'en' ? KI_ANLEITUNG_GEWICHT_EN : KI_ANLEITUNG_GEWICHT;
  const pruefe = (t = text) => setErgebnis(leseGewichtCsv(t));
  const ab = ergebnis && !ergebnis.fehler.length ? gewichtAbgleich(ergebnis.werte, vorhandene, ueberschreiben) : null;
  const datei = async (f) => { if (!f) return; const t = await f.text(); setText(t); pruefe(t); setFertig(null); };
  const jahr = (d) => `${datumKurz(d)}${d.slice(0, 4)}`;
  const los = async () => {
    setLaeuft(true);
    try { await importieren(ab.uebernehmen); setFertig(ab.uebernehmen.length); setErgebnis(null); setText(''); }
    finally { setLaeuft(false); }
  };
  return html`<div class="screen">
    <header class="topbar unter">
      <button class="iconbtn" onClick=${zurueck} aria-label="Zurück">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">Körpergewicht</div><h1 class="h1" style="font-size:26px">Gewichtsdaten hinzufügen</h1></div>
    </header>
    ${fertig != null ? html`<section class="hint immer gut">${I.check}<span class="t">${`${fertig} ${fertig === 1 ? 'Wert' : 'Werte'} übernommen`}</span><span></span>
      <p>Sie stehen jetzt in der Statistik unter Körper und werden mit dem Konto abgeglichen.</p></section>` : null}
    <section class="card pad stack">
      <span class="viz-t">1 · Daten besorgen</span>
      <p class="muted" style="margin:0;font-size:14px">Aus Yazio, Samsung Health, Apple Health, einer Waagen-App oder Excel: die Exportdatei – oder einfach Screenshots der Gewichtsliste (z. B. Yazio → Gewicht → Wöchentlich oder Täglich).</p>
    </section>
    <section class="card pad stack">
      <span class="viz-t">2 · Per KI umwandeln oder Datei wählen</span>
      <p class="muted" style="margin:0;font-size:13.5px">Befehl kopieren, in ChatGPT, Claude o. Ä. einfügen und die Screenshots oder die Datei anhängen. Die Antwort (CSV) unten einfügen.</p>
      <button class="btn btn-chalk btn-block" onClick=${async () => setKopiert(await kopiere(befehl, anleitung.current))}>${I.kopieren} KI-Befehl kopieren</button>
      ${kopiert === true ? html`<span class="muted" style="font-size:13px">Kopiert.</span>` : null}
      <details class="ki-weg"><summary>Befehl ansehen</summary>
        <textarea ref=${anleitung} class="code" readonly rows="6" aria-label="KI-Befehl" value=${befehl}></textarea></details>
      <label class="btn btn-soft btn-block datei-knopf">${I.import} Datei wählen (CSV)<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange=${(e) => datei(e.currentTarget.files?.[0])}/></label>
      <label for="gi-feld" class="muted" style="font-size:13px">Oder die Antwort hier einfügen:</label>
      <textarea id="gi-feld" class="code" rows="6" placeholder="datum;kg" value=${text} onInput=${(e) => { setText(e.currentTarget.value); setErgebnis(null); setFertig(null); }}></textarea>
      <button class="btn btn-chalk btn-block" disabled=${!text.trim()} onClick=${() => pruefe()}>Prüfen</button>
    </section>
    ${ergebnis?.fehler.length ? html`<section class="hint">${I.warn}<span class="t">${`${ergebnis.fehler.length} ${ergebnis.fehler.length === 1 ? 'Problem' : 'Probleme'} – nichts übernommen`}</span><span></span>
      <ul style="margin:0;padding-left:18px">${ergebnis.fehler.slice(0, 12).map((f) => html`<li key=${f}>${f}</li>`)}</ul></section>` : null}
    ${ab ? html`<section class="card pad stack">
      <span class="viz-t">3 · Vorschau</span>
      <div class="prog-meta"><div><b>${ab.neu.length}</b><span>Tage neu</span></div><div><b>${ab.gleich}</b><span>schon vorhanden</span></div><div><b>${ab.anders.length}</b><span>abweichend</span></div></div>
      <span class="muted" style="font-size:13px">${`${jahr(ergebnis.werte[0].datum)} bis ${jahr(ergebnis.werte.at(-1).datum)}`}</span>
      ${ab.anders.length ? html`<label class="row" style="gap:10px;font-size:14px"><input type="checkbox" checked=${ueberschreiben} onChange=${(e) => setUeberschreiben(e.currentTarget.checked)}/>
        <span>${`Abweichende Tage überschreiben (${ab.anders.length})`}</span></label>` : null}
      ${ab.uebernehmen.length ? html`<div class="ti-vorschau">${ab.uebernehmen.slice(-4).reverse().map((w) => html`<div key=${w.datum}><b>${jahr(w.datum)}</b><span>${`${gw(w.kg, 1)} ${einheit()}`}</span></div>`)}</div>
        <button class="btn btn-go btn-block" disabled=${laeuft} onClick=${los}>${laeuft ? 'Speichert …' : `${ab.uebernehmen.length} ${ab.uebernehmen.length === 1 ? 'Wert' : 'Werte'} übernehmen`}</button>`
        : html`<p class="muted" style="margin:0">Alles schon vorhanden – nichts zu übernehmen.</p>`}
    </section>` : null}
  </div>`;
}
