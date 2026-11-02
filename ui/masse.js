// PR Hunter · Körpermaße (Wunsch 182): Umfänge in cm und Körperfett je Messtag, als Kacheln mit Veränderung und Mini-Verlauf
// in Statistik → Körper; Eintragen im Fenster (vorbefüllt mit den letzten Werten). Server: body_metrics.measurements (jsonb)
// und body_fat_pct – keine Fotos (würden nur die Datenbank vergrößern, Niko 02.11.).
import { html, useState, Sheet, fmt, datumKurz, deEn } from './basis.js';
import { heuteLokal } from './stand.js';

export const MASSE = [['brust', 'Brust', 'Chest'], ['taille', 'Taille', 'Waist'], ['huefte', 'Hüfte', 'Hips'], ['arm', 'Oberarm', 'Upper arm'],
  ['oberschenkel', 'Oberschenkel', 'Thigh'], ['wade', 'Wade', 'Calf'], ['schultern', 'Schultern', 'Shoulders'], ['hals', 'Hals', 'Neck'], ['kfa', 'Körperfett', 'Body fat']];
const einheitVon = (k) => (k === 'kfa' ? '%' : 'cm');

/** Verlauf je Maß: [{ datum, wert }] aufsteigend. */
export function verlaufVon(masse, k) {
  return masse.filter((m) => m.werte?.[k] != null).map((m) => ({ datum: m.datum, wert: Number(m.werte[k]) })).sort((a, b) => a.datum.localeCompare(b.datum));
}

function Linie({ punkte }) {
  if (punkte.length < 2) return null;
  const w = punkte.map((p) => p.wert), min = Math.min(...w), max = Math.max(...w), span = max - min || 1;
  const pfad = w.map((v, i) => `${i ? 'L' : 'M'}${(i / (w.length - 1)) * 100} ${26 - ((v - min) / span) * 22}`).join(' ');
  return html`<svg class="masse-linie" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d=${pfad}/></svg>`;
}

export function MasseKarte({ masse = [], setzen = null }) {
  const [offen, setOffen] = useState(false);
  const mitWert = MASSE.filter(([k]) => verlaufVon(masse, k).length);
  return html`<section class="card pad stack">
    <div class="row between"><div><span class="viz-t">Körpermaße</span><div class="muted" style="font-size:12.5px">Umfänge in cm, Körperfett in %</div></div>
      ${setzen ? html`<button class="btn btn-soft btn-sm" onClick=${() => setOffen(true)}>+ Eintragen</button>` : null}</div>
    ${mitWert.length ? html`<div class="masse-kacheln">${mitWert.map(([k, de, en]) => {
      const v = verlaufVon(masse, k), letzt = v.at(-1), erst = v[0], d = letzt.wert - erst.wert;
      return html`<div key=${k} class="masse-kachel"><span class="muted">${deEn(de, en)}</span>
        <b>${fmt(letzt.wert, 1)}<small>${einheitVon(k)}</small></b>
        ${v.length > 1 ? html`<span class=${`masse-diff ${d > 0 ? 'auf' : d < 0 ? 'ab' : ''}`}>${`${d > 0 ? '+' : d < 0 ? '−' : '±'}${fmt(Math.abs(d), 1)} ${deEn(`seit ${datumKurz(erst.datum)}`, `since ${datumKurz(erst.datum)}`)}`}</span>`
          : html`<span class="muted masse-diff">${datumKurz(letzt.datum)}</span>`}
        <${Linie} punkte=${v}/></div>`; })}</div>`
      : html`<p class="muted" style="margin:0;font-size:13.5px">Noch keine Maße. Einmal im Monat messen (morgens, gleiche Stelle) zeigt gut, wo sich etwas tut.</p>`}
    ${offen ? html`<${MasseSheet} masse=${masse} zu=${() => setOffen(false)} speichern=${(datum, werte) => { setzen(datum, werte); setOffen(false); }}/>` : null}
  </section>`;
}

function MasseSheet({ masse, zu, speichern }) {
  const [datum, setDatum] = useState(heuteLokal());
  const letzte = Object.fromEntries(MASSE.map(([k]) => [k, verlaufVon(masse, k).at(-1)?.wert ?? null]));
  const [werte, setWerte] = useState(() => Object.fromEntries(MASSE.map(([k]) => [k, ''])));
  const zahlen = Object.fromEntries(Object.entries(werte).map(([k, v]) => [k, Number(String(v).replace(',', '.'))]).filter(([, v]) => v > 0 && v < 400));
  return html`<${Sheet} zu=${zu} label="Körpermaße eintragen">
    <h2 class="h2">Körpermaße eintragen</h2>
    <label class="field" for="masse-datum"><span class="label">Datum</span><input id="masse-datum" class="text" type="date" value=${datum} max=${heuteLokal()} onInput=${(e) => setDatum(e.currentTarget.value)}/></label>
    <div class="masse-felder">${MASSE.map(([k, de, en]) => html`<label key=${k} class="field" for=${`masse-${k}`}><span class="label">${`${deEn(de, en)} (${einheitVon(k)})`}</span>
      <input id=${`masse-${k}`} class="text" type="text" inputmode="decimal" placeholder=${letzte[k] != null ? fmt(letzte[k], 1) : '–'} value=${werte[k]}
        onInput=${(e) => { const v = e.currentTarget.value; setWerte((w) => ({ ...w, [k]: v })); }}/></label>`)}</div>
    <span class="muted" style="font-size:12.5px">Grau = letzter Wert. Nur ausfüllen, was du gemessen hast – leere Felder bleiben, wie sie waren.</span>
    <button class="btn btn-chalk btn-block" disabled=${!Object.keys(zahlen).length || !datum} onClick=${() => speichern(datum, zahlen)}>Speichern</button>
  <//>`;
}
