// PR Hunter · Bodybuilding-Generator (Wunsch 98): Schritt für Schritt – 1. Split, 2. je Muskelgruppe zwei Übungen,
// 3. Tage pro Woche und Blocklänge, 4. Vorschau der ersten Woche → als eigenes Programm speichern. Logik in js/bodybuilding.js.
import { html, useState, useEffect, I, nameVon } from './basis.js';
import { SPLITS, MUSKELGRUPPEN, standardAuswahl, haeufigkeit, generiereBodybuilding } from '../js/bodybuilding.js';

const TAGE_STANDARD = { ppl: 6, ul: 4, gk: 3, bro: 5 };

export function BodybuildingGenerator({ zurueck, speichern }) {
  const [split, setSplit] = useState('ppl');
  const [tage, setTage] = useState(6);
  const [wochen, setWochen] = useState(4);
  const [deload, setDeload] = useState(true);
  const [auswahl, setAuswahl] = useState(standardAuswahl);
  const [name, setName] = useState('');
  const [schritt, setSchritt] = useState(1);
  useEffect(() => window.scrollTo(0, 0), [schritt]);               // jeder Schritt beginnt oben
  const gruppen = [...new Set(SPLITS[split].tage.flatMap(([, g]) => g))];
  const h = haeufigkeit(split, tage);
  const p = generiereBodybuilding({ name: name.trim(), split, tage, wochen, deload, auswahl });
  const woche1 = p.weeks[0];
  const waehle = (g, i, key) => setAuswahl({ ...auswahl, [g]: auswahl[g].map((k, j) => (j === i ? key : k)) });
  const satzSumme = (g) => woche1.days.flatMap((d) => d.items).filter((x) => auswahl[g].includes(x.exercise_key)).reduce((a, x) => a + Number(x.groups[0].sets), 0);
  return html`<div class="screen">
    <header class="topbar unter"><button class="iconbtn" onClick=${zurueck} aria-label="Zurück">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">Fortgeschritten · Hypertrophie</div><h1 class="h1">Bodybuilding-Generator</h1></div></header>

    <${Schritte} schritt=${schritt} namen=${SCHRITTE}/>
    ${schritt === 1 ? html`<section class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">1</span><span class="viz-t">Split wählen</span></div>
      <div class="split-wahl">${Object.entries(SPLITS).map(([k, s]) => html`<button key=${k} class="split-karte" aria-pressed=${String(split === k)}
        onClick=${() => { setSplit(k); setTage(TAGE_STANDARD[k]); }}><b>${s.name}</b><span>${s.text}</span></button>`)}</div></section>` : null}

    ${schritt === 2 ? html`<section class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">2</span><span class="viz-t">Zwei Übungen je Muskelgruppe</span></div>
      <span class="muted" style="font-size:12.5px">Vorgeschlagen ist eine bewährte Kombination – Grundübung plus Isolation. Tauschen, was dir besser liegt oder was dein Gym hat.</span>
      ${gruppen.map((g) => html`<div key=${g} class="muskel-wahl"><b>${MUSKELGRUPPEN[g].name}</b>
        ${[0, 1].map((i) => html`<select key=${i} class="text" aria-label=${`${MUSKELGRUPPEN[g].name} Übung ${i + 1}`} value=${auswahl[g][i]} onChange=${(e) => waehle(g, i, e.currentTarget.value)}>
          ${MUSKELGRUPPEN[g].uebungen.map(([k]) => html`<option key=${k} value=${k}>${nameVon(k, k)}</option>`)}</select>`)}</div>`)}
    </section>` : null}

    ${schritt === 3 ? html`<section class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">3</span><span class="viz-t">Wie oft und wie lange</span></div>
      <span class="eyebrow">Trainingstage pro Woche</span>
      <div class="seg" role="group" aria-label="Trainingstage pro Woche">${[2, 3, 4, 5, 6].map((n) => html`<button key=${n} aria-pressed=${String(tage === n)} onClick=${() => setTage(n)}>${`${n}×`}</button>`)}</div>
      <div class="haeufigkeit">${gruppen.map((g) => html`<span key=${g} class=${(h[g] ?? 0) >= 2 ? 'gut' : ''}>${MUSKELGRUPPEN[g].name} <b>${`${h[g] ?? 0}×`}</b></span>`)}</div>
      <span class="muted" style="font-size:12.5px">Grün = jede Woche mindestens 2× – das bringt für Muskelaufbau meist mehr als 1× mit vielen Sätzen.</span>
      <span class="eyebrow">Aufbauwochen</span>
      <div class="seg" role="group" aria-label="Aufbauwochen">${[4, 5, 6].map((n) => html`<button key=${n} aria-pressed=${String(wochen === n)} onClick=${() => setWochen(n)}>${`${n} Wochen`}</button>`)}</div>
      <label class="schalter" for="bb-deload"><span><b>Deload danach</b><br/><span class="muted" style="font-size:12.5px">Eine leichte Woche (halbe Sätze, RPE 6–7), dann den nächsten Block wieder leichter beginnen.</span></span>
        <input type="checkbox" id="bb-deload" checked=${deload} onChange=${(e) => setDeload(e.currentTarget.checked)}/></label>
      <span class="muted" style="font-size:12.5px">Grundübungen steigern sich von RPE 7–8 in Woche 1 bis RPE 9–9,5 in der letzten Woche (Maschinen bis 10), Isolationen immer RPE 9 mit dem letzten Satz bis 10. Die Gewichte schlägt die App beim Training aus deinem besten e1RM und der RPE vor.</span>
    </section>` : null}

    ${schritt === 4 ? html`<section class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">4</span><span class="viz-t">Vorschau · Woche 1</span></div>
      ${woche1.days.map((d) => html`<div key=${d.offset} class="wochenplan"><span class="eyebrow">${d.label}</span>
        ${d.items.map((x, i) => html`<div key=${i} class="wp-zeile bb-zeile"><span>${nameVon(x.exercise_key, x.exercise_key)}</span><b>${`${x.groups[0].sets} × ${x.groups[0].reps}`}</b><span class="muted">${x.groups[0].rpe}</span></div>`)}</div>`)}
      <div class="haeufigkeit">${gruppen.map((g) => html`<span key=${g}>${MUSKELGRUPPEN[g].name} <b>${satzSumme(g)}</b></span>`)}</div>
      <span class="muted" style="font-size:12px">Harte Sätze je Muskel in Woche 1 · ab der zweiten Hälfte des Blocks 2 mehr.</span>
      <label class="field" for="bb-name"><span class="label">Name (optional)</span>
        <input id="bb-name" class="text" type="text" placeholder=${p.name} value=${name} onInput=${(e) => setName(e.currentTarget.value)}/></label>
      <button class="btn btn-chalk btn-block" onClick=${() => speichern(p, { quelle: 'generator' })}>Als eigenes Programm speichern</button>
      <span class="muted" style="font-size:12.5px">Danach lässt es sich ansehen, bearbeiten und als Block starten.</span>
    </section>` : null}
    <div class="row schritt-knoepfe">${schritt > 1 ? html`<button class="btn btn-soft" style="flex:1" onClick=${() => setSchritt(schritt - 1)}>Zurück</button>` : null}
      ${schritt < 4 ? html`<button class="btn btn-chalk" style="flex:1.6" onClick=${() => setSchritt(schritt + 1)}>Weiter</button>` : null}</div>
  </div>`;
}

const SCHRITTE = ['Split', 'Übungen', 'Häufigkeit', 'Vorschau'];
/** Fortschritt eines Assistenten: nummerierte Schritte, erledigte grün, aktueller in der Akzentfarbe. */
export function Schritte({ schritt, namen }) {
  return html`<div class="schritte" aria-label=${`Schritt ${schritt} von ${namen.length}`}>${namen.map((n, i) => html`<span key=${n} class=${i + 1 < schritt ? 'ok' : i + 1 === schritt ? 'jetzt' : ''}>
    <i>${i + 1 < schritt ? '✓' : i + 1}</i><small>${n}</small></span>`)}</div>`;
}
