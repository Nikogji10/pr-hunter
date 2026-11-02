// PR Hunter · Fachbegriffe einfach erklärt (Wunsch 163 c/d): ein Fenster mit allen Begriffen, ein kleines „?“ öffnet es
// an der passenden Stelle. Aus dem Seitenmenü („Begriffe erklärt“) und im Training neben RPE/Top-Satz/Back-off erreichbar.
import { html, useEffect, Sheet, zeigeFenster } from './basis.js';

export const BEGRIFFE = [
  ['rpe', 'RPE', 'Wie schwer ein Satz war, auf einer Skala bis 10. RPE 10 = keine Wiederholung mehr möglich, RPE 8 = noch 2 Wiederholungen im Tank, RPE 7 = noch 3. Wer neu ist: lieber leicht schätzen und sauber bleiben.'],
  ['rir', 'RIR', '„Reps in Reserve“ – wie viele Wiederholungen noch gegangen wären. 2 RIR entspricht RPE 8.'],
  ['e1rm', 'e1RM', 'Geschätztes Maximum für eine Wiederholung, errechnet aus Gewicht × Wiederholungen (und RPE). So lässt sich Kraft vergleichen, ohne je maximal zu testen.'],
  ['top', 'Top-Satz', 'Der schwerste Satz einer Übung an diesem Tag. Danach folgen meist leichtere Back-offs.'],
  ['backoff', 'Back-off', 'Leichtere Sätze nach dem Top-Satz – sammeln Wiederholungen und Technik ohne zu viel Ermüdung.'],
  ['deload', 'Deload', 'Eine bewusst leichte Woche (weniger Sätze, leichter), damit der Körper sich erholt und danach stärker ist.'],
  ['amrap', 'AMRAP', '„As many reps as possible“ – so viele saubere Wiederholungen wie möglich.'],
  ['tm', 'Trainingsmax', 'Ein etwas niedrigeres Max (z. B. 95 % des echten), von dem die Prozente im Plan gerechnet werden – damit die Gewichte machbar bleiben.'],
  ['grund', 'Grundübung', 'Übung über mehrere Gelenke mit viel Muskelmasse (Kniebeuge, Bankdrücken, Rudern). Schwer, wenige Wiederholungen.'],
  ['iso', 'Isolation', 'Übung für einen Muskel über ein Gelenk (Bizepscurl, Beinstrecker). Leichter, mehr Wiederholungen.'],
  ['satz', 'Satz und Wdh', '„3 × 10“ heißt 3 Sätze mit je 10 Wiederholungen. Zwischen den Sätzen läuft die Pause.'],
  ['progression', 'Steigern', 'Schaffst du in allen Sätzen die obere Wiederholungszahl, nimm beim nächsten Mal etwas mehr Gewicht (meist 2,5 kg). Sonst versuch eine Wiederholung mehr.'],
];

export function GlossarSheet({ start = null, zu }) {
  useEffect(() => { if (start) setTimeout(() => document.getElementById(`begriff-${start}`)?.scrollIntoView({ block: 'center' }), 80); }, []);
  return html`<${Sheet} zu=${zu} label="Begriffe erklärt">
    <span class="eyebrow">Einfach erklärt</span>
    <h2 class="h2" style="margin:0">Begriffe</h2>
    <div class="glossar">${BEGRIFFE.map(([k, name, text]) => html`<div key=${k} id=${`begriff-${k}`} class=${`begriff ${start === k ? 'aktiv' : ''}`}><b>${name}</b><p>${text}</p></div>`)}</div>
  <//>`;
}

/** Kleines „?“: öffnet die Erklärung des Begriffs (Fenster unter <body>, damit Karten es nicht einsperren). */
export function InfoKnopf({ begriff }) {
  return html`<button class="info-knopf" onClick=${(e) => { e.stopPropagation(); zeigeFenster((zu) => html`<${GlossarSheet} start=${begriff} zu=${zu}/>`); }} aria-label="Begriff erklären">?</button>`;
}
