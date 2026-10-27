// PR Hunter · Gemeinsame Planbausteine für Programme, Generator, Editor, Heute und Verlauf:
// Beschreibungen der Vorlagen, Startmaxe, Plantage eines Blocks, Wochentitel, Darstellung eines Plantags.
import { html, nameVon, liftVon, LIFT, datumKurz, rpeText, incStandard, gw, einheit } from './basis.js';
import { planeBlock } from '../js/programm.js';
import { programmText } from './programmtexte.js';
import { mround } from '../js/rechnen.js';
import { DEMO, E1RM_AKTUELL } from './stand.js';
import { HAUPT } from '../js/daten.js';

const INFO_BASIS = {
  pr_hybrid_candito_pana: { kurz: 'Candito/Pana-Hybrid', text: 'v3: Bankdrücken und Zubehör exakt nach Candito Advanced Bench. Kniebeuge und Kreuzheben als Top-Satz mit Back-offs vom Trainingsmax (95 %, Cut 92 %), Pause-Kniebeuge am zweiten Tag, Test in Woche 5.', tags: ['Top-Satz/Back-off', 'Bank-Fokus', 'Cut-Modus', 'v3'] },
  candito_int_adv_bench: { kurz: 'Candito Advanced Bench', text: 'Candito-Block mit Bankdrücken-Spezialisierung auf ein Wunsch-Max. Woche 6 wahlweise als Deload oder Taper mit Testtag.', tags: ['Bank-Spezialisierung', 'AMRAP', 'Taper'] },
  candito_6_week: { kurz: 'Candito 6 Week', text: 'Das Original: Hypertrophie, Kraftausdauer, Maximalkraft, schwere Gewöhnung, Test in Woche 5.', tags: ['Klassiker', 'AMRAP', 'Test'] },
};
/** Namen eigener Programme (Schlüssel prog:<id>), von app.js gefüllt. */
export const NAMEN = {};
/** Beschreibung einer Vorlage; eigene Programme (Import, Generator, Kopie) bekommen eine einfache. */
export const INFO = new Proxy(INFO_BASIS, {
  get: (ziel, datei) => ziel[datei] ?? { kurz: NAMEN[datei] ?? String(datei).replace(/^(import|prog):/, ''), text: 'Eigenes Programm (Import, Generator oder bearbeitete Kopie).', tags: ['Eigenes'], importiert: true },
});
export const BEISPIEL_MAXE = { S: 205, D: 210, B: 155, G: 158 };
/** Parameter des Hybrid v3 (programme/BERECHNUNG_HYBRID_V3.md): Beschriftung und Erklärung im Editor. */
export const PARAMETER = {
  TM_BULK: ['Trainingsmax Aufbau', 'Anteil vom 1RM'], TM_CUT: ['Trainingsmax Cut', 'Anteil vom 1RM im Cut-Modus'],
  VF: ['Faktor Pause-Kniebeuge', 'auf die Prozent der Variante'], TEST: ['Testgewicht Woche 5', 'vom echten 1RM'],
  TEST_BO: ['Back-off nach dem Test', 'vom echten 1RM'], DPDL: ['Defizit-Kreuzheben', 'Anteil vom Kreuzheben-1RM'],
  BAR: ['Stange', 'kg, für Scheiben pro Seite'], CUT_BACKOFF: ['Cut: Back-offs', 'Sätze weniger'],
  CUT_ACCESSORY: ['Cut: Zubehör', 'Sätze weniger'], CUT_BENCH_VARIATIONS: ['Cut auch für Bank-Varianten', 'Close Grip, Incline, Pins'],
};
export const MAX_NAME = { S: 'Kniebeuge', B: 'Bankdrücken', D: 'Kreuzheben', G: 'Bank-Ziel' };

/** Startwerte für einen neuen Block: aktuelle Form aus dem Verlauf (auf 2,5 kg), Bank-Ziel +5 kg; sonst Beispielwerte. */
export function startMaxe() {
  if (DEMO) return BEISPIEL_MAXE;
  const w = (lift) => (E1RM_AKTUELL[HAUPT[lift]] ? mround(E1RM_AKTUELL[HAUPT[lift]], 2.5) : null);
  const B = w('bench');
  return { S: w('squat'), B, D: w('dead'), G: B ? B + 5 : null };
}

export function kurzTitel(titel = '') {
  const t = titel.toLowerCase();
  return t.includes('deload') ? 'Deload' : t.includes('taper') ? 'Taper' : t.includes('conditioning') ? 'Kraftausdauer'
    : t.includes('hypertrophy') ? 'Hypertrophie' : t.includes('max ot') ? 'Max OT' : t.includes('acclimation') ? 'Schwere Gewöhnung'
    : t.includes('high intensity') ? 'Intensität & Test' : t.includes('test') ? 'Test' : titel.replace(/^Woche \d+ – /, '');
}

/** Tage des Blocks; bei einer Alternativwoche (alternative_to) gilt die gewählte Variante. */
export function blockTage(prog, { start, werte, cut = false, alternativ = false, inc = incStandard() }) {
  const tage = planeBlock(prog, { start, werte, cut, inc });
  const alt = prog.weeks.find((w) => w.alternative_to);
  if (!alt) return tage;
  return tage.filter((t) => alternativ ? t.woche !== alt.alternative_to : t.woche !== alt.week);
}
export const wochenListe = (tage) => [...new Set(tage.map((t) => t.woche))];

function zeile(u, g) {
  const s = programmText(g.saetze?.text) ?? (g.saetze?.min === g.saetze?.max ? g.saetze?.min : `${g.saetze?.min}–${g.saetze?.max}`);
  const w = g.wdh?.amrap ? 'max' : g.wdh?.text ?? (g.wdh?.plus ? `${g.wdh.min}+` : g.wdh?.min === g.wdh?.max ? g.wdh?.min : `${g.wdh?.min}–${g.wdh?.max}`);
  const last = g.kg != null ? `${gw(g.kg)}${g.kgBis ? `–${gw(g.kgBis)}` : ''} ${einheit()}` : rpeText(g.rpe) ?? 'frei';
  return [`${s} × ${w ?? '–'}`, last];
}

export function TagPlan({ tag }) {
  return html`<div class=${`tag-plan ${tag.uebersprungen ? 'weg' : ''}`}>
    <div class="row between"><b style="font-size:13px">${datumKurz(tag.datum)} · ${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${tag.datum}T00:00:00Z`).getUTCDay()]}${tag.verschoben ? ' · verschoben' : ''}${tag.uebersprungen ? ' · übersprungen' : ''}</b>
      <span class="row" style="gap:4px">${[...new Set(tag.uebungen.map((u) => liftVon(u.key)).filter((l) => l !== 'andere'))].map((l) => html`<i key=${l} class="dot" style=${`background:${LIFT[l].farbe}`}></i>`)}</span></div>
    ${tag.uebungen.filter((u) => u.gruppen.length).flatMap((u, i) => u.gruppen.map((g, j) => {
      const [sw, last] = zeile(u, g);
      return html`<div class="zeile" key=${`${i}-${j}`}><span>${j === 0 ? (u.key ? nameVon(u.key, u.name) : u.slot?.label ?? u.name) : ''} <span class="muted">${sw}</span></span><b>${last}</b></div>`;
    }))}
  </div>`;
}
