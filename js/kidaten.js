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

/** Bodybuilding: je Übung erste und letzte Einheit im Zeitraum (bester Satz nach e1RM), häufigste zuerst. */
export function fortschrittJeUebung(liste, max = 12) {
  const je = new Map();
  for (const e of liste) for (const u of e.uebungen) {
    const best = u.saetze.filter((s) => s.kg > 0 && s.wdh >= 1 && s.wdh <= 20).reduce((b, s) => (!b || e1rm(s.kg, s.wdh) > e1rm(b.kg, b.wdh) ? s : b), null);
    if (best) (je.get(u.key) ?? je.set(u.key, []).get(u.key)).push({ datum: e.datum, ...best });
  }
  return [...je.entries()].map(([key, l]) => ({ key, n: l.length, erste: l[0], letzte: l.at(-1) })).sort((a, b) => b.n - a.n).slice(0, max);
}

/** Bodybuilding: Arbeitssätze je Muskel und Woche (Schnitt über den Zeitraum), Hauptmuskeln der Übung. */
export function saetzeJeMuskel(liste, wochen, muskeln) {
  const n = {};
  for (const e of liste) for (const u of e.uebungen) for (const m of muskeln(u.key)) n[m] = (n[m] ?? 0) + u.saetze.length;
  return Object.entries(n).map(([m, s]) => [m, Math.round((s / wochen) * 10) / 10]).sort((a, b) => b[1] - a[1]);
}

/**
 * Text für die KI. einheiten: normierte Trainings ({ datum, start, ende, sessionRpe?, notiz?, uebungen }), aufsteigend.
 * profil: { trainingsart, koerpergewicht, wettkampfDatum, gewichtsklasse, block: { name, woche, wochen } | null,
 *           e1rm: { squat, bench, dead }, beschwerden: [{ region, bis }], gewichtZiel }
 * art: 'pl' (Powerlifting) | 'bb' (Bodybuilding/Krafttraining) – andere Rolle, andere Daten. muskeln(key) → Hauptmuskeln.
 */
export function kiText({ frage, einheiten, heute, wochen = 8, profil = {}, name = (k) => k, sprache = 'de', art = 'pl', muskeln = () => [] }) {
  const en = sprache === 'en', L = (de, e) => (en ? e : de), pl = art !== 'bb';
  const von = plus(heute, -7 * wochen), liste = einheiten.filter((e) => e.datum >= von && e.datum <= heute);
  const LIFT = { squat: L('Kniebeuge', 'Squat'), bench: L('Bankdrücken', 'Bench press'), dead: L('Kreuzheben', 'Deadlift') };
  const z = [];
  z.push(pl
    ? L('Du bist ein erfahrener Powerlifting-Coach (Kniebeuge, Bankdrücken, Kreuzheben; RPE-basierte Programmierung, Periodisierung, Peaking auf Wettkämpfe). Unten stehen meine Trainingsdaten aus meiner App „PR Hunter“. Beantworte meine Frage konkret und mit Zahlen aus den Daten (e1RM, Sätze, RPE). Wenn etwas fehlt, sag, was du noch wissen musst.',
      'You are an experienced powerlifting coach (squat, bench press, deadlift; RPE-based programming, periodisation, peaking for meets). Below is my training data from my app “PR Hunter”. Answer my question specifically, using numbers from the data (e1RM, sets, RPE). If something is missing, tell me what else you need.')
    : L('Du bist ein erfahrener Coach für Muskelaufbau und Krafttraining (Hypertrophie: Volumen je Muskel, progressive Überlastung, Übungsauswahl, Erholung). Unten stehen meine Trainingsdaten aus meiner App „PR Hunter“. Beantworte meine Frage konkret und mit Zahlen aus den Daten (Sätze je Muskel, Gewichte, Wiederholungen). Wenn etwas fehlt, sag, was du noch wissen musst.',
      'You are an experienced coach for muscle building and strength training (hypertrophy: volume per muscle, progressive overload, exercise selection, recovery). Below is my training data from my app “PR Hunter”. Answer my question specifically, using numbers from the data (sets per muscle, weights, reps). If something is missing, tell me what else you need.'));
  z.push('', `## ${L('Meine Frage', 'My question')}`, frage.trim(), '');
  z.push(`## ${L('Profil', 'Profile')} (${L('Stand', 'as of')} ${heute})`);
  if (profil.trainingsart) z.push(`- ${L('Trainingsart', 'Training style')}: ${profil.trainingsart === 'einfach' ? L('Bodybuilding / Krafttraining', 'Bodybuilding / strength') : 'Powerlifting'}`);
  if (profil.koerpergewicht) z.push(`- ${L('Körpergewicht', 'Bodyweight')}: ${zahl(profil.koerpergewicht, en)} kg`);
  if (!pl && profil.gewichtZiel) z.push(`- ${L('Ziel-Körpergewicht', 'Target bodyweight')}: ${zahl(profil.gewichtZiel, en)} kg`);
  if (pl && profil.gewichtsklasse) z.push(`- ${L('Gewichtsklasse', 'Weight class')}: ${profil.gewichtsklasse} kg`);
  if (pl && profil.wettkampfDatum && profil.wettkampfDatum >= heute) z.push(`- ${L('Nächster Wettkampf', 'Next meet')}: ${profil.wettkampfDatum} (${L('in', 'in')} ${Math.ceil(tage(heute, profil.wettkampfDatum) / 7)} ${L('Wochen', 'weeks')})`);
  if (profil.block) z.push(`- ${L('Aktueller Block', 'Current block')}: ${profil.block.name}${profil.block.wochen ? `, ${L('Woche', 'week')} ${profil.block.woche}/${profil.block.wochen}` : ''}`);
  const e = profil.e1rm ?? {};
  if (pl && Object.values(e).some(Boolean)) {
    const total = e.squat && e.bench && e.dead ? e.squat + e.bench + e.dead : null;
    z.push(`- ${L('Aktuelles e1RM', 'Current e1RM')}: ${Object.keys(LIFT).filter((l) => e[l]).map((l) => `${LIFT[l]} ${zahl(e[l], en)} kg`).join(' · ')}${total ? ` · Total ${zahl(total, en)} kg` : ''}`);
  }
  for (const b of profil.beschwerden ?? []) z.push(`- ${L('Beschwerden', 'Discomfort')}: ${b.region} (${L('schonen bis', 'protect until')} ${b.bis})`);
  z.push(`- ${L('Trainings im Zeitraum', 'Workouts in period')}: ${liste.length} ${L('in', 'in')} ${wochen} ${L('Wochen', 'weeks')}`);

  if (!pl) {
    const f = fortschrittJeUebung(liste), s = saetzeJeMuskel(liste, wochen, muskeln);
    if (s.length) z.push('', `## ${L('Arbeitssätze je Muskel und Woche (Schnitt, Hauptmuskel der Übung)', 'Working sets per muscle per week (average, primary muscle)')}`, ...s.map(([m, n]) => `- ${m}: ${zahl(n, en)}`));
    if (f.length) {
      z.push('', `## ${L('Fortschritt je Übung (bester Satz: erste → letzte Einheit im Zeitraum)', 'Progress per exercise (best set: first → last session in period)')}`);
      const satz = (x) => `${zahl(x.kg, en)}×${x.wdh}`;
      for (const x of f) z.push(`- ${name(x.key)}: ${x.n}× · ${satz(x.erste)} → ${satz(x.letzte)} (e1RM ${zahl(e1rm(x.erste.kg, x.erste.wdh), en)} → ${zahl(e1rm(x.letzte.kg, x.letzte.wdh), en)} kg)`);
    }
  }
  const verlauf = pl ? e1rmJeWoche(einheiten, von) : [];
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

/** Ideen je Trainingsart: [Chip de, Chip en, Frage de, Frage en]. */
export const BEISPIELE = {
  pl: [
    ['Wochen-Review', 'Weekly review', 'Wie war meine letzte Trainingswoche? Was lief gut, was sollte ich ändern?', 'How was my last training week? What went well, what should I change?'],
    ['Stillstand', 'Plateau', 'Wo stagniere ich bei Kniebeuge, Bank oder Kreuzheben und woran könnte das liegen?', 'Where am I stalling on squat, bench or deadlift and why might that be?'],
    ['Bereit für Test?', 'Ready to test?', 'Bin ich bereit für einen Max-Test? Welche Versuche würdest du mir vorschlagen?', 'Am I ready for a max test? Which attempts would you suggest?'],
    ['Wettkampf-Versuche', 'Meet attempts', 'Welche Versuche (Opener, 2., 3.) empfiehlst du mir für meinen nächsten Wettkampf?', 'Which attempts (opener, 2nd, 3rd) do you recommend for my next meet?'],
    ['Schwachstellen', 'Weak points', 'Welche Schwachstellen zeigen meine Daten, und welche Zusatzübungen helfen?', 'What weak points does my data show, and which accessories would help?'],
    ['Nächster Block', 'Next block', 'Wie sollte mein nächster Block aussehen?', 'What should my next block look like?'],
  ],
  bb: [
    ['Wochen-Review', 'Weekly review', 'Wie war meine letzte Trainingswoche? Was lief gut, was sollte ich ändern?', 'How was my last training week? What went well, what should I change?'],
    ['Schwache Muskeln', 'Lagging muscles', 'Welche Muskeln trainiere ich zu wenig oder zu viel, gemessen an den Sätzen pro Woche?', 'Which muscles am I training too little or too much, based on sets per week?'],
    ['Stillstand', 'Plateau', 'Bei welchen Übungen komme ich nicht weiter, und wie schaffe ich wieder Fortschritt?', 'Which exercises am I stuck on, and how do I get progress again?'],
    ['Mehr Muskeln', 'More muscle', 'Was sollte ich an meinem Training ändern, um schneller Muskeln aufzubauen?', 'What should I change in my training to build muscle faster?'],
    ['Plan-Check', 'Plan check', 'Passt mein Training zu meinem Ziel? Was würdest du an Übungen, Sätzen und Wiederholungen ändern?', 'Does my training fit my goal? What would you change in exercises, sets and reps?'],
    ['Übungen tauschen', 'Swap exercises', 'Welche Übungen sollte ich austauschen oder ergänzen, und warum?', 'Which exercises should I swap or add, and why?'],
  ],
};

/** Wo die KI aufgeht (Startseite des Chats; der Text kommt per Einfügen). paket = Android-App. */
export const KI_ZIELE = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', paket: 'com.openai.chatgpt' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', paket: 'com.google.android.googlequicksearchbox' },   // Gemini-Links übernimmt die Google-App
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/new', paket: 'com.anthropic.claude' },
];

/** Android: Intent-Link – öffnet direkt die installierte App; ist sie nicht da (oder kann den Link nicht), die Webseite. */
export function appLink(ziel) {
  const u = new URL(ziel.url);
  return `intent://${u.host}${u.pathname}#Intent;scheme=https;package=${ziel.paket};S.browser_fallback_url=${encodeURIComponent(ziel.url)};end`;
}
