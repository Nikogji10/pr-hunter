// PR Hunter · Statistik-Karten Zielprognose (Funktionskatalog „Zielprognose“) und Vergleich mit dem Kumpel
// („Vergleich mit Kumpel“, nur wenn beide in den Einstellungen zustimmen; Daten über public.compare_stats).
import { html, useState, useEffect, useRef, fmt, gw, gwE, einheit, LIFT, datumLang, datumKurz, speicher, ZahlFeld, Avatar } from './basis.js';
import { zielprognose } from '../js/auswertung.js';
import { dots } from '../js/punkte.js';
import { DIENSTE, wochen, e1rmWoche } from './stand.js';
import { HAUPT } from '../js/daten.js';
import { mround } from '../js/rechnen.js';

const LIFTS = ['squat', 'bench', 'dead'];

/**
 * Ziel je Lift: geschätztes Datum aus dem e1RM-Trend. Die Ziele liegen im Profil (einst.ziele, je Übungsschlüssel – dieselben
 * wie auf der Übungsseite); ohne gesetztes Ziel wird aktuelle Form + 7,5 kg (auf 5 gerundet) vorgeschlagen.
 */
export function Zielprognose({ aktuell, ziele = {}, setZiel = null }) {
  const [lift, setLift] = useState(() => speicher.lies('prh-ziel-lift') ?? 'dead');
  const [fenster, setFenster] = useState(26);
  const vorschlag = (l) => (aktuell[l] != null ? mround(aktuell[l] + 7.5, 5) : null);
  const [entwurf, setEntwurf] = useState({});
  const ziel = entwurf[lift] ?? ziele[HAUPT[lift]] ?? vorschlag(lift);
  const uhr = useRef(null);
  // ins Profil erst 1 s nach dem letzten Tippen (jede Änderung löst sonst einen Abgleich aus)
  const setzeZiel = (v) => { setEntwurf((x) => ({ ...x, [lift]: v })); clearTimeout(uhr.current); if (v > 0 && setZiel) uhr.current = setTimeout(() => setZiel(HAUPT[lift], v), 1000); };
  const p = ziel > 0 ? zielprognose(wochen, e1rmWoche[lift], ziel, { fenster }) : null;
  return html`<section class="card pad stack">
    <div><span class="viz-t">Zielprognose</span><div class="viz-u">Aus dem e1RM-Trend (lineare Regression über die Wochen mit Training)</div></div>
    <div class="filter">${LIFTS.map((l) => html`<button key=${l} class="chip" aria-pressed=${String(lift === l)} onClick=${() => { setLift(l); speicher.schreib('prh-ziel-lift', l); }}>
      <i class="dot" style=${`background:${LIFT[l].farbe}`}></i>${LIFT[l].name}</button>`)}</div>
    <div class="seg" role="group" aria-label="Trend aus">${[[13, '3 Monate'], [26, '6 Monate'], [52, '1 Jahr']].map(([w, t]) => html`<button key=${w}
      aria-pressed=${String(fenster === w)} onClick=${() => setFenster(w)}>${t}</button>`)}</div>
    <${ZahlFeld} key=${lift} id="ziel-kg" label=${`Ziel-1RM ${LIFT[lift].name} (${einheit()})`} kg=${true} wert=${ziel} setze=${setzeZiel}/>
    ${!p ? null : p.grund === 'zuWenig' ? html`<p class="muted" style="margin:0">Zu wenige Wochen mit ${LIFT[lift].name} (${p.punkte} von mindestens 6) für einen Trend.</p>`
      : p.grund === 'erreicht' ? html`<p style="margin:0"><b>Schon erreicht:</b> Trendwert ${gwE(p.aktuell, 1)}. Zeit für ein höheres Ziel.</p>`
      : p.grund === 'keinTrend' ? html`<p style="margin:0">Derzeit kein Aufwärtstrend (${p.proWoche >= 0 ? '+' : ''}${gw(p.proWoche, 2)} ${einheit()} je Woche) – so lässt sich kein Datum schätzen.</p>`
      : html`<div class="prog-meta"><div><b>${datumKurz(p.datum)}${p.datum.slice(2, 4)}</b><span>geschätzt</span></div><div><b>${p.wochen}</b><span>Wochen</span></div>
          <div><b>+${gw(p.proWoche, 2)}</b><span>${einheit()} je Woche</span></div><div><b>${gw(p.aktuell, 1)}</b><span>Trend jetzt</span></div></div>
        <span class="muted" style="font-size:12.5px">${datumLang(p.datum)} – wenn es so weitergeht wie bisher. Deloads, Urlaub und Cut verschieben das; je weiter weg, desto unsicherer.</span>`}
  </section>`;
}

/** Vergleich mit dem Kumpel: e1RM je Lift, Total, Körpergewicht, DOTS. */
export function Vergleich({ freigegeben }) {
  const [daten, setDaten] = useState(undefined);            // undefined = lädt, null = Update 08 fehlt, { fehler }
  useEffect(() => {
    if (!freigegeben || !DIENSTE.ladeVergleich) return;
    DIENSTE.ladeVergleich().then(setDaten).catch((e) => setDaten({ fehler: navigator.onLine ? e.message : 'Kein Netz – der Vergleich kommt vom Server.' }));
  }, [freigegeben]);
  if (!DIENSTE.ladeVergleich) return null;
  const kopf = html`<div><span class="viz-t">Vergleich mit dem Kumpel</span><div class="viz-u">Nur e1RM und Körpergewicht – keine Trainings, keine Sätze</div></div>`;
  if (!freigegeben) return html`<section class="card pad stack">${kopf}
    <p class="muted" style="margin:0;font-size:14px">Aus. Wenn ihr beide in den Einstellungen „Mit dem Kumpel vergleichen“ einschaltet, steht hier, wer wo vorne liegt.</p></section>`;
  if (daten === undefined) return html`<section class="card pad stack">${kopf}<p class="muted" style="margin:0">Lade …</p></section>`;
  if (daten === null) return html`<section class="card pad stack">${kopf}<p class="muted" style="margin:0;font-size:14px">Die Datenbank kennt den Vergleich noch nicht (Update 08 fehlt).</p></section>`;
  if (daten.fehler) return html`<section class="card pad stack">${kopf}<p class="fehler">${daten.fehler}</p></section>`;
  const personen = daten;
  if (personen.length < 2) return html`<section class="card pad stack">${kopf}
    <p class="muted" style="margin:0;font-size:14px">Du hast freigegeben. Sobald dein Kumpel es auch tut, erscheint er hier.</p></section>`;
  const total = (p) => (LIFTS.every((l) => p.lifts[l]?.aktuell != null) ? LIFTS.reduce((a, l) => a + p.lifts[l].aktuell, 0) : null);
  const zeile = (titel, wert, besser = 'hoch') => {
    const w = personen.map(wert);
    const da = w.filter((x) => x != null);
    const top = da.length > 1 && besser === 'hoch' ? Math.max(...da) : null;
    return html`<tr key=${titel}><td>${titel}</td>${w.map((x, i) => html`<td key=${i} class=${x != null && x === top ? 'k vorne' : 'k'}>${x == null ? '–' : titel === 'DOTS' ? fmt(x, 1) : gw(x, 1)}</td>`)}</tr>`;
  };
  return html`<section class="card pad stack">${kopf}
    <div style="overflow-x:auto"><table class="rec vergleich"><thead><tr><th></th>${personen.map((p) => html`<th key=${p.id}><span class="vgl-kopf"><${Avatar} bild=${p.avatar} name=${p.name} groesse=${30}/>${p.ich ? 'Du' : p.name}</span></th>`)}</tr></thead>
      <tbody>${LIFTS.map((l) => zeile(LIFT[l].name, (p) => p.lifts[l]?.aktuell))}
        ${zeile('Total', total)}
        ${zeile('Körpergewicht', (p) => p.koerpergewicht, 'keins')}
        ${zeile('DOTS', (p) => (total(p) != null && p.koerpergewicht ? dots(total(p), p.koerpergewicht) : null))}</tbody></table></div>
    <span class="muted" style="font-size:12.5px">e1RM in ${einheit()}: bester Wert der letzten 12 Wochen. Gold = vorne. Bestwerte aller Zeiten: ${personen.map((p) =>
      `${p.ich ? 'du' : p.name} ${LIFTS.map((l) => (p.lifts[l]?.best != null ? gw(p.lifts[l].best, 1) : '–')).join(' / ')}`).join(' · ')}.</span>
  </section>`;
}
