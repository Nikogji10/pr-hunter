// PR Hunter · 295: zwei Satz-Videos vergleichen (z. B. heute gegen letzte Woche). Beide Videos nebeneinander (Querformat:
// untereinander), gemeinsam ab der ersten Wdh abspielen, Bahnen eingezeichnet, Tempo-Kurven übereinander, Zahlen im
// Vergleich. Wird aus satzvideo.js erst beim Öffnen geladen.
import { html, useState, useEffect, useRef, Sheet, Portal, deEn, fmt, fmt2, vz, datumKurz, I } from './basis.js';
import { kanon } from './stand.js';
import { videoLaden, alleVideoMeta, maleBahn } from './satzvideo.js';
import { tempoKurve, wdhDetails } from '../js/hantelweg.js';

const FARBEN = ['var(--acc-hi)', '#5aa9ff'];
const schnitt = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
function kennzahlen(r) {
  const w = r.analyse?.wdh ?? [], v = w.map((x) => x.mcv), d = wdhDetails(r.analyse?.punkte, w, r.analyse?.mProPx);
  return { n: w.length, avg: schnitt(v), beste: v.length ? Math.max(...v) : null, vl: r.analyse?.verlust ?? null,
    hub: schnitt(d.map((x) => x.hubCm)), seit: schnitt(d.map((x) => x.seitCm).filter((x) => x != null)) };
}
const beschriftung = (r) => `${r.erstellt ? datumKurz(r.erstellt.slice(0, 10)) : '–'}${r.kg != null ? ` · ${fmt(r.kg)} × ${r.wdh ?? '?'}` : ''}${r.rpe != null ? ` @ ${fmt(r.rpe)}` : ''}`;

export function VideoVergleich({ basis, titel, zu }) {
  const [liste, setListe] = useState(null);
  const [anderes, setAnderes] = useState(null);
  useEffect(() => {
    alleVideoMeta().then((alle) => setListe(alle
      .filter((r) => r.id !== basis.id && r.bytes > 0 && r.analyse?.wdh?.length && r.analyse?.punkte?.length > 1 && (kanon(r.key) === kanon(basis.key) || (basis.lift && basis.lift !== 'andere' && r.lift === basis.lift)))
      .sort((a, b) => (b.erstellt ?? '').localeCompare(a.erstellt ?? '')))).catch(() => setListe([]));
  }, []);
  const waehle = async (m) => { const r = await videoLaden(m.id).catch(() => null); if (r?.blob && r.analyse?.punkte?.length > 1) setAnderes(r); };
  return html`<${Portal}><${Sheet} zu=${zu} label=${deEn('Videos vergleichen', 'Compare videos')} voll=${true}><div class="vv">
    <div class="row between" style="align-items:flex-start"><div><div class="eyebrow">${deEn('Vergleich', 'Comparison')}</div><h2 class="h2 sv-titel">${titel}</h2></div>
      <button class="iconbtn" onClick=${zu} aria-label=${deEn('Schließen', 'Close')}>${I.zu}</button></div>
    ${anderes ? html`<${Vergleich} a=${basis} b=${anderes} zurueck=${() => setAnderes(null)}/>`
      : liste == null ? html`<div class="sv-leer"><span class="sv-lader"></span></div>`
        : !liste.length ? html`<p class="muted" style="margin:0">${deEn('Noch kein anderes Video dieser Übung mit Hantelweg auf diesem Gerät.', 'No other video of this exercise with a bar path on this device yet.')}</p>`
          : html`<span class="muted sv-fuss">${deEn('Womit vergleichen?', 'Compare with which one?')}</span>
            <div class="vv-liste">${liste.map((m) => { const k = kennzahlen(m); return html`<button key=${m.id} class="vv-zeile" onClick=${() => waehle(m)}>
              <span><b>${beschriftung(m)}</b><small>${k.n} ${deEn('Wdh', 'reps')}${k.vl != null ? ` · ${deEn('Verlust', 'loss')} ${vz(-k.vl)} %` : ''}</small></span>
              <b class="vv-wert">${fmt2(k.avg)}<small> m/s</small></b></button>`; })}</div>`}
  </div><//><//>`;
}

function Vergleich({ a, b, zurueck }) {
  const recs = [a, b];
  const [urls, setUrls] = useState([null, null]);
  const [masse, setMasse] = useState([null, null]);
  const [spielt, setSpielt] = useState(false);
  const [langsam, setLangsam] = useState(true);
  const [rel, setRel] = useState(0);
  const v0 = useRef(null), v1 = useRef(null), c0 = useRef(null), c1 = useRef(null);
  const vids = [v0, v1], cans = [c0, c1];
  useEffect(() => { const u = [URL.createObjectURL(a.blob), URL.createObjectURL(b.blob)]; setUrls(u); return () => u.forEach((x) => URL.revokeObjectURL(x)); }, [a.id, b.id]);
  // beide ab kurz vor der ersten Wdh, bis kurz nach der letzten
  const start = recs.map((r) => Math.max(0, (r.analyse?.wdh?.[0]?.von ?? r.analyse?.punkte?.[0]?.t ?? 0) - 0.4));
  const ende = recs.map((r) => (r.analyse?.wdh?.at(-1)?.bis ?? r.analyse?.punkte?.at(-1)?.t ?? 0) + 0.4);
  const laenge = Math.max(0.5, ende[0] - start[0], ende[1] - start[1]);
  const male = () => recs.forEach((r, i) => {
    const c = cans[i].current, v = vids[i].current;
    if (!c || !v) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
    if (!W || !H) return;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    maleBahn(ctx, r.analyse, { wdh: r.analyse.wdh, bis: v.currentTime, s: W / r.analyse.breite, lw: dpr });
  });
  useEffect(() => {
    let id = 0;
    const f = () => {
      male();
      vids.forEach((v, i) => { const el = v.current; if (el && !el.paused && el.currentTime >= ende[i]) el.pause(); });
      const el = vids[0].current;
      if (el) setRel(Math.max(0, Math.min(laenge, el.currentTime - start[0])));
      if (vids.every((v) => !v.current || v.current.paused)) { if (spielt) setSpielt(false); return; }
      id = requestAnimationFrame(f);
    };
    if (spielt) id = requestAnimationFrame(f); else male();
    return () => cancelAnimationFrame(id);
  }, [spielt, urls, masse]);
  const abspielen = () => {
    if (spielt) { vids.forEach((v) => v.current?.pause()); setSpielt(false); return; }
    const ab = rel >= laenge - 0.05 ? 0 : rel;
    vids.forEach((v, i) => { const el = v.current; if (!el) return; el.currentTime = Math.min(start[i] + ab, ende[i]); el.playbackRate = langsam ? 0.5 : 1; el.play()?.catch?.(() => {}); });
    setSpielt(true);
  };
  const springen = (x) => {
    vids.forEach((v, i) => { const el = v.current; if (el) { el.pause(); el.currentTime = Math.min(start[i] + x, ende[i]); } });
    setSpielt(false); setRel(x); setTimeout(male, 80);
  };
  const quer = masse.every((m) => m && m.w > m.h);
  const k = recs.map(kennzahlen);
  // Δ: Tempo in %, Verlust in Prozentpunkten, cm absolut; „besser“ = Richtung, die grün wird
  const pkt = deEn('Pkt.', 'pts');
  const zeilen = [
    [deEn('Wdh', 'Reps'), (x) => x.n, (x) => String(x), null, null],
    [deEn('Ø Tempo', 'Avg. velocity'), (x) => x.avg, fmt2, 'hoch', 'pct'],
    [deEn('Schnellste', 'Fastest'), (x) => x.beste, fmt2, 'hoch', 'pct'],
    [deEn('Verlust', 'Loss'), (x) => x.vl, (x) => `${vz(-x)} %`, 'tief', (d) => `${vz(d)} ${pkt}`],
    [deEn('Hub Ø', 'ROM avg.'), (x) => x.hub, (x) => `${fmt(x, 0)} cm`, null, (d) => `${vz(d)} cm`],
    [deEn('Seitlich Ø', 'Sideways avg.'), (x) => x.seit, (x) => `${fmt(x, 1)} cm`, 'tief', (d) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${fmt(Math.abs(d), 1)} cm`],
  ];
  return html`<div class="vv-ansicht">
    <div class=${`vv-buehnen ${quer ? 'quer' : ''}`}>${recs.map((r, i) => html`<div key=${r.id} class="vv-seite">
      <span class="vv-name"><i style=${`background:${FARBEN[i]}`}></i>${i ? deEn('Früher', 'Earlier') : deEn('Dieses', 'This one')} · ${beschriftung(r)}</span>
      <div class="vv-buehne" style=${masse[i] ? `aspect-ratio:${masse[i].w} / ${masse[i].h}` : 'aspect-ratio:9 / 16'} onClick=${abspielen}>
        <video ref=${vids[i]} src=${urls[i]} playsinline muted preload="auto" disablepictureinpicture
          onLoadedMetadata=${(e) => { const v = e.currentTarget; setMasse((m) => m.map((x, j) => (j === i ? { w: v.videoWidth, h: v.videoHeight } : x))); v.currentTime = start[i]; }}
          onSeeked=${male}/>
        <canvas ref=${cans[i]} class="sv-ueber"></canvas>
      </div></div>`)}</div>
    <div class="sv-steuer">
      <button class="iconbtn sv-play" onClick=${abspielen} aria-label=${spielt ? deEn('Pause', 'Pause') : deEn('Abspielen', 'Play')}>${spielt ? html`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>` : html`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>`}</button>
      <div class="sv-zeitleiste"><input type="range" class="sv-zeit" min="0" max=${laenge} step="0.01" value=${rel} aria-label=${deEn('Zeit ab der 1. Wdh', 'Time from rep 1')} onInput=${(e) => springen(Number(e.currentTarget.value))}/></div>
      <button class=${`chip sv-tempo ${langsam ? 'an' : ''}`} aria-pressed=${String(langsam)} onClick=${() => { const n = !langsam; setLangsam(n); vids.forEach((v) => { if (v.current) v.current.playbackRate = n ? 0.5 : 1; }); }}>0,5×</button>
    </div>
    <${Kurven} recs=${recs} start=${start} laenge=${laenge} rel=${rel} springen=${springen}/>
    <div class="vv-tabelle" role="table">
      <span role="columnheader"></span>${recs.map((r, i) => html`<span key=${i} role="columnheader" class="vv-kopf"><i style=${`background:${FARBEN[i]}`}></i>${i ? deEn('Früher', 'Earlier') : deEn('Dieses', 'This one')}</span>`)}<span role="columnheader" class="vv-kopf">Δ</span>
      ${zeilen.map(([name, wert, text, besser, diff]) => {
        const [x, y] = k.map(wert);
        let d = null;
        if (x != null && y != null && diff === 'pct' && y !== 0) d = Math.round(((x - y) / Math.abs(y)) * 100);
        else if (x != null && y != null && diff) d = Math.round((x - y) * 10) / 10;
        const gut = d == null || d === 0 || !besser ? '' : (besser === 'hoch' ? d > 0 : d < 0) ? 'gut' : 'schlecht';
        const dText = d == null ? '' : diff === 'pct' ? `${vz(d)} %` : diff(name === deEn('Verlust', 'Loss') ? -d : d);
        return html`<span key=${name} class="vv-l">${name}</span><span>${x == null ? '–' : text(x)}</span><span>${y == null ? '–' : text(y)}</span><span class=${`vv-d ${gut}`}>${dText}</span>`;
      })}
    </div>
    <span class="muted sv-fuss">${deEn('Beide Videos starten kurz vor ihrer ersten Wdh. Tippen aufs Video spielt ab oder hält an.', 'Both videos start just before their first rep. Tap a video to play or pause.')}</span>
    <button class="btn btn-soft btn-block" onClick=${zurueck}>${deEn('Anderes Video wählen', 'Choose another video')}</button>
  </div>`;
}

/** Tempo-Kurven beider Videos übereinander, ab der ersten Wdh; Tippen springt. */
function Kurven({ recs, start, laenge, rel, springen }) {
  const W = 340, H = 96, L = 6, R = 6, T = 8, U = 8;
  const kurven = recs.map((r, i) => tempoKurve(r.analyse.punkte, r.analyse.mProPx).map((p) => ({ t: p.t - start[i], v: p.v })).filter((p) => p.t >= 0 && p.t <= laenge));
  const alle = kurven.flat().map((p) => p.v);
  if (!alle.length) return null;
  const hi = Math.max(0.5, ...alle), lo = Math.min(-0.5, ...alle);
  const px = (t) => L + (t * (W - L - R)) / laenge, py = (v) => T + ((hi - v) * (H - T - U)) / (hi - lo);
  const tippe = (e) => { const r = e.currentTarget.getBoundingClientRect(); springen(Math.max(0, Math.min(laenge, ((((e.clientX - r.left) / r.width) * W - L) / (W - L - R)) * laenge))); };
  return html`<div class="sv-kurve vv-kurve"><svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${deEn('Tempo beider Videos über die Zeit', 'Velocity of both videos over time')} onPointerDown=${tippe}>
    <line x1=${L} x2=${W - R} y1=${py(0)} y2=${py(0)} class="sv-kurve-null"/>
    ${kurven.map((k, i) => html`<path key=${i} d=${k.map((p, j) => `${j ? 'L' : 'M'}${px(p.t).toFixed(1)} ${py(p.v).toFixed(1)}`).join(' ')} fill="none" stroke=${FARBEN[i]} stroke-width="2.2" stroke-linejoin="round" opacity=${i ? 0.9 : 1}/>`)}
    <line x1=${px(rel)} x2=${px(rel)} y1=${T - 4} y2=${H - U} class="sv-kurve-kopf"/>
  </svg></div>`;
}
