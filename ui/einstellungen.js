// PR Hunter · Einstellungen als Menü mit Unterseiten: Training, Körper, Geräte und Einheit, Anzeige, Konto und Daten.
// Jede Unterseite ist ein eigener Historien-Eintrag (Zurück führt ins Menü).
// Alles gilt für alle Programme; gespeichert im Profil (Supabase), lokal zuerst.
import { html, useState, useEffect, fmt, mmss, I, Sheet, Avatar, inKg, inAnzeige, einheit, datumKurz, TOENE, piep } from './basis.js';
import { DEMO } from './stand.js';
import { moeglich as mitteilungMoeglich, erlaubt as mitteilungErlaubt, erlaubnisHolen } from './mitteilung.js';
import { hintergrund, speichereHintergrund, profilbildAusDatei, setzeAbdunklung, neigungAn, schalteNeigung, neigungStaerke, setzeNeigungStaerke } from './hintergrund.js';
import { Zuschnitt, bildLaden } from './zuschnitt.js';
import { KG_PRO_LB, STANDARD_SCHEIBEN } from '../js/rechnen.js';

const KG_SCHEIBEN = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5, 0.25];
const LB_SCHEIBEN = [55, 45, 35, 25, 10, 5, 2.5, 1.25];
export const LB_STANDARD = [45, 35, 25, 10, 5, 2.5];
const kgVonLb = (lb) => Math.round(lb * KG_PRO_LB * 100) / 100;      // wie in der DB gespeichert (numeric 5,2)
const gleich = (a, b) => Math.abs(a - b) < 0.02;
const ICON_FARBEN = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];   // Symbole im Menü, je Bereich eine Farbe

/** Neue Einheit: Stange, Steigerung und Scheiben auf die üblichen Werte der Einheit setzen. */
export function aufEinheit(e, einheitNeu) {
  if (e.einheit === einheitNeu) return e;
  return einheitNeu === 'lb'
    ? { ...e, einheit: 'lb', inc: 5, stange: kgVonLb(45), scheiben: LB_STANDARD.map(kgVonLb) }
    : { ...e, einheit: 'kg', inc: 2.5, stange: 20, scheiben: [...STANDARD_SCHEIBEN] };
}

function Seg({ werte, wert, setze, label }) {
  return html`<div class="seg" role="group" aria-label=${label}>${werte.map(([k, t]) => html`<button key=${k} aria-pressed=${String(wert === k)} onClick=${() => setze(k)}>${t}</button>`)}</div>`;
}

export const SCHRIFT = [[0.9, 'Klein'], [1, 'Normal'], [1.1, 'Groß'], [1.2, 'Sehr groß']];
// Farbwelten (css/app.css, data-stil): Vorschau mit festen Farben, damit jede so aussieht wie sie ist
export const STIL_WAHL = [
  ['eisen', 'Eisen', 'Dunkelrot, Standard', ['#07070A', '#1B1D24', '#E0182D']],
  ['kobalt', 'Kobalt', 'Blau, klar und ruhig', ['#06080D', '#18202C', '#2F7BF5']],
  ['glut', 'Glut', 'Orange, sportlich', ['#0A0807', '#221A15', '#FF6A13']],
  ['volt', 'Volt', 'Neon auf Schwarz', ['#050605', '#181B16', '#C6F135']],
  ['amethyst', 'Amethyst', 'Violett, modern', ['#08070D', '#1D1A2A', '#8B5CF6']],
  ['graphit', 'Graphit', 'Schwarz-Weiß, schlicht', ['#000000', '#1A1A1A', '#E6E6E6']],
];
export const SCHRIFT_WAHL = [['archivo', 'Archivo', 'Kräftig, Standard', '"Archivo"'], ['saira', 'Saira', 'Technisch, eckig', '"Saira"'],
  ['encode', 'Encode Sans', 'Klar und offen', '"Encode Sans"'], ['system', 'System', 'Schrift des Handys', 'system-ui']];

export function Einstellungen({ einst, setEinst, zurueck, konto: k, sync, offen, abgleich, abmelden: raus, exportieren, neuAnmelden, SyncPunkt, kontoLoeschen, anleitung }) {
  const [loeschen, setLoeschen] = useState(null);         // null | { text, laeuft, fehler }
  const [kgText, setKgText] = useState(einst.koerpergewicht ? String(inAnzeige(einst.koerpergewicht)).replace('.', ',') : '');
  const [zielText, setZielText] = useState(einst.gewichtZiel ? String(inAnzeige(einst.gewichtZiel)).replace('.', ',') : '');
  const [stangeText, setStangeText] = useState(String(inAnzeige(einst.stange)).replace('.', ','));
  const [name, setName] = useState(einst.name ?? '');
  const [bild, setBild] = useState(hintergrund);
  const [bildFehler, setBildFehler] = useState(null);
  const [zuschnitt, setZuschnitt] = useState(null);      // { img, url } während des Zuschneidens
  const bildWaehlen = async (datei) => {
    if (!datei) return;
    setBildFehler(null);
    try { setZuschnitt(await bildLaden(datei)); } catch (e) { setBildFehler(e.message); }
  };
  const zuschnittZu = () => { URL.revokeObjectURL(zuschnitt.url); setZuschnitt(null); };
  const bildUebernehmen = (url) => {
    zuschnittZu();
    if (!speichereHintergrund(url, einst.hintergrundDunkel ?? bild.dunkel)) { setBildFehler('Das Bild ist zu groß für den Speicher dieses Browsers.'); return; }
    setBild({ ...bild, bild: url });
    abgleich?.();
  };
  // Regler: beim Ziehen sofort zeigen, beim Loslassen speichern (sonst ein Abgleich je Pixel)
  const [deck, setDeck] = useState(Math.round((einst.deckkraft ?? 0.88) * 100));
  const [neigung, setNeigung] = useState(neigungAn);
  const [staerke, setStaerke] = useState(neigungStaerke);
  const [sicht, setSicht] = useState(Math.round((1 - (einst.hintergrundDunkel ?? bild.dunkel)) * 100));
  const aendere = (art, d) => setEinst({ ...einst, pausen: { ...einst.pausen, [art]: Math.max(15, Math.min(900, einst.pausen[art] + d)) } });
  const zahl = (t) => { const n = Number(String(t).replace(',', '.')); return t.trim() && Number.isFinite(n) ? n : null; };
  const lb = einst.einheit === 'lb';
  const auswahl = lb ? LB_SCHEIBEN.map((w) => [kgVonLb(w), w]) : KG_SCHEIBEN.map((w) => [w, w]);
  const hat = (kg) => einst.scheiben.some((s) => gleich(s, kg));
  const scheibe = (kg) => setEinst({ ...einst, scheiben: hat(kg) ? einst.scheiben.filter((s) => !gleich(s, kg)) : [...einst.scheiben, kg].sort((a, b) => b - a) });
  const steigerungen = lb ? [[2.5, '2,5 lb'], [5, '5 lb'], [10, '10 lb']] : [[1, '1 kg'], [1.25, '1,25 kg'], [2.5, '2,5 kg'], [5, '5 kg']];
  const [bereich, setBereich] = useState(null);           // null = Menü, sonst Kategorie
  const [mitteilungFehler, setMitteilungFehler] = useState(null);
  const mitteilungenSchalten = async (an) => {
    setMitteilungFehler(null);
    if (an && !(await erlaubnisHolen())) {
      setMitteilungFehler('Benachrichtigungen sind für PR Hunter gesperrt. In den Einstellungen des Handys bei PR Hunter erlauben, dann hier einschalten.');
      setEinst({ ...einst, mitteilungen: false });
      return;
    }
    setEinst({ ...einst, mitteilungen: an });
  };
  const oeffne = (id) => { history.pushState({ ...(history.state ?? {}), einstellung: id }, ''); setBereich(id); scrollTo({ top: 0 }); };
  useEffect(() => {
    const zurueckZumMenue = (e) => { if (!e.state?.einstellung) setBereich(null); };
    addEventListener('popstate', zurueckZumMenue);
    return () => removeEventListener('popstate', zurueckZumMenue);
  }, []);
  const bereiche = {
    training: ['Training', 'Pausen, Ton, Benachrichtigungen, Cut-Modus, Readiness-Check, e1RM-Formel', I.heute, `Pausen ${mmss(einst.pausen.top)} / ${mmss(einst.pausen.backoff)} · Ton ${(TOENE[einst.ton] ?? TOENE.piep).name} · Cut ${einst.cut ? 'an' : 'aus'}`],
    koerper: ['Körper', 'Gewicht heute und Ziel', I.statistik, `${einst.koerpergewicht ? `${fmt(inAnzeige(einst.koerpergewicht), 1)} ${einheit()}` : 'kein Gewicht'}${einst.gewichtZiel ? ` · Ziel ${fmt(inAnzeige(einst.gewichtZiel), 1)}` : ''}`],
    geraete: ['Geräte und Einheit', 'kg/lb, Steigerung, Stange, Scheiben', I.rechner, `${einst.einheit} · Stange ${fmt(inAnzeige(einst.stange), 1)} · ${einst.scheiben.length} Scheiben`],
    anzeige: ['Anzeige', 'Hell/Dunkel, Farbwelt, Schrift, Sprache, Hintergrund', I.theme, `${{ system: 'System', light: 'Hell', dark: 'Dunkel' }[einst.thema ?? 'system']} · ${STIL_WAHL.find(([k]) => k === (einst.stil ?? 'eisen'))?.[1] ?? 'Eisen'} · ${SCHRIFT_WAHL.find(([k]) => k === (einst.schrift ?? 'archivo'))?.[1] ?? 'Archivo'} · ${einst.sprache === 'en' ? 'English' : 'Deutsch'} · ${SCHRIFT.find(([z]) => z === (einst.zoom ?? 1))?.[1] ?? 'Normal'}`],
    ...(DEMO ? {} : { konto: ['Konto und Daten', 'Profilbild, Name, Vergleich, Abgleich, Export, Abmelden', I.verlauf, k?.email ?? ''] }),
  };
  const titel = bereich ? bereiche[bereich][0] : 'Einstellungen';
  return html`<div class="screen einstellungen">
    <header class="topbar unter">
      <button class="iconbtn" onClick=${bereich ? () => history.back() : zurueck} aria-label="Zurück">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">${bereich ? 'Einstellungen' : 'Gilt für alle Programme'}</div><h1 class="h1">${titel}</h1></div>
    </header>
    <div class="reiter-inhalt" key=${bereich ?? 'menue'}>
    ${!bereich ? html`
      <section class="einst-menue">
        ${Object.entries(bereiche).map(([id, [name, was, icon, stand]], i) => html`<button key=${id} class="einst-punkt card" onClick=${() => oeffne(id)}>
          <span class="einst-icon" style=${`--ic:${ICON_FARBEN[i % ICON_FARBEN.length]}`}>${icon}</span>
          <span class="einst-text"><b>${name}</b><span class="muted">${was}</span><small>${stand}</small></span>
          <span class="einst-pfeil">${I.weiter}</span></button>`)}
      </section>
      ${anleitung ? html`<button class="btn btn-soft btn-block" onClick=${anleitung}>Anleitung erneut ansehen</button>` : null}
      ${DEMO ? html`<section class="card pad stack"><span class="viz-t">Demo</span>
        <p style="margin:0;font-size:14px">Alles hier sind Beispieldaten, nichts wird gespeichert.</p>
        <a class="btn btn-chalk btn-block" href="./">Zur Anmeldung</a></section>` : null}`
    : bereich === 'training' ? html`
    <section class="card pad stack">
      <span class="viz-t">Standard-Pausen</span>
      <p class="muted" style="margin:0;font-size:13px">Der Timer startet nach jedem abgehakten Satz mit der Pause dieser Satzart. Eigene Pausen je Übung gehen vor (Übungsseite → Für mich anpassen).</p>
      ${[['top', 'Top-Sätze und Tests'], ['backoff', 'Back-offs und Arbeitssätze'], ['isolation', 'Isolationsübungen']].map(([art, text]) => html`<div key=${art} class="pause-zeile">
        <span>${text}</span>
        <div class="row" style="gap:8px"><button class="mini" onClick=${() => aendere(art, -15)} aria-label=${`${text}: 15 Sekunden weniger`}>−15</button>
          <b class="zahl tab-num" style="font-size:22px;min-width:50px;text-align:center">${mmss(einst.pausen[art])}</b>
          <button class="mini" onClick=${() => aendere(art, 15)} aria-label=${`${text}: 15 Sekunden mehr`}>+15</button></div></div>`)}
      <div class="stack unterteil" style="gap:6px"><span class="eyebrow">Ton am Pausenende</span>
        <div class="ton-wahl">${Object.entries(TOENE).map(([id, t]) => html`<button key=${id} class="chip" aria-pressed=${String((einst.ton ?? 'piep') === id)}
          onClick=${() => { piep(id); setEinst({ ...einst, ton: id }); }}>${t.name}</button>`)}</div>
        <span class="muted" style="font-size:12.5px">Tippen spielt den Ton zur Probe. Dazu vibriert das Handy (das iPhone kann es nicht).</span></div>
      <label class="schalter" for="e-vibration"><span><b>Vibration</b><br/>
        <span class="muted" style="font-size:12.5px">Kurz beim Starten und Speichern eines Trainings, am Pausenende und bei Rekorden. Vibriert es beim Antippen von Tabs und Menüs, kommt das nicht von der App, sondern vom Handy: Android → Einstellungen → Töne und Vibration → Systemsteuerung → Berührungen.</span></span>
        <input type="checkbox" id="e-vibration" checked=${einst.vibration !== false} onChange=${(e) => setEinst({ ...einst, vibration: e.currentTarget.checked })}/></label>
      <label class="schalter" for="e-mitteilung"><span><b>Benachrichtigungen</b><br/>
        <span class="muted" style="font-size:12.5px">Solange ein Training läuft: Sätze und bis wann die Pause läuft in der Leiste des Handys, bis das Training beendet ist. Im Hintergrund am Pausenende eine Meldung mit Ton. Gilt nur für dieses Gerät.</span></span>
        <input type="checkbox" id="e-mitteilung" disabled=${!mitteilungMoeglich() || DEMO} checked=${!!einst.mitteilungen && mitteilungErlaubt()}
          onChange=${(e) => mitteilungenSchalten(e.currentTarget.checked)}/></label>
      ${!mitteilungMoeglich() ? html`<span class="muted" style="font-size:12.5px">Dieser Browser kann keine Benachrichtigungen. Auf dem iPhone geht es ab iOS 16.4 und nur in der installierten App (Zum Home-Bildschirm).</span>`
        : html`<span class="muted" style="font-size:12.5px">Grenzen einer Web-App: kein sekündlich laufender Timer in der Leiste, und im Hintergrund bremst das Handy die App. Android meldet das Pausenende meist pünktlich, das iPhone oft erst beim Öffnen.</span>`}
      ${mitteilungFehler ? html`<p class="fehler">${mitteilungFehler}</p>` : null}
    </section>
    <section class="card pad stack">
      <label class="schalter" style="border-top:0;padding-top:0" for="e-cut"><span><b>Cut-Modus</b><br/>
        <span class="muted" style="font-size:12.5px">Ein Satz weniger bei Back-offs, Varianten und Zubehör (mind. 1). Top-Sätze, Tests und Wettkampf-Hauptsätze bleiben. Vorlagen mit eigenen Cut-Regeln (Hybrid) nutzen diese.</span></span>
        <input type="checkbox" id="e-cut" checked=${einst.cut} onChange=${(e) => setEinst({ ...einst, cut: e.currentTarget.checked })}/></label>
      <label class="schalter" for="e-bereit"><span><b>Readiness-Check</b><br/>
        <span class="muted" style="font-size:12.5px">Vor jedem Training vier kurze Fragen (Schlaf, Stress, Muskelkater, Energie). Bei schlechten Werten schlägt die App 5 % weniger Gewicht vor.</span></span>
        <input type="checkbox" id="e-bereit" checked=${einst.bereitschaft !== false} onChange=${(e) => setEinst({ ...einst, bereitschaft: e.currentTarget.checked })}/></label>
      <div class="stack unterteil" style="gap:6px"><span class="eyebrow">e1RM-Formel</span>
        <${Seg} label="e1RM-Formel" werte=${[['rpe', 'RPE (RTS)'], ['epley', 'Epley'], ['brzycki', 'Brzycki']]} wert=${einst.formel} setze=${(v) => setEinst({ ...einst, formel: v })}/>
        <span class="muted" style="font-size:12.5px">${einst.formel === 'rpe' ? 'Mit RPE über die Tabelle nach Tuchscherer, ohne RPE nach Epley.' : 'Ohne RPE-Tabelle; ein angegebenes RPE zählt als Wiederholungen in Reserve.'}</span></div>
    </section>

`
    : bereich === 'koerper' ? html`
    <section class="card pad stack">
      <div class="fields">
        <label class="field" for="e-kg"><span class="label">Gewicht heute (${einheit()})</span>
          <input id="e-kg" type="text" inputmode="decimal" value=${kgText} onInput=${(e) => setKgText(e.currentTarget.value)}
            onChange=${() => { const v = zahl(kgText); const kg = v != null ? inKg(v) : null; if (kg >= 30 && kg <= 250) setEinst({ ...einst, koerpergewicht: kg }); }}/></label>
        <label class="field" for="e-ziel"><span class="label">Ziel (${einheit()})</span>
          <input id="e-ziel" type="text" inputmode="decimal" value=${zielText} placeholder="–" onInput=${(e) => setZielText(e.currentTarget.value)}
            onChange=${() => { const v = zahl(zielText); const kg = v != null ? inKg(v) : null; setEinst({ ...einst, gewichtZiel: kg >= 30 && kg <= 250 ? Math.round(kg * 10) / 10 : null }); }}/></label>
      </div>
      <span class="muted" style="font-size:12.5px">Täglich am schnellsten auf „Heute“ mit −/+. Zählt für Klimmzüge und Dips (Gesamtlast), DOTS und das Kraftprofil; den Verlauf zeigt die Statistik.</span>
    </section>

`
    : bereich === 'geraete' ? html`
    <section class="card pad stack">
      <${Seg} label="Einheit" werte=${[['kg', 'kg'], ['lb', 'lb']]} wert=${einst.einheit} setze=${(v) => {
        const neu = aufEinheit(einst, v);
        // Textfelder in der NEUEN Einheit füllen (die Anzeige stellt erst beim nächsten Zeichnen um)
        const anzeigen = (kg) => String(Math.round((v === 'lb' ? kg / KG_PRO_LB : kg) * 10) / 10).replace('.', ',');
        setEinst(neu); setStangeText(anzeigen(neu.stange));
        if (einst.koerpergewicht) setKgText(anzeigen(einst.koerpergewicht));
        if (einst.gewichtZiel) setZielText(anzeigen(einst.gewichtZiel));
      }}/>
      <div class="stack unterteil" style="gap:6px"><span class="eyebrow">Kleinste Steigerung</span>
        <div class="row wrap" style="gap:6px">${steigerungen.map(([v, t]) => html`<button key=${v} class="chip" aria-pressed=${String(einst.inc === v)} onClick=${() => setEinst({ ...einst, inc: v })}>${t}</button>`)}</div>
        <span class="muted" style="font-size:12.5px">Programmgewichte werden darauf gerundet.</span></div>
      <label class="field unterteil" for="e-stange"><span class="label">Stange (${einheit()})</span>
        <input id="e-stange" type="text" inputmode="decimal" value=${stangeText} onInput=${(e) => setStangeText(e.currentTarget.value)}
          onChange=${() => { const v = zahl(stangeText); if (v > 0 && v < 100) setEinst({ ...einst, stange: Math.round(inKg(v) * 100) / 100 }); }}/></label>
      <div class="stack unterteil" style="gap:6px"><span class="eyebrow">Vorhandene Scheiben (je Paar)</span>
        <div class="row wrap" style="gap:6px">${auswahl.map(([kg, anzeige]) => html`<button key=${kg} class="chip" aria-pressed=${String(hat(kg))} onClick=${() => scheibe(kg)}>${fmt(anzeige)}</button>`)}</div>
        <span class="muted" style="font-size:12.5px">Für Scheibenrechner, Aufwärmen und das Hantelbild.</span></div>
    </section>

`
    : bereich === 'anzeige' ? html`
    <section class="card pad stack">
      <div class="stack" style="gap:6px"><span class="eyebrow">Hell oder dunkel</span>
        <${Seg} label="Hell oder dunkel" werte=${[['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']]} wert=${einst.thema ?? 'system'} setze=${(v) => setEinst({ ...einst, thema: v })}/></div>
      <div class="stack unterteil" style="gap:6px"><span class="eyebrow">Farbwelt</span>
        <div class="stil-wahl" role="group" aria-label="Farbwelt">${STIL_WAHL.map(([id, name, was, farben]) => html`<button key=${id} aria-pressed=${String((einst.stil ?? 'eisen') === id)}
          onClick=${() => setEinst({ ...einst, stil: id })}><span class="muster">${farben.map((f, i) => html`<i key=${i} style=${`background:${f}`}></i>`)}</span>
          <b>${name}</b><small>${was}</small></button>`)}</div></div>
      <div class="stack unterteil" style="gap:6px"><span class="eyebrow">Schriftart</span>
        <div class="schrift-wahl" role="group" aria-label="Schriftart">${SCHRIFT_WAHL.map(([id, name, was, familie]) => html`<button key=${id} aria-pressed=${String((einst.schrift ?? 'archivo') === id)}
          onClick=${() => setEinst({ ...einst, schrift: id })} style=${`font-family:${familie}, system-ui, sans-serif`}><b>${fmt(inAnzeige(182.5), 1)} ${einheit()}</b><span>${name}</span><small>${was}</small></button>`)}</div></div>
      <div class="stack unterteil" style="gap:6px"><span class="eyebrow">Sprache</span>
        <${Seg} label="Sprache" werte=${[['de', 'Deutsch'], ['en', 'English']]} wert=${einst.sprache ?? 'de'} setze=${(v) => setEinst({ ...einst, sprache: v })}/></div>
      <div class="stack unterteil" style="gap:6px"><span class="eyebrow">Schriftgröße</span>
        <${Seg} label="Schriftgröße" werte=${SCHRIFT} wert=${einst.zoom ?? 1} setze=${(v) => setEinst({ ...einst, zoom: v })}/></div>
      <div class="stack unterteil" style="gap:8px"><span class="eyebrow">Hintergrundbild</span>
        ${bild.bild ? html`<div class="bild-vorschau"></div>` : null}
        <div class="row" style="gap:8px">
          <label class="btn btn-soft btn-sm" style="flex:1" for="e-bild">${bild.bild ? 'Anderes Bild' : 'Bild wählen'}</label>
          <input id="e-bild" type="file" accept="image/*" hidden onChange=${(e) => { bildWaehlen(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }}/>
          ${bild.bild ? html`<button class="btn btn-gefahr btn-sm" onClick=${() => { speichereHintergrund(null, bild.dunkel); setBild({ ...bild, bild: null }); abgleich?.(); }}>Entfernen</button>` : null}
        </div>
        ${bild.bild ? html`<label class="regler-zeile" for="e-sicht"><span>Bild sichtbar</span><b>${sicht} %</b>
          <input id="e-sicht" class="regler" type="range" min="10" max="90" step="5" value=${sicht} style="grid-column:1 / -1"
            onInput=${(e) => { const v = Number(e.currentTarget.value); setSicht(v); setzeAbdunklung(1 - v / 100); }}
            onChange=${(e) => setEinst({ ...einst, hintergrundDunkel: Math.round(100 - Number(e.currentTarget.value)) / 100 })}/></label>` : null}
        ${bild.bild ? html`<label class="schalter" for="e-neigung"><span>Bild bewegt sich mit dem Handy<span class="muted" style="display:block;font-size:12.5px">Ganz leicht, beim Neigen · nur dieses Gerät</span></span>
          <input type="checkbox" id="e-neigung" checked=${neigung} onChange=${async (e) => { const an = e.currentTarget.checked; setNeigung(an); if (!(await schalteNeigung(an))) setNeigung(false); }}/></label>` : null}
        ${bild.bild && neigung ? html`<label class="regler-zeile" for="e-staerke"><span>Stärke der Bewegung</span><b>${staerke} %</b>
          <input id="e-staerke" class="regler" type="range" min="10" max="100" step="10" value=${staerke} style="grid-column:1 / -1"
            onInput=${(ev) => { const v = Number(ev.currentTarget.value); setStaerke(v); setzeNeigungStaerke(v); }}/></label>` : null}
        ${bildFehler ? html`<p class="fehler">${bildFehler}</p>` : null}
        <span class="muted" style="font-size:12.5px">Beim Hochladen wählst du den Ausschnitt passend zum Bildschirm. Wird mit deinem Konto gespeichert (ab Update 11).</span></div>
      <div class="stack unterteil" style="gap:6px"><span class="eyebrow">Flächen</span>
        <label class="regler-zeile" for="e-deck"><span>Deckkraft</span><b>${deck} %</b>
          <input id="e-deck" class="regler" type="range" min="0" max="100" step="2" value=${deck} style="grid-column:1 / -1"
            onInput=${(e) => { const v = Number(e.currentTarget.value); setDeck(v); document.documentElement.style.setProperty('--deckkraft', String((v / 100) ** 2)); document.documentElement.classList.toggle('durchsichtig', v === 0); }}
            onChange=${(e) => setEinst({ ...einst, deckkraft: Number(e.currentTarget.value) / 100 })}/></label>
        <span class="muted" style="font-size:12.5px">Gilt für alle Karten, Fenster und Leisten gleich. 100 % = undurchsichtig.</span></div>
    </section>

`
    : html`      <section class="card pad stack">
        <div class="profil-kopf">
          <${Avatar} bild=${einst.avatar} name=${einst.name ?? k?.email} groesse=${64}/>
          <div style="min-width:0;flex:1"><b style="display:block;font-size:16px">${einst.name ?? 'Ohne Namen'}</b><span class="muted" style="font-size:12.5px;overflow-wrap:anywhere">${k?.email ?? '–'}</span></div>
        </div>
        <div class="row" style="gap:8px">
          <label class="btn btn-soft btn-sm" style="flex:1" for="e-avatar">${einst.avatar ? 'Profilbild ändern' : 'Profilbild wählen'}</label>
          <input id="e-avatar" type="file" accept="image/*" hidden onChange=${async (e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = '';
            if (!f) return; try { setEinst({ ...einst, avatar: await profilbildAusDatei(f) }); } catch (x) { setBildFehler(x.message); } }}/>
          ${einst.avatar ? html`<button class="btn btn-gefahr btn-sm" onClick=${() => setEinst({ ...einst, avatar: null })}>Entfernen</button>` : null}
        </div>
        ${einst.appSettings ? null : html`<span class="muted" style="font-size:12px">Profilbild und Schriftgröße gelten nach Update 11 auf allen Geräten, bis dahin nur auf diesem.</span>`}
        <label class="field" for="e-name"><span class="label">Anzeigename</span>
          <input id="e-name" class="text" type="text" value=${name} onInput=${(e) => setName(e.currentTarget.value)} onChange=${() => setEinst({ ...einst, name: name.trim() || null })}/></label>
        <label class="schalter" for="e-vergleich"><span><b>Mit Freunden vergleichen</b><br/>
          <span class="muted" style="font-size:12.5px">Zeigt Freunden deine e1RM in Kniebeuge, Bankdrücken und Kreuzheben und dein Körpergewicht. Standardmäßig an; wer abschaltet, sieht auch die anderen nicht. Keine Trainings, keine Sätze. Der Anzeigename ist dein Name im Vergleich.</span></span>
          <input type="checkbox" id="e-vergleich" checked=${!!einst.vergleich} onChange=${(e) => setEinst({ ...einst, vergleich: e.currentTarget.checked })}/></label>
        <label class="schalter" for="e-feed"><span><b>Trainings im Feed zeigen</b><br/>
          <span class="muted" style="font-size:12.5px">${einst.feedSpalte ? 'Freunde sehen Datum, Dauer, Übungen, besten Satz je Übung und Rekorde – keine Notizen, kein Körpergewicht. Wer nicht teilt, sieht auch den Feed der anderen nicht.'
            : 'Braucht Datenbank-Update 15 (db/15_feed.sql).'}</span></span>
          <input type="checkbox" id="e-feed" disabled=${!einst.feedSpalte} checked=${einst.feedTeilen !== false} onChange=${(e) => setEinst({ ...einst, feedTeilen: e.currentTarget.checked })}/></label>
      </section>
      <section class="card pad stack">
        <div class="row between"><span class="viz-t">Abgleich</span><${SyncPunkt} sync=${sync} offen=${offen}/></div>
        ${sync.zuletzt ? html`<span class="muted" style="font-size:13px">Zuletzt ${new Date(sync.zuletzt).toLocaleString(einst.sprache === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span>` : null}
        ${sync.fehler ? html`<ul class="fehler" style="padding-left:18px">${sync.fehler.slice(0, 5).map((f, i) => html`<li key=${i}>${f.datum ? `${datumKurz(f.datum)}: ` : ''}${f.meldung}</li>`)}</ul>` : null}
        <div class="row" style="gap:8px"><button class="btn btn-soft btn-sm" style="flex:1" disabled=${sync.laeuft} onClick=${abgleich}>Jetzt abgleichen</button>
          <button class="btn btn-soft btn-sm" style="flex:1" onClick=${exportieren}>Export als CSV</button></div>
        <span class="muted" style="font-size:12.5px">Zweimal täglich sichert ein GitHub-Job alle Tabellen als CSV in ein privates Repository.</span>
      </section>
      <section class="card pad stack">
        <button class="btn btn-soft btn-block" onClick=${raus}>Abmelden</button>
        <span class="muted" style="font-size:12.5px">Beim Abmelden werden die Daten auf diesem Handy gelöscht. Auf dem Server bleibt alles.</span>
        ${sync.fehler ? html`<button class="link" style="justify-self:start" onClick=${neuAnmelden}>Neu anmelden, Daten auf dem Handy behalten</button>` : null}
        ${kontoLoeschen ? html`<button class="btn btn-gefahr btn-sm" onClick=${() => setLoeschen({ text: '' })}>Konto löschen …</button>` : null}
      </section>`}
    </div>
    ${zuschnitt ? html`<${Zuschnitt} quelle=${zuschnitt} uebernehmen=${bildUebernehmen} zu=${zuschnittZu}/>` : null}
    ${loeschen ? html`<${Sheet} zu=${() => !loeschen.laeuft && setLoeschen(null)} label="Konto löschen">
      <h2 class="h2">Konto löschen</h2>
      <p style="margin:0">Löscht dein Konto mit allen Trainings, Sätzen, Blöcken, eigenen Programmen, Körperwerten und Anpassungen – auf dem Server und auf diesem Handy. Das lässt sich nicht rückgängig machen.</p>
      <p class="muted" style="margin:0;font-size:13.5px">Vorher sichern? „Alle Sätze als CSV“ oben. Selbst angelegte Übungen bleiben im gemeinsamen Katalog.</p>
      <label class="field" for="e-loeschen"><span class="label">Zur Bestätigung LÖSCHEN eintippen</span>
        <input id="e-loeschen" class="text" type="text" autocomplete="off" value=${loeschen.text} onInput=${(e) => setLoeschen({ ...loeschen, text: e.currentTarget.value })}/></label>
      ${loeschen.fehler ? html`<p class="fehler">${loeschen.fehler}</p>` : null}
      <div class="row"><button class="btn btn-soft" style="flex:1" disabled=${loeschen.laeuft} onClick=${() => setLoeschen(null)}>Abbrechen</button>
        <button class="btn btn-gefahr" style="flex:1" disabled=${loeschen.laeuft || loeschen.text.trim().toUpperCase() !== 'LÖSCHEN'}
          onClick=${async () => { setLoeschen({ ...loeschen, laeuft: true, fehler: null }); try { await kontoLoeschen(); } catch (e) { setLoeschen({ ...loeschen, laeuft: false, fehler: e.message }); } }}>
          ${loeschen.laeuft ? 'Löscht …' : 'Endgültig löschen'}</button></div>
    <//>` : null}
  </div>`;
}
