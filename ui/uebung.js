// PR Hunter · Übungsseite wie bei Jefit in Reitern: Verlauf (jede Einheit als Satztabelle), Chart (e1RM oder Volumen
// je Einheit, Zeitraum, Ziellinie, Min/Max, Zielprognose), Rekorde (bestes Gewicht je Wdh-Zahl), Info (Steckbrief, Bild,
// Anleitung, persönliche Anpassung, Basisdaten, Zusammenführen). Dazu das Formular zum Anlegen und Ändern von Übungen.
import { html, useState, useEffect, fmt, gw, gwE, einheit, inAnzeige, I, Sheet, LIFT, liftVon, nameVon, katalogName, uebung, anpassung, MUSKEL_DE,
  datumKurz, datumLang, koerperUebung, mmss, katalogListe, ZahlFeld, UebungsBild, bilderVon, zeigeBild } from './basis.js';
import { DEMO, DIENSTE, HEUTE, trainingsTage, trainingAm, wochen, verlaufUebung, plusTage, kanon, rekordeVon } from './stand.js';
import { FAMILIE, EQUIPMENT, UebungSuche } from './suche.js';
import { LinienChart } from './diagramme.js';
import { vergleichsLinks } from '../js/verweise.js';
import { plateau, zielprognose } from '../js/auswertung.js';
import { e1rm } from '../js/rechnen.js';
import { tageZwischen } from '../js/daten.js';

export const LASTART = {
  barbell: 'Langhantel', dumbbell: 'Kurzhantel', cable: 'Kabel', machine: 'Maschine', kettlebell: 'Kettlebell', band: 'Band',
  bodyweight_plus: 'Körpergewicht + Zusatz', bodyweight_minus: 'Körpergewicht mit Unterstützung', time: 'Zeit', distance: 'Strecke',
};
const BASIS = { '': 'keine', squat: 'Kniebeuge', bench: 'Bankdrücken', deadlift: 'Kreuzheben', ohp: 'Überkopfdrücken' };
const ZEITRAEUME = [['14T', 14], ['1M', 31], ['3M', 92], ['6M', 183], ['12M', 366], ['Alles', 0]];
const REITER = [['verlauf', 'Verlauf'], ['chart', 'Chart'], ['rekorde', 'Rekorde'], ['info', 'Info']];
const MONATE_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const datumMitJahr = (iso) => `${datumLang(iso)} ${iso.slice(0, 4)}`;
const monatJahr = (iso) => `${MONATE_LANG[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** Alle Einheiten einer Übung (neueste zuerst): Arbeitssätze, Aufwärmsätze, bestes e1RM, Volumen. */
export function einheitenVon(key) {
  return Object.keys(trainingsTage).sort().reverse().map((d) => {
    const eintraege = trainingAm(d)?.uebungen.filter((u) => u.key === key) ?? [];
    if (!eintraege.length) return null;
    const saetze = eintraege.flatMap((u) => u.saetze), aufwaermen = eintraege.flatMap((u) => u.aufwaermen ?? []);
    const best = saetze.reduce((m, x) => (x.e1rm != null && (m == null || x.e1rm > m) ? x.e1rm : m), null);
    return { datum: d, saetze, aufwaermen, best, volumen: saetze.reduce((a, x) => a + (x.kg ?? 0) * (x.wdh ?? 0), 0), notiz: eintraege.find((u) => u.notiz)?.notiz ?? null };
  }).filter(Boolean);
}

// #################################################################
// Übungsseite
// #################################################################
export function UebungsSeite({ schluessel, zurueck, zurueckText, einst = {}, setEinst = null, reiterStart = 'verlauf', bloecke = [] }) {
  const [reiter, setReiter] = useState(reiterStart);
  const [zeitraum, setZeitraum] = useState(0);              // Standard: Alles
  const [art, setArt] = useState('e1rm');                   // 'e1rm' | 'volumen'
  const [mehr, setMehr] = useState(15);
  const [sheet, setSheet] = useState(null);                  // 'anpassen' | 'aendern' | 'zusammen' | 'ziel'
  const [details, setDetails] = useState(null);
  const [mitVarianten, setMitVarianten] = useState(false);
  const [nurSpitzen, setNurSpitzen] = useState(true);       // Standard: Bestwert je Block
  const [gewaehlt, setGewaehlt] = useState(null);           // im Chart angetippter Tag
  const [ziel, setZiel] = useState(null);                    // Zusammenführen: gewählte Zielübung
  const [zielKg, setZielKg] = useState(null);                // Ziel-1RM im Sheet
  const [laeuft, setLaeuft] = useState(false);
  const [, neuZeichnen] = useState(0);
  const key = kanon(schluessel), lift = liftVon(key), farbe = lift === 'andere' ? 'var(--acc)' : LIFT[lift].farbe, e = uebung(schluessel) ?? uebung(key);
  const a = anpassung(schluessel) ?? anpassung(key) ?? {};
  const zielWert = einst.ziele?.[key] ?? null;
  useEffect(() => {
    let aktiv = true;
    DIENSTE.ladeUebungDetails?.(schluessel).then((d) => aktiv && setDetails(d)).catch(() => {});
    return () => { aktiv = false; };
  }, [schluessel]);
  // Varianten (gleiche Grundübung, z. B. Pause-Kniebeuge → Kniebeuge) für den e1RM-Chart zuschaltbar
  const varianten = e?.b ? katalogListe().filter((v) => v.b === e.b && v.k !== e.k && kanon(v.k) !== key && verlaufUebung(v.k)?.some((x) => x != null)).map((v) => v.k) : [];
  const einheiten = einheitenVon(key);
  const mitV = mitVarianten && varianten.length ? [...einheiten, ...varianten.flatMap((k) => einheitenVon(kanon(k)))] : einheiten;
  // Chart: eine Spalte je Trainingstag (bei Varianten der beste Wert des Tages), aufsteigend
  const jeTag = new Map();
  for (const x of mitV) {
    const w = art === 'e1rm' ? x.best : x.volumen;
    if (w == null || !(w > 0)) continue;
    jeTag.set(x.datum, Math.max(jeTag.get(x.datum) ?? 0, w));
  }
  const ab = zeitraum ? plusTage(HEUTE, -zeitraum) : '';
  let punkte = [...jeTag.entries()].filter(([d]) => d >= ab).sort((p, q) => p[0].localeCompare(q[0]));
  // Nur Bestwert je Block: leichte Wochen (Deload, Technik) erscheinen nicht als Kraftverlust. Block = program_run,
  // Trainings ohne Block (z. B. aus Jefit) in 6-Wochen-Abschnitten wie ein Candito-Block
  if (nurSpitzen) {
    const blockVon = (d) => bloecke.find((b) => d >= b.von && d <= b.bis)?.id ?? `abschnitt-${Math.floor(tageZwischen('2020-01-06', d) / 42)}`;
    const best = new Map();
    for (const q of punkte) { const b = blockVon(q[0]); if (!best.has(b) || q[1] > best.get(b)[1]) best.set(b, q); }
    punkte = [...best.values()].sort((p, q) => p[0].localeCompare(q[0]));
  }
  const minP = punkte.reduce((m, p) => (!m || p[1] < m[1] ? p : m), null), maxP = punkte.reduce((m, p) => (!m || p[1] > m[1] ? p : m), null);
  // Zielprognose aus dem Wochen-e1RM (gleiche Rechnung wie in der Statistik)
  const reihe = verlaufUebung(schluessel);
  const prognose = zielWert && reihe ? zielprognose(wochen, reihe, zielWert) : null;
  const p = reihe ? plateau(reihe.slice(-26)) : null;
  const links = vergleichsLinks(schluessel);
  const rek = rekordeVon(schluessel);
  const favorit = async () => {
    if (!DIENSTE.speichereAnpassung) return;
    await DIENSTE.speichereAnpassung(schluessel, { ...a, favorit: !a.favorit });
    neuZeichnen((z) => z + 1);
  };
  // je Muskel ein eigener Textknoten, damit die englische Oberfläche jeden Namen übersetzt
  const muskeln = (liste) => liste?.length ? liste.map((m, i) => html`<span key=${m}>${i ? ', ' : ''}<span>${MUSKEL_DE[m] ?? m}</span></span>`) : '–';
  const satzZeile = (x, nr, beste, mitRpe, k) => html`<tr key=${k} class=${beste ? 'beste' : ''}>
    <td class=${`satz-nr ${nr === 'W' ? 'w' : ''}`}>${nr}</td>
    <td class="k">${x.kg != null && (x.kg > 0 || !koerperUebung(key)) ? `${gw(x.kg)} ${einheit()}` : koerperUebung(key) ? 'Körpergewicht' : '–'} × ${x.wdh ?? '–'}</td>
    ${mitRpe ? html`<td class="muted">${x.rpe != null ? `@${fmt(x.rpe)}` : ''}</td>` : null}
    <td>${x.e1rm != null ? gw(x.e1rm, 0) : '–'}</td></tr>`;
  const einheitKarte = (x, markiert = false) => {
    const beste = x.saetze.reduce((m, y, j) => (y.e1rm != null && (m < 0 || y.e1rm > x.saetze[m].e1rm) ? j : m), -1);
    const mitRpe = [...x.saetze, ...x.aufwaermen].some((y) => y.rpe != null);
    return html`<section key=${x.datum} class=${`card pad einheit ${markiert ? 'markiert' : ''}`}>
      <div class="row between"><b>${datumMitJahr(x.datum)}</b>${x.best != null ? html`<span class="muted" style="font-size:12.5px">e1RM <b style="color:var(--ink)">${gw(x.best, 1)}</b></span>` : null}</div>
      <table class="saetze"><thead><tr><th>Satz</th><th>Gewicht × Wdh</th>${mitRpe ? html`<th>RPE</th>` : null}<th>e1RM</th></tr></thead>
        <tbody>${x.aufwaermen.map((y, j) => satzZeile(y, 'W', false, mitRpe, `w${j}`))}${x.saetze.map((y, j) => satzZeile(y, j + 1, j === beste, mitRpe, `s${j}`))}</tbody></table>
      ${x.notiz ? html`<div class="cue notiz">${x.notiz}</div>` : null}
    </section>`;
  };
  // Unter dem Chart: der angetippte Tag zuerst, dann die Einheiten im Zeitraum (neueste zuerst)
  const imZeitraum = einheiten.filter((x) => x.datum >= ab);
  const unterChart = gewaehlt ? [imZeitraum.find((x) => x.datum === gewaehlt), ...imZeitraum.filter((x) => x.datum !== gewaehlt)].filter(Boolean) : imZeitraum;
  return html`<div class="screen">
    <header class="topbar unter">
      <button class="iconbtn" onClick=${zurueck} aria-label=${zurueckText}>${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow brotkrume"><span>${(zurueckText ?? '').replace(/^Zurück (zum|zur|zu den|zu) /, '') || 'Verlauf'}</span> › ${FAMILIE[e?.f] ?? 'Übung'}${DEMO ? ' · Beispieldaten' : ''}</div><h1 class="h1">${nameVon(schluessel)}</h1></div>
      <${UebungsBild} schluessel=${schluessel} groesse=${56}/>
      ${DIENSTE.speichereAnpassung ? html`<button class=${`iconbtn ${a.favorit ? 'fav' : ''}`} onClick=${favorit} aria-pressed=${String(!!a.favorit)}
        aria-label=${a.favorit ? 'Aus den Favoriten nehmen' : 'Zu den Favoriten'}>${a.favorit ? '★' : '☆'}</button>` : null}
      <div class="uebung-kopf">
        ${setEinst ? html`<button class="chip" onClick=${() => { setZielKg(zielWert); setSheet('ziel'); }}>${zielWert ? `Ziel: ${gwE(zielWert)}` : 'Ziel setzen'}</button>` : null}
        ${rek.e1rm ? html`<span class="muted" style="font-size:12.5px">bestes e1RM <b style="color:var(--ink)">${gwE(rek.e1rm.wert, 1)}</b></span>` : null}
      </div>
      <nav class="reiter" role="tablist" aria-label="Ansicht">${REITER.map(([k, t]) => html`<button key=${k} role="tab" aria-selected=${String(reiter === k)} onClick=${() => setReiter(k)}>${t}</button>`)}</nav>
    </header>
    ${zurueckText === 'Zurück zum Training' ? html`<button class="btn btn-soft btn-sm" onClick=${zurueck}>${I.zurueck} Zurück zum Training</button>` : null}

    ${reiter === 'verlauf' ? html`
      ${!einheiten.length ? html`<section class="card pad"><p class="muted" style="margin:0">Für diese Übung gibt es noch keine Einheiten.</p></section>` : null}
      ${einheiten.slice(0, mehr).map((x) => einheitKarte(x))}
      ${einheiten.length > mehr ? html`<button class="btn btn-soft btn-sm" onClick=${() => setMehr(mehr + 20)}>Ältere Einheiten (${einheiten.length - mehr})</button>` : null}`
    : reiter === 'chart' ? html`
      <section class="card pad stack">
        <div class="seg" role="group" aria-label="Zeitraum">${ZEITRAEUME.map(([t, z]) => html`<button key=${t} aria-pressed=${String(zeitraum === z)} onClick=${() => setZeitraum(z)}>${t}</button>`)}</div>
        <div class="row wrap" style="gap:6px">
          <button class="chip" aria-pressed=${String(art === 'e1rm')} onClick=${() => setArt('e1rm')}>1RM (geschätzt)</button>
          <button class="chip" aria-pressed=${String(art === 'volumen')} onClick=${() => setArt('volumen')}>Volumen</button>
          <button class="chip" aria-pressed=${String(nurSpitzen)} onClick=${() => setNurSpitzen(!nurSpitzen)}
            title="Je Block nur die beste Einheit – leichte Wochen verfälschen den Verlauf nicht">${nurSpitzen ? '✓ ' : ''}Bestwert je Block</button>
          ${varianten.length ? html`<button class="chip" aria-pressed=${String(mitVarianten)} onClick=${() => setMitVarianten(!mitVarianten)}
            title=${varianten.map((k) => nameVon(k)).join(', ')}>${`${mitVarianten ? '✓ ' : ''}mit ${varianten.length} ${varianten.length === 1 ? 'Variante' : 'Varianten'}`}</button>` : null}
        </div>
        ${punkte.length ? html`<span class="muted" style="font-size:12.5px">${datumKurz(punkte[0][0])}${punkte[0][0].slice(0, 4)} – ${datumKurz(punkte.at(-1)[0])}${punkte.at(-1)[0].slice(0, 4)} · ${punkte.length} ${nurSpitzen ? 'Blöcke (Bestwert je Block, ohne Block je 6 Wochen)' : 'Einheiten'}</span>` : null}
        ${punkte.length > 1 ? html`<${LinienChart} ohneRahmen=${true} titel=${art === 'e1rm' ? 'Geschätztes 1RM' : 'Volumen'} x=${punkte.map((q) => q[0])} zeitlich=${true} punkte=${true}
          serien=${[{ id: 'w', name: art === 'e1rm' ? 'e1RM' : 'Volumen', farbe, werte: punkte.map((q) => inAnzeige(q[1])) }]} hoehe=${230}
          einheit=${einheit()} stellen=${art === 'e1rm' ? 1 : 0} tipKopf=${datumMitJahr} beiTipp=${(k) => setGewaehlt(punkte[k]?.[0] ?? null)}
          referenz=${art === 'e1rm' && zielWert ? { wert: inAnzeige(zielWert), text: `Ziel ${gw(zielWert)}` } : null}/>`
          : html`<p class="muted" style="margin:0">${punkte.length ? 'Nur eine Einheit im Zeitraum – für einen Verlauf einen längeren Zeitraum wählen.' : 'Im Zeitraum keine Einheit mit Gewicht.'}</p>`}
      </section>
      ${minP ? html`<div class="kacheln zwei">
        <div class="kachel"><span class="l">Min</span><b>${art === 'e1rm' ? gw(minP[1], 1) : gw(minP[1], 0)}<small> ${einheit()}</small></b><span class="muted" style="font-size:12px">${monatJahr(minP[0])}</span></div>
        <div class="kachel"><span class="l">Max</span><b>${art === 'e1rm' ? gw(maxP[1], 1) : gw(maxP[1], 0)}<small> ${einheit()}</small></b><span class="muted" style="font-size:12px">${monatJahr(maxP[0])}</span></div>
      </div>` : null}
      ${prognose ? html`<section class="card pad stack" style="gap:6px"><span class="viz-t">Ziel ${gwE(zielWert)}</span>
        <p style="margin:0;font-size:14px">${prognose.grund === 'erreicht' ? `Schon erreicht – Trendwert ${gwE(prognose.aktuell, 1)}.`
          : prognose.grund === 'keinTrend' ? `Derzeit kein Aufwärtstrend (${fmt(prognose.proWoche, 2)} ${einheit()} je Woche), daher kein Datum.`
          : prognose.grund === 'zuWenig' ? 'Zu wenige Wochen mit dieser Übung für eine Prognose.'
          : html`Voraussichtlich <b>${datumMitJahr(prognose.datum)}</b> (in ${prognose.wochen} Wochen, +${fmt(prognose.proWoche, 2)} ${einheit()} je Woche).`}</p></section>` : null}
      ${p?.plateau ? html`<section class="hint">${I.warn}<span class="t">${`Seit ${p.wochenOhneRekord} Trainingswochen kein neues e1RM`}</span><span></span>
        <p>Bestwert im letzten halben Jahr ${gwE(p.best, 1)}. Typische Hebel: Wiederholungsbereich wechseln, eine Variante (Pause, Pins) einbauen oder eine Deload-Woche.</p></section>` : null}
      ${unterChart.length ? html`<div class="row between" style="margin-top:4px"><span class="viz-t">Verlauf</span>${gewaehlt ? html`<button class="chip" onClick=${() => setGewaehlt(null)}>${datumKurz(gewaehlt)} ✕</button>`
        : html`<span class="muted" style="font-size:12.5px">Punkt antippen zeigt den Tag</span>`}</div>` : null}
      ${unterChart.slice(0, mehr).map((x) => einheitKarte(x, x.datum === gewaehlt))}
      ${unterChart.length > mehr ? html`<button class="btn btn-soft btn-sm" onClick=${() => setMehr(mehr + 20)}>Ältere Einheiten (${unterChart.length - mehr})</button>` : null}`
    : reiter === 'rekorde' ? html`
      ${rek.wdh.some(Boolean) ? html`<section class="card pad">
        <div class="row between" style="margin-bottom:8px"><span class="viz-t">Rekordtafel</span>
          ${rek.e1rm ? html`<span class="muted" style="font-size:12.5px">bestes e1RM <b style="color:var(--ink)">${gwE(rek.e1rm.wert, 1)}</b> · ${datumKurz(rek.e1rm.datum)}${rek.e1rm.datum.slice(0, 4)}</span>` : null}</div>
        <table class="rec"><thead><tr><th>Wdh</th><th>Gewicht</th><th>Datum</th><th>e1RM</th></tr></thead>
          <tbody>${rek.wdh.map((r, i) => r ? html`<tr key=${i}><td>${i + 1}</td><td class="k">${gwE(r[0])}</td><td class="muted">${datumKurz(r[1])}${r[1].slice(2, 4)}</td><td>${gw(e1rm(r[0], i + 1), 1)}</td></tr>`
            : html`<tr key=${i}><td>${i + 1}</td><td class="k muted">–</td><td></td><td></td></tr>`)}</tbody></table>
        ${koerperUebung(key) ? html`<p class="muted" style="margin:8px 0 0;font-size:12.5px">Gewichte = Zusatzgewicht; das e1RM rechnet mit der Gesamtlast.</p>` : null}
      </section>` : html`<section class="card pad"><p class="muted" style="margin:0">Noch keine Rekorde.</p></section>`}
      ${links.length ? html`<section class="card pad stack">
        <span class="viz-t">Mit anderen vergleichen</span>
        <p class="muted" style="margin:0;font-size:13px">Dein bestes e1RM eintragen und sehen, wo du stehst. PR Hunter übernimmt keine Daten von dort.</p>
        <div class="row wrap">${links.map((l) => html`<a key=${l.name} class="btn btn-soft btn-sm" href=${l.url} target="_blank" rel="noopener">${l.name} ${I.extern}</a>`)}</div>
      </section>` : null}`
    : html`
      <section class="card pad stack">
        ${(() => {
          // Bilder aus den Details, sonst aus dem Katalog (Varianten ohne eigenes Foto: Bild der Grundübung); antippen vergrößert
          const bilder = details?.bilder?.length ? details.bilder.slice(0, 2) : bilderVon(schluessel);
          return bilder.length ? html`<div class="bilder">${bilder.map((b, i) => html`<img key=${i} src=${b} alt=${`${nameVon(schluessel)}, Bild ${i + 1}`} loading="lazy" class="zoombar"
            onClick=${() => zeigeBild(bilder, nameVon(schluessel))} onError=${(ev) => { ev.currentTarget.style.display = 'none'; }}/>`)}</div>` : null;
        })()}
        <div class="steckbrief">
          ${a.name ? html`<div><span class="eyebrow">Katalogname</span><b>${katalogName(schluessel)}</b></div>` : null}
          <div><span class="eyebrow">Typ</span><b>${LASTART[e?.lt] ?? '–'}</b></div>
          <div><span class="eyebrow">Equipment</span><b>${EQUIPMENT[e?.eq] ?? e?.eq ?? '–'}</b></div>
          <div><span class="eyebrow">Hauptmuskeln</span><b>${muskeln(e?.m)}</b></div>
          ${(details?.m2 ?? e?.m2)?.length ? html`<div><span class="eyebrow">Nebenmuskeln</span><b>${muskeln(details?.m2 ?? e?.m2)}</b></div>` : null}
        </div>
        ${a.cues || a.rack || a.notiz || a.pause ? html`<div class="notizen">
          ${a.cues ? html`<p><b>Cues</b> ${a.cues}</p>` : null}${a.rack ? html`<p><b>Rack</b> ${a.rack}</p>` : null}
          ${a.pause ? html`<p><b>Pause</b> ${mmss(a.pause)} (eigene)</p>` : null}${a.notiz ? html`<p><b>Notiz</b> ${a.notiz}</p>` : null}</div>` : null}
        ${details?.anleitung?.length ? html`<details><summary class="link" style="cursor:pointer">Anleitung (Englisch, Free Exercise DB)</summary>
          <ol class="anleitung">${details.anleitung.map((t, i) => html`<li key=${i}>${t}</li>`)}</ol></details>` : null}
        <div class="row wrap">
          ${DIENSTE.speichereAnpassung ? html`<button class="btn btn-soft btn-sm" onClick=${() => setSheet('anpassen')}>Für mich anpassen</button>` : null}
          ${e && DIENSTE.uebungAendern && DIENSTE.darfAendern(e) ? html`<button class="btn btn-soft btn-sm" onClick=${() => setSheet('aendern')}>Basisdaten ändern</button>` : null}
          ${e && DIENSTE.zusammenfuehren && DIENSTE.darfAendern(e) ? html`<button class="btn btn-gefahr btn-sm" onClick=${() => { setZiel(null); setSheet('zusammen'); }}>Zusammenführen …</button>` : null}
        </div>
      </section>`}

    ${sheet === 'ziel' ? html`<${Sheet} zu=${() => setSheet(null)} label="Ziel für diese Übung">
      <h2 class="h2">Ziel-1RM</h2>
      <p class="muted" style="margin:0;font-size:13px">Erscheint als Linie im Chart; die App schätzt aus dem Trend, wann du es erreichst.</p>
      <${ZahlFeld} id="u-ziel" label=${`Ziel (${einheit()})`} kg=${true} wert=${zielKg} setze=${setZielKg} platzhalter="–"/>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => { const z = { ...(einst.ziele ?? {}) }; delete z[key]; setEinst({ ...einst, ziele: z }); setSheet(null); }}>Kein Ziel</button>
        <button class="btn btn-chalk" style="flex:1.4" disabled=${!(zielKg > 0)} onClick=${() => { setEinst({ ...einst, ziele: { ...(einst.ziele ?? {}), [key]: zielKg } }); setSheet(null); }}>Speichern</button></div>
    <//>` : null}
    ${sheet === 'anpassen' ? html`<${AnpassenSheet} schluessel=${schluessel} zu=${() => { setSheet(null); neuZeichnen((z) => z + 1); }}/>` : null}
    ${sheet === 'aendern' && e ? html`<${UebungFormular} modus="aendern" eintrag=${e} zu=${() => setSheet(null)} fertig=${() => { setSheet(null); neuZeichnen((z) => z + 1); }}/>` : null}
    ${sheet === 'zusammen' && e ? html`<${Sheet} zu=${() => !laeuft && setSheet(null)} label="Zusammenführen">
      <h2 class="h2">Zusammenführen</h2>
      ${!ziel ? html`<p class="muted" style="margin:0;font-size:14px">In welcher Übung soll „${nameVon(schluessel)}“ aufgehen?</p>
        <${UebungSuche} id="zusammen-ziel" familien=${[e.f]} onWahl=${(k) => k !== e.k && setZiel(k)}/>`
      : html`<p style="margin:0">„${nameVon(schluessel)}“ geht in <b>„${nameVon(ziel)}“</b> auf.</p>
        <ul style="margin:0;padding-left:18px;font-size:14px"><li>Alle Sätze aller Nutzer, Maxe, Anpassungen und Programme zeigen danach auf „${nameVon(ziel)}“.</li>
          <li>Der alte Name wird Suchbegriff (auch für den Jefit-Import).</li><li>Lässt sich nicht rückgängig machen.</li></ul>
        <div class="row"><button class="btn btn-soft" style="flex:1" disabled=${laeuft} onClick=${() => setZiel(null)}>Andere wählen</button>
          <button class="btn btn-gefahr" style="flex:1" disabled=${laeuft} onClick=${async () => {
            setLaeuft(true);
            try { await DIENSTE.zusammenfuehren(e.k, ziel); setSheet(null); zurueck(); }
            catch (x) { DIENSTE.meldung?.({ titel: 'Nicht zusammengeführt', text: x.message }); }
            finally { setLaeuft(false); }
          }}>${laeuft ? 'Läuft …' : 'Zusammenführen'}</button></div>`}
    <//>` : null}
  </div>`;
}

// #################################################################
// Persönliche Anpassung (gilt nur für den Nutzer)
// #################################################################
function AnpassenSheet({ schluessel, zu }) {
  const alt = anpassung(schluessel) ?? {};
  const [a, setA] = useState({ name: alt.name ?? '', pause: alt.pause ?? null, cues: alt.cues ?? '', rack: alt.rack ?? '', notiz: alt.notiz ?? '', versteckt: !!alt.versteckt });
  const [fehler, setFehler] = useState(null);
  const pause = (d) => setA((a) => ({ ...a, pause: Math.max(15, Math.min(900, (a.pause ?? 180) + d)) }));
  const speichern = async () => {
    try { await DIENSTE.speichereAnpassung(schluessel, { ...alt, ...a, name: a.name.trim() || null, cues: a.cues.trim() || null, rack: a.rack.trim() || null, notiz: a.notiz.trim() || null }); zu(); }
    catch (x) { setFehler(x.message); }
  };
  return html`<${Sheet} zu=${zu} label="Übung anpassen">
    <div><div class="eyebrow">Nur für dich</div><h2 class="h2">${katalogName(schluessel)}</h2></div>
    <label class="field" for="a-name"><span class="label">Eigener Anzeigename</span>
      <input id="a-name" class="text" type="text" placeholder=${katalogName(schluessel)} value=${a.name} onInput=${(e) => { const v = e.currentTarget.value; setA((a) => ({ ...a, name: v })); }}/></label>
    <div class="pause-zeile" style="border-top:0;padding-top:0"><span>Eigene Pause<br/><span class="muted" style="font-size:12.5px">${a.pause ? 'statt der Standard-Pause' : 'Standard nach Satzart'}</span></span>
      <div class="row" style="gap:8px"><button class="mini" onClick=${() => pause(-15)} aria-label="15 Sekunden weniger">−15</button>
        <b class="zahl tab-num" style="font-size:22px;min-width:52px;text-align:center">${a.pause ? mmss(a.pause) : '–'}</b>
        <button class="mini" onClick=${() => pause(15)} aria-label="15 Sekunden mehr">+15</button>
        ${a.pause ? html`<button class="link" onClick=${() => setA((a) => ({ ...a, pause: null }))}>Standard</button>` : null}</div></div>
    <label class="stack" style="gap:6px" for="a-cues"><span class="eyebrow">Technik-Cues</span>
      <textarea id="a-cues" rows="2" placeholder="z. B. Knie raus, Brust hoch, Luft halten" value=${a.cues} onInput=${(e) => { const v = e.currentTarget.value; setA((a) => ({ ...a, cues: v })); }}></textarea></label>
    <label class="field" for="a-rack"><span class="label">Rack und Safety</span>
      <input id="a-rack" class="text" type="text" placeholder="z. B. Rack 11, Safety 4" value=${a.rack} onInput=${(e) => { const v = e.currentTarget.value; setA((a) => ({ ...a, rack: v })); }}/></label>
    <label class="stack" style="gap:6px" for="a-notiz"><span class="eyebrow">Notiz</span>
      <textarea id="a-notiz" rows="2" value=${a.notiz} onInput=${(e) => { const v = e.currentTarget.value; setA((a) => ({ ...a, notiz: v })); }}></textarea></label>
    <label class="schalter" for="a-weg"><span><b>In der Suche ausblenden</b><br/><span class="muted" style="font-size:13px">Bleibt im Verlauf; über den Filter weiter auffindbar.</span></span>
      <input type="checkbox" id="a-weg" checked=${a.versteckt} onChange=${(e) => { const v = e.currentTarget.checked; setA((a) => ({ ...a, versteckt: v })); }}/></label>
    ${fehler ? html`<p class="fehler" role="alert">${fehler}</p>` : null}
    <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${zu}>Abbrechen</button><button class="btn btn-chalk" style="flex:1.4" onClick=${speichern}>Speichern</button></div>
  <//>`;
}

// #################################################################
// Übung anlegen oder Basisdaten ändern (Duplikatprüfung vor dem Anlegen)
// #################################################################
const formularAus = (e) => ({ de: e?.de ?? '', en: e?.en ?? '', f: e?.f ?? '', eq: e?.eq ?? '', lt: e?.lt ?? '', mechanik: e?.mechanik ?? '',
  m: e?.m ?? [], m2: e?.m2 ?? [], b: e?.b ?? '' });

export function UebungFormular({ modus = 'neu', eintrag = null, start = '', zu, fertig }) {
  const [u, setU] = useState(() => (eintrag ? formularAus(eintrag) : { ...formularAus(null), de: start }));
  const [aehnlich, setAehnlich] = useState(null);         // null = noch nicht geprüft
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState(null);
  const familien = [...new Set(katalogListe().map((e) => e.f))].sort((a, b) => (FAMILIE[a] ?? a).localeCompare(FAMILIE[b] ?? b, 'de'));
  const vollstaendig = u.de.trim() && u.en.trim() && u.f && u.lt;
  const umschalten = (feld, m) => setU((u) => ({ ...u, [feld]: u[feld].includes(m) ? u[feld].filter((x) => x !== m) : [...u[feld], m] }));
  const anlegen = async () => {
    setLaeuft(true); setFehler(null);
    try { fertig(modus === 'neu' ? await DIENSTE.uebungAnlegen(u) : await DIENSTE.uebungAendern(eintrag.id, u)); }
    catch (x) { setFehler(/duplicate|unique/i.test(x.message) ? 'Diesen Namen gibt es schon (deutsch oder englisch).' : x.message); setLaeuft(false); }
  };
  const pruefen = async () => {
    if (modus !== 'neu') return anlegen();
    setLaeuft(true); setFehler(null);
    try {
      const treffer = [...(await DIENSTE.aehnliche(u.de)), ...(await DIENSTE.aehnliche(u.en))];
      const eindeutig = [...new Map(treffer.sort((a, b) => b.score - a.score).map((t) => [t.key, t])).values()].slice(0, 6);
      setLaeuft(false);
      if (eindeutig.length) setAehnlich(eindeutig); else await anlegen();
    } catch (x) { setFehler(x.message); setLaeuft(false); }
  };
  const auswahl = (feld, werte, leer = null) => html`<select class="feld" value=${u[feld]} onChange=${(e) => { const v = e.currentTarget.value; setU((u) => ({ ...u, [feld]: v })); setAehnlich(null); }}>
    ${leer ? html`<option value="">${leer}</option>` : null}${werte.map(([k, t]) => html`<option key=${k} value=${k}>${t}</option>`)}</select>`;
  return html`<${Sheet} zu=${zu} label=${modus === 'neu' ? 'Neue Übung' : 'Übung ändern'}>
    <div><div class="eyebrow">${modus === 'neu' ? 'Für alle Nutzer' : 'Basisdaten · gilt für alle'}</div><h2 class="h2">${modus === 'neu' ? 'Neue Übung' : 'Übung ändern'}</h2></div>
    <label class="field" for="u-de"><span class="label">Name deutsch</span>
      <input id="u-de" class="text" type="text" value=${u.de} onInput=${(e) => { const v = e.currentTarget.value; setU((u) => ({ ...u, de: v })); setAehnlich(null); }}/></label>
    <label class="field" for="u-en"><span class="label">Name englisch</span>
      <input id="u-en" class="text" type="text" value=${u.en} onInput=${(e) => { const v = e.currentTarget.value; setU((u) => ({ ...u, en: v })); setAehnlich(null); }}/></label>
    <div class="filter-zeile">
      <label class="auswahl"><span>Kategorie</span>${auswahl('f', familien.map((f) => [f, FAMILIE[f] ?? f]), 'wählen')}</label>
      <label class="auswahl"><span>Typ</span>${auswahl('lt', Object.entries(LASTART), 'wählen')}</label>
      <label class="auswahl"><span>Equipment</span>${auswahl('eq', [...new Map(Object.entries(EQUIPMENT).map(([k, v]) => [v, k])).entries()].map(([v, k]) => [k, v]), 'ohne Angabe')}</label>
      <label class="auswahl"><span>Variante von</span>${auswahl('b', Object.entries(BASIS))}</label>
    </div>
    <div class="stack" style="gap:6px"><span class="eyebrow">Hauptmuskeln</span>
      <div class="row wrap" style="gap:6px">${Object.entries(MUSKEL_DE).map(([m, t]) => html`<button key=${m} class="chip" aria-pressed=${String(u.m.includes(m))} onClick=${() => umschalten('m', m)}>${t}</button>`)}</div></div>
    <details><summary class="link" style="cursor:pointer">Nebenmuskeln${u.m2.length ? ` (${u.m2.length})` : ''}</summary>
      <div class="row wrap" style="gap:6px;margin-top:8px">${Object.entries(MUSKEL_DE).map(([m, t]) => html`<button key=${m} class="chip" aria-pressed=${String(u.m2.includes(m))} onClick=${() => umschalten('m2', m)}>${t}</button>`)}</div></details>
    ${aehnlich ? html`<section class="hint immer" aria-live="polite">${I.warn}<span class="t">Ähnliche Übungen gibt es schon</span><span></span>
      <div class="stack" style="gap:6px">${aehnlich.map((t) => html`<div key=${t.key} class="row between" style="gap:8px">
        <span style="min-width:0"><b>${t.name_de}</b><br/><span class="muted" style="font-size:12.5px">${t.name_en}${t.matched && t.matched !== t.name_de && t.matched !== t.name_en ? ` · auch „${t.matched}“` : ''}</span></span>
        <button class="btn btn-soft btn-sm" onClick=${() => fertig({ k: t.key })}>Diese nehmen</button></div>`)}</div>
      <span></span><button class="btn btn-chalk btn-sm" style="margin-top:8px;justify-self:start" disabled=${laeuft} onClick=${anlegen}>Trotzdem neu anlegen</button></section>` : null}
    ${fehler ? html`<p class="fehler" role="alert">${fehler}</p>` : null}
    ${!aehnlich ? html`<div class="row"><button class="btn btn-soft" style="flex:1" onClick=${zu}>Abbrechen</button>
      <button class="btn btn-chalk" style="flex:1.4" disabled=${!vollstaendig || laeuft} onClick=${pruefen}>${laeuft ? 'Prüfe …' : modus === 'neu' ? 'Prüfen und anlegen' : 'Speichern'}</button></div>` : null}
    <p class="muted" style="margin:0;font-size:12.5px">${modus === 'neu' ? 'Vor dem Anlegen sucht die App ähnliche Namen in Deutsch, Englisch und den Suchbegriffen. Braucht Netz.' : 'Basisdaten ändern nur der Ersteller und der Admin.'}</p>
  <//>`;
}
