// PR Hunter · Statistik → Tempo (Wunsch 279). Sätze mit Hantel-Tempo (Satz-Video, Feld „Tempo (m/s)“, Rechner → Hantelweg)
// je Übung: Gewicht ↔ Tempo mit e1RM aus dem Tempo, gefühlte RPE ↔ Tempo, Tempo beim häufigsten Gewicht, Videos.
import { html, useState, useEffect, deEn, fmt, fmt2, vz, nameVon, datumKurz, inAnzeige, einheit, gwE, I } from './basis.js';
import { trainingsTage, trainingAm, kanon, E1RM_AKTUELL } from './stand.js';
import { tempoSaetze, lastTempoProfil, rpeTempo, tempoBeiGewicht, MVT, tempoTage, tempoRekorde, istTempoRekord, tagesform } from '../js/tempo.js';
import { LinienChart } from './diagramme.js';
import { alleVideoMeta, SatzVideo, KAMERA } from './satzvideo.js';

let MERK = null;
const ausTagen = () => {
  if (MERK?.tt === trainingsTage) return MERK.w;
  const w = tempoSaetze(Object.keys(trainingsTage).sort().map((d) => trainingAm(d)).filter(Boolean)).map((s) => ({ ...s, key: kanon(s.key) }));
  MERK = { tt: trainingsTage, w };
  return w;
};
// 307: Video-Ids aller gespeicherten Sätze. Videos verworfener Trainings, ersetzter oder entfernter Sätze blieben sonst als
// verwaiste Einträge in der Liste „Videos auf diesem Gerät“ stehen (ein Video erschien mehrfach).
let MERK_IDS = null;
const verknuepfteVideos = () => {
  if (MERK_IDS?.tt === trainingsTage) return MERK_IDS.ids;
  const ids = new Set();
  for (const d of Object.keys(trainingsTage)) for (const u of trainingAm(d)?.uebungen ?? []) {
    for (const s of [...(u.aufwaermen ?? []), ...(u.saetze ?? [])]) if (s.extra?.video) ids.add(s.extra.video);
  }
  MERK_IDS = { tt: trainingsTage, ids };
  return ids;
};
const ausVideo = (v) => {
  const w = v.analyse?.wdh;
  if (!w?.length || v.ungeprueft || !(v.kg > 0)) return null;
  return { datum: (v.datum ?? v.erstellt ?? '').slice(0, 10), key: kanon(v.key), lift: v.lift, kg: v.kg, wdh: v.wdh, rpe: v.rpe ?? null,
    beste: Math.max(...w.map((x) => x.mcv)), letzte: w.at(-1).mcv, verlust: v.analyse.verlust ?? null, video: v.id };
};

function achse(lo, hi, n = 4) {
  if (hi - lo < Math.max(1e-6, Math.abs(hi) * 0.04)) { const d = Math.max(0.05, Math.abs(hi) * 0.05); lo -= d; hi += d; }
  const roh = (hi - lo) / n, p = 10 ** Math.floor(Math.log10(roh)), s = [1, 2, 2.5, 5, 10].map((f) => f * p).find((x) => x >= roh);
  const a = Math.floor(lo / s) * s, t = [];
  for (let v = a; v <= hi + s * 0.001; v += s) t.push(Math.round(v * 1000) / 1000);
  if (t.at(-1) < hi) t.push(Math.round((t.at(-1) + s) * 1000) / 1000);
  return t;
}

/** Streudiagramm mit optionaler Geraden (y = a + b·x), waagrechter Linie und Marke. */
function Streu({ titel, unter, punkte, gerade = null, xBis = null, linieY = null, marke = null, xText, yText, xSt = 0, ySt = 2 }) {
  const [i, setI] = useState(null);
  if (!punkte.length) return null;
  const W = 340, H = 210, L = 38, R = 12, T = 12, U = 30;
  const xs = punkte.map((p) => p.x), ys = punkte.map((p) => p.y);
  const xHi = Math.max(...xs, xBis ?? -Infinity), yLo = Math.min(...ys, linieY?.wert ?? Infinity), yHi = Math.max(...ys);
  const tx = achse(Math.min(...xs), xHi), ty = achse(Math.max(0, yLo), yHi).filter((t, k, l) => t >= 0 || k === l.length - 1);
  const px = (x) => L + ((x - tx[0]) * (W - L - R)) / (tx.at(-1) - tx[0]), py = (y) => T + ((ty.at(-1) - y) * (H - T - U)) / (ty.at(-1) - ty[0]);
  // Gerade nur innerhalb des Diagramms: x-Bereich auf die Stellen kürzen, an denen y im Achsenbereich liegt
  let gx = gerade ? [tx[0], xBis ?? tx.at(-1)] : null;
  if (gx && gerade.b !== 0) {
    const xBei = (y) => (y - gerade.a) / gerade.b, g1 = xBei(ty[0]), g2 = xBei(ty.at(-1));
    gx = [Math.max(gx[0], Math.min(g1, g2)), Math.min(gx[1], Math.max(g1, g2))];
  }
  const d = i != null ? punkte[i] : null;
  return html`<figure class="viz"><figcaption class="viz-h"><div><div class="viz-t">${titel}</div>${unter ? html`<div class="viz-u">${unter}</div>` : null}</div></figcaption>
    <div class="viz-plot" onPointerLeave=${() => setI(null)}>
      <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${titel}>
        ${ty.map((t) => html`<g key=${`y${t}`}><line class="g" x1=${L} x2=${W - R} y1=${py(t)} y2=${py(t)}/><text class="ax" x=${L - 6} y=${py(t) + 4} text-anchor="end">${ySt === 2 ? fmt2(t) : fmt(t, ySt)}</text></g>`)}
        ${tx.map((t) => html`<text key=${`x${t}`} class="ax" x=${px(t)} y=${H - 14} text-anchor="middle">${xSt === 2 ? fmt2(t) : fmt(t, xSt)}</text>`)}
        <text class="ax" x=${W - R} y=${H - 2} text-anchor="end">${xText}</text>
        <text class="ax" x=${L - 30} y=${T - 2}>${yText}</text>
        ${linieY ? html`<g><line x1=${L} x2=${W - R} y1=${py(linieY.wert)} y2=${py(linieY.wert)} class="tp-mvt"/><text class="ax tp-mvt-t" x=${L + 4} y=${py(linieY.wert) - 5}>${linieY.text}</text></g>` : null}
        ${gx ? html`<line x1=${px(gx[0])} x2=${px(gx[1])} y1=${py(gerade.a + gerade.b * gx[0])} y2=${py(gerade.a + gerade.b * gx[1])} class="tp-gerade"/>` : null}
        ${punkte.map((p, k) => html`<circle key=${k} cx=${px(p.x)} cy=${py(p.y)} r=${i === k ? 6.5 : 5} class=${`tp-punkt ${p.neu ? 'neu' : ''}`}
          onPointerEnter=${() => setI(k)} onPointerDown=${() => setI(k)}/>`)}
        ${marke ? html`<g class="tp-marke"><circle cx=${px(marke.x)} cy=${py(marke.y)} r="7"/><circle cx=${px(marke.x)} cy=${py(marke.y)} r="12" class="tp-puls"/></g>` : null}
      </svg>
      ${d ? html`<div class="tip" style=${px(d.x) / W > 0.5 ? `right:${Math.max(2, 100 - (px(d.x) / W) * 100 + 4)}%` : `left:${Math.max(2, (px(d.x) / W) * 100 + 4)}%`}>
        <div class="tip-d">${d.text}</div></div>` : null}
    </div></figure>`;
}

export function TempoStatistik({ von = null }) {
  const [werkzeug, setWerkzeug] = useState([]);
  const [videos, setVideos] = useState([]);
  const [wahl, setWahl] = useState(null);
  const [offen, setOffen] = useState(null);
  const [mehr, setMehr] = useState(false);
  useEffect(() => { alleVideoMeta().then((l) => { setVideos(l); setWerkzeug(l.filter((v) => v.werkzeug).map(ausVideo).filter(Boolean)); }).catch(() => {}); }, [offen]);
  const alle = [...ausTagen(), ...werkzeug].filter((s) => !von || s.datum >= von);
  const zahl = {};
  for (const s of alle) zahl[s.key] = (zahl[s.key] ?? 0) + 1;
  const keys = Object.keys(zahl).sort((a, b) => zahl[b] - zahl[a]);
  const key = keys.includes(wahl) ? wahl : keys[0];
  if (!key) {
    return html`<section class="card pad stack"><span class="viz-t">${deEn('Hantel-Tempo', 'Bar velocity')}</span>
      <p class="muted" style="margin:0;font-size:14px">${deEn('Noch keine Sätze mit Tempo im Zeitraum. Im Training unter einem abgehakten Satz die Kamera antippen – oder Rechner → Hantelweg.',
        'No sets with velocity in this period yet. In a workout tap the camera under a completed set – or Tools → Bar path.')}</p></section>`;
  }
  const saetze = alle.filter((s) => s.key === key).sort((a, b) => a.datum.localeCompare(b.datum));
  const lift = saetze[0]?.lift;
  const mvt = MVT[lift] ?? null;
  const profil = lastTempoProfil(saetze, mvt);
  const rt = rpeTempo(saetze);
  const beiKg = tempoBeiGewicht(saetze);
  const verluste = saetze.filter((s) => s.verlust != null).map((s) => s.verlust);
  const e1rmSaetze = E1RM_AKTUELL[key] ?? null;
  const bei8 = rt.gerade && rt.gerade.b < 0 ? (8 - rt.gerade.a) / rt.gerade.b : null;
  const E = einheit();
  const punktText = (s) => `${datumKurz(s.datum)} · ${fmt(inAnzeige(s.kg))} ${E} × ${s.wdh ?? '–'}${s.rpe != null ? ` @ ${fmt(s.rpe)}` : ''} · ${fmt2(s.beste)} m/s`;
  const verknuepft = verknuepfteVideos();
  const meineVideos = videos.filter((v) => kanon(v.key) === key && (v.werkzeug || verknuepft.has(v.id))).sort((a, b) => (b.erstellt ?? '').localeCompare(a.erstellt ?? '')).slice(0, 12);
  // 288: Verlauf je Trainingstag, 289: Rekorde (Satz schneller als alles davor beim gleichen Gewicht), 290: Tagesform je Tag
  const tage = tempoTage(saetze);
  const rekordSaetze = new Set(saetze.filter((s) => istTempoRekord(s.beste, s.kg, saetze.filter((x) => x.datum < s.datum))?.rekord));
  const formReihe = mvt ? [...tage].reverse().map((t) => {
    const p = lastTempoProfil(saetze.filter((s) => s.datum !== t.datum), mvt);
    return { datum: t.datum, pct: p.b != null ? tagesform(t.saetze, p, mvt)?.pct ?? null : null };
  }).filter((x) => x.pct != null) : [];
  const rekorde = tempoRekorde(saetze).slice(0, 8);
  const sichtbar = mehr ? tage : tage.slice(0, 6);
  return html`
    <div class="filter einreihig" role="group" aria-label=${deEn('Übung', 'Exercise')}>${keys.map((k) => html`<button key=${k} class="chip" aria-pressed=${String(k === key)} onClick=${() => setWahl(k)}>${nameVon(k)}<small class="tp-zahl">${zahl[k]}</small></button>`)}</div>
    <section class="tp-held">
      <div><span class="l">${deEn('e1RM aus dem Tempo', 'e1RM from velocity')}</span><b>${profil.e1rm ? gwE(profil.e1rm, 0) : '–'}</b>
        <small>${profil.e1rm ? (e1rmSaetze ? deEn(`aus Sätzen: ${gwE(e1rmSaetze, 0)}`, `from sets: ${gwE(e1rmSaetze, 0)}`) : '')
          : mvt == null ? deEn('nur für Kniebeuge, Bank, Kreuzheben', 'only for squat, bench, deadlift')
          : profil.fehlt === 'saetze' ? deEn(`ab 3 Sätzen (${saetze.length})`, `from 3 sets (${saetze.length})`) : profil.fehlt === 'spanne' ? deEn('braucht verschiedene Gewichte', 'needs different weights') : deEn('noch kein klares Profil', 'no clear profile yet')}</small></div>
      <div class="tp-neben">
        <div><span class="l">${deEn('Sätze', 'Sets')}</span><b>${saetze.length}</b></div>
        <div><span class="l">${deEn('Ø Verlust', 'Avg. loss')}</span><b>${verluste.length ? `−${fmt(verluste.reduce((a, b) => a + b, 0) / verluste.length, 0)} %` : '–'}</b></div>
        <div><span class="l">${deEn('RPE 8 bei', 'RPE 8 at')}</span><b>${bei8 > 0 && bei8 < 2 ? `${fmt2(bei8)} m/s` : '–'}</b></div>
      </div>
    </section>
    ${saetze.length < 2 ? html`<section class="card pad"><p class="muted" style="margin:0;font-size:13.5px">${deEn('Die Diagramme kommen ab 2 Sätzen mit Tempo – am besten mit verschiedenen Gewichten (Aufwärmsätze zählen auch).', 'The charts appear from 2 sets with velocity – ideally at different weights (warm-up sets count too).')}</p></section>`
    : html`<${Streu} titel=${deEn('Gewicht ↔ Tempo', 'Load ↔ velocity')} unter=${deEn(`Schnellste Wdh je Satz. Gerade bis zum Mindesttempo${mvt ? ` (${fmt2(mvt)} m/s, Richtwert)` : ''} = e1RM aus dem Tempo.`, `Fastest rep per set. Line down to the minimum velocity${mvt ? ` (${fmt2(mvt)} m/s, estimate)` : ''} = e1RM from velocity.`)}
      punkte=${saetze.map((s) => ({ x: inAnzeige(s.kg), y: s.beste, text: punktText(s) }))}
      gerade=${profil.a != null ? { a: profil.a, b: profil.b / inAnzeige(1) } : null} xBis=${profil.e1rm ? inAnzeige(profil.e1rm) : null}
      linieY=${mvt && profil.e1rm ? { wert: mvt, text: deEn('Mindesttempo', 'Minimum velocity') } : null}
      marke=${profil.e1rm ? { x: inAnzeige(profil.e1rm), y: mvt } : null} xText=${E} yText="m/s"/>`}
    ${rt.punkte.length >= 2 ? html`<${Streu} titel=${deEn('Gefühlte RPE ↔ Tempo', 'Felt RPE ↔ velocity')} unter=${deEn('Tempo der letzten Wdh gegen deine RPE-Angabe. Liegen Punkte weit neben der Geraden, war die RPE-Schätzung daneben.', 'Velocity of the last rep against your RPE. Points far off the line mean the RPE guess was off.')}
      punkte=${saetze.filter((s) => s.rpe != null).map((s) => ({ x: s.letzte, y: s.rpe, text: punktText(s) }))} gerade=${rt.gerade} xText="m/s" yText="RPE" xSt=${2} ySt=${1}/>` : null}
    ${beiKg && beiKg.reihe.length >= 2 ? html`<${LinienChart} titel=${deEn(`Tempo bei ${fmt(inAnzeige(beiKg.kg))} ${E}`, `Velocity at ${fmt(inAnzeige(beiKg.kg))} ${E}`)}
      unter=${deEn('Dein häufigstes Gewicht: schneller = stärker geworden.', 'Your most common weight: faster = got stronger.')} x=${beiKg.reihe.map((r) => r.datum)} zeitlich=${true} punkte=${true}
      serien=${[{ id: 'v', name: 'm/s', farbe: 'var(--ok)', werte: beiKg.reihe.map((r) => r.v) }]} einheit="m/s" stellen=${2} tipKopf=${(d) => datumKurz(d)} hoehe=${180}
      format=${(v) => fmt2(v)}/>` : null}
    ${formReihe.length >= 2 ? html`<${LinienChart} titel=${deEn('Tagesform', 'Daily form')} unter=${deEn('Tempo je Trainingstag gegen dein Gewicht-Tempo-Profil (aus allen anderen Tagen). Über 0 = schneller als üblich.', 'Velocity per training day vs. your load-velocity profile (from all other days). Above 0 = faster than usual.')}
      x=${formReihe.map((r) => r.datum)} zeitlich=${true} punkte=${true} serien=${[{ id: 'f', name: '%', farbe: 'var(--acc-hi)', werte: formReihe.map((r) => r.pct) }]}
      einheit="%" stellen=${0} tipKopf=${(d) => datumKurz(d)} hoehe=${170} referenz=${{ wert: 0, text: deEn('wie üblich', 'as usual') }}/>` : null}
    <section class="card pad stack">
      <span class="viz-t">${deEn('Verlauf', 'History')}</span>
      <div class="tp-tage">${sichtbar.map((t) => html`<div key=${t.datum} class="tp-tag">
        <div class="tp-tag-kopf"><b>${datumKurz(t.datum)}</b>
          ${t.verluste.map((g) => html`<span key=${g.kg} class=${`tp-verlust ${g.pct >= 20 ? 'warn' : ''}`}>${vz(-g.pct)} % ${deEn('bei', 'at')} ${fmt(inAnzeige(g.kg))}</span>`)}
          ${(() => { const f = formReihe.find((x) => x.datum === t.datum); return f ? html`<span class=${`tp-form ${f.pct >= 3 ? 'gut' : f.pct <= -3 ? 'schlecht' : ''}`}>${deEn('Form', 'Form')} ${vz(f.pct)} %</span>` : null; })()}</div>
        <div class="tp-saetze">${t.saetze.map((s, i) => html`<span key=${i} class=${rekordSaetze.has(s) ? 'rekord' : ''}>${fmt(inAnzeige(s.kg))}×${s.wdh ?? '–'} <b>${fmt2(s.beste)}</b>${rekordSaetze.has(s) ? ' ⚡' : ''}</span>`)}</div>
      </div>`)}</div>
      ${tage.length > 6 ? html`<button class="link-knopf" style="align-self:flex-start" onClick=${() => setMehr(!mehr)}>${mehr ? deEn('Weniger', 'Less') : deEn(`Alle ${tage.length} Tage`, `All ${tage.length} days`)}</button>` : null}
      <span class="muted sv-fuss">${deEn('m/s = schnellste Wdh je Satz. ⚡ = Tempo-Rekord bei diesem Gewicht. Verlust = letzter gegen ersten Satz mit gleichem Gewicht.', 'm/s = fastest rep per set. ⚡ = velocity record at this weight. Loss = last vs. first set at the same weight.')}</span>
    </section>
    ${rekorde.length ? html`<section class="card pad stack"><span class="viz-t">${deEn('Tempo-Rekorde je Gewicht', 'Velocity records per weight')}</span>
      <table class="rec"><thead><tr><th>${E}</th><th>m/s</th><th>${deEn('Datum', 'Date')}</th></tr></thead>
        <tbody>${rekorde.map((r) => html`<tr key=${r.kg}><td>${fmt(inAnzeige(r.kg))}</td><td><b>${fmt2(r.v)}</b></td><td>${datumKurz(r.datum)}</td></tr>`)}</tbody></table></section>` : null}
    ${meineVideos.length ? html`<section class="card pad stack"><span class="viz-t">${deEn('Videos auf diesem Gerät', 'Videos on this device')}</span>
      <div class="hw-liste">${meineVideos.map((v) => html`<button key=${v.id} class="hw-zeile" onClick=${() => setOffen(v)}>${KAMERA}
        <span><b>${fmt(inAnzeige(v.kg ?? 0))} × ${v.wdh ?? '–'}${v.rpe != null ? ` @ ${fmt(v.rpe)}` : ''}</b><small>${datumKurz((v.datum ?? v.erstellt ?? '').slice(0, 10) || '2000-01-01')}</small></span>
        <b class="hw-ms">${v.analyse?.wdh?.length && !v.ungeprueft ? `${fmt2(Math.max(...v.analyse.wdh.map((w) => w.mcv)))} m/s` : '–'}</b>${I.weiter}</button>`)}</div></section>` : null}
    ${offen ? html`<${SatzVideo} satz=${{ kg: offen.kg, wdh: offen.wdh, rpe: offen.rpe, extra: { video: offen.id } }} uebungKey=${offen.key} uebungName=${nameVon(offen.key)} lift=${offen.lift}
      zu=${() => setOffen(null)}/>` : null}`;
}
