// PR Hunter · Rechner: Scheiben, RPE, 1RM, Klimmzug, Aufwärmen, Prozent, Punkte, Versuche – mit dem getesteten Rechenkern.
// Eingaben und Ergebnisse in der gewählten Einheit (kg/lb); Scheiben und Hantelbild rechnen intern in kg.
import { html, useState, fmt, Scheiben, Hantel, einheit, inKg, inAnzeige, stangeKg, scheibenKg, formel, ZahlFeld } from './basis.js';
import { e1rm, wdhTabelle, rpeRechner, aufwaermen, e1rmKoerper, zusatzFuer, lastFuer } from '../js/rechnen.js';
import { dots, ipfGl, wilksPunkte, versuche } from '../js/punkte.js';
import { E1RM_AKTUELL, KOERPERGEWICHT } from './stand.js';
import { HAUPT } from '../js/daten.js';

// Werte im Rechner sind schon in der Anzeigeeinheit; das Zahlenfeld rechnet deshalb nicht um
const Zahl = ({ id, label, wert, setze }) => html`<${ZahlFeld} id=${id} label=${label} wert=${wert} setze=${setze}/>`;
const RECHNER = [['1rm', '1RM'], ['scheiben', 'Scheiben'], ['rpe', 'RPE'], ['prozent', 'Prozent'], ['koerper', 'Klimmzug'],
  ['warm', 'Aufwärmen'], ['punkte', 'Punkte'], ['versuche', 'Versuche']];
const runde1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

export function Rechner({ einst, vorlage = null }) {
  const E = einheit(), lb = E === 'lb', inc = einst.inc ?? (lb ? 5 : 2.5);
  const start = (kg) => runde1(inAnzeige(kg));
  const [art, setArt] = useState('1rm');
  const [ziel, setZiel] = useState(() => start(182.5));
  // Läuft ein Training: Gewicht und Wdh des aktuellen Satzes; RPE 10 als Standard (Satz bis Versagen)
  const [b, setB] = useState(() => ({ kg: start(vorlage?.kg ?? 180), wdh: vorlage?.wdh ?? 3, rpe: 10 }));
  const [z, setZ] = useState({ wdh: 5, rpe: 8 });
  const [top, setTop] = useState(() => start(200));
  const [max, setMax] = useState(() => start(E1RM_AKTUELL[HAUPT.squat] ?? 200));
  const [kz, setKz] = useState(() => ({ koerper: start(einst.koerpergewicht ?? KOERPERGEWICHT ?? 85), zusatz: start(20), wdh: 8, rpe: 8, zielWdh: 5, zielRpe: 8 }));
  const [p, setP] = useState(() => ({ total: start(Object.values(HAUPT).reduce((s, k) => s + (E1RM_AKTUELL[k] ?? 0), 0) || 600), koerper: start(einst.koerpergewicht ?? KOERPERGEWICHT ?? 85), geschlecht: 'm' }));
  const [v, setV] = useState(() => ({ squat: start(E1RM_AKTUELL[HAUPT.squat] ?? 200), bench: start(E1RM_AKTUELL[HAUPT.bench] ?? 140), dead: start(E1RM_AKTUELL[HAUPT.dead] ?? 220) }));
  const r = rpeRechner(b, z, inc);
  const k = e1rmKoerper(kz.zusatz, kz.wdh, kz.rpe, kz.koerper, formel());
  const kZiel = k ? zusatzFuer(k.gesamt, kz.zielWdh, kz.zielRpe, kz.koerper, lb ? 2.5 : 1.25) : null;
  const naiv = lastFuer(e1rm(kz.zusatz, kz.wdh, kz.rpe), kz.zielWdh, kz.zielRpe, lb ? 2.5 : 1.25);
  const totalKg = inKg(p.total), koerperKg = inKg(p.koerper);
  const aufw = aufwaermen(inKg(top ?? 0), { stange: stangeKg(), inventar: scheibenKg(), inc: lb ? inKg(5) : 2.5 });
  return html`<div class="screen">
    <header class="topbar"><div><div class="eyebrow">Werkzeuge</div><h1 class="h1">Rechner</h1></div></header>
    <div class="filter" role="group" aria-label="Rechner wählen">${RECHNER.map(([key, t]) =>
      html`<button key=${key} class="chip" aria-pressed=${String(art === key)} onClick=${() => setArt(key)}>${t}</button>`)}</div>

    ${art === 'scheiben' && html`<section class="card pad stack">
      <${Zahl} id="r-ziel" label=${`Zielgewicht (${E})`} wert=${ziel} schritt=${inc} setze=${setZiel}/>
      ${inKg(ziel ?? 0) >= stangeKg() ? html`<${Hantel} kg=${inKg(ziel)}/><div class="row between"><span class="eyebrow">Pro Seite</span><${Scheiben} kg=${inKg(ziel)}/></div>
        <p class="muted" style="margin:0;font-size:13px">Stange ${fmt(inAnzeige(stangeKg()), 1)} ${E}, Scheiben laut Einstellungen.</p>`
        : html`<p class="muted" style="margin:0">Mindestens ${fmt(inAnzeige(stangeKg()), 1)} ${E} (leere Stange).</p>`}
    </section>`}

    ${art === 'rpe' && html`<section class="card pad stack">
      <div class="rechner-box"><div class="rechner-kopf"><span class="rechner-nr">1</span><b>Bekannter Satz</b><span class="muted">was du geschafft hast</span></div>
        <div class="fields drei"><${Zahl} id="r-bkg" label=${E} wert=${b.kg} schritt=${inc} setze=${(x) => setB({ ...b, kg: x })}/>
          <${Zahl} id="r-bwdh" label="Wdh" schritt="1" wert=${b.wdh} setze=${(x) => setB({ ...b, wdh: x })}/>
          <${Zahl} id="r-brpe" label="RPE" schritt="0.5" wert=${b.rpe} setze=${(x) => setB({ ...b, rpe: x })}/></div></div>
      <div class="rechner-box ziel"><div class="rechner-kopf"><span class="rechner-nr">2</span><b>Ziel</b><span class="muted">was du vorhast</span></div>
        <div class="fields drei"><${Zahl} id="r-zwdh" label="Wdh" schritt="1" wert=${z.wdh} setze=${(x) => setZ({ ...z, wdh: x })}/>
          <${Zahl} id="r-zrpe" label="RPE" schritt="0.5" wert=${z.rpe} setze=${(x) => setZ({ ...z, rpe: x })}/><span></span></div></div>
      <div class="result rechner-ergebnis"><div class="big">${r.kg != null ? fmt(r.kg) : '–'}<small>${E}</small></div>
        <p class="muted" style="margin:6px 0 0">${r.kg != null ? `für ${z.wdh} Wdh @ RPE ${fmt(z.rpe)} · e1RM ${fmt(r.e1rm, 1)} ${E}` : 'Wdh 1–12 und RPE 6–10 eingeben'}</p></div>
    </section>`}

    ${art === '1rm' && html`<section class="card pad stack">
      <div class="fields drei"><${Zahl} id="r-1kg" label=${E} wert=${b.kg} schritt=${inc} setze=${(x) => setB({ ...b, kg: x })}/>
        <${Zahl} id="r-1wdh" label="Wdh" schritt="1" wert=${b.wdh} setze=${(x) => setB({ ...b, wdh: x })}/>
        <${Zahl} id="r-1rpe" label="RPE" schritt="0.5" wert=${b.rpe} setze=${(x) => setB({ ...b, rpe: x })}/></div>
      <div class="kv">${[['rpe', 'RTS'], ['epley', 'Epley'], ['brzycki', 'Brzycki']].map(([f, t]) => html`<div key=${f}><span class="eyebrow">${t}${formel() === f ? ' ✓' : ''}</span><b>${fmt(e1rm(b.kg, b.wdh, b.rpe, f), 1)}</b></div>`)}</div>
      <table class="rec"><thead><tr><th>Wdh @ RPE 10</th><th>Anteil</th><th>${E}</th></tr></thead>
        <tbody>${wdhTabelle(e1rm(b.kg, b.wdh, b.rpe, formel()) ?? 0, formel(), inc).map((w) => html`<tr key=${w.wdh}><td>${w.wdh}</td><td class="muted">${fmt(w.anteil * 100, 1)} %</td><td class="k">${fmt(w.kgGerundet)}</td></tr>`)}</tbody></table>
    </section>`}

    ${art === 'prozent' && html`<section class="card pad stack">
      <${Zahl} id="r-max" label=${`Max (${E})`} wert=${max} schritt=${inc} setze=${setMax}/>
      <table class="rec"><thead><tr><th>Prozent</th><th>${E}</th><th>gerundet</th></tr></thead>
        <tbody>${[50, 55, 60, 65, 70, 72.5, 75, 77.5, 80, 82.5, 85, 87.5, 90, 92.5, 95, 97.5, 100].map((pz) => html`<tr key=${pz}><td>${fmt(pz, 1)} %</td>
          <td class="muted">${max ? fmt((max * pz) / 100, 1) : '–'}</td><td class="k">${max ? fmt(Math.round((max * pz) / 100 / inc) * inc) : '–'}</td></tr>`)}</tbody></table>
      <p class="muted" style="margin:0;font-size:12.5px">Vorbelegt mit deinem aktuellen Kniebeuge-e1RM. Gerundet auf ${fmt(inc)} ${E}.</p>
    </section>`}

    ${art === 'koerper' && html`<section class="card pad stack">
      <p class="muted" style="margin:0;font-size:13.5px">Für Klimmzüge und Dips zählt die Gesamtlast: Körpergewicht plus Zusatz. Nur mit dem Zusatz zu rechnen unterschätzt das Max stark.</p>
      <div class="fields"><${Zahl} id="k-kg" label=${`Körpergewicht (${E})`} wert=${kz.koerper} schritt="0.5" setze=${(x) => setKz({ ...kz, koerper: x })}/>
        <${Zahl} id="k-zus" label=${`Zusatz (${E})`} wert=${kz.zusatz} schritt="1.25" setze=${(x) => setKz({ ...kz, zusatz: x })}/>
        <${Zahl} id="k-wdh" label="Wdh" schritt="1" wert=${kz.wdh} setze=${(x) => setKz({ ...kz, wdh: x })}/>
        <${Zahl} id="k-rpe" label="RPE" schritt="0.5" wert=${kz.rpe} setze=${(x) => setKz({ ...kz, rpe: x })}/></div>
      <div class="kv"><div><span class="eyebrow">e1RM gesamt</span><b>${k ? fmt(k.gesamt, 1) : '–'}</b></div>
        <div><span class="eyebrow">Zusatz-1RM</span><b>${k ? `${k.zusatz > 0 ? '+' : ''}${fmt(k.zusatz, 1)}` : '–'}</b></div>
        <div><span class="eyebrow">nur Zusatz</span><b class="muted">${fmt(e1rm(kz.zusatz, kz.wdh, kz.rpe), 1)}</b></div></div>
      <span class="eyebrow">Ziel</span>
      <div class="fields"><${Zahl} id="k-zwdh" label="Wdh" schritt="1" wert=${kz.zielWdh} setze=${(x) => setKz({ ...kz, zielWdh: x })}/>
        <${Zahl} id="k-zrpe" label="RPE" schritt="0.5" wert=${kz.zielRpe} setze=${(x) => setKz({ ...kz, zielRpe: x })}/></div>
      <div class="result"><div class="big">${kZiel != null ? `${kZiel > 0 ? '+' : ''}${fmt(kZiel)}` : '–'}<small>${E}</small></div>
        <p class="muted" style="margin:6px 0 0">${kZiel != null ? `Zusatz für ${kz.zielWdh} Wdh @ RPE ${fmt(kz.zielRpe)}${kZiel < 0 ? ' (negativ = Unterstützung)' : ''} · nur mit Zusatz gerechnet wären es ${fmt(naiv)} ${E}` : 'Wdh 1–12 und RPE 6–10 eingeben'}</p></div>
    </section>`}

    ${art === 'warm' && html`<section class="card pad stack">
      <${Zahl} id="r-top" label=${`Top-Satz (${E})`} wert=${top} schritt=${inc} setze=${setTop}/>
      <div class="ladder">${aufw.map((a, i) => html`<div key=${i}><span class="zahl">${fmt(inAnzeige(a.kg), 1)} ${E}</span><span class="muted">× ${a.wdh}</span><${Scheiben} kg=${a.kg}/></div>`)}</div>
      <p class="muted" style="margin:0;font-size:13px">Leere Stange bis etwa 90 % mit sinkenden Wdh, Scheiben laut Einstellungen.</p>
    </section>`}

    ${art === 'punkte' && html`<section class="card pad stack">
      <div class="fields"><${Zahl} id="p-total" label=${`Total (${E})`} wert=${p.total} schritt=${inc} setze=${(x) => setP({ ...p, total: x })}/>
        <${Zahl} id="p-kg" label=${`Körpergewicht (${E})`} wert=${p.koerper} schritt="0.1" setze=${(x) => setP({ ...p, koerper: x })}/></div>
      <div class="seg" role="group" aria-label="Wertung">${[['m', 'Männer'], ['w', 'Frauen']].map(([g, t]) => html`<button key=${g} aria-pressed=${String(p.geschlecht === g)} onClick=${() => setP({ ...p, geschlecht: g })}>${t}</button>`)}</div>
      <div class="kv"><div><span class="eyebrow">DOTS</span><b>${fmt(dots(totalKg, koerperKg, p.geschlecht), 1)}</b></div>
        <div><span class="eyebrow">IPF GL</span><b>${fmt(ipfGl(totalKg, koerperKg, p.geschlecht), 1)}</b></div>
        <div><span class="eyebrow">Wilks</span><b>${fmt(wilksPunkte(totalKg, koerperKg, p.geschlecht), 1)}</b></div></div>
      <p class="muted" style="margin:0;font-size:12.5px">Vorbelegt mit deinem aktuellen e1RM-Total. IPF GL für Classic (ohne Equipment).</p>
    </section>`}

    ${art === 'versuche' && html`<section class="card pad stack">
      <p class="muted" style="margin:0;font-size:13.5px">Ziel für den 3. Versuch eintragen: 1. Versuch etwa 91 %, 2. Versuch etwa 96 % (Strategie nach Matt Gary). Vorbelegt mit deinem aktuellen e1RM.</p>
      <div class="fields drei">${[['squat', 'Kniebeuge'], ['bench', 'Bankdrücken'], ['dead', 'Kreuzheben']].map(([l, t]) => html`<${Zahl} key=${l} id=${`v-${l}`} label=${t} wert=${v[l]} schritt=${inc} setze=${(x) => setV({ ...v, [l]: x })}/>`)}</div>
      <table class="rec"><thead><tr><th>Lift</th><th>1.</th><th>2.</th><th>3.</th></tr></thead>
        <tbody>${[['squat', 'KB'], ['bench', 'BD'], ['dead', 'KH']].map(([l, t]) => { const a = versuche(v[l], inc); return html`<tr key=${l}><td>${t}</td>${(a ?? [null, null, null]).map((x, i) => html`<td key=${i} class=${i === 2 ? 'k' : ''}>${fmt(x)}</td>`)}</tr>`; })}
          <tr><td><b>Total</b></td>${[0, 1, 2].map((i) => html`<td key=${i} class=${i === 2 ? 'k' : 'muted'}>${fmt(['squat', 'bench', 'dead'].reduce((s, l) => s + (versuche(v[l], inc)?.[i] ?? 0), 0))}</td>`)}</tr></tbody></table>
    </section>`}
  </div>`;
}
