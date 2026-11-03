// PR Hunter · Beschwerden/Verletzungen (Wunsch 216): Region melden → betroffene Übungen des Plans für ein paar Wochen
// schonend ersetzen (oder nur leichter). Die Ersatzübungen entlasten die Region, ohne den Muskel ganz auszulassen.
// Je Region: Übungsart (Katalogfeld f) bzw. einzelne Übung → Ersatz; null = nicht ersetzen, nur leichter.

export const REGIONEN = [
  ['schulter', 'Schulter', 'Shoulder', { bench: 'machine_bench_press', press: 'machine_shoulder_military_press', dip: 'triceps_pushdown_-_rope_attachment', fly: 'butterfly',
    push_up: 'machine_bench_press', pull_up: 'wide-grip_lat_pulldown', shoulder_iso: 'cable_lateral_raise' }],
  ['ellbogen', 'Ellbogen', 'Elbow', { curl: 'hammer_curls', triceps: 'triceps_pushdown_-_rope_attachment', dip: 'triceps_pushdown_-_rope_attachment', pull_up: 'wide-grip_lat_pulldown', bench: null }],
  ['handgelenk', 'Handgelenk', 'Wrist', { bench: 'machine_bench_press', press: 'machine_shoulder_military_press', curl: 'hammer_curls', push_up: 'machine_bench_press', squat: null }],
  ['ruecken', 'Unterer Rücken', 'Lower back', { deadlift: 'barbell_hip_thrust', hinge: 'lying_leg_curls', row: 'seated_cable_rows', squat: 'leg_press', olympic: null }],
  ['huefte', 'Hüfte', 'Hip', { squat: 'leg_press', deadlift: 'lying_leg_curls', hinge: 'lying_leg_curls', lunge: 'leg_extensions' }],
  ['knie', 'Knie', 'Knee', { squat: 'barbell_hip_thrust', squat_machine: 'barbell_hip_thrust', lunge: 'romanian_deadlift', leg_extensions: 'lying_leg_curls' }],
  ['nacken', 'Nacken', 'Neck', { shrug: 'face_pull', press: 'machine_shoulder_military_press' }],
];
export const STUFEN = [['leicht', 'Leicht', 'Mild'], ['mittel', 'Mittel', 'Moderate'], ['stark', 'Stark', 'Severe']];

/**
 * Was passiert mit diesen Übungen? uebung(key) → Katalogeintrag (f = Übungsart).
 * Rückgabe [{ key, ersatz (key | null) }] nur für betroffene Übungen; Ersatz nur, wenn er im Katalog steht und nicht dieselbe Übung ist.
 */
export function betroffene(keys, region, uebung) {
  const regel = REGIONEN.find(([k]) => k === region)?.[3];
  if (!regel) return [];
  return [...new Set(keys)].filter(Boolean).map((key) => {
    const art = uebung(key)?.f;
    const treffer = key in regel ? regel[key] : art in regel ? regel[art] : undefined;
    if (treffer === undefined) return null;
    return { key, ersatz: treffer && treffer !== key && uebung(treffer) ? treffer : null };
  }).filter(Boolean);
}

/** Aktive Beschwerden (bis einschließlich heute), die den Plan anpassen. */
export const aktiveBeschwerden = (liste, heute) => (liste ?? []).filter((b) => b.bis >= heute && b.von <= heute);

/** Anpassung für einen Trainingstag: Map key → { ersatz | null, leichter (bool), region } aus allen aktiven Beschwerden. */
export function anpassungFuer(keys, liste, heute, uebung) {
  const aus = new Map();
  for (const b of aktiveBeschwerden(liste, heute)) {
    if (b.modus === 'notieren') continue;
    for (const t of betroffene(keys, b.region, uebung)) {
      if (aus.has(t.key)) continue;
      aus.set(t.key, { ersatz: b.modus === 'tauschen' ? t.ersatz : null, leichter: b.modus === 'leichter' || (b.modus === 'tauschen' && !t.ersatz), region: b.region });
    }
  }
  return aus;
}
