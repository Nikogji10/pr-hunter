// PR Hunter · Übungsseite: Steckbrief (Muskeln, Bild, Anleitung), persönliche Anpassung, Rekordtafel, Fortschritt,
// Volumen, Vergleich, alle Einheiten. Dazu das Formular zum Anlegen und Ändern von Übungen mit Duplikatprüfung.
import { html, useState, useEffect, fmt, gw, gwE, einheit, inAnzeige, I, Sheet, LIFT, liftVon, nameVon, katalogName, uebung, anpassung, MUSKEL_DE,
  datumKurz, koerperUebung, mmss, satzKurz, rpeKlein, katalogListe } from './basis.js';
import { DEMO, DIENSTE, trainingsTage, trainingAm, wochen, verlaufUebung, plusTage, LETZTES, kanon, letzterWert, ersterWert, rekordeVon } from './stand.js';
import { FAMILIE, EQUIPMENT, UebungSuche } from './suche.js';
import { LinienChart, StapelSaeulen } from './diagramme.js';
import { vergleichsLinks } from '../js/verweise.js';
import { plateau } from '../js/auswertung.js';
import { e1rm } from '../js/rechnen.js';

const BEREICHE = [['3 Monate', 13], ['6 Monate', 26], ['1 Jahr', 52], ['Alles', 0]];
export const LASTART = {
  barbell: 'Langhantel', dumbbell: 'Kurzhantel', cable: 'Kabel', machine: 'Maschine', kettlebell: 'Kettlebell', band: 'Band',
  bodyweight_plus: 'Körpergewicht + Zusatz', bodyweight_minus: 'Körpergewicht mit Unterstützung', time: 'Zeit', distance: 'Strecke',
};
const BASIS = { '': 'keine', squat: 'Kniebeuge', bench: 'Bankdrücken', deadlift: 'Kreuzheben', ohp: 'Überkopfdrücken' };

// #################################################################
// Übungsseite
// #################################################################
export function UebungsSeite({ schluessel, zurueck, zurueckText }) {
  const [bereich, setBereich] = useState(26);
  const [sheet, setSheet] = useState(null);                  // 'anpassen' | 'aendern' | 'zusammen'
  const [details, setDetails] = useState(null);
  const [mitVarianten, setMitVarianten] = useState(false);
  const [ziel, setZiel] = useState(null);                    // Zusammenführen: gewählte Zielübung
  const [laeuft, setLaeuft] = useState(false);
  const [, neuZeichnen] = useState(0);
  const key = kanon(schluessel), lift = liftVon(key), farbe = LIFT[lift].farbe, e = uebung(schluessel) ?? uebung(key);
  const a = anpassung(schluessel) ?? anpassung(key) ?? {};
  useEffect(() => {
    let aktiv = true;
    DIENSTE.ladeUebungDetails?.(schluessel).then((d) => aktiv && setDetails(d)).catch(() => {});
    return () => { aktiv = false; };
  }, [schluessel]);
  const n = bereich || wochen.length;
  // Varianten (gleiche Grundübung, z. B. Pause-Kniebeuge → Kniebeuge): je Woche das beste e1RM aller Varianten
  const varianten = e?.b ? katalogListe().filter((v) => v.b === e.b && v.k !== e.k && kanon(v.k) !== key && verlaufUebung(v.k)?.some((x) => x != null)).map((v) => v.k) : [];
  const voll = mitVarianten && varianten.length
    ? verlaufUebung(schluessel)?.map((v, i) => { const alle = [v, ...varianten.map((k) => verlaufUebung(k)[i])].filter((x) => x != null); return alle.length ? Math.max(...alle) : null; })
    : verlaufUebung(schluessel);
  const x = wochen.slice(-n), reihe = voll?.slice(-n);
  const w = reihe?.some((v) => v != null) ? reihe : null;
  const jetzt = letzterWert(w);
  const einheiten = Object.keys(trainingsTage).filter((d) => d >= x[0]).sort().reverse()
    .map((d) => [d, trainingAm(d)?.uebungen.find((u) => u.key === key)]).filter(([, u]) => u);
  const volumen = x.map((wo, i) => {
    const bis = x[i + 1] ?? plusTage(wo, 7);
    return { label: wo, teile: { v: einheiten.filter(([d]) => d >= wo && d < bis).reduce((s, [, u]) => s + u.saetze.reduce((b, z) => b + (z.kg ?? 0) * (z.wdh ?? 0), 0), 0) } };
  });
  const p = w ? plateau(w) : null;
  const links = vergleichsLinks(schluessel);
  const rek = rekordeVon(schluessel);
  const favorit = async () => {
    if (!DIENSTE.speichereAnpassung) return;
    await DIENSTE.speichereAnpassung(schluessel, { ...a, favorit: !a.favorit });
    neuZeichnen((z) => z + 1);
  };
  const muskeln = (liste) => liste?.length ? liste.map((m) => MUSKEL_DE[m] ?? m).join(', ') : '–';
  return html`<div class="screen">
    <header class="topbar">
      <button class="iconbtn" onClick=${zurueck} aria-label=${zurueckText}>${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">${FAMILIE[e?.f] ?? 'Übung'}${DEMO ? ' · Beispieldaten' : ''}</div><h1 class="h1" style="font-size:24px">${nameVon(schluessel)}</h1></div>
      ${DIENSTE.speichereAnpassung ? html`<button class=${`iconbtn ${a.favorit ? 'fav' : ''}`} onClick=${favorit} aria-pressed=${String(!!a.favorit)}
        aria-label=${a.favorit ? 'Aus den Favoriten nehmen' : 'Zu den Favoriten'}>${a.favorit ? '★' : '☆'}</button>` : null}
    </header>
    ${zurueckText === 'Zurück zum Training' ? html`<button class="btn btn-soft btn-block" onClick=${zurueck}>${I.zurueck} Zurück zum Training</button>` : null}

    <section class="card pad stack">
      ${details?.bilder?.length ? html`<div class="bilder">${details.bilder.slice(0, 2).map((b, i) => html`<img key=${i} src=${b} alt=${`${nameVon(schluessel)}, Bild ${i + 1}`} loading="lazy"
        onError=${(ev) => { ev.currentTarget.style.display = 'none'; }}/>`)}</div>` : null}
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
        <ol class="anleitung">${details.anleitung.map((s, i) => html`<li key=${i}>${s}</li>`)}</ol></details>` : null}
      <div class="row wrap">
        ${DIENSTE.speichereAnpassung ? html`<button class="btn btn-soft btn-sm" onClick=${() => setSheet('anpassen')}>Für mich anpassen</button>` : null}
        ${e && DIENSTE.uebungAendern && DIENSTE.darfAendern(e) ? html`<button class="btn btn-soft btn-sm" onClick=${() => setSheet('aendern')}>Basisdaten ändern</button>` : null}
        ${e && DIENSTE.zusammenfuehren && DIENSTE.darfAendern(e) ? html`<button class="btn btn-soft btn-sm" onClick=${() => { setZiel(null); setSheet('zusammen'); }}>Zusammenführen …</button>` : null}
      </div>
    </section>

    <div class="filter" role="group" aria-label="Zeitraum">${BEREICHE.map(([t, b]) => html`<button key=${b} class="chip" aria-pressed=${String(bereich === b)} onClick=${() => setBereich(b)}>${t}</button>`)}
      ${varianten.length ? html`<button class="chip" aria-pressed=${String(mitVarianten)} onClick=${() => setMitVarianten(!mitVarianten)}
        title=${varianten.map((k) => nameVon(k)).join(', ')}>${mitVarianten ? '✓ ' : ''}mit ${varianten.length} ${varianten.length === 1 ? 'Variante' : 'Varianten'}</button>` : null}</div>
    ${w ? html`
      <div class="kacheln">
        <div class="kachel"><span class="l">e1RM zuletzt${koerperUebung(key) ? ' (ges.)' : ''}</span><b>${gw(jetzt, 1)}</b></div>
        <div class="kachel"><span class="l">Im Zeitraum</span><b>${jetzt >= ersterWert(w) ? '+' : ''}${gw(jetzt - ersterWert(w), 1)}</b><span class="muted" style="font-size:12px">${einheit()} e1RM</span></div>
        <div class="kachel"><span class="l">Einheiten</span><b>${einheiten.length}</b><span class="muted" style="font-size:12px">${LETZTES[key] ? `zuletzt ${LETZTES[key][1]}` : ''}</span></div>
      </div>
      ${p?.plateau ? html`<section class="hint">${I.warn}<span class="t">Seit ${p.wochenOhneRekord} Trainingswochen kein neues e1RM</span><span></span>
        <p>Bestwert im Zeitraum ${gwE(p.best, 1)}, seitdem keine Woche mehr als 0,5 % darüber. Typische Hebel: Wiederholungsbereich wechseln, eine Variante (Pause, Pins) einbauen oder eine Deload-Woche.</p></section>` : null}
      <${LinienChart} titel="Geschätztes 1RM" unter="Bester Satz je Woche" x=${x} serien=${[{ id: lift, name: nameVon(schluessel), farbe, werte: w.map(inAnzeige) }]} hoehe=${200} einheit=${einheit()}/>
      ${volumen.some((v) => v.teile.v > 0) ? html`<${StapelSaeulen} titel="Volumen" unter="Bewegte kg je Woche" daten=${volumen} serien=${[{ id: 'v', name: 'Volumen', farbe }]}/>` : null}`
      : html`<section class="card pad"><p class="muted" style="margin:0">${verlaufUebung(schluessel) ? 'Im gewählten Zeitraum kein Satz mit e1RM.' : 'Für diese Übung gibt es noch keinen Verlauf.'}</p></section>`}

    ${rek.wdh.some(Boolean) ? html`<section class="card pad">
      <div class="row between" style="margin-bottom:8px"><span class="viz-t">Rekordtafel</span>
        ${rek.e1rm ? html`<span class="muted" style="font-size:12.5px">bestes e1RM <b style="color:var(--ink)">${gwE(rek.e1rm.wert, 1)}</b> · ${datumKurz(rek.e1rm.datum)}</span>` : null}</div>
      <table class="rec"><thead><tr><th>Wdh</th><th>Gewicht</th><th>Datum</th><th>e1RM</th></tr></thead>
        <tbody>${rek.wdh.map((r, i) => r ? html`<tr key=${i}><td>${i + 1}</td><td class="k">${gwE(r[0])}</td><td class="muted">${datumKurz(r[1])}</td><td>${gw(e1rm(r[0], i + 1), 1)}</td></tr>`
          : html`<tr key=${i}><td>${i + 1}</td><td class="k muted">–</td><td></td><td></td></tr>`)}</tbody></table>
      ${koerperUebung(key) ? html`<p class="muted" style="margin:8px 0 0;font-size:12.5px">Gewichte = Zusatzgewicht; das e1RM oben rechnet mit der Gesamtlast.</p>` : null}
    </section>` : null}

    ${links.length ? html`<section class="card pad stack">
      <span class="viz-t">Mit anderen vergleichen</span>
      <p class="muted" style="margin:0;font-size:13.5px">Dein bestes e1RM eintragen und sehen, wo du im Vergleich stehst. PR Hunter übernimmt keine Daten von dort.</p>
      <div class="row wrap">${links.map((l) => html`<a key=${l.name} class="btn btn-soft btn-sm" href=${l.url} target="_blank" rel="noopener">${l.name} ${I.extern}</a>`)}</div>
    </section>` : null}
    <section class="card pad stack">
      <div class="row between"><span class="viz-t">Einheiten</span><span class="muted" style="font-size:12.5px">${einheiten.length} im Zeitraum</span></div>
      ${einheiten.length ? einheiten.slice(0, 20).map(([d, u]) => html`<div key=${d} class="row" style="align-items:flex-start">
        <div class="datum-box" style="width:50px;flex:none"><b>${d.slice(8, 10)}</b><span>${datumKurz(d).slice(3)}</span></div>
        <div class="satzchips">${u.saetze.map((s, i) => html`<span key=${i}>${satzKurz(s)}${rpeKlein(s)}</span>`)}</div></div>`)
      : html`<p class="muted" style="margin:0">Keine Einheiten in diesem Zeitraum.</p>`}
    </section>
    ${sheet === 'anpassen' ? html`<${AnpassenSheet} schluessel=${schluessel} zu=${() => { setSheet(null); neuZeichnen((z) => z + 1); }}/>` : null}
    ${sheet === 'aendern' && e ? html`<${UebungFormular} modus="aendern" eintrag=${e} zu=${() => setSheet(null)} fertig=${() => { setSheet(null); neuZeichnen((z) => z + 1); }}/>` : null}
    ${sheet === 'zusammen' && e ? html`<${Sheet} zu=${() => !laeuft && setSheet(null)} label="Zusammenführen">
      <h2 class="h2">Zusammenführen</h2>
      ${!ziel ? html`<p class="muted" style="margin:0;font-size:14px">In welcher Übung soll „${nameVon(schluessel)}“ aufgehen?</p>
        <${UebungSuche} id="zusammen-ziel" autofokus=${true} familien=${[e.f]} onWahl=${(k) => k !== e.k && setZiel(k)}/>`
      : html`<p style="margin:0">„${nameVon(schluessel)}“ geht in <b>„${nameVon(ziel)}“</b> auf.</p>
        <ul style="margin:0;padding-left:18px;font-size:14px"><li>Alle Sätze aller Nutzer, Maxe, Anpassungen und Programme zeigen danach auf „${nameVon(ziel)}“.</li>
          <li>Der alte Name wird Suchbegriff (auch für den Jefit-Import).</li><li>Lässt sich nicht rückgängig machen.</li></ul>
        <div class="row"><button class="btn btn-soft" style="flex:1" disabled=${laeuft} onClick=${() => setZiel(null)}>Andere wählen</button>
          <button class="btn btn-chalk" style="flex:1" disabled=${laeuft} onClick=${async () => {
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
    ${aehnlich ? html`<section class="hint" aria-live="polite">${I.warn}<span class="t">Ähnliche Übungen gibt es schon</span><span></span>
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
