// PR Hunter · Wettkampftag (Wunsch 189): Versuche je Lift planen und abhaken (gültig/ungültig), Total und DOTS live,
// Aufwärmplan bis zum Opener, Wartezeit nach Athleten vor dir. Alles auf einer Seite, gemerkt auf dem Gerät (der
// Wettkampftag übersteht Neuladen und Wechsel in andere Seiten). Gewichte in der Anzeigeeinheit.
import { html, useState, fmt, inKg, inAnzeige, stangeKg, scheibenKg, einheit, ZahlFeld, deEn, Scheiben, datumKurz, sprache } from './basis.js';
import { trendAm } from '../js/auswertung.js';
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

// #################################################################
// 197/201/196: Wettkampf-Countdown auf „Heute“ – Wochen bis zum Wettkampf, passende Phase, Prognose der Lifts zum Datum
// aus dem e1RM-Trend und (nur mit Zielklasse) Abstand zur Gewichtsklasse. Ohne Wettkampfdatum unsichtbar.
// #################################################################
const PHASE = (w) => (w <= 0 ? ['Heute ist Wettkampftag – viel Erfolg! Werkzeuge → Wettkampftag.', 'It\'s meet day – good luck! Tools → Meet day.']
  : w <= 1 ? ['Taper-Woche: nur noch Opener-Singles, viel schlafen, Gewicht machen.', 'Taper week: openers only, sleep a lot, make weight.']
  : w <= 4 ? ['Peaking: schwere Singles bei RPE 8–9, Volumen sinkt, Versuche planen.', 'Peaking: heavy singles at RPE 8–9, volume drops, plan your attempts.']
  : w <= 10 ? ['Zeit für einen Peaking-Block (z. B. 6–8 Wochen) mit Test am Ende.', 'Time for a peaking block (e.g. 6–8 weeks) with a test at the end.']
  : ['Noch Zeit für einen Aufbau-Block mit mehr Volumen, danach Peaking.', 'Still time for a volume block, then peaking.']);

export function WettkampfCountdown({ einst, e1rmWoche, koerperKg, heute }) {
  const datum = einst.wettkampfDatum;
  if (!datum || datum < heute) return null;
  const tage = Math.round((Date.parse(`${datum}T00:00:00Z`) - Date.parse(`${heute}T00:00:00Z`)) / 864e5), wochen = Math.ceil(tage / 7);
  // fallender Trend (Cut, Pause) wird nicht weiter nach unten verlängert – Prognose = heutiger Trendwert
  const prog = LIFTE.map(([l, n]) => { const p = trendAm(e1rmWoche[l] ?? [], wochen), jetzt = trendAm(e1rmWoche[l] ?? [], 0);
    return [l, n, p && jetzt ? { ...p, wert: Math.max(p.wert, jetzt.wert) } : p]; }).filter(([, , p]) => p?.wert > 0);
  const total = prog.length === 3 ? prog.reduce((a, [, , p]) => a + p.wert, 0) : null;
  const klasse = einst.gewichtsklasse > 0 ? Number(einst.gewichtsklasse) : null, ueber = klasse && koerperKg ? koerperKg - klasse : null;
  const en = sprache() === 'en';
  return html`<section class="card pad stack countdown">
    <div class="row between"><div><span class="eyebrow">${deEn('Wettkampf', 'Meet')} · ${datumKurz(datum)}${datum.slice(2, 4)}</span>
      <div class="cd-zahl"><b>${tage <= 0 ? deEn('Heute', 'Today') : tage < 14 ? tage : wochen}</b><span>${tage <= 0 ? '' : tage < 14 ? deEn(tage === 1 ? 'Tag' : 'Tage', tage === 1 ? 'day' : 'days') : deEn('Wochen', 'weeks')}</span></div></div>
      <span class="cd-pokal" aria-hidden="true">🏆</span></div>
    <span class="muted" style="font-size:13px">${PHASE(wochen)[en ? 1 : 0]}</span>
    ${prog.length && tage > 0 ? html`<div class="cd-prognose"><span class="eyebrow">${deEn('Prognose zum Wettkampf (e1RM-Trend)', 'Forecast for meet day (e1RM trend)')}</span>
      <div class="cd-lifts">${prog.map(([l, n, p]) => html`<span key=${l}><small>${n}</small><b>${`${fmt(inAnzeige(p.wert), 0)}`}</b></span>`)}
        ${total ? html`<span class="cd-total"><small>Total</small><b>${fmt(inAnzeige(total), 0)}</b></span>` : null}</div></div>` : null}
    ${klasse && ueber != null ? html`<div class=${`cd-klasse ${ueber > 0 ? 'drueber' : ''}`}>${ueber > 0
      ? deEn(`${fmt(ueber, 1)} kg über der Klasse ${fmt(klasse)} kg${tage > 7 ? ` – etwa ${fmt(ueber / Math.max(1, wochen), 1)} kg pro Woche` : ''}`,
        `${fmt(ueber, 1)} kg above the ${fmt(klasse)} kg class${tage > 7 ? ` – about ${fmt(ueber / Math.max(1, wochen), 1)} kg per week` : ''}`)
      : deEn(`${fmt(-ueber, 1)} kg unter dem Limit der Klasse ${fmt(klasse)} kg`, `${fmt(-ueber, 1)} kg under the ${fmt(klasse)} kg limit`)}</div>` : null}
  </section>`;
}
