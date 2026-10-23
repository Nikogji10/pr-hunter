// PR Hunter · Kontodaten neben den Trainings: Profil (Einstellungen), Übungen und Anpassungen, Programme, Block, Körpergewicht.
// Alles wird lokal zuerst gespeichert (offen: true) und beim Abgleich hochgeladen; supabase wird übergeben (testbar).
import { STANDARD_PAUSEN } from './programm.js';
import { STANDARD_SCHEIBEN } from './rechnen.js';

async function pruefe(antwort) {
  if (antwort.error) throw new Error(antwort.error.message ?? String(antwort.error));
  return antwort.data;
}
const num = (x) => (x == null ? null : Number(x));

// #################################################################
// Profil ↔ Einstellungen
// #################################################################
export const STANDARD_EINSTELLUNGEN = {
  pausen: { ...STANDARD_PAUSEN }, cut: false, sprache: 'de', einheit: 'kg', inc: 2.5, stange: 20, scheiben: [...STANDARD_SCHEIBEN],
  formel: 'rpe', thema: 'system', name: null, admin: false, vergleich: false,
  bereitschaft: true,                       // Readiness-Check vor dem Training (nur auf dem Gerät)
};

export function einstAusProfil(p, alt = {}) {
  return { ...STANDARD_EINSTELLUNGEN, ...alt, pausen: { ...STANDARD_PAUSEN, ...pausenOhneAlteSchluessel(p.rest_defaults_s) }, cut: !!p.cut_mode,
    name: p.display_name ?? alt.name ?? null, admin: p.role === 'admin', sprache: p.language ?? 'de', einheit: p.unit ?? 'kg',
    inc: num(p.load_increment) ?? 2.5, stange: num(p.bar_weight_kg) ?? 20, scheiben: (p.plates_kg ?? STANDARD_SCHEIBEN).map(Number),
    formel: p.e1rm_formula ?? 'rpe', thema: p.theme ?? 'system', vergleich: !!p.share_stats };
}
// Vor Update 3 hießen die Schlüssel main/variation/isolation; nur die neuen übernehmen
const pausenOhneAlteSchluessel = (r) => Object.fromEntries(Object.entries(r ?? {}).filter(([k, v]) => k in STANDARD_PAUSEN && v > 0));
/** Einstellungen → Profilspalten. share_stats (Vergleich, Update 08) nur, wenn es gesetzt wurde – sonst läuft es auch ohne 08. */
export const profilAusEinst = (e) => ({
  rest_defaults_s: e.pausen, cut_mode: !!e.cut, language: e.sprache ?? 'de', unit: e.einheit ?? 'kg', load_increment: e.inc ?? 2.5,
  bar_weight_kg: e.stange ?? 20, plates_kg: e.scheiben ?? STANDARD_SCHEIBEN, e1rm_formula: e.formel ?? 'rpe', theme: e.thema ?? 'system',
  ...(e.name ? { display_name: e.name } : {}), ...(e.vergleichGeaendert ? { share_stats: !!e.vergleich } : {}),
});

export const ladeProfil = async (sb, uid) => pruefe(await sb.from('profiles').select('*').eq('id', uid).single());
export const speichereProfil = async (sb, uid, einst) => pruefe(await sb.from('profiles').update(profilAusEinst(einst)).eq('id', uid));

// #################################################################
// Übungen: in der App angelegte (für alle sichtbar) und persönliche Anpassungen
// #################################################################
// Stand des mitgelieferten Katalogs (app/daten/katalog.json); später geänderte Basisübungen kommen aus der DB
export const KATALOG_STAND = '2026-10-23T00:00:00Z';
const UEBUNG_SPALTEN = 'id, key, name_de, name_en, family, equipment, load_type, primary_muscles, secondary_muscles, base_lift, created_by, exercise_aliases(alias)';

/** Übungszeile aus Supabase → Eintrag im schlanken Katalogformat (wie app/daten/katalog.json). */
export function katalogEintrag(e) {
  const namen = [e.name_de, e.name_en, ...(e.exercise_aliases ?? []).map((a) => a.alias)];
  return { k: e.key, de: e.name_de, en: e.name_en, f: e.family, lt: e.load_type, eq: e.equipment ?? null, m: e.primary_muscles ?? [],
    b: e.base_lift ?? null, s: [...new Set(namen.filter(Boolean).map((n) => n.trim().toLowerCase()))].join(' | '),
    id: e.id, eigen: !!e.created_by, von: e.created_by ?? null, m2: e.secondary_muscles ?? [] };
}

/** Eigene Übungen aller Nutzer und nach dem Katalogstand geänderte Basisübungen. */
export const ladeUebungen = async (sb) => (await pruefe(await sb.from('exercises').select(UEBUNG_SPALTEN)
  .or(`created_by.not.is.null,updated_at.gt."${KATALOG_STAND}"`))).map(katalogEintrag);

/** Mitgelieferten Katalog mit Einträgen aus der DB zusammenführen (DB gewinnt), sortiert nach deutschem Namen. */
export function mischeKatalog(statisch, ausDb) {
  const nach = new Map(statisch.map((e) => [e.k, e]));
  for (const e of ausDb) nach.set(e.k, { ...nach.get(e.k), ...e });
  return [...nach.values()].sort((a, b) => a.de.localeCompare(b.de, 'de'));
}

/** Eindeutiger Schlüssel aus dem englischen Namen (wie im Katalog: klein, a–z, 0–9, _ und -). */
export function schluesselFuer(nameEn, vorhanden) {
  const basis = nameEn.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '_').replace(/^_+|_+$/g, '') || 'uebung';
  let k = basis;
  for (let i = 2; vorhanden.has(k); i++) k = `${basis}_${i}`;
  return k;
}

export const aehnlicheUebungen = async (sb, name) => (name?.trim() ? pruefe(await sb.rpc('find_similar_exercises', { q: name.trim(), max_results: 8 })) : []);

/** Neue Übung anlegen (braucht Netz). u: { de, en, f, lt, eq, m, m2, mechanik, b }. */
export async function uebungAnlegen(sb, uid, u, vorhandeneSchluessel) {
  const zeile = { key: schluesselFuer(u.en, vorhandeneSchluessel), name_de: u.de.trim(), name_en: u.en.trim(), family: u.f, equipment: u.eq || null,
    load_type: u.lt, primary_muscles: u.m ?? [], secondary_muscles: u.m2 ?? [], mechanic: u.mechanik || null, base_lift: u.b || null,
    source: 'user', created_by: uid };
  return katalogEintrag(await pruefe(await sb.from('exercises').insert(zeile).select(UEBUNG_SPALTEN).single()));
}

/** Basisdaten einer Übung ändern (nur Ersteller oder Admin, RLS prüft). */
export async function uebungAendern(sb, id, u) {
  const zeile = { name_de: u.de.trim(), name_en: u.en.trim(), family: u.f, equipment: u.eq || null, load_type: u.lt,
    primary_muscles: u.m ?? [], secondary_muscles: u.m2 ?? [], base_lift: u.b || null };
  return katalogEintrag(await pruefe(await sb.from('exercises').update(zeile).eq('id', id).select(UEBUNG_SPALTEN).single()));
}

/** Zeile aus user_exercise_settings (mit exercises(key)) → Anpassung. */
export const anpassungAusZeile = (r) => ({ key: r.exercises?.key ?? null, name: r.display_name ?? null, pause: r.rest_s ?? null, cues: r.cues ?? null,
  notiz: r.notes ?? null, rack: r.rack ?? null, favorit: !!r.favorite, versteckt: !!r.hidden, offen: false });

export const ladeAnpassungen = async (sb) => Object.fromEntries((await pruefe(await sb.from('user_exercise_settings').select('*, exercises(key)')))
  .map(anpassungAusZeile).filter((a) => a.key).map((a) => [a.key, a]));

/** Anpassung hochladen. rack (Update 08) nur, wenn gesetzt – sonst läuft es auch ohne 08. */
export async function anpassungHochladen(sb, key, a) {
  const ex = await pruefe(await sb.from('exercises').select('id').eq('key', key).single());
  const zeile = { exercise_id: ex.id, display_name: a.name || null, rest_s: a.pause ?? null, cues: a.cues || null, notes: a.notiz || null,
    favorite: !!a.favorit, hidden: !!a.versteckt, ...(a.rack ? { rack: a.rack } : {}) };
  return pruefe(await sb.from('user_exercise_settings').upsert(zeile, { onConflict: 'user_id,exercise_id' }));
}

/** Server-Anpassungen übernehmen, lokal offene behalten. */
export function mischeAnpassungen(lokal, server) {
  const aus = { ...server };
  for (const [k, a] of Object.entries(lokal ?? {})) if (a.offen) aus[k] = a;
  return aus;
}

// #################################################################
// Programme: Vorlagen (Schlüssel wie die Dateinamen in programme/) und eigene, mit allen Versionen
// #################################################################
export const dateiVon = (p) => (p.is_template && p.slug ? p.slug.replaceAll('-', '_') : `prog:${p.id}`);

export function programmeAusServer(programme, versionen) {
  const aus = {};
  for (const p of programme) {
    const eigene = versionen.filter((v) => v.program_id === p.id);
    const aktuell = eigene.find((v) => v.version === p.current_version);
    if (!aktuell) continue;
    aus[dateiVon(p)] = { id: p.id, version: p.current_version, name: p.name, vorlage: p.is_template,
      versionen: Object.fromEntries(eigene.map((v) => [v.version, v.definition])) };
  }
  return aus;
}

export async function ladeProgramme(sb) {
  const programme = await pruefe(await sb.from('programs').select('id, slug, name, is_template, current_version').eq('archived', false));
  if (!programme.length) return {};
  const versionen = await pruefe(await sb.from('program_versions').select('program_id, version, definition').in('program_id', programme.map((p) => p.id)));
  return programmeAusServer(programme, versionen);
}

const HERKUNFT = { import: ['Importiert (CSV oder JSON)', 'Import'], generator: ['Block-Generator', 'Generator'], kopie: ['Bearbeitete Kopie', 'Kopie'] };

/**
 * Eigenes Programm speichern (Import, Generator oder Kopie einer Vorlage; braucht Netz).
 * Rückgabe [datei, Eintrag wie aus ladeProgramme].
 */
export async function programmAnlegen(sb, definition, { quelle = 'import', basiertAuf = null } = {}) {
  const [beschreibung, notiz] = HERKUNFT[quelle] ?? HERKUNFT.import;
  const p = await pruefe(await sb.from('programs').insert({ name: definition.name, description: beschreibung, source: quelle, based_on: basiertAuf })
    .select('id, slug, name, is_template, current_version').single());
  await pruefe(await sb.from('program_versions').insert({ program_id: p.id, version: 1, definition, change_note: notiz }));
  return [dateiVon(p), { id: p.id, version: 1, name: p.name, vorlage: false, versionen: { 1: definition } }];
}

/**
 * Eigenes Programm überschreiben (aktuelle Version, keine neue – Nikos Entscheidung 23.10.2026). Ohne Update 09 fehlt
 * das Update-Recht; RLS lässt die Zeile dann stumm unverändert, deshalb die Prüfung auf eine geänderte Zeile.
 */
export async function programmUeberschreiben(sb, programmId, version, definition) {
  const zeilen = await pruefe(await sb.from('program_versions').update({ definition }).eq('program_id', programmId).eq('version', version).select('version'));
  if (!zeilen?.length) throw new Error('Nicht gespeichert: Der Datenbank fehlt Update 09 (Recht zum Überschreiben).');
}
/** Neue Version eines Programms (nur noch für Vorlagen-Updates per SQL genutzt; die App überschreibt). */
export const programmVersionSpeichern = async (sb, programmId, definition, notiz = null) =>
  pruefe(await sb.rpc('save_program_version', { p_program: programmId, p_definition: definition, p_note: notiz }));
export const programmUmbenennen = async (sb, id, name) => pruefe(await sb.from('programs').update({ name }).eq('id', id));
/** Archivieren statt Löschen: laufende oder alte Blöcke verweisen weiter auf das Programm. */
export const programmArchivieren = async (sb, id) => pruefe(await sb.from('programs').update({ archived: true }).eq('id', id));

// #################################################################
// Block = program_runs (ein aktiver je Nutzer)
// #################################################################
export function blockAusRun(r, info) {
  const datei = Object.entries(info).find(([, p]) => p.id === r.program_id)?.[0];
  if (!datei) return null;
  return { id: r.id, datei, programmId: r.program_id, version: r.program_version, start: r.start_date,
    werte: r.inputs_kg, alternativ: !!r.options?.alternativ, verschoben: r.options?.verschoben ?? {}, uebersprungen: r.options?.uebersprungen ?? [], offen: false };
}

export function runAusBlock(b) {
  return { id: b.id, program_id: b.programmId, program_version: b.version, start_date: b.start, inputs_kg: b.werte,
    options: { alternativ: !!b.alternativ, verschoben: b.verschoben ?? {}, uebersprungen: b.uebersprungen ?? [] }, status: b.ende ?? 'active' };
}

export async function ladeBlock(sb, info) {
  const r = await pruefe(await sb.from('program_runs').select('id, program_id, program_version, start_date, inputs_kg, options')
    .eq('status', 'active').maybeSingle());
  return r ? blockAusRun(r, info) : null;
}

/** Block hochladen. Ein neuer aktiver Block beendet vorher den alten (eindeutiger Index je Nutzer). */
export async function blockHochladen(sb, b) {
  if (b.ende) {
    await pruefe(await sb.from('program_runs').update({ status: b.ende }).eq('id', b.id));
    return;
  }
  await pruefe(await sb.from('program_runs').update({ status: 'finished' }).eq('status', 'active').neq('id', b.id));
  await pruefe(await sb.from('program_runs').upsert(runAusBlock(b)));
}

// #################################################################
// Update 08: Vergleich mit dem Kumpel, Konto löschen, Übungen zusammenführen
// #################################################################
/** Zeilen aus public.compare_stats() → je Nutzer { id, name, ich, koerpergewicht, lifts: { squat: { aktuell, best, datum } } }. */
export function vergleichAusZeilen(zeilen) {
  const nach = new Map();
  for (const z of zeilen ?? []) {
    const p = nach.get(z.user_id) ?? { id: z.user_id, name: z.display_name || 'Ohne Namen', ich: !!z.ich, koerpergewicht: z.bodyweight_kg == null ? null : Number(z.bodyweight_kg), lifts: {} };
    p.lifts[z.lift] = { aktuell: z.e1rm_aktuell == null ? null : Number(z.e1rm_aktuell), best: z.e1rm_best == null ? null : Number(z.e1rm_best), datum: z.best_date ?? null };
    nach.set(z.user_id, p);
  }
  return [...nach.values()].sort((a, b) => Number(b.ich) - Number(a.ich) || a.name.localeCompare(b.name));
}
/** Vergleich laden; null, solange Update 08 fehlt. */
export async function ladeVergleich(sb) {
  const r = await sb.rpc('compare_stats');
  if (r.error) { if (/compare_stats|function/i.test(r.error.message)) return null; throw new Error(r.error.message); }
  return vergleichAusZeilen(r.data);
}
/** Konto mit allen eigenen Daten löschen (Update 08). Selbst angelegte Übungen bleiben im gemeinsamen Katalog. */
export const kontoLoeschen = async (sb) => pruefe(await sb.rpc('delete_my_account'));
/** Zusammengeführte Schlüssel { alt: neu }; vor Update 08 leer. */
export async function ladeZusammenfuehrungen(sb) {
  const r = await sb.from('exercise_merges').select('from_key, into_key');
  return r.error ? {} : Object.fromEntries(r.data.map((x) => [x.from_key, x.into_key]));
}
/** Übung vonKey in nachKey aufgehen lassen (Admin oder Ersteller beider); Rückgabe: Zahl der umgehängten Einträge. */
export async function zusammenfuehren(sb, vonKey, nachKey) {
  const ids = Object.fromEntries((await pruefe(await sb.from('exercises').select('id, key').in('key', [vonKey, nachKey]))).map((e) => [e.key, e.id]));
  if (!ids[vonKey] || !ids[nachKey]) throw new Error('Übung nicht gefunden.');
  return pruefe(await sb.rpc('merge_exercises', { p_from: ids[vonKey], p_into: ids[nachKey] }));
}

// #################################################################
// Körpergewicht = body_metrics (ein Wert je Tag)
// #################################################################
export const ladeMesswerte = async (sb) => (await pruefe(await sb.from('body_metrics').select('date, bodyweight_kg').not('bodyweight_kg', 'is', null)))
  .map((m) => ({ datum: m.date, kg: Number(m.bodyweight_kg) }));

export const messwertHochladen = async (sb, m) =>
  pruefe(await sb.from('body_metrics').upsert({ date: m.datum, bodyweight_kg: m.kg }, { onConflict: 'user_id,date' }));

/** Messwert für einen Tag setzen (ersetzt einen vorhandenen am selben Tag). */
export const setzeMesswert = (liste, datum, kg) => [...liste.filter((m) => m.datum !== datum), { datum, kg, offen: true }]
  .sort((a, b) => a.datum.localeCompare(b.datum));

/** Server-Messwerte übernehmen, lokale offene behalten. */
export function mischeMesswerte(lokal, server) {
  const nach = new Map(server.map((m) => [m.datum, m]));
  for (const m of lokal) if (m.offen) nach.set(m.datum, m);
  return [...nach.values()].sort((a, b) => a.datum.localeCompare(b.datum));
}

// #################################################################
// Export: alle Sätze als CSV (Excel-tauglich: Semikolon, Dezimalkomma, BOM)
// #################################################################
export function exportCsv(trainings, nameVon) {
  const zahl = (n) => (n == null ? '' : String(n).replace('.', ','));
  const feld = (s) => (s == null ? '' : /[;"\n]/.test(String(s)) ? `"${String(s).replaceAll('"', '""')}"` : String(s));
  const zeilen = [['Datum', 'Übung', 'Schlüssel', 'Satz', 'Typ', 'kg', 'Wdh', 'RPE', 'erledigt', 'Session-RPE', 'Quelle'].join(';')];
  for (const t of [...trainings].filter((x) => !x.geloescht).sort((a, b) => a.datum.localeCompare(b.datum))) {
    for (const u of t.uebungen ?? []) {
      (u.saetze ?? []).forEach((s, i) => zeilen.push([t.datum, feld(nameVon(u.key)), u.key, i + 1, s.typ ?? 'working', zahl(s.kg), s.wdh ?? '', zahl(s.rpe),
        s.fertig === false ? 'nein' : 'ja', zahl(t.sessionRpe), t.quelle ?? ''].join(';')));
    }
  }
  return `\uFEFF${zeilen.join('\r\n')}\r\n`;
}
