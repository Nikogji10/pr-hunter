// PR Hunter · App-Hülle: Anmeldung, lokale Daten (IndexedDB), Abgleich mit Supabase, Navigation.
// Mit ?demo laufen alle Ansichten mit Beispieldaten und ohne Anmeldung (Rendertests, Vorführen).
// Ein laufendes Training liegt sofort im Speicher des Handys und übersteht Neuladen und App-Wechsel.
import { html, render, useState, useEffect, useRef, useMemo } from './vendor/htm-preact.js';
import { setzeKatalog, setzeAnzeige, katalogListe, fmt, gw, einheit, tonnage, mmss, uhr, I, LIFT, liftVon, nameVon, pauseVon, datumLang, datumKurz, wtKurz, speicher, tonFreigeben, useTakt, Avatar,
  BlockHantel, PausenTimer, Sheet, incStandard, UebungsBild, koerperUebung, vibriere } from './ui/basis.js';
import { setzeStand, setzeDienste, heuteLokal, HEUTE, trainingsTage, KOERPERGEWICHT } from './ui/stand.js';
import { beispielStand } from './ui/beispiel.js';
import { Training, baueTraining, alleSaetze } from './ui/training.js';
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
import { GewichtKarte } from './ui/gewicht.js';
import { ladeHintergrund, hintergrundAbgleichen as hgAbgleichen, setzeAbdunklung } from './ui/hintergrund.js';
import { setzeSprache } from './ui/sprache.js';
import * as mitteilung from './ui/mitteilung.js';
import { KG_PRO_LB } from './js/rechnen.js';
import { erstelleStand, plusTage, tageZwischen } from './js/daten.js';
import { sollIst, neueMaxe, tageMitOptionen } from './js/block.js';
import { projiziere } from './js/programm.js';
import { ausTraining, zuTraining, abgleichen, neueId, setzeUmbenannt } from './js/sync.js';
import { speicherFuer, dauerhaft } from './js/lokal.js';
import { supabase, codeSenden, codePruefen, sitzung, abmelden, emailAendern } from './js/supabase.js';
import * as konto from './js/konto.js';

const DEMO = new URLSearchParams(location.search).has('demo');
const VORLAGEN = ['pr_hybrid_candito_pana', 'candito_int_adv_bench', 'candito_6_week'];
const { STANDARD_EINSTELLUNGEN } = konto;
const TABS = [['heute', 'Heute'], ['programme', 'Programme'], ['verlauf', 'Verlauf'], ['feed', 'Feed'], ['statistik', 'Statistik'], ['rechner', 'Rechner']];
const PAUSE_HINWEIS_TAGE = 10;          // ab so vielen Tagen ohne Training: vorsichtig einsteigen (Verletzungen nach Urlaub)
const ABGLEICH_ALLE_MS = 5 * 60 * 1000;
const liftsDes = (tag) => [...new Set(tag.uebungen.map((u) => liftVon(u.key)).filter((l) => l !== 'andere'))];

// #################################################################
// Navigation über die Browser-Historie: jede Ansicht ist ein Eintrag mit Adresse (#statistik, #uebung/<key>).
// Zurück bleibt in der App (auf der ersten Ansicht passiert nichts), Neuladen öffnet dieselbe Ansicht an derselben Stelle.
// #################################################################
const ANSICHTEN = new Set(['heute', 'programme', 'verlauf', 'feed', 'statistik', 'rechner', 'einstellungen', 'training', 'uebung']);
function ausAdresse() {
  const [a, key] = decodeURIComponent(location.hash.slice(1)).split('/');
  return ANSICHTEN.has(a) && (a !== 'uebung' || key) ? { ansicht: a, key: key || null } : { ansicht: 'heute', key: null };
}
const adresse = (a, key) => `#${a}${key ? `/${encodeURIComponent(key)}` : ''}`;

if (DEMO) setzeStand(beispielStand());

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
    ${zurueck ? html`<button class="link" style="justify-self:start" onClick=${zurueck}>Zurück zur App</button>`
      : html`<a class="link" href="?demo" style="justify-self:start">Ohne Anmeldung ansehen (Beispieldaten)</a>`}
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

function Heute({ block, prog, tage, erledigt, leichter, setLeichter, training, starten, freiStarten, fortsetzen, einst, setEinst, sync, offen, zuEinstellungen, zuProgrammen, tagOption,
  startenAm, bearbeiten, loeschen, zuUebung }) {
  const [sheet, setSheet] = useState(null);             // 'verschieben' | 'ueberspringen'
  const [mitRest, setMitRest] = useState(true);         // Verschieben: restlichen Block mitnehmen
  const [planOffen, setPlanOffen] = useState(false);
  const [tagOffen, setTagOffen] = useState(null);       // Datum aus „Plan ansehen“
  const stand = block ? blockStand(tage, erledigt) : null;
  const kopf = html`<header class="topbar duenn">
    <span class="logo"><b>PR</b> Hunter</span>
    ${stand ? html`<button class="kopf-hantel" onClick=${zuProgrammen} aria-label=${`Block: Woche ${stand.akt} von ${stand.wochen.length}`}>
      <${BlockHantel} wochen=${stand.wochen} aktuell=${stand.akt}/></button>` : html`<span></span>`}
    <div class="row"><${SyncPunkt} sync=${sync} offen=${offen}/>
      <button class="profil-knopf" onClick=${zuEinstellungen} aria-label="Profil und Einstellungen"><${Avatar} bild=${einst.avatar} name=${einst.name} groesse=${30}/><span class="zahnrad">${I.zahnrad}</span></button></div>
  </header>`;
  const gewicht = html`<${GewichtKarte} einst=${einst} setEinst=${setEinst} kompakt=${true}/>`;
  const letztes = Object.keys(trainingsTage).filter((d) => d < HEUTE).sort().at(-1);
  const ohnePlan = html`<button class="btn btn-soft btn-block" onClick=${training ? fortsetzen : freiStarten}>${training?.bearbeiten ? 'Bearbeitung fortsetzen'
    : training && !training.planDatum ? 'Freies Training fortsetzen' : 'Ohne Plan trainieren'}</button>`;
  if (!block) {
    const t = letztes ? trainingsTage[letztes] : null;
    return html`<div class="screen">${kopf}${gewicht}
      <section class="card pad stack wichtig"><h2 class="h2">Kein aktiver Block</h2>
        <p class="muted" style="margin:0">Starte eine Vorlage mit deinen Maxen, dann steht hier jeden Tag dein Training. Oder trainiere frei und wähle die Übungen selbst.</p>
        <button class="btn btn-chalk btn-block" onClick=${zuProgrammen}>Programm wählen</button>
        ${ohnePlan}</section>
      ${t ? html`<section class="card pad stack"><span class="eyebrow">Zuletzt trainiert · ${datumLang(letztes)}</span>
        <div class="row between"><b>${t.lifts.map((l) => LIFT[l].name).join(' · ') || 'Zubehör'}</b><span class="muted">${tonnage(t.tonnage)}</span></div></section>` : null}
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
    <div class="maxes kompakt">${[['squat', 'S'], ['bench', 'B'], ['dead', 'D']].map(([l, k]) => html`<div class="max" key=${l} style=${`--c:${LIFT[l].farbe}`} title="Trainingsmax">
      <span class="eyebrow">${LIFT[l].name}</span><b>${gw(block.werte[k])}<small> ${einheit()}</small></b></div>`)}</div>
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
      ${training?.planDatum === tag.datum ? html`<button class="btn btn-go btn-block" onClick=${fortsetzen}>Training fortsetzen</button>`
        : html`<button class="btn btn-go btn-block" onClick=${() => starten(tag)}>${tag.datum === HEUTE ? 'Training starten' : 'Vorziehen und starten'}</button>`}
      <div class="heute-knoepfe">${tagOption && training?.planDatum !== tag.datum ? html`<button class="btn btn-soft btn-sm" onClick=${() => setSheet('verschieben')}>Verschieben</button>
        <button class="btn btn-soft btn-sm" onClick=${() => setSheet('ueberspringen')}>Überspringen</button>` : null}
        <button class="btn btn-soft btn-sm" onClick=${training ? fortsetzen : freiStarten}>${training?.bearbeiten ? 'Bearbeitung fortsetzen'
          : training && !training.planDatum ? 'Frei fortsetzen' : 'Ohne Plan'}</button></div>
      ${tag.verschoben ? html`<span class="muted" style="font-size:13px">Verschoben – ursprünglich am ${datumKurz(plusTage(block.start, tag.offset))}.</span>` : null}
    </section>` : html`<section class="card pad"><h2 class="h2">Block geschafft</h2><p class="muted" style="margin:6px 0 0">Alle Einheiten erledigt. Zeit für Test oder neuen Block.</p></section>`}
    ${tag ? null : html`${ohnePlan}<button class="btn btn-soft btn-block" onClick=${() => setPlanOffen(!planOffen)}>${planOffen ? 'Plan schließen' : 'Plan ansehen'}</button>`}
    ${tagOffen ? html`<${TagSheet} d=${tagOffen} plan=${tage.find((x) => x.datum === tagOffen)} erledigt=${erledigt.has(tagOffen)} zu=${() => setTagOffen(null)}
      startenAm=${training ? null : startenAm} bearbeiten=${bearbeiten} loeschen=${loeschen} zuUebung=${zuUebung}/>` : null}
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

  </div>`;
}

// #################################################################
// Leiste „Training läuft“ (unten, solange man woanders ist)
// #################################################################
function LaufLeiste({ training, oeffnen }) {
  useTakt(true, 1000);
  const s = alleSaetze(training);
  return html`<button class="live" onClick=${oeffnen} aria-label="Zum laufenden Training">
    <span class="puls"></span>
    <div style="min-width:0"><b>${training.bearbeiten ? 'Bearbeitung offen' : 'Training läuft'}</b><span>${training.titel} · ${s.filter((x) => x.erledigt).length}/${s.length} Sätze</span></div>
    ${training.bearbeiten ? null : html`<span class="zahl tab-num">${uhr((Date.now() - training.start) / 1000)}</span>`}
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
  const [toast, setToast] = useState(null);
  const [lichter, setLichter] = useState(null);
  const [demoErledigt, setDemoErledigt] = useState(() => new Set());
  const [anpassungen, setAnpassungenRoh] = useState({});        // key → persönliche Anpassung der Übung
  const [neueUebung, setNeueUebung] = useState(null);           // { text, beiWahl } – Formular „Neue Übung“ offen
  const [bereit, setBereit] = useState(null);                   // Readiness-Check vor dem Start: { tag } oder { frei: true }
  const [einf, setEinf] = useState(einfuehrungOffen);           // Einführungskarten beim ersten Öffnen (pro Gerät)
  const [abschluss, setAbschluss] = useState(null);
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
  }, []);

  async function starte(n) {
    speicher.schreib('prh-nutzer', JSON.stringify(n));
    setNutzer(n);
    const s = await speicherFuer(n.id);
    sp.current = s;
    const [tr, me, bl, ei, lauf, inf, ue, an, zf, pause] = await Promise.all(['', 'messwerte', 'block', 'einst', 'laufend', 'programme', 'uebungen', 'anpassungen', 'zusammen', 'pause']
      .map((k) => (k ? s.meta(k) : s.alle())));
    zusammenSetzen(zf);
    setTrainings(tr);
    setMesswerte(me ?? []);
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
        await konto.speichereProfil(sb, uid, ei);
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
      let me = (await s.meta('messwerte')) ?? [];
      for (const m of me.filter((x) => x.offen)) { await konto.messwertHochladen(sb, m); m.offen = false; }
      me = konto.mischeMesswerte(me, await konto.ladeMesswerte(sb));
      await s.setzeMeta('messwerte', me); setMesswerte(me);
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

  // Historie: Wurzel-Eintrag + aktuelle Ansicht; Zurück auf der Wurzel bleibt in der App
  useEffect(() => {
    const start = ausAdresse();
    history.replaceState({ wurzel: true }, '', adresse(start.ansicht, start.key));
    history.pushState(start, '', adresse(start.ansicht, start.key));
    const zurueck = (e) => {
      const st = e.state;
      if (!st?.ansicht) { history.pushState(jetzt.current, '', adresse(jetzt.current.ansicht, jetzt.current.key)); return; }
      scrollPos.current[jetzt.current.ansicht] = scrollY;
      setAnsicht(st.ansicht);
      const y = scrollPos.current[st.ansicht] ?? 0;
      setTimeout(() => scrollTo(0, y), 30);
      if (st.key) setUebungAnsicht((u) => (u?.key === st.key ? u : { key: st.key, zurueck: 'verlauf' }));
    };
    addEventListener('popstate', zurueck);
    // Neuladen/Herunterziehen: Ansicht steht in der Adresse, die Scrollposition merken wir uns hier
    const merken = () => { try { sessionStorage.setItem('prh-scroll', JSON.stringify({ hash: location.hash, y: scrollY })); } catch { /* egal */ } };
    addEventListener('pagehide', merken);
    return () => { removeEventListener('popstate', zurueck); removeEventListener('pagehide', merken); };
  }, []);
  // Startbild aus index.html ausblenden, sobald die App steht (mindestens 1,2 s nach dem Öffnen, damit die Animation durchläuft)
  useEffect(() => {
    if (phase === 'laden') return;
    const sb = document.getElementById('startbild');
    if (!sb) return;
    const id = setTimeout(() => { sb.classList.add('weg'); setTimeout(() => sb.remove(), 350); }, Math.max(0, 650 - performance.now()));
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
  if (stand) setzeStand(stand);
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
      zusammenfuehren: async (von, nach) => {
        if (!navigator.onLine) throw new Error('Zum Zusammenführen braucht das Handy Netz.');
        const n = await konto.zusammenfuehren(supabase(), von, nach);
        setToast({ titel: 'Zusammengeführt', text: `${n} Trainingseinträge hängen jetzt an ${nameVon(nach)}.` });
        zuletzt.current = 0; abgleich();
      },
      darfAendern: (e) => !!einst.admin || (!!e.von && e.von === nutzer?.id),
    });
  }

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
  // Kalender aus (Einstellungen → Freunde): Pläne bleiben privat, es wird eine leere Liste hochgeladen
  planTage.current = einst.kalender === false ? [] : tage.filter((t) => t.datum >= heuteLokal() && !t.uebersprungen).slice(0, 40)
    .map((t) => ({ datum: t.datum, keys: t.uebungen.map((u) => u.key).filter(Boolean) }));
  // Erledigt nach Datum des Plantags (bei verschobenen Tagen das neue Datum)
  const datumVon = new Map(tage.map((t) => [t.offset, t.datum]));
  const erledigt = DEMO ? demoErledigt : new Set(trainings.filter((t) => aktiverBlock && t.runId === aktiverBlock.id && t.tagOffset != null && !t.geloescht)
    .map((t) => datumVon.get(t.tagOffset) ?? plusTage(aktiverBlock.start, t.tagOffset)));
  const offen = trainings.filter((t) => t.offen).length;
  const einstUi = { ...einst, koerpergewicht: DEMO ? demoKg ?? KOERPERGEWICHT : KOERPERGEWICHT };

  const gehe = (a, key = null) => {
    scrollPos.current[jetzt.current.ansicht] = scrollY;
    setAnsicht(a);
    // Ins laufende Training an die gleiche Stelle zurück, sonst nach oben
    const y = a === 'training' ? scrollPos.current.training ?? 0 : 0;
    scrollTo(0, 0); if (y) setTimeout(() => scrollTo(0, y), 30);
    const st = { ansicht: a, key };
    if (history.state?.ansicht === a && history.state?.key === key) history.replaceState(st, '', adresse(a, key));
    else history.pushState(st, '', adresse(a, key));
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
      karten: baueTraining(tag, { leichter: leicht, koerperKg: einstUi.koerpergewicht }).map((k, i) => (i > 0 && k.key ? { ...k, zu: true } : k)) });
    gehe('training');
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
  const beenden = async ({ sessionRpe = null, notiz = null, verwerfen = false } = {}) => {
    const t = training;
    const fertig = alleSaetze(t).filter((s) => s.erledigt).length;
    setTraining(null); setTimer(null);
    try { sperre.current?.release(); } catch { /* egal */ }
    gehe(t.bearbeiten ? 'verlauf' : 'heute');
    if (!fertig || verwerfen) {
      setToast(t.bearbeiten ? { titel: 'Bearbeitung verworfen', text: 'Das gespeicherte Training bleibt unverändert.' }
        : { titel: 'Training verworfen', text: verwerfen ? 'Nichts gespeichert.' : 'Kein Satz abgehakt, nichts gespeichert.' });
      return;
    }
    if (!t.bearbeiten) { setAbschluss(abschlussAus(t)); vibriere([120, 80, 160]); }   // gespeichert: doppelt
    if (DEMO) { if (t.planDatum) setDemoErledigt(new Set([...demoErledigt, t.planDatum])); setToast({ titel: 'Training gespeichert', text: `${t.titel} ist erledigt.` }); return; }
    // Beim Bearbeiten bleiben Ende und Körpergewicht des Originals, sonst gelten jetzt und das aktuelle Körpergewicht
    const w = ausTraining(t, { id: t.id, sessionRpe, notiz, ...(t.bearbeiten && t.ende ? { ende: t.ende } : {}),
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

  jetzt.current = { ansicht, key: ansicht === 'uebung' ? uebungAnsicht?.key ?? null : null };
  const imTraining = ansicht === 'training' && training;
  const leiste = training && ansicht !== 'training';
  const unten = 84 + (timer && !imTraining ? 76 : 0) + (leiste ? 70 : 0);   // Platz für Tabs und Dock
  const aktiverTab = ansicht === 'training' ? 'heute' : ansicht === 'uebung' ? (['training', 'heute'].includes(uebungAnsicht?.zurueck) ? 'heute' : uebungAnsicht?.zurueck === 'statistik' ? 'statistik' : 'verlauf') : ansicht === 'einstellungen' ? 'heute' : ansicht;
  return html`<div>
    <style>${`.screen{padding-bottom:calc(${unten + 24}px + env(safe-area-inset-bottom,0px))}`}</style>
    ${imTraining ? html`<${Training} t=${training} setT=${setTraining} timer=${timer} setTimer=${setTimer} einst=${einstUi} toast=${setToast} lichter=${setLichter}
        minimieren=${() => gehe('heute')} beenden=${beenden} zuVerlauf=${(key) => zuUebung(key, 'training')}/>`
      : ansicht === 'uebung' && uebungAnsicht ? html`<${UebungsSeite} key=${uebungAnsicht.key} schluessel=${uebungAnsicht.key} einst=${einstUi} setEinst=${setEinst} bloecke=${bloecke}
          zurueck=${() => gehe(uebungAnsicht.zurueck === 'training' && training ? 'training' : uebungAnsicht.zurueck === 'heute' ? 'heute' : 'verlauf')}
          zurueckText=${uebungAnsicht.zurueck === 'training' && training ? 'Zurück zum Training' : uebungAnsicht.zurueck === 'heute' ? 'Zurück zu Heute' : 'Zurück zum Verlauf'}/>`
      : ansicht === 'programme' ? html`<${Programme} programme=${programme} info=${info} block=${aktiverBlock} setBlock=${blockSetzen} erledigt=${erledigt} toast=${setToast}
          sollIst=${aktiverBlock && !DEMO ? sollIst(tage, trainings, aktiverBlock.id) : []}
          neueMaxeFuer=${aktiverBlock && !DEMO ? (vertrauen) => neueMaxe(blockDef, aktiverBlock, trainings, projiziere, incStandard(), { vertrauen }) : null}
          zuHeute=${() => gehe('heute')} einst=${einstUi} setEinst=${setEinst} importieren=${importieren}/>`
      : ansicht === 'verlauf' ? html`<${Verlauf} planTage=${tage} erledigt=${erledigt} startenAm=${startenAm} zuUebung=${(key) => zuUebung(key, 'verlauf')}
          bearbeiten=${DEMO ? null : bearbeiten} loeschen=${DEMO ? null : loeschen}/>`
      : ansicht === 'feed' ? html`<${Feed} einst=${einstUi} setEinst=${setEinst} anfragen=${anfragen} zuEinstellungen=${() => gehe('einstellungen')}/>`
      : ansicht === 'statistik' ? html`<${Statistik} einst=${einstUi} setEinst=${setEinst} blockStart=${aktiverBlock?.start ?? null} trainings=${trainings}/>`
      : ansicht === 'rechner' ? html`<${Rechner} einst=${einstUi} vorlage=${(() => {
          const s = training?.karten.flatMap((k) => (k.key && !koerperUebung(k.key) ? k.gruppen.flatMap((g) => g.saetze) : [])).find((x) => !x.erledigt && x.kg > 0);
          return s ? { kg: s.kg, wdh: s.wdh } : null;
        })()}/>`
      : ansicht === 'einstellungen' ? html`<${Einstellungen} einst=${einstUi} setEinst=${setEinst} SyncPunkt=${SyncPunkt} zurueck=${() => gehe('heute')}
          konto=${nutzer} sync=${sync} offen=${offen} abgleich=${abgleich} abmelden=${raus} exportieren=${exportieren}
          neuAnmelden=${() => setPhase('anmelden')} kontoLoeschen=${DEMO ? null : kontoLoeschen} anleitung=${() => setEinf(true)} emailAendern=${DEMO ? null : emailAendern}
          loeschungAbbrechen=${DEMO ? null : async () => { await konto.kontoLoeschenAbbrechen(supabase()); setEinst({ ...einst, loeschenAb: null, vergleich: true, feedTeilen: true }); setToast({ titel: 'Löschung abgebrochen', text: 'Dein Konto bleibt.' }); }}/>`
      : html`<${Heute} block=${aktiverBlock} prog=${blockDef} tage=${tage} erledigt=${erledigt} leichter=${leichter} setLeichter=${setLeichter} training=${training}
          starten=${starten} freiStarten=${freiStarten} fortsetzen=${() => gehe('training')} einst=${einstUi} setEinst=${setEinst} sync=${sync} offen=${offen}
          zuEinstellungen=${() => gehe('einstellungen')} zuProgrammen=${() => gehe('programme')} tagOption=${aktiverBlock && !training ? tagOption : null}
          startenAm=${startenAm} bearbeiten=${DEMO ? null : bearbeiten} loeschen=${DEMO ? null : loeschen} zuUebung=${(key) => zuUebung(key, 'heute')}/>`}
    ${einst.loeschenAb && ansicht !== 'einstellungen' ? html`<button class="loesch-hinweis" onClick=${() => gehe('einstellungen')}>${I.warn}<span>${`Konto wird am ${datumKurz(einst.loeschenAb.slice(0, 10))}${einst.loeschenAb.slice(0, 4)} gelöscht – in den Einstellungen abbrechen`}</span></button>` : null}
    ${(timer && !imTraining) || leiste ? html`<div class="dock">
      ${leiste ? html`<${LaufLeiste} training=${training} oeffnen=${() => gehe('training')}/>` : null}
      ${timer && !imTraining ? html`<${PausenTimer} timer=${timer} setTimer=${setTimer}/>` : null}
    </div>` : null}
    <div class="tabs"><nav>${TABS.map(([k, t]) => html`<button key=${k} aria-current=${aktiverTab === k ? 'page' : 'false'} onPointerDown=${() => vibriere(15)} onClick=${() => gehe(k)}>
      ${I[k]}<span>${t}</span>${k === 'heute' && leiste ? html`<i class="lauf"></i>` : null}${k === 'feed' && anfragen ? html`<i class="anfrage-punkt">${anfragen}</i>` : null}</button>`)}</nav></div>
    ${lichter ? html`<div class=${`lichter ${lichter.gold ? 'gold' : ''}`} role="status"><div><div class="lampen"><i></i><i></i><i></i></div><b>${lichter.titel}</b><span>${lichter.text}</span></div>
      ${lichter.gold ? html`<div class="blitz" aria-hidden="true"></div><div class="strahlen" aria-hidden="true"></div>
        <div class="konfetti" aria-hidden="true">${Array.from({ length: 56 }, (_, i) => html`<i key=${i} style=${`--x:${(i * 37) % 100}%;--d:${(i % 9) * 0.08}s;--r:${(i * 53) % 360}deg;--f:${['var(--p25)', 'var(--p20)', 'var(--p15)', 'var(--p10)', '#fff', 'var(--gold)'][i % 6]}`}></i>`)}</div>` : null}</div>` : null}
    ${toast ? html`<div class="toast" role="status"><div><b>${toast.titel}</b><span class="muted" style="font-size:14px">${toast.text}</span></div></div>` : null}
    ${bereit ? html`<${BereitschaftSheet} mitLeichter=${!bereit.frei} leichter=${!!bereit.tag && bereit.tag.datum === HEUTE && leichter} zu=${() => setBereit(null)}
      los=${(r, l) => { const b = bereit; setBereit(null); if (b.frei) starteFrei(r); else startePlan(b.tag, r, l); }}/>` : null}
    ${neueUebung ? html`<${UebungFormular} modus="neu" start=${neueUebung.text} zu=${() => setNeueUebung(null)}
      fertig=${(e) => { const wahl = neueUebung.beiWahl; setNeueUebung(null); wahl(e.k); }}/>` : null}
    ${abschluss ? html`<${Abschluss} daten=${abschluss} zu=${() => setAbschluss(null)}/>` : null}
    ${einf ? html`<${Einfuehrung} fertig=${() => setEinf(false)} zuProgrammen=${aktiverBlock ? null : () => gehe('programme')}/>` : null}
  </div>`;
}

render(html`<${App}/>`, document.getElementById('app'));
