// PR Hunter · Begrüßung auf „Heute“ (Wunsch 173): „Guten Morgen, Niko“ und ein Spruch des Tages.
// Sprüche als Paare [Deutsch, Englisch] (optional dritter Eintrag 'pl' = nur Powerlifting, 'bb' = nur Bodybuilding/einfach);
// je Tag fest gewählt (gleich beim erneuten Öffnen), über eine feste Mischung der Liste, damit sich nichts wiederholt,
// bevor alle einmal dran waren.
import { html, sprache } from './basis.js';

const ALLGEMEIN = [
  ['Stärker als gestern.', 'Stronger than yesterday.'],
  ['Die Stange lügt nicht.', 'The bar never lies.', 'pl'],
  ['Kleine Schritte, große Zahlen.', 'Small steps, big numbers.'],
  ['Jede Wiederholung zählt.', 'Every rep counts.'],
  ['Disziplin schlägt Motivation.', 'Discipline beats motivation.'],
  ['Heute zählt, nicht morgen.', 'Today counts, not tomorrow.'],
  ['Schwer ist relativ.', 'Heavy is relative.'],
  ['Das Eisen wartet schon.', 'The iron is waiting.'],
  ['Einfach anfangen. Der Rest kommt.', 'Just start. The rest follows.'],
  ['2,5 kg mehr sind auch ein Rekord.', '2.5 kg more is still a record.'],
  ['Technik zuerst, dann Gewicht.', 'Technique first, then weight.'],
  ['Konstanz baut Kraft.', 'Consistency builds strength.'],
  ['Du gegen dich von letzter Woche.', 'You versus last week\'s you.'],
  ['Kein Satz ist umsonst.', 'No set is wasted.'],
  ['Ruhig atmen, fest stehen, drücken.', 'Breathe, brace, press.', 'pl'],
  ['Fortschritt ist leise – bis er laut wird.', 'Progress is quiet – until it isn\'t.'],
  ['Der schwerste Teil: die Tür zum Gym.', 'The hardest lift: the gym door.'],
  ['Ein guter Satz nach dem anderen.', 'One good set at a time.'],
  ['Wer wagt, hebt.', 'Lift it, log it, beat it.'],
  ['Starke Tage kommen von starken Gewohnheiten.', 'Strong days come from strong habits.'],
  ['Langsam ist auch schnell, wenn es nie aufhört.', 'Slow is fast when it never stops.'],
  ['Nur der Kalender zeigt Pausen.', 'Only the calendar takes days off.'],
  ['Gewicht bewegen, Kopf frei machen.', 'Move weight, clear your head.'],
  ['Zieh durch.', 'Finish strong.'],
  ['Mehr Kreide, weniger Zweifel.', 'More chalk, less doubt.', 'pl'],
  ['Der Plan steht. Du auch.', 'The plan is set. So are you.'],
  ['Heute ist ein guter Tag für einen Rekord.', 'Today is a good day for a PR.'],
  ['Kraft ist eine Fähigkeit – üb sie.', 'Strength is a skill – practise it.'],
  ['Gute Wiederholungen statt viele.', 'Good reps over many reps.'],
  ['Erst sauber, dann schwer, dann schwerer.', 'Clean, then heavy, then heavier.'],
  ['Hol dir, was dir gehört.', 'Go get what\'s yours.'],
  ['Dein einziger Gegner trägt deinen Namen.', 'Your only rival has your name.'],
  ['Halte durch, wenn es schwer wird.', 'Stay with it when it gets heavy.'],
  ['Das Ziel kommt näher – Satz für Satz.', 'The goal gets closer, set by set.'],
  ['Wachsen passiert außerhalb der Komfortzone.', 'Growth lives outside the comfort zone.'],
  ['Heute investieren, morgen ernten.', 'Invest today, collect tomorrow.'],
  ['Schweiß ist nur Fortschritt, der rausläuft.', 'Sweat is just progress leaving.'],
  ['Keine Abkürzung, nur Wiederholungen.', 'No shortcuts, just reps.'],
  ['Stark sein ist eine Entscheidung.', 'Being strong is a decision.'],
  ['Bleib hungrig.', 'Stay hungry.'],
  ['Auch Profis machen Aufwärmsätze.', 'Even pros do warm-ups.'],
  ['Spannung halten. Immer.', 'Stay tight. Always.', 'pl'],
  ['Kopf hoch, Brust raus, los.', 'Chin up, chest out, go.'],
  ['Die beste Investition: du selbst.', 'Best investment: yourself.'],
  ['Kraft kommt nicht über Nacht – aber jede Nacht ein bisschen.', 'Strength doesn\'t come overnight – but a bit every night.'],
  ['Mach es für dein zukünftiges Ich.', 'Do it for future you.'],
  ['Weniger reden, mehr heben.', 'Less talk, more lift.'],
  ['Heute ein Kilo, im Jahr ein Zentner.', 'A kilo today, a lot by next year.'],
  ['Jeder Rekord war mal ein Aufwärmsatz.', 'Every PR was once a warm-up.'],
  ['Fokus. Atmung. Ausführung.', 'Focus. Breath. Execution.'],
  ['Die Hantel ist dein Tagebuch.', 'The barbell is your diary.'],
  ['Fang an, bevor du bereit bist.', 'Start before you feel ready.'],
  ['Schwere Tage machen starke Menschen.', 'Hard days make strong people.'],
  ['Erst das Training, dann die Ausreden.', 'Training first, excuses never.'],
  ['Es wird nicht leichter – du wirst stärker.', 'It doesn\'t get easier – you get stronger.'],
  ['Der Fortschritt steht im Log.', 'Progress lives in the log.'],
  ['Gib dem Eisen einen Grund.', 'Give the iron a reason.'],
  ['Ein Satz mehr als gestern.', 'One more set than yesterday.'],
  ['Das Gym ist geöffnet. Du auch?', 'The gym is open. Are you?'],
  ['Lass die Zahlen sprechen.', 'Let the numbers talk.'],
  ['Mut ist, die nächste Scheibe aufzulegen.', 'Courage is loading the next plate.'],
  ['Geduld ist auch Training.', 'Patience is training too.'],
  ['Gute Form ist das stärkste Gewicht.', 'Good form is the strongest weight.'],
  ['Nicht zählen, abhaken.', 'Don\'t count it, tick it off.'],
  ['Zwischen den Sätzen wächst die Entschlossenheit.', 'Resolve grows between sets.'],
  ['Dein Rücken dankt dir fürs Bracen.', 'Your back thanks you for bracing.', 'pl'],
  ['Wer regelmäßig kommt, kommt weit.', 'Show up often, go far.'],
  ['Kein schlechtes Training – nur Daten.', 'No bad sessions – only data.'],
  ['Feier die kleinen Rekorde.', 'Celebrate the small PRs.'],
  ['Stärke ist leise Selbstachtung.', 'Strength is quiet self-respect.'],
  ['Der Weg ist schwer. Du bist schwerer.', 'The road is heavy. You\'re heavier.'],
  ['Einmal mehr aufstehen als hinfallen.', 'Get up once more than you fall.'],
  ['Mach heute, wofür du morgen dankbar bist.', 'Do today what tomorrow-you will thank you for.'],
  ['Kraft aufbauen heißt Geduld aufbauen.', 'Building strength is building patience.'],
  ['Trainieren ist besser als Warten.', 'Training beats waiting.'],
  ['Du bist stärker, als du denkst.', 'You\'re stronger than you think.'],
  ['Die Scheiben sind nur rund – nicht leicht.', 'Plates are round, not light.'],
  ['Sauber runter, explosiv hoch.', 'Controlled down, explosive up.'],
  ['Auf die Füße, fertig, Eisen.', 'Feet set, ready, iron.'],
  ['Jedes Kilo erzählt eine Geschichte.', 'Every kilo tells a story.'],
  ['Erholung ist Teil des Plans.', 'Recovery is part of the plan.'],
  ['Druck macht Diamanten.', 'Pressure makes diamonds.'],
  ['Es zählt, was du wiederholst.', 'What you repeat is what counts.'],
  ['Heute baust du am stärksten Ich.', 'Today you build your strongest self.'],
  ['Wer die Stange greift, hat schon halb gewonnen.', 'Grip the bar and you\'re halfway there.', 'pl'],
  ['Ehrgeiz plus Plan gleich Rekord.', 'Ambition plus a plan equals a PR.'],
  ['Mach es schwer. Mach es sauber. Mach es wieder.', 'Make it heavy. Make it clean. Do it again.'],
  ['Gute Laune ist das beste Pre-Workout.', 'Good mood is the best pre-workout.'],
  ['Kreide drauf und los.', 'Chalk up and go.', 'pl'],
  ['Eisen formt Charakter.', 'Iron shapes character.'],
  ['Konzentration ist dein Spotter.', 'Focus is your spotter.'],
  ['Ein Rekord beginnt im Kopf.', 'A PR starts in your head.'],
  ['Die Wiederholung, die du nicht willst, ist die, die zählt.', 'The rep you don\'t want is the one that counts.'],
  ['Groß denken, sauber heben.', 'Think big, lift clean.'],
  ['Auch der längste Block beginnt mit Woche 1.', 'Even the longest block starts with week 1.'],
  ['Bleib dran – die Kurve zeigt nach oben.', 'Keep going – the curve points up.'],
  ['Schwer heben, leicht nehmen.', 'Lift heavy, take it easy.'],
  ['Es gibt kein „zu spät“ für stark.', 'It\'s never too late to get strong.'],
  ['Der beste Spotter bist du selbst.', 'Your best spotter is you.'],
  ['Nichts motiviert wie ein neuer Rekord.', 'Nothing motivates like a fresh PR.'],
  // 02.11.: mehr allgemeine
  ['Fortschritt ist kein Zufall.', 'Progress is no accident.'],
  ['Gute Gewohnheiten sind schwer zu brechen.', 'Good habits are hard to break.'],
  ['Komm fürs Training, bleib fürs Gefühl danach.', 'Come for the workout, stay for the feeling after.'],
  ['Ein Training ist besser als keins.', 'One workout beats none.'],
  ['Motivation bringt dich hin, Gewohnheit bringt dich weiter.', 'Motivation gets you started, habit keeps you going.'],
  ['Sei stolz auf jedes Training.', 'Be proud of every session.'],
  ['Du musst nicht perfekt sein, nur dabei.', 'You don\'t have to be perfect, just present.'],
  ['Heute ein bisschen besser als gestern.', 'A little better than yesterday.'],
];

// Powerlifting: Kniebeuge, Bank, Kreuzheben, Total, Blockplanung
const POWER = [
  ['Brace wie ein Fass, drück wie ein Kolben.', 'Brace like a barrel, drive like a piston.'],
  ['Tiefe ist kein Vorschlag.', 'Depth is not a suggestion.'],
  ['Kommando abwarten, dann drücken.', 'Wait for the command, then press.'],
  ['Drei Lifts. Ein Total.', 'Three lifts. One total.'],
  ['Das Total wächst Kilo für Kilo.', 'The total grows kilo by kilo.'],
  ['Weißes Licht beginnt im Training.', 'White lights start in training.'],
  ['Rücken fest, Hüfte durch, abschließen.', 'Back tight, hips through, lock it out.'],
  ['Der Opener muss immer gehen.', 'Your opener should always fly.'],
  ['Peaking ist Geduld mit Plan.', 'Peaking is patience with a plan.'],
  ['Kniebeuge: Brust hoch, Knie raus.', 'Squat: chest up, knees out.'],
  ['Bankdrücken beginnt mit den Füßen.', 'The bench press starts with your feet.'],
  ['Kreuzheben: Schieb den Boden weg.', 'Deadlift: push the floor away.'],
  ['Submaximal heute, Rekord am Testtag.', 'Submax today, PR on test day.'],
  ['RPE 8 heißt: zwei im Tank.', 'RPE 8 means two in the tank.'],
  ['Der Block macht dich stark, nicht der eine Tag.', 'The block makes you strong, not one day.'],
  ['Auch ein Grind ist eine Wiederholung.', 'A grind is still a rep.'],
  ['Stark heißt: auch die letzte Wiederholung sauber.', 'Strong means the last rep is clean too.'],
  ['Gürtel zu, Kopf an.', 'Belt on, mind on.'],
  ['Jede Woche ein Stück näher am Total.', 'Every week a bit closer to your total.'],
  ['Wettkampf ist Training mit Publikum.', 'A meet is just training with a crowd.'],
  ['Kaffee, Kreide, Kniebeuge.', 'Coffee, chalk, squats.'],
  ['Schwere Singles, ruhiger Kopf.', 'Heavy singles, calm mind.'],
];

// Bodybuilding / einfaches Training: Muskelaufbau, Volumen, Technik, Ernährung, Erholung
const BODY = [
  ['Spür den Muskel, nicht nur das Gewicht.', 'Feel the muscle, not just the weight.'],
  ['Kontrolle in der Negativen baut Muskeln.', 'Control on the negative builds muscle.'],
  ['Volumen ist dein Freund.', 'Volume is your friend.'],
  ['Der Pump ist nur der Anfang.', 'The pump is just the beginning.'],
  ['Muskeln wachsen beim Essen und Schlafen.', 'Muscles grow while you eat and sleep.'],
  ['Saubere Wiederholungen bauen Form.', 'Clean reps build shape.'],
  ['Volle Bewegung, volles Wachstum.', 'Full range, full growth.'],
  ['Die letzte Wiederholung macht den Unterschied.', 'The last rep makes the difference.'],
  ['Symmetrie kommt von Geduld.', 'Symmetry comes from patience.'],
  ['Protein heute, Muskeln morgen.', 'Protein today, muscle tomorrow.'],
  ['Langsam runter, den Muskel arbeiten lassen.', 'Lower it slowly, let the muscle work.'],
  ['Ein Muskel, ein Fokus.', 'One muscle, one focus.'],
  ['Bis RPE 9 – da beginnt das Wachstum.', 'To RPE 9 – that\'s where growth starts.'],
  ['Der Spiegel lügt manchmal, das Log nie.', 'The mirror sometimes lies, the log never does.'],
  ['Form vor Ego.', 'Form over ego.'],
  ['Jeder Muskel zweimal pro Woche – so wächst er.', 'Hit each muscle twice a week – that\'s how it grows.'],
  ['Ein Kilo oder eine Wiederholung mehr – das ist Fortschritt.', 'One more kilo or one more rep – that\'s progress.'],
  ['Disziplin in der Küche zeigt sich im Gym.', 'Discipline in the kitchen shows in the gym.'],
  ['Besser aussehen, stärker fühlen.', 'Look better, feel stronger.'],
  ['Deload ist kein Rückschritt.', 'A deload is not a step back.'],
  ['Wachstum braucht Zeit – und Wiederholungen.', 'Growth takes time – and reps.'],
  ['Brennen heißt: Es wirkt.', 'The burn means it\'s working.'],
  ['Kurze Pausen, langer Fokus.', 'Short rests, long focus.'],
  ['Dein Körper ist dein Projekt.', 'Your body is your project.'],
  ['Kaffee, Aufwärmen, Pump.', 'Coffee, warm-up, pump.'],
];

const MORGEN = [
  ['Früher Vogel, schwere Stange.', 'Early bird, heavy bar.'],
  ['Der Tag ist frisch – du auch.', 'Fresh day, fresh you.'],
  ['Kaffee, dann Eisen.', 'Coffee, then iron.'],
  ['Wer früh hebt, hat den Tag gewonnen.', 'Lift early, win the day.'],
  ['Guter Start: erst Frühstück, dann Eisen.', 'Good start: breakfast, then iron.'],
];
const ABEND = [
  ['Der Tag ist noch nicht vorbei.', 'The day isn\'t over yet.'],
  ['Feierabend? Feierabend-Training!', 'Off work? Time to train!'],
  ['Abends wird das Eisen ehrlich.', 'The iron gets honest at night.'],
  ['Zeit, den Kopf freizuheben.', 'Time to lift your head clear.'],
  ['Schlaf ist das beste Supplement – nach dem Training.', 'Sleep is the best supplement – after training.'],
];
const TRAININGSTAG = [
  ['Heute ist Trainingstag.', 'Today is training day.'],
  ['Dein Plan wartet – zeig ihm, wer der Chef ist.', 'Your plan is waiting – show it who\'s boss.'],
  ['Heute wird geliefert.', 'Today we deliver.'],
  ['Die Stange ist schon geladen.', 'The bar is already loaded.'],
  ['Training steht an. Du schaffst das.', 'Training\'s up. You\'ve got this.'],
  ['Pläne sind gut, abgehakte Pläne besser.', 'Plans are good, completed plans are better.'],
];
const RUHETAG = [
  ['Ruhetag: Muskeln wachsen jetzt.', 'Rest day: muscles grow now.'],
  ['Heute erholen, morgen angreifen.', 'Recover today, attack tomorrow.'],
  ['Auch Pausen machen stark.', 'Rest makes you strong too.'],
  ['Viel trinken, gut essen, früh schlafen.', 'Drink plenty, eat well, sleep early.'],
  ['Erholung ist Training ohne Stange.', 'Recovery is training without the bar.'],
];
const MONTAG = [['Neue Woche, neue Rekorde.', 'New week, new PRs.'], ['Montag setzt den Ton für die Woche.', 'Monday sets the tone for the week.']];
const FREITAG = [['Freitag – noch einmal alles geben.', 'Friday – give it everything once more.'], ['Wochenende verdient man sich unter der Stange.', 'Earn your weekend under the bar.']];
const WOCHENENDE = [['Wochenende: Zeit für schwere Sätze ohne Eile.', 'Weekend: time for heavy sets, no rush.'], ['Samstag ist der beste Gym-Tag.', 'Saturday is the best gym day.']];

/** Feste Mischung (gleiche Reihenfolge auf allen Geräten), damit sich Sprüche erst nach einem Durchlauf wiederholen. */
function gemischt(liste) {
  const l = liste.map((x, i) => [x, (i * 2654435761) % 4294967296]);
  return l.sort((a, b) => a[1] - b[1]).map(([x]) => x);
}
// Pool je Trainingsart: allgemeine plus die der eigenen Richtung (Powerlifting-Sprüche nicht bei Bodybuilding und umgekehrt)
const passt = (art) => (x) => !x[2] || x[2] === (art === 'einfach' ? 'bb' : 'pl');
const POOLS = { pl: gemischt([...ALLGEMEIN, ...POWER].filter(passt('powerlifting'))), bb: gemischt([...ALLGEMEIN, ...BODY].filter(passt('einfach'))) };
const tagNr = (datum) => Math.floor(Date.parse(`${datum}T00:00:00Z`) / 86400000);

/** Spruch des Tages: an Trainings-/Ruhetagen, Montag, Freitag, Wochenende oder Tageszeit gelegentlich passend, sonst aus der großen Liste. */
export function spruchDes(datum, { trainingstag = null, stunde = new Date().getHours(), art = 'powerlifting' } = {}) {
  const POOL = POOLS[art === 'einfach' ? 'bb' : 'pl'];
  const n = tagNr(datum);
  const wt = new Date(`${datum}T00:00:00Z`).getUTCDay();
  const passend = [
    ...(trainingstag === true ? TRAININGSTAG : trainingstag === false ? RUHETAG : []),
    ...(wt === 1 ? MONTAG : wt === 5 ? FREITAG : wt === 0 || wt === 6 ? WOCHENENDE : []),
    ...(stunde < 11 ? MORGEN : stunde >= 18 ? ABEND : []),
  ].filter(passt(art));
  // jeder dritte Tag ein passender Spruch, sonst der nächste aus der großen Liste
  const paar = passend.length && n % 3 === 0 ? passend[Math.floor(n / 3) % passend.length] : POOL[n % POOL.length];
  return sprache() === 'en' ? paar[1] : paar[0];
}

export function begruessung(stunde = new Date().getHours()) {
  const en = sprache() === 'en';
  if (stunde >= 5 && stunde < 11) return en ? 'Good morning' : 'Guten Morgen';
  if (stunde >= 11 && stunde < 17) return en ? 'Good afternoon' : 'Guten Tag';
  if (stunde >= 17 && stunde < 23) return en ? 'Good evening' : 'Guten Abend';
  return en ? 'Hello' : 'Hallo';
}

export function Gruss({ vorname, datum, trainingstag, art = 'powerlifting' }) {
  return html`<div class="gruss">
    <h1 class="gruss-t">${vorname ? `${begruessung()}, ${vorname}` : begruessung()}</h1>
    <p class="gruss-s">${spruchDes(datum, { trainingstag, art })}</p>
  </div>`;
}

export const ANZAHL_SPRUECHE = ALLGEMEIN.length + POWER.length + BODY.length + MORGEN.length + ABEND.length + TRAININGSTAG.length + RUHETAG.length + MONTAG.length + FREITAG.length + WOCHENENDE.length;
