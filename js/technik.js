// PR Hunter · Technik je Übung (Wunsch 163 e): kurze Hinweise je Übungsart (Katalogfeld f), für Kniebeuge, Bankdrücken und
// Kreuzheben (Feld b) die Wettkampf-Hinweise. Paare [Deutsch, Englisch]; die Bilder (Start/Ende) kommen aus dem Katalog.

const ALLGEMEIN = [['Kontrollierte Bewegung, saubere Haltung', 'Controlled movement, clean posture'],
  ['Gleichmäßig atmen', 'Breathe steadily'], ['Lieber leichter und sauber als schwer und schief', 'Lighter and clean beats heavy and sloppy']];

const JE_ART = {
  squat: [['Füße etwa schulterbreit, Zehen leicht nach außen', 'Feet about shoulder width, toes slightly out'],
    ['Bauch fest anspannen (Brace), dann runter', 'Brace your core, then descend'],
    ['Knie folgen den Zehen, Brust bleibt oben', 'Knees track over the toes, chest stays up'],
    ['Über die ganze Fußsohle hochdrücken', 'Drive up through the whole foot']],
  squat_machine: [['Rücken fest am Polster', 'Back firmly against the pad'], ['Kontrolliert tief, Knie folgen den Zehen', 'Go deep under control, knees track the toes'],
    ['Oben die Knie nicht ganz durchstrecken', 'Don\'t lock the knees out at the top']],
  lunge: [['Oberkörper aufrecht', 'Torso upright'], ['Vorderes Knie über dem Fuß, hinteres Knie Richtung Boden', 'Front knee over the foot, back knee towards the floor'],
    ['Über die Ferse des vorderen Fußes hochdrücken', 'Drive up through the front heel']],
  bench: [['Schulterblätter zusammen und nach unten', 'Shoulder blades back and down'], ['Füße fest am Boden, leichter Bogen', 'Feet planted, slight arch'],
    ['Kontrolliert zur unteren Brust, Ellbogen etwa 45°', 'Lower to the lower chest under control, elbows about 45°'],
    ['Leicht schräg nach oben zurückdrücken', 'Press back up and slightly back']],
  press: [['Bauch und Gesäß fest, kein Hohlkreuz', 'Brace abs and glutes, no overarching'], ['Unterarme senkrecht unter der Last', 'Forearms vertical under the load'],
    ['Gerade nach oben drücken, oben Kopf durch die Arme', 'Press straight up, head through at the top']],
  deadlift: [['Stange über der Fußmitte, nah am Schienbein', 'Bar over mid-foot, close to the shins'], ['Rücken neutral, Lat anspannen', 'Neutral back, engage the lats'],
    ['Boden wegdrücken, Stange am Körper führen', 'Push the floor away, keep the bar close'], ['Oben Hüfte strecken, nicht überstrecken', 'Finish with the hips, don\'t lean back']],
  hinge: [['Hüfte nach hinten schieben, Knie leicht gebeugt', 'Push the hips back, knees slightly bent'], ['Rücken neutral, Gewicht nah am Körper', 'Neutral back, weight close to the body'],
    ['Dehnung in den Beinbeugern spüren, mit dem Gesäß aufrichten', 'Feel the hamstring stretch, stand up with the glutes']],
  row: [['Brust raus, Rücken gerade', 'Chest up, back straight'], ['Ellbogen Richtung Hüfte ziehen', 'Pull the elbows towards the hips'],
    ['Schulterblätter zusammen, kontrolliert ablassen', 'Squeeze the shoulder blades, lower under control']],
  pulldown: [['Leicht zurücklehnen, Brust zur Stange', 'Lean back slightly, chest to the bar'], ['Ellbogen nach unten zur Hüfte ziehen', 'Drive the elbows down to the hips'],
    ['Oben ganz strecken, Schultern bleiben unten', 'Full stretch at the top, shoulders stay down']],
  pull_up: [['Aus dem Hängen zuerst die Schulterblätter nach unten ziehen', 'From the hang, pull the shoulder blades down first'],
    ['Brust zur Stange, Ellbogen nach unten', 'Chest to the bar, elbows down'], ['Kontrolliert bis zu gestreckten Armen ablassen', 'Lower under control to straight arms']],
  push_up: [['Körper eine Linie, Bauch fest', 'Body in one line, core tight'], ['Hände unter den Schultern, Ellbogen etwa 45°', 'Hands under the shoulders, elbows about 45°'],
    ['Brust fast bis zum Boden, oben ganz durchdrücken', 'Chest close to the floor, full lockout']],
  dip: [['Schultern weg von den Ohren', 'Shoulders away from the ears'], ['Kontrolliert ab, bis der Oberarm etwa waagrecht ist', 'Lower under control until the upper arm is about level'],
    ['Kräftig hochdrücken, oben nicht einsacken', 'Press up hard, don\'t sink at the top']],
  fly: [['Ellbogen leicht gebeugt und fest', 'Elbows slightly bent and fixed'], ['Weit öffnen bis zur Dehnung in der Brust', 'Open wide to a chest stretch'],
    ['Die Arme im Bogen zusammenführen', 'Bring the arms together in an arc']],
  curl: [['Ellbogen bleiben am Körper', 'Elbows stay at your sides'], ['Ohne Schwung hoch, oben kurz anspannen', 'Curl up without swinging, squeeze at the top'],
    ['Langsam bis zur Streckung ablassen', 'Lower slowly to full extension']],
  triceps: [['Oberarme ruhig halten', 'Keep the upper arms still'], ['Nur im Ellbogen strecken, ganz durchdrücken', 'Extend only at the elbow, lock out fully'],
    ['Kontrolliert zurück bis zur Dehnung', 'Return under control to a stretch']],
  shoulder_iso: [['Ellbogen minimal gebeugt, leicht nach vorn geneigt', 'Elbows slightly bent, lean forward a little'], ['Mit den Ellbogen führen, bis etwa Schulterhöhe', 'Lead with the elbows, up to about shoulder height'],
    ['Langsam ablassen, kein Schwung', 'Lower slowly, no momentum']],
  leg_iso: [['Knie bzw. Gelenk an der Drehachse der Maschine', 'Line the joint up with the machine\'s pivot'], ['Am Ende der Bewegung kurz halten', 'Pause briefly at the end of the movement'],
    ['Langsam zurück, Gewicht nicht absetzen', 'Return slowly, don\'t rest the weight']],
  core: [['Becken leicht kippen, unterer Rücken neutral', 'Tilt the pelvis slightly, lower back neutral'], ['Aus dem Bauch arbeiten, nicht am Nacken ziehen', 'Work from the abs, don\'t pull on the neck'],
    ['Beim Anspannen ausatmen', 'Exhale as you contract']],
  shrug: [['Arme gestreckt, Schultern gerade nach oben', 'Arms straight, shoulders straight up'], ['Oben kurz halten', 'Hold briefly at the top'], ['Nicht kreisen, langsam ablassen', 'No rolling, lower slowly']],
  forearm: [['Unterarm aufgelegt, nur das Handgelenk bewegt sich', 'Forearm supported, only the wrist moves'], ['Volle Bewegung, langsam', 'Full range, slowly']],
  olympic: [['Stange nah am Körper', 'Keep the bar close'], ['Explosiv aus Hüfte und Beinen', 'Explode from the hips and legs'], ['Technik zuerst mit leichtem Gewicht', 'Learn the technique with light weight first']],
  plyometrics: [['Weich landen, Knie über den Zehen', 'Land softly, knees over the toes'], ['Kurzer Bodenkontakt, explosiv', 'Short ground contact, explosive']],
};

// Wettkampfübungen (Katalogfeld b): Hinweise wie im Wettkampf
const WETTKAMPF = {
  squat: [['Wettkampf: Hüftfalte unter die Kniehöhe', 'Competition: hip crease below the top of the knee'], ['Auf das Kommando warten, ruhig abschließen', 'Wait for the command, finish calmly']],
  bench: [['Wettkampf: Stange auf der Brust ruhig halten, auf Kommando drücken', 'Competition: pause the bar on the chest, press on command'], ['Gesäß bleibt auf der Bank', 'Glutes stay on the bench']],
  deadlift: [['Wettkampf: oben Knie und Hüfte gestreckt, Schultern zurück', 'Competition: knees and hips locked, shoulders back'], ['Stange kontrolliert absetzen, nicht fallen lassen', 'Lower the bar under control, don\'t drop it']],
};

/** Hinweise einer Katalogübung (e = Katalogeintrag) als Paare [de, en]; höchstens fünf. */
export function technikVon(e) {
  if (!e) return ALLGEMEIN;
  const basis = JE_ART[e.f] ?? (['squat', 'bench', 'deadlift'].includes(e.b) ? JE_ART[e.b] : null) ?? ALLGEMEIN;
  return [...basis, ...(WETTKAMPF[e.b] ?? [])].slice(0, 5);
}
