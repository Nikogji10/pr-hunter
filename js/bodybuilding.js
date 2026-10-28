// PR Hunter · Bodybuilding-Generator (Wunsch 98): Split wählen, je Muskelgruppe zwei Übungen, Trainingstage pro Woche.
// Aufbau wie in gängigen Hypertrophie-Blöcken (z. B. Renaissance Periodization, Jeff Nippard): 10–20 harte Sätze je
// Muskel und Woche, jede Gruppe möglichst 2× pro Woche, Grundübungen 6–10 Wdh, Isolationen 10–15 Wdh.
// Block: Grundübungen steigern die RPE von 7–8 (W1) bis 9–9,5 (letzte Woche) – RPE 10 nur an Maschinen; Isolationen
// immer RPE 9, letzter Satz bis 10 (Nikos Vorgabe). Danach Deload: halbe Sätze, RPE 6–7. Gewichte setzt die App beim
// Training aus RPE + bestem e1RM (keine Maxe nötig).

/** Muskelgruppen mit Auswahl (erste zwei = Vorschlag); g = Grundübung (schwer, 6–10 Wdh), m = Maschine (RPE 10 erlaubt). */
export const MUSKELGRUPPEN = {
  brust: { name: 'Brust', saetze: 12, uebungen: [['dumbbell_bench_press', 'g'], ['cable_crossover', ''], ['incline_dumbbell_press', 'g'], ['machine_bench_press', 'gm'], ['butterfly', 'm'], ['barbell_incline_bench_press_-_medium_grip', 'g']] },
  ruecken: { name: 'Rücken', saetze: 14, uebungen: [['wide-grip_lat_pulldown', 'gm'], ['seated_cable_rows', 'gm'], ['pullups', 'g'], ['bent_over_barbell_row', 'g'], ['one-arm_dumbbell_row', 'g'], ['t-bar_row_with_handle', 'g']] },
  schulter: { name: 'Schultern', saetze: 12, uebungen: [['seated_dumbbell_press', 'g'], ['side_lateral_raise', ''], ['cable_lateral_raise', ''], ['machine_shoulder_military_press', 'gm'], ['machine_lateral_raise', 'm']] },
  hintere_schulter: { name: 'Hintere Schulter', saetze: 8, uebungen: [['face_pull', ''], ['reverse_machine_flyes', 'm'], ['reverse_flyes', '']] },
  bizeps: { name: 'Bizeps', saetze: 10, uebungen: [['ez-bar_curl', ''], ['hammer_curls', ''], ['incline_dumbbell_curl', ''], ['preacher_curl', 'm'], ['dumbbell_bicep_curl', '']] },
  trizeps: { name: 'Trizeps', saetze: 10, uebungen: [['triceps_pushdown_-_rope_attachment', 'm'], ['cable_rope_overhead_triceps_extension', 'm'], ['ez-bar_skullcrusher', ''], ['dips_-_triceps_version', 'g']] },
  quads: { name: 'Quadrizeps', saetze: 12, uebungen: [['hack_squat', 'gm'], ['leg_extensions', 'm'], ['leg_press', 'gm'], ['barbell_squat', 'g'], ['front_barbell_squat', 'g']] },
  beinbeuger: { name: 'Beinbeuger', saetze: 10, uebungen: [['romanian_deadlift', 'g'], ['seated_leg_curl', 'm'], ['lying_leg_curls', 'm']] },
  gesaess: { name: 'Gesäß', saetze: 6, uebungen: [['barbell_hip_thrust', 'g'], ['barbell_glute_bridge', '']] },
  waden: { name: 'Waden', saetze: 8, uebungen: [['standing_calf_raises', 'm'], ['seated_calf_raise', 'm'], ['calf_press_on_the_leg_press_machine', 'm']] },
  bauch: { name: 'Bauch', saetze: 6, uebungen: [['cable_crunch', 'm'], ['hanging_leg_raise', ''], ['ab_crunch_machine', 'm']] },
};

/** Splits: Trainingstage eines Durchlaufs mit ihren Muskelgruppen (in Reihenfolge: groß vor klein). */
export const SPLITS = {
  ppl: { name: 'Push / Pull / Legs', text: 'Drücken · Ziehen · Beine – mit 6 Tagen jede Gruppe 2×', tage: [
    ['Push', ['brust', 'schulter', 'trizeps']], ['Pull', ['ruecken', 'hintere_schulter', 'bizeps']], ['Legs', ['quads', 'beinbeuger', 'gesaess', 'waden', 'bauch']]] },
  ul: { name: 'Oberkörper / Unterkörper', text: 'Oben · Unten im Wechsel – mit 4 Tagen jede Gruppe 2×', tage: [
    ['Oberkörper', ['brust', 'ruecken', 'schulter', 'hintere_schulter', 'bizeps', 'trizeps']], ['Unterkörper', ['quads', 'beinbeuger', 'gesaess', 'waden', 'bauch']]] },
  gk: { name: 'Ganzkörper', text: 'Jeder Tag alles, je Übung weniger Sätze – gut bei 3 Tagen', tage: [
    ['Ganzkörper', ['quads', 'brust', 'ruecken', 'beinbeuger', 'schulter', 'bizeps', 'trizeps']]] },
  bro: { name: 'Bro-Split', text: 'Ein Körperteil pro Tag – jede Gruppe 1×, viele Sätze', tage: [
    ['Brust', ['brust', 'trizeps']], ['Rücken', ['ruecken', 'hintere_schulter']], ['Schultern', ['schulter', 'bauch']], ['Arme', ['bizeps', 'trizeps']], ['Beine', ['quads', 'beinbeuger', 'gesaess', 'waden']]] },
};

// Wochentage je Anzahl Trainingstage (Offsets ab Montag), Pausen möglichst verteilt
const WOCHENTAGE = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
// RPE je Woche für Grundübungen (letzte Aufbauwoche = Spitze); Maschinen dürfen in der Spitzenwoche bis 10
const RPE_GRUND = { 4: ['7-8', '8', '8.5-9', '9-9.5'], 5: ['7-8', '8', '8.5', '9', '9-9.5'], 6: ['7-8', '7.5-8', '8', '8.5', '9', '9-9.5'] };

/** Vorgeschlagene Auswahl: je Gruppe die ersten zwei Übungen. */
export const standardAuswahl = () => Object.fromEntries(Object.entries(MUSKELGRUPPEN).map(([g, m]) => [g, m.uebungen.slice(0, 2).map(([k]) => k)]));

const art = (gruppe, key) => MUSKELGRUPPEN[gruppe].uebungen.find(([k]) => k === key)?.[1] ?? '';

/** Wie oft jede Muskelgruppe pro Woche drankommt (bei gegebenem Split und Tagen). */
export function haeufigkeit(split, tageProWoche) {
  const s = SPLITS[split], h = {};
  for (let i = 0; i < tageProWoche; i++) for (const g of s.tage[i % s.tage.length][1]) h[g] = (h[g] ?? 0) + 1;
  return h;
}

/**
 * Programm erzeugen. e: { name, split, tage (2–6), wochen (4–6 Aufbau), deload (bool), auswahl: { gruppe: [key, key] } }
 * Rückgabe: Programm im App-Format (ohne Maxe; Gewichte kommen beim Training aus RPE + e1RM).
 */
export function generiereBodybuilding(e) {
  const split = SPLITS[e.split] ?? SPLITS.ppl, tage = Math.min(6, Math.max(2, e.tage ?? 4)), wochen = Math.min(6, Math.max(4, e.wochen ?? 4));
  const auswahl = { ...standardAuswahl(), ...(e.auswahl ?? {}) };
  const h = haeufigkeit(e.split ?? 'ppl', tage);
  const offsets = WOCHENTAGE[tage];
  const weeks = [];
  for (let w = 0; w < wochen + (e.deload !== false ? 1 : 0); w++) {
    const deload = w === wochen, spitze = w === wochen - 1;
    const days = offsets.map((off, i) => {
      const [label, gruppen] = split.tage[i % split.tage.length];
      const items = gruppen.flatMap((g) => {
        const keys = (auswahl[g] ?? []).filter(Boolean).slice(0, 2);
        // Sätze je Übung: Wochenziel der Gruppe ÷ (Häufigkeit × Übungen); +1 ab der zweiten Hälfte (Volumen steigt)
        const ziel = MUSKELGRUPPEN[g].saetze + (w >= Math.ceil(wochen / 2) && !deload ? 2 : 0);
        const jeUebung = Math.max(2, Math.min(5, Math.round(ziel / ((h[g] ?? 1) * Math.max(1, keys.length)))));
        return keys.map((key) => {
          const a = art(g, key), grund = a.includes('g'), maschine = a.includes('m');
          const saetze = deload ? Math.max(1, Math.ceil(jeUebung / 2)) : jeUebung;
          const rpe = deload ? 'RPE 6-7' : grund ? `RPE ${spitze && maschine ? '9.5-10' : RPE_GRUND[wochen][w]}` : `RPE ${spitze ? '10' : '9'}`;
          const note = deload ? 'Deload – locker, Technik' : !grund && !spitze ? 'Letzter Satz bis RPE 10' : null;
          return { exercise_key: key, role: null, groups: [{ sets: String(saetze), reps: grund ? '6-10' : '10-15', rpe, ...(note ? { note } : {}) }] };
        });
      });
      return { offset: w * 7 + off, label, items };
    });
    weeks.push({ week: w + 1, title: `Woche ${w + 1} – ${deload ? 'Deload' : spitze ? 'Spitze' : w === 0 ? 'Einstieg' : 'Aufbau'}`, typ: deload ? 'deload' : 'aufbau', days });
  }
  return {
    id: `bodybuilding-${Date.now()}`, name: e.name || `${split.name} ${tage}×/Woche`,
    source: 'Bodybuilding-Generator: 10–20 Sätze je Muskel/Woche, RPE-Steigerung, Deload', kategorie: 'bodybuilding',
    inputs: [], weeks, settings: { cut_mode: { reduce_sets: 1, min_sets: 1 } },
    rules: { bodybuilding: { split: e.split ?? 'ppl', tage, wochen, deload: e.deload !== false, auswahl } },
  };
}
