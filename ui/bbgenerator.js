// PR Hunter · Bodybuilding-Generator (Wunsch 98): Schritt für Schritt – 1. Split, 2. je Muskelgruppe zwei Übungen,
// 3. Tage pro Woche und Blocklänge, 4. Vorschau der ersten Woche → als eigenes Programm speichern. Logik in js/bodybuilding.js.
import { html, useState, useEffect, I, nameVon, UebungsBild, uebung, useSitzung, deEn } from './basis.js';
import { UebungSuche, ISO_FAMILIEN } from './suche.js';
import { MiniFigur } from './koerper.js';
import { kraftVorschlaege } from '../js/ausdauerplan.js';
import { sportarten } from '../js/ausdauer.js';

// 145: Muskelgruppe → Zone im Körperdiagramm der großen Übungsauswahl
const ZONE_VON = { brust: 'brust', ruecken: 'latissimus', schulter: 'schulter_vorn', hintere_schulter: 'schulter_hinten', bizeps: 'bizeps', trizeps: 'trizeps',
  quads: 'quadrizeps', beinbeuger: 'beinbeuger', gesaess: 'gesaess', waden: 'waden', bauch: 'bauch' };
const artAus = (key) => { const e = uebung(key); if (!e) return ''; return `${ISO_FAMILIEN.has(e.f) ? '' : 'g'}${['machine', 'cable'].includes(e.eq) ? 'm' : ''}`; };
import { SPLITS, MUSKELGRUPPEN, standardAuswahl, haeufigkeit, generiereBodybuilding, saetzeVon, SAETZE_SPANNE } from '../js/bodybuilding.js';

const TAGE_STANDARD = { ppl: 6, ul: 4, gk: 3, bro: 5 };

// Schritt 2 Seite für Seite: je Körperteil eine Seite, Schultern und Rücken in Teilbereiche gegliedert. Ein Teilbereich
// gehört zu einer Generator-Gruppe; die Auswahl einer Gruppe wird abwechselnd nach Teilbereich geordnet (Latzug, Rudern,
// Latzug …), damit jedes Training aus jedem Bereich etwas bekommt.
const SEITEN = [
  { id: 'brust', name: 'Brust', text: 'Eine Druckübung plus eine Isolation (Flys, Crossover) ist eine bewährte Kombination.',
    bild: [['brust'], 'vorne', '30 60 140 160'], teile: [{ gruppe: 'brust', zone: 'brust' }] },
  { id: 'ruecken', name: 'Rücken', text: 'Je eine Übung für die Breite und fürs Rudern – so kommt beides in jedes Training.',
    bild: [['latissimus', 'oberer_ruecken', 'trapez'], 'hinten', '22 62 156 178'], teile: [
      { gruppe: 'ruecken', teil: 'breite', name: 'Breite · Latzug & Klimmzug', zone: 'latissimus', keys: ['wide-grip_lat_pulldown', 'pullups'] },
      { gruppe: 'ruecken', teil: 'dicke', name: 'Dicke · Rudern', zone: 'oberer_ruecken', keys: ['seated_cable_rows', 'bent_over_barbell_row', 'one-arm_dumbbell_row', 't-bar_row_with_handle'] }] },
  { id: 'schultern', name: 'Schultern', text: 'Drücken für die vordere, Seitheben für die seitliche Schulter – die hintere bekommt eigene Sätze.',
    bild: [['schulter_vorn', 'schulter_seite'], 'vorne', '30 60 140 160'], teile: [
      { gruppe: 'schulter', teil: 'vorn', name: 'Vordere Schulter · Drücken', zone: 'schulter_vorn', keys: ['seated_dumbbell_press', 'machine_shoulder_military_press'] },
      { gruppe: 'schulter', teil: 'seite', name: 'Seitliche Schulter · Seitheben', zone: 'schulter_seite', keys: ['side_lateral_raise', 'cable_lateral_raise', 'machine_lateral_raise'] },
      { gruppe: 'hintere_schulter', name: 'Hintere Schulter', zone: 'schulter_hinten' }] },
  { id: 'bizeps', name: 'Bizeps', text: 'Zwei verschiedene Curls – z. B. Langhantel und Hammer – treffen den Bizeps vollständiger.',
    bild: [['bizeps'], 'vorne', '30 80 140 160'], teile: [{ gruppe: 'bizeps', zone: 'bizeps' }] },
  { id: 'trizeps', name: 'Trizeps', text: 'Pushdown plus eine Übung über Kopf dehnt den langen Kopf mit.',
    bild: [['trizeps'], 'hinten', '30 80 140 160'], teile: [{ gruppe: 'trizeps', zone: 'trizeps' }] },
  { id: 'quads', name: 'Quadrizeps', text: 'Eine schwere Kniebeuge-Variante plus Beinstrecker.',
    bild: [['quadrizeps'], 'vorne', '30 210 140 160'], teile: [{ gruppe: 'quads', zone: 'quadrizeps' }] },
  { id: 'beinbeuger', name: 'Beinbeuger', text: 'Hüftbeugung (Rumänisches Kreuzheben) plus Beincurl.',
    bild: [['beinbeuger'], 'hinten', '30 210 140 160'], teile: [{ gruppe: 'beinbeuger', zone: 'beinbeuger' }] },
  { id: 'gesaess', name: 'Gesäß', text: 'Hip Thrust oder Glute Bridge – das Gesäß arbeitet auch bei Kniebeuge und RDL mit.',
    bild: [['gesaess'], 'hinten', '30 170 140 160'], teile: [{ gruppe: 'gesaess', zone: 'gesaess' }] },
  { id: 'waden', name: 'Waden', text: 'Stehend (gestreckte Knie) und sitzend ergänzen sich.',
    bild: [['waden'], 'hinten', '30 270 140 160'], teile: [{ gruppe: 'waden', zone: 'waden' }] },
  { id: 'bauch', name: 'Bauch', text: 'Eine Übung mit Gewicht (Kabel, Maschine) lässt sich gut steigern.',
    bild: [['bauch'], 'vorne', '30 100 140 160'], teile: [{ gruppe: 'bauch', zone: 'bauch' }] },
];
const ALLE_TEILE = SEITEN.flatMap((s) => s.teile);
const teileVon = (g) => ALLE_TEILE.filter((t) => t.gruppe === g);
const vorschlag = (t) => t.keys ?? MUSKELGRUPPEN[t.gruppe].uebungen.map(([k]) => k);
/** Gehört eine gewählte Übung in diesen Teilbereich? Vorschlag des Bereichs, sonst wo sie gesucht wurde, sonst erster Bereich. */
const gehoert = (t, k, zu) => {
  const ts = teileVon(t.gruppe);
  if (ts.length < 2) return true;
  if (t.keys?.includes(k)) return true;
  if (ts.some((x) => x.keys?.includes(k))) return false;
  return zu[k] ? zu[k] === t.teil : ts.find((x) => x.teil) === t;
};
/** Auswahl einer Gruppe abwechselnd nach Teilbereich ordnen (Reihenfolge = Wechsel in den Trainings). */
const ordne = (g, liste, zu) => {
  const ts = teileVon(g);
  if (ts.length < 2) return liste;
  const je = ts.map((t) => liste.filter((k) => gehoert(t, k, zu)));
  const aus = [];
  for (let i = 0; i < Math.max(0, ...je.map((l) => l.length)); i++) for (const l of je) if (l[i]) aus.push(l[i]);
  return [...new Set([...aus, ...liste])];
};

export function BodybuildingGenerator({ zurueck, speichern, ausdauer = null }) {
  const sports = sportarten(ausdauer);   // 238: bei Hybrid Läufer-/Radfahrer-Übungen mit vorschlagen
  const [split, setSplit] = useSitzung('prh-gen-bb-split', 'ppl');
  const [tage, setTage] = useSitzung('prh-gen-bb-tage', 6);
  const [vorgabe] = useSitzung('prh-gen-bb-vorgabe', null);           // aus dem Planer: Tage pro Woche stehen fest
  const [wochen, setWochen] = useSitzung('prh-gen-bb-wochen', 4);
  const [deload, setDeload] = useSitzung('prh-gen-bb-deload', true);
  const [auswahlRoh, setAuswahl] = useSitzung('prh-gen-bb-auswahl', standardAuswahl);
  // fehlende Gruppen (ältere Sitzung) mit dem Vorschlag ergänzen; leere Liste bleibt leer (alle abgewählt, gleich neue wählen)
  const auswahl = { ...standardAuswahl(), ...Object.fromEntries(Object.entries(auswahlRoh ?? {}).filter(([, l]) => Array.isArray(l))) };
  const [name, setName] = useSitzung('prh-gen-bb-name', '');
  const [schritt, weiter, zurueckSchritt] = useSchritte('prh-gen-bb-schritt');
  const [seite, setSeite] = useSitzung('prh-gen-bb-seite', 0);           // Schritt 2: welche Muskelgruppe gerade dran ist
  const [teilVon, setTeilVon] = useSitzung('prh-gen-bb-teile', {});       // per Suche gewählte Übung → Teilbereich
  const [saetze, setSaetze] = useSitzung('prh-gen-bb-saetze', {});         // 145: harte Sätze je Woche je Gruppe (leer = Richtwert)
  const gruppen = [...new Set(SPLITS[split].tage.flatMap(([, g]) => g))];
  const h = haeufigkeit(split, tage);
  const arten = Object.fromEntries(Object.values(auswahl).flat().map((k) => [k, artAus(k)]));
  const p = generiereBodybuilding({ name: name.trim(), split, tage, wochen, deload, auswahl, arten, saetze });
  const stelle = (g, d) => setSaetze({ ...saetze, [g]: Math.min(SAETZE_SPANNE[1], Math.max(SAETZE_SPANNE[0], saetzeVon(g, { saetze }) + d)) });
  const woche1 = p.weeks[0];
  // Kachel antippen: gewählte abwählen (auch alle), sonst hinzufügen – mehr als zwei wechseln sich in den Trainings ab
  const tippe = (t, key, zu = teilVon) => {
    const a = auswahl[t.gruppe];
    setAuswahl({ ...auswahl, [t.gruppe]: ordne(t.gruppe, a.includes(key) ? a.filter((k) => k !== key) : [...a, key], zu) });
  };
  const suchWahl = (t, key) => {
    const zu = teileVon(t.gruppe).length > 1 ? { ...teilVon, [key]: t.teil } : teilVon;
    if (zu !== teilVon) setTeilVon(zu);
    if (!auswahl[t.gruppe].includes(key)) tippe(t, key, zu);
  };
  const ohneUebung = gruppen.filter((g) => !auswahl[g].length);
  // Seiten von Schritt 2 (nur Gruppen des Splits); eigener Verlaufseintrag je Seite – die Zurück-Taste geht eine Gruppe zurück
  const seiten = SEITEN.map((s) => ({ ...s, teile: s.teile.filter((t) => gruppen.includes(t.gruppe)) })).filter((s) => s.teile.length);
  const si = Math.max(0, Math.min(seite, seiten.length - 1)), akt = seiten[si];
  const seitenGruppen = [...new Set(akt.teile.map((t) => t.gruppe))], fehlt = seitenGruppen.filter((g) => !auswahl[g].length);
  useEffect(() => {
    const z = (e) => { if (e.state?.schritt === 2) setSeite(e.state.seite ?? 0); };
    addEventListener('popstate', z);
    return () => removeEventListener('popstate', z);
  }, []);
  useEffect(() => window.scrollTo(0, 0), [si]);
  const seiteWeiter = () => {
    if (si < seiten.length - 1) { history.pushState({ ...history.state, seite: si + 1 }, ''); setSeite(si + 1); } else weiter();
  };
  const seiteZurueck = () => (si === 0 ? zurueckSchritt() : history.state?.seite === si ? history.back() : setSeite(si - 1));
  const springe = (i) => (history.state?.seite === si ? history.go(i - si) : setSeite(i));
  const satzSumme = (g) => woche1.days.flatMap((d) => d.items).filter((x) => auswahl[g].includes(x.exercise_key)).reduce((a, x) => a + Number(x.groups[0].sets), 0);
  return html`<div class="screen">
    <header class="topbar unter"><button class="iconbtn" onClick=${zurueck} aria-label="Zurück">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">Fortgeschritten · Hypertrophie</div><h1 class="h1">Bodybuilding-Generator</h1></div></header>

    <${Schritte} schritt=${schritt} namen=${SCHRITTE}/>
    ${schritt === 1 ? html`<section class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">1</span><span class="viz-t">Split wählen</span></div>
      <div class="split-wahl">${Object.entries(SPLITS).map(([k, s]) => html`<button key=${k} class="split-karte" aria-pressed=${String(split === k)}
        onClick=${() => { setSplit(k); if (!vorgabe) setTage(TAGE_STANDARD[k]); }}><b>${s.name}</b><span>${s.text}</span></button>`)}</div></section>` : null}

    ${schritt === 2 ? html`<div class="bb-fortschritt" aria-label=${`Muskelgruppe ${si + 1} von ${seiten.length}`}>
        ${seiten.map((s, i) => html`<button key=${s.id} class=${i < si ? 'ok' : i === si ? 'jetzt' : ''} disabled=${i >= si} onClick=${() => springe(i)} aria-label=${s.name}><i></i></button>`)}</div>
      <section class="card pad stack bb-seite" key=${akt.id}>
        <div class="bb-seite-kopf"><${MiniFigur} zonen=${akt.bild[0]} seite=${akt.bild[1]} ausschnitt=${akt.bild[2]}/>
          <div><span class="eyebrow">${deEn(`Muskelgruppe ${si + 1} von ${seiten.length}`, `Muscle group ${si + 1} of ${seiten.length}`)}</span><h2 class="h2">${akt.name}</h2>
            <span class="muted" style="font-size:12.5px">${akt.text}</span></div></div>
        ${akt.teile.map((t) => { const a = auswahl[t.gruppe], hier = a.filter((k) => gehoert(t, k, teilVon));
          const fuer = Object.fromEntries(t.teil ? [] : kraftVorschlaege(t.gruppe, sports));
          return html`<div key=${t.teil ?? t.gruppe} class="muskel-wahl"><div class="row between"><b>${t.name ?? MUSKELGRUPPEN[t.gruppe].name}</b>
            <span class=${a.length ? 'muted' : 'warn-text'} style="font-size:12px">${deEn(`${hier.length} gewählt`, `${hier.length} selected`)}</span></div>
          <div class="ueb-kacheln">${[...new Set([...hier, ...Object.keys(fuer), ...vorschlag(t)])].map((k) => {   // gewählte immer vorne, dann 238 Hybrid
            const nr = a.indexOf(k);
            return html`<button key=${k} class=${`ueb-kachel ${nr >= 0 ? 'gewaehlt' : ''}`} aria-pressed=${String(nr >= 0)} onClick=${() => tippe(t, k)}>
              ${nr >= 0 ? html`<span class="ueb-nr">${nr + 1}</span>` : null}${fuer[k] ? html`<span class="ueb-fuer">${fuer[k].map((s) => (s === 'lauf' ? '🏃' : '🚴')).join('')}</span>` : null}<${UebungsBild} schluessel=${k} groesse=${64} zoom=${false}/><span>${nameVon(k, k)}</span></button>`; })}</div>
          ${Object.keys(fuer).length ? html`<span class="muted" style="font-size:12px">${sports.length > 1 ? deEn('🏃 🚴 = hilft beim Laufen bzw. Radfahren (einbeinig, Sehnen, Rumpf)', '🏃 🚴 = helps running or cycling (single-leg, tendons, core)') : sports[0] === 'lauf' ? deEn('🏃 = hilft beim Laufen (einbeinig, Sehnen, Rumpf)', '🏃 = helps running (single-leg, tendons, core)') : deEn('🚴 = hilft beim Radfahren (einbeinig, Gesäß, Rumpf)', '🚴 = helps cycling (single-leg, glutes, core)')}</span>` : null}
          <${UebungSuche} id=${`bb-${t.gruppe}-${t.teil ?? ''}`} titel=${`${t.name ?? MUSKELGRUPPEN[t.gruppe].name}: Übung wählen`} zone=${t.zone ?? ZONE_VON[t.gruppe]} platzhalter="Andere Übung aus dem Katalog …" onWahl=${(k) => suchWahl(t, k)}/></div>`; })}
        <div class="bb-seite-fuss">${seitenGruppen.map((g) => { const n = auswahl[g].length, s = saetzeVon(g, { saetze }), richtwert = MUSKELGRUPPEN[g].saetze;
          return html`<div key=${g} class="bb-gruppe-fuss">
            <span class=${n ? '' : 'warn-text'}>${seitenGruppen.length > 1 ? html`<b>${MUSKELGRUPPEN[g].name}</b> · ` : ''}${n === 0 ? deEn('noch keine Übung', 'no exercise yet') : n <= 2 ? deEn(`${n} je Training`, `${n} per workout`) : deEn(`${n} gewählt · je Training 2 im Wechsel`, `${n} selected · 2 per workout, rotating`)}</span>
            <div class="bb-saetze"><span>${deEn('Harte Sätze pro Woche', 'Hard sets per week')}${s !== richtwert ? html` <small class="muted">${deEn(`(Richtwert ${richtwert})`, `(guide ${richtwert})`)}</small>` : null}</span>
              <span class="row" style="gap:6px"><button class="iconbtn klein" aria-label="Weniger Sätze" disabled=${s <= SAETZE_SPANNE[0]} onClick=${() => stelle(g, -1)}>−</button>
                <b>${s}</b><button class="iconbtn klein" aria-label="Mehr Sätze" disabled=${s >= SAETZE_SPANNE[1]} onClick=${() => stelle(g, 1)}>+</button></span></div></div>`; })}
          <span class="muted" style="font-size:12px">${deEn('Mehr Sätze für Muskeln, die du betonen willst, weniger für die übrigen – 10–20 pro Woche sind für Muskelaufbau ein guter Bereich.', 'More sets for muscles you want to emphasise, fewer for the rest – 10–20 per week is a good range for growth.')}</span></div>
      </section>` : null}

    ${schritt === 3 ? html`<section class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">3</span><span class="viz-t">Wie oft und wie lange</span></div>
      <span class="eyebrow">Trainingstage pro Woche</span>
      ${vorgabe ? html`<div class="pl-info"><b>${deEn(`${tage} Tage pro Woche`, `${tage} days per week`)}</b><span class="muted">${deEn('Aus deinem Plan mit Cardio – ändern geht im Planer.', 'From your plan with cardio – change it in the planner.')}</span></div>`
        : html`<div class="seg" role="group" aria-label="Trainingstage pro Woche">${[2, 3, 4, 5, 6].map((n) => html`<button key=${n} aria-pressed=${String(tage === n)} onClick=${() => setTage(n)}>${`${n}×`}</button>`)}</div>`}
      <div class="haeufigkeit">${gruppen.map((g) => html`<span key=${g} class=${(h[g] ?? 0) >= 2 ? 'gut' : ''}>${MUSKELGRUPPEN[g].name} <b>${`${h[g] ?? 0}×`}</b></span>`)}</div>
      <span class="muted" style="font-size:12.5px">Grün = jede Woche mindestens 2× – das bringt für Muskelaufbau meist mehr als 1× mit vielen Sätzen.</span>
      <span class="eyebrow">Aufbauwochen</span>
      <div class="seg" role="group" aria-label="Aufbauwochen">${[4, 5, 6].map((n) => html`<button key=${n} aria-pressed=${String(wochen === n)} onClick=${() => setWochen(n)}>${`${n} Wochen`}</button>`)}</div>
      <label class="schalter" for="bb-deload"><span><b>Deload danach</b><br/><span class="muted" style="font-size:12.5px">Eine leichte Woche (halbe Sätze, RPE 6–7), dann den nächsten Block wieder leichter beginnen.</span></span>
        <input type="checkbox" id="bb-deload" checked=${deload} onChange=${(e) => setDeload(e.currentTarget.checked)}/></label>
      <span class="muted" style="font-size:12.5px">Grundübungen steigern sich von RPE 7–8 in Woche 1 bis RPE 9–9,5 in der letzten Woche (Maschinen bis 10), Isolationen immer RPE 9 mit dem letzten Satz bis 10. Die Gewichte schlägt die App beim Training aus deinem besten e1RM und der RPE vor.</span>
    </section>` : null}

    ${schritt === 4 ? html`<section class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">4</span><span class="viz-t">Vorschau · Woche 1</span></div>
      ${woche1.days.map((d) => html`<div key=${d.offset} class="wochenplan"><span class="eyebrow">${d.label}</span>
        ${d.items.map((x, i) => html`<div key=${i} class="wp-zeile bb-zeile"><span>${nameVon(x.exercise_key, x.exercise_key)}</span><b>${`${x.groups[0].sets} × ${x.groups[0].reps}`}</b><span class="muted">${x.groups[0].rpe}</span></div>`)}</div>`)}
      <div class="haeufigkeit">${gruppen.map((g) => html`<span key=${g}>${MUSKELGRUPPEN[g].name} <b>${satzSumme(g)}</b></span>`)}</div>
      <span class="muted" style="font-size:12px">Harte Sätze je Muskel in Woche 1 · ab der zweiten Hälfte des Blocks 2 mehr.</span>
      <label class="field" for="bb-name"><span class="label">Name (optional)</span>
        <input id="bb-name" class="text" type="text" placeholder=${p.name} value=${name} onInput=${(e) => setName(e.currentTarget.value)}/></label>
      <button class="btn btn-chalk btn-block" onClick=${() => speichern(p, { quelle: 'generator' })}>Als eigenes Programm speichern</button>
      <span class="muted" style="font-size:12.5px">Danach lässt es sich ansehen, bearbeiten und als Block starten.</span>
    </section>` : null}
    <div class="row schritt-knoepfe">${schritt > 1 ? html`<button class="btn btn-soft" style="flex:1" onClick=${schritt === 2 ? seiteZurueck : zurueckSchritt}>Zurück</button>` : null}
      ${schritt === 1 ? html`<button class="btn btn-chalk" style="flex:1.6" onClick=${() => { setSeite(0); weiter(); }}>Weiter</button>` : null}
      ${schritt === 2 ? html`<button class="btn btn-chalk" style="flex:1.6" disabled=${fehlt.length > 0} onClick=${seiteWeiter}>${si < seiten.length - 1 ? deEn(`Weiter: ${seiten[si + 1].name}`, `Next: ${seiten[si + 1].name}`) : 'Weiter'}</button>` : null}
      ${schritt === 3 ? html`<button class="btn btn-chalk" style="flex:1.6" disabled=${ohneUebung.length > 0} onClick=${weiter}>Weiter</button>` : null}</div>
    ${schritt === 2 && fehlt.length ? html`<span class="muted" style="font-size:12.5px;text-align:center">${deEn(`Wähle mindestens eine Übung für ${fehlt.map((g) => MUSKELGRUPPEN[g].name).join(' und ')}.`, `Choose at least one exercise for ${fehlt.map((g) => MUSKELGRUPPEN[g].name).join(' and ')}.`)}</span>` : null}
  </div>`;
}

const SCHRITTE = ['Split', 'Übungen', 'Häufigkeit', 'Vorschau'];
/** Fortschritt eines Assistenten: nummerierte Schritte, erledigte grün, aktueller in der Akzentfarbe. */
export function Schritte({ schritt, namen }) {
  return html`<div class="schritte" aria-label=${`Schritt ${schritt} von ${namen.length}`}>${namen.map((n, i) => html`<span key=${n} class=${i + 1 < schritt ? 'ok' : i + 1 === schritt ? 'jetzt' : ''}>
    <i>${i + 1 < schritt ? '✓' : i + 1}</i><small>${n}</small></span>`)}</div>`;
}

/** Schritte eines Assistenten mit eigenem Verlaufseintrag je Schritt: die Zurück-Taste des Handys geht einen Schritt
 *  zurück (erst vor Schritt 1 schließt die Programme-Seite die Einrichtung). Jeder Schritt beginnt oben. */
export function useSchritte(merken = null) {
  // merken: Schritt übersteht einen Seitenwechsel (sessionStorage)
  const [schritt, setSchritt] = merken ? useSitzung(merken, 1) : useState(1);
  useEffect(() => window.scrollTo(0, 0), [schritt]);
  useEffect(() => {
    const z = (e) => setSchritt(e.state?.schritt ?? 1);
    addEventListener('popstate', z);
    return () => removeEventListener('popstate', z);
  }, []);
  const weiter = () => { history.pushState({ ...history.state, schritt: schritt + 1 }, ''); setSchritt(schritt + 1); };
  // nach einem Seitenwechsel fehlen die Verlaufseinträge der Schritte: dann direkt einen Schritt zurück
  const zurueck = () => (history.state?.schritt === schritt ? history.back() : setSchritt(Math.max(1, schritt - 1)));
  return [schritt, weiter, zurueck];
}
