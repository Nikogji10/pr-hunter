// PR Hunter · Programmvorlagen lesen und einen Block planen.
// Format siehe CLAUDE.md „Programmformat (JSON)“. Lastformeln wie R(S*0.84)+inc werden ohne eval
// ausgewertet; erlaubt sind Zahlen, S D B G inc, R(), + − * / und Klammern. Vorlagen mit `params` (Hybrid v3)
// kennen dazu deren Schlüssel und die abgeleiteten Werte TM, TS = R(S·TM), TD = R(D·TM).

import { mround } from './rechnen.js';

const VARIABLEN = new Set(['S', 'D', 'B', 'G', 'inc']);

// #################################################################
// Lastformeln
// #################################################################

function zerlege(text) {
  const s = text.trim();
  const re = /\s*(\d+(?:\.\d+)?|[A-Za-z_]+|[()+\-*/])/y;
  const teile = [];
  while (re.lastIndex < s.length) {
    const m = re.exec(s);
    if (!m) throw new Error(`Formel nicht lesbar: „${text}“`);
    teile.push(m[1]);
  }
  return teile;
}

/** Namen, die die Formeln eines Programms zusätzlich verwenden dürfen: Zahlen-Parameter und TM/TS/TD. */
export function formelNamen(programm) {
  const p = programm?.params;
  if (!p) return [];
  return ['TM', 'TS', 'TD', ...Object.entries(p).filter(([, v]) => typeof v === 'number').map(([k]) => k)];
}

/**
 * Werte für die Lastformeln: Maxe, Zahlen-Parameter und abgeleitete Werte. Wie in der v3-Excel wird das
 * Trainingsmax zuerst gerundet (TS = R(S·TM)), danach rechnen die Formeln mit Prozent und runden erneut.
 */
export function ableiten(programm, werte, { cut = false, inc = 2.5 } = {}) {
  const p = programm?.params;
  if (!p) return werte;
  const zahlen = Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === 'number'));
  const TM = cut ? p.TM_CUT ?? p.TM_BULK : p.TM_BULK;
  return { ...zahlen, ...werte, TM, ...(werte.S != null && TM ? { TS: mround(werte.S * TM, inc) } : {}),
    ...(werte.D != null && TM ? { TD: mround(werte.D * TM, inc) } : {}) };
}

/** Formel in einen Baum übersetzen; wirft bei unbekannten Namen oder fehlerhafter Syntax. weitere: zusätzliche Namen. */
export function leseFormel(text, weitere = []) {
  const erlaubt = weitere.length ? new Set([...VARIABLEN, ...weitere]) : VARIABLEN;
  const t = zerlege(String(text));
  let i = 0;
  const sieh = () => t[i];
  const nimm = (erwartet) => {
    if (erwartet && t[i] !== erwartet) throw new Error(`„${erwartet}“ erwartet in „${text}“`);
    return t[i++];
  };
  const summe = () => {
    let links = produkt();
    while (sieh() === '+' || sieh() === '-') links = { op: nimm(), links, rechts: produkt() };
    return links;
  };
  const produkt = () => {
    let links = faktor();
    while (sieh() === '*' || sieh() === '/') links = { op: nimm(), links, rechts: faktor() };
    return links;
  };
  const faktor = () => {
    const x = nimm();
    if (x === undefined) throw new Error(`Formel endet unerwartet: „${text}“`);
    if (x === '-') return { op: 'neg', wert: faktor() };
    if (x === '(') { const innen = summe(); nimm(')'); return innen; }
    if (/^\d/.test(x)) return { zahl: Number(x) };
    if (x === 'R') { nimm('('); const innen = summe(); nimm(')'); return { op: 'R', wert: innen }; }
    if (erlaubt.has(x)) return { variable: x };
    throw new Error(`Unbekannter Name „${x}“ in „${text}“`);
  };
  const baum = summe();
  if (i < t.length) throw new Error(`Unerwartet „${t[i]}“ in „${text}“`);
  return baum;
}

/** Formel mit Maxen auswerten, z. B. rechneFormel('R(S*0.84)', { S: 200 }) → 167.5. */
export function rechneFormel(text, werte, inc = 2.5) {
  const env = { ...werte, inc };
  const rechne = (k) => {
    if ('zahl' in k) return k.zahl;
    if ('variable' in k) {
      const v = env[k.variable];
      if (v == null) throw new Error(`Wert für ${k.variable} fehlt`);
      return v;
    }
    switch (k.op) {
      case 'neg': return -rechne(k.wert);
      case 'R': return mround(rechne(k.wert), inc);
      case '+': return rechne(k.links) + rechne(k.rechts);
      case '-': return rechne(k.links) - rechne(k.rechts);
      case '*': return rechne(k.links) * rechne(k.rechts);
      case '/': return rechne(k.links) / rechne(k.rechts);
    }
  };
  return rechne(leseFormel(text, Object.keys(werte)));
}

// #################################################################
// Satzangaben aus den Vorlagen
// #################################################################

const BEREICH = /^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/;

/** Sätze: 3 / "3" / "5-10" → { min, max }; Sonstiges (z. B. "PR Peak Set") → { text }. */
export function leseSaetze(wert) {
  if (wert == null || wert === '') return null;
  const m = String(wert).trim().match(BEREICH);
  return m ? { min: Number(m[1]), max: Number(m[2] ?? m[1]) } : { text: String(wert) };
}

/** Wdh: "8-12" → { min, max }; "MR" / "MR10" → { amrap: true, ziel }; "2+" → { min, max, plus }; Sonstiges → { text }. */
export function leseWdh(wert) {
  if (wert == null || wert === '') return null;
  const s = String(wert).trim();
  const mr = s.match(/^MR(\d+)?$/i);
  if (mr) return { amrap: true, ziel: mr[1] ? Number(mr[1]) : null };
  const plus = s.match(/^(\d+)\s*\+$/);                       // „2+“ (v3-Test): mindestens 2, mehr erlaubt
  if (plus) return { min: Number(plus[1]), max: Number(plus[1]), plus: true };
  const m = s.match(BEREICH);
  return m ? { min: Number(m[1]), max: Number(m[2] ?? m[1]) } : { text: s };
}

/** RPE: "RPE 7.5-8" → { min: 7.5, max: 8 }; "1-2 RIR" → { min: 8, max: 9 }; "-" → null. */
export function leseRpe(wert) {
  if (wert == null) return null;
  const s = String(wert).trim().replace(/^~\s*/, '');           // „~3 RIR“ (v3) = ungefähr 3 RIR
  if (s === '' || s === '-') return null;
  let m = s.match(/^RPE\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/i);
  if (m) {
    const r = { min: Number(m[1]), max: Number(m[2] ?? m[1]) };
    if (r.min >= 1 && r.max <= 10 && r.min <= r.max) return r;
  }
  m = s.match(/^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*RIR$/i);
  if (m) {
    const lo = Number(m[1]), hi = Number(m[2] ?? m[1]);
    if (hi <= 9) return { min: 10 - hi, max: 10 - lo };
  }
  return { text: s };
}

// #################################################################
// Projektion des neuen Max nach Woche 5 (rules.projection, Formeln aus den Original-Excels)
// #################################################################

/**
 * method 'factor': MROUND(Faktor × Gewicht, round_to)   (Candito 6 Week, Advanced Bench)
 * method 'divide': MROUND(Gewicht ÷ %1RM, round_to)     (Hybrid Fixed_3); dazu min_reps (darunter altes Max)
 *                  und max_increase je Lift (neues Max höchstens MROUND(altes Max × (1 + x), round_to)).
 * method 'rpe10_table': MROUND(Gewicht ÷ %1RM, inc)     (Hybrid v3); unter 2 Wdh altes Max, sonst
 *                  R(alt + (projiziert − alt) × Vertrauen), Vertrauen Standard confidence_default (1,0; 0,5 bei unsauberen Wdh).
 * Wdh außerhalb der Tabelle → null (Max von Hand prüfen).
 */
export function projiziere(regel, { kg, wdh, altesMax = null, lift = null, inc = 2.5, vertrauen = null }) {
  const wert = regel?.table?.[String(wdh)];
  if (kg == null || wert == null) return null;
  const stufe = regel.round_to == null || regel.round_to === 'inc' ? inc : regel.round_to;
  if (regel.method === 'rpe10_table') {
    const projiziert = mround(kg / wert, stufe);
    const v = vertrauen ?? regel.confidence_default ?? 1;
    const neuesMax = wdh < (regel.min_reps ?? 2) ? altesMax ?? projiziert
      : altesMax == null ? projiziert : mround(altesMax + (projiziert - altesMax) * v, stufe);
    return { projiziert, neuesMax };
  }
  const projiziert = regel.method === 'divide' ? mround(kg / wert, stufe) : mround(wert * kg, stufe);
  let neuesMax = projiziert;
  if (regel.min_reps && wdh < regel.min_reps) {
    neuesMax = altesMax ?? projiziert;
  } else if (regel.max_increase?.[lift] != null && altesMax != null) {
    neuesMax = Math.min(projiziert, mround(altesMax * (1 + regel.max_increase[lift]), stufe));
  }
  return { projiziert, neuesMax };
}

// #################################################################
// Pausen nach Satzart und Cut-Modus
// #################################################################

/** Standardpausen in Sekunden, global in den Einstellungen änderbar. */
export const STANDARD_PAUSEN = { top: 240, backoff: 180, isolation: 90 };
const ISOLATIONS_FAMILIEN = new Set(['leg_iso', 'curl', 'triceps', 'shoulder_iso', 'fly', 'forearm', 'core', 'neck', 'shrug']);

/** Top-Satz und Test → top; Isolationsübung → isolation; alle übrigen Arbeitssätze → backoff. */
export function pausenArt(rolle, familie) {
  if (rolle === 'top' || rolle === 'test') return 'top';
  if (rolle !== 'backoff' && rolle !== 'secondary' && ISOLATIONS_FAMILIEN.has(familie)) return 'isolation';
  return 'backoff';
}

export const pauseFuer = (rolle, familie, pausen = STANDARD_PAUSEN) => pausen[pausenArt(rolle, familie)];

// Cut-Marken: cut_reduce (Hybrid Fixed_3, CSV-Import) oder cut = backoff | accessory | bench_variation (Hybrid v3)
const hatCutMarken = (programm) => programm.weeks.some((w) => w.days.some((d) => d.items.some((i) => i.groups.some((g) => 'cut_reduce' in g || 'cut' in g))));

/**
 * Wird diese Gruppe im Cut-Modus gekürzt? Vorlagen mit eigenen Markierungen (cut_reduce) behalten diese.
 * Sonst gilt dieselbe Regel wie im Hybrid: Back-offs, Varianten und Zubehör ja; Top-Sätze, Tests und
 * Hauptsätze der Wettkampfübungen nie.
 */
export function wirdGekuerzt(item, gruppe, mitMarken) {
  if (mitMarken) return !!gruppe.cut_reduce || !!gruppe.cut;
  if (item.role === 'top' || item.role === 'test') return false;
  if (item.role === 'backoff') return true;
  return !(item.exercise_key ?? '').startsWith('competition_');
}

// #################################################################
// Block planen
// #################################################################

function plusTage(isoDatum, tage) {
  const d = new Date(`${isoDatum}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/** Wie viele Sätze der Cut-Modus von einer Gruppe abzieht (v3: je nach Marke und Parameter). */
function cutAbzug(item, g, mitMarken, regel, params = {}) {
  if (!mitMarken) return wirdGekuerzt(item, g, false) ? regel.reduce_sets : 0;
  if (g.cut === 'backoff') return params.CUT_BACKOFF ?? regel.reduce_sets;
  if (g.cut === 'accessory') return params.CUT_ACCESSORY ?? regel.reduce_sets;
  if (g.cut === 'bench_variation') return params.CUT_BENCH_VARIATIONS === false ? 0 : params.CUT_ACCESSORY ?? regel.reduce_sets;
  return g.cut_reduce ? regel.reduce_sets : 0;
}

/** Rolle einer Gruppe: Back-off-Gruppen im Top-Satz-Eintrag (v3) sind Back-offs; „candito“ heißt nur „unverändert aus Candito“. */
const rolleVon = (item, g = {}) => (g.cut === 'backoff' ? 'backoff' : item.role === 'candito' ? null : item.role ?? null);

/**
 * Alle Trainingstage eines Programms mit Datum und berechneten Lasten.
 * werte: Maxe in kg, z. B. { S: 205, D: 210, B: 155, G: 158 }.
 * cut: Cut-Modus kürzt Gruppen (siehe wirdGekuerzt) um settings.cut_mode.reduce_sets (mind. min_sets).
 */
export function planeBlock(programm, { start, werte, inc = 2.5, cut = false }) {
  const fehlt = (programm.inputs ?? []).filter((v) => werte[v] == null);
  if (fehlt.length) throw new Error(`Maxe fehlen: ${fehlt.join(', ')}`);
  const cutRegel = { reduce_sets: 1, min_sets: 1, ...programm.settings?.cut_mode };
  const mitMarken = hatCutMarken(programm);
  const env = ableiten(programm, werte, { cut, inc });
  const tage = [];
  for (const woche of programm.weeks) {
    for (const tag of woche.days) {
      tage.push({
        woche: woche.week,
        wochenTitel: woche.title,
        offset: tag.offset,
        datum: start ? plusTage(start, tag.offset) : null,
        notizen: tag.notes ?? [],
        label: tag.label ?? null,
        uebungen: tag.items.map((item) => ({
          name: item.exercise,
          key: item.exercise_key ?? item.slot?.default_key ?? null,
          slot: item.slot ?? null,
          rolle: rolleVon(item),
          notizen: item.notes ?? [],
          gruppen: item.groups.map((g) => {
            const saetze = leseSaetze(g.sets);
            let gekuerzt = false;
            const abzug = cut && saetze?.min != null ? cutAbzug(item, g, mitMarken, cutRegel, programm.params) : 0;
            if (abzug > 0) {
              const neu = (n) => Math.max(cutRegel.min_sets, n - abzug);
              gekuerzt = neu(saetze.max) < saetze.max;
              saetze.min = neu(saetze.min);
              saetze.max = neu(saetze.max);
            }
            return {
              saetze,
              wdh: leseWdh(g.reps),
              rolle: rolleVon(item, g),
              kg: g.load ? rechneFormel(g.load, env, inc) : null,
              kgBis: g.load_hi ? rechneFormel(g.load_hi, env, inc) : null,
              rpe: leseRpe(g.rpe),
              notiz: g.note ?? null,
              gekuerzt,
            };
          }),
        })),
      });
    }
  }
  return tage;
}
