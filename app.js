// PR Hunter · App-Hülle: Anmeldung, lokale Daten (IndexedDB), Abgleich mit Supabase, Navigation.
// Mit ?demo laufen alle Ansichten mit Beispieldaten und ohne Anmeldung (Rendertests, Vorführen).
// Ein laufendes Training liegt sofort im Speicher des Handys und übersteht Neuladen und App-Wechsel.
import { html, render, useState, useEffect, useRef, useMemo } from './vendor/htm-preact.js';
import { setzeKatalog, setzeAnzeige, katalogListe, fmt, gw, einheit, tonnage, mmss, I, LIFT, liftVon, nameVon, pauseVon, datumLang, datumKurz, wtKurz, speicher, tonFreigeben, useTakt,
  BlockHantel, PausenTimer, Sheet, incStandard } from './ui/basis.js';
import { setzeStand, setzeDienste, heuteLokal, HEUTE, trainingsTage, KOERPERGEWICHT } from './ui/stand.js';
import { beispielStand } from './ui/beispiel.js';
import { Training, baueTraining, alleSaetze } from './ui/training.js';
import { Programme, INFO, NAMEN, blockTage, wochenListe, kurzTitel } from './ui/programme.js';
import { Verlauf } from './ui/verlauf.js';
import { UebungsSeite, UebungFormular } from './ui/uebung.js';
import { Einstellungen } from './ui/einstellungen.js';
import { Statistik } from './ui/statistik.js';
import { Rechner } from './ui/rechner.js';
import { BereitschaftSheet } from './ui/bereitschaft.js';
import { KG_PRO_LB } from './js/rechnen.js';
import { erstelleStand, plusTage, tageZwischen } from './js/daten.js';
import { sollIst, neueMaxe, tageMitOptionen } from './js/block.js';
import { projiziere } from './js/programm.js';
import { ausTraining, zuTraining, abgleichen, neueId, setzeUmbenannt } from './js/sync.js';
import { speicherFuer, dauerhaft } from './js/lokal.js';
import { supabase, codeSenden, codePruefen, sitzung, abmelden } from './js/supabase.js';
import * as konto from './js/konto.js';

const DEMO = new URLSearchParams(location.search).has('demo');
const VORLAGEN = ['pr_hybrid_candito_pana', 'candito_int_adv_bench', 'candito_6_week'];
const { STANDARD_EINSTELLUNGEN } = konto;
const TABS = [['heute', 'Heute'], ['programme', 'Programme'], ['verlauf', 'Verlauf'], ['statistik', 'Statistik'], ['rechner', 'Rechner']];
const PAUSE_HINWEIS_TAGE = 10;          // ab so vielen Tagen ohne Training: vorsichtig einsteigen (Verletzungen nach Urlaub)
const ABGLEICH_ALLE_MS = 5 * 60 * 1000;
const liftsDes = (tag) => [...new Set(tag.uebungen.map((u) => liftVon(u.key)).filter((l) => l !== 'andere'))];

if (DEMO) setzeStand(beispielStand());

/** Design anwenden: system = dem Gerät folgen (kein Attribut), sonst hell/dunkel fest. */
function thema(wert) {
  const el = document.documentElement;
  if (wert === 'light' || wert === 'dark') el.dataset.theme = wert; else delete el.dataset.theme;
}

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
    <span class="logo"><i></i>PR Hunter</span>
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

function Heute({ block, prog, tage, erledigt, leichter, setLeichter, training, starten, freiStarten, fortsetzen, einst, sync, offen, zuEinstellungen, zuProgrammen, tagOption }) {
  const [sheet, setSheet] = useState(null);             // 'verschieben' | 'ueberspringen'
  const kopf = html`<header class="topbar">
    <span class="logo"><i></i>PR Hunter</span>
    <div class="row"><${SyncPunkt} sync=${sync} offen=${offen}/><button class="iconbtn" onClick=${zuEinstellungen} aria-label="Einstellungen">${I.zahnrad}</button></div>
  </header>`;
  const letztes = Object.keys(trainingsTage).filter((d) => d < HEUTE).sort().at(-1);
  const ohnePlan = html`<button class="btn btn-soft btn-block" onClick=${training ? fortsetzen : freiStarten}>${training?.bearbeiten ? 'Bearbeitung fortsetzen'
    : training && !training.planDatum ? 'Freies Training fortsetzen' : 'Ohne Plan trainieren'}</button>`;
  if (!block) {
    const t = letztes ? trainingsTage[letztes] : null;
    return html`<div class="screen">${kopf}
      <section class="card pad stack"><h2 class="h2">Kein aktiver Block</h2>
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
  const ziele = tag ? Array.from({ length: 8 }, (_, i) => plusTage(HEUTE, i)).filter((d) => d !== tag.datum && frei(d)) : [];
  const wochen = wochenListe(tage);
  const akt = tag ? wochen.indexOf(tag.woche) + 1 : wochen.length;
  const wochenTitel = kurzTitel(prog.weeks.find((w) => w.week === (tag?.woche ?? wochen.at(-1)))?.title);
  // Läuft das Training dieses Tages schon, zeigt der Plan dessen Stand (z. B. gewählte Zusatzübungen)
  const karten = !tag ? [] : training?.planDatum === tag.datum ? training.karten
    : baueTraining(tag, { leichter: tag.datum === HEUTE && leichter, koerperKg: einst.koerpergewicht });
  const pause = letztes ? tageZwischen(letztes, HEUTE) : null;
  const montag = plusTage(HEUTE, -((new Date(`${HEUTE}T00:00:00Z`).getUTCDay() + 6) % 7));
  // Dauer grob: je Satz 45 s Arbeit plus die Pause aus den Einstellungen, ohne Aufwärmen
  const minuten = Math.round(karten.reduce((a, k) => a + k.gruppen.reduce((b, g) => b + g.saetze.length * (45 + pauseVon(k.key, g.rolle, einst.pausen)), 0), 0) / 60 / 5) * 5;
  return html`<div class="screen">
    ${kopf}
    <section class="card hero">
      <div class="row between" style="align-items:flex-start">
        <div><div class="eyebrow">${INFO[block.datei].kurz}${einst.cut ? ' · Cut-Modus' : ''}</div>
          <div class="hero-zahl"><b>Woche ${akt}</b><span>/ ${wochen.length}</span></div>
          <div class="muted" style="font-size:13.5px;margin-top:6px">${wochenTitel} · ${datumKurz(block.start)} – ${datumKurz(tage.at(-1).datum)}</div></div>
        <button class="chip" onClick=${zuProgrammen}>Block ›</button>
      </div>
      <${BlockHantel} wochen=${wochen} aktuell=${akt}/>
    </section>

    ${tag?.datum === HEUTE && !erledigt.has(HEUTE) && !training && pause >= PAUSE_HINWEIS_TAGE ? html`<section class="hint" aria-live="polite">${I.warn}
      <span class="t">Erste Einheit nach ${pause} Tagen Pause</span><span></span>
      <p>Vorsichtig einsteigen: Top-Satz höchstens RPE 7. Fühlen sich die Aufwärmsätze langsam an, 5–10 % runter und den letzten Back-off streichen.</p>
      <span></span><div class="row wrap" style="margin-top:6px"><button class="chip" aria-pressed=${String(leichter)} onClick=${() => setLeichter(!leichter)}>${leichter ? '✓ Heute 5 % leichter' : 'Heute 5 % leichter'}</button></div>
    </section>` : null}

    ${tag ? html`<section class="card pad stack">
      <div class="row between" style="align-items:flex-start"><span class="eyebrow">${tag.datum === HEUTE ? 'Heute' : 'Nächstes Training'} · ${datumLang(tag.datum)}</span><span class="muted" style="font-size:13px;white-space:nowrap">ca. ${minuten} min</span></div>
      <h2 class="h2" style="font-size:24px">${liftsDes(tag).map((l) => LIFT[l].name).join(' · ') || 'Zubehör'}</h2>
      <div>${karten.map((k) => {
        const g0 = k.gruppen[0], lift = liftVon(k.key);
        return html`<div class="plan-item" key=${k.id}>
          <span class="stripe" style=${`background:${LIFT[lift].farbe}`}></span>
          <div style="min-width:0"><div class="name">${k.slot ? k.slot.label : nameVon(k.key)}</div>
            <div class="sets">${k.gruppen.map((g) => `${g.saetze.length} × ${g.wdhText}`).join(' + ')}${g0.rpe ? ` · ${g0.rpe.text ?? (g0.rpe.min === g0.rpe.max ? `RPE ${fmt(g0.rpe.min)}` : `RPE ${fmt(g0.rpe.min)}–${fmt(g0.rpe.max)}`)}` : ''}${k.gruppen.some((g) => g.gekuerzt) ? ' · Cut' : ''}</div></div>
          <div class="kg">${k.slot ? html`<span class="muted" style="font-size:14px;font-stretch:100%;font-weight:600">wählen</span>` : html`${gw(g0.saetze[0].kg)}<small>${einheit()}</small>`}</div>
        </div>`;
      })}</div>
      ${training?.planDatum === tag.datum ? html`<button class="btn btn-chalk btn-block" onClick=${fortsetzen}>Training fortsetzen</button>`
        : html`<button class="btn btn-chalk btn-block" onClick=${() => starten(tag)}>${tag.datum === HEUTE ? 'Training starten' : 'Vorziehen und starten'}</button>
          ${tagOption ? html`<div class="row" style="gap:8px"><button class="btn btn-soft btn-sm" style="flex:1" onClick=${() => setSheet('verschieben')}>Verschieben</button>
            <button class="btn btn-soft btn-sm" style="flex:1" onClick=${() => setSheet('ueberspringen')}>Überspringen</button></div>` : null}`}
      ${tag.verschoben ? html`<span class="muted" style="font-size:13px">Verschoben – ursprünglich am ${datumKurz(plusTage(block.start, tag.offset))}.</span>` : null}
    </section>` : html`<section class="card pad"><h2 class="h2">Block geschafft</h2><p class="muted" style="margin:6px 0 0">Alle Einheiten erledigt. Zeit für Test oder neuen Block.</p></section>`}
    ${ohnePlan}
    ${sheet === 'verschieben' && tag ? html`<${Sheet} zu=${() => setSheet(null)} label="Training verschieben">
      <h2 class="h2">Training verschieben</h2>
      <p class="muted" style="margin:0">${datumLang(tag.datum)} auf einen anderen Tag legen. Der Rest des Blocks bleibt, wie er ist.</p>
      <div class="filter">${ziele.map((d) => html`<button key=${d} class="chip" onClick=${() => { tagOption(tag.offset, { datum: d }); setSheet(null); }}>${wtKurz(d)} ${datumKurz(d)}</button>`)}</div>
      ${tag.verschoben ? html`<button class="btn btn-soft btn-block" onClick=${() => { tagOption(tag.offset, { datum: null }); setSheet(null); }}>Zurück auf den ${datumKurz(plusTage(block.start, tag.offset))}</button>` : null}
    <//>` : null}
    ${sheet === 'ueberspringen' && tag ? html`<${Sheet} zu=${() => setSheet(null)} label="Training überspringen">
      <h2 class="h2">Training überspringen?</h2>
      <p style="margin:0">${datumLang(tag.datum)} fällt aus; danach geht es mit dem nächsten Plantag weiter. Im Verlauf bleibt der Tag als „übersprungen“ sichtbar.</p>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setSheet(null)}>Abbrechen</button>
        <button class="btn btn-chalk" style="flex:1" onClick=${() => { tagOption(tag.offset, { weg: true }); setSheet(null); }}>Überspringen</button></div>
    <//>` : null}

    <section class="card pad stack">
      <div class="row between"><span class="eyebrow">Diese Woche</span><span class="muted" style="font-size:13px">${tage.filter((t) => t.datum >= montag && t.datum < plusTage(montag, 7)).length} Einheiten</span></div>
      <div class="week-days">${Array.from({ length: 7 }, (_, i) => plusTage(montag, i)).map((d) => {
        const t = tage.find((x) => x.datum === d);
        return html`<div key=${d} class=${`wd ${d === HEUTE ? 'today' : ''}`}><span>${wtKurz(d)}</span><b>${Number(d.slice(8, 10))}</b>
          <span class="dots">${erledigt.has(d) ? html`<span style="font-size:11px">✓</span>` : t?.uebersprungen ? html`<span style="font-size:11px" class="muted">–</span>` : t ? liftsDes(t).map((l) => html`<i key=${l} style=${`background:${LIFT[l].farbe}`}></i>`) : null}</span></div>`;
      })}</div>
    </section>

    <div class="maxes">${[['squat', 'S'], ['bench', 'B'], ['dead', 'D']].map(([l, k]) => html`<div class="max" key=${l} style=${`--c:${LIFT[l].farbe}`}>
      <span class="eyebrow">${LIFT[l].name}</span><b>${gw(block.werte[k])}<small> ${einheit()}</small></b><span class="muted" style="font-size:11.5px">Trainingsmax</span></div>`)}</div>
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
    ${training.bearbeiten ? null : html`<span class="zahl tab-num">${mmss((Date.now() - training.start) / 1000)}</span>`}
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
  const [ansicht, setAnsicht] = useState('heute');
  const [uebungAnsicht, setUebungAnsicht] = useState(null);     // { key, zurueck }
  const [leichter, setLeichter] = useState(false);
  const [training, setTraining] = useState(null);
  const [timer, setTimer] = useState(null);
  const [toast, setToast] = useState(null);
  const [lichter, setLichter] = useState(null);
  const [demoErledigt, setDemoErledigt] = useState(() => new Set());
  const [anpassungen, setAnpassungenRoh] = useState({});        // key → persönliche Anpassung der Übung
  const [neueUebung, setNeueUebung] = useState(null);           // { text, beiWahl } – Formular „Neue Übung“ offen
  const [bereit, setBereit] = useState(null);                   // Readiness-Check vor dem Start: { tag } oder { frei: true }
  const sperre = useRef(null);
  const sp = useRef(null);
  const laeuft = useRef(false);
  const zuletzt = useRef(0);
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
    const [tr, me, bl, ei, lauf, inf, ue, an, zf] = await Promise.all(['', 'messwerte', 'block', 'einst', 'laufend', 'programme', 'uebungen', 'anpassungen', 'zusammen']
      .map((k) => (k ? s.meta(k) : s.alle())));
    zusammenSetzen(zf);
    setTrainings(tr);
    setMesswerte(me ?? []);
    setBlock(bl?.ende ? null : bl);
    setEinstRoh({ ...STANDARD_EINSTELLUNGEN, ...(ei ?? {}) });
    katalogMischen(ue ?? []);
    setAnpassungen(an ?? {});
    setTraining(lauf);
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
  // Abgleich: Programme, Einstellungen, Körpergewicht, Block, dann Trainings (run_id braucht den Block)
  // #################################################################
  async function abgleich() {
    if (DEMO || !sp.current || laeuft.current) return;
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
      const ei = await s.meta('einst');
      if (ei?.offen) { await konto.speichereProfil(sb, uid, ei); await s.setzeMeta('einst', { ...ei, offen: false }); }
      else { const e = konto.einstAusProfil(await konto.ladeProfil(sb, uid), ei ?? {}); await s.setzeMeta('einst', e); setEinstRoh({ ...STANDARD_EINSTELLUNGEN, ...e }); }
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
    } finally { laeuft.current = false; }
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

  // Laufendes Training bei jeder Änderung sichern (übersteht Neuladen, Akku leer, App-Wechsel)
  useEffect(() => { if (!DEMO && sp.current && phase === 'bereit') sp.current.setzeMeta('laufend', training ?? null).catch(() => {}); }, [training]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 3200); return () => clearTimeout(id); }, [toast]);
  useEffect(() => { thema(einst.thema); speicher.schreib('prh-thema', einst.thema ?? 'system'); }, [einst.thema]);
  useEffect(() => { if (!lichter) return; const id = setTimeout(() => setLichter(null), 1900); return () => clearTimeout(id); }, [lichter]);

  // Auswertungsstand für alle Ansichten (Live-Bindings in ui/stand.js)
  const stand = useMemo(() => (DEMO || phase !== 'bereit' ? null
    : erstelleStand(trainings, { heute, katalog: katalogListe(), messwerte, formel: einst.formel ?? 'rpe' })), [trainings, messwerte, heute, phase, einst.formel]);
  if (stand) setzeStand(stand);
  setzeAnzeige({ sprache: einst.sprache, einheit: einst.einheit, stange: einst.stange, scheiben: einst.scheiben, formel: einst.formel,
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
      zusammenfuehren: async (von, nach) => {
        if (!navigator.onLine) throw new Error('Zum Zusammenführen braucht das Handy Netz.');
        const n = await konto.zusammenfuehren(supabase(), von, nach);
        setToast({ titel: 'Zusammengeführt', text: `${n} Trainingseinträge hängen jetzt an ${nameVon(nach)}.` });
        zuletzt.current = 0; abgleich();
      },
      darfAendern: (e) => !!einst.admin || (!!e.von && e.von === nutzer?.id),
    });
  }

  if (phase === 'fehler') return html`<div class="screen"><span class="logo" style="margin-top:20px"><i></i>PR Hunter</span><p class="fehler">Start fehlgeschlagen: ${fehler}</p></div>`;
  if (phase === 'laden') return html`<div class="screen"><span class="logo" style="margin-top:20px"><i></i>PR Hunter</span><p class="muted">Lade …</p></div>`;
  if (phase === 'anmelden') return html`<${Anmeldung} angemeldet=${(s) => starte({ id: s.user.id, email: s.user.email })}
    zurueck=${nutzer ? () => setPhase('bereit') : null}/>`;

  // Programme für die Ansichten (Datei → Definition); der aktive Block nutzt die Version, mit der er gestartet wurde
  const programme = Object.fromEntries(Object.entries(info).map(([d, p]) => [d, p.versionen[p.version] ?? Object.values(p.versionen).at(-1)]));
  for (const [d, p] of Object.entries(info)) if (!p.vorlage) NAMEN[d] = p.name;
  const blockDef = block ? info[block.datei]?.versionen[block.version] ?? programme[block.datei] : null;
  const aktiverBlock = blockDef ? block : null;
  if (aktiverBlock) programme[aktiverBlock.datei] = blockDef;
  const tage = aktiverBlock ? tageMitOptionen(blockTage(blockDef, { ...aktiverBlock, cut: einst.cut }), aktiverBlock) : [];
  // Erledigt nach Datum des Plantags (bei verschobenen Tagen das neue Datum)
  const datumVon = new Map(tage.map((t) => [t.offset, t.datum]));
  const erledigt = DEMO ? demoErledigt : new Set(trainings.filter((t) => aktiverBlock && t.runId === aktiverBlock.id && t.tagOffset != null && !t.geloescht)
    .map((t) => datumVon.get(t.tagOffset) ?? plusTage(aktiverBlock.start, t.tagOffset)));
  const offen = trainings.filter((t) => t.offen).length;
  const einstUi = { ...einst, koerpergewicht: DEMO ? demoKg ?? KOERPERGEWICHT : KOERPERGEWICHT };

  const gehe = (a) => { setAnsicht(a); scrollTo(0, 0); };
  const zuUebung = (key, zurueck) => { setUebungAnsicht({ key, zurueck }); gehe('uebung'); };
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
    setTraining({ id: neueId(), start: Date.now(), datum: heuteLokal(), planDatum: tag.datum, titel: `Woche ${nr} · ${datumLang(tag.datum).split(',')[0]}`,
      runId: aktiverBlock?.id ?? null, woche: tag.woche, tagOffset: tag.offset, bereitschaft,
      karten: baueTraining(tag, { leichter: leicht, koerperKg: einstUi.koerpergewicht }) });
    gehe('training');
  };
  const starteFrei = (bereitschaft = null) => {
    tonFreigeben(); wachBleiben();
    setTraining({ id: neueId(), start: Date.now(), datum: heuteLokal(), planDatum: null, titel: 'Freies Training', runId: null, bereitschaft, karten: [] });
    gehe('training');
  };
  const starten = (tag) => { if (training) gehe('training'); else if (mitCheck) setBereit({ tag }); else startePlan(tag); };
  const freiStarten = () => { if (mitCheck) setBereit({ frei: true }); else starteFrei(); };
  const startenAm = (d) => { const t = tage.find((x) => x.datum === d); if (t) starten(t); };
  const beenden = async ({ sessionRpe = null, notiz = null } = {}) => {
    const t = training;
    const fertig = alleSaetze(t).filter((s) => s.erledigt).length;
    setTraining(null); setTimer(null);
    try { sperre.current?.release(); } catch { /* egal */ }
    gehe(t.bearbeiten ? 'verlauf' : 'heute');
    if (!fertig) {
      setToast(t.bearbeiten ? { titel: 'Bearbeitung verworfen', text: 'Das gespeicherte Training bleibt unverändert.' }
        : { titel: 'Training verworfen', text: 'Kein Satz abgehakt, nichts gespeichert.' });
      return;
    }
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
  const tagOption = (offset, { datum, weg = false }) => {
    const verschoben = { ...(aktiverBlock.verschoben ?? {}) };
    if (datum !== undefined) { if (datum) verschoben[offset] = datum; else delete verschoben[offset]; }
    const uebersprungen = weg ? [...new Set([...(aktiverBlock.uebersprungen ?? []), offset])] : aktiverBlock.uebersprungen ?? [];
    blockSetzen({ ...aktiverBlock, verschoben, uebersprungen });
    setToast(weg ? { titel: 'Übersprungen', text: 'Weiter mit dem nächsten Plantag.' } : datum ? { titel: 'Verschoben', text: `Auf ${datumLang(datum)}` } : { titel: 'Zurück auf dem Plan', text: '' });
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
    await konto.kontoLoeschen(supabase());
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

  const imTraining = ansicht === 'training' && training;
  const leiste = training && ansicht !== 'training';
  const unten = 84 + (timer && !imTraining ? 76 : 0) + (leiste ? 70 : 0);   // Platz für Tabs und Dock
  const aktiverTab = ansicht === 'training' ? 'heute' : ansicht === 'uebung' ? (uebungAnsicht?.zurueck === 'training' ? 'heute' : 'verlauf') : ansicht === 'einstellungen' ? 'heute' : ansicht;
  return html`<div>
    <style>${`.screen{padding-bottom:calc(${unten + 24}px + env(safe-area-inset-bottom,0px))}`}</style>
    ${imTraining ? html`<${Training} t=${training} setT=${setTraining} timer=${timer} setTimer=${setTimer} einst=${einstUi} toast=${setToast} lichter=${setLichter}
        minimieren=${() => gehe('heute')} beenden=${beenden} zuVerlauf=${(key) => zuUebung(key, 'training')}/>`
      : ansicht === 'uebung' && uebungAnsicht ? html`<${UebungsSeite} key=${uebungAnsicht.key} schluessel=${uebungAnsicht.key}
          zurueck=${() => gehe(uebungAnsicht.zurueck === 'training' && training ? 'training' : 'verlauf')}
          zurueckText=${uebungAnsicht.zurueck === 'training' && training ? 'Zurück zum Training' : 'Zurück zum Verlauf'}/>`
      : ansicht === 'programme' ? html`<${Programme} programme=${programme} info=${info} block=${aktiverBlock} setBlock=${blockSetzen} erledigt=${erledigt} toast=${setToast}
          sollIst=${aktiverBlock && !DEMO ? sollIst(tage, trainings, aktiverBlock.id) : []}
          neueMaxeFuer=${aktiverBlock && !DEMO ? (vertrauen) => neueMaxe(blockDef, aktiverBlock, trainings, projiziere, incStandard(), { vertrauen }) : null}
          zuHeute=${() => gehe('heute')} einst=${einstUi} setEinst=${setEinst} importieren=${importieren}/>`
      : ansicht === 'verlauf' ? html`<${Verlauf} planTage=${tage} erledigt=${erledigt} startenAm=${startenAm} zuUebung=${(key) => zuUebung(key, 'verlauf')}
          bearbeiten=${DEMO ? null : bearbeiten} loeschen=${DEMO ? null : loeschen}/>`
      : ansicht === 'statistik' ? html`<${Statistik} einst=${einstUi} blockStart=${aktiverBlock?.start ?? null} trainings=${trainings}/>`
      : ansicht === 'rechner' ? html`<${Rechner} einst=${einstUi}/>`
      : ansicht === 'einstellungen' ? html`<${Einstellungen} einst=${einstUi} setEinst=${setEinst} SyncPunkt=${SyncPunkt} zurueck=${() => gehe('heute')}
          konto=${nutzer} sync=${sync} offen=${offen} abgleich=${abgleich} abmelden=${raus} exportieren=${exportieren}
          neuAnmelden=${() => setPhase('anmelden')} kontoLoeschen=${DEMO ? null : kontoLoeschen}/>`
      : html`<${Heute} block=${aktiverBlock} prog=${blockDef} tage=${tage} erledigt=${erledigt} leichter=${leichter} setLeichter=${setLeichter} training=${training}
          starten=${starten} freiStarten=${freiStarten} fortsetzen=${() => gehe('training')} einst=${einstUi} sync=${sync} offen=${offen}
          zuEinstellungen=${() => gehe('einstellungen')} zuProgrammen=${() => gehe('programme')} tagOption=${aktiverBlock && !training ? tagOption : null}/>`}
    ${(timer && !imTraining) || leiste ? html`<div class="dock">
      ${leiste ? html`<${LaufLeiste} training=${training} oeffnen=${() => gehe('training')}/>` : null}
      ${timer && !imTraining ? html`<${PausenTimer} timer=${timer} setTimer=${setTimer}/>` : null}
    </div>` : null}
    <div class="tabs"><nav>${TABS.map(([k, t]) => html`<button key=${k} aria-current=${aktiverTab === k ? 'page' : 'false'} onClick=${() => gehe(k)}>
      ${I[k]}<span>${t}</span>${k === 'heute' && leiste ? html`<i class="lauf"></i>` : null}</button>`)}</nav></div>
    ${lichter ? html`<div class=${`lichter ${lichter.gold ? 'gold' : ''}`} role="status"><div><div class="lampen"><i></i><i></i><i></i></div><b>${lichter.titel}</b><span>${lichter.text}</span></div></div>` : null}
    ${toast ? html`<div class="toast" role="status"><div><b>${toast.titel}</b><span class="muted" style="font-size:14px">${toast.text}</span></div></div>` : null}
    ${bereit ? html`<${BereitschaftSheet} mitLeichter=${!bereit.frei} leichter=${!!bereit.tag && bereit.tag.datum === HEUTE && leichter} zu=${() => setBereit(null)}
      los=${(r, l) => { const b = bereit; setBereit(null); if (b.frei) starteFrei(r); else startePlan(b.tag, r, l); }}/>` : null}
    ${neueUebung ? html`<${UebungFormular} modus="neu" start=${neueUebung.text} zu=${() => setNeueUebung(null)}
      fertig=${(e) => { const wahl = neueUebung.beiWahl; setNeueUebung(null); wahl(e.k); }}/>` : null}
  </div>`;
}

render(html`<${App}/>`, document.getElementById('app'));
