// PR Hunter · Programm-Import als CSV. Die KI-Anleitung (KI_ANLEITUNG) wird in der App kopiert, die KI liefert
// die CSV, leseProgrammCsv macht daraus eine Vorlage im Programmformat (siehe CLAUDE.md „Programmformat“).
// Unbekannte Übungen, Tage oder Lastangaben stoppen den Import mit Zeilennummer.
import { leseSaetze, leseWdh, leseRpe, leseFormel, formelNamen } from './programm.js';
import { plusTage } from './ausdauerplan.js';

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
- last: Prozent vom 1RM mit Kürzel S = Kniebeuge, B = Bankdrücken, D = Kreuzheben, G = Bank-Zielmax, z. B. 82,5%S oder 80%B+2,5. Feste Last als 100kg. Bereich als 112,5-120kg oder 75-80%B. Leer, wenn nach RPE gearbeitet wird.
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

// Wortvergleich für anders geschriebene Namen: Füllwörter weg, Plural/Varianten vereinheitlicht, Standardzusätze
// (konventionell, Langhantel, stehend, Wettkampf) zählen nicht – „Schrägbankdrücken mit Kurzhanteln“ = „Kurzhantel-Schrägbankdrücken“
const FUELL = new Set(['mit', 'with', 'der', 'die', 'das', 'den', 'dem', 'am', 'an', 'auf', 'im', 'und', 'and', 'the', 'a', 'von', 'zur', 'zum']);
const STANDARD = new Set(['konventionell', 'conventional', 'langhantel', 'barbell', 'stehend', 'standing', 'wettkampf', 'competition']);
const STAMM = { kurzhanteln: 'kurzhantel', langhanteln: 'langhantel', klimmzuge: 'klimmzug', zusatzgewicht: 'gewicht', paused: 'pause',
  pausen: 'pause', kniebeugen: 'kniebeuge', dumbbells: 'dumbbell', weighted: 'gewicht', 'pull-ups': 'pullup', pullups: 'pullup' };
const woerter = (s) => [...new Set(normal(s).split(' ').map((w) => STAMM[w] ?? w)
  .filter((w) => w && !FUELL.has(w) && !STANDARD.has(w) && !/^\d+ct$/.test(w)))].sort();

/** Index aller Katalognamen (de, en, Aliase, Schlüssel) → Schlüssel. katalog: app/daten/katalog.json */
export function katalogIndex(katalog) {
  const index = new Map(), wortIndex = new Map();
  for (const e of katalog) {
    for (const n of [e.k, e.de, e.en, ...(e.s ?? '').split(' | ')].filter(Boolean)) {
      const k = normal(n);
      if (k && !index.has(k)) index.set(k, e);
      const w = woerter(n);
      if (!w.length) continue;
      const alt = wortIndex.get(w.join(' '));
      if (!alt || (alt.k !== e.k && (e.de ?? '').length < (alt.de ?? '').length)) wortIndex.set(w.join(' '), e);   // bei Gleichstand die Grundform
    }
  }
  index.wortIndex = wortIndex;
  return index;
}

/** Übung zum Namen: genau, sonst gleiche Wortmenge, sonst eindeutig mit genau einem Zusatzwort („Low Pin Press“ → „Bench Press (Low Pin)“). */
export function findeUebung(name, index) {
  const genau = index.get(normal(name));
  if (genau) return genau;
  const w = woerter(name);
  if (!w.length) return null;
  const gleich = index.wortIndex.get(w.join(' '));
  if (gleich) return gleich;
  const kandidaten = new Map();
  for (const [schluessel, e] of index.wortIndex) {
    const ww = schluessel.split(' ');
    if (ww.length === w.length + 1 && w.every((x) => ww.includes(x))) kandidaten.set(e.k, e);
  }
  return kandidaten.size === 1 ? [...kandidaten.values()][0] : null;
}

function vorschlagListe(name, katalog, n = 3) {
  const woerter = normal(name).split(' ').filter((w) => w.length > 2);
  return katalog.map((e) => ({ e, treffer: woerter.filter((w) => normal(`${e.de} ${e.en}`).includes(w)).length }))
    .filter((x) => x.treffer > 0).sort((a, b) => b.treffer - a.treffer || a.e.de.length - b.e.de.length)
    .slice(0, n).map((x) => x.e);
}

/** Unbekannte Übungsnamen je Datei nur einmal (distinct): { schluessel (normalisiert), name, anzahl, vorschlaege: [Katalogschlüssel] } */
function sammler(katalog) {
  const liste = new Map();
  return {
    liste,
    merke: (name) => {
      const s = normal(name);
      if (liste.has(s)) liste.get(s).anzahl += 1;
      else liste.set(s, { schluessel: s, name, anzahl: 1, vorschlaege: vorschlagListe(name, katalog, 5).map((e) => e.k) });
    },
  };
}
/** Gemerkte Zuordnung (normalisierter Name → Katalogschlüssel) anwenden. */
const zugeordnet = (name, zuordnung, katalog) => { const k = zuordnung?.[normal(name)]; return k ? katalog.find((e) => e.k === k) ?? null : null; };
export const zuordnungsSchluessel = normal;

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
  m = t.match(/^(\d+(?:\.\d+)?)(?:KG)?-(\d+(?:\.\d+)?)KG$/);
  if (m) return { load: String(Number(m[1])), load_hi: String(Number(m[2])), variable: null };
  m = t.match(/^(\d+(?:\.\d+)?)%?-(\d+(?:\.\d+)?)%([SBDG])$/);
  if (m) return { load: `R(${m[3]}*${+(Number(m[1]) / 100).toFixed(5)})`, load_hi: `R(${m[3]}*${+(Number(m[2]) / 100).toFixed(5)})`, variable: m[3] };
  return { fehler: `Last „${text}“ nicht lesbar (erlaubt: 82,5%S, 80%B+2,5, 75-80%B, 100kg, 112,5-120kg oder leer)` };
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
export function leseProgrammCsv(text, katalog, zuordnung = {}) {
  const fehler = [];
  const unbekannt = sammler(katalog);
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
    // Zuordnung „platz“: unbekannte Übung als frei wählbaren Platz übernehmen
    const platz = f.uebung.match(/^platz\s*:\s*(.+)$/i) ?? (zuordnung?.[normal(f.uebung)] === 'platz' ? [f.uebung, f.uebung] : null);
    const eintrag = platz ? null : zugeordnet(f.uebung, zuordnung, katalog) ?? findeUebung(f.uebung, index);
    if (!platz && !eintrag) { unbekannt.merke(f.uebung); return; }   // wird im Zuordnungsfenster einmal je Name gewählt
    const rolle = f.rolle ? ROLLEN[normal(f.rolle).replace(/ /g, '-')] : null;
    if (f.rolle && !rolle) { zfehler(`Rolle „${f.rolle}“ unbekannt (top, backoff, test oder leer)`); return; }
    const saetze = String(f.saetze).trim();
    if (!leseSaetze(saetze) || leseSaetze(saetze).text) { zfehler(`Sätze „${f.saetze}“ nicht lesbar`); return; }
    const amrap = String(f.wdh).trim().match(/^amrap\s*(\d+)?$/i);
    const wdh = amrap ? `MR${amrap[1] ?? ''}` : String(f.wdh).trim();
    if (!leseWdh(wdh) || leseWdh(wdh).text) { zfehler(`Wdh „${f.wdh}“ nicht lesbar`); return; }
    const last = leseLast(f.last ?? '');
    if (last.fehler) { zfehler(last.fehler); return; }
    if (last.load) { try { leseFormel(last.load); if (last.load_hi) leseFormel(last.load_hi); } catch (e) { zfehler(e.message); return; } }
    const rpe = leseRpeFeld(f.rpe ?? '');
    if (rpe.fehler) { zfehler(rpe.fehler); return; }
    if (last.variable) variablen.add(last.variable);

    if (!wochen.has(woche)) wochen.set(woche, new Map());
    const offset = (woche - 1) * 7 + (tag - 1);
    const tage = wochen.get(woche);
    if (!tage.has(offset)) tage.set(offset, { offset, items: [], notes: [] });
    const items = tage.get(offset).items;
    const gruppe = { sets: saetze, reps: wdh, load: last.load, ...(last.load_hi ? { load_hi: last.load_hi } : {}) };
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
  const offen = [...unbekannt.liste.values()];
  if (!kopf) fehler.push('Keine Kopfzeile gefunden.');
  else if (!gelesen && !fehler.length && !offen.length) fehler.push('Keine Datenzeilen gefunden.');
  if (fehler.length || offen.length) return { programm: null, fehler, unbekannt: offen, zeilen: gelesen };
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
  return { programm, fehler: [], unbekannt: [], zeilen: gelesen };
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
export function pruefeProgrammJson(text, katalog, zuordnung = {}) {
  const fehler = [];
  let roh;
  try { roh = typeof text === 'string' ? JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')) : text; }
  catch (e) { return { programm: null, fehler: [`Kein gültiges JSON: ${e.message}`] }; }
  if (!roh || !Array.isArray(roh.weeks) || !roh.weeks.length) return { programm: null, fehler: ['„weeks“ fehlt oder ist leer.'] };
  const keys = new Set(katalog.map((e) => e.k));
  const unbekannt = sammler(katalog), index = katalogIndex(katalog);
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
        if (it.exercise_key && !keys.has(it.exercise_key)) {
          const name = it.exercise || it.exercise_key;
          const e = zugeordnet(name, zuordnung, katalog) ?? findeUebung(name, index) ?? findeUebung(String(it.exercise_key).replace(/_/g, ' '), index);
          if (zuordnung?.[normal(name)] === 'platz') { const { exercise_key: _weg, ...rest } = it; it = { ...rest, slot: { label: name, families: [] } }; }
          else if (e) it = { ...it, exercise_key: e.k }; else unbekannt.merke(name);
        }
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
  const offen = [...unbekannt.liste.values()];
  if (fehler.length || offen.length) return { programm: null, fehler, unbekannt: offen };
  const reihenfolge = ['S', 'B', 'D', 'G'];
  return { programm: { ...roh, name: roh.name || 'Importiertes Programm', weeks,
    inputs: roh.inputs?.length ? roh.inputs : reihenfolge.filter((v) => variablen.has(v)) }, fehler: [], unbekannt: [] };
}

// #################################################################
// 250: Cardio im KI-Import – eigener Abschnitt „# cardio“ mit eigener Kopfzeile; Kraft und Cardio in einer Antwort
// #################################################################
export const CARDIO_SPALTEN = ['woche', 'tag', 'sport', 'typ', 'umfang', 'ziel', 'wdh', 'pause', 'notiz'];

const CARDIO_REGELN = `Cardio-Teil (Laufen/Rad) als eigener Abschnitt:
- Zeile genau: # cardio, danach die Kopfzeile: woche;tag;sport;typ;umfang;ziel;wdh;pause;notiz
- Eine Zeile je Einheit. woche: 1, 2, 3 … · tag: Mo … So
- sport: Lauf oder Rad
- typ: locker, lang, tempo, intervalle, fahrtspiel oder wettkampf
- umfang: Strecke oder Dauer, z. B. 8km, 45min, 1,5h. Bei Intervallen die Länge EINER Wiederholung (1000m, 4min).
- ziel: Tempo als 5:30-6:00/km (oder 5:45/km), Leistung als 200-230W, sonst leer
- wdh: Anzahl Wiederholungen bei Intervallen, sonst leer · pause: Pause zwischen den Wiederholungen (90s, 2min), sonst leer
- notiz: kurzer Hinweis ohne Semikolon`;

export const CARDIO_BEISPIEL = `# cardio
woche;tag;sport;typ;umfang;ziel;wdh;pause;notiz
1;Di;Lauf;locker;8km;6:00-6:30/km;;;
1;Do;Lauf;intervalle;1000m;4:50-5:00/km;5;2min;
1;Sa;Rad;lang;120min;150-190W;;;`;

const KI_ENDE = `- Erfinde nichts. Was im Programm nicht steht, bleibt leer.
- Gib nur die CSV in einem Codeblock aus, ohne weitere Erklärung.`;

/** KI-Anleitung je nach Inhalt: nur Kraft (bisherige Anleitung), nur Cardio oder beides in einer Antwort. */
export function kiAnleitung({ kraft = true, cardio = false } = {}) {
  if (!cardio) return KI_ANLEITUNG;
  if (!kraft) return `Wandle den Ausdauer-Trainingsplan unten (Laufen und/oder Radfahren) in eine CSV-Tabelle für die App „PR Hunter“ um.

Regeln:
- Trennzeichen Semikolon. Davor optional eine Zeile: # name: <Planname>
${CARDIO_REGELN.split('\n').slice(1).join('\n')}
${KI_ENDE}

Beispiel:
# name: Halbmarathon 10 Wochen
${CARDIO_BEISPIEL}

Hier ist der Plan:
`;
  const kraftTeil = KI_ANLEITUNG.split('\nBeispiel:')[0].replace(/\n- Erfinde nichts[\s\S]*$/, '').replace('Wandle das Trainingsprogramm unten', 'Wandle das Trainingsprogramm unten (Kraft und Cardio)');
  const kraftBeispiel = KI_ANLEITUNG.split('\nBeispiel:\n')[1].split('\n\nHier ist das Programm:')[0];
  return `${kraftTeil.trimEnd()}

${CARDIO_REGELN}
${KI_ENDE}

Beispiel:
${kraftBeispiel}

${CARDIO_BEISPIEL}

Hier ist das Programm:
`;
}

const SPORT_NAME = { lauf: 'lauf', laufen: 'lauf', run: 'lauf', running: 'lauf', jogging: 'lauf', rad: 'rad', radfahren: 'rad', fahrrad: 'rad', rennrad: 'rad', bike: 'rad', ride: 'rad', cycling: 'rad' };
const CARDIO_TYP = { locker: 'locker', easy: 'locker', grundlage: 'locker', lang: 'lang', long: 'lang', tempo: 'tempo', schwelle: 'tempo', threshold: 'tempo',
  intervalle: 'intervalle', intervall: 'intervalle', intervals: 'intervalle', interval: 'intervalle', fahrtspiel: 'fahrtspiel', fartlek: 'fahrtspiel',
  wettkampf: 'wettkampf', rennen: 'wettkampf', race: 'wettkampf' };
const ZONE_VON = { locker: 'locker', lang: 'lang', tempo: 'tempo', intervalle: 'intervall', fahrtspiel: 'locker', wettkampf: 'intervall' };
const ZONE_RAD = { locker: 'locker', lang: 'locker', tempo: 'schwelle', intervalle: 'vo2', fahrtspiel: 'locker', wettkampf: 'schwelle' };
const zahl = (s) => Number(String(s).replace(',', '.'));
const runde5 = (x) => Math.round(x * 2) / 2;

function leseUmfang(t) {
  const m = String(t).trim().toLowerCase().replace(/\s+/g, '').match(/^(\d+(?:[.,]\d+)?)(km|m|min|h|std)$/);
  if (!m) return null;
  const v = zahl(m[1]);
  return m[2] === 'km' ? { km: v } : m[2] === 'm' ? { m: v } : { min: m[2] === 'min' ? v : v * 60 };
}
function leseZiel(t, sport) {
  const s = String(t).trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return { ziel: null };
  let m = s.match(/^(\d{1,2}):(\d{2})(?:-(\d{1,2}):(\d{2}))?(?:\/km|min\/km)?$/);
  if (m && sport === 'lauf') { const a = +m[1] * 60 + +m[2], b = m[3] ? +m[3] * 60 + +m[4] : a; return { ziel: [Math.min(a, b), Math.max(a, b)] }; }
  m = s.match(/^(\d+)(?:-(\d+))?w(att)?$/);
  if (m && sport === 'rad') { const a = +m[1], b = m[2] ? +m[2] : a; return { ziel: [Math.min(a, b), Math.max(a, b)] }; }
  return { fehler: sport === 'lauf' ? `Ziel „${t}“ nicht lesbar (Tempo wie 5:30-6:00/km oder leer)` : `Ziel „${t}“ nicht lesbar (Leistung wie 200-230W oder leer)` };
}
function lesePause(t) {
  const s = String(t).trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  const m = s.match(/^(\d+(?:[.,]\d+)?)(s|sek|sec|min|m)?$/);
  if (!m) return NaN;
  return m[2] && m[2].startsWith('m') ? zahl(m[1]) * 60 : m[2] ? zahl(m[1]) : zahl(m[1]) * 60;    // ohne Einheit: Minuten
}

/** Cardio-Zeilen → { einheiten, fehler, unbekannt: [] }. Einheiten ohne Datum (woche, wt); das Datum kommt mit dem Start. */
export function leseCardioCsv(text, { zeileAb = 0 } = {}) {
  const fehler = [], einheiten = [];
  let kopf = null, trenner = ';', name = null;
  String(text).replace(/^﻿/, '').split(/\r?\n/).forEach((roh, i) => {
    const nr = zeileAb + i + 1, zeile = roh.trim();
    if (!zeile || zeile.startsWith('```')) return;
    if (zeile.startsWith('#')) { const m = zeile.match(/^#\s*name\s*:\s*(.+)$/i); if (m) name = m[1].trim(); return; }
    if (!kopf) {
      trenner = [';', '\t', ','].sort((a, b) => zeile.split(b).length - zeile.split(a).length)[0];
      kopf = zerlegeZeile(zeile, trenner).map(normal).map((s) => s.replace(/ /g, '')).map((s) => ({ week: 'woche', day: 'tag', type: 'typ', distance: 'umfang', dauer: 'umfang', target: 'ziel', reps: 'wdh', rest: 'pause', note: 'notiz' }[s] ?? s));
      const fehlt = ['woche', 'tag', 'sport', 'typ', 'umfang'].filter((s) => !kopf.includes(s));
      if (fehlt.length) fehler.push(`Zeile ${nr}: Cardio-Kopfzeile ohne ${fehlt.join(', ')} (erwartet: ${CARDIO_SPALTEN.join(';')})`);
      return;
    }
    const werte = zerlegeZeile(zeile, trenner), f = Object.fromEntries(kopf.map((k, j) => [k, werte[j] ?? '']));
    const zf = (t) => fehler.push(`Zeile ${nr}: ${t}`);
    const woche = Number(f.woche);
    if (!Number.isInteger(woche) || woche < 1) { zf(`Woche „${f.woche}“ ist keine Zahl ab 1`); return; }
    const tag = TAGE[normal(f.tag).slice(0, 3)] ?? TAGE[normal(f.tag).slice(0, 2)] ?? (/^[1-7]$/.test(f.tag) ? Number(f.tag) : null);
    if (!tag) { zf(`Tag „${f.tag}“ unbekannt (Mo … So)`); return; }
    const sport = SPORT_NAME[normal(f.sport).replace(/ /g, '')];
    if (!sport) { zf(`Sport „${f.sport}“ unbekannt (Lauf oder Rad)`); return; }
    const typ = CARDIO_TYP[normal(f.typ).replace(/ /g, '')];
    if (!typ) { zf(`Typ „${f.typ}“ unbekannt (locker, lang, tempo, intervalle, fahrtspiel, wettkampf)`); return; }
    const u = leseUmfang(f.umfang);
    if (!u) { zf(`Umfang „${f.umfang}“ nicht lesbar (z. B. 8km, 1000m, 45min, 1,5h)`); return; }
    const z = leseZiel(f.ziel ?? '', sport);
    if (z.fehler) { zf(z.fehler); return; }
    const wdh = String(f.wdh ?? '').trim() ? Number(f.wdh) : null;
    if (wdh != null && (!Number.isInteger(wdh) || wdh < 1)) { zf(`Wdh „${f.wdh}“ ist keine Zahl`); return; }
    const pause = lesePause(f.pause ?? '');
    if (Number.isNaN(pause)) { zf(`Pause „${f.pause}“ nicht lesbar (90s, 2min)`); return; }
    const e = { woche, wt: tag - 1, sport, typ, zone: (sport === 'rad' ? ZONE_RAD : ZONE_VON)[typ], ...(z.ziel ? { zielBereich: z.ziel } : {}), ...(f.notiz ? { notiz: f.notiz } : {}) };
    const n = wdh ?? (typ === 'intervalle' ? 1 : null);
    if (n && n > 1) {
      const strecke = u.km != null ? u.km * 1000 : u.m;
      if (strecke != null && sport === 'lauf') Object.assign(e, { wdh: n, strecke, pause: pause ?? 120, gesamtKm: runde5((n * strecke) / 1000 + 3) });
      else if (u.min != null) Object.assign(e, { wdh: n, dauer: u.min, pause: sport === 'rad' ? Math.round((pause ?? 300) / 60) : Math.round((pause ?? 180) / 60), min: Math.round(n * (u.min + (pause ?? 180) / 60) + 20) });
      else { zf('Rad-Intervalle bitte mit Dauer je Wiederholung (z. B. 4min)'); return; }
    } else if (u.km != null || u.m != null) e.km = u.km ?? u.m / 1000;
    else e.min = Math.round(u.min);
    einheiten.push(e);
  });
  if (!kopf) fehler.push('Keine Cardio-Kopfzeile gefunden (woche;tag;sport;typ;umfang;ziel;wdh;pause;notiz).');
  else if (!einheiten.length && !fehler.length) fehler.push('Keine Cardio-Zeilen gefunden.');
  return { einheiten: fehler.length ? [] : einheiten, fehler, name };
}

/**
 * Import mit Inhaltswahl: { kraft: 'powerlifting'|'bodybuilding'|'eigen'|null, cardio: bool }. Mit beidem wird am
 * „# cardio“-Abschnitt (oder an der Cardio-Kopfzeile) geteilt. Rückgabe wie leseProgrammCsv plus cardio.
 */
export function leseImport(text, katalog, zuordnung = {}, { kraft = 'powerlifting', cardio = false } = {}) {
  const zeilen = String(text).replace(/^﻿/, '').split(/\r?\n/);
  let teil = -1;
  if (cardio) {
    teil = zeilen.findIndex((z) => /^#\s*cardio\b/i.test(z.trim()));
    if (teil < 0) teil = zeilen.findIndex((z) => /^woche\s*[;,\t]\s*tag\s*[;,\t]\s*sport/i.test(z.trim()));
  }
  const name = zeilen.map((z) => z.trim().match(/^#\s*name\s*:\s*(.+)$/i)?.[1]).find(Boolean) ?? null;
  const aus = { programm: null, cardio: null, fehler: [], unbekannt: [], zeilen: 0 };
  if (kraft) {
    if (cardio && teil < 0) return { ...aus, fehler: ['Cardio-Abschnitt fehlt: Zeile „# cardio“ und darunter woche;tag;sport;typ;umfang;ziel;wdh;pause;notiz.'] };
    const k = leseProgrammCsv(cardio ? zeilen.slice(0, teil).join('\n') : text, katalog, zuordnung);
    Object.assign(aus, { programm: k.programm ? { ...k.programm, kategorie: kraft } : null, fehler: [...k.fehler], unbekannt: k.unbekannt, zeilen: k.zeilen });
  }
  if (cardio) {
    const c = leseCardioCsv(kraft ? zeilen.slice(teil).join('\n') : text, { zeileAb: kraft ? teil : 0 });
    aus.fehler.push(...c.fehler);
    if (!c.fehler.length) aus.cardio = { name: c.name ?? name ?? 'Importierter Cardio-Plan', einheiten: c.einheiten };
    if (kraft) aus.programm = aus.fehler.length ? null : aus.programm;
  }
  return aus;
}

/** Importierte Cardio-Einheiten ab start (Montag) als Cardio-Plan (gleiches Format wie erzeugePlan). */
export function cardioPlanAus(cardio, start) {
  const einheiten = cardio.einheiten.map((e, i) => {
    const { wt, ...rest } = e, datum = plusTage(start, (e.woche - 1) * 7 + wt);
    return { ...rest, id: `imp-${datum}-${i}`, datum };
  }).sort((a, b) => a.datum.localeCompare(b.datum));
  const zahl = (s) => einheiten.filter((e) => e.sport === s).length;
  const sport = zahl('rad') > zahl('lauf') ? 'rad' : 'lauf';
  return { sport, ziel: 'import', name: cardio.name, start, wochen: Math.max(...einheiten.map((e) => e.woche)), tage: [...new Set(cardio.einheiten.map((e) => e.wt))].sort(),
    einheiten, zonen: null, sportarten: [...new Set(einheiten.map((e) => e.sport))] };
}

// #################################################################
// Trainingsverlauf aus anderen Apps (Wunsch 166): eigenes CSV-Format, das die KI erzeugt, oder direkt die
// Exporte von Strong und Hevy. Je Datum ein Training, je Übung die Sätze in Dateireihenfolge.
// #################################################################
export const TRAININGS_SPALTEN = ['datum', 'uebung', 'kg', 'wdh', 'rpe', 'notiz'];

export const KI_ANLEITUNG_TRAININGS = `Wandle den Trainingsverlauf unten (Export aus einer anderen Fitness-App, z. B. JEFIT, Strong, Hevy, Fitbod, Excel) in eine CSV-Tabelle für die App „PR Hunter“ um.

Regeln:
- Trennzeichen Semikolon. Erste Zeile genau: datum;uebung;kg;wdh;rpe;notiz
- Eine Zeile je Satz, in der Reihenfolge, in der die Sätze gemacht wurden.
- datum: JJJJ-MM-TT (z. B. 2026-03-14)
- uebung: gängiger deutscher oder englischer Übungsname. Kniebeuge, Bankdrücken und Kreuzheben mit der Langhantel genau so: Wettkampf-Kniebeuge, Wettkampf-Bankdrücken, Wettkampf-Kreuzheben.
- kg: Gewicht in Kilogramm mit Punkt oder Komma (Pfund × 0,4536). Körpergewicht ohne Zusatz: 0. Leer, wenn unbekannt.
- wdh: Wiederholungen als Zahl
- rpe: falls angegeben (z. B. 8 oder 7,5), sonst leer
- notiz: kurzer Hinweis ohne Semikolon, sonst leer
- Aufwärmsätze weglassen, wenn sie als solche markiert sind. Erfinde nichts.
- Gib nur die CSV in einem Codeblock aus, ohne weitere Erklärung.

Beispiel:
datum;uebung;kg;wdh;rpe;notiz
2026-03-14;Wettkampf-Kniebeuge;140;5;8;
2026-03-14;Wettkampf-Kniebeuge;140;5;8,5;
2026-03-14;Beinpresse;200;10;;

Hier ist der Verlauf:
`;

// Spaltennamen von Strong (Date, Exercise Name, Weight, Reps, RPE, Notes) und Hevy (start_time, exercise_title, weight_kg, reps, rpe, set_type)
const TRAININGS_KOPF = { datum: 'datum', date: 'datum', start_time: 'datum', starttime: 'datum', uebung: 'uebung', ubung: 'uebung', exercise: 'uebung',
  exercisename: 'uebung', exercise_title: 'uebung', exercisetitle: 'uebung', kg: 'kg', gewicht: 'kg', weight: 'kg', weight_kg: 'kg', weightkg: 'kg', last: 'kg',
  weight_lbs: 'lb', weightlbs: 'lb', lbs: 'lb', wdh: 'wdh', reps: 'wdh', wiederholungen: 'wdh', rpe: 'rpe', notiz: 'notiz', notes: 'notiz', note: 'notiz',
  exercise_notes: 'notiz', set_type: 'typ', settype: 'typ', satztyp: 'typ' };
// Kürzel anderer Apps vor dem Abgleich ausschreiben (166: DB/BB/KH/LH, Klammerzusätze)
const KUERZEL = [[/\bdb\b/gi, 'dumbbell'], [/\bbb\b/gi, 'barbell'], [/\bkh\b/gi, 'kurzhantel'], [/\blh\b/gi, 'langhantel'], [/\bez\b/gi, 'ez-bar']];
const ausgeschrieben = (n) => KUERZEL.reduce((s, [re, ersatz]) => s.replace(re, ersatz), String(n)).replace(/[()]/g, ' ');

const MONATE = { jan: 1, feb: 2, mar: 3, mär: 3, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12 };
/** Datum aus verschiedenen Exporten → JJJJ-MM-TT oder null. */
export function leseDatum(text) {
  const t = String(text).trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2}) ([A-Za-zä]{3})[a-z]* (\d{4})/);                       // Hevy: „5 Jan 2023, 18:30“
  if (m && MONATE[m[2].toLowerCase()]) return `${m[3]}-${String(MONATE[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/**
 * CSV → { trainings: [{ datum, uebungen: [{ key, saetze: [{ kg, wdh, rpe, notiz }] }] }], unbekannt, fehler, zeilen }.
 * Unbekannte Übungen kommen gesammelt (je Name einmal) zurück; die Zuordnung (Name → Schlüssel) gilt für alle Zeilen.
 */
/**
 * Jefit-Gesamtexport (Abschnitte „### EXERCISE LOGS ###“): je Eintrag Datum, Übungsname und logs „kg x wdh, …“ (kg).
 * Zeitübungen (Fünfergruppen ohne Gewicht, z. B. Plank) und leere Sätze fallen weg. Ergebnis im eigenen CSV-Format.
 */
export function jefitZuCsv(text) {
  const teil = String(text).split(/^###\s*EXERCISE LOGS\s*#+\s*$/m)[1];
  if (teil == null) return null;
  const zeilen = teil.split(/\r?\n/).map((z) => z.trim()).filter(Boolean);
  const ende = zeilen.findIndex((z) => z.startsWith('######'));
  const block = ende >= 0 ? zeilen.slice(0, ende) : zeilen;
  const kopf = zerlegeZeile(block[0] ?? '', ',').map((s) => s.toLowerCase());
  const iD = kopf.indexOf('mydate'), iN = kopf.indexOf('ename'), iL = kopf.indexOf('logs');
  if (iD < 0 || iN < 0 || iL < 0) return null;
  const aus = ['datum;uebung;kg;wdh'];
  for (const z of block.slice(1)) {
    const f = zerlegeZeile(z, ',');
    const saetze = (f[iL] ?? '').split(',').map((s) => s.split('x').map(Number)).filter((s) => s.length === 2 && s.every(Number.isFinite));
    const zeitform = saetze.length % 5 === 0 && saetze.every(([kg]) => kg === 0);
    if (!saetze.length || zeitform) continue;
    const name = (f[iN] ?? '').replace(/;/g, ',');
    for (const [kg, wdh] of saetze) if (wdh > 0) aus.push(`${f[iD]};${name};${Math.round(kg * 100) / 100};${wdh}`);
  }
  return aus.join('\n');
}

export function leseTrainingsCsv(text, katalog, zuordnung = {}) {
  const jefit = /^###\s*EXERCISE LOGS/m.test(String(text)) ? jefitZuCsv(text) : null;
  if (jefit) return leseTrainingsCsv(jefit, katalog, zuordnung);
  const fehler = [], unbekannt = sammler(katalog), index = katalogIndex(katalog);
  const zeilen = String(text).replace(/^﻿/, '').split(/\r?\n/);
  let kopf = null, trenner = ';', gelesen = 0;
  const tage = new Map();
  zeilen.forEach((roh, i) => {
    const nr = i + 1, zeile = roh.trim();
    if (!zeile || zeile.startsWith('```') || zeile.startsWith('#') || fehler.length > 50) return;
    if (!kopf) {
      trenner = [';', '\t', ','].sort((a, b) => zeile.split(b).length - zeile.split(a).length)[0];
      kopf = zerlegeZeile(zeile, trenner).map((s) => s.toLowerCase().replace(/["\s]/g, '')).map((s) => TRAININGS_KOPF[s] ?? s);
      const fehlt = ['datum', 'uebung', 'wdh'].filter((s) => !kopf.includes(s));
      if (fehlt.length) fehler.push(`Zeile ${nr}: Kopfzeile ohne ${fehlt.join(', ')} (erwartet: ${TRAININGS_SPALTEN.join(';')})`);
      return;
    }
    const w = zerlegeZeile(zeile, trenner);
    const f = Object.fromEntries(kopf.map((k, j) => [k, w[j] ?? '']));
    if (/warm/i.test(f.typ ?? '')) return;                                           // Hevy: Aufwärmsätze weglassen
    const datum = leseDatum(f.datum ?? '');
    if (!datum) { fehler.push(`Zeile ${nr}: Datum „${f.datum ?? ''}“ nicht lesbar (JJJJ-MM-TT)`); return; }
    const name = (f.uebung ?? '').trim();
    if (!name) { fehler.push(`Zeile ${nr}: Übung fehlt`); return; }
    const e = zugeordnet(name, zuordnung, katalog) ?? findeUebung(name, index) ?? findeUebung(ausgeschrieben(name), index);
    if (!e) { unbekannt.merke(name); return; }
    const zahlAus = (x) => { const s = String(x ?? '').trim().replace(',', '.'); return s === '' ? null : Number(s); };
    let kg = zahlAus(f.kg);
    if (kg == null && f.lb != null) { const lb = zahlAus(f.lb); kg = lb == null ? null : Math.round(lb * 0.45359237 * 100) / 100; }
    const wdh = zahlAus(f.wdh), rpe = zahlAus(f.rpe);
    if (kg != null && !(kg >= 0 && kg < 1000)) { fehler.push(`Zeile ${nr}: Gewicht „${f.kg}“ unplausibel`); return; }
    if (wdh === 0) return;                                                           // leere Sätze (0 Wdh) überspringen
    if (!(wdh > 0 && wdh < 200)) { fehler.push(`Zeile ${nr}: Wdh „${f.wdh ?? ''}“ fehlt oder unplausibel`); return; }
    const tag = tage.get(datum) ?? new Map();
    const u = tag.get(e.k) ?? { key: e.k, saetze: [] };
    u.saetze.push({ kg, wdh: Math.round(wdh), rpe: rpe >= 1 && rpe <= 10 ? rpe : null, notiz: (f.notiz ?? '').trim() || null });
    tag.set(e.k, u); tage.set(datum, tag);
    gelesen++;
  });
  const trainings = [...tage].sort(([a], [b]) => a.localeCompare(b)).map(([datum, m]) => ({ datum, uebungen: [...m.values()] }));
  return { trainings, unbekannt: [...unbekannt.liste.values()], fehler, zeilen: gelesen };
}

/** Fingerabdruck für die Duplikatprüfung: Datum + Übung + Sätze (kg × wdh). */
export const trainingsSchluessel = (datum, key, saetze) => `${datum}|${key}|${saetze.map((s) => `${s.kg ?? '-'}x${s.wdh}`).join(',')}`;

/** Neue Trainings gegen vorhandene prüfen: Übungen, die es am selben Tag mit denselben Sätzen schon gibt, fallen weg. */
export function ohneDuplikate(trainings, vorhandene) {
  const da = new Set();
  for (const w of vorhandene) {
    if (w.geloescht) continue;
    for (const u of w.uebungen ?? []) da.add(trainingsSchluessel(w.datum, u.key, (u.saetze ?? []).filter((s) => s.fertig !== false && s.typ !== 'warmup')));
  }
  let doppelt = 0;
  const neu = trainings.map((t) => ({ ...t, uebungen: t.uebungen.filter((u) => { const d = da.has(trainingsSchluessel(t.datum, u.key, u.saetze)); if (d) doppelt++; return !d; }) }))
    .filter((t) => t.uebungen.length);
  return { neu, doppelt };
}

// #################################################################
// Körpergewicht importieren: Yazio, Samsung Health, Apple Health, Waagen-Apps, Excel – direkt als CSV oder per KI
// (auch aus Screenshots). Format: datum;kg, je Tag ein Wert.
// #################################################################
export const KI_ANLEITUNG_GEWICHT = `Lies die Körpergewichts-Werte aus den angehängten Screenshots oder der Exportdatei (z. B. Yazio, Samsung Health, Apple Health, Google Fit, Withings, Waagen-App, Excel) und gib sie als CSV für die App „PR Hunter“ aus.

Regeln:
- Trennzeichen Semikolon. Erste Zeile genau: datum;kg
- Eine Zeile je Tag, älteste zuerst.
- datum: JJJJ-MM-TT (z. B. 2026-03-14). Fehlt das Jahr, aus dem Zusammenhang ableiten (Datum des Screenshots, Reihenfolge der Einträge).
- kg: Gewicht in Kilogramm mit Punkt und einer Nachkommastelle (Pfund × 0,4536).
- Mehrere Messungen am selben Tag: Durchschnitt.
- Nur Wochenwerte (z. B. „5.–11. Okt.: 83,8 kg“): Datum = Donnerstag dieser Woche. Nur Monatswerte: Datum = 15. des Monats.
- Werte, die man nur aus einem Diagramm schätzen könnte, weglassen. Erfinde nichts.
- Gib nur die CSV in einem Codeblock aus, ohne weitere Erklärung.

Beispiel:
datum;kg
2026-07-23;89.6
2026-07-30;88.7

Hier sind die Daten:
`;
export const KI_ANLEITUNG_GEWICHT_EN = `Read the body weight values from the attached screenshots or export file (e.g. Yazio, Samsung Health, Apple Health, Google Fit, Withings, a scale app, Excel) and output them as CSV for the app “PR Hunter”.

Rules:
- Semicolon as separator. First line exactly: datum;kg
- One line per day, oldest first.
- datum: YYYY-MM-DD (e.g. 2026-03-14). If the year is missing, infer it from context (screenshot date, order of entries).
- kg: weight in kilograms with a decimal point and one decimal (pounds × 0.4536).
- Several measurements on the same day: average.
- Only weekly values (e.g. “Oct 5–11: 83.8 kg”): date = Thursday of that week. Only monthly values: date = 15th of the month.
- Leave out values that could only be estimated from a chart. Do not invent anything.
- Output only the CSV in a code block, without any explanation.

Example:
datum;kg
2026-07-23;89.6
2026-07-30;88.7

Here is the data:
`;

const GEWICHT_KOPF = { datum: 'datum', date: 'datum', tag: 'datum', day: 'datum', zeit: 'datum', time: 'datum', timestamp: 'datum',
  kg: 'kg', gewicht: 'kg', weight: 'kg', weight_kg: 'kg', weightkg: 'kg', 'gewicht(kg)': 'kg', 'weight(kg)': 'kg', koerpergewicht: 'kg', körpergewicht: 'kg',
  lb: 'lb', lbs: 'lb', pfund: 'lb', weight_lb: 'lb', weightlb: 'lb', 'weight(lb)': 'lb' };

/** CSV/Text → { werte: [{ datum, kg }] (je Tag einer, Mittel bei mehreren, sortiert), fehler: [] }. Kopfzeile optional (sonst Datum; kg). */
export function leseGewichtCsv(text) {
  const fehler = [], jeTag = new Map();
  let kopf = null, trenner = null;
  String(text).replace(/^﻿/, '').split(/\r?\n/).forEach((roh, i) => {
    const nr = i + 1, zeile = roh.trim();
    if (!zeile || zeile.startsWith('```') || zeile.startsWith('#') || fehler.length > 50) return;
    trenner ??= [';', '\t', ','].sort((a, b) => zeile.split(b).length - zeile.split(a).length)[0];
    const w = zerlegeZeile(zeile, trenner);
    if (!kopf) {
      const k = w.map((s) => s.toLowerCase().replace(/["\s]/g, '')).map((s) => GEWICHT_KOPF[s] ?? s);
      if (!leseDatum(w[0] ?? '') && k.includes('datum') && (k.includes('kg') || k.includes('lb'))) { kopf = k; return; }
      kopf = ['datum', 'kg'];                                                       // keine Kopfzeile: Datum; kg
    }
    const f = Object.fromEntries(kopf.map((k, j) => [k, w[j] ?? '']));
    const datum = leseDatum(f.datum ?? '');
    if (!datum) { fehler.push(`Zeile ${nr}: Datum „${f.datum ?? ''}“ nicht lesbar (JJJJ-MM-TT)`); return; }
    const roheZahl = String(f.kg || f.lb || '').replace(/[^\d,.]/g, '').replace(',', '.');
    let kg = roheZahl === '' ? NaN : Number(roheZahl);
    if (!f.kg && f.lb) kg *= 0.45359237;
    if (!(kg >= 25 && kg <= 300)) { fehler.push(`Zeile ${nr}: Gewicht „${f.kg || f.lb || ''}“ nicht plausibel (25–300 kg)`); return; }
    jeTag.set(datum, [...(jeTag.get(datum) ?? []), kg]);
  });
  const werte = [...jeTag].map(([datum, l]) => ({ datum, kg: Math.round((l.reduce((a, b) => a + b, 0) / l.length) * 10) / 10 }))
    .sort((a, b) => a.datum.localeCompare(b.datum));
  if (!werte.length && !fehler.length) fehler.push('Keine Werte gefunden (erwartet: datum;kg).');
  return { werte, fehler };
}

/** Mit vorhandenen Messwerten abgleichen: neue Tage, gleiche (übersprungen), abweichende (nur mit ueberschreiben übernommen). */
export function gewichtAbgleich(werte, vorhandene, ueberschreiben = false) {
  const da = new Map(vorhandene.map((m) => [m.datum, Number(m.kg)]));
  const neu = [], anders = [];
  let gleich = 0;
  for (const w of werte) {
    if (!da.has(w.datum)) neu.push(w);
    else if (Math.abs(da.get(w.datum) - w.kg) < 0.05) gleich++;
    else anders.push(w);
  }
  return { neu, gleich, anders, uebernehmen: ueberschreiben ? [...neu, ...anders].sort((a, b) => a.datum.localeCompare(b.datum)) : neu };
}
