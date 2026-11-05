// PR Hunter · Programme – aktiver Block (Soll-Ist, neue Maxe aus dem Test), Vorlagen und eigene Programme, Detail mit
// Wochenplan, Block starten, Import (KI/CSV oder JSON), Block-Generator, Editor, Kopieren und Teilen.
import { html, useState, useEffect, fmt, I, Sheet, datumKurz, katalogListe, kopiere, gw, einheit, ZahlFeld, nameVon, UebungsBild, useSitzung, sitzungLeeren, deEn, useUnterReiter, UNTER_VORSCHAU } from './basis.js';
import { UebungSuche } from './suche.js';
import { AusdauerPlanKarte, WochenKarte, beschreibung, WT_NAME } from './ausdauerplan.js';
import { Planer } from './planer.js';
import { BodybuildingGenerator } from './bbgenerator.js';
import { EigenerPlan } from './eigenerplan.js';
import { EINSTEIGER } from './einsteiger.js';
import { useRef } from '../vendor/htm-preact.js';
import { KI_ANLEITUNG, leseProgrammCsv, pruefeProgrammJson, kiAnleitung, leseImport, cardioPlanAus, CARDIO_BEISPIEL } from '../js/import.js';
import { naechsterMontag, wochentag as wtVon } from '../js/ausdauerplan.js';

// Import-Zuordnungen (Name aus der Datei → Katalogschlüssel), auf dem Gerät gemerkt: beim nächsten Import automatisch
const ZUORDNUNG = 'prh-import-zuordnung';
export const ladeZuordnung = () => { try { return JSON.parse(localStorage.getItem(ZUORDNUNG) ?? '{}') ?? {}; } catch { return {}; } };
export const merkeZuordnung = (z) => { try { localStorage.setItem(ZUORDNUNG, JSON.stringify(z)); } catch { /* nur diese Sitzung */ } };
import { pruefePana } from '../js/generator.js';
import { HEUTE, DEMO, DIENSTE, plusTage } from './stand.js';
import { INFO, BEISPIEL_MAXE, MAX_NAME, startMaxe, kurzTitel, blockTage, wochenListe, TagPlan } from './plan.js';
import { GeneratorAnsicht } from './generator.js';
import { planDrucken } from './plandruck.js';
import { Editor } from './editor.js';

export { INFO, NAMEN, blockTage, wochenListe, kurzTitel, TagPlan } from './plan.js';

/** Soll-Ist je Woche des aktiven Blocks: Einheiten, Ø Abweichung vom geplanten Gewicht, Ø RPE gegen Ziel. */
function SollIst({ zeilen }) {
  const mitDaten = zeilen.filter((z) => z.erledigt > 0);
  if (!mitDaten.length) return null;
  const vz = (d) => (d == null ? '–' : `${d > 0 ? '+' : d < 0 ? '−' : '±'}${gw(Math.abs(d), 1)}`);
  return html`<div class="stack" style="gap:6px"><span class="eyebrow">Soll-Ist</span>
    <table class="rec"><thead><tr><th>Woche</th><th>Einheiten</th><th>Δ ${einheit()}</th><th>RPE ist / Ziel</th></tr></thead>
      <tbody>${zeilen.map((z, i) => html`<tr key=${z.woche}><td>${i + 1}</td><td>${z.erledigt}/${z.geplant}</td>
        <td class=${z.abweichungKg > 0 ? 'k' : ''}>${vz(z.abweichungKg)}</td>
        <td>${z.rpeIst != null ? `${fmt(z.rpeIst)} / ${fmt(z.rpeSoll)}` : '–'}</td></tr>`)}</tbody></table>
    <span class="muted" style="font-size:12px">Δ = Ø gemachtes minus geplantes Gewicht je Satz. RPE nur aus Sätzen mit RPE und Ziel.</span></div>`;
}

/** Neue Maxe nach der Projektionsregel des Programms, sobald in der Testwoche Sätze erledigt sind. */
function NeueMaxe({ maxe, planen, vertrauen = null, setVertrauen }) {
  const liste = Object.entries(maxe).filter(([, m]) => m.neuesMax != null || m.projiziert != null);
  if (!liste.length) return null;
  return html`<div class="stack" style="gap:6px"><span class="eyebrow">Neue Maxe aus dem Test</span>
    ${vertrauen != null ? html`<div class="seg" role="group" aria-label="Wiederholungen im Test">
      <button aria-pressed=${String(vertrauen === 1)} onClick=${() => setVertrauen(1)}>Wdh sauber (100 %)</button>
      <button aria-pressed=${String(vertrauen === 0.5)} onClick=${() => setVertrauen(0.5)}>Wdh unsauber (50 %)</button></div>
      <span class="muted" style="font-size:12px">Unsauber: das neue Max geht nur den halben Weg vom alten zum projizierten Wert.</span>` : null}
    <table class="rec"><thead><tr><th>Lift</th><th>Test</th><th>${deEn('bisher', 'before')}</th><th>${deEn('neu', 'new')}</th></tr></thead>
      <tbody>${liste.map(([l, m]) => html`<tr key=${l}><td>${MAX_NAME[l]}</td><td class="muted">${gw(m.kg)} × ${m.wdh}</td><td>${gw(m.alt)}</td>
        <td class="k">${m.neuesMax != null ? gw(m.neuesMax) : 'von Hand'}${m.projiziert != null && m.neuesMax !== m.projiziert ? html` <span class="muted">(${gw(m.projiziert)})</span>` : null}</td></tr>`)}</tbody></table>
    <span class="muted" style="font-size:12px">In Klammern der projizierte Wert, wenn die Regel des Programms das neue Max davon abweichen lässt.</span>
    <button class="btn btn-chalk btn-sm" onClick=${planen}>Nächsten Block mit diesen Maxen planen</button></div>`;
}

const ERSTELLER = ['bodybuilding', 'eigen', 'generator', 'ziel'];
// Sitzungsschlüssel je Ersteller. „Eingaben“ = Abweichung vom Stand beim Öffnen (Vorbefülltes zählt nicht als Eingabe)
const PRAEFIX = { ziel: 'prh-gen-ziel-', bodybuilding: 'prh-gen-bb-', eigen: 'prh-gen-eigen-', generator: 'prh-gen-pl-' };
const AUSSTEHEND = 'prh-gen-ziel-ausdauer';               // Cardio-Plan aus dem Planer – startet mit dem Kraftplan
// 239: der Planer geht mit Zurück erst einen Schritt zurück (liefert true, solange er das selbst erledigt)
let planerZurueck = null;
const navi = (k) => k.endsWith('-schritt') || k.endsWith('-seite');      // Position im Ersteller, keine Eingabe
const standVon = (art) => {
  const p = PRAEFIX[art];
  if (!p) return '[]';
  try { return JSON.stringify(Object.keys(sessionStorage).filter((k) => k.startsWith(p) && !navi(k) && k !== AUSSTEHEND).sort().map((k) => [k, sessionStorage.getItem(k)])); } catch { return '[]'; }
};
const merkeStand = (art) => { try { sessionStorage.setItem(`prh-gen-stand-${art}`, standVon(art)); } catch { /* egal */ } };
const eingabenDa = (art) => { if (!PRAEFIX[art]) return false; try { return standVon(art) !== (sessionStorage.getItem(`prh-gen-stand-${art}`) ?? '[]'); } catch { return false; } };
const lies = (k) => { try { return JSON.parse(sessionStorage.getItem(k) ?? 'null'); } catch { return null; } };

export function Programme({ programme, info = {}, block, setBlock, erledigt, toast, zuHeute, einst, setEinst, importieren, sollIst = [], neueMaxeFuer = null, ausdauer = null }) {
  // Vertrauensfaktor der v3-Projektion (rpe10_table): 1,0 bei sauberen Wdh, 0,5 bei unsauberen
  const [vertrauen, setVertrauen] = useState(1);
  const mitVertrauen = programme[block?.datei]?.rules?.projection?.method === 'rpe10_table';
  const neueMaxe = neueMaxeFuer?.(mitVertrauen ? vertrauen : null) ?? {};
  // { art: 'detail' | 'import' | 'generator' | 'editor', datei, werte, start, ausTest, vorgabe }
  // Unterseite (Generator, Eigener Plan …) übersteht einen Seitenwechsel; „Zurück zur Liste“ oder Speichern setzt sie zurück
  const [ansicht, setAnsichtRoh] = useSitzung('prh-gen-ansicht', null);
  const setAnsicht = (a) => { if (a == null) sitzungLeeren('prh-gen-'); setAnsichtRoh(a); };
  useEffect(() => window.scrollTo(0, 0), [ansicht?.art]);           // Unterseiten (Generatoren, Detail) beginnen oben
  const [beenden, setBeenden] = useState(false);
  // Unterseiten (Generatoren, Plan, Editor, Import) mit eigenem Verlaufseintrag: die Zurück-Taste des Handys schließt
  // erst die Unterseite, statt die vorige App-Ansicht (z. B. Feed) zu öffnen
  // Verlauf: jede Unterseite hat einen Eintrag { unter, unterAnsicht }; Schritte der Ersteller liegen darüber mit
  // demselben unter. Zurück (Handy und Pfeil oben) entscheidet zentral im popstate: Schritt zurück, Warnung oder verlassen.
  const oeffne = (a, { ersetzen = false } = {}) => {
    const st = { ...(history.state ?? {}), unter: a.art, unterAnsicht: a };
    delete st.schritt; delete st.seite; delete st.sheet;
    if (ersetzen && history.state?.unter) history.replaceState(st, ''); else history.pushState(st, '');
    setAnsicht(a);
  };
  const [verlassen, setVerlassen] = useState(false);
  // Ersteller zu → Warnung zu (beim Zurückspringen zeichnet Preact die Liste, bevor das Fenster sein popstate bekommt)
  useEffect(() => { if (!ERSTELLER.includes(ansicht?.art)) setVerlassen(false); }, [ansicht?.art]);
  const ansichtJetzt = useRef(ansicht); ansichtJetzt.current = ansicht;
  // Mehrere Einträge auf einmal zurück (Verwerfen, Speichern): so lange zurück, wie weiterWenn(unter) gilt, dann danach()
  const abwicklung = useRef(null);
  const abwickeln = (weiterWenn, danach) => {
    const z = history.state?.unter ?? null;
    if (!weiterWenn(z)) { danach(z, history.state); return; }
    abwicklung.current = { weiterWenn, danach };
    history.back();
  };
  // Unterseite verlassen: Eingaben dieses Erstellers verwerfen; vom Ersteller zurück in den Planer, sonst zur Liste
  const weg = (art, ziel, st) => {
    if (PRAEFIX[art] && art !== 'ziel') { sitzungLeeren(PRAEFIX[art]); try { sessionStorage.removeItem(`prh-gen-stand-${art}`); } catch { /* egal */ } }
    if (ziel === 'ziel' && art !== 'ziel') { setAnsichtRoh(st?.unterAnsicht ?? { art: 'ziel' }); return; }
    setAnsicht(null);
    if (ziel) abwickeln((z) => !!z, () => {});              // übrige Einträge der Unterseiten entfernen
  };
  const aktuell = useRef({}); aktuell.current = { weg };
  useEffect(() => {
    const zurueck = (e) => {
      const ziel = e.state?.unter ?? null, art = ansichtJetzt.current?.art ?? null;
      const ab = abwicklung.current;
      if (ab) { if (ab.weiterWenn(ziel)) { history.back(); return; } abwicklung.current = null; ab.danach(ziel, e.state); return; }
      if (!art && !ziel) { aktuell.current.setBereich(e.state?.progReiter ?? 'kraft'); return; }   // Reiter Kraft/Cardio/Woche
      if (!art || ziel === art) return;                       // Liste, oder ein Schritt innerhalb derselben Unterseite
      const zurueckAuf = { ...e.state, unter: art, unterAnsicht: ansichtJetzt.current };
      if (art === 'ziel' && planerZurueck?.()) { history.pushState(zurueckAuf, ''); return; }
      if (eingabenDa(art)) { history.pushState(zurueckAuf, ''); setVerlassen(true); return; }
      aktuell.current.weg(art, ziel, e.state);
    };
    addEventListener('popstate', zurueck);
    return () => removeEventListener('popstate', zurueck);
  }, []);
  // Pfeil oben: wie die Zurück-Taste des Handys; ohne eigenen Verlaufseintrag (z. B. nach einem Seitenwechsel) direkt
  const zurListe = () => {
    const art = ansicht?.art;
    if (history.state?.unter === art && !history.state?.sheet) { history.back(); return; }
    if (art === 'ziel' && planerZurueck?.()) return;
    if (eingabenDa(art)) { setVerlassen(true); return; }
    weg(art, null);
  };
  // Ersteller öffnen, vorbefüllt (Einsteigerplan, Planer → Kraftplan); aus dem Planer bleiben dessen Eingaben erhalten
  const erstellerOeffnen = (art, werte = {}, { vonPlaner = false, vorgabe = null } = {}) => {
    sitzungLeeren(vonPlaner ? PRAEFIX[art] : 'prh-gen-');
    try { for (const [k, v] of Object.entries(werte)) sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Sitzungsspeicher startet der Plan leer */ }
    merkeStand(art);
    oeffne({ art, ...(vorgabe ? { vorgabe } : {}) });
  };
  const einsteigerWerte = (e) => ({ 'prh-gen-eigen-name': e.name, 'prh-gen-eigen-wochen': 8, 'prh-gen-eigen-schritt': 3,
    'prh-gen-eigen-tage': e.tage.map((t) => ({ name: t.name, uebungen: t.uebungen.map((u) => ({ ...u })) })) });
  // 239: Reiter Kraft · Cardio · Woche, sobald Ausdauer an ist
  // Seitlich wischen wie bei Statistik/Feed; von links hereinkommend Kraft, von rechts Woche (App setzt prh-reiter-programme)
  const [bereichRoh, setBereichRoh] = useState(() => UNTER_VORSCHAU.programme ?? (() => { try { return sessionStorage.getItem('prh-reiter-programme'); } catch { return null; } })() ?? 'kraft');
  const setBereich = (k) => { setBereichRoh(k); try { sessionStorage.setItem('prh-reiter-programme', k); } catch { /* egal */ } };
  aktuell.current.setBereich = setBereich;
  const PROG_REITER = [['kraft', deEn('💪 Kraft', '💪 Strength')], ['cardio', deEn('🏃 Cardio', '🏃 Cardio')], ['woche', deEn('📅 Woche', '📅 Week')]];
  const mitReitern = !!(einst.ausdauer && ausdauer), bereich = PROG_REITER.some(([k]) => k === bereichRoh) ? bereichRoh : 'kraft';
  // Reiter mit Verlaufseintrag: Zurück auf Cardio/Woche führt erst zu Kraft, statt die Seite zu verlassen
  const reiterWahl = (k) => {
    const st = history.state ?? {};
    if (k === 'kraft') { if (st.progReiter && !st.unter) history.back(); else setBereich(k); return; }
    if (st.progReiter) history.replaceState({ ...st, progReiter: k }, ''); else history.pushState({ ...st, progReiter: k }, '');
    setBereich(k);
  };
  useUnterReiter('programme', mitReitern && !ansicht ? PROG_REITER : [], bereich, (k) => { reiterWahl(k); scrollTo({ top: 0 }); });
  const planerOeffnen = (ziel = null) => erstellerOeffnen('ziel', ziel ? { 'prh-gen-ziel-wahl': { ziel } } : {});
  const cardioStarten = (a) => {
    if (!a?.plan) return;
    setEinst({ ...einst, ausdauer: a.ausdauer, ausdauerPlan: a.plan });
    toast({ titel: deEn('Cardio-Plan gestartet', 'Cardio plan started'), text: deEn(`${a.plan.wochen} Wochen ab ${datumKurz(a.start)}`, `${a.plan.wochen} weeks from ${datumKurz(a.start)}`) });
  };
  const uebergeben = (art, { werte = {}, vorgabe = null, ausstehend = null, id = null } = {}) => {
    if (art === 'cardio') { abwickeln((z) => !!z, () => { setAnsicht(null); reiterWahl('cardio'); }); return; }
    try { if (ausstehend) sessionStorage.setItem(AUSSTEHEND, JSON.stringify(ausstehend)); else sessionStorage.removeItem(AUSSTEHEND); } catch { /* egal */ }
    if (art === 'einsteiger') { erstellerOeffnen('eigen', einsteigerWerte(EINSTEIGER.find((e) => e.id === id)), { vonPlaner: true }); return; }
    erstellerOeffnen(art, werte, { vonPlaner: true, vorgabe });
  };
  // Gespeichert: wartender Cardio-Plan aus dem Planer startet mit; Verlauf bis zur Liste abbauen, dann der Plan
  const speichernNeu = async (p, { bearbeiten = false, werte = null, start = null, ...herkunft } = {}) => {
    try {
      const d = await importieren(p, herkunft);
      const aus = lies(AUSSTEHEND);
      if (aus?.plan) setEinst({ ...einst, ausdauer: aus.ausdauer, ausdauerPlan: aus.plan });
      const neu = { art: bearbeiten ? 'editor' : 'detail', datei: d, werte, start: start ?? aus?.start ?? null };
      abwickeln((z) => !!z, () => { sitzungLeeren('prh-gen-'); oeffne(neu); });
      toast({ titel: deEn('Programm gespeichert', 'Programme saved'), text: aus?.plan ? deEn(`${p.name} · Cardio-Plan gestartet`, `${p.name} · cardio plan started`) : p.name });
    } catch (e) { toast({ titel: 'Nicht gespeichert', text: e.message }); }
  };
  // 250: Import mit Cardio – Kraftteil wird Programm, Cardio wartet bis zum Speichern (bzw. startet sofort bei nur Cardio)
  if (ansicht?.art === 'import') return html`<${Import} zurueck=${zurListe} ausdauerAlt=${einst.ausdauer}
    speichern=${(p, aus) => { try { if (aus) sessionStorage.setItem(AUSSTEHEND, JSON.stringify(aus)); else sessionStorage.removeItem(AUSSTEHEND); } catch { /* egal */ } speichernNeu(p, { quelle: 'import' }); }}
    cardioNur=${(aus) => { cardioStarten(aus); uebergeben('cardio'); }}/>`;
  // Verwerfen: zurück bis unter dieser Unterseite (das schließt auch das Fenster), dann verlassen
  const verwerfen = () => { const art = ansicht?.art; abwickeln((z) => z === art, (z, st) => weg(art, z, st)); };
  const warnung = verlassen ? html`<${Sheet} zu=${() => setVerlassen(false)} label=${deEn('Eingaben verwerfen', 'Discard input')}>
      <h2 class="h2">${deEn('Eingaben verwerfen?', 'Discard your input?')}</h2>
      <p style="margin:0">${deEn('Was du hier eingegeben hast, geht verloren, wenn du jetzt zurückgehst.', 'What you entered here is lost if you go back now.')}</p>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setVerlassen(false)}>${deEn('Weiter bearbeiten', 'Keep editing')}</button>
        <button class="btn btn-gefahr" style="flex:1" onClick=${verwerfen}>${deEn('Verwerfen', 'Discard')}</button></div>
    <//>` : null;
  if (ansicht?.art === 'ziel') return html`<${Planer} zurueck=${zurListe} abbrechen=${() => (eingabenDa('ziel') ? setVerlassen(true) : verwerfen())} einst=${einst} block=${block} blockName=${block ? INFO[block.datei]?.kurz ?? '' : ''}
    ausdauer=${ausdauer ?? {}} uebergeben=${uebergeben} cardioStarten=${cardioStarten} setZurueck=${(f) => { planerZurueck = f; }}/>${warnung}`;
  if (ansicht?.art === 'bodybuilding') return html`<${BodybuildingGenerator} zurueck=${zurListe} speichern=${speichernNeu} ausdauer=${einst.ausdauer || lies(AUSSTEHEND)?.ausdauer}/>${warnung}`;
  if (ansicht?.art === 'eigen') return html`<${EigenerPlan} zurueck=${zurListe} speichern=${speichernNeu}/>${warnung}`;
  if (ansicht?.art === 'generator') return html`<${GeneratorAnsicht} zurueck=${zurListe} einst=${einst} speichern=${speichernNeu} vorlagen=${programme} vorgabe=${ansicht.vorgabe}/>${warnung}`;
  if (ansicht?.art === 'editor' && programme[ansicht.datei]) return html`<${Editor} key=${ansicht.datei} datei=${ansicht.datei} programm=${programme[ansicht.datei]}
    start=${block?.datei === ansicht.datei ? block.start : null}
    zurueck=${() => oeffne({ art: 'detail', datei: ansicht.datei }, { ersetzen: true })} toast=${toast}/>`;
  if (ansicht?.art === 'detail' && programme[ansicht.datei]) return html`<${Detail} key=${ansicht.datei} datei=${ansicht.datei} prog=${programme[ansicht.datei]} vorgabe=${ansicht.werte}
    ausTest=${!!ansicht.ausTest} startVorschlag=${ansicht.start} block=${block} einst=${einst} setEinst=${setEinst} toast=${toast} zurueck=${zurListe}
    neueVersion=${block?.datei === ansicht.datei && info[ansicht.datei]?.version != null && block.version != null && info[ansicht.datei].version !== block.version ? info[ansicht.datei].version : null}
    umstellen=${(v) => { setBlock({ ...block, version: v }); toast({ titel: `Block auf Version ${v} umgestellt`, text: 'Gilt ab der nächsten Einheit; erledigte Trainings bleiben, wie sie waren.' }); }}
    bearbeiten=${(d) => oeffne({ art: 'editor', datei: d }, { ersetzen: true })} kopieBearbeiten=${(p) => speichernNeu(p, { bearbeiten: true, quelle: 'kopie', datei: ansicht.datei })}
    zumGenerator=${(vorgabe) => oeffne({ art: 'generator', vorgabe }, { ersetzen: true })}
    starten=${(b) => { setBlock(b);
      // mit Cardio-Plan: gleich die Wochenübersicht (Kraft und Cardio Woche für Woche), sonst zu Heute
      const mitCardio = !!(einst.ausdauer && einst.ausdauerPlan);
      toast({ titel: 'Block gestartet', text: mitCardio ? deEn('Hier deine Wochen mit Kraft und Cardio – Tage antippen zum Ändern.', 'Here are your weeks with strength and cardio – tap a day to change it.') : `${INFO[b.datei].kurz} ab ${datumKurz(b.start)}` });
      abwickeln((z) => !!z, () => { setAnsicht(null); if (mitCardio) reiterWahl('woche'); else zuHeute(); }); }}/>`;
  const aktivTage = block ? blockTage(programme[block.datei], { ...block, cut: einst.cut }) : [];
  const wochen = wochenListe(aktivTage);
  // Stand: erledigt laut Soll-Ist (zählt auch Trainings ohne Planbezug), sonst die aus dem Plan gestarteten
  const erledigtZahl = sollIst.length ? sollIst.reduce((a, z) => a + z.erledigt, 0) : aktivTage.filter((t) => erledigt.has(t.datum)).length;
  const naechsterTag = aktivTage.find((t) => t.datum >= HEUTE);
  const aktWoche = naechsterTag ? wochen.indexOf(naechsterTag.woche) + 1 : wochen.length;
  const reiter = mitReitern, teil = reiter ? bereich : 'kraft';
  const eigene = Object.keys(programme).filter((d) => d.startsWith('prog:') || d.startsWith('import:'));
  const vorlagen = Object.keys(programme).filter((d) => !eigene.includes(d));
  const karte = (datei) => {
    const p = programme[datei];
    let tage = [], w = [];
    try { tage = blockTage(p, { werte: { ...BEISPIEL_MAXE, ...Object.fromEntries((p.inputs ?? []).map((k) => [k, BEISPIEL_MAXE[k] ?? 100])) } }); w = wochenListe(tage); } catch { /* unvollständiges Programm */ }
    return html`<button key=${datei} class="card prog" onClick=${() => oeffne({ art: 'detail', datei })}>
      <div class="row between" style="align-items:flex-start"><h2 class="h2">${INFO[datei].kurz}</h2>${block?.datei === datei ? html`<span class="tag top">Aktiv</span>` : null}</div>
      <p class="muted" style="margin:0;font-size:14px">${INFO[datei].text}</p>
      <div class="prog-meta"><div><b>${w.length}</b><span>Wochen</span></div><div><b>${tage.length}</b><span>Einheiten</span></div>
        <div><b>${w.length ? fmt(tage.length / w.length, 1) : '–'}</b><span>pro Woche</span></div><div><b>${(p.inputs ?? []).join(' ') || '–'}</b><span>Maxe</span></div></div>
      <div class="row wrap" style="gap:6px">${INFO[datei].tags.map((t) => html`<span key=${t} class="tag">${t}</span>`)}${INFO[datei].importiert ? null : html`<span class="tag gold">✓ gegen Excel geprüft</span>`}</div>
    </button>`;
  };
  return html`<div class="screen modern">
    <header class="topbar"><div><div class="eyebrow">Blöcke und Vorlagen</div><h1 class="h1">Programme</h1></div>${DEMO ? html`<span class="proto">Demo</span>` : null}</header>
    ${reiter ? html`<div class="seg prog-reiter" role="tablist">${PROG_REITER.map(([k, n]) => html`<button key=${k} role="tab" aria-pressed=${String(teil === k)} onClick=${() => reiterWahl(k)}>${n}</button>`)}</div>` : null}
    ${teil === 'cardio' ? html`<${AusdauerPlanKarte} einst=${einst} setEinst=${setEinst} liste=${ausdauer.liste} plan=${ausdauer.plan} eintragen=${ausdauer.eintragen} zuUebung=${ausdauer.zuUebung} neu=${() => planerOeffnen(block ? 'block' : 'cardio')}/>` : null}
    ${teil === 'woche' ? html`<${WochenKarte} plan=${ausdauer.plan} planTage=${ausdauer.planTage ?? []} kraftTag=${ausdauer.kraftTag} beinTag=${ausdauer.beinTag} liste=${ausdauer.liste} einst=${einst} setEinst=${setEinst} kraftVerschieben=${ausdauer.kraftVerschieben} eintragen=${ausdauer.eintragen} neu=${() => planerOeffnen()}/>` : null}
    ${teil !== 'kraft' ? null : html`
    ${block ? html`<section class="card pad stack aktiv-block">
      <div class="row between"><span class="status-aktiv"><i></i>Aktiv</span>${einst.cut ? html`<span class="tag">Cut-Modus</span>` : null}</div>
      <div><h2 class="h2 ab-name">${INFO[block.datei].kurz}</h2>
        <div class="muted ab-unter"><span>${`Woche ${aktWoche}/${wochen.length}`}</span>${' · '}<span>${`bis ${aktivTage.length ? datumKurz(aktivTage.at(-1).datum) : '–'}`}</span></div></div>
      <div class="ab-fortschritt" role="progressbar" aria-valuemin="0" aria-valuemax=${aktivTage.length} aria-valuenow=${erledigtZahl}><i style=${`width:${aktivTage.length ? (erledigtZahl / aktivTage.length) * 100 : 0}%`}></i></div>
      <div class="row between ab-zahlen"><span>${`${erledigtZahl} von ${aktivTage.length} Einheiten`}</span>
        <span class="ab-maxe">${['S', 'B', 'D'].filter((k) => block.werte[k] != null).map((k) => [k, block.werte[k]]).map(([k, v]) => html`<span key=${k}>${MAX_NAME[k]} <b>${gw(v)}</b></span>`)}</span></div>
      ${sollIst.length ? html`<details class="ab-sollist"><summary><span>Plan vs. Ist</span><span class="woche-pfeil" aria-hidden="true">${I.weiter}</span></summary><${SollIst} zeilen=${sollIst}/></details>` : null}
      <${NeueMaxe} maxe=${neueMaxe} vertrauen=${mitVertrauen ? vertrauen : null} setVertrauen=${setVertrauen} planen=${() => oeffne({ art: 'detail', datei: block.datei, ausTest: true,
        werte: { ...block.werte, ...Object.fromEntries(Object.entries(neueMaxe).filter(([, m]) => m.neuesMax != null).map(([l, m]) => [l, m.neuesMax])) },
        start: aktivTage.length ? plusTage(aktivTage.at(-1).datum, 3) : HEUTE })}/>
      <div class="row"><button class="btn btn-chalk btn-sm" style="flex:1" onClick=${() => oeffne({ art: 'detail', datei: block.datei })}>Plan ansehen</button>
        <button class="btn btn-gefahr btn-sm" onClick=${() => setBeenden(true)}>Block beenden</button></div>
    </section>` : html`<section class="card pad"><p style="margin:0">Kein aktiver Block. Erstelle unten einen neuen Plan.</p></section>`}
    ${/* Seite einfach halten: ein Knopf „Neuen Plan erstellen“ fragt erst dann nach dem Weg; Meine Pläne und Vorlagen zugeklappt */ ''}
    <${GeteiltePlaene} speichernNeu=${speichernNeu} toast=${toast}/>
    <h2 class="abschnitt-titel">Neuer Plan</h2>
    <button class="btn btn-chalk btn-block" onClick=${() => planerOeffnen()}>${deEn('+ Neuen Plan erstellen', '+ Create new plan')}</button>
    <button class="btn btn-soft btn-block" onClick=${() => oeffne({ art: 'import' })}>${I.import} ${deEn('Plan importieren – per KI oder Datei', 'Import a plan – via AI or file')}</button>
    ${(() => {
      // Meine Pläne nach Kategorie (je zugeklappt), danach die Vorlagen (zugeklappt)
      const kat = (d) => programme[d]?.kategorie ?? 'powerlifting';
      // Candito-Vorlagen nur für freigeschaltete Konten (Update 22: Niko, liridonperzha) – dort unter Powerlifting bei den eigenen Plänen
      const mitVorlagen = DEMO || einst.vorlagen === true;
      const gruppen = [['powerlifting', 'Powerlifting'], ['bodybuilding', 'Bodybuilding'], ['eigen', 'Eigene Pläne']]
        .map(([k, titel]) => [k, titel, [...eigene.filter((d) => kat(d) === k), ...(k === 'powerlifting' && mitVorlagen ? vorlagen : [])]]).filter(([, , l]) => l.length);
      const klappe = (k, titel, l, zusatz = null) => html`<details key=${k} class="vorlagen-auf"><summary><span>${titel}</span><span class="muted">${zusatz ?? `${l.length} ${l.length === 1 ? 'Plan' : 'Pläne'}`}</span><span class="woche-pfeil" aria-hidden="true">${I.weiter}</span></summary>
        <div class="stack" style="gap:12px;margin-top:10px">${l.map(karte)}</div></details>`;
      return gruppen.length ? html`<h2 class="abschnitt-titel">Meine Pläne</h2>${gruppen.map(([k, titel, l]) => klappe(k, titel, l))}` : null;
    })()}`}
    ${beenden ? html`<${Sheet} zu=${() => setBeenden(false)} label="Block beenden">
      <h2 class="h2">Block beenden?</h2>
      <p style="margin:0">Erledigte Trainings bleiben im Verlauf. Der Plan verschwindet aus „Heute“, bis du einen neuen Block startest.</p>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setBeenden(false)}>Abbrechen</button>
        <button class="btn btn-gefahr" style="flex:1" onClick=${() => { setBlock(null); setBeenden(false); toast({ titel: 'Block beendet', text: 'Starte eine Vorlage, wenn es weitergeht.' }); }}>Beenden</button></div>
    <//>` : null}
  </div>`;
}

/** 186: Plan an einen Freund schicken (Update 27) – er übernimmt ihn unter Programme mit einem Tipp. */
function PlanSenden({ name, prog, zu, toast }) {
  const [freunde, setFreunde] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [laeuft, setLaeuft] = useState(null);
  useEffect(() => { DIENSTE.ladeFreunde?.().then((f) => setFreunde((f ?? []).filter((x) => x.status === 'angenommen'))).catch((e) => setFehler(e.message)); }, []);
  const senden = async (f) => {
    setLaeuft(f.id); setFehler(null);
    try { await DIENSTE.planSenden(f.id, name, prog); zu(); toast({ titel: 'Plan geschickt', text: `${name} → ${f.name}` }); }
    catch (e) { setFehler(e.message); setLaeuft(null); }
  };
  return html`<${Sheet} zu=${zu} label="An Freund schicken">
    <h2 class="h2">An Freund schicken</h2>
    <p class="muted" style="margin:0;font-size:13.5px">${`„${name}“ landet bei deinem Freund unter Programme. Er übernimmt ihn mit einem Tipp und rechnet mit seinen eigenen Maxen.`}</p>
    ${freunde == null && !fehler ? html`<p class="muted">Lade …</p>` : null}
    ${freunde?.length === 0 ? html`<p class="muted" style="margin:0">Noch keine Freunde – unter Feed → Freunde hinzufügen.</p>` : null}
    ${(freunde ?? []).map((f) => html`<button key=${f.id} class="btn btn-soft btn-block" disabled=${!!laeuft} onClick=${() => senden(f)}>${laeuft === f.id ? 'Schickt …' : f.name}</button>`)}
    ${fehler ? html`<p class="fehler" style="margin:0">${fehler}</p>` : null}
  <//>`;
}

/** 186: an mich geschickte Pläne – übernehmen (als eigenes Programm) oder ablehnen. */
function GeteiltePlaene({ speichernNeu, toast }) {
  const [liste, setListe] = useState([]);
  const laden = () => DIENSTE.geteiltePlaene?.().then((l) => setListe(l ?? [])).catch(() => {});
  useEffect(() => { laden(); }, []);
  if (!liste.length) return null;
  const weg = async (g) => { try { await DIENSTE.geteiltenEntfernen(g.id); } catch (e) { toast({ titel: 'Nicht entfernt', text: e.message }); } laden(); };
  return html`<section class="card pad stack geteilt">
    <span class="viz-t">Von Freunden geschickt</span>
    ${liste.map((g) => html`<div key=${g.id} class="geteilt-zeile"><div style="min-width:0;flex:1"><b>${g.name}</b><div class="muted" style="font-size:12.5px">${`von ${g.von} · ${datumKurz(g.datum)}`}</div></div>
      <button class="btn btn-chalk btn-sm" onClick=${async () => { await speichernNeu({ ...g.definition, name: g.name }, { quelle: 'import' }); await weg(g); }}>Übernehmen</button>
      <button class="iconbtn klein" aria-label="Ablehnen" onClick=${() => weg(g)}>${I.zu}</button></div>`)}
  </section>`;
}

function Detail({ datei, prog, vorgabe, ausTest, startVorschlag, block, einst, setEinst, toast, zurueck, starten, bearbeiten, kopieBearbeiten, zumGenerator, neueVersion = null, umstellen }) {
  const aktiv = block?.datei === datei;
  const eigen = datei.startsWith('prog:') || datei.startsWith('import:');
  const [start, setStart] = useState(aktiv && !vorgabe ? block.start : startVorschlag ?? HEUTE);
  const [werte, setWerte] = useState(() => {
    const s = startMaxe();
    return Object.fromEntries(prog.inputs.map((k) => [k, vorgabe?.[k] ?? (aktiv ? block.werte[k] : null) ?? s[k] ?? null]));
  });
  const [alternativ, setAlternativ] = useState(aktiv ? block.alternativ : false);
  const [sheet, setSheet] = useState(null);                 // 'ersetzen' | 'umbenennen' | 'archivieren'
  const [name, setName] = useState(INFO[datei].kurz);
  const cut = einst.cut;
  const neuStarten = !aktiv || !!vorgabe;
  const alt = prog.weeks.find((w) => w.alternative_to);
  const vollstaendig = prog.inputs.every((k) => werte[k] > 0) && start;
  let tage = [], planFehler = null;
  try { tage = vollstaendig ? blockTage(prog, { start, werte, cut, alternativ }) : []; } catch (e) { planFehler = e.message; }
  const titel = Object.fromEntries(prog.weeks.map((w) => [w.week, kurzTitel(w.title)]));
  const regel = prog.rules?.projection;
  const pana = pruefePana(prog);
  const los = () => starten({ datei, start, werte, alternativ, neu: neuStarten });
  const json = () => JSON.stringify({ ...prog, name: INFO[datei].kurz }, null, 2);
  const teilen = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: `PR Hunter: ${INFO[datei].kurz}`, text: json() }); return; }
    } catch { /* abgebrochen oder nicht erlaubt: kopieren */ }
    toast((await kopiere(json())) ? { titel: 'Kopiert', text: 'Programm als JSON in der Zwischenablage.' } : { titel: 'Kopieren gesperrt', text: 'Bitte „Als JSON kopieren“ nutzen.' });
  };
  return html`<div class="screen">
    <header class="topbar unter">
      <button class="iconbtn" onClick=${zurueck} aria-label="Zurück zu den Programmen">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">${aktiv && !vorgabe ? 'Aktiver Block' : eigen ? 'Eigenes Programm' : 'Vorlage'}</div><h1 class="h1" style="font-size:26px">${INFO[datei].kurz}</h1></div>
    </header>
    <p class="muted" style="margin:0">${INFO[datei].text}</p>
    ${neueVersion != null && !vorgabe ? html`<section class="card pad stack">
      <span class="viz-t">Neue Version der Vorlage</span>
      <p style="margin:0;font-size:14px">${`Dein Block läuft mit Version ${block.version}, aktuell ist Version ${neueVersion}. Umstellen ändert die Gewichte ab der nächsten Einheit; erledigte Trainings bleiben unverändert.`}</p>
      <button class="btn btn-soft btn-sm" onClick=${() => umstellen(neueVersion)}>${`Auf Version ${neueVersion} umstellen`}</button>
    </section>` : null}
    ${ausTest ? html`<section class="hint">${I.warn}<span class="t">Neue Maxe übernommen</span><span></span><p>Aus dem Test des letzten Blocks vorgeschlagen. Vor dem Start prüfen; der aktive Block wird dabei beendet.</p></section>` : null}
    <section class="card pad stack">
      <div class="eyebrow">Einrichten</div>
      <label class="field" for="p-start"><span class="label">Startdatum</span><input id="p-start" type="date" value=${start} onInput=${(e) => setStart(e.currentTarget.value)}/></label>
      <div class=${prog.inputs.length === 3 ? 'fields drei' : 'fields'}>${prog.inputs.map((k) => html`<${ZahlFeld} key=${k} id=${`p-${k}`} label=${`${MAX_NAME[k] ?? k} (${einheit()})`} kg=${true}
        wert=${werte[k]} setze=${(v) => setWerte((w) => ({ ...w, [k]: v }))}/>`)}</div>
      <label class="schalter" for="p-cut"><span><b>Cut-Modus</b> <span class="muted" style="font-size:12px">(gilt für alle Programme)</span><br/>
        <span class="muted" style="font-size:13px">Ein Satz weniger bei Back-offs, Varianten und Zubehör. Top-Sätze, Tests und Wettkampf-Hauptsätze bleiben.</span></span>
        <input type="checkbox" id="p-cut" checked=${cut} onChange=${(e) => setEinst({ ...einst, cut: e.currentTarget.checked })}/></label>
      ${alt ? html`<div class="stack" style="gap:8px"><span class="eyebrow">Woche ${alt.alternative_to}</span>
        <div class="seg" role="group" aria-label="Variante Woche 6"><button aria-pressed=${String(!alternativ)} onClick=${() => setAlternativ(false)}>Deload</button>
          <button aria-pressed=${String(alternativ)} onClick=${() => setAlternativ(true)}>Taper + Testtag</button></div></div>` : null}
      ${prog.params ? html`<span class="muted" style="font-size:13px">${`Trainingsmax ${fmt(prog.params.TM_BULK * 100)} % (Cut ${fmt(prog.params.TM_CUT * 100)} %), zuerst gerundet`}
        · ${`Pause-Kniebeuge × ${fmt(prog.params.VF)}`} · ${`Test ${fmt(prog.params.TEST * 100, 1)} % vom echten 1RM`} · <span>ändern unter „Bearbeiten“ bzw. „Kopie bearbeiten“</span></span>` : null}
      ${regel?.source || regel?.formula ? html`<details><summary class="link" style="cursor:pointer">Wie das neue Max nach dem Test berechnet wird</summary>
        <p class="muted" style="margin:6px 0 0;font-size:13px">${regel.method === 'rpe10_table'
          ? 'Projiziert = Testgewicht ÷ %1RM aus der RPE-10-Tabelle (96/92/89/86/84/81 % für 2–7 Wdh), auf die Steigerung gerundet. Unter 2 Wdh bleibt das alte Max; sonst altes Max + (projiziert − alt) × Vertrauen (1,0 bei sauberen, 0,5 bei unsauberen Wdh). Keine Obergrenze.'
          : `${regel.source}${regel.note ? ` ${regel.note}` : ''}`}</p>
        ${prog.rules?.projection_bench ? html`<p class="muted" style="margin:6px 0 0;font-size:13px">Bankdrücken (aus dem AMRAP in Woche ${prog.rules.projection_bench.week}): ${prog.rules.projection_bench.source}</p>` : null}</details>` : null}
    </section>
    ${pana.fehler.length ? html`<section class="hint">${I.warn}<span class="t">${pana.fehler.length} ${pana.fehler.length === 1 ? 'Wert' : 'Werte'} außerhalb der Pana-Grenzen</span><span></span>
      <ul style="margin:0;padding-left:18px;font-size:13.5px">${pana.fehler.slice(0, 8).map((f) => html`<li key=${f}>${f}</li>`)}</ul></section>` : null}
    <section class="card pad">
      <div class="row between" style="margin-bottom:4px"><span class="eyebrow">Wochenplan</span><span class="muted" style="font-size:13px">${tage.length} Einheiten</span></div>
      ${planFehler ? html`<p class="fehler">${planFehler}</p>` : vollstaendig ? wochenListe(tage).map((w, i) => {
        const wt = tage.filter((t) => t.woche === w);
        // Wochen eingeklappt; der Pfeil zeigt, dass sich die Tage aufklappen lassen
        return html`<details key=${w} class="woche">
          <summary><span><b>Woche ${i + 1}</b> <span class="muted">· ${titel[w]}</span></span><span class="woche-rechts"><span class="muted" style="font-size:13px">${datumKurz(wt[0].datum)} – ${datumKurz(wt.at(-1).datum)}</span><span class="woche-pfeil" aria-hidden="true">${I.weiter}</span></span></summary>
          ${wt.map((t) => html`<${TagPlan} key=${t.datum + t.offset} tag=${t}/>`)}
        </details>`;
      }) : html`<p class="muted" style="margin:0">Startdatum und alle Maxe eintragen, dann erscheinen die Gewichte.</p>`}
    </section>
    <button class="btn btn-chalk btn-block" disabled=${!vollstaendig || !!planFehler} onClick=${() => (block && neuStarten ? setSheet('ersetzen') : los())}>${neuStarten ? 'Block starten' : 'Änderungen übernehmen'}</button>
    <section class="card pad stack">
      <span class="viz-t">Programm</span>
      <div class="row wrap" style="gap:8px">
        ${eigen ? html`<button class="btn btn-soft btn-sm" onClick=${() => bearbeiten(datei)}>Bearbeiten</button>
          <button class="btn btn-soft btn-sm" onClick=${() => setSheet('umbenennen')}>Umbenennen</button>`
          : html`<button class="btn btn-soft btn-sm" onClick=${() => kopieBearbeiten({ ...prog, name: `${INFO[datei].kurz} (eigene Fassung)` })}>Kopie bearbeiten</button>`}
        <button class="btn btn-soft btn-sm" onClick=${async () => toast((await kopiere(json())) ? { titel: 'Kopiert', text: 'Programm als JSON in der Zwischenablage – z. B. für Claude.' } : { titel: 'Kopieren gesperrt', text: 'Der Browser erlaubt es hier nicht.' })}>Als JSON kopieren</button>
        <button class="btn btn-soft btn-sm" onClick=${teilen}>Teilen</button>
        <button class="btn btn-soft btn-sm" onClick=${() => {   // 217: schön gesetztes PDF über den Druckdialog
          let tage;
          try { tage = blockTage(prog, { start, werte, cut, alternativ }); }
          catch { toast({ titel: 'Erst Maxe eintragen', text: 'Für das PDF rechnet die App die Gewichte aus deinen Maxen.' }); return; }
          planDrucken({ titel: INFO[datei].kurz, untertitel: `${prog.weeks.length} ${deEn('Wochen', 'weeks')} · Start ${datumKurz(start)}${aktiv ? deEn(' · aktiver Block', ' · active block') : ''}`, tage, quelle: prog.source ?? '' });
        }}>Als PDF</button>
        ${DIENSTE.planSenden ? html`<button class="btn btn-soft btn-sm" onClick=${() => setSheet('freund')}>An Freund schicken</button>` : null}
        ${prog.rules?.generator ? html`<button class="btn btn-soft btn-sm" onClick=${() => zumGenerator(prog.rules.generator)}>Im Generator ändern</button>` : null}
        ${eigen && !aktiv ? html`<button class="btn btn-gefahr btn-sm" onClick=${() => setSheet('archivieren')}>Archivieren</button>` : null}
      </div>
      <span class="muted" style="font-size:12.5px">Teilen schickt das Programm als JSON (z. B. an den Kumpel); er importiert es und rechnet mit seinen eigenen Maxen.</span>
    </section>
    ${sheet === 'ersetzen' ? html`<${Sheet} zu=${() => setSheet(null)} label="Block ersetzen">
      <h2 class="h2">Aktiven Block ersetzen?</h2>
      <p style="margin:0">${INFO[block.datei].kurz} wird beendet. Erledigte Trainings bleiben im Verlauf.</p>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setSheet(null)}>Abbrechen</button><button class="btn btn-chalk" style="flex:1" onClick=${los}>Ersetzen</button></div>
    <//>` : null}
    ${sheet === 'umbenennen' ? html`<${Sheet} zu=${() => setSheet(null)} label="Umbenennen">
      <h2 class="h2">Umbenennen</h2>
      <label class="field" for="p-name"><span class="label">Name</span><input id="p-name" class="text" type="text" value=${name} onInput=${(e) => setName(e.currentTarget.value)}/></label>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setSheet(null)}>Abbrechen</button>
        <button class="btn btn-chalk" style="flex:1" disabled=${!name.trim()} onClick=${async () => { try { await DIENSTE.programmUmbenennen?.(datei, name.trim()); setSheet(null); toast({ titel: 'Umbenannt', text: name.trim() }); } catch (e) { toast({ titel: 'Nicht umbenannt', text: e.message }); } }}>Speichern</button></div>
    <//>` : null}
    ${sheet === 'freund' ? html`<${PlanSenden} name=${INFO[datei].kurz} prog=${prog} zu=${() => setSheet(null)} toast=${toast}/>` : null}
    ${sheet === 'archivieren' ? html`<${Sheet} zu=${() => setSheet(null)} label="Archivieren">
      <h2 class="h2">Programm archivieren?</h2>
      <p style="margin:0">Es verschwindet aus der Liste. Alte Blöcke und Trainings bleiben unverändert.</p>
      <div class="row"><button class="btn btn-soft" style="flex:1" onClick=${() => setSheet(null)}>Abbrechen</button>
        <button class="btn btn-gefahr" style="flex:1" onClick=${async () => { try { await DIENSTE.programmArchivieren?.(datei); zurueck(); toast({ titel: 'Archiviert', text: INFO[datei].kurz }); } catch (e) { toast({ titel: 'Nicht archiviert', text: e.message }); } }}>Archivieren</button></div>
    <//>` : null}
  </div>`;
}

const BEISPIEL_CSV = KI_ANLEITUNG.split('Beispiel:\n')[1].split('\n\nHier ist')[0];

/** Unbekannte Übungen aus dem Import Schritt für Schritt zuordnen – jeder Name nur einmal, gilt für alle Zeilen damit. */
export function UebungenZuordnen({ liste, fertig, abbrechen, platz = true }) {
  const [i, setI] = useState(0);
  const [wahl, setWahl] = useState({});
  const [suchen, setSuchen] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); setSuchen(false); }, [i]);
  const u = liste[i], n = liste.length;
  const waehle = (key) => {
    const neu = { ...wahl, [u.schluessel]: key };
    setWahl(neu);
    if (i + 1 < n) setI(i + 1); else fertig(neu);
  };
  return html`<div class="screen">
    <header class="topbar unter">
      <button class="iconbtn" onClick=${() => (i ? setI(i - 1) : abbrechen())} aria-label="Zurück">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">Import</div><h1 class="h1" style="font-size:26px">Übungen zuordnen</h1></div>
    </header>
    <section class="card pad stack zuordnen">
      <div class="row between"><span class="eyebrow">${`Übung ${i + 1} von ${n}`}</span><span class="muted" style="font-size:12.5px">${`noch ${n - i}`}</span></div>
      <div class="ab-fortschritt" role="progressbar" aria-valuemin="0" aria-valuemax=${n} aria-valuenow=${i}><i style=${`width:${Math.round((i / n) * 100)}%`}></i></div>
      <span class="muted" style="font-size:13px">Aus deiner Datei:</span>
      <b class="zuordnen-name" translate="no">${`„${u.name}“`}</b>
      <span class="muted" style="font-size:13px">${u.anzahl > 1 ? `Kommt ${u.anzahl}× vor – deine Wahl gilt für alle und wird für spätere Importe gemerkt.` : 'Deine Wahl wird für spätere Importe gemerkt.'}</span>
      ${u.vorschlaege.length ? html`<span class="eyebrow" style="margin-top:6px">Vorschläge</span>
        <div class="zuordnen-liste">${u.vorschlaege.map((k) => html`<button key=${k} class=${`zuordnen-treffer ${wahl[u.schluessel] === k ? 'gewaehlt' : ''}`} onClick=${() => waehle(k)}>
          <${UebungsBild} schluessel=${k} groesse=${44} zoom=${false}/><span>${nameVon(k)}</span>${I.weiter ?? '›'}</button>`)}</div>` : null}
      ${suchen ? html`<${UebungSuche} id="zuordnen-suche" autofokus=${true} onWahl=${waehle}/>`
        : html`<button class="btn btn-soft btn-block" onClick=${() => setSuchen(true)}>${I.suche} Andere Übung suchen</button>`}
      ${DIENSTE.neueUebungStarten ? html`<button class="link" style="justify-self:start" onClick=${() => DIENSTE.neueUebungStarten(u.name, waehle)}>${`„${u.name}“ als eigene Übung anlegen`}</button>` : null}
      ${platz ? html`<button class="link" style="justify-self:start" onClick=${() => waehle('platz')}>Als frei wählbaren Platz übernehmen (Übung erst im Training wählen)</button>` : null}
    </section>
  </div>`;
}

/** Programm importieren: per KI als CSV (Anleitung kopieren, Antwort einfügen) oder direkt als JSON im App-Format. */
const mitSport = (alt, neu) => (!alt ? neu : alt === 'beides' || alt === neu ? alt : 'beides');

function Import({ zurueck, speichern, cardioNur, ausdauerAlt = null }) {
  const [art, setArt] = useState('csv');
  const [text, setText] = useState('');
  const [ergebnis, setErgebnis] = useState(null);
  const [kopiert, setKopiert] = useState(null);
  // 250: was der Plan enthält – Kraft (Kategorie) und/oder Cardio
  const [kraft, setKraft] = useState('powerlifting');
  const [cardio, setCardio] = useState(false);
  const [start, setStart] = useState(() => naechsterMontag(HEUTE));
  const anleitung = useRef(null);
  const KI = kiAnleitung({ kraft: !!kraft, cardio });
  const pruefe = (zu = ladeZuordnung()) => setErgebnis(art === 'csv' ? leseImport(text, katalogListe(), zu, { kraft, cardio })
    : (() => { const j = pruefeProgrammJson(text, katalogListe(), zu); return { ...j, programm: j.programm ? { ...j.programm, kategorie: j.programm.kategorie ?? kraft ?? 'eigen' } : null, zeilen: null }; })());
  const zuordnen = ergebnis?.unbekannt?.length ? ergebnis.unbekannt : null;
  if (zuordnen) {
    return html`<${UebungenZuordnen} liste=${zuordnen} abbrechen=${() => setErgebnis(null)}
      fertig=${(wahl) => { const zu = { ...ladeZuordnung(), ...wahl }; merkeZuordnung(zu); pruefe(zu); }}/>`;
  }
  const p = ergebnis?.programm;
  let tage = [];
  try { tage = p ? blockTage(p, { start: HEUTE, werte: { ...BEISPIEL_MAXE } }) : []; } catch { tage = []; }
  const cPlan = ergebnis?.cardio ? cardioPlanAus(ergebnis.cardio, start) : null;
  const ausstehend = cPlan ? { ausdauer: mitSport(ausdauerAlt, cPlan.sportarten.length > 1 ? 'beides' : cPlan.sportarten[0]), plan: cPlan, start } : null;
  const inhaltWahl = (k, c) => { setKraft(k); setCardio(c || !k); setErgebnis(null); };
  return html`<div class="screen modern">
    <header class="topbar unter">
      <button class="iconbtn" onClick=${zurueck} aria-label="Zurück zu den Programmen">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">Neues Programm</div><h1 class="h1" style="font-size:26px">Importieren</h1></div>
    </header>
    <div class="seg" role="group" aria-label="Format"><button aria-pressed=${String(art === 'csv')} onClick=${() => { setArt('csv'); setErgebnis(null); }}>Per KI (CSV)</button>
      <button aria-pressed=${String(art === 'json')} onClick=${() => { setArt('json'); setErgebnis(null); if (!kraft) setKraft('powerlifting'); setCardio(false); }}>JSON</button></div>
    <section class="card pad stack">
      <span class="viz-t">${deEn('Was importierst du?', 'What are you importing?')}</span>
      <div class="pl-optionen">
        ${[['powerlifting', '🏆', 'Powerlifting', deEn('Kniebeuge, Bank, Kreuzheben mit Prozenten', 'Squat, bench, deadlift with percentages')],
          ['bodybuilding', '🏋️', 'Bodybuilding', deEn('Muskelaufbau mit Split', 'Hypertrophy with a split')],
          ['eigen', '💪', deEn('Anderer Kraftplan', 'Other strength plan'), deEn('z. B. Ganzkörper oder Einsteigerplan', 'e.g. full body or beginner plan')],
          ...(art === 'csv' ? [[null, '🏃', deEn('Nur Cardio', 'Cardio only'), deEn('Lauf- oder Radplan ohne Krafttraining', 'Running or cycling plan without strength')]] : [])]
          .map(([k, icon, titel, text]) => html`<button key=${String(k)} class=${`pl-opt ${kraft === k ? 'an' : ''}`} aria-pressed=${String(kraft === k)} onClick=${() => inhaltWahl(k, k ? cardio : true)}>
            <span class="pl-ico" aria-hidden="true">${icon}</span><span class="pl-txt"><b>${titel}</b><small>${text}</small></span><span class="pl-radio" aria-hidden="true"></span></button>`)}
      </div>
      ${art === 'csv' && kraft ? html`<label class="schalter" for="imp-cardio"><span><b>${deEn('Mit Laufen oder Radfahren', 'With running or cycling')}</b><br/>
        <span class="muted" style="font-size:12.5px">${deEn('Der Plan enthält auch Cardio-Einheiten – die kommen in deinen Cardio-Plan.', 'The plan also has cardio sessions – they go into your cardio plan.')}</span></span>
        <input type="checkbox" id="imp-cardio" checked=${cardio} onChange=${(e) => inhaltWahl(kraft, e.currentTarget.checked)}/></label>` : null}
    </section>
    ${art === 'csv' ? html`<section class="card pad stack">
      <span class="viz-t">1 · Anleitung für die KI kopieren</span>
      <p class="muted" style="margin:0;font-size:14px">${deEn('In ChatGPT, Claude oder eine andere KI einfügen und darunter deinen Plan anhängen: Text, Tabelle oder Foto der Excel. Die KI antwortet mit einer CSV im passenden Format.', 'Paste into ChatGPT, Claude or another AI and attach your plan below: text, table or a photo of the spreadsheet. The AI answers with a CSV in the right format.')}</p>
      <button class="btn btn-chalk btn-block" onClick=${async () => setKopiert(await kopiere(KI, anleitung.current))}>${I.kopieren} Anleitung kopieren</button>
      ${kopiert === true ? html`<span class="muted" style="font-size:13px">Kopiert. Jetzt in der KI einfügen.</span>`
        : kopiert === false ? html`<span class="muted" style="font-size:13px">Kopieren ist hier gesperrt: Der Text unten ist markiert, mit Strg+C bzw. „Kopieren“ übernehmen.</span>` : null}
      <span class="eyebrow">Die Anleitung</span>
      <textarea ref=${anleitung} id="ki-anleitung" class="code" readonly rows="6" aria-label="Anleitung für die KI" value=${KI}></textarea>
    </section>` : html`<section class="card pad stack">
      <span class="viz-t">Programm im App-Format</span>
      <p class="muted" style="margin:0;font-size:14px">Das Format von „Als JSON kopieren“ – geteilt vom Kumpel oder von Claude geschrieben bzw. geändert. Übungen über ihren Schlüssel aus dem Katalog, Lasten als Formeln wie R(S*0.84).</p>
    </section>`}
    <section class="card pad stack">
      <span class="viz-t">${art === 'csv' ? '2 · Antwort der KI einfügen' : 'JSON einfügen'}</span>
      <label for="import-feld" class="muted" style="font-size:13px">${art === 'csv' ? 'Die CSV aus der Antwort (mit oder ohne Codeblock).' : 'Das JSON (mit oder ohne Codeblock).'}</label>
      <textarea id="import-feld" class="code" rows="9" placeholder=${art === 'csv' ? (kraft ? 'woche;tag;uebung;rolle;saetze;wdh;last;rpe;cut;notiz' : 'woche;tag;sport;typ;umfang;ziel;wdh;pause;notiz') : '{ "name": "…", "weeks": [ … ] }'} value=${text}
        onInput=${(e) => { setText(e.currentTarget.value); setErgebnis(null); }}></textarea>
      <div class="row">${art === 'csv' ? html`<button class="btn btn-soft" style="flex:1" onClick=${() => { setText(kraft && cardio ? `${BEISPIEL_CSV.trimEnd()}\n\n${CARDIO_BEISPIEL}` : kraft ? BEISPIEL_CSV : CARDIO_BEISPIEL); setErgebnis(null); }}>Beispiel einsetzen</button>` : null}
        <button class="btn btn-chalk" style="flex:1" disabled=${!text.trim()} onClick=${() => pruefe()}>Prüfen</button></div>
    </section>
    ${ergebnis?.fehler.length ? html`<section class="hint">${I.warn}<span class="t">${ergebnis.fehler.length} ${ergebnis.fehler.length === 1 ? 'Problem' : 'Probleme'} – nichts importiert</span><span></span>
      <ul style="margin:0;padding-left:18px">${ergebnis.fehler.slice(0, 12).map((f) => html`<li key=${f}>${f}</li>`)}</ul></section>` : null}
    ${p ? html`<section class="card pad stack">
      <span class="viz-t">Vorschau</span>
      <h2 class="h2">${p.name}</h2>
      <div class="prog-meta"><div><b>${wochenListe(tage).length}</b><span>Wochen</span></div><div><b>${tage.length}</b><span>Einheiten</span></div>
        <div><b>${ergebnis.zeilen ?? p.weeks.length}</b><span>${ergebnis.zeilen ? 'Zeilen' : 'Wochen im JSON'}</span></div><div><b>${p.inputs.join(' ') || '–'}</b><span>Maxe</span></div></div>
      <span class="muted" style="font-size:13px">Gewichte mit Beispiel-Maxen gerechnet; beim Starten trägst du deine ein.</span>
      ${tage.filter((t) => t.woche === tage[0]?.woche).map((t) => html`<${TagPlan} key=${t.datum + t.offset} tag=${t}/>`)}
      ${cPlan ? null : html`<button class="btn btn-chalk btn-block" onClick=${() => speichern(p, null)}>Als eigenes Programm speichern</button>`}
    </section>` : null}
    ${cPlan ? html`<section class="card pad stack">
      <span class="viz-t">${deEn('Cardio', 'Cardio')}</span>
      <h2 class="h2">${cPlan.name}</h2>
      <div class="prog-meta"><div><b>${cPlan.wochen}</b><span>${deEn('Wochen', 'Weeks')}</span></div><div><b>${cPlan.einheiten.length}</b><span>${deEn('Einheiten', 'Sessions')}</span></div>
        <div><b>${cPlan.sportarten.map((s) => (s === 'lauf' ? '🏃' : '🚴')).join(' ')}</b><span>Sport</span></div></div>
      <label class="field" for="import-start"><span class="label">${deEn('Start (Montag der ersten Woche)', 'Start (Monday of week 1)')}</span>
        <input id="import-start" class="text" type="date" value=${start} onInput=${(e) => { const v = e.currentTarget.value; if (v) setStart(v); }}/></label>
      ${wtVon(start) !== 0 ? html`<span class="warn-text" style="font-size:12.5px">${deEn('Kein Montag – die Wochentage verschieben sich entsprechend.', 'Not a Monday – the weekdays shift accordingly.')}</span>` : null}
      <div class="pl-plan">${cPlan.einheiten.filter((e) => e.woche === 1).map((e) => { const b = beschreibung(e, cPlan);
        return html`<div key=${e.id} class="pl-planzeile"><span class="pl-tagpill">${deEn(...WT_NAME[wtVon(e.datum)])}</span><div class="pl-items"><span class="pl-item cardio">${e.sport === 'lauf' ? '🏃' : '🚴'} ${b.titel} <small>${b.zeile}</small></span></div></div>`; })}</div>
      ${p ? html`<button class="btn btn-chalk btn-block" onClick=${() => speichern(p, ausstehend)}>${deEn('Speichern – Cardio startet mit', 'Save – cardio starts with it')}</button>
          <span class="muted" style="font-size:12.5px">${deEn('Den Kraftblock startest du danach mit deinen Maxen; der Cardio-Plan beginnt am gewählten Montag.', 'Start the strength block next with your maxes; the cardio plan begins on the chosen Monday.')}</span>`
        : html`<button class="btn btn-chalk btn-block" onClick=${() => cardioNur(ausstehend)}>${deEn('Cardio-Plan starten', 'Start cardio plan')}</button>`}
    </section>` : null}
  </div>`;
}
