// PR Hunter · Körpergewicht auf „Heute“ (wie Yazio): großer Wert, −/+ in 0,1er-Schritten, Ziel mit Abstand, Verlauf
// der letzten Wochen. Gespeichert wird 1,5 s nach dem letzten Tippen als Wert des Tages (body_metrics).
import { html, useState, useEffect, useRef, fmt, I, Sheet, einheit, inAnzeige, inKg, datumKurz, ZahlFeld } from './basis.js';
import { HEUTE, KOERPERVERLAUF, plusTage } from './stand.js';
import { Sparkline } from './diagramme.js';

const runde1 = (x) => Math.round(x * 10) / 10;

export function GewichtKarte({ einst, setEinst }) {
  const letzter = KOERPERVERLAUF.at(-1) ?? null;
  const heute = letzter?.datum === HEUTE;
  const basis = einst.koerpergewicht ?? letzter?.kg ?? null;
  const [entwurf, setEntwurf] = useState(null);           // Anzeigeeinheit, solange getippt wird
  const [zielOffen, setZielOffen] = useState(false);
  const [ziel, setZiel] = useState(einst.gewichtZiel ?? null);
  const uhr = useRef(null);
  const wert = entwurf ?? (basis != null ? runde1(inAnzeige(basis)) : null);
  useEffect(() => () => clearTimeout(uhr.current), []);
  const tippe = (d) => {
    const neu = runde1((wert ?? (einheit() === 'lb' ? 180 : 80)) + d);
    setEntwurf(neu);
    clearTimeout(uhr.current);
    uhr.current = setTimeout(() => { setEinst({ ...einst, koerpergewicht: inKg(neu) }); setEntwurf(null); }, 1500);
  };
  const zielAnzeige = einst.gewichtZiel != null ? runde1(inAnzeige(einst.gewichtZiel)) : null;
  const abstand = zielAnzeige != null && wert != null ? runde1(wert - zielAnzeige) : null;
  const verlauf = KOERPERVERLAUF.filter((m) => m.datum >= plusTage(HEUTE, -56)).map((m) => inAnzeige(m.kg));
  return html`<section class="card pad gewicht">
    <div class="row between"><span class="viz-t">Körpergewicht</span>
      <button class="chip" onClick=${() => { setZiel(einst.gewichtZiel ?? null); setZielOffen(true); }}>${zielAnzeige != null ? `Ziel ${fmt(zielAnzeige, 1)} ${einheit()}` : 'Ziel setzen'}</button></div>
    <div class="gewicht-zeile">
      <button class="rund" onClick=${() => tippe(-0.1)} aria-label=${`0,1 ${einheit()} weniger`}>−</button>
      <div class="gewicht-wert">
        <b class="zahl tab-num">${wert != null ? fmt(wert, 1) : '–'}<small> ${einheit()}</small></b>
        <span class="muted">${entwurf != null ? 'wird gespeichert …' : heute ? 'heute gewogen' : letzter ? `zuletzt ${datumKurz(letzter.datum)} – tippen für heute` : 'noch kein Wert'}</span>
      </div>
      <button class="rund" onClick=${() => tippe(0.1)} aria-label=${`0,1 ${einheit()} mehr`}>+</button>
    </div>
    ${abstand != null ? html`<div class="gewicht-ziel"><span>${abstand === 0 ? 'Ziel erreicht' : abstand > 0 ? `noch ${fmt(abstand, 1)} ${einheit()} runter` : `noch ${fmt(-abstand, 1)} ${einheit()} rauf`}</span>
      ${verlauf.length > 2 ? html`<span class="muted">${verlauf.length} Werte · 8 Wochen</span>` : null}</div>` : null}
    ${verlauf.length > 2 ? html`<${Sparkline} werte=${verlauf} farbe="var(--acc)"/>` : null}
    ${zielOffen ? html`<${Sheet} zu=${() => setZielOffen(false)} label="Gewichtsziel">
      <h2 class="h2">Gewichtsziel</h2>
      <${ZahlFeld} id="g-ziel" label=${`Ziel (${einheit()})`} kg=${true} wert=${ziel} setze=${setZiel} platzhalter="–"/>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => { setEinst({ ...einst, gewichtZiel: null }); setZielOffen(false); }}>Kein Ziel</button>
        <button class="btn btn-chalk" style="flex:1.4" disabled=${!(ziel >= 30 && ziel <= 250)} onClick=${() => { setEinst({ ...einst, gewichtZiel: runde1(ziel) }); setZielOffen(false); }}>Speichern</button></div>
    <//>` : null}
  </section>`;
}
