// PR Hunter · Wettkampf-Ergebnisse (Wunsch 213, nur Powerlifting, ausblendbar): je Meet Name, Datum, Klasse, Körpergewicht,
// Platz und die neun Versuche (gültig/ungültig) → bester Versuch je Lift, Total, DOTS; Verlauf des Totals über die Meets.
// Gespeichert in den App-Einstellungen des Kontos (einst.wettkaempfe).
import { html, useState, fmt, deEn, datumKurz, Sheet, I, ZahlFeld } from './basis.js';
import { HEUTE } from './stand.js';
import { dots } from '../js/punkte.js';

const LIFTE = [['squat', 'Kniebeuge', 'KB'], ['bench', 'Bankdrücken', 'BD'], ['dead', 'Kreuzheben', 'KH']];
export const besterVersuch = (v) => Math.max(0, ...(v ?? []).filter(([kg, ok]) => ok && kg > 0).map(([kg]) => kg));
export const totalVon = (w) => (LIFTE.every(([l]) => besterVersuch(w.versuche?.[l]) > 0) ? LIFTE.reduce((s, [l]) => s + besterVersuch(w.versuche[l]), 0) : null);
const leer = () => ({ id: `m-${Date.now()}`, name: '', datum: HEUTE, klasse: null, koerper: null, platz: null, versuche: Object.fromEntries(LIFTE.map(([l]) => [l, [[null, true], [null, true], [null, true]]])) });

export function WettkaempfeKarte({ einst, setEinst }) {
  const [offen, setOffen] = useState(null);                       // null | Entwurf
  const liste = [...(einst.wettkaempfe ?? [])].sort((a, b) => b.datum.localeCompare(a.datum));
  const g = einst.geschlecht === 'w' ? 'w' : 'm';
  const speichern = (w) => { setEinst({ ...einst, wettkaempfe: [...(einst.wettkaempfe ?? []).filter((x) => x.id !== w.id), w] }); setOffen(null); };
  const loeschen = (id) => { setEinst({ ...einst, wettkaempfe: (einst.wettkaempfe ?? []).filter((x) => x.id !== id) }); setOffen(null); };
  const totale = [...liste].reverse().map((w) => totalVon(w)).filter(Boolean), maxT = Math.max(1, ...totale);
  return html`<section class="card pad stack">
    <div class="row between"><div><span class="viz-t">${deEn('Meine Wettkämpfe', 'My meets')}</span><div class="viz-u">${deEn('Total, Versuche und DOTS je Meet', 'Total, attempts and DOTS per meet')}</div></div>
      <button class="btn btn-soft btn-sm" onClick=${() => setOffen(leer())}>${deEn('+ Eintragen', '+ Add')}</button></div>
    ${totale.length > 1 ? html`<div class="meet-verlauf" aria-label=${deEn('Total je Wettkampf', 'Total per meet')}>${totale.map((t, i) => html`<i key=${i} style=${`height:${Math.max(12, (t / maxT) * 100)}%`} title=${`${fmt(t)} kg`}></i>`)}</div>` : null}
    ${!liste.length ? html`<p class="muted" style="margin:0;font-size:13.5px">${deEn('Noch kein Wettkampf eingetragen. Nach dem Meet die neun Versuche eintragen – Total, DOTS und Verlauf rechnet die App.', 'No meet yet. Enter your nine attempts after the meet – the app works out total, DOTS and progress.')}</p>` : null}
    ${liste.map((w) => { const t = totalVon(w), d = t && w.koerper ? dots(t, w.koerper, g) : null;
      return html`<button key=${w.id} class="meet-zeile" onClick=${() => setOffen(structuredClone(w))}>
        <div class="meet-kopf"><b>${w.name || deEn('Wettkampf', 'Meet')}</b><span class="muted">${`${datumKurz(w.datum)}${w.datum.slice(2, 4)}${w.klasse ? ` · ${fmt(w.klasse)} kg` : ''}${w.platz ? ` · ${w.platz}. ${deEn('Platz', 'place')}` : ''}`}</span></div>
        <div class="meet-werte">${LIFTE.map(([l, , k]) => html`<span key=${l}><small>${k}</small>${besterVersuch(w.versuche?.[l]) ? fmt(besterVersuch(w.versuche[l])) : '–'}</span>`)}
          <span class="meet-total"><small>Total</small>${t ? fmt(t) : '–'}</span>${d ? html`<span><small>DOTS</small>${fmt(d, 1)}</span>` : null}</div>
        <div class="meet-versuche">${LIFTE.map(([l]) => html`<span key=${l}>${(w.versuche?.[l] ?? []).map(([kg, ok], i) => html`<i key=${i} class=${!kg ? 'leer' : ok ? 'gut' : 'ungueltig'}></i>`)}</span>`)}</div>
      </button>`; })}
    ${offen ? html`<${MeetSheet} w=${offen} zu=${() => setOffen(null)} speichern=${speichern} loeschen=${(einst.wettkaempfe ?? []).some((x) => x.id === offen.id) ? loeschen : null}/>` : null}
  </section>`;
}

/** Eintragen/Bearbeiten – auch vom Wettkampftag-Werkzeug aus vorbefüllt. */
export function MeetSheet({ w: start, zu, speichern, loeschen = null }) {
  const [w, setW] = useState(start);
  const versuch = (l, i, teil, wert) => setW({ ...w, versuche: { ...w.versuche, [l]: w.versuche[l].map((v, j) => (j === i ? (teil === 0 ? [wert, v[1]] : [v[0], wert]) : v)) } });
  const t = totalVon(w);
  return html`<${Sheet} zu=${zu} label=${deEn('Wettkampf eintragen', 'Add meet')}>
    <h2 class="h2">${deEn('Wettkampf', 'Meet')}</h2>
    <label class="field" for="meet-name"><span class="label">${deEn('Name', 'Name')}</span><input id="meet-name" class="text" type="text" placeholder=${deEn('z. B. Bayerische Meisterschaft', 'e.g. State championship')} value=${w.name} onInput=${(e) => setW({ ...w, name: e.currentTarget.value })}/></label>
    <div class="fields"><label class="field" for="meet-datum"><span class="label">${deEn('Datum', 'Date')}</span><input id="meet-datum" class="text" type="date" value=${w.datum} onInput=${(e) => setW({ ...w, datum: e.currentTarget.value })}/></label>
      <${ZahlFeld} id="meet-platz" label=${deEn('Platz', 'Place')} wert=${w.platz} setze=${(x) => setW({ ...w, platz: x > 0 ? Math.round(x) : null })}/></div>
    <div class="fields"><${ZahlFeld} id="meet-klasse" label=${deEn('Klasse (kg)', 'Class (kg)')} wert=${w.klasse} setze=${(x) => setW({ ...w, klasse: x > 0 ? x : null })}/>
      <${ZahlFeld} id="meet-kg" label=${deEn('Körpergewicht (kg)', 'Bodyweight (kg)')} wert=${w.koerper} setze=${(x) => setW({ ...w, koerper: x > 0 ? x : null })}/></div>
    ${LIFTE.map(([l, n]) => html`<div key=${l} class="stack" style="gap:6px"><span class="eyebrow">${n}</span>
      <div class="meet-eingabe">${w.versuche[l].map(([kg, ok], i) => html`<div key=${i} class=${`meet-versuch ${ok ? 'gut' : 'ungueltig'}`}>
        <${ZahlFeld} id=${`meet-${l}-${i}`} label=${`${i + 1}.`} wert=${kg} setze=${(x) => versuch(l, i, 0, x > 0 ? x : null)}/>
        <button class="chip" onClick=${() => versuch(l, i, 1, !ok)}>${ok ? deEn('✓ gültig', '✓ good') : deEn('✗ ungültig', '✗ no lift')}</button></div>`)}</div></div>`)}
    <div class="meet-summe"><span>Total</span><b>${t ? `${fmt(t)} kg` : '–'}</b></div>
    <div class="row" style="gap:8px">${loeschen ? html`<button class="btn btn-gefahr" onClick=${() => loeschen(w.id)}>${I.papierkorb}</button>` : null}
      <button class="btn btn-chalk" style="flex:1" onClick=${() => speichern(w)}>${deEn('Speichern', 'Save')}</button></div>
  <//>`;
}
