// PR Hunter · Einstellungen als Menü mit Unterseiten: Training, Körper, Geräte und Einheit, Anzeige, Konto und Daten.
// Jede Unterseite ist ein eigener Historien-Eintrag (Zurück führt ins Menü).
// Alles gilt für alle Programme; gespeichert im Profil (Supabase), lokal zuerst.
import { SpotifyKarte } from './spotify.js';
import { html, useState, useEffect, useRef, Portal, fmt, mmss, I, Sheet, deEn, Avatar, inKg, inAnzeige, einheit, datumKurz, TOENE, TON_GRUPPEN, tonName, piep, kopiere } from './basis.js';
import { DEMO, DIENSTE } from './stand.js';
import { APP_VERSION } from './hilfe.js';
import { sag } from './ansage.js';
import { moeglich as mitteilungMoeglich, erlaubt as mitteilungErlaubt, erlaubnisHolen } from './mitteilung.js';
import { hintergrund, speichereHintergrund, profilbildAusDatei, setzeAbdunklung, neigungAn, schalteNeigung, neigungStaerke, setzeNeigungStaerke } from './hintergrund.js';
import { Zuschnitt, bildLaden } from './zuschnitt.js';
import { KG_PRO_LB, STANDARD_SCHEIBEN } from '../js/rechnen.js';
import { VideoEinstellung } from './satzvideo.js';

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

export function Einstellungen({ einst, setEinst, zurueck, konto: k, sync, offen, abgleich, abmelden: raus, exportieren, neuAnmelden, SyncPunkt, kontoLoeschen, anleitung, loeschungAbbrechen = null, emailAendern = null, zuImport = null, zuGewichtImport = null, hilfe = {} }) {
  const [mail, setMail] = useState(null);                   // null = zu, sonst { text, laeuft, fehler, gesendet }
  const [loeschen, setLoeschen] = useState(null);         // null | { text, laeuft, fehler }
  const [kgText, setKgText] = useState(einst.koerpergewicht ? String(inAnzeige(einst.koerpergewicht)).replace('.', ',') : '');
  const [zielText, setZielText] = useState(einst.gewichtZiel ? String(inAnzeige(einst.gewichtZiel)).replace('.', ',') : '');
  const [stangeText, setStangeText] = useState(String(inAnzeige(einst.stange)).replace('.', ','));
  const [name, setName] = useState(einst.name ?? '');
  const [vorname, setVorname] = useState(einst.vorname ?? '');
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
    training: ['Training', 'Trainingsart, Ausdauer, Wochenziel, Wettkampf', I.heute, `${einst.trainingsart === 'einfach' ? 'Einfach' : 'Powerlifting'}${einst.ausdauer ? ` + ${{ lauf: 'Laufen', rad: 'Rad', beides: 'Laufen/Rad' }[einst.ausdauer]}` : ''} · ${einst.wochenziel ?? 3}× pro Woche`],
    pausen: ['Pausen und Ton', 'Pausenzeiten, Ton, Ansagen, Vibration, Benachrichtigungen', I.uhr, `${mmss(einst.pausen.top)} / ${mmss(einst.pausen.backoff)} / ${mmss(einst.pausen.isolation)} · ${tonName(einst.ton)}`],
    hilfen: ['Im Training', 'Readiness-Check, Aufwärmen, Supersätze, Technik, Cut-Modus, e1RM', I.blitz, [einst.bereitschaft !== false ? 'Readiness' : null, einst.mobility ? 'Aufwärmen' : null, einst.cut ? 'Cut' : null, einst.autoregulation ? 'Autoregulation' : null].filter(Boolean).join(' · ') || 'Standard'],
    geraete: ['Geräte und Einheit', 'kg/lb, Steigerung, Stange, Scheiben', I.rechner, `${einst.einheit} · Stange ${fmt(inAnzeige(einst.stange), 1)} · ${einst.scheiben.length} Scheiben`],
    anzeige: ['Anzeige', 'Hell/Dunkel, Farbwelt, Schrift, Sprache, Hintergrund', I.theme, `${{ system: 'System', light: 'Hell', dark: 'Dunkel' }[einst.thema ?? 'system']} · ${STIL_WAHL.find(([k]) => k === (einst.stil ?? 'eisen'))?.[1] ?? 'Eisen'} · ${SCHRIFT_WAHL.find(([k]) => k === (einst.schrift ?? 'archivo'))?.[1] ?? 'Archivo'} · ${einst.sprache === 'en' ? 'English' : 'Deutsch'} · ${SCHRIFT.find(([z]) => z === (einst.zoom ?? 1))?.[1] ?? 'Normal'}`],
    verbindungen: ['Kalender und Verbindungen', 'Kalender-Abo, intervals.icu (Garmin, Wahoo …), Strava, Spotify', I.verbindung, ''],
    ...(DEMO ? {} : { sozial: ['Freunde', 'Vergleich, Feed, Kalender', I.feed, `Vergleich ${einst.vergleich ? 'an' : 'aus'} · Feed ${einst.feedTeilen !== false ? 'an' : 'aus'} · Kalender ${einst.kalender !== false ? 'an' : 'aus'}`],
      konto: ['Konto und Daten', 'Profilbild, Name, Abgleich, Export, Abmelden', I.verlauf, k?.email ?? ''] }),
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
    : bereich === 'sozial' ? html`
      <section class="card pad stack">
        <span class="viz-t">Standard für neue Freunde</span>
        <span class="muted" style="font-size:12.5px">Gilt nur für Freunde, die du ab jetzt hinzufügst. Bestehende Freunde stellst du einzeln ein: Feed → Freunde → Freund antippen → „Was ich teile“.</span>
        <label class="schalter" for="e-vergleich"><span><b>Vergleich teilen</b><br/>
          <span class="muted" style="font-size:12.5px">Neue Freunde sehen deine e1RM in Kniebeuge, Bankdrücken und Kreuzheben und dein Körpergewicht. Keine Trainings, keine Sätze.</span></span>
          <input type="checkbox" id="e-vergleich" checked=${!!einst.vergleich} onChange=${(e) => setEinst({ ...einst, vergleich: e.currentTarget.checked })}/></label>
        <label class="schalter" for="e-feed"><span><b>Trainings teilen</b><br/>
          <span class="muted" style="font-size:12.5px">${einst.feedSpalte ? 'Neue Freunde sehen Datum, Dauer, Übungen, Sätze und Rekorde deiner Trainings – keine Notizen, kein Körpergewicht.'
            : 'Braucht Datenbank-Update 15 (db/15_feed.sql).'}</span></span>
          <input type="checkbox" id="e-feed" disabled=${!einst.feedSpalte} checked=${einst.feedTeilen !== false} onChange=${(e) => setEinst({ ...einst, feedTeilen: e.currentTarget.checked })}/></label>
        <label class="schalter" for="e-kalender-teilen"><span><b>Kalender teilen</b><br/>
          <span class="muted" style="font-size:12.5px">${einst.kalenderSpalte ? 'Neue Freunde sehen, an welchen Tagen du trainierst und was du geplant hast (Übungen, keine Gewichte).' : 'Braucht Datenbank-Update 21 (db/21_freigabe_je_freund.sql).'}</span></span>
          <input type="checkbox" id="e-kalender-teilen" disabled=${!einst.kalenderSpalte} checked=${einst.kalenderTeilen !== false} onChange=${(ev) => setEinst({ ...einst, kalenderTeilen: ev.currentTarget.checked })}/></label>
      </section>
      <section class="card pad stack"><span class="viz-t">Anzeige</span>
        <label class="schalter" for="e-kalender"><span><b>Kalender im Feed zeigen</b><br/>
          <span class="muted" style="font-size:12.5px">Nur deine Anzeige: der Monatskalender oben im Feed. Was Freunde sehen, regelt „Kalender teilen“.</span></span>
          <input type="checkbox" id="e-kalender" checked=${einst.kalender !== false} onChange=${(e) => setEinst({ ...einst, kalender: e.currentTarget.checked })}/></label>
      </section>`
    : bereich === 'training' ? html`
    <section class="card pad stack">
      <span class="viz-t">Trainingsart</span>
      <${Seg} label="Trainingsart" werte=${[['einfach', 'Einfach / Bodybuilding'], ['powerlifting', 'Powerlifting']]} wert=${einst.trainingsart ?? 'powerlifting'} setze=${(v) => setEinst({ ...einst, trainingsart: v })}/>
      <span class="muted" style="font-size:12.5px">${einst.trainingsart === 'einfach' ? 'Einfache Ansicht: Vorschläge statt 1RM-Zahlen, keine Kraftwerte für Kniebeuge/Bank/Kreuzheben, kein Kraftprofil, keine Punkte.' : 'Alles sichtbar: Trainingsmax, e1RM, Kraftprofil, Punkte, Powerlifting-Generator.'}</span>
      <span class="viz-t unterteil">${deEn('Hybrid: dazu Ausdauer', 'Hybrid: add cardio')}</span>
      <${Seg} label=${deEn('Hybrid: dazu Ausdauer', 'Hybrid: add cardio')} werte=${[['aus', deEn('Nein', 'No')], ['lauf', deEn('Laufen', 'Running')], ['rad', deEn('Rad', 'Cycling')], ['beides', deEn('Beides', 'Both')]]}
        wert=${einst.ausdauer ?? 'aus'} setze=${(v) => setEinst({ ...einst, ausdauer: v === 'aus' ? null : v })}/>
      <span class="muted" style="font-size:12.5px">${deEn('Läufe und Radfahrten neben dem Krafttraining – auf „Heute“, im Verlauf und als eigener Statistik-Reiter. Nur für dich sichtbar.', 'Runs and rides next to strength training – on “Today”, in History and as its own Stats tab. Only visible to you.')}</span>
      <span class="viz-t unterteil">Wochenziel</span>
      <${Seg} label="Trainings pro Woche" werte=${[[2, '2×'], [3, '3×'], [4, '4×'], [5, '5×'], [6, '6×']]} wert=${einst.wochenziel ?? 3} setze=${(v) => setEinst({ ...einst, wochenziel: v })}/>
      <span class="muted" style="font-size:12.5px">${deEn('Nach jedem Training zeigt die App, wie viele Trainings diese Woche geschafft sind und wie weit es noch bis zum Ziel ist.', 'After each workout the app shows how many workouts you have done this week and how far it is to your goal.')}</span>
    </section>
    ${einst.trainingsart !== 'einfach' ? html`<section class="card pad stack">
      <span class="viz-t">Wettkampf</span>
      <div class="stack unterteil" style="gap:8px">
        <span class="muted" style="font-size:12.5px">Mit Datum zeigt „Heute“ einen Countdown, die passende Phase und eine Prognose deiner Lifts. Mit Gewichtsklasse dazu den Abstand zum Limit.</span>
        <div class="fields"><label class="field" for="e-wk-datum"><span class="label">Wettkampfdatum</span>
          <input id="e-wk-datum" class="text" type="date" value=${einst.wettkampfDatum ?? ''} onInput=${(e) => setEinst({ ...einst, wettkampfDatum: e.currentTarget.value || null })}/></label>
          <label class="field" for="e-wk-klasse"><span class="label">Gewichtsklasse (kg)</span>
          <input id="e-wk-klasse" class="text" type="text" inputmode="decimal" placeholder="z. B. 83" value=${einst.gewichtsklasse ?? ''}
            onChange=${(e) => { const v = Number(e.currentTarget.value.replace(',', '.')); setEinst({ ...einst, gewichtsklasse: v > 0 ? v : null }); }}/></label></div></div>
      ${einst.trainingsart !== 'einfach' ? html`<label class="schalter" for="e-meets"><span><b>Wettkampf-Ergebnisse</b><br/>
        <span class="muted" style="font-size:12.5px">„Meine Wettkämpfe“ in Statistik → Kraft: Versuche, Total, DOTS und Verlauf je Meet.</span></span>
        <input type="checkbox" id="e-meets" checked=${einst.wettkampfErgebnisse !== false} onChange=${(e) => setEinst({ ...einst, wettkampfErgebnisse: e.currentTarget.checked })}/></label>` : null}
    </section>` : null}`
    : bereich === 'pausen' ? html`
    <section class="card pad stack">
      <span class="viz-t">Standard-Pausen</span>
      <p class="muted" style="margin:0;font-size:13px">Der Timer startet nach jedem abgehakten Satz mit der Pause dieser Satzart. Eigene Pausen je Übung gehen vor (Übungsseite → Für mich anpassen).</p>
      ${[['top', 'Top-Sätze und Tests'], ['backoff', 'Back-offs und Arbeitssätze'], ['isolation', 'Isolationsübungen']].map(([art, text]) => html`<div key=${art} class="pause-zeile">
        <span>${text}</span>
        <div class="row" style="gap:8px"><button class="mini" onClick=${() => aendere(art, -15)} aria-label=${`${text}: 15 Sekunden weniger`}>−15</button>
          <b class="zahl tab-num" style="font-size:22px;min-width:50px;text-align:center">${mmss(einst.pausen[art])}</b>
          <button class="mini" onClick=${() => aendere(art, 15)} aria-label=${`${text}: 15 Sekunden mehr`}>+15</button></div></div>`)}
      <label class="schalter" for="e-pause-rpe"><span><b>Pause nach Anstrengung</b><br/>
        <span class="muted" style="font-size:12.5px">Satz mit RPE 9,5 → 30 s länger, RPE 10 → 60 s länger, RPE 6 oder leichter → 30 s kürzer. Ohne eingetragene RPE gilt die normale Pause.</span></span>
        <input type="checkbox" id="e-pause-rpe" checked=${!!einst.pauseNachRpe} onChange=${(e) => setEinst({ ...einst, pauseNachRpe: e.currentTarget.checked })}/></label>
      <label class="schalter" for="e-ansage"><span><b>Sprachansagen</b><br/>
        <span class="muted" style="font-size:12.5px">In der Pause über Lautsprecher oder Kopfhörer: „Noch 30 Sekunden“ und am Ende der nächste Satz mit Übung, Gewicht und Wdh. Nur bei offener App.</span></span>
        <input type="checkbox" id="e-ansage" checked=${!!einst.sprachansagen} onChange=${(e) => { setEinst({ ...einst, sprachansagen: e.currentTarget.checked }); if (e.currentTarget.checked) sag(deEn('Sprachansagen sind an.', 'Voice prompts are on.')); }}/></label>
      <div class="stack unterteil" style="gap:6px"><span class="eyebrow">Ton am Pausenende</span>
        <div class="ton-auswahl">
          <${TonWahl} wert=${einst.ton ?? 'piep'} setze=${(id) => setEinst({ ...einst, ton: id })}/>
          <button class="btn btn-soft btn-sm ton-probe" onClick=${() => piep(einst.ton ?? 'piep')} aria-label="Ton abspielen">▶ Probe</button></div>
        <span class="muted" style="font-size:12.5px">${deEn(`${Object.keys(TOENE).length - 1} Töne in ${TON_GRUPPEN.length - 1} Gruppen – Auswählen spielt den Ton gleich ab. Dazu vibriert das Handy (das iPhone kann es nicht).`,
          `${Object.keys(TOENE).length - 1} sounds in ${TON_GRUPPEN.length - 1} groups – choosing one plays it right away. The phone vibrates too (iPhones can't).`)}</span></div>
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
    </section>`
    : bereich === 'hilfen' ? html`
    <section class="card pad stack">
      <span class="viz-t">${deEn('Vor dem Training', 'Before the workout')}</span>
      <label class="schalter" style="border-top:0;padding-top:0" for="e-bereit"><span><b>Readiness-Check</b><br/>
        <span class="muted" style="font-size:12.5px">Vor jedem Training vier kurze Fragen (Schlaf, Stress, Muskelkater, Energie). Bei schlechten Werten schlägt die App 5 % weniger Gewicht vor.</span></span>
        <input type="checkbox" id="e-bereit" checked=${einst.bereitschaft !== false} onChange=${(e) => setEinst({ ...einst, bereitschaft: e.currentTarget.checked })}/></label>
      <label class="schalter" for="e-aufwaerm"><span><b>Aufwärm-Routine</b><br/>
        <span class="muted" style="font-size:12.5px">Vor dem ersten Satz eine kurze Mobility-Abfolge (ca. 3 min) passend zum Trainingstag, mit Timer je Übung. Lässt sich jedes Mal überspringen.</span></span>
        <input type="checkbox" id="e-aufwaerm" checked=${einst.mobility === true} onChange=${(e) => setEinst({ ...einst, mobility: e.currentTarget.checked })}/></label>
    </section>
    <section class="card pad stack">
      <span class="viz-t">${deEn('Während des Trainings', 'During the workout')}</span>
      <label class="schalter" style="border-top:0;padding-top:0" for="e-supersatz"><span><b>Supersätze bilden</b><br/>
        <span class="muted" style="font-size:12.5px">Unter jeder Übung der Knopf „Supersatz mit nächster“ – zwei Übungen im Wechsel, Pause erst nach der Runde.</span></span>
        <input type="checkbox" id="e-supersatz" checked=${einst.supersatzKnopf === true} onChange=${(e) => setEinst({ ...einst, supersatzKnopf: e.currentTarget.checked })}/></label>
      <label class="schalter" for="e-technik"><span><b>Technik je Satz bewerten</b><br/>
        <span class="muted" style="font-size:12.5px">Nach dem Abhaken 👍 oder 👎 für die Technik. Die Übungsseite zeigt dann, ab welchem Gewicht die Technik leidet.</span></span>
        <input type="checkbox" id="e-technik" checked=${!!einst.technikBewertung} onChange=${(e) => setEinst({ ...einst, technikBewertung: e.currentTarget.checked })}/></label>
      <${VideoEinstellung} einst=${einst} setEinst=${setEinst}/>
      <label class="schalter" for="e-auto"><span><b>Autoregulation für Zubehör</b><br/>
        <span class="muted" style="font-size:12.5px">Gewicht der Zubehörübungen aus der RPE der letzten Einheit (leichter → mehr, schwerer → weniger); fällt die Leistung dreimal hintereinander, Deload −10 %. Kniebeuge, Bank und Kreuzheben steuert weiter der Plan.</span></span>
        <input type="checkbox" id="e-auto" checked=${!!einst.autoregulation} onChange=${(e) => setEinst({ ...einst, autoregulation: e.currentTarget.checked })}/></label>
      <label class="schalter" for="e-cut"><span><b>Cut-Modus</b><br/>
        <span class="muted" style="font-size:12.5px">Ein Satz weniger bei Back-offs, Varianten und Zubehör (mind. 1). Top-Sätze, Tests und Wettkampf-Hauptsätze bleiben. Vorlagen mit eigenen Cut-Regeln (Hybrid) nutzen diese.</span></span>
        <input type="checkbox" id="e-cut" checked=${einst.cut} onChange=${(e) => setEinst({ ...einst, cut: e.currentTarget.checked })}/></label>
    </section>
    <section class="card pad stack">
      <div class="stack" style="gap:6px"><span class="viz-t">e1RM-Formel</span>
        <${Seg} label="e1RM-Formel" werte=${[['rpe', 'RPE (RTS)'], ['epley', 'Epley'], ['brzycki', 'Brzycki']]} wert=${einst.formel} setze=${(v) => setEinst({ ...einst, formel: v })}/>
        <span class="muted" style="font-size:12.5px">${einst.formel === 'rpe' ? 'Mit RPE über die Tabelle nach Tuchscherer, ohne RPE nach Epley.' : 'Ohne RPE-Tabelle; ein angegebenes RPE zählt als Wiederholungen in Reserve.'}</span></div>
    </section>`
    : bereich === 'verbindungen' ? html`
    <section class="card pad stack">
      <span class="viz-t">${deEn('Kalender', 'Calendar')}</span>
      ${hilfe.kalender ? html`<button class="btn btn-soft btn-sm" style="justify-self:start" onClick=${hilfe.kalender}>Termine in den Kalender (.ics)</button>` : null}
      <${KalenderAbo}/>
    </section>
    ${!DEMO ? html`<${WegeWahl}/><${IntervalsKarte} aus=${!einst.ausdauer}/><${StravaKarte}/><${SpotifyKarte} einst=${einst} setEinst=${setEinst}/>` : null}`
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
      <label class="schalter unterteil" for="e-sbd"><span><b>SBD-Maxe auf Heute</b><br/>
        <span class="muted" style="font-size:12.5px">Kniebeuge, Bankdrücken und Kreuzheben oben auf „Heute“ – nur bei einem Powerlifting-Programm.</span></span>
        <input type="checkbox" id="e-sbd" checked=${einst.sbdHeute !== false} onChange=${(ev) => setEinst({ ...einst, sbdHeute: ev.currentTarget.checked })}/></label>
      <div class="stack unterteil" style="gap:6px"><span class="eyebrow">Schriftgröße</span>
        <${Seg} label="Schriftgröße" werte=${SCHRIFT} wert=${einst.zoom ?? 1} setze=${(v) => setEinst({ ...einst, zoom: v })}/></div>
      <div class="stack unterteil" style="gap:8px"><span class="eyebrow">Hintergrundbild</span>
        ${bild.bild ? html`<div class="bild-vorschau" style=${`background-image:url("${bild.bild}")`}></div>` : null}
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
        ${zuImport ? html`<button class="btn btn-soft btn-block" onClick=${zuImport}>${I.import} Trainings aus einer anderen App importieren</button>` : null}
        ${zuGewichtImport ? html`<button class="btn btn-soft btn-block" onClick=${zuGewichtImport}>${I.import} Gewichtsdaten hinzufügen (Yazio, Waage, Screenshots)</button>` : null}
        ${hilfe.sichern ? html`<div class="row" style="gap:8px"><button class="btn btn-soft btn-sm" style="flex:1" onClick=${hilfe.sichern}>Alles sichern (JSON)</button>
          <label class="btn btn-soft btn-sm datei-knopf" style="flex:1">Sicherung einspielen<input type="file" accept=".json,application/json" onChange=${(e) => hilfe.einspielen(e.currentTarget.files?.[0])}/></label></div>
          <span class="muted" style="font-size:12px">Sicherung = alle Trainings, eigenen Programme, Körperwerte und Einstellungen in einer Datei. Einspielen ergänzt nur, was fehlt.</span>` : null}
        <div class="row" style="gap:8px">${hilfe.feedback ? html`<button class="btn btn-soft btn-sm" style="flex:1" onClick=${hilfe.feedback}>Feedback / Fehler melden</button>` : null}
          ${hilfe.datenschutz ? html`<button class="btn btn-soft btn-sm" style="flex:1" onClick=${hilfe.datenschutz}>Datenschutz & Impressum</button>` : null}</div>
        <label class="field" for="e-vorname"><span class="label">Vorname (für die Begrüßung)</span>
          <input id="e-vorname" class="text" type="text" autocomplete="given-name" value=${vorname} onInput=${(e) => setVorname(e.currentTarget.value)} onChange=${() => setEinst({ ...einst, vorname: vorname.trim() || null })}/></label>
        <div class="stack" style="gap:6px"><span class="label">Geschlecht</span>
          <div class="seg" role="group" aria-label="Geschlecht">${[['w', 'Frau'], ['m', 'Mann'], ['x', 'Keine Angabe']].map(([k, n]) => html`<button key=${k} aria-pressed=${String(einst.geschlecht === k)} onClick=${() => setEinst({ ...einst, geschlecht: k })}>${n}</button>`)}</div></div>
        ${einst.geschlecht === 'w' ? html`<label class="schalter" for="e-zyklus"><span><b>Zyklus-Tracking</b><br/>
          <span class="muted" style="font-size:12.5px">Zyklustag und Phase auf „Heute“, Eintragen und Leistung je Phase in Statistik → Körper. Privat – Freunde sehen davon nichts.</span></span>
          <input type="checkbox" id="e-zyklus" checked=${einst.zyklusAn !== false} onChange=${(e) => setEinst({ ...einst, zyklusAn: e.currentTarget.checked })}/></label>` : null}
        <label class="field" for="e-name"><span class="label">Anzeigename</span>
          <input id="e-name" class="text" type="text" value=${name} onInput=${(e) => setName(e.currentTarget.value)} onChange=${() => setEinst({ ...einst, name: name.trim() || null })}/></label>
        ${emailAendern ? mail == null ? html`<button class="link" style="justify-self:start" onClick=${() => setMail({ text: '' })}>E-Mail-Adresse ändern</button>`
          : mail.gesendet ? html`<div class="hint immer gut">${I.check}<span class="t">Bestätigung gesendet</span><span></span>
            <p>${`Bitte den Link in der Mail an ${mail.text.trim()} öffnen (je nach Einstellung auch an deine bisherige Adresse). Bis dahin gilt die alte Adresse.`}</p></div>`
          : html`<div class="stack" style="gap:8px"><label class="field" for="e-mail"><span class="label">Neue E-Mail-Adresse</span>
            <input id="e-mail" class="text" type="email" autocomplete="email" value=${mail.text} onInput=${(ev) => setMail({ ...mail, text: ev.currentTarget.value, fehler: null })}/></label>
            ${mail.fehler ? html`<p class="fehler">${mail.fehler}</p>` : null}
            <div class="row" style="gap:8px"><button class="btn btn-soft btn-sm" style="flex:1" onClick=${() => setMail(null)}>Abbrechen</button>
              <button class="btn btn-chalk btn-sm" style="flex:1.4" disabled=${mail.laeuft || !mail.text.trim()}
                onClick=${async () => { setMail({ ...mail, laeuft: true }); try { await emailAendern(mail.text); setMail({ ...mail, laeuft: false, gesendet: true }); } catch (x) { setMail({ ...mail, laeuft: false, fehler: x.message }); } }}>
                ${mail.laeuft ? 'Sende …' : 'Bestätigung senden'}</button></div></div>` : null}
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
        ${einst.loeschenAb && loeschungAbbrechen ? html`<div class="hint immer">${I.warn}<span class="t">${`Löschung vorgemerkt bis ${datumKurz(einst.loeschenAb.slice(0, 10))}${einst.loeschenAb.slice(0, 4)}`}</span><span></span>
          <p>Danach werden Konto und alle Trainingsdaten endgültig gelöscht.</p><span></span>
          <div class="row" style="margin-top:6px"><button class="btn btn-go btn-sm" onClick=${loeschungAbbrechen}>Löschung abbrechen</button></div></div>`
          : kontoLoeschen ? html`<button class="btn btn-gefahr btn-sm" onClick=${() => setLoeschen({ text: '' })}>Konto löschen …</button>` : null}
      </section>`}
    </div>
    ${zuschnitt ? html`<${Zuschnitt} quelle=${zuschnitt} uebernehmen=${bildUebernehmen} zu=${zuschnittZu}/>` : null}
    ${loeschen ? html`<${Sheet} zu=${() => !loeschen.laeuft && setLoeschen(null)} label="Konto löschen">
      <h2 class="h2">Konto löschen</h2>
      <div class="hint immer">${I.warn}<span class="t">Erst deine Trainings sichern</span><span></span>
        <p>Nach dem Löschen sind alle Trainings, Sätze, Blöcke, eigenen Programme und Körperwerte weg. Exportiere sie vorher – die CSV lässt sich später wieder importieren oder in Excel öffnen.</p><span></span>
        <div class="row" style="margin-top:6px"><button class="btn btn-chalk btn-sm" onClick=${exportieren}>Trainings als CSV exportieren</button></div></div>
      <p style="margin:0">Dein Konto wird sofort abgemeldet und ist für Freunde nicht mehr sichtbar. <b>Endgültig gelöscht wird erst nach 14 Tagen</b> – meldest du dich bis dahin wieder an, ist alles wieder da und die Löschung aufgehoben.</p>
      <p class="muted" style="margin:0;font-size:13.5px">Selbst angelegte Übungen bleiben im gemeinsamen Katalog.</p>
      <label class="field" for="e-loeschen"><span class="label">Zur Bestätigung LÖSCHEN eintippen</span>
        <input id="e-loeschen" class="text" type="text" autocomplete="off" value=${loeschen.text} onInput=${(e) => setLoeschen({ ...loeschen, text: e.currentTarget.value })}/></label>
      ${loeschen.fehler ? html`<p class="fehler">${loeschen.fehler}</p>` : null}
      <div class="row"><button class="btn btn-soft" style="flex:1" disabled=${loeschen.laeuft} onClick=${() => setLoeschen(null)}>Abbrechen</button>
        <button class="btn btn-gefahr" style="flex:1" disabled=${loeschen.laeuft || loeschen.text.trim().toUpperCase() !== 'LÖSCHEN'}
          onClick=${async () => { setLoeschen({ ...loeschen, laeuft: true, fehler: null }); try { await kontoLoeschen(); } catch (e) { setLoeschen({ ...loeschen, laeuft: false, fehler: e.message }); } }}>
          ${loeschen.laeuft ? 'Wird vorgemerkt …' : 'In 14 Tagen löschen'}</button></div>
    <//>` : null}
    <p class="muted app-version">${`Version ${APP_VERSION()}`}</p>
  </div>`;
}

/** 211: Kalender-Abo – geheimer Link (Update 30 + Edge Function „kalender“), aktualisiert sich im Kalender von selbst. */
const ABO_ANLEITUNG = {
  android: ['Oben „Link kopieren“ tippen.', 'Im Browser (Chrome) calendar.google.com öffnen, Menü ⋮ → „Desktopwebsite“ anhaken – oder am PC.',
    'Links bei „Weitere Kalender“ auf + → „Per URL“.', 'Link einfügen → „Kalender hinzufügen“.',
    'Google-Kalender-App → ☰ → Einstellungen → „PR Hunter“ → „Synchronisieren“ einschalten.'],
  iphone: ['Oben „Link kopieren“ tippen.', 'Einstellungen → Kalender → Accounts → „Account hinzufügen“.', '„Andere“ → „Kalenderabo hinzufügen“.',
    'Link einfügen → „Weiter“ → „Sichern“.', 'Der Kalender „PR Hunter“ erscheint in der Kalender-App.'],
  pc: ['Oben „Link kopieren“ (oder den Link an dich selbst schicken).', 'Google: calendar.google.com → „Weitere Kalender“ + → „Per URL“.',
    'Outlook: Kalender → „Kalender hinzufügen“ → „Aus dem Internet“.', 'Link einfügen und bestätigen.'],
};

/** Ton am Pausenende: eigenes Auswahlfenster statt <select> (das native Aufklappmenü flackerte auf dem Handy);
 *  beim Öffnen steht der gewählte Ton in der Mitte, Antippen wählt und spielt ihn – das Fenster bleibt zum Durchprobieren offen. */
function TonWahl({ wert, setze }) {
  const [offen, setOffen] = useState(false);
  return html`<button class="ton-knopf" aria-haspopup="dialog" onClick=${() => setOffen(true)}><span>${tonName(wert)}</span><span class="ton-pfeil" aria-hidden="true">▾</span></button>
    ${offen ? html`<${Portal}><${Sheet} zu=${() => setOffen(false)} label=${deEn('Ton am Pausenende', 'Sound at end of rest')}>
      <div class="sheet-kopf"><h2 class="h2">${deEn('Ton am Pausenende', 'Sound at end of rest')}</h2></div>
      <${TonListe} wert=${wert} setze=${setze}/>
    <//><//>` : null}`;
}

/** Liste im Fenster; zentriert beim Öffnen den gewählten Ton im sichtbaren Bereich unter dem festen Kopf.
 *  Eigene Komponente, damit das Zentrieren im Fenster selbst läuft (das Fenster wird über ein Portal gezeichnet). */
function TonListe({ wert, setze }) {
  const liste = useRef(null);
  useEffect(() => {
    requestAnimationFrame(() => {
      const el = liste.current?.querySelector('.ton-punkt[aria-pressed="true"]'), box = el?.closest('.sheet');
      if (!el || !box) return;
      const kopf = box.querySelector('.sheet-kopf')?.offsetHeight ?? 0;
      const a = el.getBoundingClientRect(), b = box.getBoundingClientRect();
      box.scrollTop += a.top - (b.top + kopf) - (b.height - kopf - a.height) / 2;
    });
  }, []);
  return html`<div class="stack ton-liste" ref=${liste} style="gap:10px">${TON_GRUPPEN.map(([g, de, en]) => html`<div key=${g} class="stack" style="gap:4px">
    <span class="eyebrow">${deEn(de, en)}</span>
    ${Object.entries(TOENE).filter(([, x]) => x.gruppe === g).map(([id]) => html`<button key=${id} class="ton-punkt" aria-pressed=${String(wert === id)}
      onClick=${() => { piep(id); setze(id); }}><span>${tonName(id)}</span>${wert === id ? I.check : null}</button>`)}</div>`)}</div>`;
}

/** 230: intervals.icu – Schlüssel eintragen, danach kommen Läufe und Radfahrten automatisch (Garmin, Wahoo, Polar, Coros, Zwift). */
function IntervalsKarte({ aus = false }) {
  const [st, setSt] = useState(null);
  const [key, setKey] = useState('');
  const [laeuft, setLaeuft] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const [trennenFragen, setTrennenFragen] = useState(false);
  const laden = () => DIENSTE.intervalsStatus?.().then((s) => setSt(s ?? false)).catch(() => setSt(false));
  useEffect(() => { laden(); }, []);
  const tu = async (aktion, daten) => {
    setLaeuft(aktion); setMeldung(null);
    try {
      const r = await DIENSTE.intervalsAktion(aktion, daten);
      setMeldung(aktion === 'verbinden' ? deEn(`Verbunden${r.name ? ` als ${r.name}` : ''} – die letzten 90 Tage kommen gleich in den Verlauf.`, `Connected${r.name ? ` as ${r.name}` : ''} – the last 90 days arrive in History shortly.`)
        : aktion === 'abgleich' ? deEn(r.neu ? `${r.neu} neue Aktivitäten geholt.` : 'Alles aktuell.', r.neu ? `${r.neu} new activities.` : 'Up to date.')
        : deEn('Getrennt – importierte Daten gelöscht.', 'Disconnected – imported data deleted.'));
      setKey(''); setTrennenFragen(false); laden();
    } catch (e) { setMeldung(e.message); }
    setLaeuft(null);
  };
  if (!DIENSTE.intervalsStatus) return null;
  return html`<section class="card pad stack iv-karte">
    <div class="row between" style="align-items:center"><span class="viz-t">intervals.icu</span>
      ${st?.verbunden ? html`<span class="iv-ok">● ${deEn('verbunden', 'connected')}</span>` : null}</div>
    ${aus ? html`<p class="muted" style="margin:0;font-size:12.5px">${deEn('Damit Läufe und Radfahrten angezeigt werden: Einstellungen → Training → „Hybrid: dazu Ausdauer“.', 'To show runs and rides: Settings → Training → “Hybrid: add cardio”.')}</p>` : null}
    ${st === false ? html`<p class="muted" style="margin:0;font-size:13px">${deEn('Braucht Datenbank-Update 34 (db/34_intervals.sql).', 'Needs database update 34 (db/34_intervals.sql).')}</p>`
    : st?.verbunden ? html`
      <span class="muted" style="font-size:13px">${deEn(`Läufe und Radfahrten kommen automatisch${st.name ? ` (${st.name})` : ''}.`, `Runs and rides arrive automatically${st.name ? ` (${st.name})` : ''}.`)}
        ${st.zuletzt ? ` ${deEn('Zuletzt', 'Last')}: ${datumKurz(st.zuletzt.slice(0, 10))} ${st.zuletzt.slice(11, 16)}` : ''}</span>
      <div class="row" style="gap:8px"><button class="btn btn-soft" style="flex:1" disabled=${!!laeuft} onClick=${() => tu('abgleich')}>${laeuft === 'abgleich' ? '…' : deEn('Jetzt abgleichen', 'Sync now')}</button>
        <button class="btn btn-soft" disabled=${!!laeuft} onClick=${() => setTrennenFragen(!trennenFragen)}>${deEn('Trennen', 'Disconnect')}</button></div>
      ${trennenFragen ? html`<div class="strava-trennen"><span>${deEn('Importierte Daten werden aus PR Hunter gelöscht. In intervals.icu bleibt alles.', 'Imported data is deleted from PR Hunter. Everything stays in intervals.icu.')}</span>
        <button class="btn btn-gefahr btn-sm" disabled=${!!laeuft} onClick=${() => tu('trennen')}>${deEn('Trennen und löschen', 'Disconnect and delete')}</button></div>` : null}`
    : st ? html`
      <span class="muted" style="font-size:13px">${deEn('Kostenlos und automatisch: Uhr → Garmin, Wahoo, Polar, Coros oder Zwift → intervals.icu → PR Hunter.', 'Free and automatic: watch → Garmin, Wahoo, Polar, Coros or Zwift → intervals.icu → PR Hunter.')}</span>
      <ol class="iv-schritte">
        <li>${deEn('Kostenloses Konto auf ', 'Create a free account at ')}<a href="https://intervals.icu" target="_blank" rel="noopener noreferrer">intervals.icu</a>${deEn(' anlegen.', '.')}</li>
        <li>${deEn('Dort unter Settings → Connections deine Uhr verbinden (z. B. Garmin Connect). Wichtig: direkt, nicht über Strava – Strava-Aktivitäten gibt intervals.icu nicht weiter.', 'There, under Settings → Connections, connect your watch (e.g. Garmin Connect). Important: directly, not via Strava – intervals.icu does not pass on Strava activities.')}</li>
        <li>${deEn('Settings → Developer Settings → „API Key“ anzeigen und kopieren.', 'Settings → Developer Settings → show and copy the “API Key”.')}</li>
        <li>${deEn('Hier einfügen und verbinden. Die letzten 90 Tage kommen sofort, neue Einheiten von selbst.', 'Paste it here and connect. The last 90 days arrive right away, new sessions by themselves.')}</li></ol>
      <div class="row" style="gap:8px"><input class="text" style="flex:1" type="password" autocomplete="off" placeholder=${deEn('API-Schlüssel', 'API key')} value=${key} onInput=${(e) => setKey(e.currentTarget.value)}/>
        <button class="btn btn-chalk" disabled=${key.trim().length < 10 || !!laeuft} onClick=${() => tu('verbinden', { key: key.trim() })}>${laeuft === 'verbinden' ? '…' : deEn('Verbinden', 'Connect')}</button></div>`
    : html`<span class="muted">…</span>`}
    ${meldung ? html`<span class="muted" style="font-size:12.5px">${meldung}</span>` : null}
  </section>`;
}

/** 223/231: Strava mit eigener Strava-App (Strava-API nur mit Strava-Mitgliedschaft; jede Strava-App gilt für eine Person). */
const CALLBACK = 'ichfzfvtuzakujcbiuhf.supabase.co';
function StravaKarte({ aus = false }) {
  const [st, setSt] = useState(null);                   // null = lädt, false = Update fehlt, sonst { verbunden, eingerichtet, zuletzt, webhook }
  const [laeuft, setLaeuft] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const [trennenFragen, setTrennenFragen] = useState(false);
  const [offen, setOffen] = useState(false);
  const [cid, setCid] = useState(''), [geheim, setGeheim] = useState('');
  const appUrl = `${location.origin}${location.pathname}`;
  const laden = () => DIENSTE.stravaStatus?.().then((s) => setSt(s && 'eingerichtet' in s ? s : s ? { ...s, eingerichtet: false, alt: true } : false)).catch(() => setSt(false));
  useEffect(() => { laden(); }, []);
  const tu = async (aktion, daten) => {
    setLaeuft(aktion); setMeldung(null);
    try {
      const r = await DIENSTE.stravaAktion(aktion, daten);
      if (aktion === 'start') { location.href = r.url; return; }
      setMeldung(aktion === 'abgleich' ? deEn(r.neu ? `${r.neu} neue Aktivitäten geholt.` : 'Alles aktuell.', r.neu ? `${r.neu} new activities.` : 'Up to date.') : deEn('Getrennt – Strava-Daten gelöscht.', 'Disconnected – Strava data deleted.'));
      setTrennenFragen(false); laden();
    } catch (e) { setMeldung(e.message); }
    setLaeuft(null);
  };
  const kopierFeld = (label, wert) => html`<div class="sv-wert"><small>${label}</small><code>${wert}</code><button class="btn btn-soft btn-sm" onClick=${async () => setMeldung((await kopiere(wert)) ? deEn(`„${label}“ kopiert.`, `“${label}” copied.`) : wert)}>${deEn('Kopieren', 'Copy')}</button></div>`;
  if (!DIENSTE.stravaStatus) return null;
  return html`<section class="card pad stack strava-karte">
    <div class="row between" style="align-items:center"><span class="viz-t">Strava</span>
      ${st?.verbunden ? html`<span class="strava-ok">● ${deEn('verbunden', 'connected')}</span>` : html`<span class="sv-abo">${deEn('braucht Strava-Abo', 'needs Strava subscription')}</span>`}</div>
    ${aus ? html`<p class="muted" style="margin:0;font-size:12.5px">${deEn('Damit Läufe und Radfahrten angezeigt werden: Einstellungen → Training → „Hybrid: dazu Ausdauer“.', 'To show runs and rides: Settings → Training → “Hybrid: add cardio”.')}</p>` : null}
    ${st === false || st?.alt ? html`<p class="muted" style="margin:0;font-size:13px">${deEn('Braucht Datenbank-Update 35 (db/35_strava_eigen.sql).', 'Needs database update 35 (db/35_strava_eigen.sql).')}</p>`
    : st?.verbunden ? html`
      <span class="muted" style="font-size:13px">${deEn('Läufe und Radfahrten aus Strava kommen automatisch. Nur für dich sichtbar, gehen nicht an „Frag die KI“.', 'Runs and rides from Strava arrive automatically. Only visible to you, not sent to “Ask AI”.')}
        ${st.zuletzt ? ` ${deEn('Zuletzt', 'Last')}: ${datumKurz(st.zuletzt.slice(0, 10))} ${st.zuletzt.slice(11, 16)}` : ''}</span>
      <div class="row" style="gap:8px"><button class="btn btn-soft" style="flex:1" disabled=${!!laeuft} onClick=${() => tu('abgleich')}>${laeuft === 'abgleich' ? '…' : deEn('Jetzt abgleichen', 'Sync now')}</button>
        <button class="btn btn-soft" disabled=${!!laeuft} onClick=${() => setTrennenFragen(!trennenFragen)}>${deEn('Trennen', 'Disconnect')}</button></div>
      ${trennenFragen ? html`<div class="strava-trennen"><span>${deEn('Importierte Strava-Daten werden aus PR Hunter gelöscht. In Strava bleibt alles.', 'Imported Strava data is deleted from PR Hunter. Everything stays in Strava.')}</span>
        <button class="btn btn-gefahr btn-sm" disabled=${!!laeuft} onClick=${() => tu('trennen')}>${deEn('Trennen und löschen', 'Disconnect and delete')}</button></div>` : null}`
    : st && !offen ? html`
      <span class="muted" style="font-size:13px">${deEn('Für alle, die nur mit der Strava-App aufzeichnen. Strava gibt seine Schnittstelle nur mit Strava-Mitgliedschaft frei – du brauchst ein Abo und legst einmalig eine eigene „Strava-App“ an (ca. 3 Minuten).', 'For anyone who only records with the Strava app. Strava only opens its API with a Strava subscription – you need one and create your own “Strava app” once (about 3 minutes).')}</span>
      <button class="btn btn-soft btn-block" onClick=${() => setOffen(true)}>${st.eingerichtet ? deEn('Erneut verbinden', 'Connect again') : deEn('Strava einrichten', 'Set up Strava')}</button>`
    : st ? html`
      <ol class="iv-schritte sv-schritte">
        <li>${deEn('Strava-Mitgliedschaft (Abo) aktiv haben.', 'Have an active Strava subscription.')}</li>
        <li>${deEn('Am Computer oder im Browser ', 'On a computer or in the browser open ')}<a href="https://www.strava.com/settings/api" target="_blank" rel="noopener noreferrer">strava.com/settings/api</a>${deEn(' öffnen und eine Anwendung erstellen:', ' and create an application:')}
          <div class="sv-felder"><span>${deEn('Anwendungsname: z. B. „PR Hunter“ · Kategorie: Training · Beschreibung: beliebig', 'Application name: e.g. “PR Hunter” · Category: Training · Description: anything')}</span>
            ${kopierFeld(deEn('Website', 'Website'), appUrl)}${kopierFeld(deEn('Callback-Domain', 'Callback domain'), CALLBACK)}</div></li>
        <li>${deEn('Erstellen tippen. Danach zeigt Strava „Client ID“ (Zahl) und „Client Secret“ (anzeigen tippen).', 'Tap create. Strava then shows “Client ID” (a number) and “Client Secret” (tap show).')}</li>
        <li>${deEn('Beide hier eintragen und verbinden – Strava fragt dann nach der Freigabe.', 'Enter both here and connect – Strava then asks for permission.')}</li></ol>
      <div class="au-felder">
        <label class="field"><span class="label">Client ID</span><input class="text" inputmode="numeric" placeholder="123456" value=${cid} onInput=${(e) => setCid(e.currentTarget.value.trim())}/></label>
        <label class="field"><span class="label">Client Secret</span><input class="text" type="password" autocomplete="off" value=${geheim} onInput=${(e) => setGeheim(e.currentTarget.value.trim())}/></label></div>
      <button class="strava-knopf" disabled=${!!laeuft || !/^\d{3,10}$/.test(cid) || geheim.length < 20} onClick=${() => tu('start', { client_id: cid, client_secret: geheim, app_url: appUrl })}>${laeuft === 'start' ? '…' : deEn('Mit Strava verbinden', 'Connect with Strava')}</button>
      <span class="muted" style="font-size:12px">${deEn('Client Secret liegt nur auf dem Server und wird nie angezeigt. Strava-Daten siehst nur du.', 'The client secret is stored only on the server and never shown. Only you see Strava data.')}</span>
      <button class="link" style="align-self:flex-start" onClick=${() => setOffen(false)}>${deEn('Abbrechen', 'Cancel')}</button>`
    : html`<span class="muted">…</span>`}
    ${meldung ? html`<span class="muted" style="font-size:12.5px">${meldung}</span>` : null}
  </section>`;
}

/** Oben in „Kalender und Verbindungen“: welcher Weg passt? */
function WegeWahl() {
  return html`<section class="card pad stack wege">
    <span class="viz-t">${deEn('Läufe und Radfahrten automatisch', 'Runs and rides automatically')}</span>
    <div class="weg"><b>⌚ ${deEn('Mit Uhr oder Radcomputer', 'With a watch or bike computer')}</b><span>${deEn('Garmin, Wahoo, Polar, Coros, Suunto, Zwift → intervals.icu. Kostenlos.', 'Garmin, Wahoo, Polar, Coros, Suunto, Zwift → intervals.icu. Free.')}</span></div>
    <div class="weg"><b>📱 ${deEn('Nur mit der Strava-App', 'Only with the Strava app')}</b><span>${deEn('→ Strava. Braucht eine Strava-Mitgliedschaft.', '→ Strava. Needs a Strava subscription.')}</span></div>
  </section>`;
}

function KalenderAbo() {
  const [link, setLink] = useState(null);
  const [status, setStatus] = useState(null);
  const [geraet, setGeraet] = useState(() => (/iPhone|iPad/i.test(navigator.userAgent) ? 'iphone' : /Android/i.test(navigator.userAgent) ? 'android' : 'pc'));
  if (!DIENSTE.kalenderLink) return null;
  const holen = async (neu = false) => {
    setStatus('…');
    try { setLink(await DIENSTE.kalenderLink(neu)); setStatus(neu ? deEn('Neuer Link – der alte geht nicht mehr.', 'New link – the old one no longer works.') : null); }
    catch (e) { setStatus(e.message); }
  };
  return html`<div class="stack unterteil" style="gap:8px"><span class="eyebrow">Kalender-Abo</span>
    <span class="muted" style="font-size:12.5px">Deine Trainings im Handy-Kalender – aktualisiert sich von selbst. Wer den Link hat, sieht deine Trainingstage.</span>
    ${!link ? html`<button class="btn btn-soft btn-sm" style="justify-self:start" onClick=${() => holen()}>Abo-Link holen</button>`
      : html`<input class="text" type="text" readonly value=${link} onFocus=${(e) => e.currentTarget.select()} aria-label="Kalender-Link"/>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          <button class="btn btn-chalk btn-sm" onClick=${async () => setStatus((await kopiere(link)) ? deEn('Link kopiert ✓', 'Link copied ✓') : deEn('Kopieren gesperrt – Feld markieren und kopieren.', 'Copy blocked – select the field and copy.'))}>Link kopieren</button>
          <button class="btn btn-soft btn-sm" onClick=${() => holen(true)}>Neuer Link</button></div>
        ${status ? html`<span class="muted" style="font-size:12.5px">${status}</span>` : null}
        <div class="abo-anleitung">
          <div class="seg" role="group" aria-label="Gerät">${[['android', 'Android'], ['iphone', 'iPhone'], ['pc', 'PC / Outlook']].map(([k, n]) => html`<button key=${k} aria-pressed=${String(geraet === k)} onClick=${() => setGeraet(k)}>${n}</button>`)}</div>
          <ol>${ABO_ANLEITUNG[geraet].map((s, i) => html`<li key=${i}>${s}</li>`)}</ol>
          <span class="muted" style="font-size:12px">Wichtig: als Abo hinzufügen, nicht als Datei importieren – nur dann aktualisiert es sich (Google etwa alle 8–24 h).</span>
        </div>`}
    ${!link && status ? html`<span class="muted" style="font-size:12.5px">${status}</span>` : null}
  </div>`;
}
