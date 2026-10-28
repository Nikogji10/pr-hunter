// PR Hunter · Muskeldiagramm für das Kraftprofil (vorne/hinten), im Stil von Symmetric Strength: anatomische Figur,
// jeder Muskel in der Farbe seiner Stärkestufe (aus den beteiligten Lifts), Licht-Verlauf für Plastizität.
// Eigene Zeichnung (keine Grafik von Symmetric Strength übernommen). Linke Körperhälfte wird gespiegelt.
import { html, useState, fmt, LIFT } from './basis.js';
import { stufe, STUFEN } from '../js/auswertung.js';

export const MUSKEL_NAME = {
  quadrizeps: 'Quadrizeps', gesaess: 'Gesäß', adduktoren: 'Adduktoren', beinbeuger: 'Beinbeuger', ruecken_unten: 'Unterer Rücken',
  trapez: 'Trapez', unterarme: 'Unterarme', brust: 'Brust', schulter_vorn: 'Vordere Schulter', trizeps: 'Trizeps',
  latissimus: 'Latissimus', bizeps: 'Bizeps', schulter_seite: 'Hintere/seitliche Schulter', bauch: 'Bauch', waden: 'Waden',
};
// Farbe je Stärkestufe (von unten nach oben): dunkelrot → rot → orange → gelb → grün → smaragd → türkis → violett
const STUFEN_FARBE = {
  'Unter Untrainiert': '#6B1220', Untrainiert: '#9E1B2C', Aufbau: '#D2412D', Solide: '#E8822A', Versiert: '#E7C23B',
  Stark: '#7CC243', Herausragend: '#25B07A', Spitzenklasse: '#22A7C9', Weltklasse: '#8B5CF6',
};
export const farbeVon = (w) => STUFEN_FARBE[stufe(w).name];

// Grundfigur (Silhouette) und Muskeln der linken Körperhälfte im Koordinatensystem 0…200 × 0…430; rechts gespiegelt
const KOERPER = 'M100 10 C84 10 76 22 76 40 C76 54 82 64 88 68 L86 78 C74 82 60 84 50 90 C38 96 34 110 36 126 C34 140 38 156 40 170 C36 188 32 206 32 226 C32 234 30 244 34 250 C40 252 44 246 46 238 C48 224 52 206 56 190 C60 176 62 162 64 150 L70 176 C70 192 68 208 70 226 C66 240 62 262 62 290 C62 316 68 330 70 340 C66 360 64 384 66 404 C64 412 62 420 70 422 L84 422 C86 412 84 404 84 396 C86 376 88 356 86 340 C90 320 94 300 96 270 C97 258 98 248 100 244 Z';
const VORNE = {
  trapez: ['M88 72 C80 76 68 80 60 86 C70 88 80 88 90 82 Z'],
  schulter_vorn: ['M58 88 C46 90 38 100 38 116 C38 128 42 134 46 136 C50 122 58 108 70 100 C70 94 66 89 58 88 Z'],
  brust: ['M100 92 L74 92 C64 98 56 110 54 124 C62 138 76 142 90 140 C96 139 100 134 100 128 Z'],
  bizeps: ['M46 140 C40 152 38 168 42 182 C48 186 54 182 56 176 C60 162 60 148 56 138 Z'],
  unterarme: ['M42 188 C36 202 34 218 34 232 C36 240 42 240 46 236 C50 220 54 204 56 188 C52 184 46 184 42 188 Z'],
  bauch: ['M100 142 L88 142 C86 162 86 186 88 208 C90 220 94 230 100 234 Z'],
  schraeg: ['M86 144 C78 150 72 162 72 178 C72 196 76 212 86 222 C84 196 84 168 86 144 Z'],
  quadrizeps: ['M98 246 C90 240 80 236 72 238 C66 256 64 280 66 302 C68 318 74 330 82 334 C90 326 94 310 96 290 C96 276 96 260 98 246 Z'],
  adduktoren: ['M99 246 C96 258 96 274 95 292 C98 290 100 280 100 268 Z'],
  waden: ['M72 346 C66 362 66 382 70 398 C74 402 80 400 82 396 C84 378 84 360 82 344 C78 340 74 340 72 346 Z'],
};
const HINTEN = {
  trapez: ['M100 64 L88 72 C78 78 66 82 58 88 C70 92 82 96 90 108 C94 118 98 132 100 144 Z'],
  schulter_seite: ['M58 88 C46 90 38 100 38 116 C38 128 42 134 46 136 C50 122 56 108 66 100 C68 94 64 89 58 88 Z'],
  latissimus: ['M70 104 C62 118 62 136 66 152 C72 168 82 180 94 186 C96 170 96 152 92 136 C86 124 80 112 70 104 Z'],
  trizeps: ['M46 140 C40 152 38 168 42 182 C48 186 54 182 56 176 C60 162 60 148 56 138 Z'],
  unterarme: ['M42 188 C36 202 34 218 34 232 C36 240 42 240 46 236 C50 220 54 204 56 188 C52 184 46 184 42 188 Z'],
  ruecken_unten: ['M100 150 L93 152 C89 168 86 188 84 206 C86 214 92 220 100 224 Z'],
  gesaess: ['M100 226 C88 222 76 224 70 236 C66 250 68 264 78 272 C88 276 98 270 100 258 Z'],
  beinbeuger: ['M96 278 C86 276 76 276 70 284 C66 300 66 318 72 330 C78 336 86 334 90 326 C94 312 96 296 96 278 Z'],
  waden: ['M72 342 C64 354 62 372 66 388 C70 396 78 396 82 388 C86 372 86 356 82 342 C78 338 74 338 72 342 Z'],
};
// Bauch zählt für das Kraftprofil nicht – die schrägen Bauchmuskeln werden wie der Bauch eingefärbt
const GRUPPE = { schraeg: 'bauch' };
// feine Linien: Sixpack, Quadrizeps-Teilung, Brustfaser – nur Optik
const LINIEN_VORNE = ['M88 162 L100 162 M88 184 L100 184 M88 206 L100 206', 'M84 260 C82 280 82 300 84 318', 'M76 104 C84 112 92 118 100 120'];
const LINIEN_HINTEN = ['M100 70 L100 224', 'M90 300 C88 310 86 320 84 326', 'M76 356 C76 370 76 380 78 388'];

/** farbe(gruppe) → Füllfarbe; ohne Angabe nach Stärkestufe aus werte. */
function Figur({ teile, linien, werte, aktiv, waehle, titel, farbe = null }) {
  const seite = (spiegeln) => Object.entries(teile).flatMap(([m, pfade]) => pfade.map((d, i) => {
    const gruppe = GRUPPE[m] ?? m, w = werte[gruppe];
    const ist = aktiv === gruppe;
    return html`<g key=${`${m}${i}${spiegeln}`} class=${`muskel ${ist ? 'aktiv' : ''}`} onClick=${() => waehle(gruppe)}>
      <path d=${d} style=${`fill:${farbe ? farbe(gruppe) : w == null ? 'var(--muskel-leer)' : farbeVon(w)}`}/>
      <path d=${d} style="fill:url(#muskelLicht)"/>
      <path d=${d} class="muskel-rand"/>
    </g>`;
  }));
  const haelfte = (spiegeln) => html`<g transform=${spiegeln ? 'translate(200 0) scale(-1 1)' : null}>
    <path d=${KOERPER} class="koerper-grund"/>
    ${seite(spiegeln)}
    ${linien.map((d, i) => html`<path key=${i} d=${d} class="muskel-linie"/>`)}
  </g>`;
  return html`<figure class="figur"><svg viewBox="0 0 200 430" role="img" aria-label=${`Muskeln ${titel}`}>
    <defs>
      <radialGradient id="muskelLicht" cx="35%" cy="25%" r="85%">
        <stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".45" stop-color="#fff" stop-opacity=".06"/>
        <stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
    </defs>
    ${haelfte(false)}${haelfte(true)}
  </svg><figcaption>${titel}</figcaption></figure>`;
}

// #################################################################
// Muskel-Erholung als Ampel (Nikos Vorgabe): rot = stark ermüdet, gelb = teilweise erholt, grau = erholt
// #################################################################
const AMPEL = { rot: ['var(--ampel-rot)', 'stark ermüdet'], gelb: ['var(--ampel-gelb)', 'teilweise erholt'], grau: ['var(--muskel-leer)', 'erholt'] };
const erholtIn = (h) => (h <= 0 ? 'gleich erholt' : h < 24 ? `erholt in ca. ${h} h` : `erholt in ca. ${fmt(Math.round(h / 12) / 2, 1)} Tagen`);

export function ErholungKarte({ zustand }) {
  const ermuedet = Object.entries(zustand).filter(([, z]) => z.stufe !== 'grau').sort((a, b) => b[1].last - a[1].last);
  const [aktiv, setAktiv] = useState(() => ermuedet[0]?.[0] ?? 'quadrizeps');
  const z = zustand[aktiv];
  const farbe = (g) => AMPEL[zustand[g]?.stufe ?? 'grau'][0];
  return html`<div class="koerper">
    <div class="figuren"><${Figur} teile=${VORNE} linien=${LINIEN_VORNE} werte=${{}} aktiv=${aktiv} waehle=${setAktiv} titel="Vorne" farbe=${farbe}/>
      <${Figur} teile=${HINTEN} linien=${LINIEN_HINTEN} werte=${{}} aktiv=${aktiv} waehle=${setAktiv} titel="Hinten" farbe=${farbe}/></div>
    <div class="muskel-info"><i style=${`background:${farbe(aktiv)}`}></i><b>${MUSKEL_NAME[aktiv]}</b>
      <span class="muted">${!z || z.stufe === 'grau' ? 'erholt' : `${AMPEL[z.stufe][1]} · ${erholtIn(z.stunden)}`}</span></div>
    <div class="stufen-skala">${['rot', 'gelb', 'grau'].map((s) => html`<span key=${s} class="da"><i style=${`background:${AMPEL[s][0]}`}></i>${AMPEL[s][1]}
      ${s !== 'grau' ? ` (${ermuedet.filter(([, x]) => x.stufe === s).length})` : ''}</span>`)}</div>
  </div>`;
}

/** Muskeln eingefärbt nach Stärkestufe; Tippen zeigt Wert, Stufe und aus welchen Übungen er stammt (* = Näherung). */
export function KoerperKarte({ muskeln, quellen = {} }) {
  const [aktiv, setAktiv] = useState(null);                  // erst beim Antippen eines Muskels Details zeigen
  const w = muskeln[aktiv];
  const vorkommend = STUFEN.map(([, name]) => name).reverse().filter((name) => Object.values(muskeln).some((x) => x != null && stufe(x).name === name));
  // je Quelle ein eigener Textknoten, damit die Übersetzung Liftnamen erkennt
  const q = quellen[aktiv] ?? [];
  const herkunft = q.length ? q.map((x, i) => html`<span key=${i}>${i ? ', ' : ''}<span>${LIFT[x.name]?.name ?? x.name}</span>${x.geschaetzt ? '*' : ''}</span>`) : null;
  const geschaetzt = q.some((x) => x.geschaetzt);
  return html`<div class="koerper">
    <div class="figuren"><${Figur} teile=${VORNE} linien=${LINIEN_VORNE} werte=${muskeln} aktiv=${aktiv} waehle=${setAktiv} titel="Vorne"/>
      <${Figur} teile=${HINTEN} linien=${LINIEN_HINTEN} werte=${muskeln} aktiv=${aktiv} waehle=${setAktiv} titel="Hinten"/></div>
    ${aktiv == null ? html`<p class="muted" style="margin:0;font-size:12.5px;text-align:center">Muskel antippen für Wert und Quelle</p>` : html`<div class="muskel-info"><i style=${`background:${w == null ? 'var(--muskel-leer)' : farbeVon(w)}`}></i><b>${MUSKEL_NAME[aktiv]}</b>
      <span class="muted">${w == null ? 'keine Daten – in den letzten 26 Wochen keine passende Übung mit Gewicht' : `${fmt(w, 1)} · ${stufe(w).name}`}</span>
      ${w != null && herkunft ? html`<span class="muskel-herkunft muted"><span>Quelle:</span> ${herkunft}${geschaetzt ? html` <span>· * Näherung</span>` : null}</span>` : null}</div>`}
    <div class="stufen-skala">${STUFEN.slice(0, -1).reverse().map(([, name]) => html`<span key=${name} class=${vorkommend.includes(name) ? 'da' : ''}>
      <i style=${`background:${STUFEN_FARBE[name]}`}></i>${name}</span>`)}</div>
  </div>`;
}

// #################################################################
// Muskelwahl für die Übungssuche (Wunsch 138): feinere Zonen als das Kraftprofil – Schulter vorne/seitlich/hinten,
// oberer Rücken, Abduktoren. Antippen wählt eine Zone (nochmal antippen hebt sie auf); gewählt = Akzentfarbe.
// #################################################################
export const ZONE_NAME = {
  brust: 'Brust', schulter_vorn: 'Vordere Schulter', schulter_seite: 'Seitliche Schulter', schulter_hinten: 'Hintere Schulter',
  trapez: 'Trapez', oberer_ruecken: 'Oberer Rücken', latissimus: 'Latissimus', ruecken_unten: 'Unterer Rücken',
  bizeps: 'Bizeps', trizeps: 'Trizeps', unterarme: 'Unterarme', bauch: 'Bauch', quadrizeps: 'Quadrizeps', adduktoren: 'Adduktoren',
  abduktoren: 'Abduktoren', gesaess: 'Gesäß', beinbeuger: 'Beinbeuger', waden: 'Waden',
};
const SUCH_VORNE = {
  trapez: VORNE.trapez,
  schulter_seite: ['M54 89 C44 92 38 102 38 116 C38 128 42 134 46 136 C46 122 46 108 52 98 C54 94 56 91 54 89 Z'],
  schulter_vorn: ['M58 88 C54 90 50 96 50 104 C51 116 50 128 47 136 C52 122 58 108 70 100 C70 94 66 89 58 88 Z'],
  brust: VORNE.brust, bizeps: VORNE.bizeps, unterarme: VORNE.unterarme, bauch: VORNE.bauch, schraeg: VORNE.schraeg,
  abduktoren: ['M72 238 C66 244 63 256 63 270 C65 262 69 252 75 246 C74 242 73 240 72 238 Z'],
  quadrizeps: VORNE.quadrizeps, adduktoren: VORNE.adduktoren, waden: VORNE.waden,
};
const SUCH_HINTEN = {
  trapez: ['M100 64 L88 72 C78 78 66 82 58 88 C70 90 82 92 92 96 C96 98 98 100 100 102 Z'],
  oberer_ruecken: ['M100 102 C94 100 86 98 76 100 C82 110 88 122 92 134 C95 140 98 144 100 146 Z'],
  schulter_hinten: HINTEN.schulter_seite, latissimus: HINTEN.latissimus, trizeps: HINTEN.trizeps, unterarme: HINTEN.unterarme,
  ruecken_unten: HINTEN.ruecken_unten,
  abduktoren: ['M100 224 C92 218 80 216 72 222 C68 226 68 232 70 236 C76 228 88 224 100 226 Z'],
  gesaess: HINTEN.gesaess, beinbeuger: HINTEN.beinbeuger, waden: HINTEN.waden,
};
export function MuskelWahl({ zone, waehle }) {
  const farbe = (g) => (g === zone ? 'var(--acc)' : 'var(--muskel-leer)');
  const tippen = (g) => waehle(g === zone ? null : g);
  return html`<div class="muskel-wahl-diagramm">
    <div class="figuren"><${Figur} teile=${SUCH_VORNE} linien=${LINIEN_VORNE} werte=${{}} aktiv=${zone} waehle=${tippen} titel="Vorne" farbe=${farbe}/>
      <${Figur} teile=${SUCH_HINTEN} linien=${LINIEN_HINTEN} werte=${{}} aktiv=${zone} waehle=${tippen} titel="Hinten" farbe=${farbe}/></div>
    <span class="muted" style="font-size:12.5px;text-align:center">${zone ? ZONE_NAME[zone] : 'Muskel antippen'}</span>
  </div>`;
}
