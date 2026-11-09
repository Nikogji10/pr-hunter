// PR Hunter · App-Hülle: Anmeldung, lokale Daten (IndexedDB), Abgleich mit Supabase, Navigation.
// Alle melden sich an (Nikos Vorgabe 02.11.). Nur für lokale Rendertests: ?demo auf 127.0.0.1/localhost mit Beispieldaten –
// ui/beispiel.js steckt nicht im veröffentlichten Build (tools/app_bereitstellen.py, nur mit --test).
// Ein laufendes Training liegt sofort im Speicher des Handys und übersteht Neuladen und App-Wechsel.
import { html, render, useState, useEffect, useRef, useMemo, Component } from './vendor/htm-preact.js';
import { setzeKatalog, setzeAnzeige, katalogListe, deEn, fmt, gw, einheit, tonnage, mmss, uhr, I, LIFT, liftVon, nameVon, pauseVon, datumLang, datumKurz, wtKurz, speicher, tonFreigeben, useTakt, Avatar,
  PausenTimer, Sheet, incStandard, useZiehen, pausenFarbe, uebung, UebungsBild, koerperUebung, vibriere, BildLupe, FensterHost, UNTERREITER, UNTER_VORSCHAU, zurueckAbbrechen, ansichtEintragen, setzeAnsichtJetzt } from './ui/basis.js';
import { setzeStand, setzeDienste, heuteLokal, HEUTE, trainingsTage, e1rmWoche, KOERPERGEWICHT, E1RM_AKTUELL, E1RM_QUELLE } from './ui/stand.js';
import { Gruss } from './ui/gruss.js';
import { SeitenMenue, MenueKnopf, useWischen } from './ui/menue.js';
import { GlossarSheet } from './ui/glossar.js';
import { TrainingsImport, ImportHinweis, importHinweisOffen } from './ui/trainingsimport.js';
import { GewichtImport } from './ui/gewichtimport.js';
import { FeedbackSheet, Datenschutz, kalenderDatei, herunterladen, NeueVersion } from './ui/hilfe.js';
import { trainingsSchluessel } from './js/import.js';
import { Training, baueTraining, alleSaetze, kartenAusStand, beschwerdenAnwenden, ausruestungUebernehmen } from './ui/training.js';
import { Programme, INFO, NAMEN, blockTage, wochenListe, kurzTitel } from './ui/programme.js';
import { Verlauf, TagSheet } from './ui/verlauf.js';
import { UebungsSeite, UebungFormular } from './ui/uebung.js';
import { Einstellungen } from './ui/einstellungen.js';
import { Statistik } from './ui/statistik.js';
import { Rechner } from './ui/rechner.js';
import { Feed } from './ui/feed.js';
import { Einfuehrung, einfuehrungOffen } from './ui/einfuehrung.js';
import { Abschluss, abschlussAus } from './ui/abschluss.js';
import { BereitschaftSheet } from './ui/bereitschaft.js';
import { LangeOffenSheet, langeOffen } from './ui/langeoffen.js';
import { GewichtKarte } from './ui/gewicht.js';
import { ladeHintergrund, hintergrundAbgleichen as hgAbgleichen, setzeAbdunklung } from './ui/hintergrund.js';
import { setzeSprache } from './ui/sprache.js';
import * as mitteilung from './ui/mitteilung.js';
import { KG_PRO_LB } from './js/rechnen.js';
import { erstelleStand, plusTage, tageZwischen, HAUPT, montagVon } from './js/daten.js';
import { sollIst, neueMaxe, tageMitOptionen } from './js/block.js';
import { projiziere } from './js/programm.js';
import { ausTraining, zuTraining, abgleichen, neueId, setzeUmbenannt } from './js/sync.js';
import { speicherFuer, dauerhaft } from './js/lokal.js';
import { supabase, codeSenden, codePruefen, sitzung, abmelden, emailAendern } from './js/supabase.js';
import * as konto from './js/konto.js';
import { normiere, wochenSerie } from './js/insights.js';
import { erfolge, neueAbzeichen } from './js/erfolge.js';
import { standVon } from './ui/zusammen.js';
import { SUPABASE_URL } from './js/supabase.js';
import { autoregulation } from './js/autoregulation.js';
import { useAnsagen } from './ui/ansage.js';
import { WettkampfCountdown } from './ui/wettkampf.js';
import { ErholungKurz } from './ui/koerper.js';
import { Rueckblick, RueckblickKarte } from './ui/rueckblick.js';
import { GeschlechtKarte, ZyklusChip, geschlechtAusName } from './ui/zyklus.js';
import { BeschwerdeSheet, BeschwerdeHinweis } from './ui/beschwerde.js';
import { CoachSeite } from './ui/coach.js';
import { KiKachel } from './ui/ki.js';
import { AusdauerKarte, AusdauerListe } from './ui/ausdauer.js';
import { alsEintrag, aktuellerPlan, wochentag } from './js/ausdauerplan.js';
import { hatKraft } from './js/kombiplan.js';
import { erholungsEintraege, sichtbar } from './js/ausdauer.js';
import { anpassungFuer, REGIONEN } from './js/beschwerden.js';
import { chipsAus } from './js/notizchips.js';
import { rueckblick as rueckblickAus } from './js/rueckblick.js';

const DEMO = new URLSearchParams(location.search).has('demo') && ['127.0.0.1', 'localhost'].includes(location.hostname);
const VORLAGEN = ['pr_hybrid_candito_pana', 'candito_int_adv_bench', 'candito_6_week'];
const { STANDARD_EINSTELLUNGEN } = konto;
// Rechner und Timer liegen seit 172 im Seitenmenü (☰ oder Wischen vom linken Rand)
const TABS = [['heute', 'Heute'], ['programme', 'Programme'], ['verlauf', 'Verlauf'], ['feed', 'Feed'], ['statistik', 'Statistik']];
const PAUSE_HINWEIS_TAGE = 10;          // ab so vielen Tagen ohne Training: vorsichtig einsteigen (Verletzungen nach Urlaub)
const ABGLEICH_ALLE_MS = 5 * 60 * 1000;
const liftsDes = (tag) => [...new Set(tag.uebungen.map((u) => liftVon(u.key)).filter((l) => l !== 'andere'))];

// #################################################################
// Navigation über die Browser-Historie: jede Ansicht ist ein Eintrag mit Adresse (#statistik, #uebung/<key>).
// Zurück bleibt in der App (auf der ersten Ansicht passiert nichts), Neuladen öffnet dieselbe Ansicht an derselben Stelle.
// #################################################################
const ANSICHTEN = new Set(['heute', 'programme', 'verlauf', 'feed', 'statistik', 'rechner', 'einstellungen', 'training', 'uebung', 'import', 'gewicht', 'datenschutz', 'coach']);
function ausAdresse() {
  const [a, key] = decodeURIComponent(location.hash.slice(1)).split('/');
  return ANSICHTEN.has(a) && (a !== 'uebung' || key) ? { ansicht: a, key: key || null } : { ansicht: 'heute', key: null };
}
const coachZahl = (r) => (r ?? []).filter((x) => x.rolle === 'coach' && x.status === 'angefragt').length;   // 214
const adresse = (a, key) => `#${a}${key ? `/${encodeURIComponent(key)}` : ''}`;

if (DEMO) setzeStand((await import('./ui/beispiel.js')).beispielStand());

/** Fehlergrenze um die Seite: ein Fehler beim Zeichnen (z. B. 02.11. im Bodybuilding-Generator) friert sonst die
 *  ganze App ein. Stattdessen Hinweis mit Neu laden; mit key=Ansicht beginnt jede Seite wieder ohne Fehler. */
class Fehlergrenze extends Component {
  componentDidCatch(fehler) { console.error(fehler); this.setState({ fehler }); }
  render() {
    if (!this.state.fehler) return this.props.children;
    return html`<div class="screen"><section class="card pad stack" style="margin-top:16px">
      <h2 class="h2">Hier ist etwas schiefgegangen</h2>
      <p class="muted" style="margin:0">${`Die Seite konnte nicht angezeigt werden (${this.state.fehler.message ?? this.state.fehler}). Deine Daten sind sicher.`}</p>
      <button class="btn btn-chalk btn-block" onClick=${() => location.reload()}>Neu laden</button>
      <button class="btn btn-soft btn-block" onClick=${() => { try { for (const k of Object.keys(sessionStorage)) if (k.startsWith('prh-gen-')) sessionStorage.removeItem(k); } catch { /* egal */ } location.reload(); }}>Eingaben zurücksetzen und neu laden</button>
    </section></div>`;
  }
}

/** Schriftgröße: skaliert die ganze Oberfläche (0,9 … 1,2). */
const schrift = (z) => document.documentElement.style.setProperty('--zoom', String(z > 0.5 && z < 2 ? z : 1));
const deckkraft = (d) => {
  const wert = d >= 0 && d <= 1 ? d : 0.88;
  // Kurve: der Regler bleibt über einen großen Bereich durchscheinend, voll deckend erst gegen 100 %
  document.documentElement.style.setProperty('--deckkraft', String(wert * wert));
  document.documentElement.classList.toggle('durchsichtig', wert === 0);     // 0 %: Kacheln ganz ohne Fläche, Unschärfe und Schatten
};
// iOS ignoriert user-scalable=no: Zwei-Finger-Zoom hier abfangen
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchstart', () => {}, { passive: true });   // iOS zeigt :active sonst nicht (Druckgefühl)
// Hinweise sind eingeklappt (nur die Überschrift); Tippen klappt den Text auf. Rückfragen (role) und .immer bleiben offen.
document.addEventListener('click', (e) => {
  const h = e.target.closest?.('.hint:not([role]):not(.immer)');
  if (h && !e.target.closest('button, a, input, label, textarea')) h.classList.toggle('offen');
});

/** Design anwenden: system = dem Gerät folgen (kein Attribut), sonst hell/dunkel fest. */
function thema(wert) {
  const el = document.documentElement;
  if (wert === 'light' || wert === 'dark') el.dataset.theme = wert; else delete el.dataset.theme;
}
/** Farbwelt (Eisen = Standard, ohne Attribut) und Schriftart (Archivo = Standard); index.html setzt beides schon vor dem Laden. */
const STILE = new Set(['kobalt', 'glut', 'volt', 'amethyst', 'graphit']), SCHRIFTEN = new Set(['saira', 'encode', 'system']);
function stilSetzen(wert) { const el = document.documentElement; if (STILE.has(wert)) el.dataset.stil = wert; else delete el.dataset.stil; }
function schriftSetzen(wert) { const el = document.documentElement; if (SCHRIFTEN.has(wert)) el.dataset.schrift = wert; else delete el.dataset.schrift; }

// #################################################################
// Anmeldung per Code aus der E-Mail
// #################################################################
function Anmeldung({ angemeldet, zurueck = null }) {
  const [email, setEmail] = useState(() => speicher.lies('prh-email') ?? '');
  const [schritt, setSchritt] = useState('email');
  const [code, setCode] = useState('');
  const [fehler, setFehler] = useState(null);
  const [laeuft, setLaeuft] = useState(false);
  const senden = async (e) => {
    e?.preventDefault(); setFehler(null); setLaeuft(true);
    try { await codeSenden(email); speicher.schreib('prh-email', email.trim()); setSchritt('code'); setCode(''); }
    catch (x) { setFehler(x.message); } finally { setLaeuft(false); }
  };
  const pruefen = async (e) => {
    e?.preventDefault(); setFehler(null); setLaeuft(true);
    try { await angemeldet(await codePruefen(email, code)); }
    catch (x) { setFehler(x.message); setLaeuft(false); }
  };
  return html`<main class="anmeldung">
    <span class="logo"><b>PR</b> Hunter</span>
    <p class="muted" style="margin:0">Programme, Sätze und Rekorde – auf dem Handy, auch ohne Netz im Keller. Anmeldung mit einem Code per E-Mail, kein Passwort.</p>
    ${schritt === 'email' ? html`<form class="card pad stack" onSubmit=${senden}>
        <label class="field" for="a-email"><span class="label">E-Mail</span>
          <input id="a-email" type="email" autocomplete="email" inputmode="email" required value=${email} onInput=${(e) => setEmail(e.currentTarget.value)}/></label>
        <button class="btn btn-chalk btn-block" disabled=${laeuft || !/\S+@\S+\.\S+/.test(email)}>${laeuft ? 'Sende …' : 'Code senden'}</button>
      </form>`
    : html`<form class="card pad stack" onSubmit=${pruefen}>
        <p style="margin:0">Code an <b>${email}</b> geschickt. Nichts angekommen? Spam-Ordner prüfen.</p>
        <label class="field" for="a-code"><span class="label">Code aus der E-Mail</span>
          <input id="a-code" class="code-feld" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" value=${code}
            onInput=${(e) => setCode(e.currentTarget.value.replace(/\D/g, ''))}/></label>
        <button class="btn btn-chalk btn-block" disabled=${laeuft || code.length < 6}>${laeuft ? 'Prüfe …' : 'Anmelden'}</button>
        <div class="row between"><button type="button" class="link" onClick=${() => { setSchritt('email'); setFehler(null); }}>Andere E-Mail</button>
          <button type="button" class="link" disabled=${laeuft} onClick=${senden}>Code neu senden</button></div>
      </form>`}
    ${fehler ? html`<p class="fehler" role="alert">${fehler}</p>` : null}
    ${zurueck ? html`<button class="link" style="justify-self:start" onClick=${zurueck}>Zurück zur App</button>` : null}
  </main>`;
}

// #################################################################
// Heute: aktueller Block, nächstes Training, Woche, Maxe
// #################################################################
function SyncPunkt({ sync, offen }) {
  if (DEMO) return html`<span class="proto">Demo</span>`;
  const online = navigator.onLine;
  const [art, text] = sync.laeuft ? ['laeuft', 'Abgleich …'] : !online ? ['aus', offen ? `offline · ${offen} offen` : 'offline']
    : offen || sync.fehler ? ['offen', offen ? `${offen} nicht hochgeladen` : 'Abgleich fehlgeschlagen'] : ['', 'gesichert'];
  return html`<span class=${`sync ${art}`} role="status"><i></i>${text}</span>`;
}

/** Wochen des Blocks und die Woche des nächsten offenen Plantags (1-basiert). */
function blockStand(tage, erledigt) {
  const wochen = wochenListe(tage);
  const naechster = tage.find((t) => t.datum >= HEUTE && !erledigt.has(t.datum) && !t.uebersprungen);
  return { wochen, akt: naechster ? wochen.indexOf(naechster.woche) + 1 : wochen.length };
}

/** Plan des Blocks auf Heute: Woche wählen, Tage mit Lifts und Stand; Tippen öffnet den Tag. */
function PlanAnsicht({ tage, erledigt, wochen, akt, prog, oeffne }) {
  const [w, setW] = useState(akt || 1);
  const woche = wochen[w - 1];
  const tageDerWoche = tage.filter((t) => t.woche === woche);
  return html`<section class="card pad stack plan-ansicht">
    <div class="filter einreihig" role="group" aria-label="Woche">${wochen.map((_, i) => html`<button key=${i} class="chip" aria-pressed=${String(w === i + 1)} onClick=${() => setW(i + 1)}>W${i + 1}</button>`)}</div>
    <span class="muted" style="font-size:12.5px">${kurzTitel(prog.weeks.find((x) => x.week === woche)?.title) || `Woche ${w}`}</span>
    <div>${tageDerWoche.map((t) => html`<button key=${t.offset} class=${`plan-tag ${t.datum === HEUTE ? 'heute' : ''}`} onClick=${() => oeffne(t.datum)}>
      <span class="pt-datum"><b>${wtKurz(t.datum)}</b> ${datumKurz(t.datum)}</span>
      <span class="pt-lifts">${liftsDes(t).map((l) => html`<i key=${l} style=${`background:${LIFT[l].farbe}`}></i>`)}<span>${liftsDes(t).map((l) => LIFT[l].name).join(' · ') || 'Zubehör'}</span></span>
      <span class="pt-stand">${erledigt.has(t.datum) ? '✓' : t.uebersprungen ? '–' : t.datum === HEUTE ? 'heute' : ''}</span>
    </button>`)}</div>
  </section>`;
}

/** 171: anderen Trainingstag wählen – Woche + Tag (Powerlifting/Bodybuilding) oder nur Tag (eigener Plan); heute geplant ist markiert. */
function TagWechselSheet({ tage, erledigt, wochen, akt, prog, einfach, starten, zu }) {
  const [w, setW] = useState(akt || 1);
  const woche = wochen[w - 1];
  const liste = tage.filter((t) => t.woche === woche);
  return html`<${Sheet} zu=${zu} label="Trainingstag wechseln">
    <span class="eyebrow">Trainingstag wechseln</span>
    <h2 class="h2" style="margin:0">${einfach ? 'Welchen Tag trainierst du heute?' : 'Welche Einheit trainierst du heute?'}</h2>
    <p class="muted" style="margin:0;font-size:13px">Die gewählte Einheit wird heute trainiert und im Plan abgehakt. Geplant für heute ist mit „heute“ markiert.</p>
    ${einfach ? null : html`<div class="filter einreihig" role="group" aria-label="Woche">${wochen.map((_, i) => html`<button key=${i} class="chip" aria-pressed=${String(w === i + 1)} onClick=${() => setW(i + 1)}>W${i + 1}</button>`)}</div>
      <span class="muted" style="font-size:12.5px">${kurzTitel(prog.weeks.find((x) => x.week === woche)?.title) || `Woche ${w}`}</span>`}
    <div class="wechsel-liste">${liste.map((t) => {
      const fertig = erledigt.has(t.datum), heute = t.datum === HEUTE;
      // Namen der Tage nur bei eigenen/Bodybuilding-Plänen (Powerlifting-Vorlagen haben englische Quell-Labels)
      const name = (prog.kategorie && prog.kategorie !== 'powerlifting' && t.label) || liftsDes(t).map((l) => LIFT[l].name).join(' · ') || t.label || 'Zubehör';
      return html`<button key=${t.offset} class=${`wechsel-tag ${heute ? 'heute' : ''}`} disabled=${fertig || t.uebersprungen} onClick=${() => { zu(); starten(t); }}>
        <span class="wt-datum"><b>${wtKurz(t.datum)}</b><small>${datumKurz(t.datum)}</small></span>
        <span class="wt-text"><b>${name}</b><small>${t.uebungen.length === 1 ? '1 Übung' : `${t.uebungen.length} Übungen`}</small></span>
        <span class=${`wt-stand ${heute ? 'heute' : ''}`}>${fertig ? '✓' : t.uebersprungen ? '–' : heute ? 'heute' : '›'}</span></button>`;
    })}</div>
  <//>`;
}

/** 151: beim ersten Start die Trainingsart wählen (später in Einstellungen → Training). */
function TrainingsartKarte({ waehle }) {
  return html`<section class="card pad stack trainingsart-karte">
    <b>Wie trainierst du?</b>
    <span class="muted" style="font-size:13px">Damit die App nur zeigt, was du brauchst. Später in Einstellungen → Training umstellbar.</span>
    <div class="neu-wege">
      <button class="weg-karte" onClick=${() => waehle('einfach')}><span class="tag gut">Einfach</span><b>Bodybuilding / Krafttraining</b>
        <span>Muskelaufbau und fit werden: klare Vorschläge fürs nächste Mal, weniger Zahlen.</span></button>
      <button class="weg-karte" onClick=${() => waehle('powerlifting')}><span class="tag">Alles</span><b>Powerlifting</b>
        <span>Kniebeuge, Bank, Kreuzheben: Trainingsmax, e1RM, Kraftprofil, Wettkampf-Werkzeuge.</span></button>
    </div>
  </section>`;
}

/** 163 i: Wochenziel; Serie wie in der Analyse: Wochen in Folge mit mindestens einem Training (gleiche Zahl auf beiden Seiten). */

/** 173: einmal nach dem Vornamen fragen (für „Guten Morgen, …“); „Später“ fragt erst morgen wieder. */
function VornameKarte({ speichern }) {
  const [v, setV] = useState('');
  const [weg, setWeg] = useState(false);
  if (weg) return null;
  return html`<section class="card pad stack vorname-karte">
    <b>Wie heißt du?</b>
    <span class="muted" style="font-size:13px">Dein Vorname für die Begrüßung – steht später in Einstellungen → Konto.</span>
    <div class="row" style="gap:8px"><input class="text" style="flex:1" type="text" autocomplete="given-name" placeholder="Vorname" value=${v} onInput=${(e) => setV(e.currentTarget.value)}
      onKeyDown=${(e) => { if (e.key === 'Enter' && v.trim()) speichern(v.trim()); }}/>
      <button class="btn btn-chalk" disabled=${!v.trim()} onClick=${() => speichern(v.trim())}>Speichern</button></div>
    <button class="link" style="justify-self:start" onClick=${() => { speicher.schreib('prh-vorname-spaeter', HEUTE); setWeg(true); }}>Später</button>
  </section>`;
}

/** 172: Kraftwerte als Liste ganz unten (statt Kacheln): Trainingsmax des Blocks, darunter e1RM und aus welchem Satz (170). */
function MaxListe({ werte, zuUebung }) {
  const zeilen = [['squat', 'S'], ['bench', 'B'], ['dead', 'D']].map(([l, k]) => ({ l, tm: werte?.[k] > 0 ? werte[k] : null, e1rm: E1RM_AKTUELL[HAUPT[l]] ?? null, q: E1RM_QUELLE[HAUPT[l]]?.aktuell }))
    .filter((z) => z.tm || z.e1rm);
  if (!zeilen.length) return null;
  return html`<section class="card max-liste">
    <div class="ml-kopf"><span class="viz-t">${zeilen.some((z) => z.tm) ? 'Trainingsmax' : 'Aktuelle Maxe'}</span><span class="muted">e1RM aus dem besten Satz der letzten 12 Wochen</span></div>
    ${zeilen.map((z) => html`<button key=${z.l} class="ml-zeile" style=${`--c:${LIFT[z.l].farbe}`} onClick=${() => zuUebung(HAUPT[z.l])}>
      <span class="ml-icon"><${UebungsBild} schluessel=${HAUPT[z.l]} groesse=${30}/></span>
      <span class="ml-text"><b>${LIFT[z.l].name}</b>${z.e1rm ? html`<small>${`e1RM ${gw(z.e1rm)} ${einheit()}`}${z.q?.satz ? ` · ${gw(z.q.satz.kg)} × ${z.q.satz.wdh}${z.q.satz.rpe != null ? ` @ ${fmt(z.q.satz.rpe)}` : ''} · ${datumKurz(z.q.datum)}` : ''}</small>` : null}</span>
      <span class="ml-wert zahl">${gw(z.tm ?? z.e1rm)}<small> ${einheit()}</small></span><span class="ml-pfeil">›</span></button>`)}
  </section>`;
}

function Heute({ ausdauer = [], ausdauerPlan = null, ausdauerSpeichern = null, ausdauerLoeschen = null, geplantEintragen = null, beschwerdeMelden = null, beschwerdeErledigt = null, zuStatistik = null, trainings = [], block, prog, tage, erledigt, leichter, setLeichter, training, starten, freiStarten, fortsetzen, einst, setEinst, sync, offen, zuEinstellungen, zuProgrammen, tagOption,
  startenAm, bearbeiten, loeschen, wiederholen = null, zuUebung, menueAuf, zuImport = null }) {
  const [sheet, setSheet] = useState(null);             // 'verschieben' | 'ueberspringen'
  const [mitRest, setMitRest] = useState(true);         // Verschieben: restlichen Block mitnehmen
  const [planOffen, setPlanOffen] = useState(false);
  const [tagOffen, setTagOffen] = useState(null);       // Datum aus „Plan ansehen“
  const stand = block ? blockStand(tage, erledigt) : null;
  // 172/173: Kopf wie Vorlage 6 (☰ · Logo · Profil), darunter Begrüßung mit Spruch des Tages
  const planHeute = block ? tage.some((t) => t.datum === HEUTE && !t.uebersprungen) : null;
  const kopf = html`<header class="kopf6">
    <${MenueKnopf} auf=${menueAuf}/>
    <span class="logo logo6"><b>PR</b> Hunter</span>
    <div class="row kopf6-rechts"><${SyncPunkt} sync=${sync} offen=${offen}/>
      <button class="profil-knopf" onClick=${zuEinstellungen} aria-label="Profil und Einstellungen"><${Avatar} bild=${einst.avatar} name=${einst.name} groesse=${34}/></button></div>
  </header>
  <${Gruss} vorname=${einst.vorname} art=${einst.trainingsart} datum=${HEUTE} trainingstag=${planHeute && !erledigt.has(HEUTE) ? true : planHeute === false ? false : null}/>
  ${!einst.vorname && !DEMO && speicher.lies('prh-vorname-spaeter') !== HEUTE ? html`<${VornameKarte} speichern=${(v) => setEinst({ ...einst, vorname: v })}/>` : null}
  ${!einst.trainingsart && !DEMO ? html`<${TrainingsartKarte} waehle=${(v) => setEinst({ ...einst, trainingsart: v })}/>` : null}
  ${!einst.geschlecht && einst.vorname && !DEMO ? html`<${GeschlechtKarte} setzen=${(g) => setEinst({ ...einst, geschlecht: g })}/>` : null}
  <${ZyklusChip} einst=${einst}/>
  ${beschwerdeErledigt ? html`<${BeschwerdeHinweis} liste=${einst.beschwerden} erledigt=${beschwerdeErledigt}/>` : null}
  ${zuImport && !Object.keys(trainingsTage).length && importHinweisOffen() ? html`<${ImportHinweis} oeffnen=${zuImport}/>` : null}
  ${(() => {   // 206: Hinweis auf den Jahresrückblick in den letzten zwei Dezemberwochen (ab 18.12.), einmalig
    const jahr = HEUTE.slice(0, 4), weg = `prh-rueckblick-weg-${jahr}`;
    if (HEUTE.slice(5, 7) !== '12' || Number(HEUTE.slice(8)) < 18 || speicher.lies(weg) || trainings.filter((t) => !t.geloescht && t.datum.startsWith(jahr)).length < 3) return null;
    return html`<${RueckblickKarte} jahr=${jahr} oeffnen=${() => dispatchEvent(new CustomEvent('prh-rueckblick', { detail: { jahr: Number(jahr) } }))}
      weg=${() => { speicher.schreib(weg, '1'); setEinst({ ...einst }); }}/>`;
  })()}
  <${WettkampfCountdown} einst=${einst} e1rmWoche=${e1rmWoche} koerperKg=${einst.koerpergewicht ?? KOERPERGEWICHT} heute=${HEUTE}/>
  ${!training ? html`<${ErholungKurz} trainings=${trainings} oeffnen=${zuStatistik} ausdauer=${einst.ausdauer ? erholungsEintraege(sichtbar(ausdauer, einst.ausdauer), Date.now()) : []}/>` : null}`;
  const gewicht = html`<${GewichtKarte} einst=${einst} setEinst=${setEinst} kompakt=${true}/><${KiKachel} trainings=${trainings} einst=${einst} block=${block} prog=${prog} ausdauer=${ausdauer}/>${einst.ausdauer && ausdauerSpeichern ? html`<${AusdauerKarte} liste=${ausdauer} wahl=${einst.ausdauer} speichern=${ausdauerSpeichern} loeschen=${ausdauerLoeschen} plan=${ausdauerPlan} eintragenGeplant=${geplantEintragen}/>` : null}`;
  const maxe = einst.trainingsart !== 'einfach' && einst.sbdHeute !== false && (!block || (prog?.kategorie ?? 'powerlifting') === 'powerlifting') ? html`<${MaxListe} werte=${block?.werte} zuUebung=${zuUebung}/>` : null;
  const letztes = Object.keys(trainingsTage).filter((d) => d < HEUTE).sort().at(-1);
  const ohnePlan = html`<button class="btn btn-soft btn-block" onClick=${training ? fortsetzen : freiStarten}>${training?.bearbeiten ? 'Bearbeitung fortsetzen'
    : training && !training.planDatum ? 'Freies Training fortsetzen' : 'Ohne Plan trainieren'}</button>`;
  if (!block) {
    const t = letztes ? trainingsTage[letztes] : null;
    return html`<div class="screen">${kopf}${gewicht}
      <section class="card pad stack wichtig"><h2 class="h2">${einst.trainingsart === 'einfach' ? 'Noch kein Plan' : 'Kein aktiver Block'}</h2>
        <p class="muted" style="margin:0">${einst.trainingsart === 'einfach' ? 'Einsteigerplan mit einem Tipp oder eigenen Plan in einer Minute – dann steht hier jeden Tag dein Training.'
          : 'Starte eine Vorlage mit deinen Maxen, dann steht hier jeden Tag dein Training. Oder trainiere frei und wähle die Übungen selbst.'}</p>
        <button class="btn btn-chalk btn-block" onClick=${zuProgrammen}>${einst.trainingsart === 'einfach' ? 'Plan in 1 Minute' : 'Programm wählen'}</button>
        ${ohnePlan}</section>
      ${t ? html`<section class="card pad stack"><span class="eyebrow">Zuletzt trainiert · ${datumLang(letztes)}</span>
        <div class="row between"><b>${t.lifts.map((l) => LIFT[l].name).join(' · ') || 'Zubehör'}</b><span class="muted">${tonnage(t.tonnage)}</span></div></section>` : null}
      ${maxe}
    </div>`;
  }
  const offenerTag = (t) => !erledigt.has(t.datum) && !t.uebersprungen;
  const heute = tage.find((t) => t.datum === HEUTE && offenerTag(t));
  const tag = heute ?? tage.find((t) => t.datum > HEUTE && offenerTag(t));
  // Verschieben auf einen der nächsten 7 Tage, an dem kein anderer Plantag liegt
  const frei = (d) => !tage.some((t) => t.datum === d && t.offset !== tag?.offset && !t.uebersprungen);
  // Ganzer Rest: jeder der nächsten 21 Tage; nur dieser Tag: nur Tage ohne anderen Plantag (nächste 14)
  const ziele = !tag ? [] : mitRest ? Array.from({ length: 21 }, (_, i) => plusTage(HEUTE, i)).filter((d) => d !== tag.datum)
    : Array.from({ length: 14 }, (_, i) => plusTage(HEUTE, i)).filter((d) => d !== tag.datum && frei(d));
  const { wochen } = stand;
  const akt = tag ? wochen.indexOf(tag.woche) + 1 : wochen.length;
  const wochenTitel = kurzTitel(prog.weeks.find((w) => w.week === (tag?.woche ?? wochen.at(-1)))?.title);
  // Läuft das Training dieses Tages schon, zeigt der Plan dessen Stand (z. B. gewählte Zusatzübungen)
  const karten = !tag ? [] : training?.planDatum === tag.datum ? training.karten
    : baueTraining(tag, { leichter: tag.datum === HEUTE && leichter, koerperKg: einst.koerpergewicht });
  const pause = letztes ? tageZwischen(letztes, HEUTE) : null;
  // Dauer grob: je Satz 45 s Arbeit plus die Pause aus den Einstellungen, ohne Aufwärmen
  const minuten = Math.round(karten.reduce((a, k) => a + k.gruppen.reduce((b, g) => b + g.saetze.length * (45 + pauseVon(k.key, g.rolle, einst.pausen)), 0), 0) / 60 / 5) * 5;
  return html`<div class="screen">
    ${kopf}
    ${gewicht}
    ${/* SBD-Maxe nur bei einem Powerlifting-Programm (Bodybuilding/eigene Pläne haben keine Maxe) und wenn nicht abgeschaltet */ ''}
    <div class="heute-trenner" aria-hidden="true"><i></i></div>
    ${planOffen ? html`<${PlanAnsicht} tage=${tage} erledigt=${erledigt} wochen=${wochen} akt=${akt} prog=${prog} oeffne=${setTagOffen}/>` : null}

    ${tag?.datum === HEUTE && !erledigt.has(HEUTE) && !training && pause >= PAUSE_HINWEIS_TAGE ? html`<section class="hint" aria-live="polite">${I.warn}
      <span class="t">Erste Einheit nach ${pause} Tagen Pause</span><span></span>
      <p>Top-Satz höchstens RPE 7. Fühlt sich das Aufwärmen schwer an: 5–10 % weniger und den letzten Back-off weglassen.</p>
      <span></span><div class="row wrap" style="margin-top:6px"><button class="chip" aria-pressed=${String(leichter)} onClick=${() => setLeichter(!leichter)}>${leichter ? '✓ Heute 5 % leichter' : 'Heute 5 % leichter'}</button></div>
    </section>` : null}

    ${tag ? html`<section class="card pad stack heute-plan wichtig">
      <div class="row between" style="align-items:flex-start"><span class="eyebrow">${tag.datum === HEUTE ? 'Heute' : 'Nächstes Training'} · ${datumLang(tag.datum)}</span><span class="muted" style="font-size:13px;white-space:nowrap">ca. ${minuten} min</span></div>
      <div class="block-zeile">
        <div style="min-width:0"><b class="block-name">${INFO[block.datei].kurz}</b>
          <div class="muted block-woche"><span>${`Woche ${akt}/${wochen.length}`}</span>${wochenTitel ? html`${' · '}<span>${wochenTitel}</span>` : ''}${einst.cut ? ' · Cut' : ''}</div></div>
        <div class="row" style="gap:6px;flex:none"><button class="chip" aria-expanded=${String(planOffen)} onClick=${() => setPlanOffen(!planOffen)}>${planOffen ? 'Plan zu' : 'Plan'}</button>
          <button class="chip" onClick=${zuProgrammen}>Block ›</button></div>
      </div>
      <h2 class="h2">${liftsDes(tag).map((l) => LIFT[l].name).join(' · ') || 'Zubehör'}</h2>
      <div>${karten.map((k) => {
        const g0 = k.gruppen[0], lift = liftVon(k.key);
        return html`<button class="plan-item" key=${k.id} disabled=${!k.key} onClick=${() => k.key && zuUebung(k.key)}>
          <span class="stripe" style=${`background:${LIFT[lift].farbe}`}></span>
          <span class="plan-bild">${k.key ? html`<${UebungsBild} schluessel=${k.key} groesse=${32}/>` : null}</span>
          <div style="min-width:0"><div class="name">${k.slot ? k.slot.label : nameVon(k.key)}</div>
            <div class="sets">${k.gruppen.map((g) => `${g.saetze.length} × ${g.wdhText}`).join(' + ')}${g0.rpe ? ` · ${g0.rpe.text ?? (g0.rpe.min === g0.rpe.max ? `RPE ${fmt(g0.rpe.min)}` : `RPE ${fmt(g0.rpe.min)}–${fmt(g0.rpe.max)}`)}` : ''}${k.gruppen.some((g) => g.gekuerzt) ? ' · Cut' : ''}</div></div>
          <div class="kg">${k.slot ? html`<span class="muted" style="font-size:14px;font-stretch:100%;font-weight:600">wählen</span>` : html`${gw(g0.saetze[0].kg)}<small>${einheit()}</small>`}</div>
        </button>`;
      })}</div>
      ${training?.planDatum === tag.datum ? html`<button class="btn btn-go btn-block modern" onClick=${fortsetzen}>Training fortsetzen</button>`
        : html`<button class="btn btn-go btn-block modern" onClick=${() => starten(tag)}>${tag.datum === HEUTE ? 'Training starten' : 'Vorziehen und starten'}</button>`}
      <div class="heute-knoepfe modern">${tagOption && training?.planDatum !== tag.datum ? html`<button class="btn btn-soft btn-sm" onClick=${() => setSheet('verschieben')}>Verschieben</button>
        <button class="btn btn-soft btn-sm" onClick=${() => setSheet('ueberspringen')}>Überspringen</button>` : null}
        <button class="btn btn-soft btn-sm" onClick=${training ? fortsetzen : freiStarten}>${training?.bearbeiten ? 'Bearbeitung fortsetzen'
          : training && !training.planDatum ? 'Frei fortsetzen' : 'Ohne Plan'}</button></div>
      ${tagOption && training?.planDatum !== tag.datum ? html`<button class="tag-wechsel" onClick=${() => setSheet('wechseln')}>${I.tausch}<span>Anderen Trainingstag wählen</span><span class="ml-pfeil">›</span></button>` : null}
      ${beschwerdeMelden ? html`<button class="tag-wechsel" onClick=${beschwerdeMelden}><span aria-hidden="true">🩹</span><span>${deEn('Beschwerden? Plan anpassen', 'Discomfort? Adjust plan')}</span><span class="ml-pfeil">›</span></button>` : null}
      ${tag.verschoben ? html`<span class="muted" style="font-size:13px">Verschoben – ursprünglich am ${datumKurz(plusTage(block.start, tag.offset))}.</span>` : null}
    </section>` : html`<section class="card pad"><h2 class="h2">Block geschafft</h2><p class="muted" style="margin:6px 0 0">Alle Einheiten erledigt. Zeit für Test oder neuen Block.</p></section>`}
    ${tag ? null : html`${ohnePlan}<button class="btn btn-soft btn-block" onClick=${() => setPlanOffen(!planOffen)}>${planOffen ? 'Plan schließen' : 'Plan ansehen'}</button>`}
    ${tagOffen ? html`<${TagSheet} d=${tagOffen} plan=${tage.find((x) => x.datum === tagOffen)} erledigt=${erledigt.has(tagOffen)} zu=${() => setTagOffen(null)}
      startenAm=${training ? null : startenAm} bearbeiten=${bearbeiten} loeschen=${loeschen} wiederholen=${wiederholen} zuUebung=${zuUebung}/>` : null}
    ${sheet === 'wechseln' ? html`<${TagWechselSheet} tage=${tage} erledigt=${erledigt} wochen=${wochen} akt=${akt} prog=${prog} einfach=${prog.kategorie === 'eigen'}
      starten=${starten} zu=${() => setSheet(null)}/>` : null}
    ${sheet === 'verschieben' && tag ? html`<${Sheet} zu=${() => setSheet(null)} label="Training verschieben">
      <h2 class="h2">Training verschieben</h2>
      <label class="schalter" for="v-rest"><span>Restlichen Block mitverschieben</span>
        <input type="checkbox" id="v-rest" checked=${mitRest} onChange=${(e) => setMitRest(e.currentTarget.checked)}/></label>
      <p class="muted" style="margin:0;font-size:13px">${mitRest ? `${datumLang(tag.datum)} und alle folgenden Einheiten rücken um denselben Abstand.` : `Nur ${datumLang(tag.datum)} wandert, der Rest bleibt.`}</p>
      <div class="filter">${ziele.map((d) => html`<button key=${d} class="chip" onClick=${() => { tagOption(tag.offset, { datum: d, rest: mitRest }); setSheet(null); }}>${wtKurz(d)} ${datumKurz(d)}</button>`)}</div>
      ${tag.verschoben ? html`<button class="btn btn-soft btn-block" onClick=${() => { tagOption(tag.offset, { datum: null }); setSheet(null); }}>Zurück auf den ${datumKurz(plusTage(block.start, tag.offset))}</button>` : null}
    <//>` : null}
    ${sheet === 'ueberspringen' && tag ? html`<${Sheet} zu=${() => setSheet(null)} label="Training überspringen">
      <h2 class="h2">Training überspringen?</h2>
      <p style="margin:0">${datumLang(tag.datum)} fällt aus; danach geht es mit dem nächsten Plantag weiter. Im Verlauf bleibt der Tag als „übersprungen“ sichtbar.</p>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setSheet(null)}>Abbrechen</button>
        <button class="btn btn-chalk" style="flex:1" onClick=${() => { tagOption(tag.offset, { weg: true }); setSheet(null); }}>Überspringen</button></div>
    <//>` : null}
    ${maxe}
  </div>`;
}

/** Leiste ohne laufende Pause (ersetzt „Training läuft“): Trainingszeit groß, nächster Satz, Fortschritt je Übung. */
function TrainingDock({ training, oeffnen }) {
  useTakt(true, 1000);
  const s = alleSaetze(training), fertig = s.filter((x) => x.erledigt).length;
  const k = training.karten.find((kk) => kk.key && kk.gruppen.some((g) => g.saetze.some((x) => !x.erledigt)));
  const satz = k?.gruppen.flatMap((g) => g.saetze).find((x) => !x.erledigt);
  const teile = training.karten.filter((kk) => kk.key).map((kk) => { const ss = kk.gruppen.flatMap((g) => g.saetze); return [ss.filter((x) => x.erledigt).length, ss.length]; }).filter(([, n]) => n);
  return html`<div class="pdock ruhig">
    <div class="pdock-haupt" onClick=${oeffnen} role="button" tabIndex="0" aria-label="Zum laufenden Training">
      <div class="pdock-zeit"><span class="pdock-punkt" aria-hidden="true"></span><b class="tab-num">${training.bearbeiten ? '✎' : uhr((Date.now() - training.start) / 1000)}</b></div>
      <div class="pdock-info">
        <b class="pdock-uebung">${k ? nameVon(k.key) : (training.bearbeiten ? 'Bearbeitung offen' : 'Alle Sätze erledigt')}</b>
        <span class="pdock-meta">${satz ? html`<span class="pdock-satz">${`${gw(satz.kg ?? 0)} ${einheit()} × ${satz.wdh ?? '–'}`}</span>` : null}<span class="pdock-zeitchip">${`${fertig}/${s.length} Sätze`}</span></span>
      </div>
    </div>
    ${teile.length ? html`<div class="pdock-fortschritt">${teile.map(([f, n], i) => html`<span key=${i} style=${`flex:${n}`}><i style=${`transform:scaleX(${f / n})`}></i></span>`)}</div>` : null}
  </div>`;
}

/** Nach dem Wegwischen der Leiste: kleiner Knopf unten rechts (gleiches Glas), führt zurück ins Training. */
function MiniDock({ training, timer, oeffnen, ziehen, pos = null }) {
  useTakt(true, 500);
  const pause = timer && timer.ende > Date.now(), los = timer && !pause, farbe = pause ? pausenFarbe((timer.ende - Date.now()) / 1000) : '#5BD68F';
  return html`<button class=${`dock-mini kein-wisch ziehbar ${pause ? 'pause' : ''} ${los ? 'los' : ''}`} ...${ziehen.props} onClick=${() => { if (ziehen.geklickt()) oeffnen(); }}
    style=${`--pausenfarbe:${farbe};${pos ? `left:${pos.x}px;top:${pos.y}px;right:auto;bottom:auto` : ''}`} aria-label="Zurück zum Training (gedrückt halten: groß)">
    <span class="pdock-punkt" aria-hidden="true"></span>
    <b class="tab-num">${pause ? mmss((timer.ende - Date.now()) / 1000) : los ? 'Los!' : uhr((Date.now() - training.start) / 1000)}</b>
    ${los ? html`<small class="los-ueber tab-num">${`+${mmss((Date.now() - timer.ende) / 1000)}`}</small>` : null}
    <span class="dock-mini-pfeil" aria-hidden="true">›</span>
  </button>`;
}

// #################################################################
// App
// #################################################################
function App() {
  const [phase, setPhase] = useState('laden');          // laden | anmelden | bereit | fehler
  const [fehler, setFehler] = useState(null);
  const [nutzer, setNutzer] = useState(null);            // { id, email }
  const [heute, setHeute] = useState(heuteLokal);
  const [trainings, setTrainings] = useState([]);
  const [messwerte, setMesswerte] = useState([]);
  const [ausdauer, setAusdauer] = useState([]);                // 222: Läufe und Radfahrten (lokal + Konto)
  const [masse, setMasse] = useState([]);                        // 182: Körpermaße je Messtag
  const [info, setInfo] = useState({});                  // datei → { id, version, name, vorlage, versionen }
  const [block, setBlock] = useState(null);
  const [einst, setEinstRoh] = useState(STANDARD_EINSTELLUNGEN);
  const [demoKg, setDemoKg] = useState(null);
  const [sync, setSync] = useState({ laeuft: false, zuletzt: null, fehler: null });
  const [ansicht, setAnsicht] = useState(() => ausAdresse().ansicht);
  const [uebungAnsicht, setUebungAnsicht] = useState(() => { const a = ausAdresse(); return a.key ? { key: a.key, zurueck: 'verlauf' } : null; });   // { key, zurueck }
  const [leichter, setLeichter] = useState(false);
  const [training, setTraining] = useState(null);
  const [timer, setTimer] = useState(null);
  useAnsagen(timer, !!einst.sprachansagen);                    // 193
  const [toast, setToast] = useState(null);
  // Meldungen zur Seite oder nach oben wegwischen
  const toastZug = useRef(null);
  const toastWisch = {
    onTouchStart: (e) => { toastZug.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, el: e.currentTarget }; e.currentTarget.style.transition = 'none'; },
    onTouchMove: (e) => { const z = toastZug.current; if (!z) return; const dx = e.touches[0].clientX - z.x, dy = Math.min(0, e.touches[0].clientY - z.y);
      z.dx = dx; z.dy = dy; z.el.style.transform = `translate(calc(-50% + ${dx}px), ${dy}px)`; z.el.style.opacity = String(Math.max(0.2, 1 - Math.max(Math.abs(dx), -dy) / 220)); },
    onTouchEnd: () => { const z = toastZug.current; toastZug.current = null; if (!z) return; z.el.style.transition = 'transform .18s ease, opacity .18s ease';
      if (Math.abs(z.dx ?? 0) > 70 || (z.dy ?? 0) < -40) { z.el.style.transform = `translate(calc(-50% + ${Math.sign(z.dx ?? 0) * (Math.abs(z.dx ?? 0) > 70 ? 120 : 0)}vw), ${(z.dy ?? 0) < -40 ? -160 : 0}px)`; z.el.style.opacity = '0'; setTimeout(() => setToast(null), 170); }
      else { z.el.style.transform = ''; z.el.style.opacity = ''; } },
  };
  const [menue, setMenue] = useState(false);
  const [glossar, setGlossar] = useState(false);                // 163: Begriffe erklärt
  const [feedback, setFeedback] = useState(null);              // 126: { art, betrifft, name }
  const [neueVersion, setNeueVersion] = useState(false);        // 126 g                     // 172: Seitenmenü mit Werkzeugen
  const [rechnerArt, setRechnerArt] = useState(() => { const a = ausAdresse(); return a.ansicht === 'rechner' ? a.key : null; });
  const wischRef = useRef({});
  const bildStandRef = useRef(null);
  const bilder = useRef({});                                     // Reiter → { el, fuer }: Bild der Seite (DOM-Kopie ihres ersten Aufbaus, ohne Programmlogik)
  const vorbereitung = useRef(0);                                // Nummer der laufenden Bild-Vorbereitung im Leerlauf
  const ebeneRef = useRef(null);                                 // beim Wischen: Ebene mit dem Bild der hereinkommenden Seite
  const seiteRef = useRef(null);                                 // seiteFuer der letzten Darstellung (für Bilder noch nie besuchter Reiter)
  const [menueZug, setMenueZug] = useState(false);               // Seitenmenü wird gerade aufgezogen
  const [menueGezogen, setMenueGezogen] = useState(false);       // per Wischen geöffnet: Einblend-Animation nicht nochmal
  const hauptRef = useRef(null), zugUnter = useRef(null), zugLaeuft = useRef(false);
  const unterInhaltRef = useRef(null);                            // Wischen zwischen Unterreitern: nur dieser Inhalt gleitet
  const [lichter, setLichter] = useState(null);
  const [demoErledigt, setDemoErledigt] = useState(() => new Set());
  const [anpassungen, setAnpassungenRoh] = useState({});        // key → persönliche Anpassung der Übung
  const [neueUebung, setNeueUebung] = useState(null);           // { text, beiWahl } – Formular „Neue Übung“ offen
  const [bereit, setBereit] = useState(null);                   // Readiness-Check vor dem Start: { tag } oder { frei: true }
  const [einf, setEinf] = useState(einfuehrungOffen);           // Einführungskarten beim ersten Öffnen (pro Gerät)
  const [abschluss, setAbschluss] = useState(null);
  const [lange, setLange] = useState(false);                    // Training > 4 h offen: nachfragen (153)
  // Leiste unten (03.11.): groß oder klein entscheidet man selbst (gemerkt); Lage beider Varianten frei verschiebbar und gemerkt
  const [dockKlein, setDockKleinRoh] = useState(() => speicher.lies('prh-dock-klein') === '1');
  const setDockKlein = (k) => {
    setDockKleinRoh(k); speicher.schreib('prh-dock-klein', k ? '1' : '0');
    const n = Number(speicher.lies('prh-dock-hinweis-klein') ?? 0);
    if (k && n < 3) { speicher.schreib('prh-dock-hinweis-klein', String(n + 1)); setToast({ titel: deEn('Klein gemacht', 'Minimised'), text: deEn('Gedrückt halten macht es wieder groß, ziehen verschiebt.', 'Press and hold to enlarge, drag to move.') }); }
  };
  const [dockPos, setDockPosRoh] = useState(() => { try { return JSON.parse(localStorage.getItem('prh-dock-pos')) ?? {}; } catch { return {}; } });
  const setDockPos = (p) => { setDockPosRoh(p); try { localStorage.setItem('prh-dock-pos', JSON.stringify(p)); } catch { /* egal */ } };
  const grenze = (v, a, b) => Math.min(b, Math.max(a, v));
  const grossZiehen = useZiehen({ achsen: 'y', wischX: () => setDockKlein(true), lang: () => setDockKlein(true),
    ablegen: (r) => setDockPos({ ...dockPos, gross: grenze(r.top / innerHeight, 0, (innerHeight - r.height) / innerHeight) }) });
  const kleinZiehen = useZiehen({ achsen: 'xy', lang: () => setDockKlein(false),
    ablegen: (r) => setDockPos({ ...dockPos, klein: { x: grenze(r.left / innerWidth, 0, (innerWidth - r.width) / innerWidth), y: grenze(r.top / innerHeight, 0, (innerHeight - r.height) / innerHeight) } }) });
  const appZoom = () => parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
  // 219: Kurzbefehle der installierten App (Manifest „shortcuts“) kommen als ?aktion=… – einmal nach dem Laden ausführen
  const aktionFn = useRef(null), aktionErledigt = useRef(false);
  useEffect(() => {
    if (phase !== 'bereit' || aktionErledigt.current) return;
    const a = new URLSearchParams(location.search).get('aktion');
    if (!a) return;
    aktionErledigt.current = true;
    history.replaceState(history.state, '', location.pathname + location.hash);
    setTimeout(() => aktionFn.current?.(a), 300);
  }, [phase]);
  useEffect(() => {
    if (DEMO || phase !== 'bereit' || einst.geschlecht) return;
    const g = geschlechtAusName(einst.vorname, einst.name);
    if (g) setEinst({ ...einst, geschlecht: g });
  }, [phase, einst.vorname, einst.name]);
  const [beschwerdeOffen, setBeschwerdeOffen] = useState(false);     // 216: Melde-Fenster
  const beschwerdeNachAbschluss = useRef(false);
  const [rbJahr, setRbJahr] = useState(null);
  // im Menü: ab Dezember das laufende Jahr, sonst das vorige (wenn es dort Trainings gab)
  // im Menü nur rund um den Jahreswechsel: ab 18.12. das laufende Jahr, im Januar noch das gerade beendete
  const rueckblickMenue = (() => {
    const m = HEUTE.slice(5, 7), j = Number(HEUTE.slice(0, 4)) - (m === '01' ? 1 : 0);
    if (!(m === '12' && Number(HEUTE.slice(8)) >= 18) && m !== '01') return null;
    return trainings.some((t) => !t.geloescht && t.datum?.startsWith(String(j))) ? j : null;
  })();                       // 206: offener Jahresrückblick
  useEffect(() => { const h = (e) => { const j = e.detail?.jahr ?? null; if (j) speicher.schreib(`prh-rueckblick-weg-${j}`, '1'); setRbJahr(j); }; addEventListener('prh-rueckblick', h); return () => removeEventListener('prh-rueckblick', h); }, []);
  const rbDaten = useMemo(() => (rbJahr ? rueckblickAus(normiere(trainings), rbJahr, { liftVon }) : null), [rbJahr, trainings]);
  const [aktiveFreunde, setAktiveFreunde] = useState([]);        // 191: Freunde, die gerade trainieren
  const [neuReakt, setNeuReakt] = useState([]);                  // 190: neue Likes/Kommentare unter meinen Trainings
  const [coachOffen, setCoachOffen] = useState(0);              // 214: offene Coach-Anfragen an mich (zählt im roten Punkt mit)
  const [anfragen, setAnfragen] = useState(0);                  // offene Freundschaftsanfragen an mich (roter Punkt am Feed)             // Abschlusskarte nach dem Speichern eines Trainings
  const sperre = useRef(null);
  const sp = useRef(null);
  const laeuft = useRef(false);
  const nochmal = useRef(false);                                 // während eines Abgleichs angefordert → danach noch einmal
  const zuletzt = useRef(0);
  const planTage = useRef([]);                                    // geplante Trainingstage für den Kalender der Freunde (Update 18)
  const jetzt = useRef({ ansicht: 'heute', key: null });          // aktuelle Ansicht für den popstate-Handler
  const scrollPos = useRef({});                                    // Scrollposition je Ansicht (zurück ins Training = gleiche Stelle)
  const katalogStatisch = useRef([]);
  const eigeneUebungen = useRef([]);
  const zusammen = useRef({});                                   // zusammengeführte Übungen { alt: neu }
  const anpassungenRef = useRef({});
  const detailCache = useRef(new Map());
  const setAnpassungen = (a) => { anpassungenRef.current = a; setzeAnzeige({ anpassung: a }); setAnpassungenRoh(a); };
  const katalogMischen = (eigene) => {
    eigeneUebungen.current = eigene;
    setzeKatalog(konto.mischeKatalog(katalogStatisch.current, eigene), new Set(Object.keys(zusammen.current)));
  };
  const zusammenSetzen = (m) => { zusammen.current = m ?? {}; setzeUmbenannt(zusammen.current); };

  // #################################################################
  // Start: Katalog, dann Demo oder Anmeldung + lokale Daten
  // #################################################################
  useEffect(() => {
    thema(speicher.lies('prh-thema'));                     // sofort, bevor das Profil geladen ist
    stilSetzen(speicher.lies('prh-stil')); schriftSetzen(speicher.lies('prh-schrift'));
    schrift(Number(speicher.lies('prh-zoom')) || 1);
    const gemerkteDeckkraft = speicher.lies('prh-deckkraft');
    deckkraft(gemerkteDeckkraft != null && gemerkteDeckkraft !== '' ? Number(gemerkteDeckkraft) : 0.88);
    setzeSprache(speicher.lies('prh-sprache') ?? 'de');
    ladeHintergrund();
    (async () => {
      katalogStatisch.current = await (await fetch('daten/katalog.json')).json();
      setzeKatalog(katalogStatisch.current);
      if (DEMO) {
        const progs = await Promise.all(VORLAGEN.map((d) => fetch(`programme/${d}.json`).then((r) => r.json())));
        setInfo(Object.fromEntries(VORLAGEN.map((d, i) => [d, { id: null, version: 1, name: progs[i].name, vorlage: true, versionen: { 1: progs[i] } }])));
        setBlock({ id: 'demo', datei: 'pr_hybrid_candito_pana', start: HEUTE, werte: { S: 205, D: 210, B: 155, G: 158 }, alternativ: false });
        setPhase('bereit');
        return;
      }
      let s = null;
      try { s = await sitzung(); } catch { /* offline oder abgelaufen */ }
      const gemerkt = JSON.parse(speicher.lies('prh-nutzer') ?? 'null');
      if (s) await starte({ id: s.user.id, email: s.user.email });
      else if (gemerkt && !navigator.onLine) await starte(gemerkt);       // ohne Netz mit den Daten auf dem Handy weiter
      else setPhase('anmelden');
    })().catch((e) => { setFehler(e.message); setPhase('fehler'); });
    if (location.protocol === 'https:' && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    // 223: Rückkehr von der Strava-Freigabe (?strava=ok | abgelehnt | …) – Meldung zeigen, Adresse aufräumen
    const strava = new URLSearchParams(location.search).get('strava');
    if (strava) {
      history.replaceState(history.state, '', location.pathname + location.hash);
      setToast(strava === 'ok' ? { titel: 'Strava verbunden', text: deEn('Die letzten 90 Tage werden geholt – gleich im Verlauf.', 'Fetching the last 90 days – shortly in History.') }
        : { titel: 'Strava', text: strava === 'abgelehnt' ? deEn('Freigabe abgebrochen.', 'Authorisation cancelled.') : strava === 'ohne-aktivitaeten' ? deEn('Bitte den Zugriff auf Aktivitäten erlauben.', 'Please allow access to activities.') : deEn('Verbinden hat nicht geklappt – nochmal versuchen.', 'Connecting failed – please try again.') });
    }
  }, []);

  async function starte(n) {
    speicher.schreib('prh-nutzer', JSON.stringify(n));
    setNutzer(n);
    const s = await speicherFuer(n.id);
    sp.current = s;
    const [tr, me, bl, ei, lauf, inf, ue, an, zf, pause, ma] = await Promise.all(['', 'messwerte', 'block', 'einst', 'laufend', 'programme', 'uebungen', 'anpassungen', 'zusammen', 'pause', 'masse']
      .map((k) => (k ? s.meta(k) : s.alle())));
    setMasse(ma ?? []);
    zusammenSetzen(zf);
    setTrainings(tr);
    setMesswerte(me ?? []);
    setAusdauer((await s.meta('ausdauer')) ?? []);
    setBlock(bl?.ende ? null : bl);
    setEinstRoh({ ...STANDARD_EINSTELLUNGEN, ...(ei ?? {}) });
    katalogMischen(ue ?? []);
    setAnpassungen(an ?? {});
    setTraining(lauf);
    if (lauf && pause?.ende > Date.now()) setTimer(pause);          // laufende Pause übersteht das Schließen der App
    setInfo(inf && Object.keys(inf).length ? inf : await vorlagenAusDateien());
    setPhase('bereit');
    dauerhaft();
    abgleich();
  }

  // Erster Start ohne Netz: Vorlagen aus den App-Dateien (ohne Server-ID, Block starten geht erst nach dem Abgleich)
  const vorlagenAusDateien = async () => {
    try {
      const progs = await Promise.all(VORLAGEN.map((d) => fetch(`programme/${d}.json`).then((r) => r.json())));
      return Object.fromEntries(VORLAGEN.map((d, i) => [d, { id: null, version: 0, name: progs[i].name, vorlage: true, versionen: { 0: progs[i] } }]));
    } catch { return {}; }
  };

  // #################################################################
  // Hintergrundbild (Update 11, eigene Tabelle); ohne Update 11 bleibt es auf dem Gerät
  const hintergrundAbgleichen = async (sb) => {
    const uid = JSON.parse(speicher.lies('prh-nutzer') ?? 'null')?.id;
    try {
      await hgAbgleichen({ hochladen: (bild) => konto.hintergrundHochladen(sb, uid, bild), stand: () => konto.hintergrundStand(sb), laden: () => konto.hintergrundLaden(sb) });
    } catch { /* Tabelle fehlt (vor Update 11) oder kein Netz: beim nächsten Abgleich wieder */ }
  };

  // Abgleich: Programme, Einstellungen, Körpergewicht, Block, dann Trainings (run_id braucht den Block)
  // #################################################################
  async function abgleich() {
    if (DEMO || !sp.current) return;
    if (laeuft.current) { nochmal.current = true; return; }
    laeuft.current = true; zuletzt.current = Date.now();
    setSync((s) => ({ ...s, laeuft: true }));
    const sb = supabase(), s = sp.current, uid = JSON.parse(speicher.lies('prh-nutzer') ?? 'null')?.id;
    try {
      const inf = await konto.ladeProgramme(sb);
      if (!Object.keys(inf).length) throw new Error('Der Server liefert keine Programmvorlagen.');
      await s.setzeMeta('programme', inf); setInfo(inf);
      // Übungen vor den Trainings: eigene und geänderte Basisübungen in den Katalog, Anpassungen hoch und runter
      const zf = await konto.ladeZusammenfuehrungen(sb);
      await s.setzeMeta('zusammen', zf); zusammenSetzen(zf);
      const ue = await konto.ladeUebungen(sb);
      await s.setzeMeta('uebungen', ue); katalogMischen(ue);
      const an = (await s.meta('anpassungen')) ?? {};
      for (const [key, a] of Object.entries(an)) if (a.offen) { await konto.anpassungHochladen(sb, key, a); an[key] = { ...a, offen: false }; }
      const anNeu = konto.mischeAnpassungen(an, await konto.ladeAnpassungen(sb));
      await s.setzeMeta('anpassungen', anNeu); setAnpassungen(anNeu);
      // Einstellungen: offene hochladen, sonst vom Server übernehmen. Ändert der Nutzer währenddessen etwas, gewinnt seine
      // Änderung (Stand vor dem Schreiben neu lesen) – sonst ginge sie beim Neuladen verloren
      const ei = await s.meta('einst');
      if (ei?.offen) {
        try { await konto.speichereProfil(sb, uid, ei); }
        catch (x) {
          // 126 c: Anzeigename vergeben – Rest trotzdem speichern, Name vom Server behalten, Bescheid geben
          if (!/schon vergeben/.test(x.message)) throw x;
          await konto.speichereProfil(sb, uid, { ...ei, name: null });
          const serverName = (await konto.ladeProfil(sb, uid)).display_name ?? null;
          await s.setzeMeta('einst', { ...ei, name: serverName }); setEinstRoh({ ...ei, name: serverName });
          setToast({ titel: 'Name schon vergeben', text: x.message });
        }
        if (JSON.stringify(await s.meta('einst')) === JSON.stringify(ei)) await s.setzeMeta('einst', { ...ei, offen: false });
      } else {
        const e = konto.einstAusProfil(await konto.ladeProfil(sb, uid), ei ?? {});
        // Wieder angemeldet, solange die Löschung nur vorgemerkt ist (Update 20): Löschung aufheben, alles bleibt
        if (e.loeschenAb) {
          await konto.kontoLoeschenAbbrechen(sb);
          Object.assign(e, { loeschenAb: null, vergleich: true, feedTeilen: true });
          setToast({ titel: 'Willkommen zurück', text: 'Die Löschung deines Kontos ist aufgehoben, alle Daten sind wieder da.' });
        }
        if (!(await s.meta('einst'))?.offen) { await s.setzeMeta('einst', e); setEinstRoh({ ...STANDARD_EINSTELLUNGEN, ...e }); }
      }
      await hintergrundAbgleichen(sb, s);
      // Geplante Tage für den Kalender im Feed (nur wenn sich etwas geändert hat; ohne Update 18 still)
      const plan = JSON.stringify(planTage.current);
      if (plan !== (await s.meta('plan_tage'))) {
        const tageListe = planTage.current.map((x) => x.datum), inhalt = Object.fromEntries(planTage.current.map((x) => [x.datum, x.keys]));
        if (await konto.speicherePlanTage(sb, uid, tageListe, inhalt)) await s.setzeMeta('plan_tage', plan);
      }
      // Offene Freundschaftsanfragen an mich: roter Hinweis am Feed
      try { const fr = await konto.ladeFreunde(sb); setAnfragen(fr ? fr.filter((x) => x.status === 'offen' && x.richtung === 'rein').length : 0); } catch { /* egal */ }
      try { setCoachOffen(coachZahl(await konto.coachBeziehungen(sb))); } catch { /* ohne Update 32 still */ }
      let me = (await s.meta('messwerte')) ?? [];
      for (const m of me.filter((x) => x.offen)) { await konto.messwertHochladen(sb, m); m.offen = false; }
      me = konto.mischeMesswerte(me, await konto.ladeMesswerte(sb));
      await s.setzeMeta('messwerte', me); setMesswerte(me);
      let ma = (await s.meta('masse')) ?? [];
      for (const m of ma.filter((x) => x.offen)) { await konto.masseHochladen(sb, m); m.offen = false; }
      ma = konto.mischeMesswerte(ma, await konto.ladeMasse(sb));
      await s.setzeMeta('masse', ma); setMasse(ma);
      // 222: Ausdauer hochladen und mischen (ohne Update 33 bleibt alles lokal)
      try {
        let au = (await s.meta('ausdauer')) ?? [];
        // intervals.icu / Strava: höchstens alle 30 min neue Aktivitäten holen
        const zuletzt = Number(speicher.lies('prh-strava-zuletzt') ?? 0);
        if ((await s.meta('einst'))?.ausdauer && Date.now() - zuletzt > 30 * 60_000) {
          speicher.schreib('prh-strava-zuletzt', String(Date.now()));
          if ((await konto.intervalsStatus(sb))?.verbunden) await konto.intervalsAktion(sb, 'abgleich', SUPABASE_URL).catch(() => {});
          if ((await konto.stravaStatus(sb))?.verbunden) await konto.stravaAktion(sb, 'abgleich', SUPABASE_URL).catch(() => {});
        }
        for (const a of au.filter((x) => x.offen)) if (await konto.ausdauerHochladen(sb, a)) a.offen = false;
        au = konto.mischeAusdauer(au, await konto.ladeAusdauer(sb));
        await s.setzeMeta('ausdauer', au); setAusdauer(au);
      } catch { /* nächster Abgleich */ }
      let bl = await s.meta('block');
      if (bl?.offen) { await konto.blockHochladen(sb, bl); bl = bl.ende ? null : { ...bl, offen: false }; }
      else bl = await konto.ladeBlock(sb, inf);
      await s.setzeMeta('block', bl); setBlock(bl);
      const erg = await abgleichen(sb, s);
      setTrainings(await s.alle());
      setSync({ laeuft: false, zuletzt: new Date().toISOString(), fehler: erg.fehler.length ? erg.fehler : null });
    } catch (e) {
      setSync((alt) => ({ ...alt, laeuft: false, fehler: [{ meldung: navigator.onLine ? e.message : 'Kein Netz – wird später nachgeholt.' }] }));
    } finally {
      laeuft.current = false;
      if (nochmal.current) { nochmal.current = false; abgleich(); }
    }
  }

  useEffect(() => {
    const online = () => abgleich();
    const sichtbar = () => {
      if (document.visibilityState !== 'visible') return;
      setHeute(heuteLokal());
      if (Date.now() - zuletzt.current > ABGLEICH_ALLE_MS) abgleich();
    };
    addEventListener('online', online);
    document.addEventListener('visibilitychange', sichtbar);
    return () => { removeEventListener('online', online); document.removeEventListener('visibilitychange', sichtbar); };
  }, []);

  // Historie (254): beim Öffnen nur den Eintrag ersetzen (wurzel) – ein pushState ohne Antippen ließe Chrome ihn beim
  // Zurück überspringen und die App schließen. Beim ersten echten Antippen (click/keydown, dort gilt die Nutzer-Aktion;
  // pointerdown zählt bei Touch nicht) kommt die Ansicht als zweiter Eintrag darüber. Zurück auf die Wurzel springt
  // wieder vorwärts (ui/basis.js), die App bleibt offen.
  useEffect(() => {
    const start = ausAdresse();
    history.replaceState({ ...start, wurzel: true }, '', adresse(start.ansicht, start.key));
    const antippen = () => {
      if (!history.state?.wurzel) return;
      const { wurzel, ...st } = history.state;
      history.pushState({ ...st, erste: true }, '', location.href);
    };
    addEventListener('click', antippen, true);
    addEventListener('keydown', antippen, true);
    const zurueck = (e) => {
      const st = e.state;
      if (!st?.ansicht) { zurueckAbbrechen(); return; }
      scrollPos.current[jetzt.current.ansicht] = scrollY;
      setAnsicht(st.ansicht);
      const y = scrollPos.current[st.ansicht] ?? 0;
      setTimeout(() => scrollTo(0, y), 30);
      if (st.ansicht === 'rechner') setRechnerArt(st.key ?? null);
      else if (st.key) setUebungAnsicht((u) => (u?.key === st.key ? u : { key: st.key, zurueck: 'verlauf' }));
    };
    addEventListener('popstate', zurueck);
    // Neuladen/Herunterziehen: Ansicht steht in der Adresse, die Scrollposition merken wir uns hier
    const merken = () => { try { sessionStorage.setItem('prh-scroll', JSON.stringify({ hash: location.hash, y: scrollY })); } catch { /* egal */ } };
    addEventListener('pagehide', merken);
    return () => { removeEventListener('popstate', zurueck); removeEventListener('pagehide', merken); removeEventListener('click', antippen, true); removeEventListener('keydown', antippen, true); };
  }, []);
  // Startbild aus index.html ausblenden, sobald die App steht (mindestens 0,48 s nach dem Öffnen, damit die Animation durchläuft; 177)
  useEffect(() => {
    if (phase === 'laden') return;
    const sb = document.getElementById('startbild');
    if (!sb) return;
    const id = setTimeout(() => { sb.classList.add('weg'); setTimeout(() => sb.remove(), 260); }, Math.max(0, 480 - performance.now()));
    return () => clearTimeout(id);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'bereit') return;
    try {
      const m = JSON.parse(sessionStorage.getItem('prh-scroll') ?? 'null');
      sessionStorage.removeItem('prh-scroll');
      if (m && m.hash === location.hash && m.y > 0) setTimeout(() => scrollTo(0, m.y), 60);
    } catch { /* egal */ }
  }, [phase]);

  // Laufendes Training bei jeder Änderung sichern (übersteht Neuladen, Akku leer, App-Wechsel)
  useEffect(() => { if (!DEMO && sp.current && phase === 'bereit') sp.current.setzeMeta('laufend', training ?? null).catch(() => {}); }, [training]);
  useEffect(() => { if (!DEMO && sp.current && phase === 'bereit') sp.current.setzeMeta('pause', timer ?? null).catch(() => {}); }, [timer]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 3200); return () => clearTimeout(id); }, [toast]);
  useEffect(() => { thema(einst.thema); speicher.schreib('prh-thema', einst.thema ?? 'system'); }, [einst.thema]);
  // Vor dem Laden (einst noch der Standard) gilt der Gerätespeicher vom Start – nicht mit Standardwerten überschreiben
  const geladen = einst !== STANDARD_EINSTELLUNGEN;
  useEffect(() => { if (!geladen) return; schrift(einst.zoom ?? 1); speicher.schreib('prh-zoom', String(einst.zoom ?? 1)); }, [einst.zoom, geladen]);
  useEffect(() => { if (geladen && einst.hintergrundDunkel != null) setzeAbdunklung(einst.hintergrundDunkel); }, [einst.hintergrundDunkel, geladen]);
  useEffect(() => { if (!geladen) return; deckkraft(einst.deckkraft ?? 0.88); speicher.schreib('prh-deckkraft', String(einst.deckkraft ?? 0.88)); }, [einst.deckkraft, geladen]);
  useEffect(() => { if (!geladen) return; setzeSprache(einst.sprache); speicher.schreib('prh-sprache', einst.sprache ?? 'de'); }, [einst.sprache, geladen]);
  useEffect(() => { if (!geladen) return; stilSetzen(einst.stil); speicher.schreib('prh-stil', einst.stil ?? 'eisen'); }, [einst.stil, geladen]);
  useEffect(() => { if (!geladen) return; schriftSetzen(einst.schrift); speicher.schreib('prh-schrift', einst.schrift ?? 'archivo'); }, [einst.schrift, geladen]);
  // Benachrichtigungen: solange ein Training läuft, steht es leise in der Leiste des Handys (mit Endzeit der Pause) –
  // auch bei offener App, damit es bleibt, wenn die App versehentlich geschlossen wird; weg erst mit dem Trainingsende.
  // Im Hintergrund kommt am Pausenende zusätzlich eine laute Meldung; zurück in der App verschwindet nur diese.
  useEffect(() => {
    if (DEMO || !einst.mitteilungen || !mitteilung.erlaubt()) return;
    let id = null, takt = null;
    const zeigeTraining = () => {
      const s = alleSaetze(training), { titel, text } = mitteilung.trainingsText(training, { fertig: s.filter((x) => x.erledigt).length, gesamt: s.length, timer });
      mitteilung.zeige(mitteilung.TAG_TRAINING, titel, text, { zeit: training.start, bleibt: true });
    };
    const pruefe = () => {
      clearTimeout(id); clearInterval(takt);
      if (!training || training.bearbeiten) return;
      zeigeTraining();
      // Countdown während der Pause: bei offener App sekündlich, im Hintergrund so oft das Handy den Zeitgeber laufen
      // lässt (Android drosselt Web-Apps dort auf grobe Schritte); ohne Pause jede halbe Minute (Trainingszeit)
      const pauseLaeuft = timer && !timer.fertig && timer.ende > Date.now();
      takt = setInterval(zeigeTraining, pauseLaeuft ? 1000 : 30000);
      if (document.visibilityState === 'visible') { mitteilung.schliesse(mitteilung.TAG_PAUSE); return; }
      if (pauseLaeuft) {
        id = setTimeout(() => {
          clearInterval(takt); takt = setInterval(zeigeTraining, 30000); zeigeTraining();
          const p = mitteilung.pauseEndeText(timer); mitteilung.zeige(mitteilung.TAG_PAUSE, p.titel, p.text, { laut: true });
        }, timer.ende - Date.now());
      }
    };
    document.addEventListener('visibilitychange', pruefe);
    pruefe();
    return () => { clearTimeout(id); clearInterval(takt); document.removeEventListener('visibilitychange', pruefe); };
  }, [training, timer, einst.mitteilungen]);
  // Training beendet: Benachrichtigungen weg
  useEffect(() => { if (!training) mitteilung.schliesse(mitteilung.TAG_TRAINING, mitteilung.TAG_PAUSE); }, [!training]);
  useEffect(() => {
    if (!lichter) return;
    if (lichter.gold) vibriere([70, 50, 70, 50, 160]);
    const id = setTimeout(() => setLichter(null), lichter.gold ? 3800 : 1900); return () => clearTimeout(id);
  }, [lichter]);

  // Auswertungsstand für alle Ansichten (Live-Bindings in ui/stand.js)
  // Blöcke (program_runs) als Zeiträume aus den Trainings: für „nur Bestwert je Block“ in den Übungs-Charts
  const bloecke = useMemo(() => {
    const m = new Map();
    for (const t of trainings) {
      if (!t.runId || t.geloescht) continue;
      const b = m.get(t.runId) ?? { id: t.runId, von: t.datum, bis: t.datum };
      if (t.datum < b.von) b.von = t.datum;
      if (t.datum > b.bis) b.bis = t.datum;
      m.set(t.runId, b);
    }
    return [...m.values()];
  }, [trainings]);
  const stand = useMemo(() => (DEMO || phase !== 'bereit' ? null
    : erstelleStand(trainings, { heute, katalog: katalogListe(), messwerte, formel: einst.formel ?? 'rpe' })), [trainings, messwerte, heute, phase, einst.formel]);
  // 259: Statistik und Übungsseite zeigen abgehakte Sätze des laufenden Trainings sofort (z. B. ein neues Kniebeuge-PR
  // im Diagramm). Nur dort – im Training selbst bleibt der Stand ohne das laufende Training (Rekorde, „letztes Mal“, Vorschläge).
  const mitLaufendem = !DEMO && phase === 'bereit' && training && !training.bearbeiten && (ansicht === 'statistik' || ansicht === 'uebung');
  const laufendSig = mitLaufendem ? JSON.stringify(training.karten.map((k) => [k.key, k.gruppen.map((g) => g.saetze.filter((s) => s.erledigt).map((s) => [s.kg, s.wdh, s.rpe, s.typ]))])) : '';
  const standLive = useMemo(() => {
    if (!mitLaufendem || !alleSaetze(training).some((s) => s.erledigt)) return null;
    const w = ausTraining(training, { id: training.id });   // Körpergewicht kommt in der Auswertung aus den Messwerten
    return erstelleStand([...trainings.filter((x) => x.id !== w.id), w], { heute, katalog: katalogListe(), messwerte, formel: einst.formel ?? 'rpe' });
  }, [laufendSig, trainings, messwerte, heute, einst.formel]);
  if (stand) setzeStand(standLive ?? stand);
  setzeAnsichtJetzt(ansicht);
  // Bis die Einstellungen geladen sind (in der Demo: bis man etwas ändert) gilt die gemerkte Sprache – wie bei der
  // Übersetzung der Oberfläche, sonst stünden Übungsnamen, Zahlen und Datum kurz (Demo: dauerhaft) in der anderen Sprache
  setzeAnzeige({ sprache: geladen ? einst.sprache : speicher.lies('prh-sprache') ?? 'de', einheit: einst.einheit, stange: einst.stange, scheiben: einst.scheiben, formel: einst.formel, ton: einst.ton, vibration: einst.vibration,
    inc: einst.einheit === 'lb' ? (einst.inc ?? 5) * KG_PRO_LB : einst.inc ?? 2.5 });

  // Dienste für die Ansichten (Übungen anpassen, anlegen, ändern, Details laden); in der Demo bleiben sie leer
  const eigeneMischen = async (e) => {
    const ue = [...eigeneUebungen.current.filter((x) => x.k !== e.k), e];
    katalogMischen(ue);
    await sp.current?.setzeMeta('uebungen', ue);
    return e;
  };
  if (!DEMO && phase === 'bereit') {
    setzeDienste({
      speichereAnpassung: async (key, a) => {
        const neu = { ...anpassungenRef.current, [key]: { ...a, key, offen: true } };
        setAnpassungen(neu);
        await sp.current.setzeMeta('anpassungen', neu);
        abgleich();
      },
      ladeUebungDetails: async (key) => {
        if (detailCache.current.has(key)) return detailCache.current.get(key);
        if (!navigator.onLine) return null;
        const { data } = await supabase().from('exercises').select('images, instructions_en, secondary_muscles').eq('key', key).maybeSingle();
        const d = data ? { bilder: data.images ?? [], anleitung: data.instructions_en ?? [], m2: data.secondary_muscles ?? [] } : null;
        detailCache.current.set(key, d);
        return d;
      },
      uebungAnlegen: async (u) => {
        if (!navigator.onLine) throw new Error('Zum Anlegen braucht das Handy Netz.');
        const e = await eigeneMischen(await konto.uebungAnlegen(supabase(), nutzer.id, u, new Set(katalogListe().map((x) => x.k))));
        setToast({ titel: 'Übung angelegt', text: `${e.de} – für alle verfügbar` });
        return e;
      },
      uebungAendern: async (id, u) => {
        if (!navigator.onLine) throw new Error('Zum Ändern braucht das Handy Netz.');
        const e = await eigeneMischen(await konto.uebungAendern(supabase(), id, u));
        setToast({ titel: 'Übung geändert', text: e.de });
        return e;
      },
      aehnliche: (name) => konto.aehnlicheUebungen(supabase(), name),
      neueUebungStarten: (text, beiWahl) => setNeueUebung({ text, beiWahl }),
      ladeVergleich: () => konto.ladeVergleich(supabase()),
      ladeFeed: () => konto.ladeFeed(supabase(), 30),
      ladeKalender: (von, bis) => konto.ladeKalender(supabase(), von, bis),
      ladeFreunde: async () => { const f = await konto.ladeFreunde(supabase()); if (f) setAnfragen(f.filter((x) => x.status === 'offen' && x.richtung === 'rein').length); return f; },
      sucheNutzer: (q) => konto.sucheNutzer(supabase(), q),
      freundAktion: (art, id) => konto.freundAktion(supabase(), art, id),
      freigabeSetzen: (id, art, wert) => konto.freigabeSetzen(supabase(), id, art, wert),
      zusammenfuehren: async (von, nach) => {
        if (!navigator.onLine) throw new Error('Zum Zusammenführen braucht das Handy Netz.');
        const n = await konto.zusammenfuehren(supabase(), von, nach);
        setToast({ titel: 'Zusammengeführt', text: `${n} Trainingseinträge hängen jetzt an ${nameVon(nach)}.` });
        zuletzt.current = 0; abgleich();
      },
      darfAendern: (e) => !!einst.admin || (!!e.von && e.von === nutzer?.id),
    });
  }

  // 190: neue Likes/Kommentare – beim Öffnen, bei Rückkehr in die App und jede Minute; Neues als Hinweis (App offen: Meldung,
  // im Hintergrund: Benachrichtigung, falls erlaubt) und als Zahl am Feed-Reiter
  const reaktBekannt = useRef(null);
  useEffect(() => {
    if (DEMO || phase !== 'bereit') return;
    const holen = async () => {
      if (!navigator.onLine) return;
      konto.freundeAktiv(supabase()).then((a) => setAktiveFreunde(a ?? [])).catch(() => {});
      try {
        const l = await konto.neueReaktionen(supabase());
        if (l == null) return;
        const neu = reaktBekannt.current ? l.filter((x) => !reaktBekannt.current.has(`${x.art}${x.id}${x.zeit}`)) : [];
        reaktBekannt.current = new Set(l.map((x) => `${x.art}${x.id}${x.zeit}`));
        setNeuReakt(l);
        if (neu.length) {
          const x = neu[0], mehr = neu.length > 1 ? deEn(` (+${neu.length - 1} weitere)`, ` (+${neu.length - 1} more)`) : '';
          const titel = x.art === 'like' ? deEn(`${x.name} gefällt dein Training`, `${x.name} liked your workout`) : deEn(`${x.name} hat kommentiert`, `${x.name} commented`);
          const text = `${x.text ? `„${x.text}“ · ` : ''}${datumKurz(x.datum)}${mehr}`;
          if (document.hidden) mitteilung.zeige('prh-reaktion', titel, text, { laut: true });
          else setToast({ titel, text });
        }
      } catch { /* still: nächster Versuch in einer Minute */ }
    };
    holen();
    const iv = setInterval(() => { if (!document.hidden) holen(); }, 60000);
    addEventListener('visibilitychange', holen);
    return () => { clearInterval(iv); removeEventListener('visibilitychange', holen); };
  }, [phase]);
  // 191: eigenes laufendes Training melden (sofort und alle 5 min, solange die App offen ist), beim Ende löschen
  const aktivGemeldet = useRef(false);
  useEffect(() => {
    if (DEMO || phase !== 'bereit') return;
    const laeuft = training && !training.bearbeiten;
    if (!laeuft) {
      if (aktivGemeldet.current) { aktivGemeldet.current = false; konto.aktivEnde(supabase()).catch(() => {}); }
      return;
    }
    const melden = () => {
      const t = trainingRef.current;
      if (!t || !navigator.onLine || document.hidden) return;
      konto.aktivMelden(supabase(), { seit: t.start, titel: t.titel, stand: standVon(t), mit: t.mit ?? null }).then(() => { aktivGemeldet.current = true; }).catch(() => {});
    };
    melden();
    const iv = setInterval(melden, 5 * 60000);
    addEventListener('visibilitychange', melden);
    return () => { clearInterval(iv); removeEventListener('visibilitychange', melden); };
  }, [training?.id, !!training?.bearbeiten, phase]);
  // 194: abgehakte Sätze ein paar Sekunden später melden – Trainingspartner sehen den Stand fast live
  const trainingRef = useRef(null);
  trainingRef.current = training;
  const erledigtZahl = training && !training.bearbeiten ? alleSaetze(training).filter((s) => s.erledigt).length : -1;
  useEffect(() => {
    if (DEMO || phase !== 'bereit' || erledigtZahl < 0) return;
    const t = setTimeout(() => { const tr = trainingRef.current; if (tr && navigator.onLine) konto.aktivMelden(supabase(), { seit: tr.start, titel: tr.titel, stand: standVon(tr), mit: tr.mit ?? null }).catch(() => {}); }, 8000);
    return () => clearTimeout(t);
  }, [erledigtZahl, training?.karten?.length]);
  // 194: während eines Trainings alle 15 s schauen, was die Freunde machen (Partner-Leiste)
  useEffect(() => {
    if (DEMO || phase !== 'bereit' || !training || training.bearbeiten) return;
    const iv = setInterval(() => { if (!document.hidden && navigator.onLine) konto.freundeAktiv(supabase()).then((a) => setAktiveFreunde(a ?? [])).catch(() => {}); }, 15000);
    return () => clearInterval(iv);
  }, [!!training, phase]);
  const partner = training && !training.bearbeiten && nutzer ? aktiveFreunde.filter((a) => a.id === training.mit || a.mit === nutzer.id) : [];
  const partnerBekannt = useRef(new Set());
  useEffect(() => {
    for (const p of partner) if (!partnerBekannt.current.has(p.id) && p.mit === nutzer?.id) { setToast({ titel: deEn(`${p.name} trainiert mit dir`, `${p.name} is training with you`), text: deEn('Ihr seht euren Stand gegenseitig oben im Training.', 'You see each other\'s progress at the top of the workout.') }); }
    partnerBekannt.current = new Set(partner.map((p) => p.id));
  }, [partner.map((p) => p.id).join()]);
  // 194: einem Freund beitreten – gleiche Übungen und Satzzahl, Gewichte aus der eigenen Form
  const mitmachen = (a) => {
    if (training) { setToast({ titel: 'Training läuft', text: 'Erst das laufende Training beenden.' }); gehe('training'); return; }
    if (!a.stand?.length) { setToast({ titel: deEn('Noch nichts zu sehen', 'Nothing to see yet'), text: deEn(`${a.name} hat noch keine Übungen.`, `${a.name} has no exercises yet.`) }); return; }
    tonFreigeben(); wachBleiben(); vibriere(120);
    setTraining({ id: neueId(), start: Date.now(), datum: heuteLokal(), planDatum: null, titel: deEn(`Mit ${a.name}`, `With ${a.name}`), runId: null, bereitschaft: null, mit: a.id,
      karten: kartenAusStand(a.stand, einstUi.koerpergewicht).map((k) => ausruestungUebernehmen(k)).map((k, i) => (i > 0 ? { ...k, zu: true } : k)) });
    gehe('training');
  };
  const reaktionenGesehen = () => {
    if (!neuReakt.length) return;
    setNeuReakt([]);
    konto.reaktionenGesehen(supabase()).catch(() => {});
  };
  // Training > 4 h offen: beim Öffnen, bei Rückkehr in die App und jede Minute prüfen (153); Hooks vor den frühen returns
  useEffect(() => {
    const pruefe = () => { if (langeOffen(training)) setLange(true); };
    pruefe();
    const iv = setInterval(pruefe, 60000);
    addEventListener('visibilitychange', pruefe);
    return () => { clearInterval(iv); removeEventListener('visibilitychange', pruefe); };
  }, [training?.id, training?.nachgefragt]);
  // 126 g: neue App-Version – übernimmt der Service Worker, während die Seite offen ist, Hinweis zum Neu laden;
  // beim Zurückkehren in die App nach Updates schauen
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw?.controller) return;
    const neu = () => setNeueVersion(true);
    const pruefen = () => { if (!document.hidden) sw.getRegistration().then((r) => r?.update()).catch(() => {}); };
    sw.addEventListener('controllerchange', neu);
    addEventListener('visibilitychange', pruefen);
    return () => { sw.removeEventListener('controllerchange', neu); removeEventListener('visibilitychange', pruefen); };
  }, []);
  // Bild einer Seite für das Wischen: ihr erster Aufbau, unsichtbar gerendert, abgebildet und sofort wieder abgebaut.
  // Das ist genau das, was nach dem Wechsel als Erstes erscheint (die Seite startet frisch) – beim Tausch springt nichts.
  // Effekte laufen dabei nicht (abgebaut, bevor sie dran sind); der Sitzungsspeicher wird wiederhergestellt.
  const bildVon = (key, neu = false) => {
    let b = bilder.current[key];
    if ((neu || !b) && seiteRef.current) {
      const fuer = seiteRef.current, tmp = document.createElement('div'), sitzung = {};
      try { for (let n = 0; n < sessionStorage.length; n++) { const s = sessionStorage.key(n); sitzung[s] = sessionStorage.getItem(s); } } catch { /* egal */ }
      try {
        render(fuer(key), tmp);
        const el = document.createElement('div'); el.className = 'seite-haupt';
        el.append(...[...tmp.childNodes].map((n) => n.cloneNode(true)));
        el.querySelectorAll('.backdrop, .toast').forEach((x) => x.remove());
        b = bilder.current[key] = { el, fuer, stand: bildStandRef.current };
      } catch { /* dann eben ohne Bild */ }
      finally {
        try { render(null, tmp); } catch { /* egal */ }
        try { for (const [s, w] of Object.entries(sitzung)) if (sessionStorage.getItem(s) !== w) sessionStorage.setItem(s, w); } catch { /* egal */ }
      }
    }
    return b ? b.el.cloneNode(true) : null;
  };
  // Bild der Nachbar-Kategorie einer Seite mit Unterreitern (Feed, Statistik): dieselbe Seite, gezeichnet mit dem anderen Reiter
  const bildUnter = (ansichtKey, reiterKey) => {
    const fuer = seiteRef.current;
    if (!fuer || !reiterKey) return null;
    const merk = `${ansichtKey}:${reiterKey}`, b = bilder.current[merk];
    if (b?.stand === bildStandRef.current) return b.el.cloneNode(true);
    const tmp = document.createElement('div'), sitzung = {};
    try { for (let n = 0; n < sessionStorage.length; n++) { const s = sessionStorage.key(n); sitzung[s] = sessionStorage.getItem(s); } } catch { /* egal */ }
    UNTER_VORSCHAU[ansichtKey] = reiterKey;
    try {
      render(fuer(ansichtKey), tmp);
      const el = document.createElement('div'); el.className = 'seite-haupt';
      el.append(...[...tmp.childNodes].map((n) => n.cloneNode(true)));
      el.querySelectorAll('.backdrop, .toast').forEach((x) => x.remove());
      bilder.current[merk] = { el, fuer, stand: bildStandRef.current };
      return el.cloneNode(true);
    } catch { return null; }
    finally {
      delete UNTER_VORSCHAU[ansichtKey];
      try { render(null, tmp); } catch { /* egal */ }
      try { for (const [s, w] of Object.entries(sitzung)) if (sessionStorage.getItem(s) !== w) sessionStorage.setItem(s, w); } catch { /* egal */ }
    }
  };
  // Stand der Daten, aus denen die Seitenbilder entstehen. Vorher galt jedes Bild nach JEDEM Neuzeichnen als veraltet (verglichen
  // wurde die bei jedem Zeichnen neue Seitenfunktion) – die App baute im Hintergrund ständig ganze Seiten neu (Statistik!).
  // Seiten mit Reitern beginnen beim Hereinkommen von links mit dem ersten, von rechts mit dem letzten Reiter – „Seite für Seite“.
  // (Gemerkt wird nur für die aktuelle Seite – fürs Neuladen.) Muss vor den Seitenbildern stehen, die das schon zeigen.
  useEffect(() => {
    const i = TABS.findIndex(([k]) => k === ansicht);
    if (i < 0) return;
    for (const [k, erster, letzter] of [['feed', 'feed', 'challenges'], ['statistik', 'profil', 'koerper'], ['programme', 'aktuell', 'plaene']]) {
      const j = TABS.findIndex(([x]) => x === k);
      if (j !== i) try { sessionStorage.setItem(`prh-reiter-${k}`, j > i ? erster : letzter); } catch { /* egal */ }
    }
  }, [ansicht]);
  const bildStand = useMemo(() => ({}), [trainings, einst, messwerte, masse, ausdauer, block, info, anpassungen, training?.id, phase, ansicht]);
  bildStandRef.current = bildStand;
  // Bilder der anderen Reiter im Leerlauf vorbereiten (nur wenn sich Daten geändert haben, Nachbarn zuerst) – der Wischbeginn baut dann nichts
  useEffect(() => {
    const nr = ++vorbereitung.current;
    const i = TABS.findIndex(([k]) => k === ansicht);
    if (phase !== 'bereit' || i < 0) return;
    const reihe = TABS.map(([k], n) => [k, Math.abs(n - i)]).filter(([, d]) => d > 0).sort((x, y) => x[1] - y[1]).map(([k]) => k);
    const leer = window.requestIdleCallback ?? ((f) => setTimeout(f, 60));
    const weiter = () => {
      if (nr !== vorbereitung.current) return;
      if (zugLaeuft.current) { setTimeout(weiter, 500); return; }
      const k = reihe.find((x) => bilder.current[x]?.stand !== bildStandRef.current);
      if (k) leer(() => { if (nr !== vorbereitung.current) return; bildVon(k, true); setTimeout(weiter, 40); }, { timeout: 2500 });
    };
    setTimeout(weiter, 350);
    // Nachbar-Kategorien (Feed, Statistik) danach, damit auch das Wischen zwischen ihnen sofort ein Bild hat
    setTimeout(() => {
      if (nr !== vorbereitung.current || zugLaeuft.current) return;
      const u = UNTERREITER[ansicht];
      for (const rk of [u?.weiterKey, u?.zurueckKey].filter(Boolean)) leer(() => { if (nr === vorbereitung.current && !zugLaeuft.current) bildUnter(ansicht, rk); }, { timeout: 3000 });
    }, 900);
  });
  // 172/178: Wischen – Seitenwechsel auf den Reitern, vom linken Rand überall das Menü
  const zugZoom = useRef(1);
  const zugSeit = useRef(0);
  const zugNachholen = useRef([]);                              // schnell hinterher gewischt: Warteschlange, nacheinander mit kurzem Gleiten
  const zugObj = useRef(null);
  const tabGedrueckt = useRef(0);                               // Tab wechselt schon beim Berühren (nicht erst beim Loslassen)
  let wischZug;
  // Deckender Grund für Standbilder: Kopie der Hintergrund-Ebene (bzw. die Seitenfarbe). Damit verdeckt das Standbild die echte
  // Seite ganz, die darunter schon sichtbar ist und fertig gezeichnet wird – Android zeichnete die lange Statistik sonst erst beim
  // Austausch in Kacheln, und für ein Bild sah man nur den helleren Hintergrund (Flackern).
  // Deckender Grund als DAUERHAFTE Ebene (#deck-grund): Kopie des Hintergrunds, fertig gezeichnet und fast unsichtbar (0,001).
  // Beim Austausch nur einblenden – eine jedes Mal neu eingefügte, weichgezeichnete Kopie war auf dem Handy für ein paar
  // Millisekunden noch ohne Abdunklung und wirkte hell. Über ihr liegt das Standbild (z 21), unter ihr die echte Seite.
  const deckEbene = () => {
    let d = document.getElementById('deck-grund');
    if (!d) { d = document.createElement('div'); d.id = 'deck-grund'; d.setAttribute('aria-hidden', 'true'); document.body.append(d); }
    d.style.setProperty('--tabs-h', `${document.querySelector('.tabs')?.offsetHeight ?? 0}px`);
    const bg = document.documentElement.classList.contains('mit-bild') && document.getElementById('hintergrund');
    let g = d.firstElementChild;
    if (bg) {
      if (!g || g.dataset.bild !== bg.style.backgroundImage) { g?.remove(); g = document.createElement('div'); g.className = 'deck-bild'; g.dataset.bild = bg.style.backgroundImage; g.style.backgroundImage = bg.style.backgroundImage; d.prepend(g); }
      for (const v of ['--px', '--py', '--bild-dunkel']) g.style.setProperty(v, bg.style.getPropertyValue(v));
      d.classList.remove('ohne-bild');
    } else { g?.remove(); d.classList.add('ohne-bild'); }
    return d;
  };
  const deckAn = () => { const d = deckEbene(); d.classList.add('an'); return () => d.classList.remove('an'); };
  useEffect(() => { if (phase === 'bereit') setTimeout(deckEbene, 1500); }, [phase, einst.hintergrundDunkel]);   // vorab zeichnen lassen
  // Tippen auf einen Tab: kurz ein deckendes Standbild der alten Seite, bis die neue fertig gezeichnet ist
  const verdecktGehen = (k) => {
    const haupt = hauptRef.current, app = document.getElementById('app');
    if (!haupt || !app || zugLaeuft.current || k === jetzt.current.ansicht) { gehe(k); return; }
    const deck = document.createElement('div');
    deck.className = 'seite-nachbar'; deck.setAttribute('aria-hidden', 'true');
    deck.style.left = `${app.offsetLeft}px`; deck.style.width = `${app.offsetWidth}px`;
    const kopie = haupt.cloneNode(true);
    kopie.style.paddingTop = `${app.offsetTop}px`; kopie.style.transform = `translateY(${-scrollY}px)`;
    deck.append(kopie);
    deck.style.zIndex = '21'; deck.style.bottom = `${document.querySelector('.tabs')?.offsetHeight ?? 0}px`;
    document.body.append(deck);
    const aus = deckAn();
    gehe(k);
    requestAnimationFrame(() => requestAnimationFrame(() => { deck.remove(); aus(); }));
  };
  // Warteschlange schnell hintereinander gewischter Gesten: nacheinander mit kurzem Gleiten abarbeiten
  const naechsteGeste = () => {
    const nach = zugNachholen.current.shift();
    if (!nach) return;
    setTimeout(() => {
      if (zugLaeuft.current) { zugNachholen.current.unshift(nach); return; }      // gerade läuft eine andere Geste: danach dran
      if (zugObj.current.start(nach)) zugObj.current.ende(nach, true, 60); else zugNachholen.current = [];   // Ende der Reiter erreicht
    }, 0);
  };
  useWischen({ zurueck: () => wischRef.current.zurueck?.(), weiter: () => wischRef.current.weiter?.(), menueAuf: () => setMenue(true),
    seitenWechsel: () => !!wischRef.current.reiter || !!UNTERREITER[jetzt.current.ansicht],   // auch Seiten mit eigenen Reitern (Übung)
    zug: wischZug = {
      beschaeftigt: () => zugLaeuft.current && Date.now() - zugSeit.current < 2000,
      nachholen: (art) => { if (zugNachholen.current.length < 10) zugNachholen.current.push(art); if (!zugLaeuft.current) naechsteGeste(); },
      // Seitenwechsel per Wischen (Jefit-artig): Die hereinkommende Seite ist ein Bild (DOM-Kopie) – kein Aufbau, keine
      // Nebenwirkungen während des Ziehens. Gebaut wird die echte Seite erst nach dem Einschieben, verdeckt vom Bild.
      // Beide Ebenen bewegen sich in Prozent der eigenen Breite – unabhängig von Schriftgröße (zoom) und Bildschirmbreite.
      start: (art) => {
        // vorige Wisch-Animation läuft noch – hängt sie länger als 2 s (z. B. zweiter Finger, Zurück-Taste), Reste aufräumen
        if (zugLaeuft.current && Date.now() - zugSeit.current < 2000) return false;
        if (zugLaeuft.current) {
          document.querySelectorAll('.seite-nachbar').forEach((x) => x.remove());
          for (const el of [hauptRef.current, unterInhaltRef.current]) if (el) { el.style.transform = ''; el.style.visibility = ''; el.style.willChange = ''; el.classList.remove('gleitet'); }
          ebeneRef.current = null; unterInhaltRef.current = null; zugUnter.current = null;
        }
        zugSeit.current = Date.now();
        zugZoom.current = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;   // einmal je Geste, nicht je Bewegung
        zugUnter.current = null;
        if (art === 'menue') { setMenueZug(true); return true; }
        // Seite mit Unterreitern (Statistik, Feed): erst dort blättern
        const u = UNTERREITER[jetzt.current.ansicht], unter = u?.[art];
        let bild;
        if (unter) {
          zugUnter.current = unter;
          // Kopf und Reiter-Kacheln bleiben stehen – nur der Inhalt darunter gleitet, die Nachbar-Kategorie schiebt sich herein
          const ganz = bildUnter(jetzt.current.ansicht, u[art === 'weiter' ? 'weiterKey' : 'zurueckKey']);
          const inhalt = hauptRef.current?.querySelector('.unter-inhalt'), teil = ganz?.querySelector('.unter-inhalt');
          if (!inhalt || !teil) return true;                 // ohne Bild: wie früher nur leicht mitziehen
          const z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
          const r = inhalt.getBoundingClientRect(), leiste = hauptRef.current.querySelector('.reiter')?.getBoundingClientRect();
          const oben = (r.top > 0 ? r.top : Math.max(0, leiste?.bottom ?? 0)) / z;
          const rahmen = document.createElement('div');
          rahmen.className = 'seite-nachbar unter-nachbar';
          rahmen.setAttribute('aria-hidden', 'true');
          rahmen.style.left = `${r.left / z}px`; rahmen.style.width = `${r.width / z}px`; rahmen.style.top = `${oben}px`;
          teil.style.transform = `translateX(${art === 'weiter' ? 'calc(100% + 16px)' : 'calc(-100% - 16px)'})`;
          rahmen.append(teil);
          document.body.append(rahmen);
          ebeneRef.current = teil; unterInhaltRef.current = inhalt;
          inhalt.style.willChange = 'transform';               // eigene Ebene: nicht je Bild neu zeichnen
          zugLaeuft.current = true;
          return true;
        } else {
          const key = wischRef.current[art === 'weiter' ? 'weiterKey' : 'zurueckKey'];
          bild = key ? bildVon(key) : null;
          if (!bild) return false;
        }
        // Rahmen mit genau der Fläche der echten Seite (#app: Rand des body, höchstens 520 px breit) – sonst Spalt
        // beim Ziehen und ein Sprung um den Rand beim Tausch. Darin gleitet das Bild, durchsichtig wie die echte Seite.
        const app = document.getElementById('app'), rahmen = document.createElement('div');
        rahmen.className = 'seite-nachbar';
        rahmen.setAttribute('aria-hidden', 'true');
        rahmen.style.left = `${app.offsetLeft}px`; rahmen.style.width = `${app.offsetWidth}px`;
        bild.style.paddingTop = `${app.offsetTop}px`;
        bild.style.transform = `translateX(${art === 'weiter' ? 'calc(100% + 16px)' : 'calc(-100% - 16px)'})`;
        rahmen.append(bild);
        document.body.append(rahmen);
        ebeneRef.current = bild;
        if (hauptRef.current) hauptRef.current.style.willChange = 'transform';   // eigene Ebene: nicht je Bild neu zeichnen
        zugLaeuft.current = true;
        return true;
      },
      bewege: (art, dx) => {
        const z = zugZoom.current;                    // Schriftgröße skaliert die App (zoom); je Bewegung neu lesen erzwang Layout
        if (art === 'menue') {
          const l = document.querySelector('.seitenmenue.vorschau .sm-leiste'), h = document.querySelector('.seitenmenue.vorschau .sm-hinter');
          if (!l) return;
          const w = l.offsetWidth, x = Math.min(0, Math.max(-w, dx / z - w));
          l.style.transform = `translateX(${x}px)`; h.style.opacity = String(1 + x / w);
          return;
        }
        const d = (art === 'weiter' ? Math.min(0, dx) : Math.max(0, dx)) / z;
        if (zugUnter.current && !ebeneRef.current) { if (hauptRef.current) hauptRef.current.style.transform = `translateX(${d * 0.35}px)`; return; }
        (unterInhaltRef.current ?? hauptRef.current).style.transform = `translateX(${d}px)`;
        if (ebeneRef.current) ebeneRef.current.style.transform = `translateX(calc(${art === 'weiter' ? '100% + 16px' : '-100% - 16px'} + ${d}px))`;
      },
      ende: (art, erfolg, dauer = 100) => {
        if (art === 'menue') {
          const l = document.querySelector('.seitenmenue.vorschau .sm-leiste'), h = document.querySelector('.seitenmenue.vorschau .sm-hinter');
          if (l) { l.classList.add('gleitet'); h.classList.add('gleitet'); l.style.transform = erfolg ? 'translateX(0)' : 'translateX(-100%)'; h.style.opacity = erfolg ? '1' : '0'; }
          setTimeout(() => {
            if (l) { l.classList.remove('gleitet'); h.classList.remove('gleitet'); l.style.transform = ''; h.style.opacity = ''; }
            if (erfolg) { setMenueGezogen(true); setMenue(true); }
            setMenueZug(false);
          }, 190);
          return;
        }
        const haupt = unterInhaltRef.current ?? hauptRef.current, ebene = ebeneRef.current;
        const unterWechsel = zugUnter.current;
        if (zugUnter.current && !ebene) {
          const unter = zugUnter.current; zugUnter.current = null;
          if (erfolg) { if (haupt) haupt.style.transform = ''; unter(); return; }
          haupt?.classList.add('gleitet'); if (haupt) haupt.style.transform = 'translateX(0)';
          setTimeout(() => { haupt?.classList.remove('gleitet'); if (haupt) haupt.style.transform = ''; }, 160);
          return;
        }
        for (const el of [haupt, ebene]) if (el) { el.classList.add('gleitet'); el.style.transitionDuration = `${dauer}ms`; }
        if (haupt) haupt.style.transform = erfolg ? `translateX(${art === 'weiter' ? 'calc(-100% - 16px)' : 'calc(100% + 16px)'})` : 'translateX(0)';
        if (ebene) ebene.style.transform = erfolg ? 'translateX(0)' : `translateX(${art === 'weiter' ? 'calc(100% + 16px)' : 'calc(-100% - 16px)'})`;
        setTimeout(() => {
          zugUnter.current = null;
          const key = unterWechsel ? 'unter' : wischRef.current[art === 'weiter' ? 'weiterKey' : 'zurueckKey'];
          const fertig = () => {
            if (haupt) { haupt.style.visibility = ''; haupt.style.opacity = ''; haupt.style.transform = ''; haupt.style.transitionDuration = ''; haupt.classList.remove('gleitet'); }
            // Ebene im selben Moment auflösen und das Bild im selben Moment entfernen, in dem die echte Seite erscheint.
            // (04.11. war das Bild 2 Bilder länger liegen geblieben – dann lagen beide halbdurchsichtigen Seiten übereinander
            // und alles wurde kurz heller, auf allen Seiten.)
            for (const el of [haupt, hauptRef.current]) if (el) el.style.willChange = '';
            unterInhaltRef.current = null;
            ebene?.parentElement?.remove(); ebeneRef.current = null;
            zugLaeuft.current = false;
            naechsteGeste();                     // weitere schnell hinterher gewischte Gesten (Warteschlange)
          };
          if (erfolg && key) {
            // Das Bild deckt alles ab, bis die neue Seite gebaut ist. Ihre Einblend-Animationen werden verdeckt sofort zu Ende
            // gespult (das Bild zeigte schon den Endstand) – früher: Klasse aus und nach 0,4 s wieder an, das startete die
            // Animation neu und alle Kacheln sprangen.
            // fast durchsichtig statt unsichtbar: so zeichnet der Browser die neue Seite schon vor (visibility:hidden zeichnet nichts –
            // bei der langen Statistik fehlte beim Austausch ein Bild lang Inhalt). Karten haben keine Unschärfe mehr, opacity stört nicht.
            const rahmen = ebene?.parentElement, deckt = !unterWechsel && rahmen;     // Seitenwechsel: Standbild deckend machen
            let deckAus = null;
            if (deckt) { rahmen.style.zIndex = '21'; rahmen.style.bottom = `${document.querySelector('.tabs')?.offsetHeight ?? 0}px`; deckAus = deckAn(); }
            if (haupt) { haupt.style.opacity = deckt ? '' : '0.001'; haupt.classList.remove('gleitet'); haupt.style.transform = ''; haupt.style.transitionDuration = ''; }
            if (unterWechsel) unterWechsel(); else gehe(key);
            const bilder = 2, nachBildern = (n, f) => (n ? requestAnimationFrame(() => nachBildern(n - 1, f)) : f());
            nachBildern(bilder, () => {
              const neu = unterWechsel ? hauptRef.current?.querySelector('.unter-inhalt') ?? haupt : haupt;
              for (const a of neu?.getAnimations?.({ subtree: true }) ?? []) {
                try { if (a.effect?.getComputedTiming?.().iterations !== Infinity) a.finish(); } catch { /* egal */ }
              }
              fertig();
              deckAus?.();
            });
          } else {
            if (haupt) { haupt.classList.remove('gleitet'); haupt.style.transform = ''; }
            fertig();
          }
        }, dauer + 10);
      },
    } });
  zugObj.current = wischZug;
  if (phase === 'fehler') return html`<div class="screen"><span class="logo" style="margin-top:20px"><b>PR</b> Hunter</span><p class="fehler">Start fehlgeschlagen: ${fehler}</p></div>`;
  if (phase === 'laden') return html`<div class="screen"><span class="logo" style="margin-top:20px"><b>PR</b> Hunter</span><p class="muted">Lade …</p></div>`;
  if (phase === 'anmelden') return html`<${Anmeldung} angemeldet=${(s) => starte({ id: s.user.id, email: s.user.email })}
    zurueck=${nutzer ? () => setPhase('bereit') : null}/>`;

  // Programme für die Ansichten (Datei → Definition); der aktive Block nutzt die Version, mit der er gestartet wurde
  const programme = Object.fromEntries(Object.entries(info).map(([d, p]) => [d, p.versionen[p.version] ?? Object.values(p.versionen).at(-1)]));
  for (const [d, p] of Object.entries(info)) if (!p.vorlage) NAMEN[d] = p.name;
  const blockDef = block ? info[block.datei]?.versionen[block.version] ?? programme[block.datei] : null;
  const aktiverBlock = blockDef ? block : null;
  if (aktiverBlock) programme[aktiverBlock.datei] = blockDef;
  const tage = aktiverBlock ? tageMitOptionen(blockTage(blockDef, { ...aktiverBlock, cut: einst.cut }), aktiverBlock) : [];
  // Wer die geplanten Tage sieht, regelt die Freigabe je Freund (Update 21) – hochgeladen wird immer
  planTage.current = tage.filter((t) => t.datum >= heuteLokal() && !t.uebersprungen).slice(0, 40)
    .map((t) => ({ datum: t.datum, offset: t.offset, keys: t.uebungen.map((u) => u.key).filter(Boolean), ...(t.label ? { label: t.label } : {}) }));
  // Erledigt nach Datum des Plantags (bei verschobenen Tagen das neue Datum)
  const datumVon = new Map(tage.map((t) => [t.offset, t.datum]));
  const erledigt = DEMO ? demoErledigt : new Set(trainings.filter((t) => aktiverBlock && t.runId === aktiverBlock.id && t.tagOffset != null && !t.geloescht)
    .map((t) => datumVon.get(t.tagOffset) ?? plusTage(aktiverBlock.start, t.tagOffset)));
  const offen = trainings.filter((t) => t.offen).length;
  const einstUi = { ...einst, koerpergewicht: DEMO ? demoKg ?? KOERPERGEWICHT : KOERPERGEWICHT };

  const gehe = (a, key = null, ersetzen = false) => {
    scrollPos.current[jetzt.current.ansicht] = scrollY;
    if (a === 'rechner') setRechnerArt(key);
    setAnsicht(a);
    // Ins laufende Training an die gleiche Stelle zurück, sonst nach oben
    const y = a === 'training' ? scrollPos.current.training ?? 0 : 0;
    scrollTo(0, 0); if (y) setTimeout(() => scrollTo(0, y), 30);
    const st = { ansicht: a, key };
    // beim Ersetzen die Markierung der untersten Ebene behalten (Schutz gegen Schließen der App)
    const ebene = history.state?.wurzel ? { wurzel: true } : {};
    if (ersetzen || (history.state?.ansicht === a && history.state?.key === key)) history.replaceState({ ...st, ...ebene }, '', adresse(a, key));
    else ansichtEintragen(st, adresse(a, key));
  };
  const zuUebung = (key, zurueck) => { setUebungAnsicht({ key, zurueck }); gehe('uebung', key); };
  const setEinst = (neu) => {
    if (neu.koerpergewicht !== einstUi.koerpergewicht && neu.koerpergewicht > 0) {
      if (DEMO) setDemoKg(neu.koerpergewicht);
      else {
        const me = konto.setzeMesswert(messwerte, heuteLokal(), neu.koerpergewicht);
        setMesswerte(me); sp.current.setzeMeta('messwerte', me).then(abgleich);
      }
    }
    const { koerpergewicht, offen: _o, ...rest } = neu;
    const { offen: _p, ...alt } = einst;
    const e = { ...alt, ...rest, vergleichGeaendert: alt.vergleichGeaendert || rest.vergleich !== alt.vergleich };
    if (JSON.stringify(e) === JSON.stringify({ ...alt, vergleichGeaendert: e.vergleichGeaendert })) return;   // nichts geändert
    setEinstRoh({ ...e, offen: !DEMO });
    if (!DEMO) sp.current.setzeMeta('einst', { ...e, offen: true }).then(abgleich);
  };
  const wachBleiben = () => { try { navigator.wakeLock?.request('screen').then((l) => { sperre.current = l; }).catch(() => {}); } catch { /* egal */ } };
  const mitCheck = einst.bereitschaft !== false;
  const startePlan = (tag, bereitschaft = null, leicht = tag.datum === HEUTE && leichter) => {
    tonFreigeben(); wachBleiben();
    const nr = wochenListe(tage).indexOf(tag.woche) + 1;
    vibriere(120);                                                   // kurz: Training läuft (60 ms war kaum spürbar)
    setTraining({ id: neueId(), start: Date.now(), datum: heuteLokal(), planDatum: tag.datum, titel: `Woche ${nr} · ${datumLang(tag.datum).split(',')[0]}`,
      runId: aktiverBlock?.id ?? null, woche: tag.woche, tagOffset: tag.offset, bereitschaft,
      // nur die erste Übung offen, die übrigen eingeklappt (klappen nacheinander auf, siehe Training)
      karten: beschwerdenAnwenden(baueTraining(tag, { leichter: leicht, koerperKg: einstUi.koerpergewicht, autoFuer: einst.autoregulation ? autoFuer() : null }),
        anpassungFuer(tag.uebungen.map((u) => u.key), einst.beschwerden, HEUTE, uebung), einstUi.koerpergewicht,
        (r) => { const x = REGIONEN.find(([k]) => k === r); return x ? deEn(x[1], x[2]) : r; }).map((k) => (k.key ? ausruestungUebernehmen(k) : k)).map((k, i) => (i > 0 && k.key ? { ...k, zu: true } : k)) });
    gehe('training');
  };
  // 183: letzte drei Einheiten je Übung (Arbeitssätze) für die Autoregulation
  const autoFuer = () => {
    const je = new Map();
    for (const e of normiere(trainings)) for (const u of e.uebungen) je.set(u.key, [...(je.get(u.key) ?? []), { datum: e.datum, saetze: u.saetze }].slice(-3));
    return (key, ziel) => (je.has(key) ? autoregulation(je.get(key), ziel) : null);
  };
  const starteFrei = (bereitschaft = null) => {
    tonFreigeben(); wachBleiben();
    vibriere(120);                                                   // kurz: Training läuft (60 ms war kaum spürbar)
    setTraining({ id: neueId(), start: Date.now(), datum: heuteLokal(), planDatum: null, titel: 'Freies Training', runId: null, bereitschaft, karten: [] });
    gehe('training');
  };
  const starten = (tag) => { if (training) gehe('training'); else if (mitCheck) setBereit({ tag }); else startePlan(tag); };
  const freiStarten = () => { if (mitCheck) setBereit({ frei: true }); else starteFrei(); };
  const startenAm = (d) => { const t = tage.find((x) => x.datum === d); if (t) starten(t); };
  aktionFn.current = (a) => {
    if (a === 'training') { const t = tage.find((x) => x.datum === HEUTE && !erledigt.has(x.datum) && !x.uebersprungen); if (training) gehe('training'); else if (t) starten(t); else freiStarten(); }
    else if (a === 'gewicht') { gehe('heute'); setTimeout(() => document.querySelector('.gewicht-karte, .g6-zahl')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300); }
    else if (['statistik', 'feed', 'verlauf', 'programme'].includes(a)) gehe(a);
  };
  const beenden = async ({ sessionRpe = null, notiz = null, verwerfen = false, ende = null } = {}) => {
    const t = ende ? { ...training, ende } : training;     // ende: von Hand eingetragen (vergessenes Training)
    const fertig = alleSaetze(t).filter((s) => s.erledigt).length;
    setTraining(null); setTimer(null);
    try { sperre.current?.release(); } catch { /* egal */ }
    gehe(t.bearbeiten ? 'verlauf' : 'heute');
    if (!fertig || verwerfen) {
      setToast(t.bearbeiten ? { titel: 'Bearbeitung verworfen', text: 'Das gespeicherte Training bleibt unverändert.' }
        : { titel: 'Training verworfen', text: verwerfen ? 'Nichts gespeichert.' : 'Kein Satz abgehakt, nichts gespeichert.' });
      return;
    }
    if (!t.bearbeiten && chipsAus(notiz ?? '').ids.includes('zwickt')) beschwerdeNachAbschluss.current = true;   // 216
    if (!t.bearbeiten) {
      // Motivation: Woche, Serie, Ø Volumen der letzten 5 Trainings, erstes Training, Block fertig (das neue Training ist noch nicht in trainings)
      const E = normiere(trainings.filter((x) => x.id !== t.id)), daten = [...E.map((e) => e.datum), t.datum];
      const vol = (e) => e.uebungen.reduce((s, u) => s + u.saetze.reduce((b, x) => b + (x.kg > 0 ? x.kg : 0) * (x.wdh ?? 0), 0), 0);
      const letzte = E.slice(-5).map(vol).filter((v) => v > 0);
      // 184: Abzeichen vorher/nachher (das neue Training als gespeichertes Format dazu)
      const neu = { datum: t.datum, start: t.start, ende: ende ? Date.parse(ende) : Date.now(), uebungen: t.karten.filter((k) => k.key).map((k) => ({ key: k.key,
        saetze: k.gruppen.flatMap((g) => g.saetze.filter((s) => s.erledigt).map((s) => ({ kg: s.kg, wdh: s.wdh, rpe: s.rpe, typ: s.typ, fertig: true }))) })) };
      const opt = { powerlifting: einst.trainingsart !== 'einfach', ausdauer, wahl: einst.ausdauer };
      const abzeichen = neueAbzeichen(erfolge(E, opt), erfolge([...E, ...normiere([neu])], opt));
      const motivation = { vorname: einst.vorname, ziel: einst.wochenziel ?? 3, erstes: !E.length, abzeichen,
        woche: new Set(daten.filter((d) => montagVon(d) === montagVon(t.datum))).size, serie: wochenSerie(daten, t.datum).aktuell,
        schnitt: letzte.length ? letzte.reduce((a, b) => a + b, 0) / letzte.length : 0,
        blockFertig: !!(t.planDatum && tage.length && tage.every((x) => x.datum === t.planDatum || erledigt.has(x.datum))) };
      setAbschluss({ ...abschlussAus(t, ende ? Date.parse(ende) : Date.now()), motivation }); vibriere([120, 80, 160]);
    }   // gespeichert: doppelt
    if (DEMO) { if (t.planDatum) setDemoErledigt(new Set([...demoErledigt, t.planDatum])); setToast({ titel: 'Training gespeichert', text: `${t.titel} ist erledigt.` }); return; }
    // Beim Bearbeiten bleiben Ende und Körpergewicht des Originals, sonst gelten jetzt und das aktuelle Körpergewicht
    const w = ausTraining(t, { id: t.id, sessionRpe, notiz, ...(t.ende && (t.bearbeiten || ende) ? { ende: t.ende } : {}),
      koerpergewicht: (t.bearbeiten ? t.koerpergewicht : null) ?? einstUi.koerpergewicht ?? null });
    await sp.current.schreibe(w);
    setTrainings((alt) => [...alt.filter((x) => x.id !== w.id), w]);
    setToast(t.bearbeiten ? { titel: 'Änderung gespeichert', text: datumLang(t.datum) }
      : { titel: 'Training gespeichert', text: navigator.onLine ? `${t.titel} wird hochgeladen.` : `${t.titel} – Upload, sobald Netz da ist.` });
    abgleich();
  };
  const bearbeiten = (id) => {
    if (training) { setToast({ titel: 'Training läuft', text: 'Erst das laufende Training beenden.' }); gehe('training'); return; }
    const w = trainings.find((x) => x.id === id);
    if (!w) return;
    setTraining({ ...zuTraining(w), titel: `Korrektur · ${datumLang(w.datum)}` });
    gehe('training');
  };
  // 182: Körpermaße eines Tages setzen (ergänzt einen vorhandenen Eintrag), dann abgleichen
  // 222: Ausdauer speichern/löschen – lokal sofort, Konto beim Abgleich
  const ausdauerSpeichern = (a) => {                              // eine Einheit oder mehrere (Datei-Import)
    const liste = (Array.isArray(a) ? a : [a]).map((x) => ({ ...x, offen: true })), ids = new Set(liste.map((x) => x.id));
    const neu = [...liste, ...ausdauer.filter((x) => !ids.has(x.id))].sort((x, y) => y.datum.localeCompare(x.datum));
    setAusdauer(neu); sp.current.setzeMeta('ausdauer', neu).then(() => { if (!DEMO) abgleich(); });
  };
  const ausdauerLoeschen = (a) => ausdauerSpeichern({ ...a, geloescht: true });
  // 235/236: geplante Einheit abhaken; Beintage aus dem Kraftplan (Kniebeuge/Kreuzheben) für die Ausdauer-Planung
  const geplantEintragen = (e) => { if (!auPlan) return; ausdauerSpeichern(alsEintrag(e, auPlan, crypto.randomUUID())); setToast({ titel: deEn('Eingetragen', 'Logged'), text: deEn('Zeiten bei Bedarf im Verlauf anpassen.', 'Adjust times in History if needed.') }); };
  // Beintag: Kniebeuge/Kreuzheben oder mindestens zwei Übungen mit Beinen als Hauptmuskel (Bodybuilding, eigene Pläne)
  const BEINE = new Set(['quadriceps', 'hamstrings', 'glutes']);
  const istBeinTag = (t) => t.keys.some((k) => ['squat', 'dead'].includes(liftVon(k))) || t.keys.filter((k) => BEINE.has(uebung(k)?.m?.[0])).length >= 2;
  // 240/246: Kraft- und Beintage aus dem echten Plan (ab heute, so weit geplant), sonst aus dem Raster des Kombi-Plans
  const echtBis = planTage.current.at(-1)?.datum ?? null, echt = (d) => echtBis && d >= heuteLokal() && d <= echtBis;
  const raster = einst.ausdauerPlan?.woche ?? null;
  const planKraftTag = (d) => (echt(d) ? planTage.current.some((t) => t.datum === d) : !!raster && hatKraft(raster[wochentag(d)]));
  const planBeinTag = (d) => (echt(d) ? planTage.current.some((t) => t.datum === d && istBeinTag(t)) : !!raster && hatKraft(raster[wochentag(d)]) && einst.ausdauerPlan?.bein?.[wochentag(d)] !== false);
  const auPlan = aktuellerPlan(einst.ausdauerPlan, { kraftTag: planKraftTag, beinTag: planBeinTag });
  const masseSetzen = (datum, werte) => {
    if (DEMO) { setToast({ titel: 'Nur mit Konto', text: 'Körpermaße speichert das Konto.' }); return; }
    const alt = masse.find((m) => m.datum === datum);
    const neu = [...masse.filter((m) => m.datum !== datum), { datum, werte: { ...(alt?.werte ?? {}), ...werte }, offen: true }].sort((a, b) => a.datum.localeCompare(b.datum));
    setMasse(neu); sp.current.setzeMeta('masse', neu).then(abgleich);
    setToast({ titel: 'Maße gespeichert', text: datumLang(datum) });
  };
  // 188: vergangenes Training mit denselben Übungen und Sätzen (kg × Wdh als Vorgabe, nichts abgehakt) neu starten
  const wiederholen = (id) => {
    if (training) { setToast({ titel: 'Training läuft', text: 'Erst das laufende Training beenden.' }); gehe('training'); return; }
    const w = trainings.find((x) => x.id === id);
    if (!w) return;
    tonFreigeben(); wachBleiben(); vibriere(120);
    const karten = zuTraining(w).karten.map(({ uid: _u, ...k }, i) => ({ ...k, id: i, zu: i > 0, gruppen: k.gruppen.map((g) => ({ ...g,
      saetze: g.saetze.map(({ id: _i, zeit: _z, ...s }) => ({ ...s, kgPlan: s.kg, erledigt: false, e1rm: null, pr: false, geaendert: false })) })) }));
    setTraining({ id: neueId(), start: Date.now(), datum: heuteLokal(), planDatum: null, titel: `Wie am ${datumKurz(w.datum)}`, runId: null, bereitschaft: null, karten });
    gehe('training');
  };
  // 166: importierte Trainings (je Datum eines, Quelle „manual“) speichern und abgleichen
  // Körpergewicht aus anderen Apps: je Tag ein Wert, übernommene Tage ersetzen (Auswahl trifft GewichtImport), dann abgleichen
  const gewichteImportieren = async (liste) => {
    if (DEMO) { setToast({ titel: 'Nur mit Konto', text: 'Import speichert im Konto.' }); return; }
    const nach = new Map(messwerte.map((m) => [m.datum, m]));
    for (const w of liste) nach.set(w.datum, { datum: w.datum, kg: w.kg, offen: true });
    const me = [...nach.values()].sort((a, b) => a.datum.localeCompare(b.datum));
    setMesswerte(me);
    await sp.current.setzeMeta('messwerte', me);
    abgleich();
  };
  const trainingsImportieren = async (liste) => {
    if (DEMO) { setToast({ titel: 'Nur mit Konto', text: 'Import speichert im Konto.' }); return; }
    const neu = liste.map((t) => {
      const id = neueId();
      return { id, clientId: id, datum: t.datum, start: null, ende: null, sessionRpe: null, koerpergewicht: null, notiz: 'Import', quelle: 'manual',
        runId: null, woche: null, tagOffset: null, bereitschaft: null, offen: true, geloescht: false,
        uebungen: t.uebungen.map((u) => ({ id: neueId(), key: u.key, notiz: null,
          saetze: u.saetze.map((s) => ({ id: neueId(), typ: 'working', kg: s.kg, wdh: s.wdh, rpe: s.rpe, fertig: true, zeit: null, geplant: null, ...(s.notiz ? { notiz: s.notiz } : {}) })) })) };
    });
    for (const w of neu) await sp.current.schreibe(w);
    setTrainings((alt) => [...alt, ...neu]);
    setToast({ titel: 'Import gespeichert', text: `${neu.length} Trainings – Upload läuft.` });
    abgleich();
  };
  const loeschen = async (id) => {
    const w = trainings.find((x) => x.id === id);
    if (!w) return;
    const neu = { ...w, geloescht: true, offen: true };
    await sp.current.schreibe(neu);
    setTrainings((alt) => alt.map((x) => (x.id === id ? neu : x)));
    setToast({ titel: 'Training gelöscht', text: datumLang(w.datum) });
    abgleich();
  };
  const blockSetzen = async (b) => {
    if (DEMO) { setBlock(b ? { id: 'demo', ...b } : null); return; }
    if (!b) {
      if (block) await sp.current.setzeMeta('block', { ...block, ende: 'finished', offen: true });
      setBlock(null); abgleich(); return;
    }
    const p = info[b.datei];
    if (!p?.id) { setToast({ titel: 'Noch nicht möglich', text: 'Die App muss einmal mit Netz abgleichen, damit die Vorlagen bekannt sind.' }); return; }
    // Gleicher Block (gleiche Datei, nicht neu gestartet): ID, Version und verschobene Tage bleiben
    const gleich = block && block.datei === b.datei && !b.neu;
    const neu = { id: gleich ? block.id : neueId(), datei: b.datei, programmId: p.id, version: b.version ?? (gleich ? block.version : p.version),
      start: b.start, werte: b.werte, alternativ: !!b.alternativ,
      verschoben: b.verschoben ?? (gleich && b.start === block.start ? block.verschoben ?? {} : {}),
      uebersprungen: b.uebersprungen ?? (gleich && b.start === block.start ? block.uebersprungen ?? [] : []), offen: true };
    await sp.current.setzeMeta('block', neu); setBlock(neu); abgleich();
  };
  // Einen Plantag verschieben ({ datum }, null = zurück) oder überspringen ({ weg: true })
  const tagOption = (offset, { datum, weg = false, rest = false }) => {
    const verschoben = { ...(aktiverBlock.verschoben ?? {}) };
    if (rest && datum) {
      // Rest des Blocks mitverschieben: dieser und alle späteren offenen Plantage um denselben Abstand
      const von = tage.find((x) => x.offset === offset);
      const delta = tageZwischen(von.datum, datum);
      for (const x of tage) if (x.datum >= von.datum && !erledigt.has(x.datum) && !x.uebersprungen) verschoben[x.offset] = plusTage(x.datum, delta);
    } else if (datum !== undefined) { if (datum) verschoben[offset] = datum; else delete verschoben[offset]; }
    const uebersprungen = weg ? [...new Set([...(aktiverBlock.uebersprungen ?? []), offset])] : aktiverBlock.uebersprungen ?? [];
    blockSetzen({ ...aktiverBlock, verschoben, uebersprungen });
    setToast(weg ? { titel: 'Übersprungen', text: 'Weiter mit dem nächsten Plantag.' } : datum ? { titel: rest ? 'Block verschoben' : 'Verschoben', text: `${rest ? 'Ab ' : 'Auf '}${datumLang(datum)}` } : { titel: 'Zurück auf dem Plan', text: '' });
  };
  const importieren = async (p, { quelle = 'import', datei: von = null } = {}) => {
    if (DEMO) { const d = `import:${p.name}`; setInfo({ ...info, [d]: { id: null, version: 1, name: p.name, vorlage: false, versionen: { 1: p } } }); return d; }
    if (!navigator.onLine) throw new Error('Zum Speichern eines Programms braucht das Handy Netz.');
    const [d, eintrag] = await konto.programmAnlegen(supabase(), p, { quelle, basiertAuf: von ? info[von]?.id ?? null : null });
    const inf = { ...info, [d]: eintrag };
    setInfo(inf); await sp.current.setzeMeta('programme', inf);
    return d;
  };
  // Eigene Programme: überschreiben (der aktive Block rechnet ab sofort damit, erledigte Trainings bleiben), umbenennen, archivieren
  const infoSetzen = async (inf) => { setInfo(inf); if (!DEMO) await sp.current.setzeMeta('programme', inf); };
  setzeDienste({
    meldung: setToast,
    // 265: Körpergewicht eines Tages ändern oder löschen (kg null)
    gewichtAendern: (datum, kg) => {
      if (DEMO) { setToast({ titel: 'Nur mit Konto', text: 'In der Demo bleiben die Beispielwerte.' }); return; }
      const me = konto.setzeMesswert(messwerte, datum, kg);
      setMesswerte(me); sp.current.setzeMeta('messwerte', me).then(abgleich);
      setToast({ titel: kg > 0 ? deEn('Gewicht geändert', 'Weight changed') : deEn('Eintrag gelöscht', 'Entry deleted'), text: datumLang(datum) });
    },
    ladeReaktionen: DEMO ? null : (ids) => konto.ladeReaktionen(supabase(), ids),
    liken: DEMO ? null : (id, an) => konto.liken(supabase(), id, an),
    kommentieren: DEMO ? null : (id, text) => konto.kommentieren(supabase(), id, text),
    kommentarLoeschen: DEMO ? null : (kid) => konto.kommentarLoeschen(supabase(), kid),
    planSenden: DEMO ? null : (an, name, def) => konto.planSenden(supabase(), an, name, def),
    geteiltePlaene: DEMO ? null : () => konto.geteiltePlaene(supabase()),
    geteiltenEntfernen: DEMO ? null : (id) => konto.geteiltenEntfernen(supabase(), id),
    ladeChallenges: DEMO ? null : () => konto.ladeChallenges(supabase()),
    challengeAnlegen: DEMO ? null : (c) => konto.challengeAnlegen(supabase(), c),
    challengeAntworten: DEMO ? null : (id, dabei) => konto.challengeAntworten(supabase(), id, dabei),
    mitmachen: DEMO ? null : (a) => mitmachen(a),
    intervalsStatus: DEMO ? null : () => konto.intervalsStatus(supabase()),
    intervalsAktion: DEMO ? null : async (aktion, daten) => { const r = await konto.intervalsAktion(supabase(), aktion, SUPABASE_URL, daten); setTimeout(abgleich, aktion === 'verbinden' ? 8000 : 0); return r; },
    stravaStatus: DEMO ? null : () => konto.stravaStatus(supabase()),
    stravaAktion: DEMO ? null : async (aktion, daten) => { const r = await konto.stravaAktion(supabase(), aktion, SUPABASE_URL, daten); if (aktion !== 'start') abgleich(); return r; },
    coachBeziehungen: DEMO ? null : async () => { const r = await konto.coachBeziehungen(supabase()); setCoachOffen(coachZahl(r)); return r; },
    coachAnfragen: DEMO ? null : (id) => konto.coachAnfragen(supabase(), id),
    coachAntworten: DEMO ? null : (id, ja) => konto.coachAntworten(supabase(), id, ja),
    coachBeenden: DEMO ? null : (id) => konto.coachBeenden(supabase(), id),
    athletTrainings: DEMO ? null : (id) => konto.athletTrainings(supabase(), id),
    athletBlock: DEMO ? null : (id) => konto.athletBlock(supabase(), id),
    wettkampfSpeichern: (m) => { setEinst({ ...einst, wettkaempfe: [...(einst.wettkaempfe ?? []).filter((x) => x.id !== m.id), m] }); setToast({ titel: deEn('Wettkampf gespeichert', 'Meet saved'), text: deEn('Statistik → Kraft → Meine Wettkämpfe', 'Stats → Strength → My meets') }); },
    kalenderLink: DEMO ? null : async (neu = false) => `${SUPABASE_URL}/functions/v1/kalender?t=${await konto.kalenderToken(supabase(), neu)}`,
    melden: DEMO ? null : (id, name, text = '') => setFeedback({ art: 'meldung', betrifft: id, name, text }),
    programmSpeichern: async (datei, def) => {
      const p = info[datei];
      if (!DEMO && !navigator.onLine) throw new Error('Zum Speichern braucht das Handy Netz.');
      if (!DEMO && p.id) await konto.programmUeberschreiben(supabase(), p.id, p.version, def);
      await infoSetzen({ ...info, [datei]: { ...p, versionen: { ...p.versionen, [p.version]: def } } });
    },
    programmUmbenennen: async (datei, name) => {
      if (!DEMO) { if (!navigator.onLine) throw new Error('Zum Umbenennen braucht das Handy Netz.'); await konto.programmUmbenennen(supabase(), info[datei].id, name); }
      NAMEN[datei] = name;
      await infoSetzen({ ...info, [datei]: { ...info[datei], name } });
    },
    programmArchivieren: async (datei) => {
      if (!DEMO) { if (!navigator.onLine) throw new Error('Zum Archivieren braucht das Handy Netz.'); await konto.programmArchivieren(supabase(), info[datei].id); }
      const { [datei]: _weg, ...rest } = info;
      await infoSetzen(rest);
    },
  });
  // 126 b: vollständige Sicherung (JSON) und Einspielen – ergänzt nur fehlende Trainings und eigene Programme
  const sichern = () => herunterladen(JSON.stringify({ format: 'pr-hunter-sicherung', version: 1, exportiert: new Date().toISOString(),
    einst: (({ offen: _o, ...e }) => e)(einst), messwerte, masse, ausdauer: ausdauer.filter((a) => !a.geloescht), block, programme: Object.fromEntries(Object.entries(info).filter(([, p]) => !p.vorlage)),
    trainings: trainings.filter((t) => !t.geloescht) }, null, 1), `pr-hunter-sicherung_${heuteLokal()}.json`, 'application/json');
  const einspielen = async (datei) => {
    if (!datei) return;
    try {
      const d = JSON.parse(await datei.text());
      if (d.format !== 'pr-hunter-sicherung') throw new Error('Das ist keine PR-Hunter-Sicherung.');
      const fp = (w) => (w.uebungen ?? []).map((u) => trainingsSchluessel(w.datum, u.key, (u.saetze ?? []).filter((s) => s.fertig !== false && s.typ !== 'warmup'))).join('#');
      const ids = new Set(trainings.map((t) => t.id)), da = new Set(trainings.filter((t) => !t.geloescht).map(fp));
      const neu = (d.trainings ?? []).filter((w) => !w.geloescht && !ids.has(w.id) && !da.has(fp(w))).map((w) => ({ ...w, offen: true }));
      if (!DEMO) for (const w of neu) await sp.current.schreibe(w);
      setTrainings((alt) => [...alt, ...neu]);
      let progs = 0;
      for (const e of Object.values(d.programme ?? {})) {
        if (e.vorlage || Object.values(info).some((x) => x.name === e.name)) continue;
        const def = e.versionen?.[e.version] ?? Object.values(e.versionen ?? {}).at(-1);
        if (def) { await importieren({ ...def, name: e.name }, { quelle: 'import' }); progs++; }
      }
      setToast({ titel: 'Sicherung eingespielt', text: `${neu.length} Trainings und ${progs} Programme ergänzt.` });
      abgleich();
    } catch (e) { setToast({ titel: 'Nicht eingespielt', text: e.message }); }
  };
  const kalender = () => herunterladen(kalenderDatei(tage.filter((t) => t.datum >= heuteLokal() && !t.uebersprungen && !erledigt.has(t.datum)).slice(0, 60),
    (t) => `PR Hunter: ${t.label || [...new Set(t.uebungen.map((u) => liftVon(u.key)).filter((l) => l !== 'andere'))].map((l) => LIFT[l].name).join(' · ') || 'Training'}`),
  'pr-hunter-plan.ics', 'text/calendar');
  const exportieren = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([konto.exportCsv(trainings, nameVon)], { type: 'text/csv;charset=utf-8' }));
    a.download = `pr-hunter_${heuteLokal()}.csv`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const kontoLoeschen = async () => {
    if (!navigator.onLine) throw new Error('Zum Löschen braucht das Handy Netz.');
    if (training) throw new Error('Erst das laufende Training beenden.');
    // 14 Tage Frist (Update 20): vormerken, abmelden; innerhalb der Frist anmelden und abbrechen geht
    await konto.kontoLoeschenVormerken(supabase());
    try { await abmelden(); } catch { /* Login gibt es nicht mehr */ }
    await sp.current?.leeren();
    speicher.schreib('prh-nutzer', 'null');
    location.reload();
  };
  const raus = async () => {
    if (offen) { setToast({ titel: 'Noch nicht abmelden', text: `${offen} Training${offen === 1 ? ' ist' : 's sind'} nicht hochgeladen. Erst mit Netz abgleichen.` }); return; }
    if (training) { setToast({ titel: 'Training läuft', text: 'Erst beenden, dann abmelden.' }); return; }
    try { await abmelden(); } catch { /* lokal trotzdem abmelden */ }
    await sp.current?.leeren();
    speicher.schreib('prh-nutzer', 'null');
    location.reload();
  };

  jetzt.current = { ansicht, key: ansicht === 'uebung' ? uebungAnsicht?.key ?? null : ansicht === 'rechner' ? rechnerArt : null };
  {
    const i = TABS.findIndex(([k]) => k === ansicht);
    wischRef.current = { reiter: i >= 0, zurueck: i > 0 ? () => gehe(TABS[i - 1][0]) : null, weiter: i >= 0 && i < TABS.length - 1 ? () => gehe(TABS[i + 1][0]) : null,
      zurueckKey: i > 0 ? TABS[i - 1][0] : null, weiterKey: i >= 0 && i < TABS.length - 1 ? TABS[i + 1][0] : null };
  }
  const imTraining = ansicht === 'training' && training;
  // Inhalt einer Ansicht – für die aktuelle Seite und beim Wischen für die Nachbarseite, die schon mitläuft
  const seiteFuer = (ansicht) => {
    const imTraining = ansicht === 'training' && training;
    return imTraining ? html`<${Training} partner=${partner} t=${training} setT=${setTraining} timer=${timer} setTimer=${setTimer} einst=${einstUi} toast=${setToast} lichter=${setLichter}
        minimieren=${() => gehe('heute')} beenden=${beenden} zuVerlauf=${(key) => zuUebung(key, 'training')}/>`
      : ansicht === 'uebung' && uebungAnsicht ? html`<${UebungsSeite} key=${uebungAnsicht.key} schluessel=${uebungAnsicht.key} einst=${einstUi} setEinst=${setEinst} bloecke=${bloecke}
          zurueck=${() => gehe(uebungAnsicht.zurueck === 'training' && training ? 'training' : uebungAnsicht.zurueck === 'heute' ? 'heute' : 'verlauf')}
          zurueckText=${uebungAnsicht.zurueck === 'training' && training ? 'Zurück zum Training' : uebungAnsicht.zurueck === 'heute' ? 'Zurück zu Heute' : 'Zurück zum Verlauf'}/>`
      : ansicht === 'programme' ? html`<${Programme} ausdauer=${{ liste: ausdauer, beinTag: planBeinTag, kraftTag: planKraftTag, plan: auPlan, planTage: planTage.current, eintragen: geplantEintragen, kraftVerschieben: aktiverBlock && !training ? tagOption : null, zuUebung: (k) => zuUebung(k, 'programme') }} programme=${programme} info=${info} block=${aktiverBlock} setBlock=${blockSetzen} erledigt=${erledigt} toast=${setToast}
          sollIst=${aktiverBlock && !DEMO ? sollIst(tage, trainings, aktiverBlock.id) : []}
          neueMaxeFuer=${aktiverBlock && !DEMO ? (vertrauen) => neueMaxe(blockDef, aktiverBlock, trainings, projiziere, incStandard(), { vertrauen }) : null}
          zuHeute=${() => gehe('heute')} einst=${einstUi} setEinst=${setEinst} importieren=${importieren}/>`
      : ansicht === 'verlauf' ? html`<${Verlauf} ausdauer=${einstUi.ausdauer ? { liste: ausdauer, wahl: einstUi.ausdauer, speichern: ausdauerSpeichern, loeschen: ausdauerLoeschen } : null} planTage=${tage} erledigt=${erledigt} startenAm=${startenAm} zuUebung=${(key) => zuUebung(key, 'verlauf')}
          bearbeiten=${DEMO ? null : bearbeiten} loeschen=${DEMO ? null : loeschen} wiederholen=${DEMO ? null : wiederholen}/>`
      : ansicht === 'import' ? html`<${TrainingsImport} zurueck=${() => history.back()} vorhandene=${trainings} importieren=${trainingsImportieren}/>`
      : ansicht === 'gewicht' ? html`<${GewichtImport} zurueck=${() => history.back()} vorhandene=${messwerte} importieren=${gewichteImportieren}/>`
      : ansicht === 'datenschutz' ? html`<${Datenschutz} zurueck=${() => history.back()}/>`
      : ansicht === 'coach' ? html`<${CoachSeite} zurueck=${() => history.back()}
          plaene=${Object.entries(info).map(([d, p]) => ({ name: p.name ?? NAMEN[d] ?? d, def: programme[d], eigen: !p.vorlage })).filter((p) => p.def).sort((a, b) => b.eigen - a.eigen)}/>`
      : ansicht === 'feed' ? html`<${Feed} einst=${einstUi} setEinst=${setEinst} anfragen=${anfragen + coachOffen} neuReakt=${neuReakt} gesehen=${reaktionenGesehen} aktiv=${aktiveFreunde} zuEinstellungen=${() => gehe('einstellungen')}/>`
      : ansicht === 'statistik' ? html`<${Statistik} einst=${einstUi} setEinst=${setEinst} blockStart=${aktiverBlock?.start ?? null} trainings=${trainings} masse=${masse} masseSetzen=${DEMO ? null : masseSetzen} ausdauer=${ausdauer}/>`
      : ansicht === 'rechner' ? html`<${Rechner} key=${`${rechnerArt}-${training?.id ?? ''}`} einst=${einstUi} start=${rechnerArt} zurueck=${() => history.back()} vorlage=${(() => {
          // 180: aktueller Satz des Trainings (offene Übung zuerst); bei Klimmzug/Dips als Zusatzgewicht für den Klimmzug-Rechner
          const ks = training ? [...training.karten.filter((k) => k.key && !k.zu), ...training.karten.filter((k) => k.key && k.zu)] : [];
          for (const k of ks) {
            const koerper = koerperUebung(k.key);
            const s = k.gruppen.flatMap((g) => g.saetze).find((x) => !x.erledigt && (koerper || x.kg > 0));
            if (s) return { kg: s.kg ?? 0, wdh: s.wdh, rpe: s.rpe ?? null, koerper };
          }
          return null;
        })()}/>`
      : ansicht === 'einstellungen' ? html`<${Einstellungen} einst=${einstUi} setEinst=${setEinst} SyncPunkt=${SyncPunkt} zurueck=${() => gehe('heute')}
          konto=${nutzer} sync=${sync} offen=${offen} abgleich=${abgleich} abmelden=${raus} exportieren=${exportieren}
          neuAnmelden=${() => setPhase('anmelden')} kontoLoeschen=${DEMO ? null : kontoLoeschen} anleitung=${() => setEinf(true)} emailAendern=${DEMO ? null : emailAendern}
          zuImport=${DEMO ? null : () => gehe('import')} zuGewichtImport=${DEMO ? null : () => gehe('gewicht')} hilfe=${{ sichern, einspielen, kalender: tage.length ? kalender : null, datenschutz: () => gehe('datenschutz'), feedback: DEMO ? null : () => setFeedback({ art: 'feedback' }) }}
          loeschungAbbrechen=${DEMO ? null : async () => { await konto.kontoLoeschenAbbrechen(supabase()); setEinst({ ...einst, loeschenAb: null, vergleich: true, feedTeilen: true }); setToast({ titel: 'Löschung abgebrochen', text: 'Dein Konto bleibt.' }); }}/>`
      : html`<${Heute} ausdauer=${ausdauer} ausdauerPlan=${auPlan} ausdauerSpeichern=${ausdauerSpeichern} ausdauerLoeschen=${ausdauerLoeschen} geplantEintragen=${geplantEintragen} beschwerdeMelden=${DEMO ? null : () => setBeschwerdeOffen(true)}
          beschwerdeErledigt=${DEMO ? null : (id) => setEinst({ ...einst, beschwerden: (einst.beschwerden ?? []).filter((b) => b.id !== id) })} zuStatistik=${() => gehe('statistik')} trainings=${trainings} block=${aktiverBlock} prog=${blockDef} tage=${tage} erledigt=${erledigt} leichter=${leichter} setLeichter=${setLeichter} training=${training}
          starten=${starten} freiStarten=${freiStarten} fortsetzen=${() => gehe('training')} einst=${einstUi} setEinst=${setEinst} sync=${sync} offen=${offen}
          zuEinstellungen=${() => gehe('einstellungen')} zuProgrammen=${() => gehe('programme')} tagOption=${aktiverBlock && !training ? tagOption : null}
          startenAm=${startenAm} bearbeiten=${DEMO ? null : bearbeiten} loeschen=${DEMO ? null : loeschen} wiederholen=${DEMO ? null : wiederholen} zuUebung=${(key) => zuUebung(key, 'heute')} menueAuf=${() => setMenue(true)}
          zuImport=${DEMO ? null : () => gehe('import')}/>`;
  };
  seiteRef.current = seiteFuer;
  const leiste = training && ansicht !== 'training';
  const unten = 84 + (timer && !imTraining ? 76 : 0) + (leiste ? 70 : 0);   // Platz für Tabs und Dock
  const aktiverTab = ansicht === 'training' || ansicht === 'rechner' ? 'heute' : ansicht === 'uebung' ? (['training', 'heute'].includes(uebungAnsicht?.zurueck) ? 'heute' : uebungAnsicht?.zurueck === 'statistik' ? 'statistik' : 'verlauf') : ansicht === 'einstellungen' ? 'heute' : ansicht;
  return html`<div>
    <style>${`.screen{padding-bottom:calc(${unten + 24}px + env(safe-area-inset-bottom,0px))}`}</style>
    <div class="seite-haupt" ref=${hauptRef}><${Fehlergrenze} key=${ansicht}>${seiteFuer(ansicht)}<//></div>
    ${einst.loeschenAb && ansicht !== 'einstellungen' ? html`<button class="loesch-hinweis" onClick=${() => gehe('einstellungen')}>${I.warn}<span>${`Konto wird am ${datumKurz(einst.loeschenAb.slice(0, 10))}${einst.loeschenAb.slice(0, 4)} gelöscht – in den Einstellungen abbrechen`}</span></button>` : null}
    ${leiste && dockKlein ? html`<${MiniDock} training=${training} timer=${timer} oeffnen=${() => gehe('training')} ziehen=${kleinZiehen} pos=${dockPos.klein && { x: (dockPos.klein.x * innerWidth) / appZoom(), y: (dockPos.klein.y * innerHeight) / appZoom() }}/>`
    : (timer && !imTraining) || leiste ? html`<div class="dock" style=${dockPos.gross != null ? `top:${(dockPos.gross * innerHeight) / appZoom()}px;bottom:auto` : ''}><div class="dock-wisch kein-wisch" ...${grossZiehen.props}>
      ${/* eine Leiste: läuft eine Pause, steht das Training als zweite Zeile im Timer (03.11.) */ ''}
      ${leiste && !(timer && !imTraining) ? html`<${TrainingDock} training=${training} oeffnen=${() => gehe('training')}/>` : null}
      ${timer && !imTraining ? html`<${PausenTimer} timer=${timer} setTimer=${setTimer} oeffnen=${training ? () => gehe('training') : null}
        fortschritt=${leiste ? () => training.karten.filter((k) => k.key).map((k) => { const s = k.gruppen.flatMap((g) => g.saetze); return [s.filter((x) => x.erledigt).length, s.length]; }).filter(([, n]) => n) : null}
        zusatz=${leiste ? () => { const s = alleSaetze(training); return html`<span class="pdock-zeitchip">${training.bearbeiten ? '✎' : `⏱ ${uhr((Date.now() - training.start) / 1000)}`}</span><span>${`${s.filter((x) => x.erledigt).length}/${s.length} Sätze`}</span>`; } : null}/>` : null}
    </div></div>` : null}
    <div class="tabs"><nav>${TABS.map(([k, t]) => html`<button key=${k} aria-current=${aktiverTab === k ? 'page' : 'false'} onPointerDown=${(e) => { if (e.button > 0) return; vibriere(15); tabGedrueckt.current = Date.now(); verdecktGehen(k); }} onClick=${() => { if (Date.now() - tabGedrueckt.current > 600) verdecktGehen(k); }}>
      ${I[`tab${k[0].toUpperCase()}${k.slice(1)}`] ?? I[k]}<span>${t}</span>${k === 'heute' && leiste ? html`<i class="lauf"></i>` : null}${k === 'feed' && aktiveFreunde.length && !(anfragen || coachOffen || neuReakt.length) ? html`<i class="aktiv-punkt" aria-label="Freunde trainieren gerade"></i>` : null}${k === 'feed' && (anfragen || coachOffen || neuReakt.length) ? html`<i class="anfrage-punkt">${anfragen + coachOffen + neuReakt.length > 9 ? '9+' : anfragen + coachOffen + neuReakt.length}</i>` : null}</button>`)}</nav></div>
    ${lichter ? html`<div class=${`lichter ${lichter.gold ? 'gold' : ''}`} role="status"><div><div class="lampen"><i></i><i></i><i></i></div><b>${lichter.titel}</b><span>${lichter.text}</span></div>
      ${lichter.gold ? html`<div class="blitz" aria-hidden="true"></div><div class="strahlen" aria-hidden="true"></div>
        <div class="konfetti" aria-hidden="true">${Array.from({ length: 56 }, (_, i) => html`<i key=${i} style=${`--x:${(i * 37) % 100}%;--d:${(i % 9) * 0.08}s;--r:${(i * 53) % 360}deg;--f:${['var(--p25)', 'var(--p20)', 'var(--p15)', 'var(--p10)', '#fff', 'var(--gold)'][i % 6]}`}></i>`)}</div>` : null}</div>` : null}
    ${toast ? html`<div class="toast" role="status" ...${toastWisch}><div><b>${toast.titel}</b><span class="muted" style="font-size:14px">${toast.text}</span></div></div>` : null}
    ${bereit ? html`<${BereitschaftSheet} mitLeichter=${!bereit.frei} leichter=${!!bereit.tag && bereit.tag.datum === HEUTE && leichter} zu=${() => setBereit(null)}
      los=${(r, l) => { const b = bereit; setBereit(null); if (b.frei) starteFrei(r); else startePlan(b.tag, r, l); }}/>` : null}
    ${neueUebung ? html`<${UebungFormular} modus="neu" start=${neueUebung.text} zu=${() => setNeueUebung(null)}
      fertig=${(e) => { const wahl = neueUebung.beiWahl; setNeueUebung(null); wahl(e.k); }}/>` : null}
    ${abschluss ? html`<${Abschluss} daten=${abschluss} zu=${() => { setAbschluss(null); if (beschwerdeNachAbschluss.current) { beschwerdeNachAbschluss.current = false; setTimeout(() => setBeschwerdeOffen(true), 250); } }}/>` : null}
    ${beschwerdeOffen ? html`<${BeschwerdeSheet} zu=${() => setBeschwerdeOffen(false)}
      planKeys=${(bis) => tage.filter((x) => x.datum >= HEUTE && x.datum <= bis && !erledigt.has(x.datum)).flatMap((x) => x.uebungen.map((u) => u.key))}
      speichern=${(b) => { setEinst({ ...einst, beschwerden: [...(einst.beschwerden ?? []).filter((x) => x.bis >= HEUTE), b] }); setToast({ titel: deEn('Gute Besserung 🩹', 'Get well soon 🩹'), text: b.modus === 'notieren' ? deEn('Notiert.', 'Noted.') : deEn('Der Plan ist angepasst – betroffene Übungen siehst du beim Training.', 'Plan adjusted – you will see the affected exercises in your workout.') }); }}/>` : null}
    ${rbJahr && rbDaten ? html`<${Rueckblick} r=${rbDaten} vorname=${einst.vorname} zu=${() => setRbJahr(null)}/>` : null}
    ${lange && training ? html`<${LangeOffenSheet} training=${training} weiter=${() => { setLange(false); setTraining({ ...training, nachgefragt: Date.now() }); }}
      beenden=${(e) => { setLange(false); beenden({ ende: e }); }}/>` : null}
    <${FensterHost}/>
    <${BildLupe}/>
    <${SeitenMenue} rueckblickJahr=${rueckblickMenue} auf=${menue || menueZug} vorschau=${menueZug && !menue} ohneEinblenden=${menueGezogen} zu=${() => { setMenue(false); setMenueGezogen(false); }} einfach=${einst.trainingsart === 'einfach'}
      waehle=${(k) => { if (k === 'begriffe') { history.back(); setTimeout(() => setGlossar(true), 80); return; } setMenue(false); setMenueGezogen(false); if (k === 'coach') { gehe('coach', null, true); return; } gehe('rechner', k, true); }}/>
    ${glossar ? html`<${GlossarSheet} zu=${() => setGlossar(false)}/>` : null}
    ${feedback ? html`<${FeedbackSheet} art=${feedback.art} betrifft=${feedback.betrifft ?? null} name=${feedback.name ?? null} vorText=${feedback.text ?? ''} zu=${() => setFeedback(null)}
      senden=${(f) => konto.feedbackSenden(supabase(), f)}/>` : null}
    ${neueVersion ? html`<${NeueVersion}/>` : null}
    ${einf ? html`<${Einfuehrung} fertig=${() => setEinf(false)} zuProgrammen=${aktiverBlock ? null : () => gehe('programme')}/>` : null}
  </div>`;
}

render(html`<${App}/>`, document.getElementById('app'));
