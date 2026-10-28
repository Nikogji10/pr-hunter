// PR Hunter · Eigener Plan (einfach): Trainingstage benennen, Übungen selbst auswählen, Sätze × Wdh und RPE eintragen;
// die Woche wiederholt sich über die gewählte Zahl an Wochen. Gewichte schlägt die App beim Training aus RPE + e1RM vor.
import { html, useState, useEffect, I, nameVon } from './basis.js';
import { UebungSuche } from './suche.js';
import { Schritte } from './bbgenerator.js';

// Wochentage je Anzahl Trainingstage (Offsets ab Montag), Pausen verteilt
const WOCHENTAGE = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
const BUCHSTABE = 'ABCDEFG';
const neuerTag = (i) => ({ name: `Tag ${BUCHSTABE[i]}`, uebungen: [] });

/** Programm im App-Format aus dem Formular (ohne Maxe). */
export function eigenerPlanAus({ name, wochen, tage }) {
  const offsets = WOCHENTAGE[tage.length] ?? WOCHENTAGE[3];
  return {
    id: `eigen-${Date.now()}`, name: name || `Eigener Plan ${tage.length}×/Woche`, source: 'Eigener Plan', kategorie: 'eigen', inputs: [],
    weeks: Array.from({ length: wochen }, (_, w) => ({ week: w + 1, title: `Woche ${w + 1}`, typ: 'aufbau',
      days: tage.map((t, i) => ({ offset: w * 7 + offsets[i], label: t.name, items: t.uebungen.map((u) => ({ exercise_key: u.key, role: null,
        groups: [{ sets: String(u.saetze || 3), reps: String(u.wdh || '8-12'), rpe: u.rpe ? `RPE ${String(u.rpe).replace(',', '.')}` : null }] })) })) })),
    settings: { cut_mode: { reduce_sets: 1, min_sets: 1 } }, rules: { eigen: { wochen, tage: tage.length } },
  };
}

export function EigenerPlan({ zurueck, speichern }) {
  const [schritt, setSchritt] = useState(1);
  const [name, setName] = useState('');
  const [wochen, setWochen] = useState(6);
  const [tage, setTage] = useState([neuerTag(0), neuerTag(1), neuerTag(2)]);
  const [suche, setSuche] = useState(null);                  // Tag, für den gerade eine Übung gesucht wird
  useEffect(() => window.scrollTo(0, 0), [schritt]);
  const aendere = (i, f) => setTage((alt) => alt.map((t, j) => (j === i ? f(structuredClone(t)) : t)));
  const anzahl = (n) => setTage((alt) => Array.from({ length: n }, (_, i) => alt[i] ?? neuerTag(i)));
  const leer = tage.some((t) => !t.uebungen.length);
  return html`<div class="screen">
    <header class="topbar unter"><button class="iconbtn" onClick=${zurueck} aria-label="Zurück">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">Einfach · alles selbst wählen</div><h1 class="h1">Eigener Plan</h1></div></header>
    <${Schritte} schritt=${schritt} namen=${['Grundlagen', 'Übungen', 'Speichern']}/>

    ${schritt === 1 ? html`<section class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">1</span><span class="viz-t">Tage und Dauer</span></div>
      <span class="eyebrow">Trainingstage pro Woche</span>
      <div class="seg" role="group" aria-label="Trainingstage pro Woche">${[1, 2, 3, 4, 5, 6].map((n) => html`<button key=${n} aria-pressed=${String(tage.length === n)} onClick=${() => anzahl(n)}>${`${n}×`}</button>`)}</div>
      <span class="eyebrow">Wie viele Wochen</span>
      <div class="seg" role="group" aria-label="Wochen">${[4, 6, 8, 12].map((n) => html`<button key=${n} aria-pressed=${String(wochen === n)} onClick=${() => setWochen(n)}>${`${n} Wo.`}</button>`)}</div>
      <span class="eyebrow">Namen der Tage</span>
      ${tage.map((t, i) => html`<input key=${i} class="text" type="text" aria-label=${`Name Tag ${i + 1}`} value=${t.name} onInput=${(e) => { const v = e.currentTarget.value; aendere(i, (x) => ({ ...x, name: v })); }}/>`)}
      <span class="muted" style="font-size:12.5px">Zum Beispiel „Push“, „Pull“, „Beine“ oder „Oberkörper“. Die Woche wiederholt sich – steigern kannst du beim Training über Gewicht und Wdh.</span>
    </section>` : null}

    ${schritt === 2 ? html`${tage.map((t, i) => html`<section key=${i} class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">${BUCHSTABE[i]}</span><span class="viz-t">${t.name}</span></div>
      ${t.uebungen.map((u, j) => html`<div key=${j} class="eigen-uebung"><b>${nameVon(u.key, u.key)}</b>
        <button class="iconbtn klein" aria-label="Übung entfernen" onClick=${() => aendere(i, (x) => ({ ...x, uebungen: x.uebungen.filter((_, k) => k !== j) }))}>${I.zu}</button>
        <label>Sätze<input class="text" type="text" inputmode="numeric" value=${u.saetze} onInput=${(e) => { const v = e.currentTarget.value; aendere(i, (x) => { x.uebungen[j].saetze = v; return x; }); }}/></label>
        <label>Wdh<input class="text" type="text" value=${u.wdh} onInput=${(e) => { const v = e.currentTarget.value; aendere(i, (x) => { x.uebungen[j].wdh = v; return x; }); }}/></label>
        <label>RPE<input class="text" type="text" inputmode="decimal" value=${u.rpe} onInput=${(e) => { const v = e.currentTarget.value; aendere(i, (x) => { x.uebungen[j].rpe = v; return x; }); }}/></label></div>`)}
      ${suche === i ? html`<${UebungSuche} id=${`eigen-${i}`} autofokus=${true} onWahl=${(key) => { aendere(i, (x) => ({ ...x, uebungen: [...x.uebungen, { key, saetze: '3', wdh: '8-12', rpe: '8' }] })); setSuche(null); }}/>`
        : html`<button class="btn btn-soft btn-sm" onClick=${() => setSuche(i)}>+ Übung hinzufügen</button>`}
    </section>`)}` : null}

    ${schritt === 3 ? html`<section class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">3</span><span class="viz-t">Überblick</span></div>
      ${tage.map((t, i) => html`<div key=${i} class="wochenplan"><span class="eyebrow">${t.name}</span>
        ${t.uebungen.length ? t.uebungen.map((u, j) => html`<div key=${j} class="wp-zeile bb-zeile"><span>${nameVon(u.key, u.key)}</span><b>${`${u.saetze} × ${u.wdh}`}</b><span class="muted">${u.rpe ? `RPE ${u.rpe}` : ''}</span></div>`)
          : html`<span class="muted" style="font-size:13px">Noch keine Übung – zurück zu Schritt 2.</span>`}</div>`)}
      <label class="field" for="eigen-name"><span class="label">Name (optional)</span>
        <input id="eigen-name" class="text" type="text" placeholder=${`Eigener Plan ${tage.length}×/Woche`} value=${name} onInput=${(e) => setName(e.currentTarget.value)}/></label>
      <button class="btn btn-chalk btn-block" disabled=${leer} onClick=${() => speichern(eigenerPlanAus({ name: name.trim(), wochen, tage }), { quelle: 'eigen' })}>Plan speichern</button>
      <span class="muted" style="font-size:12.5px">${leer ? 'Jeder Tag braucht mindestens eine Übung.' : 'Danach als Block starten – die Gewichte schlägt die App beim Training aus deinem besten e1RM und der RPE vor.'}</span>
    </section>` : null}

    <div class="row schritt-knoepfe">${schritt > 1 ? html`<button class="btn btn-soft" style="flex:1" onClick=${() => setSchritt(schritt - 1)}>Zurück</button>` : null}
      ${schritt < 3 ? html`<button class="btn btn-chalk" style="flex:1.6" onClick=${() => setSchritt(schritt + 1)}>Weiter</button>` : null}</div>
  </div>`;
}
