// PR Hunter · Abgleich zwischen Handy (IndexedDB) und Supabase.
// Hochladen: ein Training komplett über die Funktion public.sync_workout (eine Transaktion, wiederholbar).
// Holen: Trainings mit Übungen und Sätzen, seit dem letzten Stand (updated_at), seitenweise.
// Konfliktregel: Was auf dem Handy noch nicht hochgeladen ist (offen), gewinnt; sonst gilt der Server.

export const neueId = () => crypto.randomUUID();

const ROLLE_ZU_TYP = { top: 'top', backoff: 'backoff', test: 'test' };
const TYPEN = new Set(['warmup', 'working', 'top', 'backoff', 'amrap', 'test', 'drop', 'failure']);
const zahl = (x, { min = -Infinity, max = Infinity, ganz = false } = {}) => {
  const n = typeof x === 'string' ? Number(x.replace(',', '.')) : x;
  if (n == null || !Number.isFinite(n) || n < min || n > max) return null;
  return ganz ? Math.round(n) : n;
};
const ohneLeer = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** Zusammengeführte Übungen (alter Schlüssel → neuer, aus public.exercise_merges): offene Trainings laden mit dem neuen hoch. */
export const UMBENANNT = {};
export const setzeUmbenannt = (m) => { for (const k of Object.keys(UMBENANNT)) delete UMBENANNT[k]; Object.assign(UMBENANNT, m); };

/**
 * Laufendes Training (Karten aus ui/training.js) → lokales Training.
 * Unbelegte Zusatzplätze fallen weg, nicht erledigte Sätze bleiben als geplant (fertig: false) erhalten.
 */
export function ausTraining(t, { id = t.id ?? neueId(), ende = new Date().toISOString(), sessionRpe = null, notiz = null, koerpergewicht = null } = {}) {
  const uebungen = [];
  for (const k of t.karten ?? []) {
    if (!k.key) continue;
    const saetze = [];
    for (const g of k.gruppen) {
      for (const s of g.saetze) {
        saetze.push({
          id: s.id ?? neueId(), typ: s.typ ?? ROLLE_ZU_TYP[g.rolle] ?? 'working', kg: s.kg ?? null, wdh: s.wdh ?? null, rpe: s.rpe ?? null,
          fertig: !!s.erledigt, zeit: s.zeit ?? null,
          // beim Bearbeiten bleibt die ursprüngliche Vorgabe (auch null bei Jefit), sonst die der Gruppe
          geplant: s.geplant !== undefined ? s.geplant : { rolle: g.rolle ?? null, wdh: g.wdhText ?? null, rpe: g.rpe ?? null, kg: s.kgPlan ?? null },
          ...ohneLeer({ dauer: s.dauer, strecke: s.strecke, notiz: s.notiz ?? undefined, extra: s.extra ?? undefined }),
        });
      }
    }
    if (saetze.length) uebungen.push(ohneLeer({ id: k.uid ?? neueId(), key: k.key, notiz: k.notiz ?? null, supersatz: k.supersatz, saetze }));
  }
  return {
    id, clientId: t.clientId ?? id, datum: t.datum, start: t.start ? new Date(t.start).toISOString() : null, ende,
    sessionRpe, koerpergewicht, notiz, quelle: t.quelle ?? 'app', runId: t.runId ?? null, woche: t.woche ?? null, tagOffset: t.tagOffset ?? null,
    bereitschaft: t.bereitschaft ?? null, uebungen, offen: true, geloescht: false,
  };
}

/**
 * Gespeichertes Training → Karten zum Bearbeiten (Gegenstück zu ausTraining). IDs, Satztypen, Zeiten, Vorgaben und
 * Quelle bleiben, damit das erneute Speichern genau dieses Training ersetzt. Jede Übung wird eine Karte mit einer Gruppe.
 */
export function zuTraining(w) {
  return {
    id: w.id, clientId: w.clientId ?? w.id, datum: w.datum, planDatum: null, bearbeiten: true,
    start: w.start ? Date.parse(w.start) : Date.now(), ende: w.ende ?? null, sessionRpe: w.sessionRpe ?? null, notiz: w.notiz ?? null,
    koerpergewicht: w.koerpergewicht ?? null, quelle: w.quelle ?? 'app', runId: w.runId ?? null, woche: w.woche ?? null,
    tagOffset: w.tagOffset ?? null, bereitschaft: w.bereitschaft ?? null,
    karten: (w.uebungen ?? []).map((u, i) => {
      const haupt = (u.saetze ?? []).find((s) => s.typ !== 'warmup')?.typ;
      return { id: i, uid: u.id, key: u.key, notiz: u.notiz ?? null, supersatz: u.supersatz, slot: null, gruppen: [{
        rolle: ROLLE_ZU_TYP[haupt] ?? null, wdhText: '', rpe: null, notiz: null, vorschlag: false, saetzeText: null,
        saetze: (u.saetze ?? []).map((s) => ({ id: s.id, typ: s.typ ?? 'working', kg: s.kg ?? null, wdh: s.wdh ?? null, rpe: s.rpe ?? null,
          erledigt: s.fertig !== false, zeit: s.zeit ?? null, geplant: s.geplant ?? null, dauer: s.dauer, strecke: s.strecke, notiz: s.notiz, extra: s.extra,
          e1rm: null, pr: false, geaendert: true })),
      }] };
    }),
  };
}

/** Lokales Training → Argument für public.sync_workout. Ungültige Zahlen werden leer statt die Transaktion zu kippen. */
export function zuServer(w) {
  if (!w.id || !/^\d{4}-\d{2}-\d{2}$/.test(w.datum ?? '')) throw new Error('Training ohne id oder gültiges Datum');
  return {
    id: w.id, client_id: w.clientId ?? w.id, run_id: w.runId ?? null, week: zahl(w.woche, { ganz: true }), day_offset: zahl(w.tagOffset, { ganz: true }),
    date: w.datum, started_at: w.start ?? null, finished_at: w.ende ?? null, session_rpe: zahl(w.sessionRpe, { min: 1, max: 10 }),
    readiness: w.bereitschaft ?? null, bodyweight_kg: zahl(w.koerpergewicht, { min: 0, max: 999 }), notes: w.notiz || null, source: w.quelle ?? 'app',
    exercises: (w.uebungen ?? []).filter((u) => u.key).map((u) => ({
      id: u.id, client_id: u.clientId ?? u.id, exercise_key: UMBENANNT[u.key] ?? u.key, superset_group: zahl(u.supersatz, { ganz: true }), notes: u.notiz || null,
      sets: (u.saetze ?? []).map((s) => ({
        id: s.id, client_id: s.clientId ?? s.id, set_type: TYPEN.has(s.typ) ? s.typ : 'working',
        weight_kg: zahl(s.kg, { min: 0, max: 9999 }), reps: zahl(s.wdh, { min: 0, max: 1000, ganz: true }), rpe: zahl(s.rpe, { min: 1, max: 10 }),
        duration_s: zahl(s.dauer, { min: 0, ganz: true }), distance_m: zahl(s.strecke, { min: 0 }), planned: s.geplant ?? null,
        completed: s.fertig !== false, notes: s.notiz || null, logged_at: s.zeit ?? w.ende ?? w.start ?? null,
        extra: s.extra && Object.keys(s.extra).length ? s.extra : null,        // Ausrüstung, Bänder, Ketten, m/s (Spalte ab Update 08)
      })),
    })),
  };
}

export const WORKOUT_SELECT = 'id, client_id, run_id, week, day_offset, date, started_at, finished_at, session_rpe, readiness, bodyweight_kg, notes, source, updated_at, '
  + 'workout_exercises(id, client_id, position, superset_group, notes, exercises(key), '
  + 'sets(*))';      // alle Satzspalten: extra kommt erst mit Update 08, der Abruf darf davor nicht scheitern

const nachPosition = (a, b) => a.position - b.position;
const num = (x) => (x == null ? null : Number(x));     // numeric kommt von PostgREST als Zahl, zur Sicherheit auch als Text

/** Zeile aus WORKOUT_SELECT → lokales Training. */
export function ausServer(r) {
  return {
    id: r.id, clientId: r.client_id ?? r.id, datum: r.date, start: r.started_at, ende: r.finished_at, sessionRpe: num(r.session_rpe),
    koerpergewicht: num(r.bodyweight_kg), notiz: r.notes, quelle: r.source, runId: r.run_id, woche: r.week, tagOffset: r.day_offset,
    bereitschaft: r.readiness, geaendert: r.updated_at, offen: false, geloescht: false,
    uebungen: [...(r.workout_exercises ?? [])].sort(nachPosition).map((u) => ohneLeer({
      id: u.id, clientId: u.client_id ?? u.id, key: u.exercises?.key, supersatz: u.superset_group ?? undefined, notiz: u.notes,
      saetze: [...(u.sets ?? [])].sort(nachPosition).map((s) => ohneLeer({
        id: s.id, clientId: s.client_id ?? s.id, typ: s.set_type, kg: num(s.weight_kg), wdh: s.reps, rpe: num(s.rpe),
        dauer: s.duration_s ?? undefined, strecke: num(s.distance_m) ?? undefined, geplant: s.planned ?? undefined,
        fertig: s.completed, notiz: s.notes ?? undefined, zeit: s.logged_at, extra: s.extra ?? undefined,
      })),
    })),
  };
}

/**
 * Server-Stand in die lokale Liste einarbeiten. Offene (noch nicht hochgeladene) lokale Trainings bleiben.
 * serverIds (optional, vollständige Liste): lokal gespeicherte, abgeglichene Trainings, die auf dem Server fehlen, fallen weg.
 */
export function mische(lokal, geholt, serverIds = null) {
  const nach = new Map(lokal.map((w) => [w.id, w]));
  for (const s of geholt) {
    const l = nach.get(s.id);
    if (l?.offen) continue;
    nach.set(s.id, s);
  }
  if (serverIds) {
    const da = new Set(serverIds);
    for (const [id, w] of nach) if (!w.offen && !da.has(id)) nach.delete(id);
  }
  return [...nach.values()];
}

/** Jüngster Server-Stand (updated_at) der Liste – Startpunkt für das nächste Holen. */
export const letzterStand = (liste) => liste.reduce((m, w) => (w.geaendert && (!m || w.geaendert > m) ? w.geaendert : m), null);

// #################################################################
// Netz (supabase = Client aus js/supabase.js)
// #################################################################
const SEITE = 100;

async function pruefe(antwort) {
  if (antwort.error) throw new Error(antwort.error.message ?? String(antwort.error));
  return antwort.data;
}

/** Ein Training hochladen; Rückgabe: neuer Server-Stand (updated_at). */
export async function hochladen(supabase, w) {
  if (w.geloescht) {
    await pruefe(await supabase.from('workouts').delete().eq('id', w.id));
    return null;
  }
  return pruefe(await supabase.rpc('sync_workout', { p: zuServer(w) }));
}

/** Trainings holen, die sich seit `seit` (updated_at) geändert haben; ohne `seit` alles. */
export async function holen(supabase, seit = null) {
  const aus = [];
  for (let von = 0; ; von += SEITE) {
    let q = supabase.from('workouts').select(WORKOUT_SELECT).order('updated_at').order('id').range(von, von + SEITE - 1);
    // gt, nicht gte: der Jefit-Import hat einen gemeinsamen Zeitstempel und würde sonst jedes Mal komplett neu geladen.
    // Innerhalb eines Abrufs blättert der Offset, daher gehen gleiche Zeitstempel an Seitengrenzen nicht verloren.
    if (seit) q = q.gt('updated_at', seit);
    const daten = await pruefe(await q);
    aus.push(...daten.map(ausServer));
    if (daten.length < SEITE) return aus;
  }
}

/** Alle Trainings-IDs auf dem Server (erkennt Löschungen von einem anderen Gerät). */
export async function serverIds(supabase) {
  const ids = [];
  for (let von = 0; ; von += 1000) {
    const daten = await pruefe(await supabase.from('workouts').select('id').order('id').range(von, von + 999));
    ids.push(...daten.map((r) => r.id));
    if (daten.length < 1000) return ids;
  }
}

/**
 * Vollständiger Abgleich: erst offene hochladen, dann holen und mischen.
 * speicher: { alle(), schreibe(w), entferne(id), meta(k), setzeMeta(k, v) } aus js/lokal.js.
 * Rückgabe: { hoch, runter, fehler } – Fehler einzelner Trainings brechen den Rest nicht ab.
 */
export async function abgleichen(supabase, speicher) {
  const fehler = [];
  let hoch = 0;
  for (const w of (await speicher.alle()).filter((x) => x.offen)) {
    try {
      const stand = await hochladen(supabase, w);
      if (w.geloescht) await speicher.entferne(w.id);
      else await speicher.schreibe({ ...w, offen: false, geaendert: stand ?? w.geaendert });
      hoch += 1;
    } catch (e) {
      fehler.push({ id: w.id, datum: w.datum, meldung: e.message });
    }
  }
  const seit = await speicher.meta('serverStand');
  const geholt = await holen(supabase, seit);
  const ids = await serverIds(supabase);
  const lokal = await speicher.alle();
  const neu = mische(lokal, geholt, ids);
  const neuIds = new Set(neu.map((w) => w.id));
  for (const w of lokal) if (!neuIds.has(w.id)) await speicher.entferne(w.id);
  const geholtIds = new Set(geholt.map((w) => w.id));
  for (const w of neu) if (geholtIds.has(w.id) && !w.offen) await speicher.schreibe(w);
  const stand = letzterStand(neu);
  if (stand) await speicher.setzeMeta('serverStand', stand);
  return { hoch, runter: geholt.length, fehler };
}
