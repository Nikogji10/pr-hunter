// PR Hunter · Diagramme (SVG, Hover/Touch-Tooltip, Tabellenansicht). Farben kommen aus CSS-Variablen:
// --lift-squat/-bench/-dead (geprüfte Palette), --andere (zurückgenommen), --grid, --axis, --seq-0…4.
import { html, useState, useRef, useEffect } from '../vendor/htm-preact.js';
import { einheit, inAnzeige } from './basis.js';

export const fmt = (n, stellen = 1) => n == null ? '–' : n.toLocaleString('de-DE', { maximumFractionDigits: stellen });
export const kurzKg = (n) => {
  if (einheit() === 'lb') { const v = inAnzeige(n); return v >= 1000 ? `${fmt(v / 1000, 1)}k lb` : `${fmt(v, 0)} lb`; }
  return n >= 10000 ? `${fmt(n / 1000, 0)} t` : n >= 1000 ? `${fmt(n / 1000, 1)} t` : `${fmt(n, 0)} kg`;
};
const achseKg = (t) => (!t ? '0' : einheit() === 'lb' ? `${fmt(inAnzeige(t) / 1000, 0)}k` : `${fmt(t / 1000, 0)} t`);
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const datumKurz = (iso) => `${Number(iso.slice(8, 10))}. ${MONATE[Number(iso.slice(5, 7)) - 1]}`;

function schritte(min, max, anzahl = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) [min, max] = [0, 1];
  if (max - min < 1e-9) [min, max] = [Math.max(0, min - 1), max + 1];   // ein einziger Wert oder alles 0
  const roh = (max - min) / anzahl;
  const p = 10 ** Math.floor(Math.log10(roh));
  const schritt = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= roh);   // ganze Achsenwerte, kein 2,5er-Raster
  const lo = Math.floor(min / schritt) * schritt, hi = Math.ceil(max / schritt) * schritt;
  const t = []; for (let v = lo; v <= hi + 1e-9; v += schritt) t.push(+v.toFixed(6));
  return t;
}

function Rahmen({ titel, unter, legende, kinder, tabelle }) {
  const [tab, setTab] = useState(false);
  return html`<figure class="viz">
    <figcaption class="viz-h">
      <div><div class="viz-t">${titel}</div>${unter ? html`<div class="viz-u">${unter}</div>` : null}</div>
      <button class="viz-tab" aria-pressed=${String(tab)} onClick=${() => setTab(!tab)}>${tab ? 'Diagramm' : 'Tabelle'}</button>
    </figcaption>
    ${legende}
    ${tab ? html`<div class="viz-tabelle">${tabelle}</div>` : kinder}
  </figure>`;
}

export function Legende({ serien, art = 'linie' }) {
  return html`<div class="legende">${serien.map((s) => html`<span key=${s.id}>
    <i class=${art === 'linie' ? 'k-linie' : 'k-flaeche'} style=${`background:${s.farbe}`}></i>${s.name}</span>`)}</div>`;
}

/** Index des letzten Werts einer Reihe mit Lücken (null = Woche ohne Training). */
const letzterIndex = (w) => { for (let k = w.length - 1; k >= 0; k--) if (w[k] != null) return k; return -1; };

/** Mehrere Linien über denselben x-Werten (ISO-Daten). Eine Reihe bekommt eine 10-%-Fläche. Lücken werden überbrückt. */
export function LinienChart({ titel, unter, x, serien: alleSerien, einheit = 'kg', hoehe = 220, referenz = null, stellen = 1 }) {
  const [i, setI] = useState(null);
  const ref = useRef(null);
  const serien = alleSerien.filter((s) => letzterIndex(s.werte) >= 0);
  if (!serien.length) {
    return html`<figure class="viz"><figcaption class="viz-h"><div><div class="viz-t">${titel}</div>${unter ? html`<div class="viz-u">${unter}</div>` : null}</div></figcaption>
      <p class="muted" style="margin:0;font-size:14px">Im Zeitraum noch keine Werte.</p></figure>`;
  }
  const W = 340, H = hoehe, L = 34, R = 54, T = 12, U = 26;
  const alle = [...serien.flatMap((s) => s.werte).filter((v) => v != null), ...(referenz ? [referenz.wert] : [])];
  const ticks = schritte(Math.min(...alle), Math.max(...alle));
  const lo = ticks[0], hi = ticks.at(-1);
  const px = (k) => L + (k * (W - L - R)) / Math.max(1, x.length - 1);
  const py = (v) => T + ((hi - v) * (H - T - U)) / (hi - lo || 1);
  const pfad = (w) => w.map((v, k) => [v, k]).filter(([v]) => v != null).map(([v, k], j) => `${j ? 'L' : 'M'}${px(k).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
  // Endbeschriftungen am letzten Wert; bei Kollision (< 13 px) zur Seite rücken mit Verbindungslinie
  const enden = serien.map((s) => { const k = letzterIndex(s.werte); return { s, k, y: py(s.werte[k]) }; }).sort((a, b) => a.y - b.y);
  for (let k = 1; k < enden.length; k++) if (enden[k].y - enden[k - 1].y < 13) enden[k].ly = (enden[k - 1].ly ?? enden[k - 1].y) + 13;
  const monatsTicks = []; let letztes = -Infinity;           // Monatsanfänge, mindestens 34 px auseinander
  x.forEach((d, k) => {
    if ((k === 0 || d.slice(5, 7) !== x[k - 1].slice(5, 7)) && px(k) - letztes >= 34) { monatsTicks.push([d, k]); letztes = px(k); }
  });
  const zeige = (e) => {
    const r = ref.current.getBoundingClientRect();
    const xs = ((e.clientX - r.left) / r.width) * W;
    setI(Math.max(0, Math.min(x.length - 1, Math.round(((xs - L) / (W - L - R)) * (x.length - 1)))));
  };
  const tabelle = html`<table class="rec"><thead><tr><th>Woche</th>${serien.map((s) => html`<th key=${s.id}>${s.name}</th>`)}</tr></thead>
    <tbody>${[...x].reverse().map((d, k) => html`<tr key=${d}><td>${datumKurz(d)}</td>${serien.map((s) => html`<td key=${s.id}>${fmt(s.werte[x.length - 1 - k])}</td>`)}</tr>`)}</tbody></table>`;
  return html`<${Rahmen} titel=${titel} unter=${unter} tabelle=${tabelle}
    legende=${serien.length > 1 ? html`<${Legende} serien=${serien}/>` : null}
    kinder=${html`<div class="viz-plot" onPointerLeave=${() => setI(null)}>
      <svg ref=${ref} viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${titel} onPointerMove=${zeige} onPointerDown=${zeige}>
        ${ticks.map((t) => html`<g key=${t}><line class="g" x1=${L} x2=${W - R} y1=${py(t)} y2=${py(t)}/><text class="ax" x=${L - 6} y=${py(t) + 4} text-anchor="end">${fmt(t, 0)}</text></g>`)}
        ${monatsTicks.map(([d, k]) => html`<text key=${d} class="ax" x=${px(k)} y=${H - 8} text-anchor="middle">${MONATE[Number(d.slice(5, 7)) - 1]}</text>`)}
        ${referenz ? html`<g><line x1=${L} x2=${W - R} y1=${py(referenz.wert)} y2=${py(referenz.wert)} style="stroke:var(--warn)" stroke-width="1.5" stroke-dasharray="5 4"/>
          <text class="ax" x=${L + 4} y=${py(referenz.wert) - 5} style="fill:var(--warn)">${referenz.text}</text></g>` : null}
        ${serien.length === 1 ? html`<path d=${`${pfad(serien[0].werte)} L${px(letzterIndex(serien[0].werte))} ${H - U} L${px(serien[0].werte.findIndex((v) => v != null))} ${H - U} Z`} style=${`fill:${serien[0].farbe};opacity:.1`}/>` : null}
        ${serien.map((s) => html`<path key=${s.id} d=${pfad(s.werte)} fill="none" style=${`stroke:${s.farbe}`} stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`)}
        ${enden.map(({ s, k, y, ly }) => html`<g key=${s.id}>
          <circle cx=${px(k)} cy=${y} r="4.5" style=${`fill:${s.farbe};stroke:var(--surface)`} stroke-width="2"/>
          ${ly ? html`<line x1=${px(k) + 6} y1=${y} x2=${px(k) + 10} y2=${ly} style="stroke:var(--axis)"/>` : null}
          <text class="end" x=${px(k) + 12} y=${(ly ?? y) + 4}>${fmt(s.werte[k], stellen)}</text></g>`)}
        ${i != null ? html`<g>
          <line x1=${px(i)} x2=${px(i)} y1=${T} y2=${H - U} style="stroke:var(--axis)"/>
          ${serien.filter((s) => s.werte[i] != null).map((s) => html`<circle key=${s.id} cx=${px(i)} cy=${py(s.werte[i])} r="4.5" style=${`fill:${s.farbe};stroke:var(--surface)`} stroke-width="2"/>`)}</g>` : null}
      </svg>
      ${i != null ? html`<div class="tip" style=${`left:${Math.min(70, Math.max(4, (px(i) / W) * 100 - 15))}%`}>
        <div class="tip-d">Woche ab ${datumKurz(x[i])}</div>
        ${serien.map((s) => html`<div key=${s.id} class="tip-r"><i class="k-linie" style=${`background:${s.farbe}`}></i><b>${fmt(s.werte[i], stellen)}${einheit ? ` ${einheit}` : ''}</b><span>${s.name}</span></div>`)}
      </div>` : null}
    </div>`}/>`;
}

/** Gestapelte Säulen (Teile eines Ganzen je Woche), 2 px Lücke, abgerundetes Ende nur oben. */
export function StapelSaeulen({ titel, unter, daten, serien, einheit = null }) {
  const [i, setI] = useState(null);
  const wert = (v) => einheit ? `${fmt(v, 0)} ${einheit}` : kurzKg(v);
  const tick = (t) => einheit ? fmt(t, 0) : achseKg(t);
  const W = 340, H = 200, L = 34, R = 6, T = 10, U = 24;
  const summen = daten.map((d) => serien.reduce((a, s) => a + d.teile[s.id], 0));
  const ticks = schritte(0, Math.max(...summen), 4);
  const hi = ticks.at(-1);
  const slot = (W - L - R) / daten.length, b = Math.min(18, slot - 4);
  const py = (v) => T + ((hi - v) * (H - T - U)) / hi;
  const tabelle = html`<table class="rec"><thead><tr><th>Woche</th>${serien.map((s) => html`<th key=${s.id}>${s.name}</th>`)}<th>Summe</th></tr></thead>
    <tbody>${daten.map((d, k) => html`<tr key=${d.label}><td>${datumKurz(d.label)}</td>${serien.map((s) => html`<td key=${s.id}>${wert(d.teile[s.id])}</td>`)}<td>${wert(summen[k])}</td></tr>`)}</tbody></table>`;
  return html`<${Rahmen} titel=${titel} unter=${unter} tabelle=${tabelle} legende=${serien.length > 1 ? html`<${Legende} serien=${serien} art="flaeche"/>` : null}
    kinder=${html`<div class="viz-plot" onPointerLeave=${() => setI(null)}>
      <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${titel}>
        ${ticks.map((t) => html`<g key=${t}><line class="g" x1=${L} x2=${W - R} y1=${py(t)} y2=${py(t)}/><text class="ax" x=${L - 6} y=${py(t) + 4} text-anchor="end">${tick(t)}</text></g>`)}
        ${daten.map((d, k) => {
          let y = py(0); const x0 = L + k * slot + (slot - b) / 2;
          const sichtbar = serien.filter((s) => d.teile[s.id] > 0);
          return html`<g key=${d.label} class=${i === k ? 'hov' : ''} tabindex="0" onPointerEnter=${() => setI(k)} onPointerDown=${() => setI(k)} onFocus=${() => setI(k)}>
            <rect x=${L + k * slot} y=${T} width=${slot} height=${H - T - U} fill="transparent"/>
            ${sichtbar.map((s, j) => {
              const h = (d.teile[s.id] * (H - T - U)) / hi; y -= h;
              const oben = j === sichtbar.length - 1;
              const hoehe = Math.max(0, h - 2);
              return oben
                ? html`<path key=${s.id} d=${`M${x0} ${y + h - 2} V${y + Math.min(4, hoehe)} Q${x0} ${y} ${x0 + 4} ${y} H${x0 + b - 4} Q${x0 + b} ${y} ${x0 + b} ${y + Math.min(4, hoehe)} V${y + h - 2} Z`} style=${`fill:${s.farbe}`}/>`
                : html`<rect key=${s.id} x=${x0} y=${y} width=${b} height=${hoehe} style=${`fill:${s.farbe}`}/>`;
            })}
          </g>`;
        })}
        ${daten.map((d, k) => k % Math.ceil(52 / slot) === 0 ? html`<text key=${d.label} class="ax" x=${L + k * slot + slot / 2} y=${H - 7} text-anchor="middle">${datumKurz(d.label)}</text>` : null)}
      </svg>
      ${i != null ? html`<div class="tip" style=${`left:${Math.min(62, Math.max(2, ((L + i * slot) / W) * 100 - 14))}%`}>
        <div class="tip-d">Woche ab ${datumKurz(daten[i].label)} · ${wert(summen[i])}</div>
        ${serien.length > 1 ? serien.map((s) => html`<div key=${s.id} class="tip-r"><i class="k-flaeche" style=${`background:${s.farbe}`}></i><b>${wert(daten[i].teile[s.id])}</b><span>${s.name}</span></div>`) : null}
      </div>` : null}
    </div>`}/>`;
}

/** Trainingskalender: Spalten = Wochen, Zeilen = Mo–So; Stufe nach bewegten kg (eine Farbe, hell → kräftig). */
export function Heatmap({ titel, unter, von, wochenAnzahl, tage, markiere }) {
  const [tip, setTip] = useState(null);
  const scroll = useRef(null);
  useEffect(() => { if (scroll.current) scroll.current.scrollLeft = scroll.current.scrollWidth; }, [wochenAnzahl]);
  const werte = Object.values(tage).map((t) => t.tonnage);
  const max = Math.max(...werte);
  const stufe = (v) => !v ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3.999));
  const Z = 12, G = 3, L = 18;
  const W = L + wochenAnzahl * (Z + G), H = 7 * (Z + G) + 16;
  const zellen = [];
  for (let w = 0; w < wochenAnzahl; w++) for (let d = 0; d < 7; d++) {
    const iso = new Date(Date.parse(`${von}T00:00:00Z`) + (w * 7 + d) * 864e5).toISOString().slice(0, 10);
    zellen.push({ iso, w, d, t: tage[iso] });
  }
  const tabelle = html`<table class="rec"><thead><tr><th>Datum</th><th>Lifts</th><th>bewegt</th></tr></thead>
    <tbody>${Object.entries(tage).sort().reverse().map(([iso, t]) => html`<tr key=${iso}><td>${datumKurz(iso)}</td><td>${t.lifts.length}</td><td>${kurzKg(t.tonnage)}</td></tr>`)}</tbody></table>`;
  return html`<${Rahmen} titel=${titel} unter=${unter} tabelle=${tabelle} kinder=${html`<div class="viz-plot" onPointerLeave=${() => setTip(null)}>
    <div class="heat-scroll" ref=${scroll}><svg viewBox=${`0 0 ${W} ${H}`} style=${`width:${W}px;max-width:${wochenAnzahl > 26 ? 'none' : '100%'}`} role="img" aria-label=${titel}>
      ${['Mo', '', 'Mi', '', 'Fr', '', 'So'].map((t, d) => t ? html`<text key=${d} class="ax" x="0" y=${d * (Z + G) + 10}>${t}</text>` : null)}
      ${zellen.map((z) => html`<rect key=${z.iso} x=${L + z.w * (Z + G)} y=${z.d * (Z + G)} width=${Z} height=${Z} rx="3"
        class=${markiere?.(z.iso) ? 'heat-urlaub' : ''} style=${`fill:var(--seq-${stufe(z.t?.tonnage)})`}
        onPointerEnter=${() => setTip(z)} onPointerDown=${() => setTip(z)}/>`)}
      ${zellen.filter((z) => z.d === 0 && z.iso.slice(8, 10) <= '07').map((z) => html`<text key=${'m' + z.iso} class="ax" x=${L + z.w * (Z + G)} y=${H - 2}>${MONATE[Number(z.iso.slice(5, 7)) - 1]}</text>`)}
    </svg></div>
    <div class="row between" style="margin-top:8px">
      <span class="viz-u">${tip ? html`<b style="color:var(--ink)">${datumKurz(tip.iso)}</b> · ${tip.t ? `${kurzKg(tip.t.tonnage)} bewegt` : markiere?.(tip.iso) ? 'Urlaub' : 'kein Training'}` : 'Tippe auf einen Tag'}</span>
      <span class="skala">weniger ${[0, 1, 2, 3, 4].map((s) => html`<i key=${s} style=${`background:var(--seq-${s})`}></i>`)} mehr</span>
    </div>
  </div>`}/>`;
}

export function Sparkline({ werte, farbe }) {
  const punkte = werte.map((v, k) => [v, k]).filter(([v]) => v != null);
  if (!punkte.length) return null;
  const W = 96, H = 28, lo = Math.min(...punkte.map(([v]) => v)), hi = Math.max(...punkte.map(([v]) => v));
  const px = (k) => 2 + (k * (W - 8)) / Math.max(1, werte.length - 1), py = (v) => 3 + ((hi - v) * (H - 6)) / (hi - lo || 1);
  const [lv, lk] = punkte.at(-1);
  return html`<svg class="spark" viewBox=${`0 0 ${W} ${H}`} aria-hidden="true">
    <path d=${punkte.map(([v, k], j) => `${j ? 'L' : 'M'}${px(k).toFixed(1)} ${py(v).toFixed(1)}`).join(' ')} fill="none" style=${`stroke:${farbe}`} stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx=${px(lk)} cy=${py(lv)} r="3.5" style=${`fill:${farbe};stroke:var(--surface)`} stroke-width="2"/>
  </svg>`;
}

/** Waagrechte Balken für eine Rangliste (eine Reihe, eine Farbe), Wert am Balkenende. */
export function Rangliste({ titel, unter, zeilen, einheit = '' }) {
  const max = Math.max(...zeilen.map((z) => z.wert), 1);
  const tabelle = html`<table class="rec"><thead><tr><th>${titel}</th><th>Wert</th></tr></thead>
    <tbody>${zeilen.map((z) => html`<tr key=${z.name}><td>${z.name}</td><td>${fmt(z.wert)}${einheit}</td></tr>`)}</tbody></table>`;
  return html`<${Rahmen} titel=${titel} unter=${unter} tabelle=${tabelle} kinder=${html`<div class="rangliste">
    ${zeilen.map((z) => html`<div key=${z.name} class="rl-zeile"><span class="rl-name">${z.name}</span>
      <span class="rl-spur"><i style=${`width:${(z.wert / max) * 100}%`}></i></span><b>${fmt(z.wert)}${einheit}</b></div>`)}
  </div>`}/>`;
}

/** Anteile in geordneten Stufen (z. B. Intensitätszonen): ein 100-%-Balken, Stufen einer Farbe. */
export function ZonenBalken({ titel, unter, zonen }) {
  const summe = zonen.reduce((a, z) => a + z.wert, 0);
  if (!summe) return null;
  const tabelle = html`<table class="rec"><thead><tr><th>Zone</th><th>Sätze</th><th>Anteil</th></tr></thead>
    <tbody>${zonen.map((z) => html`<tr key=${z.name}><td>${z.name}</td><td>${z.wert}</td><td>${fmt((z.wert / summe) * 100, 0)} %</td></tr>`)}</tbody></table>`;
  return html`<${Rahmen} titel=${titel} unter=${unter} tabelle=${tabelle} kinder=${html`<div>
    <div class="zonen">${zonen.map((z, k) => html`<div key=${z.name} title=${`${z.name}: ${z.wert} Sätze`} style=${`flex:${z.wert};background:var(--seq-${k + 1})`}></div>`)}</div>
    <div class="zonen-l">${zonen.map((z, k) => html`<div key=${z.name}><i style=${`background:var(--seq-${k + 1})`}></i><b>${fmt((z.wert / summe) * 100, 0)} %</b><span>${z.name}</span></div>`)}</div>
  </div>`}/>`;
}
