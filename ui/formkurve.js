// PR Hunter · Formkurve (Wunsch 269): Karte in Statistik → Belastung und Zeile im Wettkampf-Countdown auf „Heute“.
// Rechnung in js/formkurve.js. Verlauf der letzten 8 Wochen, mit Wettkampfdatum und aktivem Block Vorschau bis zum Wettkampf.
import { html, useState, useRef, deEn, fmt, datumKurz, liftVon, I } from './basis.js';
import { trainingsTage, trainingAm, HEUTE, E1RM_AKTUELL, formAktuell, plusTage, kanon } from './stand.js';
import { trainingsLast, planLast, formVerlauf, formZumWettkampf, formZone } from '../js/formkurve.js';

const VORSCHAU_TAGE = 140;                 // Vorschau höchstens 20 Wochen voraus (weiter reicht kein Plan)
const ZONE = {
  muede: () => deEn('müde', 'tired'), training: () => deEn('im Training', 'in training'),
  frisch: () => deEn('frisch', 'fresh'), pause: () => deEn('sehr ausgeruht', 'very rested'),
};
const zoneText = (pct) => (pct == null ? '' : ZONE[formZone(pct)]());
const prozent = (p) => (p == null ? '–' : `${p > 0 ? '+' : p < 0 ? '−' : ''}${fmt(Math.abs(p), 0)} %`);
const e1rmVon = (key) => E1RM_AKTUELL[kanon(key)] ?? E1RM_AKTUELL[key] ?? formAktuell(liftVon(key));

let MERK = null;
/** Verlauf und Auswertung. planTage: Plantage des aktiven Blocks (planeBlock + Optionen), erledigt: Set der erledigten Plandaten. */
export function formDaten(planTage = [], { wettkampf = null, erledigt = null, von = null } = {}) {
  // 282: Verlauf ab dem Zeitraum der Statistik (4 Wo. … Alles), sonst die letzten 8 Wochen
  const ab = von && von < HEUTE ? von : plusTage(HEUTE, -56);
  const plan = planTage.filter((t) => t.datum && t.datum >= HEUTE && !t.uebersprungen && !erledigt?.has(t.datum));
  const sig = [trainingsTage, HEUTE, wettkampf, ab, plan.length, plan[0]?.datum, plan.at(-1)?.datum, plan.reduce((a, t) => a + t.offset, 0)];
  if (MERK && MERK.sig.every((x, i) => x === sig[i])) return MERK.w;
  const lasten = {};
  for (const d of Object.keys(trainingsTage)) { const t = trainingAm(d); if (t) lasten[d] = trainingsLast(t.uebungen); }
  // Plantage nur, wo an dem Tag noch kein Training steht (heute schon trainiert → das echte Training zählt)
  const geplant = {};
  for (const t of plan) geplant[t.datum] = (geplant[t.datum] ?? 0) + planLast(t, { liftVon, e1rmVon });
  for (const [d, l] of Object.entries(geplant)) if (!(lasten[d] > 0)) lasten[d] = l;
  const planEnde = plan.at(-1)?.datum ?? null;
  const wkGueltig = wettkampf && wettkampf >= HEUTE ? wettkampf : null;
  const zuWeit = !!wkGueltig && wkGueltig > plusTage(HEUTE, VORSCHAU_TAGE);
  const vorschau = !!wkGueltig && !zuWeit && !!planEnde;
  const verlauf = formVerlauf(lasten, { von: ab, bis: vorschau ? wkGueltig : HEUTE });
  const w = { verlauf, ...formZumWettkampf(verlauf, { heute: HEUTE, wettkampf: vorschau ? wkGueltig : null, planEnde }),
    planEnde, wk: wkGueltig, zuWeit, vorschau, leer: !verlauf.some((v) => v.pct != null) };
  MERK = { sig, w };
  return w;
}

function hinweisText(d) {
  const wk = d.wettkampf?.pct, hoch = d.hoch;
  switch (d.hinweis) {
    case 'passt': return { art: 'gut', t: deEn('Tapering passt', 'Taper looks right'),
      text: deEn(`Am Wettkampftag frisch (${prozent(wk)}).`, `Fresh on meet day (${prozent(wk)}).`) };
    case 'muede': return { art: '', t: deEn('Am Wettkampftag noch müde', 'Still tired on meet day'),
      text: deEn(`Form ${prozent(wk)}. In den letzten 7–10 Tagen das Volumen senken, die Intensität halten.`,
        `Form ${prozent(wk)}. Cut volume in the last 7–10 days, keep the intensity.`) };
    case 'zufrueh': return { art: 'tipp', t: deEn('Höchste Form zu früh', 'Peak comes too early'),
      text: deEn(`Am ${datumKurz(hoch.datum)} ${prozent(hoch.pct)}, am Wettkampftag nur ${prozent(wk)}. Die Entlastung später beginnen oder danach nicht wieder hart trainieren.`,
        `${prozent(hoch.pct)} on ${datumKurz(hoch.datum)}, only ${prozent(wk)} on meet day. Start the taper later or don't train hard again afterwards.`) };
    case 'pause': return { art: 'tipp', t: deEn('Sehr lange entlastet', 'Very long taper'),
      text: deEn(`Am Wettkampftag ${prozent(wk)}: länger kaum Last, die Fitness sinkt. Ein, zwei schwere Einheiten in der letzten Woche halten sie.`,
        `${prozent(wk)} on meet day: little load for a long time, fitness drops. One or two heavy sessions in the last week keep it.`) };
    default: return null;
  }
}

/** Karte in Statistik → Belastung. */
export function FormKarte({ daten }) {
  if (!daten || daten.leer) return null;
  const h = hinweisText(daten);
  const vor4 = daten.verlauf.find((v) => v.datum === plusTage(HEUTE, -28));
  const fitTrend = vor4?.fitness > 0 && daten.heute ? Math.round((daten.heute.fitness / vor4.fitness - 1) * 100) : null;
  const haupt = daten.vorschau ? daten.wettkampf : daten.heute;
  const tageBis = daten.wk ? Math.round((Date.parse(`${daten.wk}T00:00:00Z`) - Date.parse(`${HEUTE}T00:00:00Z`)) / 864e5) : null;
  const zusatz = !daten.wk ? deEn('Mit Wettkampfdatum (Einstellungen → Training) und aktivem Block zeigt die Kurve die Vorschau bis zum Wettkampf.',
    'With a meet date (Settings → Training) and an active block the curve shows the forecast up to the meet.')
    : daten.zuWeit ? deEn('Die Vorschau beginnt 20 Wochen vor dem Wettkampf.', 'The forecast starts 20 weeks before the meet.')
    : !daten.planEnde ? deEn('Für die Vorschau bis zum Wettkampf einen Block starten – ohne Plan zeigt die Kurve nur den Verlauf bis heute.',
      'Start a block for the forecast up to the meet – without a plan the curve only shows the history up to today.')
    : daten.luecke ? deEn(`Der Plan endet am ${datumKurz(daten.planEnde)}, danach bis zum Wettkampf ohne Training gerechnet.`,
      `The plan ends on ${datumKurz(daten.planEnde)}, after that calculated without training up to the meet.`) : null;
  return html`<figure class="viz form-karte">
    <figcaption class="viz-h"><div><div class="viz-t">${deEn('Formkurve', 'Form curve')}</div>
      <div class="viz-u">${deEn('Fitness − Ermüdung in % der Fitness · Schätzung', 'Fitness − fatigue in % of fitness · estimate')}</div></div></figcaption>
    <div class=${`form-held ${formZone(haupt?.pct) ?? ''}`}>
      <div class="form-held-zahl"><span class="l">${daten.vorschau ? deEn('Am Wettkampftag', 'On meet day') : deEn('Form heute', 'Form today')}</span>
        <b>${prozent(haupt?.pct)}</b><span class="form-pill">${zoneText(haupt?.pct)}</span></div>
      <div class="form-held-neben">
        ${daten.vorschau ? html`
          <div><span class="l">${deEn('Heute', 'Today')}</span><b>${prozent(daten.heute?.pct)}</b></div>
          <div><span class="l">${deEn('Höchste Form', 'Peak form')}</span><b>${daten.hoch ? datumKurz(daten.hoch.datum) : '–'}</b></div>
          <div><span class="l">${deEn('Noch', 'In')}</span><b>${tageBis} ${deEn(tageBis === 1 ? 'Tag' : 'Tage', tageBis === 1 ? 'day' : 'days')}</b></div>`
        : html`<div><span class="l">Fitness</span><b>${fitTrend == null ? '–' : prozent(fitTrend)}</b><span class="muted">${deEn('ggü. vor 4 Wochen', 'vs. 4 weeks ago')}</span></div>`}
      </div>
    </div>
    <${FormChart} daten=${daten}/>
    ${h ? html`<div class=${`hint ${h.art}`}>${h.art === 'gut' ? I.check : h.art === 'tipp' ? I.statistik : I.warn}<span class="t">${h.t}</span><span></span><p>${h.text}</p></div>` : null}
    ${zusatz ? html`<span class="muted" style="font-size:12.5px">${zusatz}</span>` : null}
    <details class="ab-sollist"><summary><span>${deEn('So wird gerechnet', 'How it is calculated')}</span><span class="woche-pfeil" aria-hidden="true">${I.weiter}</span></summary>
      <p class="muted" style="margin:0;font-size:12.5px">${deEn(
        'Tageslast = INOL der Arbeitssätze in Kniebeuge, Bankdrücken, Kreuzheben und ihren Varianten: Wdh ÷ (100 − % vom e1RM), ab 95 % gedeckelt. Fitness = Schnitt der Tageslast über etwa 42 Tage, Ermüdung über etwa 7 Tage (Modell nach Banister). Form = Fitness − Ermüdung, in % der Fitness. Künftige Tage kommen aus dem Plan des aktiven Blocks. Zonen: unter −10 % müde, bis +10 % im Training, bis +50 % frisch (Ziel am Wettkampftag), darüber sehr ausgeruht. Beispiel: eine Woche halbes Volumen ≈ +26 %, eine Woche Pause ≈ +57 %. Die Zeitkonstanten stammen aus dem Ausdauersport; für Kraftsport ist das eine Schätzung.',
        'Daily load = INOL of the work sets in squat, bench press, deadlift and their variations: reps ÷ (100 − % of e1RM), capped at 95 %. Fitness = average daily load over about 42 days, fatigue over about 7 days (Banister model). Form = fitness − fatigue, in % of fitness. Future days come from the plan of the active block. Zones: below −10 % tired, up to +10 % in training, up to +50 % fresh (target on meet day), above that very rested. Example: one week of half volume ≈ +26 %, one week off ≈ +57 %. The time constants come from endurance sports; for strength training this is an estimate.')}</p></details>
  </figure>`;
}

function FormChart({ daten }) {
  const [i, setI] = useState(null);
  const ref = useRef(null);
  const v = daten.verlauf, n = v.length;
  const werte = v.map((x) => x.pct).filter((p) => p != null);
  if (!werte.length) return null;
  const W = 340, H = 184, L = 30, R = 10, T = 18, U = 22;
  // Achse höchstens −100 … +150 % (nach langen Pausen gibt es Ausreißer; Werte darüber hinaus liegen am Rand)
  const lo = Math.max(-100, Math.min(-30, Math.floor(Math.min(...werte) / 10) * 10)), hi = Math.min(150, Math.max(60, Math.ceil(Math.max(...werte) / 10) * 10));
  const schritt = hi - lo > 120 ? 40 : 20;
  const ticks = []; for (let t = Math.ceil(lo / schritt) * schritt; t <= hi; t += schritt) ticks.push(t);
  const px = (k) => L + (k * (W - L - R)) / Math.max(1, n - 1);
  const py = (p) => T + ((hi - Math.max(lo, Math.min(hi, p))) * (H - T - U)) / (hi - lo || 1);
  const ih = v.findIndex((x) => x.datum === HEUTE);
  const iw = daten.vorschau ? v.findIndex((x) => x.datum === daten.wk) : -1;
  const pfad = (von, bis) => { let s = '', an = false;
    for (let k = von; k <= bis; k++) { const p = v[k]?.pct; if (p == null) { an = false; continue; } s += `${an ? 'L' : 'M'}${px(k).toFixed(1)} ${py(p).toFixed(1)}`; an = true; }
    return s; };
  const ende = ih >= 0 ? ih : n - 1;
  const hochK = daten.vorschau && daten.hoch && daten.hoch.datum > HEUTE ? v.findIndex((x) => x.datum === daten.hoch.datum) : -1;
  // Datumsbeschriftung: Anfang, heute, Wettkampf (überlappende weglassen)
  // 282: lange Zeiträume mit Monatsmarken (über ein Jahr „MM/JJ“), sonst Anfang
  const fest = [...(ih > 0 ? [[ih, deEn('heute', 'today')]] : []), ...(iw > 0 ? [[iw, datumKurz(v[iw].datum)]] : [])];
  const frei = (k, l) => [...fest, ...l].every(([f]) => Math.abs(px(f) - px(k)) >= 38);
  const marken = [...fest];
  const kandidaten = n > 70 ? v.map((x, k) => [k, x.datum]).filter(([, d]) => d.endsWith('-01'))
    .map(([k, d]) => [k, n > 400 ? `${d.slice(5, 7)}/${d.slice(2, 4)}` : datumKurz(d)]) : [[0, datumKurz(v[0].datum)]];
  for (const m of kandidaten) if (frei(m[0], marken.slice(fest.length))) marken.push(m);
  const zeige = (e) => {
    const r = ref.current.getBoundingClientRect();
    const xs = ((e.clientX - r.left) / r.width) * W;
    setI(Math.max(0, Math.min(n - 1, Math.round(((xs - L) * (n - 1)) / (W - L - R)))));
  };
  const d = i != null ? v[i] : null;
  return html`<div class="viz-plot" onPointerLeave=${() => setI(null)}>
    <svg ref=${ref} viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${deEn('Formkurve', 'Form curve')} onPointerMove=${zeige} onPointerDown=${zeige}>
      <rect x=${L} width=${W - L - R} y=${py(Math.min(50, hi))} height=${py(10) - py(Math.min(50, hi))} class="form-band frisch"/>
      <rect x=${L} width=${W - L - R} y=${py(-10)} height=${py(lo) - py(-10)} class="form-band muede"/>
      <text class="ax form-zone frisch" x=${L + 5} y=${py(Math.min(50, hi)) + 12}>${ZONE.frisch()}</text>
      <text class="ax form-zone muede" x=${L + 5} y=${py(lo) - 5}>${ZONE.muede()}</text>
      ${ticks.map((t) => html`<g key=${t}><line class=${t === 0 ? 'g form-null' : 'g'} x1=${L} x2=${W - R} y1=${py(t)} y2=${py(t)}/>
        <text class="ax" x=${L - 6} y=${py(t) + 4} text-anchor="end">${t > 0 ? `+${t}` : t < 0 ? `−${-t}` : '0'}</text></g>`)}
      ${marken.map(([k, t]) => html`<text key=${k} class="ax" x=${px(k)} y=${H - 6} text-anchor=${k === 0 ? 'start' : k === n - 1 ? 'end' : 'middle'}>${t}</text>`)}
      ${ih >= 0 && ih < n - 1 ? html`<line class="form-heute" x1=${px(ih)} x2=${px(ih)} y1=${T - 6} y2=${H - U}/>` : null}
      ${iw > 0 ? html`<g><line class="form-wk" x1=${px(iw)} x2=${px(iw)} y1=${T - 6} y2=${H - U}/><text x=${px(iw)} y=${T - 7} text-anchor="end" font-size="13">🏆</text></g>` : null}
      <defs>
        <linearGradient id="form-zonen" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1=${py(hi)} y2=${py(lo)}>
          ${[[hi, 'var(--gold)'], [50, 'var(--gold)'], [42, 'var(--ok)'], [12, 'var(--ok)'], [6, 'var(--acc-hi)'], [-6, 'var(--acc-hi)'], [-12, 'var(--rot)'], [lo, 'var(--rot)']]
            .filter(([p]) => p <= hi && p >= lo).map(([p, f]) => html`<stop key=${p} offset=${(hi - p) / (hi - lo)} style=${`stop-color:${f}`}/>`)}
        </linearGradient>
      </defs>
      <path d=${`${pfad(v.findIndex((x) => x.pct != null), n - 1)} L${px(n - 1)} ${py(0)} L${px(v.findIndex((x) => x.pct != null))} ${py(0)} Z`} class="form-flaeche" style="fill:url(#form-zonen)"/>
      <path d=${pfad(0, ende)} class="form-glut" style="stroke:url(#form-zonen)" fill="none"/>
      <path d=${pfad(0, ende)} class="form-linie" style="stroke:url(#form-zonen)" fill="none"/>
      ${ende < n - 1 ? html`<path d=${pfad(ende, n - 1)} class="form-linie vorschau" style="stroke:url(#form-zonen)" fill="none"/>` : null}
      ${hochK > 0 && v[hochK].pct != null ? html`<g transform=${`translate(${px(hochK)} ${py(v[hochK].pct)})`}>
        <circle r="9" class="form-puls"/><circle r="4" class="form-hoch"/></g>` : null}
      ${v[ende]?.pct != null ? html`<circle cx=${px(ende)} cy=${py(v[ende].pct)} r="4.5" class="form-jetzt"/>` : null}
      ${iw > 0 && v[iw].pct != null ? html`<circle cx=${px(iw)} cy=${py(v[iw].pct)} r="4.5" class="form-ziel"/>` : null}
      ${d?.pct != null ? html`<g><line x1=${px(i)} x2=${px(i)} y1=${T} y2=${H - U} style="stroke:var(--axis)"/>
        <circle cx=${px(i)} cy=${py(d.pct)} r="4" class="form-jetzt"/></g>` : null}
    </svg>
    ${d ? html`<div class="tip" style=${px(i) / W > 0.5 ? `right:${Math.max(2, 100 - (px(i) / W) * 100 + 4)}%` : `left:${Math.max(2, (px(i) / W) * 100 + 4)}%`}>
      <div class="tip-d">${datumKurz(d.datum)}${d.datum > HEUTE ? deEn(' · Vorschau', ' · forecast') : ''}${d.datum === daten.wk ? deEn(' · Wettkampf', ' · meet') : ''}</div>
      <div class="tip-r"><i class="k-linie" style="background:var(--acc)"></i><b>${prozent(d.pct)}</b><span>${zoneText(d.pct)}</span></div>
    </div>` : null}
  </div>`;
}

/** Zeile im Wettkampf-Countdown: Form am Wettkampftag, Tippen öffnet Statistik → Belastung. */
export function FormZeile({ daten, oeffnen }) {
  if (!daten?.vorschau || daten.wettkampf?.pct == null) return null;
  const z = formZone(daten.wettkampf.pct);
  return html`<button class=${`cd-form ${z}`} onClick=${oeffnen}>
    <span>${deEn('Form am Wettkampftag', 'Form on meet day')}</span><b>${prozent(daten.wettkampf.pct)}</b><span class="muted">${zoneText(daten.wettkampf.pct)}</span>
    <span class="woche-pfeil" aria-hidden="true">${I.weiter}</span></button>`;
}
