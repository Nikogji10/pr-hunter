// PR Hunter · 311: Bereitschaft im Verlauf. Alle Antworten des Readiness-Checks vor dem Training – Schlaf, Energie,
// Stress, Muskelkater (je 1–5, wie eingegeben) – und der Gesamtwert als weiche Linien im Zeitraum der Statistik.
// Antippen oder mit dem Finger fahren zeigt einen Tag mit allen Werten; Chips blenden Linien ein und aus.
import { html, useState, useRef, fmt, deEn, datumKurz, datumLang, speicher, sprache } from './basis.js';
import { HEUTE, plusTage } from './stand.js';
import { tageZwischen } from '../js/daten.js';
import { bereitschaftsTage, bereitschaftJeWoche, bereitschaftsSchnitt, bereitschaftsTrend, bereitschaftsStufe, HOCH_GUT } from '../js/bereitschaft.js';

const SERIEN = [
  { id: 'wert', de: 'Bereitschaft', en: 'Readiness', farbe: '#34C77B' },
  { id: 'sleep', de: 'Schlaf', en: 'Sleep', farbe: '#7C9CFF' },
  { id: 'energy', de: 'Energie', en: 'Energy', farbe: '#FFB547' },
  { id: 'stress', de: 'Stress', en: 'Stress', farbe: '#FF6B81' },
  { id: 'soreness', de: 'Muskelkater', en: 'Soreness', farbe: '#C38BFF' },
];
// Wörter zu den Stufen 1–5 (wie im Check: 1 = …, 5 = …)
const WORTE = {
  sleep: [['sehr schlecht', 'very poor'], ['schlecht', 'poor'], ['okay', 'okay'], ['gut', 'good'], ['sehr gut', 'very good']],
  energy: [['leer', 'empty'], ['müde', 'tired'], ['okay', 'okay'], ['gut', 'good'], ['voll da', 'fully charged']],
  stress: [['keiner', 'none'], ['wenig', 'low'], ['mittel', 'medium'], ['hoch', 'high'], ['sehr hoch', 'very high']],
  soreness: [['keiner', 'none'], ['leicht', 'light'], ['spürbar', 'noticeable'], ['deutlich', 'clear'], ['stark', 'strong']],
};
const name = (s) => (sprache() === 'en' ? s.en : s.de);
const wort = (k, v) => (WORTE[k] && Number.isInteger(v) ? WORTE[k][v - 1]?.[sprache() === 'en' ? 1 : 0] ?? '' : '');
const f1 = (v) => (v == null ? '–' : fmt(v, 1));

/** Weiche Kurve ohne Überschwingen (monotone kubische Interpolation): bleibt zwischen den Punkten im Bereich 1–5. */
function glatt(p) {
  const r = (v) => v.toFixed(1), n = p.length;
  if (!n) return '';
  if (n < 3) return p.map(([x, y], k) => `${k ? 'L' : 'M'}${r(x)} ${r(y)}`).join(' ');
  const dx = [], m = [];
  for (let k = 0; k < n - 1; k++) { dx[k] = p[k + 1][0] - p[k][0]; m[k] = dx[k] ? (p[k + 1][1] - p[k][1]) / dx[k] : 0; }
  const t = [m[0]];
  for (let k = 1; k < n - 1; k++) t[k] = m[k - 1] * m[k] <= 0 ? 0 : (3 * (dx[k - 1] + dx[k])) / ((2 * dx[k] + dx[k - 1]) / m[k - 1] + (dx[k] + 2 * dx[k - 1]) / m[k]);
  t[n - 1] = m[n - 2];
  let d = `M${r(p[0][0])} ${r(p[0][1])}`;
  for (let k = 0; k < n - 1; k++) {
    const h = dx[k] / 3;
    d += ` C${r(p[k][0] + h)} ${r(p[k][1] + t[k] * h)} ${r(p[k + 1][0] - h)} ${r(p[k + 1][1] - t[k + 1] * h)} ${r(p[k + 1][0])} ${r(p[k + 1][1])}`;
  }
  return d;
}

export function BereitschaftVerlauf({ trainings, von, aus = false }) {
  const [sichtWahl, setSichtWahl] = useState(() => speicher.lies('prh-bereit-sicht'));   // 'tage' | 'wochen' | null = automatisch
  const [an, setAn] = useState(() => new Set(SERIEN.map((s) => s.id)));
  const [gewaehlt, setGewaehlt] = useState(null);
  const ref = useRef(null);
  const alle = bereitschaftsTage(trainings);
  const im = alle.filter((e) => e.datum >= von && e.datum <= HEUTE);
  const kopf = html`<div class="bv-titel"><span class="viz-t">${deEn('Bereitschaft im Verlauf', 'Readiness over time')}</span>
    <div class="viz-u">${deEn('Deine Antworten vor dem Training, je 1–5', 'Your answers before training, each 1–5')}</div></div>`;
  if (!alle.length || !im.length) {
    const letzter = alle.at(-1)?.datum;
    return html`<section class="card pad stack bv">${kopf}
      <p class="muted" style="margin:0;font-size:13.5px">${!alle.length
        ? (aus ? deEn('Der Readiness-Check ist aus. In Einstellungen → Training einschalten, dann entsteht hier dein Verlauf.', 'The readiness check is off. Turn it on in Settings → Training and your history builds up here.')
          : deEn('Noch keine Antworten. Vor jedem Training fragt die App Schlaf, Stress, Muskelkater und Energie ab – daraus entsteht hier dein Verlauf.', 'No answers yet. Before each session the app asks about sleep, stress, soreness and energy – your history builds up here.'))
        : deEn(`Im Zeitraum kein Check. Letzter am ${datumKurz(letzter)}${letzter.slice(0, 4)}.`, `No check in this period. Last one on ${datumKurz(letzter)}${letzter.slice(0, 4)}.`)}</p></section>`;
  }
  const sicht = sichtWahl === 'tage' || sichtWahl === 'wochen' ? sichtWahl : im.length > 40 ? 'wochen' : 'tage';
  const punkte = sicht === 'wochen' ? bereitschaftJeWoche(im) : im;
  const setSicht = (s) => { setSichtWahl(s); setGewaehlt(null); speicher.schreib('prh-bereit-sicht', s); };
  const schnitt = bereitschaftsSchnitt(im);
  // Vergleich mit dem gleich langen Zeitraum davor
  const laenge = Math.max(7, tageZwischen(von, HEUTE));
  const vorher = alle.filter((e) => e.datum < von && e.datum >= plusTage(von, -laenge));
  const trend = vorher.length ? bereitschaftsTrend(schnitt, bereitschaftsSchnitt(vorher)) : {};

  // #################################################################
  // Diagramm
  // #################################################################
  const W = 340, H = 196, L = 22, R = 10, T = 10, U = 22;
  const ms = punkte.map((e) => Date.parse(`${e.datum}T00:00:00Z`)), t0 = ms[0], t1 = ms.at(-1);
  const px = (k) => (punkte.length === 1 ? (L + W - R) / 2 : L + ((ms[k] - t0) * (W - L - R)) / (t1 - t0));
  const py = (v) => T + ((5.3 - v) * (H - T - U)) / 4.6;
  const sichtbar = SERIEN.filter((s) => an.has(s.id));
  const linie = (id) => glatt(punkte.map((e, k) => [e[id], k]).filter(([v]) => v != null).map(([v, k]) => [px(k), py(v)]));
  const haupt = punkte.map((e, k) => [e.wert, k]).filter(([v]) => v != null);
  const flaeche = an.has('wert') && haupt.length > 1
    ? `${linie('wert')} L${px(haupt.at(-1)[1]).toFixed(1)} ${H - U} L${px(haupt[0][1]).toFixed(1)} ${H - U} Z` : null;
  const k = gewaehlt != null && gewaehlt < punkte.length ? gewaehlt : punkte.length - 1, e = punkte[k];
  const zeige = (ev) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((ev.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let j = 1; j < punkte.length; j++) if (Math.abs(px(j) - x) < Math.abs(px(best) - x)) best = j;
    setGewaehlt(best);
  };
  // Datumsmarken: Anfang, Ende und bis zu zwei dazwischen, nicht enger als 70 px
  const marken = [];
  for (const j of [0, Math.round((punkte.length - 1) / 3), Math.round(((punkte.length - 1) * 2) / 3), punkte.length - 1]) {
    if (marken.some((m) => Math.abs(px(m) - px(j)) < 70)) continue;
    marken.push(j);
  }
  const umschalten = (id) => setAn((a) => { const n = new Set(a); if (n.has(id)) { if (n.size > 1) n.delete(id); } else n.add(id); return n; });

  // #################################################################
  // Satz zum Zeitraum: größte Veränderung, sonst stärkster und schwächster Wert
  // #################################################################
  const satz = (() => {
    const felder = ['sleep', 'energy', 'stress', 'soreness'], s = (id) => SERIEN.find((x) => x.id === id);
    const mitTrend = felder.filter((f) => trend[f]?.besser != null).sort((a, b) => Math.abs(trend[b].d) - Math.abs(trend[a].d));
    if (mitTrend.length && Math.abs(trend[mitTrend[0]].d) >= 0.3) {
      const f = mitTrend[0], tr = trend[f], hoch = tr.d > 0;
      return deEn(`${s(f).de} ist gegenüber dem Zeitraum davor ${hoch ? 'gestiegen' : 'gesunken'} (${hoch ? '+' : '−'}${fmt(Math.abs(tr.d), 1)}) – ${tr.besser ? 'gut so.' : 'behalte das im Blick.'}`,
        `${s(f).en} has ${hoch ? 'risen' : 'dropped'} compared with the period before (${hoch ? '+' : '−'}${fmt(Math.abs(tr.d), 1)}) – ${tr.besser ? 'nice.' : 'keep an eye on it.'}`);
    }
    const gut = (f) => (schnitt[f] == null ? null : HOCH_GUT[f] ? schnitt[f] : 6 - schnitt[f]);
    const sortiert = felder.filter((f) => gut(f) != null).sort((a, b) => gut(b) - gut(a));
    if (sortiert.length < 2 || gut(sortiert[0]) - gut(sortiert.at(-1)) < 0.5) return null;
    const a = sortiert[0], b = sortiert.at(-1);
    return deEn(`Am besten steht es um ${s(a).de} (Ø ${f1(schnitt[a])}), am meisten bremst ${s(b).de} (Ø ${f1(schnitt[b])}).`,
      `${s(a).en} looks best (avg ${f1(schnitt[a])}), ${s(b).en} holds you back most (avg ${f1(schnitt[b])}).`);
  })();

  const pfeil = (tr) => (!tr || tr.d === 0 ? null : html`<span class=${`bv-trend ${tr.besser ? 'gut' : 'schlecht'}`}>${tr.d > 0 ? '▲' : '▼'} ${fmt(Math.abs(tr.d), 1)}</span>`);
  return html`<section class="card pad stack bv">
    <div class="row between" style="align-items:flex-start;gap:10px">${kopf}
      <div class="seg bv-seg" role="group" aria-label=${deEn('Darstellung', 'View')}>
        <button aria-pressed=${String(sicht === 'tage')} onClick=${() => setSicht('tage')}>${deEn('Tage', 'Days')}</button>
        <button aria-pressed=${String(sicht === 'wochen')} onClick=${() => setSicht('wochen')}>${deEn('Wochen', 'Weeks')}</button></div></div>
    <div class="bv-held">
      <b class=${`zahl tab-num bv-${bereitschaftsStufe('wert', schnitt.wert)}`}>${f1(schnitt.wert)}</b><small>/ 5</small>
      ${pfeil(trend.wert)}
      <span class="muted bv-held-text">${deEn(`Ø Bereitschaft · ${im.length} ${im.length === 1 ? 'Check' : 'Checks'}`, `Avg readiness · ${im.length} ${im.length === 1 ? 'check' : 'checks'}`)}</span>
    </div>
    <div class="bv-chips" role="group" aria-label=${deEn('Linien', 'Lines')}>${SERIEN.map((s) => html`<button key=${s.id} class="chip bv-chip" aria-pressed=${String(an.has(s.id))}
      style=${`--c:${s.farbe}`} onClick=${() => umschalten(s.id)}><i aria-hidden="true"></i>${name(s)}</button>`)}</div>
    <div class="bv-plot kein-wisch">
      <svg ref=${ref} viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${deEn('Verlauf der Bereitschaft', 'Readiness history')}
        onPointerDown=${zeige} onPointerMove=${(ev) => { if (ev.buttons || ev.pointerType === 'touch') zeige(ev); }}>
        <defs>
          <linearGradient id="bv-verlauf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34C77B" stop-opacity=".38"/><stop offset="1" stop-color="#34C77B" stop-opacity="0"/></linearGradient>
          <linearGradient id="bv-zonen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34C77B" stop-opacity=".07"/><stop offset=".5" stop-color="#FFB547" stop-opacity=".04"/><stop offset="1" stop-color="#FF6B81" stop-opacity=".07"/></linearGradient>
        </defs>
        <rect x=${L} y=${py(5.3)} width=${W - L - R} height=${py(0.7) - py(5.3)} rx="10" fill="url(#bv-zonen)"/>
        ${[1, 2, 3, 4, 5].map((v) => html`<g key=${v}><line class="bv-gitter" x1=${L} x2=${W - R} y1=${py(v)} y2=${py(v)}/>
          <text class="bv-achse" x=${L - 8} y=${py(v) + 3.5} text-anchor="middle">${v}</text></g>`)}
        ${flaeche ? html`<path class="bv-flaeche" d=${flaeche} fill="url(#bv-verlauf)"/>` : null}
        ${gewaehlt != null ? html`<line class="bv-cursor" x1=${px(k)} x2=${px(k)} y1=${T} y2=${H - U}/>` : null}
        ${[...sichtbar].reverse().map((s) => html`<path key=${`${s.id}-${sicht}`} class=${`bv-linie ${s.id === 'wert' ? 'haupt' : ''}`} d=${linie(s.id)} pathLength="1"
          style=${`--c:${s.farbe}`} stroke=${s.farbe}/>`)}
        ${an.has('wert') && punkte.length <= 40 ? haupt.map(([v, j]) => html`<circle key=${j} class="bv-punkt" cx=${px(j)} cy=${py(v)} r="2.6"/>`) : null}
        ${sichtbar.filter((s) => e[s.id] != null).map((s) => html`<circle key=${`w-${s.id}`} class="bv-wahl" cx=${px(k)} cy=${py(e[s.id])} r=${s.id === 'wert' ? 5.5 : 4} fill=${s.farbe}/>`)}
        ${marken.map((j) => html`<text key=${`m${j}`} class="bv-achse" x=${Math.min(W - R - 18, Math.max(L + 18, px(j)))} y=${H - 6} text-anchor="middle">${datumKurz(punkte[j].datum)}</text>`)}
      </svg>
    </div>
    <div class="bv-tag" aria-live="polite">
      <div class="bv-tag-kopf"><div style="min-width:0"><b>${sicht === 'wochen' ? deEn(`Woche ab ${datumKurz(e.datum)}`, `Week of ${datumKurz(e.datum)}`) : datumLang(e.datum)}</b>
        <span class="muted">${sicht === 'wochen' ? deEn(`${e.n} ${e.n === 1 ? 'Check' : 'Checks'}`, `${e.n} ${e.n === 1 ? 'check' : 'checks'}`) : gewaehlt == null ? deEn('letzter Check', 'latest check') : deEn('gewählter Tag', 'selected day')}</span></div>
        <span class=${`bv-tag-wert ${an.has('wert') ? '' : 'aus'}`}><small>${name(SERIEN[0])}</small><b class=${`tab-num bv-${bereitschaftsStufe('wert', e.wert)}`}>${f1(e.wert)}</b></span></div>
      <div class="bv-werte">${SERIEN.slice(1).map((s) => html`<div key=${s.id} class=${`bv-wert ${an.has(s.id) ? '' : 'aus'}`} style=${`--c:${s.farbe}`}>
        <span class="bv-name"><i aria-hidden="true"></i>${name(s)}</span><b class="tab-num">${f1(e[s.id])}</b><small class="muted">${wort(s.id, e[s.id])}</small></div>`)}</div>
    </div>
    <div class="bv-kacheln">${SERIEN.slice(1).map((s) => html`<div key=${s.id} class="bv-kachel" style=${`--c:${s.farbe}`}>
      <span class="bv-name"><i aria-hidden="true"></i>${name(s)}</span>
      <b class=${`tab-num bv-${bereitschaftsStufe(s.id, schnitt[s.id])}`}>${f1(schnitt[s.id])}</b>
      <span class="bv-unter">${pfeil(trend[s.id]) ?? html`<small class="muted">${HOCH_GUT[s.id] ? deEn('hoch = gut', 'high = good') : deEn('niedrig = gut', 'low = good')}</small>`}</span></div>`)}</div>
    ${satz ? html`<p class="bv-satz">${satz}</p>` : null}
    ${vorher.length ? html`<span class="muted" style="font-size:12px">${deEn('Pfeile: Veränderung gegenüber dem gleich langen Zeitraum davor, grün = in die gute Richtung.', 'Arrows: change compared with the same length of time before, green = the good direction.')}</span>` : null}
  </section>`;
}
