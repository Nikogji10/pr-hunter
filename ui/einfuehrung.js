// PR Hunter · Einführung beim ersten Öffnen: wenige Karten, je ein grüner Haken; abgehakt fliegt die Karte weg und die
// nächste rückt nach. Jede Karte zeigt oben eine kleine Szene, die vormacht, worum es geht (läuft nur auf der vorderen
// Karte, nur transform/opacity). Gemerkt pro Gerät (`prh-einfuehrung`), in den Einstellungen erneut aufrufbar.
import { html, useState, I, speicher } from './basis.js';

const GESEHEN = 'prh-einfuehrung';
export const einfuehrungOffen = () => speicher.lies(GESEHEN) !== '1';
export const einfuehrungGesehen = () => speicher.schreib(GESEHEN, '1');

const KARTEN = [
  { szene: 'start', titel: 'Jag deine Rekorde', text: 'Plane deine Blöcke, trainiere Satz für Satz und sieh, wie du stärker wirst.' },
  { szene: 'satz', titel: 'Satz abhaken', text: 'Gewicht oder Wdh antippen zum Ändern. Satz geschafft? Haken drücken – die Pause läuft von selbst.' },
  { szene: 'wisch', titel: 'Wischen', text: 'Übung nach rechts wischen: einklappen. Nach links: entfernen.' },
  { szene: 'kurve', titel: 'Fortschritt sehen', text: 'Neue Rekorde feiert die App sofort. In der Statistik: Verlauf, Kraftprofil, Erholung.' },
];

export function Einfuehrung({ fertig }) {
  const [i, setI] = useState(0);
  const [weg, setWeg] = useState(false);
  const haken = () => {
    if (weg) return;
    setWeg(true);
    setTimeout(() => { setWeg(false); if (i + 1 >= KARTEN.length) { einfuehrungGesehen(); fertig(); } else setI(i + 1); }, 420);
  };
  const ueberspringen = () => { einfuehrungGesehen(); fertig(); };
  return html`<div class="einf" role="dialog" aria-modal="true" aria-label="Einführung">
    <div class="einf-stapel">
      ${KARTEN.map((k, j) => j < i ? null : html`<article key=${j} class=${`einf-karte ${j === i ? 'vorn' : ''} ${j === i && weg ? 'weg' : ''}`} style=${`--tiefe:${Math.min(j - i, 3)}`} aria-hidden=${String(j !== i)}>
        <div class="einf-szene" aria-hidden="true">${SZENE[k.szene]}</div>
        <span class="eyebrow">${j + 1} / ${KARTEN.length}</span>
        <h2 class="einf-titel">${k.titel}</h2>
        <p class="einf-text">${k.text}</p>
        <button class="einf-haken" onClick=${haken} aria-label=${j + 1 < KARTEN.length ? 'Verstanden, weiter' : 'Los geht’s'} tabindex=${j === i ? 0 : -1}>${I.check}</button>
      </article>`).reverse()}
    </div>
    <div class="einf-punkte" aria-hidden="true">${KARTEN.map((_, j) => html`<i key=${j} class=${j < i ? 'ok' : j === i ? 'jetzt' : ''}></i>`)}</div>
    <button class="link einf-skip" onClick=${ueberspringen}>Überspringen</button>
  </div>`;
}

// Szenen: Hantel wird beladen und gibt einen PR · Satzzeile wird abgehakt, Pause läuft · Übungskarte wird gewischt ·
// Kurve steigt. Farben aus dem Design, Scheiben in Wettkampffarben wie das Logo.
const SZENE = {
  start: html`<div class="sz-start"><svg viewBox="0 0 200 80"><rect class="sz-stange" x="6" y="37" width="188" height="6" rx="3"/>
      <rect class="sz-kragen" x="58" y="26" width="5" height="28" rx="1"/><rect class="sz-kragen" x="137" y="26" width="5" height="28" rx="1"/>
      <g class="sz-l"><rect x="48" y="8" width="9" height="64" rx="2" fill="#D7263D"/><rect x="38" y="8" width="9" height="64" rx="2" fill="#1F5FD1"/><rect x="29" y="16" width="8" height="48" rx="2" fill="#F2C230"/></g>
      <g class="sz-r"><rect x="143" y="8" width="9" height="64" rx="2" fill="#D7263D"/><rect x="153" y="8" width="9" height="64" rx="2" fill="#1F5FD1"/><rect x="163" y="16" width="8" height="48" rx="2" fill="#F2C230"/></g></svg>
    <span class="sz-pr">PR</span></div>`,
  satz: html`<div class="sz-satz"><div class="sz-zeile"><span class="sz-feld"><b>155</b><small>kg</small></span><span class="sz-feld"><b>5</b><small>Wdh</small></span>
      <span class="sz-check">${I.check}</span></div><div class="sz-pause"><span>Pause</span><i><i></i></i></div></div>`,
  wisch: html`<div class="sz-wisch"><div class="sz-spur"><span class="sz-links">${I.papierkorb}</span><span class="sz-rechts">${I.check}</span></div>
      <div class="sz-karte"><i></i><b></b><b></b></div><span class="sz-finger"></span></div>`,
  kurve: html`<div class="sz-kurve"><svg viewBox="0 0 200 90"><path class="sz-gitter" d="M10 80H190M10 55H190M10 30H190"/>
      <path class="sz-linie" pathLength="1" d="M12 76 L42 66 L70 70 L98 52 L126 56 L154 34 L186 18"/><circle class="sz-punkt" cx="186" cy="18" r="6"/></svg>
    <span class="sz-plus">+5 kg</span></div>`,
};
