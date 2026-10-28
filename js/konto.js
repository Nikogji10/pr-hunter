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
  // profiles.app_settings (Update 11): auf allen Geräten gleich; ohne 11 bleiben sie auf dem Gerät
  bereitschaft: true, zoom: 1, ziele: {}, gewichtZiel: null, avatar: null, hintergrundDunkel: 0.55, deckkraft: 0.88,
  stil: 'eisen', schrift: 'archivo', ton: 'piep',
  // nur auf diesem Gerät (Erlaubnis gilt je Gerät): Benachrichtigungen während des Trainings
  mitteilungen: false,
};
const APP_SETTINGS = ['bereitschaft', 'zoom', 'ziele', 'gewichtZiel', 'hintergrundDunkel', 'deckkraft', 'stil', 'schrift', 'ton', 'vibration', 'kalender', 'freundeAus', 'sbdHeute'];

export function einstAusProfil(p, alt = {}) {
  return { ...STANDARD_EINSTELLUNGEN, ...alt, pausen: { ...STANDARD_PAUSEN, ...pausenOhneAlteSchluessel(p.rest_defaults_s) }, cut: !!p.cut_mode,
    name: p.display_name ?? alt.name ?? null, admin: p.role === 'admin', sprache: p.language ?? 'de', einheit: p.unit ?? 'kg',
    inc: num(p.load_increment) ?? 2.5, stange: num(p.bar_weight_kg) ?? 20, scheiben: (p.plates_kg ?? STANDARD_SCHEIBEN).map(Number),
    formel: p.e1rm_formula ?? 'rpe', thema: p.theme ?? 'system', vergleich: !!p.share_stats, loeschenAb: p.loeschen_ab ?? null,
    // Feed (Update 15): Spalte da → Wert übernehmen und beim Speichern mitschicken
    ...('share_feed' in p ? { feedTeilen: p.share_feed !== false, feedSpalte: true } : {}),
    ...('share_kalender' in p ? { kalenderTeilen: p.share_kalender !== false, kalenderSpalte: true } : {}),
    vorlagen: p.vorlagen === true,                             // Update 22: Candito-Vorlagen sichtbar (nur lesen)
    // app_settings: Spalte vorhanden → Werte von dort (und beim Speichern mitschicken), sonst die lokalen behalten
    ...('app_settings' in p ? { ...Object.fromEntries(APP_SETTINGS.filter((k) => k in (p.app_settings ?? {})).map((k) => [k, p.app_settings[k]])), appSettings: true } : {}),
    ...('avatar' in p ? { avatar: p.avatar ?? null } : {}) };
}
// Vor Update 3 hießen die Schlüssel main/variation/isolation; nur die neuen übernehmen
const pausenOhneAlteSchluessel = (r) => Object.fromEntries(Object.entries(r ?? {}).filter(([k, v]) => k in STANDARD_PAUSEN && v > 0));
/** Einstellungen → Profilspalten. share_stats (Vergleich, Update 08) nur, wenn es gesetzt wurde – sonst läuft es auch ohne 08. */
export const profilAusEinst = (e) => ({
  rest_defaults_s: e.pausen, cut_mode: !!e.cut, language: e.sprache ?? 'de', unit: e.einheit ?? 'kg', load_increment: e.inc ?? 2.5,
  bar_weight_kg: e.stange ?? 20, plates_kg: e.scheiben ?? STANDARD_SCHEIBEN, e1rm_formula: e.formel ?? 'rpe', theme: e.thema ?? 'system',
  ...(e.name ? { display_name: e.name } : {}), ...(e.vergleichGeaendert ? { share_stats: !!e.vergleich } : {}),
  ...(e.feedSpalte ? { share_feed: e.feedTeilen !== false } : {}),
  ...(e.kalenderSpalte ? { share_kalender: e.kalenderTeilen !== false } : {}),
  // Update 11 bringt app_settings und avatar gemeinsam
  ...(e.appSettings ? { app_settings: Object.fromEntries(APP_SETTINGS.map((k) => [k, e[k] ?? STANDARD_EINSTELLUNGEN[k]]).filter(([, v]) => v !== undefined)), avatar: e.avatar ?? null } : {}),
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

const HERKUNFT = { import: ['Importiert (CSV oder JSON)', 'Import'], generator: ['Generator', 'Generator'], kopie: ['Bearbeitete Kopie', 'Kopie'], eigen: ['Eigener Plan', 'Eigen'] };

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
    const p = nach.get(z.user_id) ?? { id: z.user_id, name: z.display_name || 'Ohne Namen', ich: !!z.ich, avatar: z.avatar ?? null,
      koerpergewicht: z.bodyweight_kg == null ? null : Number(z.bodyweight_kg), lifts: {} };
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
/** Feed-Zeilen (db/15_feed.sql) → Einträge für die App: Zahlen als Zahl, Übungen mit bestem Satz. */
export const feedAusZeilen = (zeilen) => zeilen.map((z) => ({
  id: z.workout_id, nutzer: z.user_id, name: z.display_name ?? 'Ohne Namen', avatar: z.avatar ?? null, datum: z.datum, ich: !!z.ich,
  minuten: z.minuten ?? null, uebungen: z.uebungen ?? 0, saetze: z.saetze ?? 0, volumen: Number(z.volumen_kg ?? 0), prs: z.prs ?? 0,
  liste: (z.beste ?? []).map((b) => ({ key: b.key, de: b.de, en: b.en, saetze: b.saetze, prs: b.prs, kg: b.kg == null ? null : Number(b.kg), wdh: b.wdh ?? null,
    // ab Update 16: Sätze zusammengefasst (Top-Satz und Back-offs getrennt)
    folge: Array.isArray(b.folge) ? b.folge.map((g) => ({ kg: g.kg == null ? null : Number(g.kg), wdh: g.wdh ?? null, n: g.n ?? 1 })) : null })),
}));
/** Feed der letzten tage Tage; null, solange Update 15 fehlt. */
export async function ladeFeed(sb, tage = 30) {
  const r = await sb.rpc('feed', { p_tage: tage });
  if (r.error) { if (/feed|function/i.test(r.error.message)) return null; throw new Error(r.error.message); }
  return feedAusZeilen(r.data ?? []);
}
/** Eigene geplante Trainingstage für den Kalender der Freunde (Update 18), ab Update 19 mit Übungen je Tag; still ohne Update. */
export async function speicherePlanTage(sb, uid, tage, inhalt = null) {
  let r = await sb.from('profiles').update({ plan_tage: tage, ...(inhalt ? { plan_inhalt: inhalt } : {}) }).eq('id', uid);
  if (r.error && inhalt && /plan_inhalt/i.test(r.error.message)) r = await sb.from('profiles').update({ plan_tage: tage }).eq('id', uid);
  if (r.error && !/plan_tage/i.test(r.error.message)) throw new Error(r.error.message);
  return !r.error;                                                // false: Update 18 fehlt noch, beim nächsten Abgleich wieder versuchen
}
/** Kalender: je Person und Tag erledigt/geplant (Update 18); null, solange es fehlt. */
export async function ladeKalender(sb, von, bis) {
  const r = await sb.rpc('feed_kalender', { p_von: von, p_bis: bis });
  if (r.error) { if (/feed_kalender|function/i.test(r.error.message)) return null; throw new Error(r.error.message); }
  return (r.data ?? []).map((z) => ({ nutzer: z.user_id, name: z.display_name ?? 'Ohne Namen', avatar: z.avatar ?? null, datum: z.datum, art: z.art, ich: !!z.ich,
    uebungen: z.uebungen ?? null }));
}
// Freunde (Update 19): Liste, Suche, Anfragen; null bzw. Fehler „Update 19 fehlt“, solange die Funktionen fehlen
const ohne19 = (r) => r.error && /freunde_liste|suche_nutzer|freund_|function/i.test(r.error.message);
export async function ladeFreunde(sb) {
  const r = await sb.rpc('freunde_liste');
  if (ohne19(r)) return null;
  if (r.error) throw new Error(r.error.message);
  return r.data.map((z) => ({ id: z.user_id, name: z.display_name ?? 'Ohne Namen', avatar: z.avatar ?? null, status: z.status, richtung: z.richtung,
    // ab Update 21: was ich mit diesem Freund teile (null = Update fehlt)
    teilt: 'teilt_feed' in z ? { feed: z.teilt_feed, kalender: z.teilt_kalender, vergleich: z.teilt_vergleich } : null }));
}
export async function sucheNutzer(sb, q) {
  const r = await sb.rpc('suche_nutzer', { q });
  if (ohne19(r)) return [];
  if (r.error) throw new Error(r.error.message);
  return r.data.map((z) => ({ id: z.user_id, name: z.display_name ?? 'Ohne Namen', avatar: z.avatar ?? null }));
}
/** Eigene Freigabe für einen Freund setzen (Update 21): art feed | kalender | vergleich. */
export async function freigabeSetzen(sb, id, art, wert) {
  const r = await sb.rpc('freigabe_setzen', { freund: id, art, wert });
  if (r.error) throw new Error(/freigabe_setzen|function/i.test(r.error.message) ? 'Datenbank-Update 21 fehlt (db/21_freigabe_je_freund.sql).' : r.error.message);
}
export const freundAktion = async (sb, art, id) => {
  const name = { anfragen: ['freund_anfragen', 'ziel'], annehmen: ['freund_annehmen', 'anfragender'], entfernen: ['freund_entfernen', 'anderer'], blockieren: ['freund_blockieren', 'anderer'] }[art];
  const r = await sb.rpc(name[0], { [name[1]]: id });
  if (r.error) throw new Error(ohne19(r) ? 'Datenbank-Update 19 fehlt (db/19_freunde.sql).' : r.error.message);
  return r.data;
};
/** Konto mit allen eigenen Daten löschen (Update 08). Selbst angelegte Übungen bleiben im gemeinsamen Katalog. */
export const kontoLoeschen = async (sb) => pruefe(await sb.rpc('delete_my_account'));
/** Löschen mit 14 Tagen Frist (Update 20): vormerken → Datum, ab dem gelöscht wird; abbrechen innerhalb der Frist. */
export async function kontoLoeschenVormerken(sb) {
  const r = await sb.rpc('konto_loeschen_vormerken');
  if (r.error) throw new Error(/konto_loeschen|function/i.test(r.error.message) ? 'Datenbank-Update 20 fehlt (db/20_konto_loeschfrist.sql).' : r.error.message);
  return r.data;
}
export const kontoLoeschenAbbrechen = async (sb) => pruefe(await sb.rpc('konto_loeschen_abbrechen'));
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
// Hintergrundbild = user_assets (Update 11): eigene Tabelle, geladen nur, wenn sich der Stand (updated_at) ändert
// #################################################################
export async function hintergrundHochladen(sb, uid, bild) {
  const r = await pruefe(await sb.from('user_assets').upsert({ user_id: uid, hintergrund: bild ?? null }).select('updated_at').single());
  return r.updated_at;
}
export const hintergrundStand = async (sb) => (await pruefe(await sb.from('user_assets').select('updated_at').maybeSingle()))?.updated_at ?? null;
export const hintergrundLaden = async (sb) => (await pruefe(await sb.from('user_assets').select('hintergrund, updated_at').maybeSingle())) ?? null;

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
