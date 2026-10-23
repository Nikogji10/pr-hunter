// PR Hunter · Prototyp: Körperkarte für das Kraftprofil (vorne/hinten), Farbe = Stufe der beteiligten Lifts.
import { html, useState, fmt } from './basis.js';
import { stufe } from '../js/auswertung.js';

export const MUSKEL_NAME = {
  quadrizeps: 'Quadrizeps', gesaess: 'Gesäß', adduktoren: 'Adduktoren', beinbeuger: 'Beinbeuger', ruecken_unten: 'Unterer Rücken',
  trapez: 'Trapez', unterarme: 'Unterarme', brust: 'Brust', schulter_vorn: 'Vordere Schulter', trizeps: 'Trizeps',
  latissimus: 'Latissimus', bizeps: 'Bizeps', schulter_seite: 'Seitliche Schulter', bauch: 'Bauch', waden: 'Waden',
};
// Stufen zusammengefasst auf 4 Töne einer Farbe (geordnet: kräftiger = stärker)
const TOENE = [[100, 4, 'ab Herausragend'], [87.5, 3, 'Fortgeschritten'], [60, 2, 'Mittelstufe bis Versiert'], [-Infinity, 1, 'darunter']];
const ton = (w) => TOENE.find(([g]) => w >= g)[1];

const e = (cx, cy, rx, ry) => ({ t: 'e', cx, cy, rx, ry });
const r = (x, y, w, h, rx = 7) => ({ t: 'r', x, y, w, h, rx });
const p = (d) => ({ t: 'p', d });
const VORNE = {
  trapez: [p('M66 48 L94 48 L104 56 L56 56 Z')], schulter_vorn: [e(54, 64, 11, 10), e(106, 64, 11, 10)],
  brust: [r(59, 56, 20, 26), r(81, 56, 20, 26)], bizeps: [e(46, 92, 7, 16), e(114, 92, 7, 16)],
  unterarme: [e(41, 128, 6, 17), e(119, 128, 6, 17)], bauch: [r(65, 85, 30, 46, 8)],
  quadrizeps: [e(68, 176, 11, 30), e(92, 176, 11, 30)], adduktoren: [e(76.5, 162, 3.5, 15), e(83.5, 162, 3.5, 15)],
  waden: [e(68, 246, 7, 24), e(92, 246, 7, 24)],
};
const HINTEN = {
  trapez: [p('M80 44 L100 56 L80 90 L60 56 Z')], schulter_seite: [e(54, 64, 11, 10), e(106, 64, 11, 10)],
  latissimus: [p('M62 70 L78 92 L78 120 L64 104 Z'), p('M98 70 L82 92 L82 120 L96 104 Z')],
  trizeps: [e(46, 92, 7, 16), e(114, 92, 7, 16)], unterarme: [e(41, 128, 6, 17), e(119, 128, 6, 17)],
  ruecken_unten: [r(70, 112, 20, 24, 6)], gesaess: [e(70, 146, 11, 11), e(90, 146, 11, 11)],
  beinbeuger: [e(68, 186, 10, 26), e(92, 186, 10, 26)], waden: [e(68, 246, 8, 24), e(92, 246, 8, 24)],
};

function Figur({ teile, werte, aktiv, waehle, titel }) {
  const form = (s, i, m) => {
    const w = werte[m];
    const stil = w == null ? 'fill:var(--raised);stroke:var(--line);stroke-width:1' : `fill:var(--seq-${ton(w)});stroke:${aktiv === m ? 'var(--gold)' : 'var(--surface)'};stroke-width:${aktiv === m ? 2.5 : 1.5}`;
    const props = { key: `${m}${i}`, style: stil, onClick: () => waehle(m), class: 'muskel' };
    return s.t === 'e' ? html`<ellipse ...${props} cx=${s.cx} cy=${s.cy} rx=${s.rx} ry=${s.ry}/>`
      : s.t === 'r' ? html`<rect ...${props} x=${s.x} y=${s.y} width=${s.w} height=${s.h} rx=${s.rx}/>` : html`<path ...${props} d=${s.d}/>`;
  };
  return html`<figure class="figur"><svg viewBox="0 0 160 285" role="img" aria-label=${`Körper ${titel}`}>
    <circle cx="80" cy="24" r="14" style="fill:var(--raised)"/><rect x="73" y="36" width="14" height="10" rx="3" style="fill:var(--raised)"/>
    <rect x="62" y="131" width="36" height="14" rx="6" style="fill:var(--raised)"/>
    <rect x="61" y="271" width="14" height="7" rx="3" style="fill:var(--raised)"/><rect x="85" y="271" width="14" height="7" rx="3" style="fill:var(--raised)"/>
    ${Object.entries(teile).flatMap(([m, formen]) => formen.map((s, i) => form(s, i, m)))}
  </svg><figcaption>${titel}</figcaption></figure>`;
}

export function KoerperKarte({ muskeln }) {
  const [aktiv, setAktiv] = useState('quadrizeps');
  const w = muskeln[aktiv];
  return html`<div class="koerper">
    <div class="figuren"><${Figur} teile=${VORNE} werte=${muskeln} aktiv=${aktiv} waehle=${setAktiv} titel="Vorne"/>
      <${Figur} teile=${HINTEN} werte=${muskeln} aktiv=${aktiv} waehle=${setAktiv} titel="Hinten"/></div>
    <div class="row between" style="min-height:24px"><b>${MUSKEL_NAME[aktiv]}</b>
      <span class="muted" style="font-size:13px">${w == null ? 'keine Daten – über Schulterdrücken, Klimmzug oder Rudern bei Symmetric Strength prüfen' : `${fmt(w, 1)} · ${stufe(w).name}`}</span></div>
    <div class="skala" style="flex-wrap:wrap;gap:10px">${TOENE.slice().reverse().map(([, t, text]) => html`<span key=${t} class="row" style="gap:4px"><i style=${`background:var(--seq-${t})`}></i>${text}</span>`)}
      <span class="row" style="gap:4px"><i style="background:var(--raised);box-shadow:inset 0 0 0 1px var(--line)"></i>keine Daten</span></div>
  </div>`;
}
