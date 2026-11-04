// PR Hunter · Statistik-Reiter „Ausdauer“ (Wünsche 225–227): nur sichtbar, wenn in den Einstellungen gewählt.
// Umfang je Woche, Laufen (Bestzeiten, Pace), Rad (Leistungskurve, FTP, W/kg), Zonen, Form aus Kraft + Ausdauer, Ausrüstung.
import { html, useState, deEn, fmt, datumKurz, I } from './basis.js';
import { HEUTE } from './stand.js';
import { LinienChart, StapelSaeulen } from './diagramme.js';
import { normiere, minuten } from '../js/insights.js';
import { sportarten, sichtbar, sportVon, wochen, bestzeiten, leistungskurve, ftpSchaetzung, last, form, paceSek, dauerText, montag } from '../js/ausdauer.js';

const FARBE = { lauf: '#F97316', rad: '#0EA5E9' };
const ZONE = ['#94A3B8', '#22C55E', '#EAB308', '#F97316', '#EF4444'];

// Zwischenspeicher: gleiche Trainings + gleiche Einheiten + gleicher Zeitraum → sofort (Öffnen des Reiters ruckelte)
let SPEICHER = { trainings: null, liste: null, von: null, f: null };
export function formFuer(trainings, liste, von) {
  if (SPEICHER.trainings === trainings && SPEICHER.liste === liste && SPEICHER.von === von) return SPEICHER.f;
  // 6 Monate Vorlauf reichen, damit Fitness (42 Tage) eingeschwungen ist – nicht die ganze Geschichte
  const vorlauf = new Date(Date.parse(`${montag(von)}T00:00:00Z`) - 182 * 864e5).toISOString().slice(0, 10);
  const l = tageslasten(trainings.filter((t) => t?.datum >= vorlauf), liste.filter((a) => a.datum >= vorlauf));
  const f = form(l, { von: montag(von), bis: HEUTE, ab: vorlauf });
  SPEICHER = { trainings, liste, von, f };
  return f;
}

/** Tageslasten aus Krafttraining (Minuten × Session-RPE, ohne RPE 6) und Ausdauer (Minuten × RPE bzw. Ersatz nach Typ). */
export function tageslasten(trainings, liste) {
  const l = {};
  for (const e of normiere(trainings)) { const m = minuten(e); if (m && m < 600) l[e.datum] = (l[e.datum] ?? 0) + Math.round(m * (e.sessionRpe ?? 6)); }
  for (const a of liste) if (!a.geloescht) l[a.datum] = (l[a.datum] ?? 0) + last(a);
  return l;
}

export function AusdauerStatistik({ liste: alle, einst, setEinst, trainings, x }) {
  const wahl = einst.ausdauer, sports = sportarten(wahl), liste = sichtbar(alle, wahl);
  const von = x[0] ?? HEUTE;
  const w = wochen(liste, { von, bis: HEUTE });
  const nachWoche = Object.fromEntries(w.map((z) => [z.woche, z]));
  const kmSaeulen = x.map((d) => ({ label: d, teile: Object.fromEntries(sports.map((s) => [s, Math.round((nachWoche[montag(d)]?.[s]?.km ?? 0) * 10) / 10])) }));
  const imZeitraum = liste.filter((a) => a.datum >= von);
  const summe = (s) => imZeitraum.filter((a) => sportVon(a.art) === s).reduce((z, a) => ({ km: z.km + (a.distanz_m ?? 0) / 1000, s: z.s + (a.dauer_s ?? 0), hm: z.hm + (a.hoehe_m ?? 0), n: z.n + 1 }), { km: 0, s: 0, hm: 0, n: 0 });
  // Form: Tageslasten über den Zeitraum, je Woche der Stand am Sonntag
  const f = formFuer(trainings, alle, von);
  const nachTag = new Map(f.map((t) => [t.datum, t]));
  const amEnde = (d) => nachTag.get(d < montag(HEUTE) ? new Date(Date.parse(`${montag(d)}T00:00:00Z`) + 6 * 864e5).toISOString().slice(0, 10) : HEUTE);
  const heute = f.at(-1);
  if (!liste.length) return html`<section class="card pad stack"><span class="viz-t">${deEn('Ausdauer', 'Cardio')}</span>
    <p class="muted" style="margin:0;font-size:14px">${deEn('Noch keine Läufe oder Radfahrten. Auf „Heute“ oder im Verlauf eintragen – oder Strava verbinden (Einstellungen → Konto).', 'No runs or rides yet. Log them on “Today” or in History – or connect Strava (Settings → Account).')}</p></section>`;
  return html`<div class="stack" style="gap:12px">
    <div class="au-gesamt">${sports.map((s) => { const z = summe(s); return html`<div key=${s} class=${`au-sport ${s}`}><span class="au-sym" aria-hidden="true">${s === 'lauf' ? '🏃' : '🚴'}</span>
      <div><b>${fmt(z.km, z.km >= 100 ? 0 : 1)}<small> km</small></b><span>${`${z.n}× · ${dauerText(z.s)} · ${fmt(z.hm, 0)} hm`}</span></div></div>`; })}</div>
    <${StapelSaeulen} titel=${deEn('Umfang', 'Volume')} unter=${deEn('Kilometer je Woche', 'Kilometres per week')} daten=${kmSaeulen}
      serien=${sports.map((s) => ({ id: s, name: s === 'lauf' ? deEn('Laufen', 'Running') : deEn('Rad', 'Cycling'), farbe: FARBE[s] }))} einheit="km"/>
    ${heute ? html`<${FormKarte} f=${f} x=${x} amEnde=${amEnde} heute=${heute}/>` : null}
    ${sports.includes('lauf') ? html`<${LaufKarten} liste=${liste} x=${x}/>` : null}
    ${sports.includes('rad') ? html`<${RadKarte} liste=${liste} einst=${einst} setEinst=${setEinst}/>` : null}
    <${ZonenKarte} liste=${imZeitraum}/>
    <${GeraeteKarte} liste=${liste} einst=${einst} setEinst=${setEinst}/>
  </div>`;
}

function FormKarte({ f, x, amEnde, heute }) {
  // Stufe relativ zur Fitness (die Lasten sind Minuten × RPE, keine TSS – feste Schwellen passten nicht)
  const anteil = heute.frische / Math.max(1, heute.fitness);
  const stufe = anteil > 0.05 ? [deEn('frisch', 'fresh'), 'gut'] : anteil >= -0.1 ? [deEn('im Training', 'training'), 'mittel'] : anteil >= -0.3 ? [deEn('müde', 'tired'), 'warn'] : [deEn('sehr müde', 'very tired'), 'schlecht'];
  const werte = (k) => x.map((d) => amEnde(d)?.[k] ?? null);
  return html`<section class="card pad stack au-form">
    <div class="row between"><div><span class="viz-t">${deEn('Form', 'Form')}</span><div class="viz-u">${deEn('Kraft und Ausdauer zusammen: Fitness (6 Wochen), Ermüdung (1 Woche), Frische = Differenz', 'Strength and cardio together: fitness (6 weeks), fatigue (1 week), freshness = difference')}</div></div>
      <div class=${`au-frische ${stufe[1]}`}><b>${heute.frische > 0 ? '+' : ''}${heute.frische}</b><span>${stufe[0]}</span></div></div>
    <${LinienChart} ohneRahmen=${true} x=${x} einheit="" stellen=${0} hoehe=${170} serien=${[
      { id: 'fit', name: deEn('Fitness', 'Fitness'), farbe: '#3B82F6', werte: werte('fitness') },
      { id: 'erm', name: deEn('Ermüdung', 'Fatigue'), farbe: '#F43F5E', werte: werte('ermuedung') },
      { id: 'fri', name: deEn('Frische', 'Freshness'), farbe: '#22C55E', werte: werte('frische') }]}/>
  </section>`;
}

function LaufKarten({ liste, x }) {
  const b = bestzeiten(liste);
  const laeufe = liste.filter((a) => sportVon(a.art) === 'lauf' && a.art !== 'laufband');
  const paceWoche = x.map((d) => { const l = laeufe.filter((a) => montag(a.datum) === montag(d) && paceSek(a)); const km = l.reduce((s, a) => s + a.distanz_m, 0);
    return km ? Math.round((l.reduce((s, a) => s + a.dauer_s, 0) / (km / 1000) / 60) * 100) / 100 : null; });
  return html`
    ${b.length ? html`<section class="card pad stack"><span class="viz-t">${deEn('Bestzeiten Laufen', 'Running PBs')}</span>
      <div class="au-best">${b.map((z) => html`<div key=${z.m}><small>${z.name}</small><b>${dauerText(z.s)}</b><span>${`${dauerText(z.s / (z.m / 1000))} /km · ${datumKurz(z.datum)}`}</span></div>`)}</div></section>` : null}
    <${LinienChart} titel=${deEn('Pace', 'Pace')} unter=${deEn('Ø Minuten je km und Woche – weniger ist schneller', 'Avg minutes per km per week – lower is faster')} x=${x}
      serien=${[{ id: 'pace', name: 'Pace', farbe: FARBE.lauf, werte: paceWoche }]} einheit="/km" format=${(v) => dauerText(v * 60)} hoehe=${170}/>`;
}

function RadKarte({ liste, einst, setEinst }) {
  const k = leistungskurve(liste), s = ftpSchaetzung(liste, HEUTE), kg = einst.koerpergewicht;
  const [ftpText, setFtpText] = useState(einst.ftp ? String(einst.ftp) : '');
  const ftp = einst.ftp ?? s?.ftp ?? null, max = Math.max(1, ...k.map((z) => z.w));
  if (!k.length && !ftp) return html`<section class="card pad stack"><span class="viz-t">${deEn('Leistung', 'Power')}</span>
    <p class="muted" style="margin:0;font-size:13.5px">${deEn('Leistungskurve und FTP kommen aus Fahrten mit Wattmesser (Strava oder FIT-Datei).', 'Power curve and FTP come from rides with a power meter (Strava or FIT file).')}</p></section>`;
  return html`<section class="card pad stack">
    <div class="row between"><div><span class="viz-t">${deEn('Leistung', 'Power')}</span><div class="viz-u">${deEn('Beste Watt je Dauer, alle Fahrten', 'Best watts per duration, all rides')}</div></div>
      ${ftp ? html`<div class="au-ftp"><small>FTP</small><b>${ftp} W</b>${kg ? html`<span>${fmt(ftp / kg, 2)} W/kg</span>` : null}</div>` : null}</div>
    <div class="au-kurve">${k.map((z) => html`<div key=${z.s} class="au-kurve-zeile"><span>${z.name}</span><i style=${`width:${Math.round((z.w / max) * 100)}%`}></i>
      <b>${z.w} W</b><small>${kg ? `${fmt(z.w / kg, 1)} W/kg` : ''}${z.echt ? '' : ' ≈'}</small></div>`)}</div>
    <label class="field au-ftp-feld"><span class="label">${deEn('Eigene FTP (leer = Schätzung)', 'Own FTP (empty = estimate)')}</span>
      <input class="text" inputmode="numeric" placeholder=${s ? String(s.ftp) : '250'} value=${ftpText} onInput=${(e) => setFtpText(e.currentTarget.value)}
        onBlur=${() => { const v = Number(ftpText); setEinst?.({ ...einst, ftp: v > 50 && v < 700 ? Math.round(v) : null }); }}/></label>
    ${s && !einst.ftp ? html`<span class="muted" style="font-size:12px">${deEn(`Schätzung: 95 % der besten 20 Minuten (${s.aus.w} W am ${datumKurz(s.aus.datum)}).`, `Estimate: 95 % of best 20 minutes (${s.aus.w} W on ${datumKurz(s.aus.datum)}).`)}</span>` : null}
  </section>`;
}

function ZonenKarte({ liste }) {
  const z = [0, 0, 0, 0, 0];
  for (const a of liste) (a.details?.zonen ?? []).forEach((x, i) => { if (i < 5) z[i] += x.s ?? 0; });
  const summe = z.reduce((a, b) => a + b, 0);
  if (!summe) return null;
  return html`<section class="card pad stack"><div><span class="viz-t">${deEn('Zeit in Zonen', 'Time in zones')}</span><div class="viz-u">${deEn('Pulszonen im Zeitraum (aus Strava bzw. Datei)', 'Heart-rate zones in period (from Strava or file)')}</div></div>
    <div class="au-zonenleiste">${z.map((s, i) => (s ? html`<i key=${i} style=${`flex:${s};background:${ZONE[i]}`}></i>` : null))}</div>
    <div class="au-zonen">${z.map((s, i) => html`<div key=${i} class="au-zone"><span>${`Z${i + 1}`}</span><i style=${`width:${Math.round((s / Math.max(...z)) * 100)}%;background:${ZONE[i]}`}></i>
      <small>${`${fmt((s / summe) * 100, 0)} %`}</small></div>`)}</div></section>`;
}

/** 227: Kilometer je Schuh bzw. Rad, mit eigener Grenze (Schuhe Standard 700 km). */
function GeraeteKarte({ liste, einst, setEinst }) {
  const g = {};
  for (const a of liste) if (a.geraet) { const k = a.geraet.trim(); g[k] ??= { km: 0, sport: sportVon(a.art), zuletzt: a.datum }; g[k].km += (a.distanz_m ?? 0) / 1000; if (a.datum > g[k].zuletzt) g[k].zuletzt = a.datum; }
  const zeilen = Object.entries(g).sort((a, b) => b[1].zuletzt.localeCompare(a[1].zuletzt));
  if (!zeilen.length) return null;
  const [bearb, setBearb] = useState(null);                        // Name, dessen Grenze gerade geändert wird
  const [wert, setWert] = useState('');
  const grenze = (n, sport) => (einst.geraeteGrenze && n in einst.geraeteGrenze ? einst.geraeteGrenze[n] : sport === 'lauf' ? 700 : null);
  const speichern = (n) => { setEinst?.({ ...einst, geraeteGrenze: { ...(einst.geraeteGrenze ?? {}), [n]: Number(wert) > 0 ? Math.round(Number(wert)) : null } }); setBearb(null); };
  return html`<section class="card pad stack"><span class="viz-t">${deEn('Ausrüstung', 'Gear')}</span>
    ${zeilen.map(([n, z]) => { const gr = grenze(n, z.sport), anteil = gr ? Math.min(1, z.km / gr) : null; return html`<div key=${n} class="au-geraet">
      <button class="au-geraet-kopf" onClick=${() => { setBearb(bearb === n ? null : n); setWert(gr ? String(gr) : ''); }}>
        <span>${z.sport === 'lauf' ? '👟' : '🚲'} <b>${n}</b></span><span class=${anteil >= 1 ? 'au-voll' : 'muted'}>${`${fmt(z.km, 0)}${gr ? ` / ${gr}` : ''} km`}</span></button>
      ${anteil != null ? html`<i class="au-geraet-balken"><i style=${`width:${Math.round(anteil * 100)}%;background:${anteil >= 1 ? '#EF4444' : anteil > 0.85 ? '#F59E0B' : '#22C55E'}`}></i></i>` : null}
      ${bearb === n ? html`<div class="row" style="gap:6px"><input class="text" inputmode="numeric" placeholder=${deEn('Grenze in km (leer = keine)', 'Limit in km (empty = none)')} value=${wert} onInput=${(e) => setWert(e.currentTarget.value)}/>
        <button class="btn btn-chalk btn-sm" onClick=${() => speichern(n)}>${deEn('Speichern', 'Save')}</button></div>` : null}</div>`; })}
    ${zeilen.some(([n, z]) => grenze(n, z.sport) && z.km >= grenze(n, z.sport)) ? html`<div class="hint">${I.warn}<span class="t">${deEn('Grenze erreicht – Zeit für neue Schuhe?', 'Limit reached – time for new shoes?')}</span><span></span></div>` : null}
  </section>`;
}
