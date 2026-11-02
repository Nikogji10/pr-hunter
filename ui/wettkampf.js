// PR Hunter · Wettkampftag (Wunsch 189): Versuche je Lift planen und abhaken (gültig/ungültig), Total und DOTS live,
// Aufwärmplan bis zum Opener, Wartezeit nach Athleten vor dir. Alles auf einer Seite, gemerkt auf dem Gerät (der
// Wettkampftag übersteht Neuladen und Wechsel in andere Seiten). Gewichte in der Anzeigeeinheit.
import { html, useState, fmt, inKg, inAnzeige, stangeKg, scheibenKg, einheit, ZahlFeld, deEn, Scheiben } from './basis.js';
import { aufwaermen } from '../js/rechnen.js';
import { versuche, dots } from '../js/punkte.js';

const LIFTE = [['squat', 'Kniebeuge'], ['bench', 'Bankdrücken'], ['dead', 'Kreuzheben']];
const SPEICHER = 'prh-wettkampf';
const lade = () => { try { return JSON.parse(localStorage.getItem(SPEICHER)); } catch { return null; } };
const STATUS = [null, 'gut', 'ungueltig'];

export function Wettkampftag({ ziele, koerper, inc }) {
  const [w, setWRoh] = useState(() => lade() ?? { ziel: ziele, versuche: Object.fromEntries(LIFTE.map(([l]) => [l, versuche(ziele[l], inc) ?? [null, null, null]])),
    status: Object.fromEntries(LIFTE.map(([l]) => [l, [null, null, null]])), koerper, geschlecht: 'm', vorDir: 8 });
  const setW = (neu) => { setWRoh(neu); try { localStorage.setItem(SPEICHER, JSON.stringify(neu)); } catch { /* egal */ } };
  const E = einheit(), lb = E === 'lb';
  const besterGueltig = (l) => Math.max(0, ...w.versuche[l].filter((kg, i) => w.status[l][i] === 'gut' && kg > 0));
  const total = LIFTE.reduce((s, [l]) => s + besterGueltig(l), 0), alleDrei = LIFTE.every(([l]) => besterGueltig(l) > 0);
  const geplant = LIFTE.reduce((s, [l]) => s + Math.max(0, ...w.versuche[l].filter((kg, i) => w.status[l][i] !== 'ungueltig' && kg > 0)), 0);
  const punkte = dots(inKg(alleDrei ? total : geplant), inKg(w.koerper), w.geschlecht);
  const setzeVersuch = (l, i, kg) => setW({ ...w, versuche: { ...w.versuche, [l]: w.versuche[l].map((x, j) => (j === i ? kg : x)) } });
  const tippeStatus = (l, i) => {
    const neu = STATUS[(STATUS.indexOf(w.status[l][i]) + 1) % STATUS.length];
    const st = { ...w.status, [l]: w.status[l].map((x, j) => (j === i ? neu : x)) };
    // ungültig: nächsten Versuch mindestens mit demselben Gewicht wiederholen (Vorschlag, änderbar)
    const vs = neu === 'ungueltig' && i < 2 && (w.versuche[l][i + 1] ?? 0) < w.versuche[l][i]
      ? { ...w.versuche, [l]: w.versuche[l].map((x, j) => (j === i + 1 ? w.versuche[l][i] : x)) } : w.versuche;
    setW({ ...w, status: st, versuche: vs });
  };
  const opener = Math.min(...LIFTE.map(([l]) => w.versuche[l][0] || Infinity));
  const naechsterLift = LIFTE.find(([l]) => w.status[l].some((s) => s == null))?.[0] ?? 'squat';
  const aufw = aufwaermen(inKg(w.versuche[naechsterLift][0] ?? 0), { stange: stangeKg(), inventar: scheibenKg(), inc: lb ? inKg(5) : 2.5 });
  const neuPlanen = () => setW({ ...w, versuche: Object.fromEntries(LIFTE.map(([l]) => [l, versuche(w.ziel[l], inc) ?? [null, null, null]])),
    status: Object.fromEntries(LIFTE.map(([l]) => [l, [null, null, null]])) });
  return html`<div class="stack wk" style="gap:12px">
    <section class="card pad stack">
      <div class="row between"><span class="viz-t">Total</span><span class="muted" style="font-size:12.5px">${alleDrei ? 'gültig' : 'geplant'}</span></div>
      <div class="wk-total"><b>${fmt(alleDrei ? total : geplant)}<small>${E}</small></b><span>${punkte ? `DOTS ${fmt(punkte, 1)}` : ''}</span></div>
      <div class="fields">
        <${ZahlFeld} id="wk-kg" label=${`Körpergewicht (${E})`} wert=${w.koerper} schritt=${lb ? 1 : 0.1} setze=${(x) => setW({ ...w, koerper: x })}/>
        <label class="field"><span class="label">Klasse</span><div class="seg">${[['m', 'Männer'], ['w', 'Frauen']].map(([k, t]) => html`<button key=${k} aria-pressed=${String(w.geschlecht === k)} onClick=${() => setW({ ...w, geschlecht: k })}>${t}</button>`)}</div></label>
      </div>
    </section>
    ${LIFTE.map(([l, name]) => html`<section key=${l} class="card pad stack">
      <div class="row between"><span class="viz-t">${name}</span><span class="muted" style="font-size:12.5px">${besterGueltig(l) ? deEn(`Bester: ${fmt(besterGueltig(l))} ${E}`, `Best: ${fmt(besterGueltig(l))} ${E}`) : ''}</span></div>
      <div class="wk-versuche">${[0, 1, 2].map((i) => html`<div key=${i} class=${`wk-versuch ${w.status[l][i] ?? ''}`}>
        <span class="eyebrow">${`${i + 1}. Versuch`}</span>
        <${ZahlFeld} id=${`wk-${l}-${i}`} label="" wert=${w.versuche[l][i]} schritt=${inc} setze=${(x) => setzeVersuch(l, i, x)}/>
        <button class="chip" onClick=${() => tippeStatus(l, i)}>${w.status[l][i] === 'gut' ? '✓ gültig' : w.status[l][i] === 'ungueltig' ? '✗ ungültig' : 'offen'}</button></div>`)}</div>
    </section>`)}
    <section class="card pad stack">
      <span class="viz-t">${deEn(`Aufwärmen bis zum Opener · ${LIFTE.find(([l]) => l === naechsterLift)[1]}`, `Warm-up to the opener · ${LIFTE.find(([l]) => l === naechsterLift)[1]}`)}</span>
      ${aufw.length ? html`<div class="ladder">${aufw.map((a, i) => html`<div key=${i}><span class="zahl">${`${fmt(inAnzeige(a.kg), 1)} ${E}`}</span><span class="muted">× ${a.wdh}</span><${Scheiben} kg=${a.kg}/></div>`)}
        <div class="wk-opener"><span class="zahl">${`${fmt(w.versuche[naechsterLift][0], 1)} ${E}`}</span><span class="muted">× 1 · Opener</span><${Scheiben} kg=${inKg(w.versuche[naechsterLift][0] ?? 0)}/></div></div>`
        : html`<span class="muted">Opener eintragen.</span>`}
      <div class="fields"><${ZahlFeld} id="wk-vor" label="Athleten vor dir (bis zu deinem Versuch)" wert=${w.vorDir} schritt=${1} setze=${(x) => setW({ ...w, vorDir: Math.max(0, Math.round(x)) })}/></div>
      <span class="muted" style="font-size:12.5px">${deEn(`Etwa ${w.vorDir} min bis zu deinem Versuch (rund 1 min je Versuch). Mit dem Aufwärmen gut ${Math.max(15, aufw.length * 4)} min vor dem Opener beginnen.`,
        `About ${w.vorDir} min until your attempt (roughly 1 min per attempt). Start warming up about ${Math.max(15, aufw.length * 4)} min before the opener.`)}</span>
    </section>
    <section class="card pad stack">
      <span class="viz-t">Ziele (3. Versuch)</span>
      <div class="fields drei">${LIFTE.map(([l, t]) => html`<${ZahlFeld} key=${l} id=${`wk-ziel-${l}`} label=${t} wert=${w.ziel[l]} schritt=${inc} setze=${(x) => setW({ ...w, ziel: { ...w.ziel, [l]: x } })}/>`)}</div>
      <button class="btn btn-soft btn-block" onClick=${neuPlanen}>Versuche neu planen (91 % · 96 % · 100 %)</button>
      ${opener !== Infinity ? null : html`<span class="muted">Noch keine Versuche.</span>`}
    </section>
  </div>`;
}
