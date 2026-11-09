// PR Hunter · Powerlifting mit Top-Satz/Back-off (Wunsch 255, 09.11.2026): je Lift 0–5× pro Woche, beliebig viele
// Variationen (rotieren) oder keine, Progression Top-Satz/Back-off oder Advanced Bench. Ergebnis ist eine Musterwoche,
// die im eigenen Plan weitergeht – dort lässt sie sich ergänzen (z. B. ein normaler Oberkörpertag) und speichern.
// Die Rechnung steckt in js/progression.js (plMusterwoche, eigenerPlanAus).
import { html, useEffect, I, nameVon, deEn, useSitzung, katalogListe, liftName } from './basis.js';
import { Schritte, useSchritte } from './bbgenerator.js';
import { plMusterwoche, eigenerPlanAus, HAUPT_KEY } from '../js/progression.js';
import { canditoWochen, STANDARD_VARIANTEN, pruefePana } from '../js/generator.js';

const LIFTE = [['S', 'squat'], ['B', 'bench'], ['D', 'dead']];
const BASIS = { S: 'squat', B: 'bench', D: 'deadlift' };
const STANDARD = { S: STANDARD_VARIANTEN.squat, D: STANDARD_VARIANTEN.dead, B: 'close-grip_barbell_bench_press' };
const WT = [['Mo', 'Mon'], ['Di', 'Tue'], ['Mi', 'Wed'], ['Do', 'Thu'], ['Fr', 'Fri'], ['Sa', 'Sat'], ['So', 'Sun']];
const ROLLE = { schwer: ['schwer', 'heavy'], variation: ['Variation', 'variation'], leicht: ['leicht', 'light'], candito: ['Advanced Bench', 'Advanced Bench'] };
const LIFT_VON = { S: 'squat', B: 'bench', D: 'dead' };

/** Variationen eines Lifts: Langhantel-Varianten der Wettkampfübung aus dem Katalog, Standardvariante zuerst. */
const variationen = (l) => {
  const liste = katalogListe().filter((e) => e.b === BASIS[l] && e.lt === 'barbell' && e.k !== HAUPT_KEY[l]).map((e) => e.k);
  return [...new Set([STANDARD[l], ...liste.sort((a, b) => nameVon(a).localeCompare(nameVon(b)))])].filter((k) => katalogListe().some((e) => e.k === k));
};
/** Name eines Tages aus seinem Inhalt: „Kniebeuge schwer · Bankdrücken Variation“. */
const tagName = (t, i) => (t.uebungen.length ? t.uebungen.map((u) => (u.rolle === 'candito' ? 'Advanced Bench' : `${liftName(LIFT_VON[u.lift])} ${deEn(...ROLLE[u.rolle])}`)).join(' · ')
  : deEn(`Tag ${'ABCDEF'[i]}`, `Day ${'ABCDEF'[i]}`));   // freier Tag – im Plan mit eigenen Übungen füllen

export function PlGenerator({ zurueck, zumPlan, einst = {}, vorlagen = {} }) {
  const [schritt, weiter, zurueckSchritt] = useSchritte('prh-gen-plneu-schritt');
  const [freq, setFreq] = useSitzung('prh-gen-plneu-freq', { S: 2, B: 2, D: 1 });
  const [tageWahl, setTageWahl] = useSitzung('prh-gen-plneu-tage', null);
  const [varianten, setVarianten] = useSitzung('prh-gen-plneu-varianten', { S: [STANDARD.S], B: [STANDARD.B], D: [STANDARD.D] });
  const [bank, setBank] = useSitzung('prh-gen-plneu-bank', 'top');
  const [wochen, setWochen] = useSitzung('prh-gen-plneu-wochen', 6);
  const [abschluss, setAbschluss] = useSitzung('prh-gen-plneu-abschluss', 'test');
  const [tm, setTm] = useSitzung('prh-gen-plneu-tm', einst.cut ? 0.92 : 0.95);
  useEffect(() => window.scrollTo(0, 0), [schritt]);
  const vorlage = vorlagen.candito_int_adv_bench;
  const canditoGeht = !!vorlage && wochen >= 4 && freq.B > 0;
  const bankJetzt = bank === 'candito' && !canditoGeht ? 'top' : bank;
  // Advanced Bench legt die Bank-Tage selbst fest
  let canditoTage = 0;
  try { canditoTage = bankJetzt === 'candito' ? canditoWochen(vorlage, wochen)[0].length : 0; } catch { canditoTage = 0; }
  const proWoche = { ...freq, B: bankJetzt === 'candito' ? canditoTage : freq.B };
  const minTage = Math.max(1, proWoche.S, proWoche.B, proWoche.D);
  const autoTage = Math.max(minTage, Math.min(6, Math.ceil((proWoche.S + proWoche.B + proWoche.D) / 2)));
  const tage = tageWahl != null && tageWahl >= minTage ? tageWahl : autoTage;
  const keiner = !proWoche.S && !proWoche.B && !proWoche.D;
  const muster = keiner ? [] : plMusterwoche({ proWoche, varianten: Object.fromEntries(LIFTE.map(([l]) => [l, freq[l] >= 2 ? varianten[l] ?? [] : []])), tage, bank: bankJetzt });
  let plan = null, fehler = null;
  try { plan = keiner ? null : eigenerPlanAus({ wochen, tage: muster.map((t, i) => ({ ...t, name: tagName(t, i) })), abschluss, tm, canditoVorlage: vorlage }); } catch (e) { fehler = e.message; }
  const pana = plan ? pruefePana(plan).fehler : [];
  const seg = (werte, aktiv, setzen, label, aus = () => false) => html`<div class="seg" role="group" aria-label=${label}>${werte.map(([v, t]) => html`<button key=${String(v)}
    aria-pressed=${String(aktiv === v)} disabled=${aus(v)} onClick=${() => setzen(v)}>${t}</button>`)}</div>`;
  const umschalten = (l, k) => { const a = varianten[l] ?? []; setVarianten({ ...varianten, [l]: a.includes(k) ? a.filter((x) => x !== k) : [...a, k] }); };
  const woche = html`<div class="stack" style="gap:8px">${muster.map((t, i) => html`<div key=${i} class="wochenplan"><span class="eyebrow">${`${deEn(...WT[t.wt])} · ${tagName(t, i)}`}</span>
    ${t.uebungen.map((u, j) => html`<div key=${j} class="wp-zeile eigen-zeile"><span>${nameVon(u.key, u.key)}</span>
      <span class="muted">${u.rolle === 'schwer' ? deEn('Top-Satz + Back-offs', 'Top set + back-offs') : u.rolle === 'variation' ? deEn('Top-Satz + Back-off mit 90 %', 'Top set + back-off at 90 %')
        : u.rolle === 'leicht' ? deEn('Leicht · Technik', 'Light · technique') : deEn('nach der Candito-Vorlage', 'from the Candito template')}${u.rotation?.length > 1 ? ` · ${deEn('wechselt mit', 'rotates with')} ${u.rotation.filter((k) => k !== u.key).map((k) => nameVon(k, k)).join(', ')}` : ''}</span></div>`)}</div>`)}</div>`;
  const weiterZumPlan = () => zumPlan({ 'prh-gen-eigen-tage': muster.map((t, i) => ({ ...t, name: tagName(t, i) })), 'prh-gen-eigen-wochen': wochen, 'prh-gen-eigen-schritt': 2,
    'prh-gen-eigen-modus': 'pl', 'prh-gen-eigen-abschluss': abschluss, 'prh-gen-eigen-tm': tm, 'prh-gen-eigen-name': `Powerlifting ${wochen} Wochen` });
  return html`<div class="screen">
    <header class="topbar unter"><button class="iconbtn" onClick=${zurueck} aria-label="Zurück">${I.zurueck}</button>
      <div style="flex:1;min-width:0"><div class="eyebrow">Top-Satz und Back-off</div><h1 class="h1" style="font-size:26px">Powerlifting</h1></div></header>
    <${Schritte} schritt=${schritt} namen=${['Häufigkeit', 'Variationen', 'Progression']}/>

    ${schritt === 1 ? html`<section class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">1</span><span class="viz-t">${deEn('Wie oft pro Woche', 'How often per week')}</span></div>
      ${LIFTE.map(([l, n]) => html`<div key=${l} class="pro-woche"><span>${liftName(n)}</span>
        ${seg([0, 1, 2, 3, 4, 5].map((x) => [x, `${x}×`]), freq[l], (x) => setFreq({ ...freq, [l]: x }), deEn(`${liftName(n)} pro Woche`, `${liftName(n)} per week`))}</div>`)}
      <span class="muted" style="font-size:12.5px">${deEn('Je Lift: 1. Einheit schwer (Top-Satz + Back-offs), 2. und 3. Variation, ab der 4. leicht für die Technik. 0× = der Lift kommt nicht vor.', 'Per lift: 1st session heavy (top set + back-offs), 2nd and 3rd a variation, from the 4th light for technique. 0× = the lift is left out.')}</span>
      <span class="eyebrow">Trainingstage pro Woche</span>
      ${seg([1, 2, 3, 4, 5, 6].map((x) => [x, `${x}×`]), tage, setTageWahl, 'Trainingstage pro Woche', (x) => x < minTage)}
      ${keiner ? html`<span class="warn-text" style="font-size:12.5px">${deEn('Mindestens ein Lift braucht 1× oder mehr.', 'At least one lift needs 1× or more.')}</span>` : woche}
      <span class="muted" style="font-size:12.5px">${deEn('Schwere Kniebeuge und schweres Kreuzheben liegen an verschiedenen Tagen. Weitere Übungen (z. B. ein Oberkörpertag) fügst du im nächsten Teil im Plan hinzu.', 'Heavy squat and heavy deadlift are on different days. You add more exercises (e.g. an upper-body day) in the plan afterwards.')}</span>
    </section>` : null}

    ${schritt === 2 ? html`<section class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">2</span><span class="viz-t">Variationen</span></div>
      <span class="muted" style="font-size:12.5px">${deEn('Mehrere wählen: sie wechseln sich Einheit für Einheit und Woche für Woche ab. Keine gewählt = der Wettkampflift mit 90 %.', 'Pick several: they rotate session by session and week by week. None = the competition lift at 90 %.')}</span>
      ${LIFTE.map(([l, n]) => html`<div key=${l} class="stack" style="gap:6px"><span class="eyebrow">${liftName(n)}</span>
        ${freq[l] < 2 || (l === 'B' && bankJetzt === 'candito') ? html`<span class="muted" style="font-size:12.5px">${l === 'B' && bankJetzt === 'candito' ? deEn('Advanced Bench bringt eigene Variationen mit.', 'Advanced Bench has its own variations.')
          : deEn(`Bei ${freq[l]}× pro Woche nur die Wettkampfübung.`, `At ${freq[l]}× per week only the competition lift.`)}</span>`
          : html`<div class="pl-chips">${variationen(l).map((k) => html`<button key=${k} aria-pressed=${String((varianten[l] ?? []).includes(k))} class=${(varianten[l] ?? []).includes(k) ? 'an' : ''} onClick=${() => umschalten(l, k)}>${nameVon(k, k)}</button>`)}</div>`}</div>`)}
    </section>` : null}

    ${schritt === 3 ? html`<section class="card pad stack"><div class="schritt-kopf"><span class="rechner-nr">3</span><span class="viz-t">Progression und Dauer</span></div>
      ${freq.B > 0 ? html`<span class="eyebrow">Bankdrücken</span>
        ${seg([['top', 'Top-Satz/Back-off'], ['candito', 'Advanced Bench']], bankJetzt, setBank, 'Bankdrücken', (v) => v === 'candito' && !canditoGeht)}
        ${bankJetzt === 'candito' ? html`<span class="muted" style="font-size:12.5px">${deEn(`Candito Advanced Bench: ${canditoTage} Bank-Tage pro Woche, AMRAP in der vorletzten Woche – daraus das neue Bank-Max.`, `Candito Advanced Bench: ${canditoTage} bench days per week, AMRAP in the second-to-last week – the new bench max comes from it.`)}</span>`
          : !canditoGeht ? html`<span class="muted" style="font-size:12.5px">Advanced Bench braucht mindestens 4 Wochen.</span>` : null}` : null}
      <span class="eyebrow">Wie viele Wochen</span>
      ${seg([4, 5, 6, 8, 10, 12].map((n) => [n, `${n} Wo.`]), wochen, setWochen, 'Wochen')}
      <span class="eyebrow">${deEn('Am Ende', 'At the end')}</span>
      ${seg([['test', 'Test'], ['deload', 'Deload'], ['keiner', deEn('Ohne', 'None')]], abschluss, setAbschluss, deEn('Abschluss', 'Finish'))}
      <span class="eyebrow">Trainingsmax</span>
      ${seg([[0.95, '95 % (Aufbau)'], [0.92, '92 % (Cut)'], [1, '100 %']], tm, setTm, 'Trainingsmax')}
      ${plan ? html`<div class="eigen-wochen">${plan.weeks.map((w) => html`<span key=${w.week} class=${`ew ${w.typ}`}>${w.title.replace(/^Woche \d+ – /, '')}</span>`)}</div>` : null}
      <span class="muted" style="font-size:12.5px">${deEn('Wochen wie im geprüften Block-Generator: Einstieg, Aufbau, Überlastung, Peak, danach Test oder Deload. Werte in % vom Trainingsmax, innerhalb der Pana-Grenzen.', 'Weeks as in the checked block generator: intro, build, overload, peak, then test or deload. Values in % of training max, within the Pana limits.')}</span>
      ${fehler ? html`<p class="fehler" style="margin:0">${fehler}</p>` : null}
      ${pana.length ? html`<p class="fehler" style="margin:0">${pana.join(' ')}</p>` : null}
    </section>` : null}

    <div class="row schritt-knoepfe">${schritt > 1 ? html`<button class="btn btn-soft" style="flex:1" onClick=${zurueckSchritt}>Zurück</button>` : null}
      ${schritt < 3 ? html`<button class="btn btn-chalk" style="flex:1.6" disabled=${keiner} onClick=${weiter}>Weiter</button>`
        : html`<button class="btn btn-chalk" style="flex:1.6" disabled=${!plan || pana.length > 0} onClick=${weiterZumPlan}>${deEn('Weiter zum Plan', 'Continue to plan')}</button>`}</div>
    ${schritt === 3 ? html`<span class="muted" style="font-size:12.5px;text-align:center">${deEn('Im Plan kannst du Tage und Übungen ergänzen und dann speichern.', 'In the plan you can add days and exercises, then save.')}</span>` : null}
  </div>`;
}
