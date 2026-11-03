// PR Hunter · Frag die KI (Wunsch 221, Variante 1): Frage + kompakte Trainingsdaten als Text für ChatGPT, Gemini oder Claude.
// Nichts wird verschickt – der Text landet in der Zwischenablage, der Nutzer fügt ihn selbst ein. Keine Namen von Freunden,
// keine E-Mail, keine IDs. Pure Funktionen (ohne DOM), damit testbar.
import { HAUPT, kanon } from './daten.js';
import { e1rm } from './rechnen.js';

const TAG = 864e5;
const tage = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / TAG);
const plus = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * TAG).toISOString().slice(0, 10);
const montag = (d) => plus(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));
const zahl = (n, en) => (n == null ? '–' : String(Math.round(n * 10) / 10).replace('.', en ? '.' : ','));

/** Sätze kompakt: gleiche aufeinanderfolgende Sätze zusammengefasst – „3×170×3 @8, 1×150×5“. */
export function satzFolge(saetze, en = false) {
  const g = [];
  for (const s of saetze) { const l = g.at(-1); if (l && l.kg === s.kg && l.wdh === s.wdh && l.rpe === s.rpe) l.n++; else g.push({ ...s, n: 1 }); }
  return g.map((s) => `${s.n}×${s.kg ? zahl(s.kg, en) : (en ? 'BW' : 'KG')}×${s.wdh ?? '–'}${s.rpe != null ? ` @${zahl(s.rpe, en)}` : ''}`).join(', ');
}

/** Bestes e1RM je Woche und Hauptlift (Wettkampfübung, 1–10 Wdh). */
export function e1rmJeWoche(einheiten, von) {
  const w = {};
  for (const e of einheiten) {
    if (e.datum < von) continue;
    for (const u of e.uebungen) {
      const l = Object.keys(HAUPT).find((k) => HAUPT[k] === kanon(u.key));
      if (!l) continue;
      for (const s of u.saetze) if (s.kg > 0 && s.wdh >= 1 && s.wdh <= 10) {
        const m = montag(e.datum), v = e1rm(s.kg, s.wdh);
        (w[m] ??= {})[l] = Math.max(w[m][l] ?? 0, v);
      }
    }
  }
  return Object.keys(w).sort().map((m) => ({ woche: m, ...w[m] }));
}

/**
 * Text für die KI. einheiten: normierte Trainings ({ datum, start, ende, sessionRpe?, notiz?, uebungen }), aufsteigend.
 * profil: { trainingsart, koerpergewicht, wettkampfDatum, gewichtsklasse, block: { name, woche, wochen } | null,
 *           e1rm: { squat, bench, dead }, beschwerden: [{ region, bis }] }
 */
export function kiText({ frage, einheiten, heute, wochen = 8, profil = {}, name = (k) => k, sprache = 'de' }) {
  const en = sprache === 'en', L = (de, e) => (en ? e : de);
  const von = plus(heute, -7 * wochen), liste = einheiten.filter((e) => e.datum >= von && e.datum <= heute);
  const LIFT = { squat: L('Kniebeuge', 'Squat'), bench: L('Bankdrücken', 'Bench press'), dead: L('Kreuzheben', 'Deadlift') };
  const z = [];
  z.push(L('Du bist ein erfahrener Kraftsport-Coach (Powerlifting, Krafttraining). Unten stehen meine Trainingsdaten aus meiner App „PR Hunter“. Beantworte meine Frage konkret und mit Zahlen aus den Daten. Wenn etwas fehlt, sag, was du noch wissen musst.',
    'You are an experienced strength coach (powerlifting, strength training). Below is my training data from my app “PR Hunter”. Answer my question specifically, using numbers from the data. If something is missing, tell me what else you need.'));
  z.push('', `## ${L('Meine Frage', 'My question')}`, frage.trim(), '');
  z.push(`## ${L('Profil', 'Profile')} (${L('Stand', 'as of')} ${heute})`);
  if (profil.trainingsart) z.push(`- ${L('Trainingsart', 'Training style')}: ${profil.trainingsart === 'einfach' ? L('Bodybuilding / Krafttraining', 'Bodybuilding / strength') : 'Powerlifting'}`);
  if (profil.koerpergewicht) z.push(`- ${L('Körpergewicht', 'Bodyweight')}: ${zahl(profil.koerpergewicht, en)} kg`);
  if (profil.gewichtsklasse) z.push(`- ${L('Gewichtsklasse', 'Weight class')}: ${profil.gewichtsklasse} kg`);
  if (profil.wettkampfDatum && profil.wettkampfDatum >= heute) z.push(`- ${L('Nächster Wettkampf', 'Next meet')}: ${profil.wettkampfDatum} (${L('in', 'in')} ${Math.ceil(tage(heute, profil.wettkampfDatum) / 7)} ${L('Wochen', 'weeks')})`);
  if (profil.block) z.push(`- ${L('Aktueller Block', 'Current block')}: ${profil.block.name}${profil.block.wochen ? `, ${L('Woche', 'week')} ${profil.block.woche}/${profil.block.wochen}` : ''}`);
  const e = profil.e1rm ?? {};
  if (Object.values(e).some(Boolean)) {
    const total = e.squat && e.bench && e.dead ? e.squat + e.bench + e.dead : null;
    z.push(`- ${L('Aktuelles e1RM', 'Current e1RM')}: ${Object.keys(LIFT).filter((l) => e[l]).map((l) => `${LIFT[l]} ${zahl(e[l], en)} kg`).join(' · ')}${total ? ` · Total ${zahl(total, en)} kg` : ''}`);
  }
  for (const b of profil.beschwerden ?? []) z.push(`- ${L('Beschwerden', 'Discomfort')}: ${b.region} (${L('schonen bis', 'protect until')} ${b.bis})`);
  z.push(`- ${L('Trainings im Zeitraum', 'Workouts in period')}: ${liste.length} ${L('in', 'in')} ${wochen} ${L('Wochen', 'weeks')}`);

  const verlauf = e1rmJeWoche(einheiten, von);
  if (verlauf.length) {
    z.push('', `## ${L('Bestes e1RM je Woche (kg, Wettkampfübung)', 'Best e1RM per week (kg, competition lift)')}`);
    z.push(`${L('Woche ab', 'Week of')} | ${Object.values(LIFT).join(' | ')}`);
    for (const w of verlauf) z.push(`${w.woche} | ${Object.keys(LIFT).map((l) => zahl(w[l], en)).join(' | ')}`);
  }

  z.push('', `## ${L('Trainings', 'Workouts')} (${L('Sätze × kg × Wdh @RPE, ohne Aufwärmen', 'sets × kg × reps @RPE, no warm-ups')})`);
  for (const t of [...liste].reverse()) {
    const min = t.start && t.ende && t.ende > t.start ? Math.round((t.ende - t.start) / 60000) : null;
    z.push(`### ${t.datum}${min && min < 600 ? ` · ${min} min` : ''}${t.sessionRpe ? ` · ${L('Session-RPE', 'session RPE')} ${zahl(t.sessionRpe, en)}` : ''}`);
    for (const u of t.uebungen) z.push(`- ${name(u.key)}: ${satzFolge(u.saetze, en)}`);
    if (t.notiz) z.push(`${L('Notiz', 'Note')}: ${t.notiz.replace(/\s+/g, ' ').trim()}`);
  }
  if (!liste.length) z.push(L('(keine Trainings im Zeitraum)', '(no workouts in this period)'));
  return z.join('\n');
}

/** Beispielfragen für die Chips. */
export const BEISPIELE = [
  ['Wie war meine letzte Trainingswoche? Was lief gut, was sollte ich ändern?', 'How was my last training week? What went well, what should I change?'],
  ['Wo stagniere ich und woran könnte das liegen?', 'Where am I stalling and why might that be?'],
  ['Bin ich bereit für einen Max-Test? Welche Versuche würdest du mir vorschlagen?', 'Am I ready for a max test? Which attempts would you suggest?'],
  ['Passen mein Volumen und meine Erholung, oder trainiere ich zu viel bzw. zu wenig?', 'Are my volume and recovery right, or am I doing too much or too little?'],
  ['Welche Schwachstellen zeigen meine Daten, und welche Zusatzübungen helfen?', 'What weak points does my data show, and which accessories would help?'],
  ['Wie sollte mein nächster Block aussehen?', 'What should my next block look like?'],
];

/** Wo die KI aufgeht (Startseite des Chats; der Text kommt per Einfügen). */
export const KI_ZIELE = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/new' },
];
