// PR Hunter · Planer (Wünsche 239–247): Schritt für Schritt vom Ziel zum Plan. Erst das Ziel (einfaches Training,
// Bodybuilding, Powerlifting, Cardio zum aktiven Block, nur Ausdauer), dann ob Cardio dazukommt, Cardio-Ziel (auch mit
// Wettkampfdatum), Fokus Kraft/Ausgeglichen/Ausdauer, Dauer je Sitzung, Wochenraster (Kraft, Cardio, beides, Ruhetag –
// mit Vorschlag und Erholungs-Prüfung), Form. Am Ende startet der Cardio-Plan, und der passende Kraft-Ersteller öffnet sich
// vorbefüllt – die Übungen wählt man dort selbst. Eingaben liegen im Sitzungsspeicher (prh-gen-ziel-*): Verlassen fragt.
import { html, useEffect, deEn, useSitzung, datumKurz, fmt, sprache, I } from './basis.js';
import { HEUTE } from './stand.js';
import { ZIELE, ZIEL_TEXT, RENN_ZIELE, ZEIT_ZIELE, erzeugePlan, naechsterMontag, wochentag, plusTage } from '../js/ausdauerplan.js';
import { wochenVorschlag, pruefeWoche, hatKraft, hatCardio, kraftVorlage, wochenBis, MIN_WOCHEN } from '../js/kombiplan.js';
import { bestzeiten, prognosen, ftpSchaetzung, sichtbar, dauerText, wochen as wochenSummen, montag } from '../js/ausdauer.js';
import { beschreibung, WT_NAME } from './ausdauerplan.js';

const L = (de, en) => deEn(de, en);
const BB_WT = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
const BB_SPLIT = (n) => (n <= 3 ? 'gk' : n === 4 ? 'ul' : 'ppl');
const START = { ziel: null, cardio: null, sport: null, zweck: null, rennDatum: '', fokus: null, dauer: 45, wochen: 8, nKraft: 3, nCardio: 3, woche: null, t5k: null, ftp: null };
const ICON = { kraft: '💪', ruhe: '😴' };

const ZIELE_KRAFT = [
  ['einfach', '💪', ['Fit und stark', 'Fit and strong'], ['Einfaches Training: Ganzkörper, wenige Übungen, ohne Maxe.', 'Simple training: full body, few exercises, no maxes.']],
  ['bodybuilding', '🏋️', ['Muskelaufbau', 'Build muscle'], ['Bodybuilding: Split wählen, Übungen je Muskel – die App baut den Block.', 'Bodybuilding: pick a split, exercises per muscle – the app builds the block.']],
  ['powerlifting', '🏆', ['Maximalkraft', 'Max strength'], ['Powerlifting: Kniebeuge, Bank, Kreuzheben mit deinen Maxen und Test am Ende.', 'Powerlifting: squat, bench, deadlift with your maxes and a test at the end.']],
];
const FOKUS_WAHL = [
  ['kraft', ['Kraft', 'Strength'], ['Cardio als Ergänzung: weniger Umfang, höchstens eine harte Einheit pro Woche.', 'Cardio on the side: less volume, at most one hard session per week.']],
  ['mix', ['Ausgeglichen', 'Balanced'], ['Kraft und Ausdauer gleich wichtig.', 'Strength and endurance equally important.']],
  ['cardio', ['Ausdauer', 'Endurance'], ['Kraft unterstützt das Laufen bzw. Radfahren: kurze Einheiten mit 5 Übungen.', 'Strength supports running or cycling: short sessions with 5 exercises.']],
];

export function Planer({ zurueck, einst, setEinst, block = null, blockName = '', ausdauer = {}, uebergeben, toast, setZurueck }) {
  const [wahl, setWahl] = useSitzung('prh-gen-ziel-wahl', () => START);
  const [schritt, setSchritt] = useSitzung('prh-gen-ziel-schritt', 1);
  const w = { ...START, ...(wahl ?? {}) };
  const setze = (patch) => setWahl({ ...w, ...patch });
  useEffect(() => window.scrollTo(0, 0), [schritt]);
  // Zurück-Taste des Handys: einen Schritt zurück (erst in Schritt 1 fragt Programme, ob verworfen werden soll)
  useEffect(() => { setZurueck?.(() => (schritt > 1 ? (setSchritt(schritt - 1), true) : false)); return () => setZurueck?.(null); });

  const en = sprache() === 'en';
  const start = naechsterMontag(HEUTE);
  const nurCardio = w.ziel === 'cardio', zumBlock = w.ziel === 'block';
  const mitCardio = nurCardio || zumBlock || (!!w.cardio && w.cardio !== 'nein');
  const sports = w.cardio === 'beides' ? ['lauf', 'rad'] : w.cardio && w.cardio !== 'nein' ? [w.cardio] : ['lauf'];
  const sport = sports.includes(w.sport) ? w.sport : sports[0];
  const zweck = w.zweck && ZIELE[sport].some(([id]) => id === w.zweck) ? w.zweck : null;
  const rennen = zweck && RENN_ZIELE.has(zweck), rennDatum = rennen && w.rennDatum > start ? w.rennDatum : null;
  const fokus = nurCardio ? 'cardio' : w.fokus ?? (zumBlock || w.ziel === 'bodybuilding' || w.ziel === 'powerlifting' ? 'kraft' : 'mix');

  // Krafttage: aktiver Block → echte Tage der Startwoche; Bodybuilding → feste Tage des Generators; sonst frei
  const startWoche = Array.from({ length: 7 }, (_, i) => plusTage(start, i));
  const planTage = ausdauer.planTage ?? [];
  const fest = zumBlock ? startWoche.map((d, i) => (planTage.some((t) => t.datum === d) ? i : null)).filter((x) => x != null)
    : w.ziel === 'bodybuilding' ? BB_WT[Math.min(6, Math.max(2, w.nKraft))] : null;
  const nKraft = nurCardio ? 0 : fest ? fest.length : w.nKraft;
  const vorlage = w.ziel === 'einfach' && nKraft ? kraftVorlage({ anzahl: nKraft, fokus, sport, en }) : null;
  const woche = w.woche ?? wochenVorschlag(nKraft, w.nCardio, { fest, beinFolge: vorlage?.map((x) => x.bein) ?? (zumBlock ? fest.map((i) => !!ausdauer.beinTag?.(startWoche[i])) : null), hart: w.nCardio >= 5 && fokus !== 'kraft' ? 2 : 1 });
  const kraftIdx = woche.map((a, i) => (hatKraft(a) ? i : null)).filter((x) => x != null);
  const bein = woche.map((a, i) => (zumBlock ? !!ausdauer.beinTag?.(startWoche[i]) : hatKraft(a) && (vorlage ? vorlage[kraftIdx.indexOf(i)]?.bein !== false : true)));
  const cardioTage = woche.map((a, i) => (hatCardio(a) ? i : null)).filter((x) => x != null);

  // Form: 5-km-Zeit bzw. FTP (Vorschlag aus den eigenen Einheiten)
  const liste = sichtbar(ausdauer.liste ?? [], einst.ausdauer || sport);
  const prog = prognosen(bestzeiten(liste)).find((p) => p.m === 5000);
  const t5k = w.t5k ?? [Math.floor((prog?.s ?? 1680) / 60), (prog?.s ?? 1680) % 60];
  const ftp = w.ftp ?? String(einst.ftp ?? ftpSchaetzung(liste, HEUTE)?.ftp ?? 200);
  const startKm = (() => { const x = wochenSummen(liste, { von: montag(plusTage(HEUTE, -28)), bis: HEUTE }).slice(-4); return x.length ? x.reduce((s, y) => s + y.lauf.km, 0) / x.length : null; })();
  const wochen = rennDatum ? wochenBis(start, rennDatum) : w.wochen;
  const kraftTag = (d) => hatKraft(woche[wochentag(d)]);
  const beinTag = (d) => kraftTag(d) && bein[wochentag(d)];
  const param = { sport, ziel: zweck ?? (sport === 'lauf' ? 'fit' : 'grundlage'), start, wochen, tage: cardioTage, t5k: Number(t5k[0]) * 60 + (Number(t5k[1]) || 0), ftp: Number(ftp) || null, startKm, dauer: w.dauer, fokus, rennDatum };
  const plan = mitCardio && cardioTage.length ? erzeugePlan({ ...param, kraftTag, beinTag }) : null;
  const woche1 = plan?.einheiten.filter((e) => e.woche === 1) ?? [];
  const hinweise = pruefeWoche(woche, bein, woche1.map((e) => ({ wt: wochentag(e.datum), typ: e.typ })));

  // Schritte je nach Antworten
  const ids = ['ziel', 'cardio', ...(mitCardio ? ['cardioZiel', ...(nurCardio ? [] : ['fokus']), 'umfang', 'woche', 'form'] : []), 'fertig'];
  const si = Math.min(schritt, ids.length), id = ids[si - 1];
  const NAMEN = { ziel: L('Ziel', 'Goal'), cardio: 'Cardio', cardioZiel: L('Cardio-Ziel', 'Cardio goal'), fokus: L('Fokus', 'Focus'), umfang: L('Umfang', 'Volume'), woche: L('Woche', 'Week'), form: L('Form', 'Form'), fertig: L('Überblick', 'Overview') };
  const kannWeiter = { ziel: !!w.ziel, cardio: !!w.cardio && (!(nurCardio || zumBlock) || w.cardio !== 'nein'), cardioZiel: !!zweck, fokus: true, umfang: true, woche: cardioTage.length > 0 || !mitCardio, form: true }[id] ?? true;
  const weiter = () => setSchritt(si + 1);

  const wahlKnopf = (aktiv, onClick, titel, text = null, key = titel) => html`<button key=${key} aria-pressed=${String(aktiv)} onClick=${onClick}><span>${titel}</span>${text ? html`<small>${text}</small>` : null}</button>`;
  const sportName = (s) => (s === 'lauf' ? L('🏃 Laufen', '🏃 Running') : s === 'rad' ? L('🚴 Rad', '🚴 Cycling') : L('🏃🚴 Beides', '🏃🚴 Both'));
  const cardioIcon = sport === 'rad' ? '🚴' : '🏃';
  const zyklus = (i) => {
    const a = woche[i];
    const folge = nurCardio ? ['ruhe', 'cardio'] : fest ? (hatKraft(a) ? ['kraft', 'beides'] : ['ruhe', 'cardio']) : ['ruhe', 'kraft', 'cardio', 'beides'];
    const neu = [...woche]; neu[i] = folge[(folge.indexOf(a) + 1) % folge.length];
    setze({ woche: neu, nKraft: fest ? w.nKraft : neu.filter(hatKraft).length || w.nKraft, nCardio: neu.filter(hatCardio).length });
  };
  const zaehler = (titel, wert, min, max, setzen, gesperrt = false) => html`<div class="bb-saetze"><span>${titel}</span>
    <span class="row" style="gap:6px"><button class="iconbtn klein" aria-label=${L(`${titel} weniger`, `${titel} fewer`)} disabled=${gesperrt || wert <= min} onClick=${() => setzen(wert - 1)}>−</button>
      <b>${`${wert}×`}</b><button class="iconbtn klein" aria-label=${L(`${titel} mehr`, `${titel} more`)} disabled=${gesperrt || wert >= max} onClick=${() => setzen(wert + 1)}>+</button></span></div>`;
  const kraftName = (i) => (vorlage ? vorlage[kraftIdx.indexOf(i)]?.name : zumBlock ? planTage.find((t) => t.datum === startWoche[i])?.label ?? blockName : w.ziel === 'bodybuilding' ? 'Bodybuilding' : 'Powerlifting');
  const hinweisListe = html`<div class="stack" style="gap:4px">${hinweise.map((h, i) => html`<span key=${i} class=${`kw-hinweis ${h.art}`}>${h.art === 'warn' ? '⚠️ ' : h.art === 'gut' ? '✓ ' : 'ℹ️ '}${L(h.de, h.en)}</span>`)}</div>`;

  const inhalt = {
    ziel: html`<b class="ap-frage">${L('Was willst du erreichen?', 'What do you want to achieve?')}</b>
      <div class="ap-wahl">
        ${ZIELE_KRAFT.filter(([z]) => z !== 'powerlifting' || einst.trainingsart !== 'einfach').map(([z, icon, titel, text]) => wahlKnopf(w.ziel === z, () => setze({ ziel: z, cardio: null, woche: null, fokus: null, nKraft: z === 'bodybuilding' ? 4 : 3 }), `${icon} ${L(...titel)}`, L(...text), z))}
        ${block ? wahlKnopf(zumBlock, () => setze({ ziel: 'block', cardio: null, woche: null, fokus: null }), L(`➕ Cardio zu „${blockName}“`, `➕ Cardio for “${blockName}”`), L('Dein aktiver Block bleibt, die App plant Läufe bzw. Fahrten drumherum.', 'Your active block stays, the app plans runs or rides around it.'), 'block') : null}
        ${wahlKnopf(nurCardio, () => setze({ ziel: 'cardio', cardio: null, woche: null, fokus: null }), L('🏃 Nur Ausdauer', '🏃 Endurance only'), L('Laufen oder Rad mit Plan bis zum Ziel – ohne Kraftplan.', 'Running or cycling with a plan to your goal – no strength plan.'), 'cardio')}
      </div>`,
    cardio: html`<b class="ap-frage">${nurCardio || zumBlock ? L('Welche Ausdauer?', 'Which endurance sport?') : L('Mit Cardio kombinieren?', 'Combine with cardio?')}</b>
      <div class="ap-wahl">
        ${nurCardio || zumBlock ? null : wahlKnopf(w.cardio === 'nein', () => setze({ cardio: 'nein' }), L('Nein, nur Kraft', 'No, strength only'), null, 'nein')}
        ${['lauf', 'rad', 'beides'].map((s) => wahlKnopf(w.cardio === s, () => setze({ cardio: s, sport: s === 'beides' ? 'lauf' : s, zweck: null, woche: null }), sportName(s), s === 'beides' ? L('Ein Plan für die Hauptsportart, die andere trägst du frei ein.', 'One plan for your main sport, log the other freely.') : null, s))}
      </div>
      ${mitCardio && !nurCardio ? html`<span class="muted" style="font-size:12.5px">${L('Kraft und Cardio kommen in einen Wochenplan – harte Einheiten liegen nicht vor deinen Beintagen.', 'Strength and cardio go into one weekly plan – hard sessions stay away from your leg days.')}</span>` : null}`,
    cardioZiel: html`<b class="ap-frage">${L('Was ist dein Cardio-Ziel?', 'What is your cardio goal?')}</b>
      ${sports.length > 1 ? html`<div class="seg">${sports.map((s) => html`<button key=${s} aria-pressed=${String(sport === s)} onClick=${() => setze({ sport: s, zweck: null })}>${sportName(s)}</button>`)}</div>` : null}
      <div class="ap-wahl">${ZIELE[sport].map(([z, de, enName]) => wahlKnopf(zweck === z, () => setze({ zweck: z }), L(de, enName), ZIEL_TEXT[z] ? L(...ZIEL_TEXT[z]) : RENN_ZIELE.has(z) ? L('Mit Wettkampfdatum plant die App bis zu diesem Tag.', 'With a race date the app plans up to that day.') : null, z))}</div>
      ${rennen ? html`<label class="field"><span class="label">${L('Wettkampftag (optional)', 'Race day (optional)')}</span>
        <input class="text" type="date" min=${plusTage(start, 7)} value=${w.rennDatum} onInput=${(e) => setze({ rennDatum: e.currentTarget.value })}/></label>` : null}`,
    fokus: html`<b class="ap-frage">${L('Worauf liegt dein Fokus?', 'Where is your focus?')}</b>
      <div class="ap-wahl">${FOKUS_WAHL.map(([f, titel, text]) => wahlKnopf(fokus === f, () => setze({ fokus: f }), L(...titel), L(...text), f))}</div>`,
    umfang: html`<b class="ap-frage">${L('Wie lange pro Cardio-Einheit?', 'How long per cardio session?')}</b>
      <div class="seg">${[20, 30, 45, 60, 90].map((m) => html`<button key=${m} aria-pressed=${String(w.dauer === m)} onClick=${() => setze({ dauer: m })}>${`${m} min`}</button>`)}</div>
      <span class="muted" style="font-size:12.5px">${ZEIT_ZIELE.has(zweck) || sport === 'rad' ? L('Die lange Einheit am Wochenende darf länger sein, an Krafttagen bleibt Cardio kurz.', 'The long weekend session may be longer, on strength days cardio stays short.')
        : L('Obergrenze für lockere Läufe unter der Woche – der lange Lauf wächst bis zum Ziel.', 'Cap for easy weekday runs – the long run grows towards your goal.')}</span>
      ${rennDatum ? html`<div class="ap-vorschau"><b>${L(`${wochen} Wochen bis zum ${datumKurz(rennDatum)}`, `${wochen} weeks until ${datumKurz(rennDatum)}`)}</b>
          ${wochen < (MIN_WOCHEN[zweck] ?? 0) ? html`<span class="warn-text" style="font-size:12.5px">${L(`Knapp – ${MIN_WOCHEN[zweck]} Wochen oder mehr wären besser. Der Plan wird kürzer und vorsichtiger.`, `Tight – ${MIN_WOCHEN[zweck]} weeks or more would be better. The plan gets shorter and more careful.`)}</span>` : null}</div>`
      : html`<b class="ap-frage" style="font-size:16px">${L('Wie viele Wochen?', 'How many weeks?')}</b>
        <div class="seg">${[4, 6, 8, 12, 16].map((n) => html`<button key=${n} aria-pressed=${String(w.wochen === n)} onClick=${() => setze({ wochen: n })}>${L(`${n} Wo.`, `${n} wk`)}</button>`)}</div>`}`,
    woche: html`<b class="ap-frage">${L('Wie sieht deine Woche aus?', 'What does your week look like?')}</b>
      ${nurCardio ? null : zaehler(L('Krafttage', 'Strength days'), nKraft, w.ziel === 'bodybuilding' ? 2 : 1, 6, (n) => setze({ nKraft: n, woche: null }), zumBlock)}
      ${zaehler(L('Cardio-Einheiten', 'Cardio sessions'), w.woche ? cardioTage.length : w.nCardio, 1, nurCardio ? 7 : 6, (n) => setze({ nCardio: n, woche: null }))}
      <div class="kw-raster">${woche.map((a, i) => html`<button key=${i} class=${`kw-feld ${a}`} onClick=${() => zyklus(i)} aria-label=${`${L(...WT_NAME[i])}: ${a}`}>
        <b>${L(...WT_NAME[i])}</b><span>${a === 'cardio' ? cardioIcon : a === 'beides' ? `💪${cardioIcon}` : ICON[a]}</span>${bein[i] ? html`<small>${L('Beine', 'Legs')}</small>` : null}</button>`)}</div>
      <span class="muted" style="font-size:12.5px">${fest && !zumBlock ? L('Die Krafttage legt der Bodybuilding-Generator fest – Antippen wechselt Cardio und Ruhe.', 'The bodybuilding generator sets the strength days – tap to switch cardio and rest.')
        : zumBlock ? L('Krafttage aus deinem Block – Antippen wechselt Cardio und Ruhe.', 'Strength days from your block – tap to switch cardio and rest.')
        : L('Antippen wechselt: Ruhe → Kraft → Cardio → beides. Bei „beides“ erst Kraft, dann kurz Cardio.', 'Tap to switch: rest → strength → cardio → both. With “both”: strength first, then short cardio.')}
        ${w.ziel === 'powerlifting' ? L(' Die echten Krafttage legt der Powerlifting-Generator fest – die Cardio-Einheiten passen sich danach an.', ' The powerlifting generator sets the real strength days – cardio adapts to them.') : ''}</span>
      ${w.woche ? html`<button class="link" style="justify-self:start" onClick=${() => setze({ woche: null })}>${L('Vorschlag wiederherstellen', 'Restore suggestion')}</button>` : null}
      ${plan ? hinweisListe : null}`,
    form: sport === 'lauf' ? html`<b class="ap-frage">${L('Wie schnell läufst du 5 km?', 'How fast do you run 5K?')}</b>
      <div class="au-hms" style="grid-template-columns:1fr 1fr">${[0, 1].map((i) => html`<label key=${i}><input class="text" inputmode="numeric" value=${t5k[i]} onInput=${(e) => { const v = e.currentTarget.value.replace(/\D/g, '').slice(0, 2); setze({ t5k: t5k.map((x, k) => (k === i ? v : x)) }); }}/><small>${i ? L('Sek', 's') : 'Min'}</small></label>`)}</div>
      <span class="muted" style="font-size:12.5px">${prog ? L(`Vorschlag aus deinen Bestzeiten (${prog.aus}). Daraus rechnet die App deine Tempobereiche.`, `Suggested from your best times (${prog.aus}). Your pace zones come from it.`) : L('Ungefähr reicht – daraus rechnet die App deine Tempobereiche.', 'A rough value is fine – your pace zones come from it.')}</span>`
      : html`<b class="ap-frage">${L('Wie hoch ist deine FTP?', 'What is your FTP?')}</b>
      <label class="field"><span class="label">FTP (W)</span><input class="text" inputmode="numeric" value=${ftp} onInput=${(e) => setze({ ftp: e.currentTarget.value.replace(/\D/g, '') })}/></label>
      <span class="muted" style="font-size:12.5px">${L('Leistung, die du etwa eine Stunde halten kannst. Daraus rechnet die App deine Wattbereiche.', 'Power you can hold for about an hour. Your power zones come from it.')}</span>`,
    fertig: null,
  };

  // Abschluss: Cardio-Plan speichern, Kraft-Ersteller vorbefüllt öffnen
  const cardioStarten = () => {
    if (!plan) return;
    const wahlA = einst.ausdauer === 'beides' || (einst.ausdauer && einst.ausdauer !== w.cardio && w.cardio !== 'nein') ? 'beides' : w.cardio === 'beides' ? 'beides' : w.cardio;
    setEinst({ ...einst, ausdauer: wahlA, ausdauerPlan: { ...plan, param, woche, bein } });
  };
  const abschliessen = (art) => {
    if (mitCardio) cardioStarten();
    if (art === 'cardio') { toast?.({ titel: L('Cardio-Plan gestartet', 'Cardio plan started'), text: L(`${wochen} Wochen ab ${datumKurz(start)}`, `${wochen} weeks from ${datumKurz(start)}`) }); uebergeben('cardio'); return; }
    if (art === 'eigen' && vorlage) uebergeben('eigen', { 'prh-gen-eigen-name': L(`Kraft + ${sport === 'rad' ? 'Rad' : 'Laufen'} ${nKraft}×`, `Strength + ${sport === 'rad' ? 'cycling' : 'running'} ${nKraft}×`), 'prh-gen-eigen-wochen': Math.max(4, wochen), 'prh-gen-eigen-schritt': 2,
      'prh-gen-eigen-tage': vorlage.map((t, i) => ({ ...t, wt: kraftIdx[i] })), 'prh-gen-start': start });
    else if (art === 'bodybuilding') uebergeben('bodybuilding', { 'prh-gen-bb-split': BB_SPLIT(nKraft), 'prh-gen-bb-tage': nKraft, ...(mitCardio ? { 'prh-gen-start': start } : {}) });
    else uebergeben(art);
  };
  const vorschau = html`<div class="ap-vorschau">
      <b>${L('Deine Woche', 'Your week')}${plan ? L(` · ${wochen} Wochen ab ${datumKurz(start)}`, ` · ${wochen} weeks from ${datumKurz(start)}`) : ''}</b>
      ${woche.map((a, i) => { const c = woche1.filter((e) => wochentag(e.datum) === i);
        return html`<div key=${i} class="ap-zeile kombi"><span>${L(...WT_NAME[i])}</span>
          <span class="stack" style="gap:2px">${hatKraft(a) ? html`<b>💪 ${kraftName(i)}</b>` : null}
            ${c.map((e) => { const b = beschreibung(e, plan); return html`<span key=${e.id}>${cardioIcon} <b>${b.titel}</b> <small>${b.zeile}</small></span>`; })}
            ${a === 'ruhe' || (!hatKraft(a) && !c.length) ? html`<small class="muted">${L('Ruhetag', 'Rest day')}</small>` : null}</span></div>`; })}
    </div>`;
  const fertig = html`<b class="ap-frage">${L('Dein Plan', 'Your plan')}</b>
    ${mitCardio ? html`${vorschau}${hinweisListe}` : null}
    ${vorlage && mitCardio ? html`<span class="muted" style="font-size:12.5px">${L('Danach öffnet sich der Kraftplan mit Vorschlägen – Übungen tauschen, entfernen oder dazunehmen, dann speichern und als Block starten.', 'Next, the strength plan opens with suggestions – swap, remove or add exercises, then save and start it as a block.')}</span>` : null}
    ${w.ziel === 'bodybuilding' ? html`<span class="muted" style="font-size:12.5px">${L(`Danach wählst du im Bodybuilding-Generator deine Übungen (${nKraft} Tage pro Woche).`, `Next, pick your exercises in the bodybuilding generator (${nKraft} days per week).`)}</span>` : null}
    ${w.ziel === 'powerlifting' ? html`<span class="muted" style="font-size:12.5px">${L('Danach stellst du im Powerlifting-Generator Häufigkeit, Maxe und Test ein.', 'Next, set frequency, maxes and test in the powerlifting generator.')}</span>` : null}
    ${w.ziel === 'einfach' && !mitCardio ? html`<div class="ap-wahl">
        ${wahlKnopf(false, () => uebergeben('einsteiger', 'gk2'), L('Fertige Vorlage · Ganzkörper 2×', 'Ready template · full body 2×'), L('Zwei Tage pro Woche, Übungen danach anpassbar.', 'Two days per week, exercises adjustable.'), 'gk2')}
        ${wahlKnopf(false, () => uebergeben('einsteiger', 'gk3'), L('Fertige Vorlage · Ganzkörper 3×', 'Ready template · full body 3×'), L('Drei Tage pro Woche im Wechsel A/B/A.', 'Three days per week, alternating A/B/A.'), 'gk3')}
        ${wahlKnopf(false, () => uebergeben('eigen'), L('Eigener Plan', 'Own plan'), L('Tage festlegen, Übungen selbst wählen.', 'Set the days, pick the exercises yourself.'), 'eigen')}</div>`
      : html`<button class="btn btn-chalk btn-block" disabled=${mitCardio && !plan} onClick=${() => abschliessen(nurCardio || zumBlock ? 'cardio' : w.ziel === 'einfach' ? 'eigen' : w.ziel === 'bodybuilding' ? 'bodybuilding' : 'generator')}>
        ${nurCardio || zumBlock ? L('Plan starten', 'Start plan') : mitCardio ? L('Cardio starten · weiter zum Kraftplan', 'Start cardio · on to strength plan') : L('Weiter zum Kraftplan', 'On to strength plan')}</button>`}`;

  return html`<div class="screen">
    <header class="topbar unter"><button class="iconbtn" onClick=${zurueck} aria-label=${L('Zurück', 'Back')}>${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">${L(`Schritt ${si} von ${ids.length} · ${NAMEN[id]}`, `Step ${si} of ${ids.length} · ${NAMEN[id]}`)}</div><h1 class="h1">${L('Neuer Plan', 'New plan')}</h1></div></header>
    <div class="ap-schritte" style=${`grid-template-columns:repeat(${ids.length},1fr)`}>${ids.map((x, i) => html`<i key=${x} class=${i + 1 < si ? 'fertig' : i + 1 === si ? 'jetzt' : ''}></i>`)}</div>
    <section class="card pad stack planer-schritt" key=${id}>${id === 'fertig' ? fertig : inhalt[id]}</section>
    <div class="row schritt-knoepfe">
      ${si > 1 ? html`<button class="btn btn-soft" style="flex:1" onClick=${() => setSchritt(si - 1)}>${L('Zurück', 'Back')}</button>` : null}
      ${id !== 'fertig' ? html`<button class="btn btn-chalk" style="flex:1.6" disabled=${!kannWeiter} onClick=${weiter}>${L('Weiter', 'Next')}</button>` : null}</div>
  </div>`;
}

