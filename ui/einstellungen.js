// PR Hunter · Einstellungen: Pausen, Cut, Körpergewicht, Einheit und Geräte, Rechnen, Design, Sprache, Daten, Konto.
// Alles gilt für alle Programme; gespeichert im Profil (Supabase), lokal zuerst.
import { html, useState, fmt, mmss, I, Sheet, inKg, inAnzeige, einheit, datumKurz } from './basis.js';
import { DEMO } from './stand.js';
import { KG_PRO_LB, STANDARD_SCHEIBEN } from '../js/rechnen.js';

const KG_SCHEIBEN = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5, 0.25];
const LB_SCHEIBEN = [55, 45, 35, 25, 10, 5, 2.5, 1.25];
export const LB_STANDARD = [45, 35, 25, 10, 5, 2.5];
const kgVonLb = (lb) => Math.round(lb * KG_PRO_LB * 100) / 100;      // wie in der DB gespeichert (numeric 5,2)
const gleich = (a, b) => Math.abs(a - b) < 0.02;

/** Neue Einheit: Stange, Steigerung und Scheiben auf die üblichen Werte der Einheit setzen. */
export function aufEinheit(e, einheitNeu) {
  if (e.einheit === einheitNeu) return e;
  return einheitNeu === 'lb'
    ? { ...e, einheit: 'lb', inc: 5, stange: kgVonLb(45), scheiben: LB_STANDARD.map(kgVonLb) }
    : { ...e, einheit: 'kg', inc: 2.5, stange: 20, scheiben: [...STANDARD_SCHEIBEN] };
}

function Seg({ werte, wert, setze, label }) {
  return html`<div class="seg" role="group" aria-label=${label}>${werte.map(([k, t]) => html`<button key=${k} aria-pressed=${String(wert === k)} onClick=${() => setze(k)}>${t}</button>`)}</div>`;
}

export function Einstellungen({ einst, setEinst, zurueck, konto: k, sync, offen, abgleich, abmelden: raus, exportieren, neuAnmelden, SyncPunkt, kontoLoeschen }) {
  const [loeschen, setLoeschen] = useState(null);         // null | { text, laeuft, fehler }
  const [kgText, setKgText] = useState(einst.koerpergewicht ? String(inAnzeige(einst.koerpergewicht)).replace('.', ',') : '');
  const [stangeText, setStangeText] = useState(String(inAnzeige(einst.stange)).replace('.', ','));
  const [name, setName] = useState(einst.name ?? '');
  const aendere = (art, d) => setEinst({ ...einst, pausen: { ...einst.pausen, [art]: Math.max(15, Math.min(900, einst.pausen[art] + d)) } });
  const zahl = (t) => { const n = Number(String(t).replace(',', '.')); return t.trim() && Number.isFinite(n) ? n : null; };
  const lb = einst.einheit === 'lb';
  const auswahl = lb ? LB_SCHEIBEN.map((w) => [kgVonLb(w), w]) : KG_SCHEIBEN.map((w) => [w, w]);
  const hat = (kg) => einst.scheiben.some((s) => gleich(s, kg));
  const scheibe = (kg) => setEinst({ ...einst, scheiben: hat(kg) ? einst.scheiben.filter((s) => !gleich(s, kg)) : [...einst.scheiben, kg].sort((a, b) => b - a) });
  const steigerungen = lb ? [[2.5, '2,5 lb'], [5, '5 lb'], [10, '10 lb']] : [[1, '1 kg'], [1.25, '1,25 kg'], [2.5, '2,5 kg'], [5, '5 kg']];
  return html`<div class="screen">
    <header class="topbar">
      <button class="iconbtn" onClick=${zurueck} aria-label="Zurück">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">Gilt für alle Programme</div><h1 class="h1" style="font-size:clamp(22px, 7vw, 30px)">Einstellungen</h1></div>
    </header>
    <section class="card pad stack">
      <span class="viz-t">Standard-Pausen</span>
      <p class="muted" style="margin:0;font-size:13.5px">Der Timer startet nach jedem abgehakten Satz mit der Pause dieser Satzart. Eigene Pausen je Übung gehen vor (Übungsseite → Für mich anpassen).</p>
      ${[['top', 'Top-Sätze und Tests'], ['backoff', 'Back-offs und Arbeitssätze'], ['isolation', 'Isolationsübungen']].map(([art, text]) => html`<div key=${art} class="pause-zeile">
        <span>${text}</span>
        <div class="row" style="gap:8px"><button class="mini" onClick=${() => aendere(art, -15)} aria-label=${`${text}: 15 Sekunden weniger`}>−15</button>
          <b class="zahl tab-num" style="font-size:24px;min-width:52px;text-align:center">${mmss(einst.pausen[art])}</b>
          <button class="mini" onClick=${() => aendere(art, 15)} aria-label=${`${text}: 15 Sekunden mehr`}>+15</button></div></div>`)}
    </section>
    <section class="card pad stack">
      <label class="schalter" style="border-top:0;padding-top:0" for="e-cut"><span><b>Cut-Modus</b><br/>
        <span class="muted" style="font-size:13px">Ein Satz weniger bei Back-offs, Varianten und Zubehör (mind. 1). Top-Sätze, Tests und Wettkampf-Hauptsätze bleiben. Vorlagen mit eigenen Cut-Regeln (Hybrid) nutzen diese.</span></span>
        <input type="checkbox" id="e-cut" checked=${einst.cut} onChange=${(e) => setEinst({ ...einst, cut: e.currentTarget.checked })}/></label>
      <label class="schalter" for="e-bereit"><span><b>Readiness-Check</b><br/>
        <span class="muted" style="font-size:13px">Vor jedem Training vier kurze Fragen (Schlaf, Stress, Muskelkater, Energie). Bei schlechten Werten schlägt die App 5 % weniger Gewicht vor.</span></span>
        <input type="checkbox" id="e-bereit" checked=${einst.bereitschaft !== false} onChange=${(e) => setEinst({ ...einst, bereitschaft: e.currentTarget.checked })}/></label>
      <label class="field" for="e-kg"><span class="label">Körpergewicht heute (${einheit()})</span>
        <input id="e-kg" type="text" inputmode="decimal" value=${kgText} onInput=${(e) => setKgText(e.currentTarget.value)}
          onChange=${() => { const v = zahl(kgText); const kg = v != null ? inKg(v) : null; if (kg >= 30 && kg <= 250) setEinst({ ...einst, koerpergewicht: kg }); }}/></label>
      <span class="muted" style="font-size:12.5px">Für Klimmzüge und Dips (Gesamtlast), DOTS und das Kraftprofil. Wird mit Datum gespeichert; den Verlauf zeigt die Statistik.</span>
    </section>
    <section class="card pad stack">
      <span class="viz-t">Einheit und Geräte</span>
      <${Seg} label="Einheit" werte=${[['kg', 'kg'], ['lb', 'lb']]} wert=${einst.einheit} setze=${(v) => {
        const neu = aufEinheit(einst, v);
        // Textfelder in der NEUEN Einheit füllen (die Anzeige stellt erst beim nächsten Zeichnen um)
        const anzeigen = (kg) => String(Math.round((v === 'lb' ? kg / KG_PRO_LB : kg) * 10) / 10).replace('.', ',');
        setEinst(neu); setStangeText(anzeigen(neu.stange));
        if (einst.koerpergewicht) setKgText(anzeigen(einst.koerpergewicht));
      }}/>
      <div class="stack" style="gap:6px"><span class="eyebrow">Kleinste Steigerung</span>
        <div class="row wrap" style="gap:6px">${steigerungen.map(([v, t]) => html`<button key=${v} class="chip" aria-pressed=${String(einst.inc === v)} onClick=${() => setEinst({ ...einst, inc: v })}>${t}</button>`)}</div>
        <span class="muted" style="font-size:12.5px">Programmgewichte werden darauf gerundet.</span></div>
      <label class="field" for="e-stange"><span class="label">Stange (${einheit()})</span>
        <input id="e-stange" type="text" inputmode="decimal" value=${stangeText} onInput=${(e) => setStangeText(e.currentTarget.value)}
          onChange=${() => { const v = zahl(stangeText); if (v > 0 && v < 100) setEinst({ ...einst, stange: Math.round(inKg(v) * 100) / 100 }); }}/></label>
      <div class="stack" style="gap:6px"><span class="eyebrow">Vorhandene Scheiben (je Paar)</span>
        <div class="row wrap" style="gap:6px">${auswahl.map(([kg, anzeige]) => html`<button key=${kg} class="chip" aria-pressed=${String(hat(kg))} onClick=${() => scheibe(kg)}>${fmt(anzeige)}</button>`)}</div>
        <span class="muted" style="font-size:12.5px">Für Scheibenrechner, Aufwärmen und das Hantelbild.</span></div>
    </section>
    <section class="card pad stack">
      <span class="viz-t">Rechnen</span>
      <div class="stack" style="gap:6px"><span class="eyebrow">e1RM-Formel</span>
        <${Seg} label="e1RM-Formel" werte=${[['rpe', 'RPE (RTS)'], ['epley', 'Epley'], ['brzycki', 'Brzycki']]} wert=${einst.formel} setze=${(v) => setEinst({ ...einst, formel: v })}/>
        <span class="muted" style="font-size:12.5px">${einst.formel === 'rpe' ? 'Mit RPE über die Tabelle nach Tuchscherer, ohne RPE nach Epley.' : 'Ohne RPE-Tabelle; ein angegebenes RPE zählt als Wiederholungen in Reserve.'}</span></div>
    </section>
    <section class="card pad stack">
      <span class="viz-t">Anzeige</span>
      <div class="stack" style="gap:6px"><span class="eyebrow">Design</span>
        <${Seg} label="Design" werte=${[['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']]} wert=${einst.thema ?? 'system'} setze=${(v) => setEinst({ ...einst, thema: v })}/></div>
      <div class="stack" style="gap:6px"><span class="eyebrow">Sprache</span>
        <${Seg} label="Sprache" werte=${[['de', 'Deutsch'], ['en', 'English']]} wert=${einst.sprache ?? 'de'} setze=${(v) => setEinst({ ...einst, sprache: v })}/></div>
      ${!DEMO ? html`<label class="field" for="e-name"><span class="label">Anzeigename</span>
        <input id="e-name" class="text" type="text" value=${name} onInput=${(e) => setName(e.currentTarget.value)} onChange=${() => setEinst({ ...einst, name: name.trim() || null })}/></label>` : null}
    </section>
    ${DEMO ? html`<section class="card pad stack"><span class="viz-t">Demo</span>
        <p style="margin:0;font-size:14px">Alles hier sind Beispieldaten, nichts wird gespeichert.</p>
        <a class="btn btn-chalk btn-block" href="./">Zur Anmeldung</a></section>`
      : html`<section class="card pad stack">
        <span class="viz-t">Daten</span>
        <div class="row between"><span>Abgleich</span><${SyncPunkt} sync=${sync} offen=${offen}/></div>
        ${sync.zuletzt ? html`<span class="muted" style="font-size:13px">Zuletzt ${new Date(sync.zuletzt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span>` : null}
        ${sync.fehler ? html`<ul class="fehler" style="padding-left:18px">${sync.fehler.slice(0, 5).map((f, i) => html`<li key=${i}>${f.datum ? `${datumKurz(f.datum)}: ` : ''}${f.meldung}</li>`)}</ul>` : null}
        <button class="btn btn-soft btn-block" disabled=${sync.laeuft} onClick=${abgleich}>Jetzt abgleichen</button>
        <p style="margin:0;font-size:14px">Jede Nacht sichert ein GitHub-Job alle Tabellen als CSV in ein privates Repository.</p>
        <button class="btn btn-soft btn-block" onClick=${exportieren}>Alle Sätze als CSV (Excel)</button>
      </section>
      <section class="card pad stack">
        <span class="viz-t">Konto</span>
        <div class="row between"><span class="muted">Angemeldet als</span><b style="overflow-wrap:anywhere">${k?.email ?? '–'}</b></div>
        <label class="schalter" for="e-vergleich"><span><b>Mit dem Kumpel vergleichen</b><br/>
          <span class="muted" style="font-size:13px">Zeigt deine e1RM in Kniebeuge, Bankdrücken und Kreuzheben und dein Körpergewicht – nur, wenn ihr beide einschaltet. Keine Trainings, keine Sätze. Der Anzeigename oben ist dein Name im Vergleich.</span></span>
          <input type="checkbox" id="e-vergleich" checked=${!!einst.vergleich} onChange=${(e) => setEinst({ ...einst, vergleich: e.currentTarget.checked })}/></label>
        <button class="btn btn-soft btn-block" onClick=${raus}>Abmelden</button>
        <span class="muted" style="font-size:12.5px">Beim Abmelden werden die Daten auf diesem Handy gelöscht. Auf dem Server bleibt alles.</span>
        ${sync.fehler ? html`<button class="link" style="justify-self:start" onClick=${neuAnmelden}>Neu anmelden, Daten auf dem Handy behalten</button>` : null}
        ${kontoLoeschen ? html`<button class="link" style="justify-self:start;color:var(--warn)" onClick=${() => setLoeschen({ text: '' })}>Konto löschen …</button>` : null}
      </section>`}
    ${loeschen ? html`<${Sheet} zu=${() => !loeschen.laeuft && setLoeschen(null)} label="Konto löschen">
      <h2 class="h2">Konto löschen</h2>
      <p style="margin:0">Löscht dein Konto mit allen Trainings, Sätzen, Blöcken, eigenen Programmen, Körperwerten und Anpassungen – auf dem Server und auf diesem Handy. Das lässt sich nicht rückgängig machen.</p>
      <p class="muted" style="margin:0;font-size:13.5px">Vorher sichern? „Alle Sätze als CSV“ oben. Selbst angelegte Übungen bleiben im gemeinsamen Katalog.</p>
      <label class="field" for="e-loeschen"><span class="label">Zur Bestätigung LÖSCHEN eintippen</span>
        <input id="e-loeschen" class="text" type="text" autocomplete="off" value=${loeschen.text} onInput=${(e) => setLoeschen({ ...loeschen, text: e.currentTarget.value })}/></label>
      ${loeschen.fehler ? html`<p class="fehler">${loeschen.fehler}</p>` : null}
      <div class="row"><button class="btn btn-soft" style="flex:1" disabled=${loeschen.laeuft} onClick=${() => setLoeschen(null)}>Abbrechen</button>
        <button class="btn btn-chalk" style="flex:1" disabled=${loeschen.laeuft || loeschen.text.trim().toUpperCase() !== 'LÖSCHEN'}
          onClick=${async () => { setLoeschen({ ...loeschen, laeuft: true, fehler: null }); try { await kontoLoeschen(); } catch (e) { setLoeschen({ ...loeschen, laeuft: false, fehler: e.message }); } }}>
          ${loeschen.laeuft ? 'Löscht …' : 'Endgültig löschen'}</button></div>
    <//>` : null}
  </div>`;
}
