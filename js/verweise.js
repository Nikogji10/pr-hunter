// PR Hunter · Links zum Vergleich mit anderen Lifter:innen. Keine Daten werden übernommen, nur verlinkt.
// Adressen geprüft am 22.10.2026 (strengthlevel.com/strength-standards, symmetricstrength.com/standards).

const STRENGTH_LEVEL = {
  competition_squat: 'squat', barbell_squat: 'squat',
  competition_bench_press: 'bench-press', 'barbell_bench_press_-_medium_grip': 'bench-press',
  competition_deadlift: 'deadlift', barbell_deadlift: 'deadlift',
  standing_military_press: 'military-press',
  pullups: 'pull-ups', weighted_pull_ups: 'pull-ups', weighted_neutral_grip_pull_up: 'pull-ups', 'chin-up': 'chin-ups',
  parallel_bar_dip: 'dips', 'dips_-_chest_version': 'dips', 'dips_-_triceps_version': 'dips',
  bent_over_barbell_row: 'bent-over-row', 'barbell_incline_bench_press_-_medium_grip': 'incline-bench-press',
  'close-grip_barbell_bench_press': 'close-grip-bench-press', dumbbell_bench_press: 'dumbbell-bench-press',
  romanian_deadlift: 'romanian-deadlift', sumo_deadlift: 'sumo-deadlift', barbell_hip_thrust: 'hip-thrust',
  leg_press: 'sled-leg-press', lat_pulldown_medium_grip: 'lat-pulldown', dumbbell_bicep_curl: 'dumbbell-curl',
  barbell_curl: 'barbell-curl', power_clean: 'power-clean',
};
const SYMMETRIC = {
  competition_squat: 'squat', barbell_squat: 'squat',
  competition_bench_press: 'bench-press', 'barbell_bench_press_-_medium_grip': 'bench-press',
  competition_deadlift: 'deadlift', barbell_deadlift: 'deadlift', standing_military_press: 'shoulder-press',
  pullups: 'pull-ups', weighted_pull_ups: 'pull-ups', weighted_neutral_grip_pull_up: 'pull-ups',
};

/** Links für eine Übung; leere Liste, wenn keine der Seiten sie führt. */
export function vergleichsLinks(key, einheit = 'kg') {
  const links = [];
  if (STRENGTH_LEVEL[key]) links.push({ name: 'Strength Level', url: `https://strengthlevel.com/strength-standards/${STRENGTH_LEVEL[key]}/${einheit === 'lb' ? 'lb' : 'kg'}` });
  if (SYMMETRIC[key]) links.push({ name: 'Symmetric Strength', url: `https://symmetricstrength.com/standards/${SYMMETRIC[key]}` });
  return links;
}
export const SYMMETRIC_RECHNER = 'https://symmetricstrength.com/';
