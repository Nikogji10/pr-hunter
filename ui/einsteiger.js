// PR Hunter · Einsteigerpläne mit einem Tipp (Wunsch 163 a): Ganzkörper 2× oder 3× pro Woche, überwiegend Maschinen und
// Kurzhanteln, ohne Maxe. Gespeichert als eigener Plan (eigenerPlanAus); Gewichte kommen im Training als Vorschlag
// („Heute: … (+2,5 kg / 1 Wdh mehr)“) bzw. beim ersten Mal mit dem Hinweis, leicht anzufangen.
const u = (key, saetze = 3, wdh = '8-12', rpe = 8) => ({ key, saetze: String(saetze), wdh, rpe: String(rpe) });

const A = [u('leg_press', 3, '10-12', 7), u('dumbbell_bench_press', 3, '8-12'), u('wide-grip_lat_pulldown', 3, '8-12'),
  u('seated_dumbbell_press', 2, '10-12'), u('lying_leg_curls', 2, '10-15'), u('cable_crunch', 2, '12-15')];
const B = [u('romanian_deadlift', 3, '8-12', 7), u('incline_dumbbell_press', 3, '8-12'), u('seated_cable_rows', 3, '8-12'),
  u('leg_extensions', 2, '12-15'), u('side_lateral_raise', 2, '12-15'), u('ez-bar_curl', 2, '10-12'), u('triceps_pushdown_-_rope_attachment', 2, '10-12')];

export const EINSTEIGER = [
  { id: 'gk2', name: 'Einsteiger Ganzkörper 2×', text: 'Zwei Tage pro Woche, je 6–7 Übungen, alles mit Vorschlägen – ideal zum Anfangen.',
    tage: [{ name: 'Ganzkörper A', uebungen: A }, { name: 'Ganzkörper B', uebungen: B }] },
  { id: 'gk3', name: 'Einsteiger Ganzkörper 3×', text: 'Drei Tage pro Woche im Wechsel A/B/A – schnellerer Fortschritt bei kurzer Einheit.',
    tage: [{ name: 'Ganzkörper A', uebungen: A }, { name: 'Ganzkörper B', uebungen: B }, { name: 'Ganzkörper A', uebungen: A }] },
];
