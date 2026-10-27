// PR Hunter · Einführung beim ersten Öffnen: wenige Karten, je ein grüner Haken; abgehakt fliegt die Karte weg und die
// nächste rückt nach. Gemerkt pro Gerät (`prh-einfuehrung`), in den Einstellungen erneut aufrufbar.
import { html, useState, I, speicher } from './basis.js';

const GESEHEN = 'prh-einfuehrung';
export const einfuehrungOffen = () => speicher.lies(GESEHEN) !== '1';
export const einfuehrungGesehen = () => speicher.schreib(GESEHEN, '1');

const KARTEN = [
  { symbol: 'heute', titel: 'Jag deine Rekorde', text: 'Plane deine Blöcke, trainiere Satz für Satz und sieh, wie du stärker wirst.' },
  { symbol: 'hantel', titel: 'Satz abhaken', text: 'Gewicht oder Wdh antippen zum Ändern. Satz geschafft? Haken drücken – die Pause läuft von selbst.' },
  { symbol: 'wisch', titel: 'Wischen', text: 'Übung nach rechts wischen: einklappen. Nach links: entfernen.' },
  { symbol: 'statistik', titel: 'Fortschritt sehen', text: 'Neue Rekorde feiert die App sofort. In der Statistik: Verlauf, Kraftprofil, Erholung.' },
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
      ${KARTEN.map((k, j) => j < i ? null : html`<article key=${j} class=${`einf-karte ${j === i && weg ? 'weg' : ''}`} style=${`--tiefe:${Math.min(j - i, 3)}`} aria-hidden=${String(j !== i)}>
        <div class="einf-symbol">${KARTE_SYMBOL[k.symbol]}</div>
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

// Eigene große Symbole (Strichzeichnung wie die übrigen Icons)
const sym = (inhalt) => html`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inhalt}</svg>`;
const KARTE_SYMBOL = {
  heute: sym(html`<path d="M24 6l5 10 11 1.6-8 7.8 1.9 11L24 31.2 14.1 36.4 16 25.4l-8-7.8L19 16z"/>`),
  hantel: sym(html`<path d="M6 18v12M11 14v20M37 14v20M42 18v12M11 24h26"/><path d="M19 24l4 4 7-8" stroke-width="3"/>`),
  wisch: sym(html`<path d="M8 24h32M32 16l8 8-8 8M16 32l-8-8 8-8"/>`),
  statistik: sym(html`<path d="M8 40V8M8 40h32M14 32l8-10 6 6 10-14"/><circle cx="38" cy="14" r="2.5" fill="currentColor"/>`),
};
