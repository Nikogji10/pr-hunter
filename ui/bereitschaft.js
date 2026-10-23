// PR Hunter · Readiness-Check vor dem Training (Funktionskatalog „Readiness-Check“): Schlaf, Stress, Muskelkater,
// Energie je 1–5. Bei schlechten Werten schlägt die App vor, die Gewichte 5 % zu senken. Gespeichert am Training.
import { html, useState, fmt, I, Sheet } from './basis.js';
import { BEREITSCHAFT, bereitschaftsWert, bereitschaftsHinweis } from '../js/auswertung.js';

export function BereitschaftSheet({ los, zu, leichter: leichterVorher = false, mitLeichter = true }) {
  const [r, setR] = useState({});
  const [leichter, setLeichter] = useState(leichterVorher);
  const [angepasst, setAngepasst] = useState(false);      // eigene Wahl beim Schalter geht vor den Vorschlag
  const wert = bereitschaftsWert(r);
  const hinweis = bereitschaftsHinweis(wert);
  const leichterJetzt = angepasst ? leichter : leichterVorher || !!hinweis?.leichter;
  const alle = BEREITSCHAFT.every(([k]) => r[k] != null);
  return html`<${Sheet} zu=${zu} label="Wie fit bist du heute?">
    <h2 class="h2">Wie fit bist du heute?</h2>
    <p class="muted" style="margin:0;font-size:13.5px">Vier Fragen, je 1–5. Die Antworten stehen später beim Training und zeigen, wie schlechte Tage ausgehen.</p>
    ${BEREITSCHAFT.map(([k, name, [links, rechts]]) => html`<div key=${k} class="bereit-zeile">
      <div class="row between"><b>${name}</b><span class="muted" style="font-size:12px">1 = ${links} · 5 = ${rechts}</span></div>
      <div class="bereit-wahl" role="group" aria-label=${name}>${[1, 2, 3, 4, 5].map((n) => html`<button key=${n} class="chip" aria-pressed=${String(r[k] === n)}
        onClick=${() => setR((a) => ({ ...a, [k]: n }))}>${n}</button>`)}</div></div>`)}
    ${wert != null ? html`<div class="row between"><span class="eyebrow">Bereitschaft</span><b class="zahl" style="font-size:22px">${fmt(wert, 1)}<small class="muted"> / 5</small></b></div>` : null}
    ${hinweis ? html`<section class="hint">${I.warn}<span class="t">Heute vorsichtig</span><span></span><p>${hinweis.text}</p></section>` : null}
    ${mitLeichter ? html`<label class="schalter" for="b-leichter"><span><b>Gewichte 5 % leichter</b><br/><span class="muted" style="font-size:13px">Gilt nur für dieses Training.</span></span>
      <input type="checkbox" id="b-leichter" checked=${leichterJetzt} onChange=${(e) => { setAngepasst(true); setLeichter(e.currentTarget.checked); }}/></label>` : null}
    <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => los(null, leichterVorher)}>Ohne Check starten</button>
      <button class="btn btn-chalk" style="flex:1" disabled=${!alle} onClick=${() => los({ ...r }, leichterJetzt)}>Training starten</button></div>
  <//>`;
}
