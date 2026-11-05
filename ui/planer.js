// PR Hunter · Planer (Wünsche 239–247): Schritt für Schritt vom Ziel zum Plan. Erst das Ziel (einfaches Training,
// Bodybuilding, Powerlifting, Cardio zum aktiven Block, nur Ausdauer), dann ob Cardio dazukommt, Cardio-Ziel (auch mit
// Wettkampfdatum), Fokus Kraft/Ausgeglichen/Ausdauer, Dauer je Sitzung, Woche (je Tag Ruhe, Kraft, Cardio oder beides –
// Krafttage und Beintage so, wie der jeweilige Generator sie legt), Form, Überblick.
// Mit Kraftplan: der passende Ersteller öffnet sich vorbefüllt; der Cardio-Plan startet erst, wenn der Kraftplan
// gespeichert wird (bis dahin wartet er im Sitzungsspeicher). Zurück aus dem Ersteller führt wieder hierher.
// Nur Cardio / Cardio zum Block: „Plan starten“ startet sofort. Eingaben liegen im Sitzungsspeicher (prh-gen-ziel-*).
import { html, useEffect, deEn, useSitzung, datumKurz, sprache, I } from './basis.js';
import { HEUTE } from './stand.js';
import { ZIELE, ZIEL_TEXT, RENN_ZIELE, ZEIT_ZIELE, erzeugePlan, naechsterMontag, wochentag, plusTage } from '../js/ausdauerplan.js';
import { wochenVorschlag, pruefeWoche, hatKraft, hatCardio, kraftVorlage, wochenBis, MIN_WOCHEN, plTage, bbTage, PL_TAGE } from '../js/kombiplan.js';
import { bestzeiten, prognosen, ftpSchaetzung, sichtbar, wochen as wochenSummen, montag } from '../js/ausdauer.js';
import { beschreibung, WT_NAME } from './ausdauerplan.js';

const L = (de, en) => deEn(de, en);
const START = { ziel: null, cardio: null, sport: null, zweck: null, rennDatum: '', fokus: null, dauer: 45, wochen: 8, nKraft: 3, nCardio: 3, woche: null, t5k: null, ftp: null };
const ART_NAME = { ruhe: ['Ruhe', 'Rest'], kraft: ['Kraft', 'Strength'], cardio: ['Cardio', 'Cardio'], beides: ['Beides', 'Both'] };

const ZIELE_KRAFT = [
  ['einfach', '💪', ['Fit und stark', 'Fit and strong'], ['Ganzkörper, wenige Übungen, ohne Maxe', 'Full body, few exercises, no maxes']],
  ['bodybuilding', '🏋️', ['Muskelaufbau', 'Build muscle'], ['Bodybuilding mit Split und Übungen je Muskel', 'Bodybuilding with a split and exercises per muscle']],
  ['powerlifting', '🏆', ['Maximalkraft', 'Max strength'], ['Powerlifting: Kniebeuge, Bank, Kreuzheben, Test am Ende', 'Powerlifting: squat, bench, deadlift, test at the end']],
];
const FOKUS_WAHL = [
  ['kraft', '💪', ['Kraft', 'Strength'], ['Erst der Kraftplan – Cardio kommt Woche für Woche auf deine Ruhetage, mit weniger Umfang', 'Strength plan first – cardio goes onto your rest days week by week, with less volume']],
  ['mix', '⚖️', ['Ausgeglichen', 'Balanced'], ['Beides gleich wichtig – du verteilst die Woche selbst', 'Both equally important – you lay out the week yourself']],
  ['cardio', '🏃', ['Ausdauer', 'Endurance'], ['Erst Cardio – Krafttraining kommt um deine Läufe bzw. Fahrten herum, kurze Einheiten', 'Cardio first – strength training goes around your runs or rides, short sessions']],
];

/** Auswahlzeile: Symbol, Titel, Beschreibung, Markierung rechts. */
const Option = ({ aktiv, onClick, icon = null, titel, text = null }) => html`<button class=${`pl-opt ${aktiv ? 'an' : ''}`} aria-pressed=${String(!!aktiv)} onClick=${onClick}>
  ${icon ? html`<span class=${`pl-ico ${Array.from(icon).length > 1 ? 'doppelt' : ''}`} aria-hidden="true">${icon}</span>` : null}
  <span class="pl-txt"><b>${titel}</b>${text ? html`<small>${text}</small>` : null}</span><span class="pl-radio" aria-hidden="true"></span></button>`;
/** Kleine Auswahl-Pillen. */
const Chips = ({ werte, aktiv, setzen, label = (x) => x, aria }) => html`<div class="pl-chips" role="group" aria-label=${aria}>
  ${werte.map((x) => html`<button key=${x} class=${x === aktiv ? 'an' : ''} aria-pressed=${String(x === aktiv)} onClick=${() => setzen(x)}>${label(x)}</button>`)}</div>`;
const Hinweise = ({ liste }) => html`<div class="pl-hinweise">${liste.map((h, i) => html`<div key=${i} class=${`pl-hinweis ${h.art}`}><i aria-hidden="true">${h.art === 'warn' ? '!' : h.art === 'gut' ? '✓' : 'i'}</i><span>${L(h.de, h.en)}</span></div>`)}</div>`;

export function Planer({ zurueck, abbrechen, einst, block = null, blockName = '', ausdauer = {}, uebergeben, cardioStarten, setZurueck }) {
  const [wahl, setWahl] = useSitzung('prh-gen-ziel-wahl', () => START);
  const [schritt, setSchritt] = useSitzung('prh-gen-ziel-schritt', 1);
  const w = { ...START, ...(wahl ?? {}) };
  const setze = (patch) => setWahl({ ...w, ...patch });

  const en = sprache() === 'en';
  const start = naechsterMontag(HEUTE);
  const nurCardio = w.ziel === 'cardio', zumBlock = w.ziel === 'block';
  const mitCardio = nurCardio || zumBlock || (!!w.cardio && w.cardio !== 'nein');
  const sports = w.cardio === 'beides' ? ['lauf', 'rad'] : w.cardio && w.cardio !== 'nein' ? [w.cardio] : ['lauf'];
  const sport = sports.includes(w.sport) ? w.sport : sports[0];
  const zweck = w.zweck && ZIELE[sport].some(([id]) => id === w.zweck) ? w.zweck : null;
  const rennen = zweck && RENN_ZIELE.has(zweck), rennDatum = rennen && w.rennDatum > start ? w.rennDatum : null;
  const fokus = nurCardio ? 'cardio' : w.fokus ?? (zumBlock || w.ziel === 'bodybuilding' || w.ziel === 'powerlifting' ? 'kraft' : 'mix');

  // Krafttage: aktiver Block → echte Tage der Startwoche; Powerlifting/Bodybuilding → so, wie der Generator sie legt
  // (mit den echten Beintagen); einfaches Training → frei, Beintage aus der Vorlage
  const startWoche = Array.from({ length: 7 }, (_, i) => plusTage(start, i));
  const planTage = ausdauer.planTage ?? [];
  const pl = w.ziel === 'powerlifting' ? plTage(PL_TAGE.includes(w.nKraft) ? w.nKraft : 4) : null;
  const bb = w.ziel === 'bodybuilding' ? bbTage(Math.min(6, Math.max(2, w.nKraft))) : null;
  const fest = zumBlock ? startWoche.map((d, i) => (planTage.some((t) => t.datum === d) ? i : null)).filter((x) => x != null) : pl?.tage ?? bb?.tage ?? null;
  const beinFest = zumBlock ? startWoche.map((d) => !!ausdauer.beinTag?.(d)) : pl?.bein ?? bb?.bein ?? null;
  const nKraft = nurCardio ? 0 : fest ? fest.length : w.nKraft;
  const vorlage = w.ziel === 'einfach' && nKraft ? kraftVorlage({ anzahl: nKraft, fokus, sport, en }) : null;
  const hart = w.nCardio >= 5 && fokus !== 'kraft' ? 2 : 1;
  // Reihenfolge nach Fokus: Kraft zuerst (Cardio Woche für Woche auf die Ruhetage), Cardio zuerst (Kraft um die
  // gewählten Cardio-Tage, nur beim einfachen Training – Bodybuilding/Powerlifting haben feste Tage), sonst frei
  const kraftZuerst = !nurCardio && !zumBlock && fokus === 'kraft';
  const cardioZuerst = !nurCardio && !zumBlock && fokus === 'cardio' && w.ziel === 'einfach';
  const beinFolge = vorlage?.map((x) => x.bein) ?? null;
  const vorschlagWoche = wochenVorschlag(nKraft, w.nCardio, { fest, bein: beinFest, beinFolge, hart });
  const cardioWahl = w.cardioWahl ?? vorschlagWoche.map((a, i) => (hatCardio(a) ? i : null)).filter((x) => x != null);
  const woche = kraftZuerst ? vorschlagWoche : cardioZuerst ? wochenVorschlag(nKraft, cardioWahl.length, { festCardio: cardioWahl, beinFolge, hart }) : w.woche ?? vorschlagWoche;
  const kraftIdx = woche.map((a, i) => (hatKraft(a) ? i : null)).filter((x) => x != null);
  const bein = beinFest ? woche.map((a, i) => hatKraft(a) && beinFest[i]) : woche.map((a, i) => hatKraft(a) && (vorlage ? vorlage[kraftIdx.indexOf(i)]?.bein !== false : true));
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
  const param = { sport, ziel: zweck ?? (sport === 'lauf' ? 'fit' : 'grundlage'), start, wochen, tage: cardioTage, t5k: Number(t5k[0]) * 60 + (Number(t5k[1]) || 0), ftp: Number(ftp) || null, startKm, dauer: w.dauer, fokus, rennDatum, ...(nurCardio ? {} : { jeWoche: cardioTage.length, raster: kraftZuerst ? null : woche }) };
  const plan = mitCardio && cardioTage.length ? erzeugePlan({ ...param, kraftTag, beinTag }) : null;
  const woche1 = plan?.einheiten.filter((e) => e.woche === 1) ?? [];
  const hinweise = pruefeWoche(woche, bein, woche1.map((e) => ({ wt: wochentag(e.datum), typ: e.typ })));

  // Schritte je nach Antworten
  const ids = ['ziel', 'cardio', ...(mitCardio ? [...(nurCardio ? [] : ['fokus']), 'cardioZiel', 'umfang', 'woche', 'form'] : []), 'fertig'];
  const si = Math.min(Math.max(1, schritt), ids.length), id = ids[si - 1];
  useEffect(() => window.scrollTo(0, 0), [id]);
  // Zurück (Handy und Pfeil oben): erst einen Schritt zurück; in Schritt 1 entscheidet Programme (Warnung bei Eingaben)
  useEffect(() => { setZurueck?.(() => (si > 1 ? (setSchritt(si - 1), true) : false)); return () => setZurueck?.(null); });
  const NAMEN = { ziel: L('Dein Ziel', 'Your goal'), cardio: 'Cardio', cardioZiel: L('Cardio-Ziel', 'Cardio goal'), fokus: L('Fokus', 'Focus'), umfang: L('Umfang', 'Volume'), woche: L('Deine Woche', 'Your week'), form: L('Deine Form', 'Your form'), fertig: L('Überblick', 'Overview') };
  const kannWeiter = { ziel: !!w.ziel, cardio: !!w.cardio && (!(nurCardio || zumBlock) || w.cardio !== 'nein'), cardioZiel: !!zweck, woche: cardioTage.length > 0 }[id] ?? true;

  const sportName = (s) => (s === 'lauf' ? L('Laufen', 'Running') : s === 'rad' ? L('Rad', 'Cycling') : L('Beides', 'Both'));
  const sportIcon = (s) => (s === 'lauf' ? '🏃' : s === 'rad' ? '🚴' : '🏃🚴');
  const cardioIcon = sportIcon(sport);
  const artIcon = (a) => (a === 'ruhe' ? '😴' : a === 'kraft' ? '💪' : a === 'cardio' ? cardioIcon : `💪${cardioIcon}`);
  const erlaubt = (i) => (nurCardio ? ['ruhe', 'cardio'] : fest ? (fest.includes(i) ? ['kraft', 'beides'] : ['ruhe', 'cardio']) : ['ruhe', 'kraft', 'cardio', 'beides']);
  const cardioTagWahl = (i, an) => { const neu = [...new Set(an ? [...cardioWahl, i] : cardioWahl.filter((x) => x !== i))].sort((a, b) => a - b); if (neu.length) setze({ cardioWahl: neu, nCardio: neu.length }); };
  const setzeTag = (i, a) => { const neu = [...woche]; neu[i] = a; setze({ woche: neu, ...(fest ? {} : { nKraft: neu.filter(hatKraft).length || w.nKraft }), nCardio: neu.filter(hatCardio).length }); };
  const kraftName = (i) => (vorlage ? vorlage[kraftIdx.indexOf(i)]?.name : zumBlock ? planTage.find((t) => t.datum === startWoche[i])?.label ?? blockName : w.ziel === 'bodybuilding' ? 'Bodybuilding' : 'Powerlifting');
  const kraftWerte = w.ziel === 'powerlifting' ? PL_TAGE : w.ziel === 'bodybuilding' ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  const frage = (titel, unter = null) => html`<h2 class="pl-frage">${titel}</h2>${unter ? html`<p class="pl-unter">${unter}</p>` : null}`;

  const inhalt = {
    ziel: html`${frage(L('Was willst du erreichen?', 'What do you want to achieve?'))}
      <div class="pl-optionen">
        ${ZIELE_KRAFT.filter(([z]) => z !== 'powerlifting' || einst.trainingsart !== 'einfach').map(([z, icon, titel, text]) => html`<${Option} key=${z} aktiv=${w.ziel === z} icon=${icon} titel=${L(...titel)} text=${L(...text)}
          onClick=${() => setze({ ziel: z, cardio: null, woche: null, fokus: null, nKraft: z === 'einfach' ? 3 : 4 })}/>`)}
        ${block ? html`<${Option} aktiv=${zumBlock} icon="➕" titel=${L(`Cardio zu „${blockName}“`, `Cardio for “${blockName}”`)} text=${L('Dein Block bleibt, Cardio kommt drumherum', 'Your block stays, cardio goes around it')}
          onClick=${() => setze({ ziel: 'block', cardio: null, woche: null, fokus: null })}/>` : null}
        <${Option} aktiv=${nurCardio} icon="🏃" titel=${L('Nur Ausdauer', 'Endurance only')} text=${L('Laufen oder Rad mit Plan bis zum Ziel', 'Running or cycling with a plan to your goal')}
          onClick=${() => setze({ ziel: 'cardio', cardio: null, woche: null, fokus: null, nCardio: 3 })}/>
      </div>`,
    cardio: html`${nurCardio || zumBlock ? frage(L('Welche Ausdauer?', 'Which endurance sport?')) : frage(L('Mit Cardio kombinieren?', 'Combine with cardio?'), L('Kraft und Cardio kommen in einen Wochenplan – harte Einheiten liegen nicht vor deinen Beintagen.', 'Strength and cardio go into one weekly plan – hard sessions stay away from your leg days.'))}
      <div class="pl-optionen">
        ${nurCardio || zumBlock ? null : html`<${Option} aktiv=${w.cardio === 'nein'} icon="✋" titel=${L('Nein, nur Kraft', 'No, strength only')} onClick=${() => setze({ cardio: 'nein' })}/>`}
        ${['lauf', 'rad', 'beides'].map((s) => html`<${Option} key=${s} aktiv=${w.cardio === s} icon=${sportIcon(s)} titel=${sportName(s)}
          text=${s === 'beides' ? L('Ein Plan für die Hauptsportart, die andere trägst du frei ein', 'One plan for your main sport, log the other freely') : null}
          onClick=${() => setze({ cardio: s, sport: s === 'beides' ? 'lauf' : s, zweck: null, woche: null })}/>`)}
      </div>`,
    cardioZiel: html`${frage(L('Was ist dein Cardio-Ziel?', 'What is your cardio goal?'))}
      ${sports.length > 1 ? html`<${Chips} aria=${L('Plan für', 'Plan for')} werte=${sports} aktiv=${sport} label=${(s) => `${sportIcon(s)} ${sportName(s)}`} setzen=${(s) => setze({ sport: s, zweck: null })}/>` : null}
      <div class="pl-optionen">${ZIELE[sport].map(([z, de, enName]) => html`<${Option} key=${z} aktiv=${zweck === z} titel=${L(de, enName)}
        text=${ZIEL_TEXT[z] ? L(...ZIEL_TEXT[z]) : RENN_ZIELE.has(z) ? L('Wettkampf – mit Datum plant die App bis zu diesem Tag', 'Race – with a date the app plans up to that day') : null} onClick=${() => setze({ zweck: z })}/>`)}</div>
      ${rennen ? html`<div class="field"><label class="label" for="pl-renn">${L('Wettkampftag (optional)', 'Race day (optional)')}</label>
        <div class="pl-datum"><input id="pl-renn" class="text" type="date" min=${plusTage(start, 7)} value=${w.rennDatum} onInput=${(e) => setze({ rennDatum: e.currentTarget.value })}/>
          ${w.rennDatum ? html`<button class="iconbtn" aria-label=${L('Wettkampftag entfernen', 'Remove race day')} onClick=${() => setze({ rennDatum: '' })}>${I.zu}</button>` : null}</div></div>` : null}`,
    fokus: html`${frage(L('Worauf liegt dein Fokus?', 'Where is your focus?'))}
      <div class="pl-optionen">${FOKUS_WAHL.map(([f, icon, titel, text]) => html`<${Option} key=${f} aktiv=${fokus === f} icon=${icon} titel=${L(...titel)} text=${L(...text)} onClick=${() => setze({ fokus: f })}/>`)}</div>`,
    umfang: html`${frage(L('Wie lange pro Cardio-Einheit?', 'How long per cardio session?'), ZEIT_ZIELE.has(zweck) || sport === 'rad' ? L('Die lange Einheit am Wochenende darf länger sein, an Krafttagen bleibt Cardio kurz.', 'The long weekend session may be longer, on strength days cardio stays short.')
        : L('Obergrenze für lockere Läufe unter der Woche – der lange Lauf wächst bis zum Ziel.', 'Cap for easy weekday runs – the long run grows towards your goal.'))}
      <${Chips} aria=${L('Minuten', 'Minutes')} werte=${[20, 30, 45, 60, 90]} aktiv=${w.dauer} label=${(m) => `${m} min`} setzen=${(m) => setze({ dauer: m })}/>
      ${rennDatum ? html`<div class="pl-info"><b>${L(`${wochen} Wochen bis zum ${datumKurz(rennDatum)}`, `${wochen} weeks until ${datumKurz(rennDatum)}`)}</b>
          ${wochen < (MIN_WOCHEN[zweck] ?? 0) ? html`<span class="warn-text">${L(`Knapp – ${MIN_WOCHEN[zweck]} Wochen oder mehr wären besser. Der Plan wird kürzer und vorsichtiger.`, `Tight – ${MIN_WOCHEN[zweck]} weeks or more would be better. The plan gets shorter and more careful.`)}</span>` : null}</div>`
      : html`<h3 class="pl-zwischen">${L('Wie viele Wochen?', 'How many weeks?')}</h3>
        <${Chips} aria=${L('Wochen', 'Weeks')} werte=${[4, 6, 8, 12, 16]} aktiv=${w.wochen} label=${(n) => L(`${n} Wo.`, `${n} wk`)} setzen=${(n) => setze({ wochen: n })}/>`}`,
    woche: html`${frage(kraftZuerst ? L('Kraft zuerst – Cardio passt sich an', 'Strength first – cardio adapts') : cardioZuerst ? L('Cardio zuerst – Kraft passt sich an', 'Cardio first – strength adapts') : L('Wie sieht deine Woche aus?', 'What does your week look like?'),
        kraftZuerst ? L('Die Krafttage kommen aus deinem Kraftplan. Cardio legt die App jede Woche auf die Ruhetage – auch wenn sich Krafttage verschieben.', 'Strength days come from your strength plan. The app puts cardio on that week’s rest days – even when strength days move.')
        : cardioZuerst ? L('Wähle deine Cardio-Tage. Die Krafttage legt die App drumherum – Beine nicht vor harten Einheiten.', 'Choose your cardio days. The app places strength around them – no legs before hard sessions.')
        : zumBlock ? L('Krafttage aus deinem Block. Wähle, wo Cardio hinkommt; wechseln die Krafttage, wandert Cardio auf die Ruhetage.', 'Strength days from your block. Choose where cardio goes; if strength days change, cardio moves to rest days.')
        : w.ziel === 'powerlifting' ? L(`Tage wie im Powerlifting-Generator (Kniebeuge und Kreuzheben je ${pl.proWoche.squat}×, Bank 2×).`, `Days as in the powerlifting generator (squat and deadlift ${pl.proWoche.squat}× each, bench 2×).`)
        : w.ziel === 'bodybuilding' ? L('Tage wie im Bodybuilding-Generator. Wähle, wo Cardio hinkommt.', 'Days as in the bodybuilding generator. Choose where cardio goes.')
        : nurCardio ? null : L('Die App schlägt eine Verteilung vor – pro Tag änderbar.', 'The app suggests a layout – adjustable per day.'))}
      ${nurCardio || zumBlock ? null : html`<div class="pl-zeile"><span>${L('Krafttage', 'Strength days')}</span><${Chips} aria=${L('Krafttage', 'Strength days')} werte=${kraftWerte} aktiv=${nKraft} label=${(n) => `${n}×`} setzen=${(n) => setze({ nKraft: n, woche: null })}/></div>`}
      <div class="pl-zeile"><span>${L('Cardio', 'Cardio')}</span><${Chips} aria=${L('Cardio-Einheiten', 'Cardio sessions')} werte=${nurCardio ? [2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6]} aktiv=${cardioTage.length} label=${(n) => `${n}×`} setzen=${(n) => setze({ nCardio: n, woche: null, cardioWahl: null })}/></div>
      <div class="pl-woche">${woche.map((a, i) => html`<div key=${i} class="pl-tag">
        <span class="pl-tagname"><b>${L(...WT_NAME[i])}</b>${bein[i] ? html`<small>${L('Beine', 'Legs')}</small>` : null}</span>
        ${kraftZuerst ? html`<div class=${`pl-tag-fest ${a}`}><span aria-hidden="true">${artIcon(a)}</span><small>${L(...ART_NAME[a])}</small></div>`
          : cardioZuerst ? html`<div class="pl-seg" role="group" aria-label=${L(...WT_NAME[i])}>${['ruhe', 'cardio'].map((x) => { const an = x === 'cardio' ? hatCardio(a) : !hatCardio(a);
              return html`<button key=${x} class=${an ? `an ${x === 'cardio' ? (hatKraft(a) ? 'beides' : 'cardio') : hatKraft(a) ? 'kraft' : 'ruhe'}` : ''} aria-pressed=${String(an)} onClick=${() => cardioTagWahl(i, x === 'cardio')}>
                <span aria-hidden="true">${x === 'cardio' ? cardioIcon : hatKraft(a) ? '💪' : '😴'}</span><small>${x === 'cardio' ? (hatKraft(a) ? L('Cardio + Kraft', 'Cardio + strength') : 'Cardio') : hatKraft(a) ? L('Kraft', 'Strength') : L('Ruhe', 'Rest')}</small></button>`; })}</div>`
          : html`<div class="pl-seg" role="group" aria-label=${L(...WT_NAME[i])}>${erlaubt(i).map((x) => html`<button key=${x} class=${x === a ? `an ${x}` : ''} aria-pressed=${String(x === a)} onClick=${() => setzeTag(i, x)}>
          <span aria-hidden="true">${artIcon(x)}</span><small>${L(...ART_NAME[x])}</small></button>`)}</div>`}</div>`)}</div>
      ${w.woche && !kraftZuerst && !cardioZuerst ? html`<button class="pl-link" onClick=${() => setze({ woche: null })}>${L('Vorschlag wiederherstellen', 'Restore suggestion')}</button>` : null}
      ${w.cardioWahl && cardioZuerst ? html`<button class="pl-link" onClick=${() => setze({ cardioWahl: null, nCardio: w.nCardio })}>${L('Vorschlag wiederherstellen', 'Restore suggestion')}</button>` : null}
      ${plan ? html`<${Hinweise} liste=${hinweise}/>` : null}`,
    form: sport === 'lauf' ? html`${frage(L('Wie schnell läufst du 5 km?', 'How fast do you run 5K?'), prog ? L(`Vorschlag aus deinen Bestzeiten (${prog.aus}). Daraus rechnet die App deine Tempobereiche.`, `Suggested from your best times (${prog.aus}). Your pace zones come from it.`) : L('Ungefähr reicht – daraus rechnet die App deine Tempobereiche.', 'A rough value is fine – your pace zones come from it.'))}
      <div class="au-hms" style="grid-template-columns:1fr 1fr">${[0, 1].map((i) => html`<label key=${i}><input class="text" inputmode="numeric" value=${t5k[i]} onInput=${(e) => { const v = e.currentTarget.value.replace(/\D/g, '').slice(0, 2); setze({ t5k: t5k.map((x, k) => (k === i ? v : x)) }); }}/><small>${i ? L('Sek', 's') : 'Min'}</small></label>`)}</div>`
      : html`${frage(L('Wie hoch ist deine FTP?', 'What is your FTP?'), L('Leistung, die du etwa eine Stunde halten kannst. Daraus rechnet die App deine Wattbereiche.', 'Power you can hold for about an hour. Your power zones come from it.'))}
      <label class="field"><span class="label">FTP (W)</span><input class="text" inputmode="numeric" value=${ftp} onInput=${(e) => setze({ ftp: e.currentTarget.value.replace(/\D/g, '') })}/></label>`,
  };

  // Abschluss: mit Kraftplan wartet der Cardio-Plan, bis der Kraftplan gespeichert ist
  const ausdauerWahl = einst.ausdauer === 'beides' || (einst.ausdauer && einst.ausdauer !== w.cardio) ? 'beides' : w.cardio;
  const ausstehend = plan ? { ausdauer: ausdauerWahl, plan: { ...plan, param, woche, bein }, start } : null;
  const abschliessen = () => {
    if (nurCardio || zumBlock) { cardioStarten(ausstehend); uebergeben('cardio'); return; }
    if (w.ziel === 'einfach') uebergeben('eigen', { ausstehend, werte: { 'prh-gen-eigen-name': L(`Kraft + ${sport === 'rad' ? 'Rad' : 'Laufen'} ${nKraft}×`, `Strength + ${sport === 'rad' ? 'cycling' : 'running'} ${nKraft}×`),
      'prh-gen-eigen-wochen': Math.max(4, wochen), 'prh-gen-eigen-schritt': 2, 'prh-gen-eigen-tage': vorlage.map((t, i) => ({ ...t, wt: kraftIdx[i] })) } });
    else if (w.ziel === 'bodybuilding') uebergeben('bodybuilding', { ausstehend, werte: mitCardio ? { 'prh-gen-bb-split': bb.split, 'prh-gen-bb-tage': nKraft, 'prh-gen-bb-vorgabe': { tage: nKraft } } : {} });
    else uebergeben('generator', { ausstehend, vorgabe: mitCardio ? { proWoche: pl.proWoche, start } : null });
  };
  const zielName = (z) => L(...(ZIELE_KRAFT.find(([x]) => x === z)?.[2] ?? (z === 'block' ? [`Cardio zu „${blockName}“`, `Cardio for “${blockName}”`] : ['Nur Ausdauer', 'Endurance only'])));
  const fertig = html`${frage(L('Dein Plan', 'Your plan'), plan ? L(`${wochen} Wochen ab ${datumKurz(start)}`, `${wochen} weeks from ${datumKurz(start)}`) : null)}
    <div class="pl-zusammen">
      <span><small>${L('Ziel', 'Goal')}</small><b>${zielName(w.ziel)}</b></span>
      ${mitCardio ? html`<span><small>Cardio</small><b>${`${cardioIcon} ${L(...(ZIELE[sport].find(([x]) => x === zweck) ?? ['', '', '']).slice(1, 3))}${rennDatum ? ` · ${datumKurz(rennDatum)}` : ''}`}</b></span>` : null}
      ${mitCardio && !nurCardio ? html`<span><small>${L('Fokus', 'Focus')}</small><b>${L(...FOKUS_WAHL.find(([f]) => f === fokus)[2])}</b></span>` : null}
    </div>
    ${plan ? html`<div class="pl-plan">${woche.map((a, i) => { const c = woche1.filter((e) => wochentag(e.datum) === i);
        return html`<div key=${i} class="pl-planzeile"><span class="pl-tagpill">${L(...WT_NAME[i])}</span><div class="pl-items">
          ${hatKraft(a) ? html`<span class="pl-item kraft">💪 ${kraftName(i)}${bein[i] ? html` <small>${L('Beine', 'legs')}</small>` : null}</span>` : null}
          ${c.map((e) => { const b = beschreibung(e, plan); return html`<span key=${e.id} class="pl-item cardio">${cardioIcon} ${b.titel} <small>${b.zeile}</small></span>`; })}
          ${!hatKraft(a) && !c.length ? html`<span class="pl-item ruhe">${L('Ruhetag', 'Rest day')}</span>` : null}</div></div>`; })}</div>
      <${Hinweise} liste=${hinweise}/>` : null}
    ${w.ziel === 'einfach' && !mitCardio ? html`<div class="pl-optionen">
        <${Option} icon="📋" titel=${L('Fertige Vorlage · Ganzkörper 2×', 'Ready template · full body 2×')} text=${L('Zwei Tage pro Woche, Übungen anpassbar', 'Two days per week, exercises adjustable')} onClick=${() => uebergeben('einsteiger', { id: 'gk2' })}/>
        <${Option} icon="📋" titel=${L('Fertige Vorlage · Ganzkörper 3×', 'Ready template · full body 3×')} text=${L('Drei Tage pro Woche im Wechsel A/B/A', 'Three days per week, alternating A/B/A')} onClick=${() => uebergeben('einsteiger', { id: 'gk3' })}/>
        <${Option} icon="✏️" titel=${L('Eigener Plan', 'Own plan')} text=${L('Tage festlegen, Übungen selbst wählen', 'Set the days, pick the exercises yourself')} onClick=${() => uebergeben('eigen', {})}/></div>`
      : html`${!nurCardio && !zumBlock ? html`<p class="pl-unter">${w.ziel === 'einfach' ? L('Als Nächstes: Übungen ansehen und tauschen, dann speichern.', 'Next: review and swap exercises, then save.')
          : w.ziel === 'bodybuilding' ? L(`Als Nächstes: Übungen im Bodybuilding-Generator wählen (${nKraft} Tage pro Woche).`, `Next: pick exercises in the bodybuilding generator (${nKraft} days per week).`)
          : L('Als Nächstes: Maxe und Test im Powerlifting-Generator.', 'Next: maxes and test in the powerlifting generator.')}
          ${plan ? L(' Der Cardio-Plan startet, sobald du den Kraftplan speicherst.', ' The cardio plan starts as soon as you save the strength plan.') : ''}</p>` : null}
        ${plan ? html`<p class="pl-unter">${L('Einzelne Wochen passt du danach unter Programme → Woche an: Einheiten verschieben oder weglassen.', 'Adjust single weeks later under Programmes → Week: move or drop sessions.')}</p>` : null}
        <button class="pl-weiter voll" disabled=${mitCardio && !plan} onClick=${abschliessen}>${nurCardio || zumBlock ? L('Plan starten', 'Start plan') : L('Weiter zum Kraftplan', 'On to strength plan')}</button>`}`;

  return html`<div class="screen planer">
    <header class="topbar unter"><button class="iconbtn" onClick=${zurueck} aria-label=${L('Zurück', 'Back')}>${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">${L('Neuer Plan', 'New plan')}</div><h1 class="h1">${NAMEN[id]}</h1></div>
      <span class="pl-zaehler">${`${si}/${ids.length}`}</span>
      <button class="iconbtn" onClick=${abbrechen} aria-label=${L('Planer schließen', 'Close planner')}>${I.zu}</button></header>
    <div class="pl-fortschritt" role="progressbar" aria-valuemin="1" aria-valuemax=${ids.length} aria-valuenow=${si}><i style=${`width:${(si / ids.length) * 100}%`}></i></div>
    <section class="pl-karte" key=${id}>${id === 'fertig' ? fertig : inhalt[id]}</section>
    <div class="pl-fuss">
      ${si > 1 ? html`<button class="pl-zurueck" onClick=${() => setSchritt(si - 1)}>${L('Zurück', 'Back')}</button>` : html`<span></span>`}
      ${id === 'fertig' ? null : html`<button class="pl-weiter" disabled=${!kannWeiter} onClick=${() => setSchritt(si + 1)}>${L('Weiter', 'Next')}</button>`}</div>
  </div>`;
}
