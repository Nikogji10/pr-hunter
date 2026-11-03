// PR Hunter · Beschwerden melden (Wunsch 216): Region, Stärke, Dauer → Vorschau der betroffenen Übungen im Plan →
// Frage, ob der Plan angepasst werden soll (ersetzen / nur leichter / nur notieren). Hinweis auf „Heute“, solange aktiv.
import { html, useState, Sheet, deEn, sprache, datumKurz, nameVon, uebung } from './basis.js';
import { HEUTE, plusTage } from './stand.js';
import { REGIONEN, STUFEN, betroffene, aktiveBeschwerden } from '../js/beschwerden.js';

const regionName = (k) => { const r = REGIONEN.find(([id]) => id === k); return r ? (sprache() === 'en' ? r[2] : r[1]) : k; };

/** planKeys(bis) → Übungen der geplanten Tage bis zu diesem Datum. */
export function BeschwerdeSheet({ planKeys, speichern, zu }) {
  const [region, setRegion] = useState(null);
  const [stufe, setStufe] = useState('mittel');
  const [wochen, setWochen] = useState(2);
  const [schritt, setSchritt] = useState(1);
  const bis = plusTage(HEUTE, wochen * 7 - 1);
  const treffer = region ? betroffene(planKeys(bis), region, uebung) : [];
  const fertig = (modus) => { speichern({ id: `b-${Date.now()}`, region, stufe, modus, von: HEUTE, bis }); zu(); };
  return html`<${Sheet} zu=${zu} label=${deEn('Beschwerden melden', 'Report discomfort')}>
    <h2 class="h2">🩹 ${deEn('Beschwerden melden', 'Report discomfort')}</h2>
    ${schritt === 1 ? html`
      <span class="eyebrow">${deEn('Wo?', 'Where?')}</span>
      <div class="chips-zeile" style="flex-wrap:wrap">${REGIONEN.map(([k]) => html`<button key=${k} class="chip" aria-pressed=${String(region === k)} onClick=${() => setRegion(k)}>${regionName(k)}</button>`)}</div>
      <span class="eyebrow">${deEn('Wie stark?', 'How bad?')}</span>
      <div class="seg">${STUFEN.map(([k, de, en]) => html`<button key=${k} aria-pressed=${String(stufe === k)} onClick=${() => { setStufe(k); setWochen(k === 'stark' ? 4 : k === 'leicht' ? 1 : 2); }}>${deEn(de, en)}</button>`)}</div>
      <span class="eyebrow">${deEn('Wie lange schonen?', 'Protect for how long?')}</span>
      <div class="seg">${[1, 2, 4].map((w) => html`<button key=${w} aria-pressed=${String(wochen === w)} onClick=${() => setWochen(w)}>${deEn(`${w} ${w === 1 ? 'Woche' : 'Wochen'}`, `${w} ${w === 1 ? 'week' : 'weeks'}`)}</button>`)}</div>
      ${stufe === 'stark' ? html`<p class="muted" style="margin:0;font-size:12.5px">${deEn('Bei starken oder anhaltenden Schmerzen bitte ärztlich abklären lassen.', 'With severe or lasting pain, please see a doctor.')}</p>` : null}
      <button class="btn btn-chalk btn-block" disabled=${!region} onClick=${() => setSchritt(2)}>${deEn('Weiter', 'Next')}</button>`
    : html`
      <p style="margin:0">${deEn(`${regionName(region)} bis ${datumKurz(bis)} schonen.`, `Protect ${regionName(region).toLowerCase()} until ${datumKurz(bis)}.`)}</p>
      ${treffer.length ? html`<div class="stack" style="gap:6px"><span class="eyebrow">${deEn('Betroffen in deinem Plan', 'Affected in your plan')}</span>
        ${treffer.map((t) => html`<div key=${t.key} class="beschwerde-zeile"><span>${nameVon(t.key)}</span><span class="muted">→</span><b>${t.ersatz ? nameVon(t.ersatz) : deEn('leichter (−20 %)', 'lighter (−20 %)')}</b></div>`)}</div>
        <b>${deEn('Soll der Plan angepasst werden?', 'Should the plan be adjusted?')}</b>
        <button class="btn btn-chalk btn-block" onClick=${() => fertig('tauschen')}>${deEn('Ja – Übungen ersetzen', 'Yes – replace exercises')}</button>
        <button class="btn btn-soft btn-block" onClick=${() => fertig('leichter')}>${deEn('Nur leichter (−20 %)', 'Only lighter (−20 %)')}</button>
        <button class="btn btn-soft btn-block" onClick=${() => fertig('notieren')}>${deEn('Nein, nur notieren', 'No, just note it')}</button>`
      : html`<p class="muted" style="margin:0;font-size:13.5px">${deEn('In den geplanten Trainings ist keine Übung betroffen. Die Beschwerde wird notiert.', 'No exercise in your planned workouts is affected. The discomfort is noted.')}</p>
        <button class="btn btn-chalk btn-block" onClick=${() => fertig('notieren')}>${deEn('Notieren', 'Note it')}</button>`}
      <button class="link" style="justify-self:start" onClick=${() => setSchritt(1)}>${deEn('Zurück', 'Back')}</button>`}
  <//>`;
}

/** Hinweis auf „Heute“, solange eine Beschwerde aktiv ist. */
export function BeschwerdeHinweis({ liste, erledigt }) {
  const a = aktiveBeschwerden(liste, HEUTE);
  if (!a.length) return null;
  return html`<section class="card beschwerde-hinweis">${a.map((b) => html`<div key=${b.id} class="row between" style="gap:8px">
    <span>🩹 <b>${regionName(b.region)}</b> <span class="muted">${b.modus === 'tauschen' ? deEn(`· Übungen ersetzt bis ${datumKurz(b.bis)}`, `· exercises replaced until ${datumKurz(b.bis)}`)
      : b.modus === 'leichter' ? deEn(`· −20 % bis ${datumKurz(b.bis)}`, `· −20 % until ${datumKurz(b.bis)}`) : deEn(`· notiert bis ${datumKurz(b.bis)}`, `· noted until ${datumKurz(b.bis)}`)}</span></span>
    <button class="btn btn-soft btn-sm" onClick=${() => erledigt(b.id)}>${deEn('Wieder gut', 'Feeling fine')}</button></div>`)}</section>`;
}
