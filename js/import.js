// PR Hunter · Programm-Import als CSV. Die KI-Anleitung (KI_ANLEITUNG) wird in der App kopiert, die KI liefert
// die CSV, leseProgrammCsv macht daraus eine Vorlage im Programmformat (siehe CLAUDE.md „Programmformat“).
// Unbekannte Übungen, Tage oder Lastangaben stoppen den Import mit Zeilennummer.
import { leseSaetze, leseWdh, leseRpe, leseFormel, formelNamen } from './programm.js';

export const SPALTEN = ['woche', 'tag', 'uebung', 'rolle', 'saetze', 'wdh', 'last', 'rpe', 'cut', 'notiz'];

export const KI_ANLEITUNG = `Wandle das Trainingsprogramm unten in eine CSV-Tabelle für die App „PR Hunter“ um.

Regeln:
- Trennzeichen Semikolon. Erste Zeile genau: woche;tag;uebung;rolle;saetze;wdh;last;rpe;cut;notiz
- Davor optional eine Zeile: # name: <Programmname>
- Eine Zeile je Satzgruppe mit gleicher Vorgabe. Andere Last oder Wdh-Zahl = eigene Zeile.
- woche: 1, 2, 3 … · tag: Mo, Di, Mi, Do, Fr, Sa oder So
- uebung: gängiger deutscher oder englischer Übungsname. Wettkampfübungen genau so: Wettkampf-Kniebeuge, Wettkampf-Bankdrücken, Wettkampf-Kreuzheben. Frei wählbare Zusatzübung: Platz: <Bezeichnung> (z. B. Platz: Zusatz Beine)
- rolle: top (schwerster Satz des Tages), backoff, test oder leer
- saetze: Zahl oder Bereich (3 oder 5-10) · wdh: Zahl, Bereich (8-12), AMRAP oder AMRAP10
- last: Prozent vom 1RM mit Kürzel S = Kniebeuge, B = Bankdrücken, D = Kreuzheben, G = Bank-Zielmax, z. B. 82,5%S oder 80%B+2,5. Feste Last als 100kg. Leer, wenn nach RPE gearbeitet wird.
- rpe: Ziel-RPE (8, 7-8, 7,5) oder RIR (2 RIR), sonst leer
- cut: ja, wenn die Gruppe im Cut-Modus einen Satz verlieren darf (Back-offs, Zubehör), sonst nein
- notiz: kurzer Hinweis ohne Semikolon
- Erfinde nichts. Was im Programm nicht steht, bleibt leer.
- Gib nur die CSV in einem Codeblock aus, ohne weitere Erklärung.

Beispiel:
# name: Beispielblock
woche;tag;uebung;rolle;saetze;wdh;last;rpe;cut;notiz
1;Mo;Wettkampf-Kniebeuge;top;1;3;84%S;7;nein;
1;Mo;Wettkampf-Kniebeuge;backoff;3;6;70%S;6-8;ja;
1;Mo;Enges Bankdrücken;;3;8;;9;ja;
1;Mo;Platz: Zusatz Beine;;3;8-12;;7;ja;
1;Mi;Wettkampf-Bankdrücken;;3;3;75%B;;nein;Pause auf der Brust

Hier ist das Programm:
`;

const TAGE = { mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6, so: 7, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
const ROLLEN = { top: 'top', 'top-satz': 'top', topsatz: 'top', backoff: 'backoff', 'back-off': 'backoff', test: 'test',
  zweit: 'secondary', zweiteinheit: 'secondary', secondary: 'secondary' };
const JA = new Set(['ja', 'j', 'yes', 'y', 'x', '1', 'true', 'wahr']);
const KOPF_ALIAS = { ubung: 'uebung', exercise: 'uebung', satze: 'saetze', sets: 'saetze', reps: 'wdh', wiederholungen: 'wdh',
  week: 'woche', day: 'tag', role: 'rolle', load: 'last', gewicht: 'last', note: 'notiz', notes: 'notiz' };

const normal = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/** Index aller Katalognamen (de, en, Aliase, Schlüssel) → Schlüssel. katalog: app/daten/katalog.json */
export function katalogIndex(katalog) {
  const index = new Map();
  for (const e of katalog) {
    for (const n of [e.k, e.de, e.en, ...(e.s ?? '').split(' | ')]) {
      const k = normal(n);
      if (k && !index.has(k)) index.set(k, e);
    }
  }
  return index;
}

function vorschlaege(name, katalog) {
  const woerter = normal(name).split(' ').filter((w) => w.length > 2);
  return katalog.map((e) => ({ e, treffer: woerter.filter((w) => normal(`${e.de} ${e.en}`).includes(w)).length }))
    .filter((x) => x.treffer > 0).sort((a, b) => b.treffer - a.treffer || a.e.de.length - b.e.de.length)
    .slice(0, 3).map((x) => x.e.de);
}

function zerlegeZeile(zeile, trenner) {
  const felder = []; let feld = '', inAnf = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (c === '"') { if (inAnf && zeile[i + 1] === '"') { feld += '"'; i++; } else inAnf = !inAnf; }
    else if (c === trenner && !inAnf) { felder.push(feld.trim()); feld = ''; }
    else feld += c;
  }
  felder.push(feld.trim());
  return felder;
}

export function leseLast(text) {
  const t = text.replace(/\s+/g, '').replace(/,/g, '.').toUpperCase();
  if (!t) return { load: null, variable: null };
  let m = t.match(/^(\d+(?:\.\d+)?)%([SBDG])(?:([+-])(\d+(?:\.\d+)?|INC))?$/);
  if (m) {
    const anteil = +(Number(m[1]) / 100).toFixed(5);
    const plus = m[3] ? `${m[3]}${m[4] === 'INC' ? 'inc' : Number(m[4])}` : '';
    return { load: `R(${m[2]}*${anteil})${plus}`, variable: m[2] };
  }
  m = t.match(/^(\d+(?:\.\d+)?)KG$/);
  if (m) return { load: String(Number(m[1])), variable: null };
  return { fehler: `Last „${text}“ nicht lesbar (erlaubt: 82,5%S, 80%B+2,5, 100kg oder leer)` };
}

export function leseRpeFeld(text) {
  const t = text.trim().replace(/,/g, '.');
  if (!t) return { rpe: null };
  const roh = /rir/i.test(t) ? t.toUpperCase().replace('RIR', ' RIR').replace(/\s+/g, ' ').trim() : `RPE ${t.replace(/^rpe\s*/i, '')}`;
  const r = leseRpe(roh);
  return r?.text ? { fehler: `RPE „${text}“ nicht lesbar (z. B. 8, 7-8, 7,5 oder 2 RIR)` } : { rpe: roh };
}

/**
 * CSV → { programm, fehler: [Text mit Zeilennummer], zeilen }. Bei Fehlern ist programm null.
 * katalog: Liste aus app/daten/katalog.json.
 */
export function leseProgrammCsv(text, katalog) {
  const fehler = [];
  const zeilen = String(text).replace(/^﻿/, '').split(/\r?\n/);
  let name = 'Importiertes Programm';
  let kopf = null, trenner = ';';
  const index = katalogIndex(katalog);
  const wochen = new Map(), variablen = new Set();
  let gelesen = 0;
  zeilen.forEach((roh, i) => {
    const nr = i + 1, zeile = roh.trim();
    if (!zeile || zeile.startsWith('```')) return;
    if (zeile.startsWith('#')) { const m = zeile.match(/^#\s*name\s*:\s*(.+)$/i); if (m) name = m[1].trim(); return; }
    if (!kopf) {
      trenner = [';', '\t', ','].sort((a, b) => zeile.split(b).length - zeile.split(a).length)[0];
      kopf = zerlegeZeile(zeile, trenner).map(normal).map((s) => s.replace(/ /g, '')).map((s) => KOPF_ALIAS[s] ?? s);
      const fehlt = ['woche', 'tag', 'uebung', 'saetze', 'wdh'].filter((s) => !kopf.includes(s));
      if (fehlt.length) fehler.push(`Zeile ${nr}: Kopfzeile ohne ${fehlt.join(', ')} (erwartet: ${SPALTEN.join(';')})`);
      return;
    }
    const werte = zerlegeZeile(zeile, trenner);
    const f = Object.fromEntries(kopf.map((k, j) => [k, werte[j] ?? '']));
    const zfehler = (t) => fehler.push(`Zeile ${nr}: ${t}`);
    const woche = Number(f.woche);
    if (!Number.isInteger(woche) || woche < 1) { zfehler(`Woche „${f.woche}“ ist keine Zahl ab 1`); return; }
    const tag = TAGE[normal(f.tag).slice(0, 3)] ?? TAGE[normal(f.tag).slice(0, 2)] ?? (/^[1-7]$/.test(f.tag) ? Number(f.tag) : null);
    if (!tag) { zfehler(`Tag „${f.tag}“ unbekannt (Mo … So)`); return; }
    const platz = f.uebung.match(/^platz\s*:\s*(.+)$/i);
    const eintrag = platz ? null : index.get(normal(f.uebung));
    if (!platz && !eintrag) {
      const v = vorschlaege(f.uebung, katalog);
      zfehler(`Übung „${f.uebung}“ nicht im Katalog${v.length ? ` – meintest du ${v.map((x) => `„${x}“`).join(', ')}?` : ''}`);
      return;
    }
    const rolle = f.rolle ? ROLLEN[normal(f.rolle).replace(/ /g, '-')] : null;
    if (f.rolle && !rolle) { zfehler(`Rolle „${f.rolle}“ unbekannt (top, backoff, test oder leer)`); return; }
    const saetze = String(f.saetze).trim();
    if (!leseSaetze(saetze) || leseSaetze(saetze).text) { zfehler(`Sätze „${f.saetze}“ nicht lesbar`); return; }
    const amrap = String(f.wdh).trim().match(/^amrap\s*(\d+)?$/i);
    const wdh = amrap ? `MR${amrap[1] ?? ''}` : String(f.wdh).trim();
    if (!leseWdh(wdh) || leseWdh(wdh).text) { zfehler(`Wdh „${f.wdh}“ nicht lesbar`); return; }
    const last = leseLast(f.last ?? '');
    if (last.fehler) { zfehler(last.fehler); return; }
    if (last.load) { try { leseFormel(last.load); } catch (e) { zfehler(e.message); return; } }
    const rpe = leseRpeFeld(f.rpe ?? '');
    if (rpe.fehler) { zfehler(rpe.fehler); return; }
    if (last.variable) variablen.add(last.variable);

    if (!wochen.has(woche)) wochen.set(woche, new Map());
    const offset = (woche - 1) * 7 + (tag - 1);
    const tage = wochen.get(woche);
    if (!tage.has(offset)) tage.set(offset, { offset, items: [], notes: [] });
    const items = tage.get(offset).items;
    const gruppe = { sets: saetze, reps: wdh, load: last.load };
    if (rpe.rpe) gruppe.rpe = rpe.rpe;
    if (f.notiz) gruppe.note = f.notiz;
    if (JA.has(normal(f.cut ?? ''))) gruppe.cut_reduce = true;
    const schluessel = `${platz ? `platz:${platz[1]}` : eintrag.k}|${rolle ?? ''}`;
    const letztes = items.at(-1);
    if (letztes && letztes._schluessel === schluessel) letztes.groups.push(gruppe);
    else items.push({ _schluessel: schluessel, exercise: platz ? platz[1].trim() : eintrag.de,
      ...(platz ? { slot: { label: platz[1].trim(), families: [] } } : { exercise_key: eintrag.k }),
      ...(rolle ? { role: rolle } : {}), groups: [gruppe] });
    gelesen += 1;
  });
  if (!kopf) fehler.push('Keine Kopfzeile gefunden.');
  else if (!gelesen && !fehler.length) fehler.push('Keine Datenzeilen gefunden.');
  if (fehler.length) return { programm: null, fehler, zeilen: gelesen };
  const reihenfolge = ['S', 'D', 'B', 'G'];
  const programm = {
    id: normal(name).replace(/ /g, '-') || 'import', name, source: 'Import (CSV)',
    inputs: reihenfolge.filter((v) => variablen.has(v)),
    weeks: [...wochen.entries()].sort((a, b) => a[0] - b[0]).map(([w, tage]) => ({
      week: w, title: `Woche ${w}`,
      days: [...tage.values()].sort((a, b) => a.offset - b.offset).map((d) => ({
        ...d, items: d.items.map(({ _schluessel, ...rest }) => rest) })),
    })),
    rules: {},
  };
  return { programm, fehler: [], zeilen: gelesen };
}

// #################################################################
// JSON (App-Format, z. B. von Claude geschrieben oder aus „Als JSON kopieren“) und Formel ↔ Eingabetext
// #################################################################
const zahlText = (n) => String(Math.round(n * 1000) / 1000).replace('.', ',');

/** Formel → Eingabetext wie in der CSV („84%S“, „80%B+2,5“, „100kg“); komplexere Formeln bleiben, wie sie sind. */
export function lastText(load) {
  if (load == null || load === '') return '';
  const s = String(load).replace(/\s+/g, '');
  // auch Produkte wie R(S*0.95*0.84) (Generator: Trainingsmax × Prozent) → 79,8%S
  let m = s.match(/^R\(\(?([SBDG])((?:\*\d+(?:\.\d+)?)+)\)?\)([+-](?:\d+(?:\.\d+)?|inc))?$/);
  if (m) return `${zahlText(m[2].split('*').slice(1).reduce((a, x) => a * Number(x), 100))}%${m[1]}${m[3] ? m[3].replace('.', ',') : ''}`;
  if (/^\d+(?:\.\d+)?$/.test(s)) return `${zahlText(Number(s))}kg`;
  return s;
}

/** Eingabetext → Formel: „84%S“, „80%B+2,5“, „100kg“, leer oder eine gültige Formel (R(S*0.95*0.84), v3: R(TS*0.8)). */
export function textZuLast(text, namen = []) {
  const r = leseLast(text);
  if (!r.fehler) return { load: r.load };
  try { leseFormel(text.trim(), namen); return { load: text.trim() }; } catch { return { fehler: r.fehler }; }
}

// Maxe hinter den Formelnamen: TS/TD (Trainingsmax aus Kniebeuge/Kreuzheben) brauchen S bzw. D
const MAX_VON = { TS: 'S', TD: 'D' };

/**
 * Programm im JSON-Format prüfen. Rückgabe { programm, fehler }: programm ist normalisiert (inputs aus den Formeln,
 * Zahlen als Text), bei Fehlern null. katalog: Liste aus app/daten/katalog.json.
 */
export function pruefeProgrammJson(text, katalog) {
  const fehler = [];
  let roh;
  try { roh = typeof text === 'string' ? JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')) : text; }
  catch (e) { return { programm: null, fehler: [`Kein gültiges JSON: ${e.message}`] }; }
  if (!roh || !Array.isArray(roh.weeks) || !roh.weeks.length) return { programm: null, fehler: ['„weeks“ fehlt oder ist leer.'] };
  const keys = new Set(katalog.map((e) => e.k));
  const variablen = new Set();
  const namen = formelNamen(roh);
  const weeks = roh.weeks.map((w, wi) => {
    const wort = `Woche ${w.week ?? wi + 1}`;
    // Eine Woche ohne Tage nur mit Hinweisen (Candito 6 Week: „Woche 6 – drei Optionen“)
    if ((!Array.isArray(w.days) || !w.days.length) && !w.notes?.length) fehler.push(`${wort}: keine Tage.`);
    return { ...w, week: Number(w.week ?? wi + 1), days: (w.days ?? []).map((d, di) => {
      const tw = `${wort}, Tag ${di + 1}`;
      if (!Number.isInteger(Number(d.offset)) || Number(d.offset) < 0) fehler.push(`${tw}: „offset“ (Tage ab Blockstart) fehlt.`);
      return { ...d, offset: Number(d.offset), items: (d.items ?? []).map((it, ii) => {
        const iw = `${tw}, Übung ${ii + 1}`;
        if (it.exercise_key && !keys.has(it.exercise_key)) fehler.push(`${iw}: unbekannter Schlüssel „${it.exercise_key}“.`);
        if (!it.exercise_key && !it.slot?.label) fehler.push(`${iw}: weder „exercise_key“ noch „slot.label“.`);
        // Freie Zusatzplätze (slot) dürfen ohne Vorgabe sein (Candito 6 Week: „Optional 1/2“)
        if ((!Array.isArray(it.groups) || !it.groups.length) && !it.slot) fehler.push(`${iw}: keine Satzgruppen („groups“).`);
        return { ...it, groups: (it.groups ?? []).map((g, gi) => {
          for (const feld of ['load', 'load_hi']) {
            if (g[feld] == null || g[feld] === '') continue;
            try { leseFormel(String(g[feld]), namen); for (const v of String(g[feld]).match(/\b(?:[SBDG]|TS|TD)\b/g) ?? []) variablen.add(MAX_VON[v] ?? v); }
            catch (e) { fehler.push(`${iw}, Gruppe ${gi + 1}: ${e.message}`); }
          }
          if (g.sets == null || g.reps == null) fehler.push(`${iw}, Gruppe ${gi + 1}: „sets“ und „reps“ nötig.`);
          return { ...g, sets: g.sets == null ? g.sets : String(g.sets), reps: g.reps == null ? g.reps : String(g.reps) };
        }) };
      }) };
    }) };
  });
  if (fehler.length) return { programm: null, fehler };
  const reihenfolge = ['S', 'B', 'D', 'G'];
  return { programm: { ...roh, name: roh.name || 'Importiertes Programm', weeks,
    inputs: roh.inputs?.length ? roh.inputs : reihenfolge.filter((v) => variablen.has(v)) }, fehler: [] };
}
