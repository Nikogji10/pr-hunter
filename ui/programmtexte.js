// PR Hunter · Hinweise der Programmvorlagen in der App-Sprache. Die Vorlagen (Datenbank, programme/*.json) behalten ihre
// Originaltexte – meist Englisch aus Canditos und Nikos Excel-Dateien, teils Deutsch. Auf Deutsch übersetzt diese Datei
// die englischen Hinweise beim Anzeigen; auf Englisch übernimmt das ui/en.js (deutsche Hinweise stehen dort).
// Aufbau der Hybrid-Hinweise: „Main Top Set · 80% of Training Max  —  Satz.“ → Kopf über Muster, Satz über die Liste.
import { sprache } from './basis.js';

const KOPF = [
  [/^Main Top Set · (\d+(?:\.\d+)?)% of Training Max$/, 'Haupt-Top-Satz · $1 % vom Trainingsmax'],
  [/^Main Back-Off · (\d+(?:\.\d+)?)% of Training Max$/, 'Haupt-Back-off · $1 % vom Trainingsmax'],
  [/^Main Top Set · (\d+(?:\.\d+)?)% of entered 1RM$/, 'Haupt-Top-Satz · $1 % vom eingegebenen 1RM'],
  [/^Main Back-Off · (\d+(?:\.\d+)?)% of entered 1RM$/, 'Haupt-Back-off · $1 % vom eingegebenen 1RM'],
  [/^Variation Top Set · (\d+(?:\.\d+)?)% of Training Max x (\d+)% variation factor$/, 'Varianten-Top-Satz · $1 % vom Trainingsmax × $2 % Variantenfaktor'],
  [/^Variation Back-Off · (\d+(?:\.\d+)?)% of Training Max x (\d+)% variation factor$/, 'Varianten-Back-off · $1 % vom Trainingsmax × $2 % Variantenfaktor'],
];

const DE = new Map([
  ['PR Peak Set', 'PR-Spitzensatz'],
  ['The only heavy Deadlift session this week.', 'Die einzige schwere Kreuzhebe-Einheit dieser Woche.'],
  ['Replaces the Candito MR10 squat set.', 'Ersetzt Canditos MR10-Kniebeugesatz.'],
  ['Replaces the Candito extra-volume 5x3 block.', 'Ersetzt Canditos Zusatzvolumen 5 × 3.'],
  ['Added: keeps deadlift frequency at once per week across the block.', 'Ergänzt: hält das Kreuzheben im ganzen Block bei einmal pro Woche.'],
  ['Deliberately light - the heavy work is on Day 3 this week.', 'Bewusst leicht – die schwere Arbeit kommt diese Woche an Tag 3.'],
  ['Heaviest squat of the block. Elite lifters peak intensity roughly 2 weeks out; this sits 4 days before the test.', 'Schwerste Kniebeuge des Blocks. Spitzenheber erreichen die höchste Intensität etwa 2 Wochen vorher; hier liegt sie 4 Tage vor dem Test.'],
  ['Single back-off set - fatigue control before test week.', 'Nur ein Back-off-Satz – Ermüdung vor der Testwoche begrenzen.'],
  ['Heaviest deadlift of the block.', 'Schwerstes Kreuzheben des Blocks.'],
  ['Single back-off set only.', 'Nur ein Back-off-Satz.'],
  ['TEST: 1 top set @ RPE10, target 2+ reps. It should be highly unlikely to get more than 4 reps here - 2-4 reps is very good. The option to go beyond exists for cases where knee sleeves or a belt were introduced during the program, or form changed enough to allow serious gains.',
    'TEST: 1 Top-Satz @ RPE 10, Ziel 2+ Wdh. Mehr als 4 Wdh sind hier sehr unwahrscheinlich – 2–4 Wdh sind sehr gut. Mehr ist nur vorgesehen, falls im Block Kniebandagen oder Gürtel dazukamen oder sich die Technik deutlich verbessert hat.'],
  ['One light back-off. Skip it entirely if the test set was a grinder.', 'Ein leichter Back-off. Ganz weglassen, wenn der Testsatz ein Kampf war.'],
  ['Primer only - deliberately sub-maximal before the deadlift test on Day 3.', 'Nur zum Einstimmen – bewusst submaximal vor dem Kreuzhebetest an Tag 3.'],
  ['Primer volume - keep it easy.', 'Einstimm-Volumen – locker halten.'],
  ['Optional single back-off - skip if the test set was maximal.', 'Optionaler einzelner Back-off – weglassen, wenn der Testsatz maximal war.'],
  ['Candito prescription - unchanged.', 'Vorgabe von Candito – unverändert.'],
  ["Perform sets of 4 reps if an 'Explosive Lower Body' exercise is chosen here, or at any point as a 'Lower Accessory'.",
    'Sätze zu 4 Wdh, wenn hier oder als Unterkörper-Zubehör eine explosive Übung gewählt wird.'],
  ["Note, perform sets of 4 reps if an 'Explosive Lower Body' exercise is chosen here or at any point as a 'Lower Accessory'",
    'Hinweis: Sätze zu 4 Wdh, wenn hier oder als Unterkörper-Zubehör eine explosive Übung gewählt wird.'],
  ['Scheiben pro Seite rechnet die App. 2-5 cm deficit, 1-2 s pause just below the knee, dead stop between reps. Suggested start - adjust to hit RPE8.',
    'Scheiben pro Seite rechnet die App. 2–5 cm Defizit, 1–2 s Pause knapp unter dem Knie, zwischen den Wdh absetzen. Startvorschlag – so anpassen, dass es RPE 8 wird.'],
  ['Scheiben pro Seite rechnet die App. 2-5 cm deficit, 1-2 s pause just below the knee, dead stop between reps. Suggested start - adjust to hit RPE8. Slightly heavier for the 6-rep sets.',
    'Scheiben pro Seite rechnet die App. 2–5 cm Defizit, 1–2 s Pause knapp unter dem Knie, zwischen den Wdh absetzen. Startvorschlag – so anpassen, dass es RPE 8 wird. Für die 6er-Sätze etwas schwerer.'],
  ['Scheiben pro Seite rechnet die App. 2-5 cm deficit, 1-2 s pause just below the knee, dead stop between reps. Suggested start - adjust to hit RPE7. Deload load - 8 percentage points under the working %.',
    'Scheiben pro Seite rechnet die App. 2–5 cm Defizit, 1–2 s Pause knapp unter dem Knie, zwischen den Wdh absetzen. Startvorschlag – so anpassen, dass es RPE 7 wird. Deload-Last: 8 Prozentpunkte unter den Arbeitsprozenten.'],
  ["Candito's own bench back-off work.", 'Canditos eigene Back-off-Arbeit fürs Bankdrücken.'],
  ["Candito's deadlift-variation slot was removed from this day only - a main Deadlift now occupies the hinge slot.",
    'Canditos Kreuzhebe-Variante entfällt nur an diesem Tag – der Platz gehört jetzt dem Haupt-Kreuzheben.'],
  ["Week 4 bench: Candito's heavy-weight acclimation block, driven by your DESIRED bench max. On the accessory peak set the prescribed range is 15-20 reps for a single set - a true 20-rep max if possible, 15 as a no-break minimum. After at least 15 reps you may rack the bar and rest as little as possible before squeezing out the remainder; 20 total reps should be completed.",
    'Bank Woche 4: Canditos Block zur Gewöhnung an schwere Gewichte, gerechnet vom GEWÜNSCHTEN Bank-Max. Beim Zubehör-Spitzensatz: 1 Satz mit 15–20 Wdh – möglichst ein echtes 20er-Max, mindestens 15 ohne Pause. Nach 15 Wdh darf die Stange kurz abgelegt werden, so kurz wie möglich, dann den Rest; insgesamt 20 Wdh.'],
  ["Due to fatigue from the bench sets, optimal performance on these accessory peak sets is not expected - don't be disappointed if you need lighter weight than anticipated.",
    'Nach den Banksätzen ist bei diesen Zubehör-Spitzensätzen keine Bestleistung zu erwarten – nicht enttäuscht sein, wenn weniger Gewicht geht als gedacht.'],
  ["I'd rather you choose the maximum weight and hit just 5 sets than the minimum weight for 10 sets. Pick the heaviest weight possible, then do as many sets as you can. If you manage both the max weight and max sets (10) and feel no nagging pain from overuse, then add 5 back-off sets x 3 reps with 80% of your goal max, using extended pauses (3 seconds) on each rep.",
    'Lieber das höchste Gewicht und nur 5 Sätze als das niedrigste für 10 Sätze. Das schwerste mögliche Gewicht wählen, dann so viele Sätze wie möglich. Schaffst du Höchstgewicht und 10 Sätze ohne Überlastungsschmerz: 5 Back-off-Sätze × 3 Wdh mit 80 % vom Zielmax anhängen, jede Wdh mit 3 s Pause.'],
  ['Candito bench test - unchanged. It should be highly unlikely to get more than 4 reps here - 2-4 reps is very good. The option to go beyond exists for cases where knee sleeves or a belt were introduced during the program, or form changed enough to allow serious gains.',
    'Bank-Test nach Candito – unverändert. Mehr als 4 Wdh sind hier sehr unwahrscheinlich – 2–4 Wdh sind sehr gut. Mehr ist nur vorgesehen, falls im Block Kniebandagen oder Gürtel dazukamen oder sich die Technik deutlich verbessert hat.'],
  ['Week 5 taper: 2 sets @ RPE6. Generic accessory slots are out this week.', 'Woche 5 Taper: 2 Sätze @ RPE 6. Freie Zubehörplätze entfallen diese Woche.'],
  ['Candito prescribes no load here - work up to a top set of 5 @ RPE10.', 'Candito gibt hier kein Gewicht vor – bis zu einem Top-Satz mit 5 Wdh @ RPE 10 steigern.'],
  ['85% of your desired bench max - Candito, unchanged.', '85 % vom gewünschten Bank-Max – Candito, unverändert.'],
  ['Candito deload bench - unchanged.', 'Deload-Bank nach Candito – unverändert.'],
  ['Original workbook had the RPE typed into the weight column here - corrected.', 'In der Original-Tabelle stand hier die RPE in der Gewichtsspalte – korrigiert.'],
  ['Extra Volume Squats - Add 5 lbs or 2.5 kg if using kg plates, then perform 5 sets x 3 reps each set with 60 seconds rest between sets.',
    'Zusatzvolumen Kniebeuge: 2,5 kg (bzw. 5 lb) mehr, dann 5 Sätze × 3 Wdh mit 60 s Pause.'],
  ['Note - If you were not able to complete a minimum of 8 reps on the MR10 set, reduce max entered by 2.5% moving forward.',
    'Hinweis: Weniger als 8 Wdh im MR10-Satz → das eingegebene Max ab jetzt um 2,5 % senken.'],
  ['Still complete the 5 sets of 3 reps regardless even if you do perform less than 8 reps on the MR10 set.',
    'Die 5 × 3 trotzdem machen, auch mit weniger als 8 Wdh im MR10-Satz.'],
  ['Back Off Squats - Reduce weight by 10 lbs or 5 kg if using kg plates.  Then proceed with the following:',
    'Back-off-Kniebeugen: 5 kg (bzw. 10 lb) weniger, dann so weiter:'],
  ['If you were able to complete 10 reps on the MR10 set, perform 10 sets of 3 reps per set, with 60 seconds rest between sets.',
    '10 Wdh im MR10-Satz geschafft → 10 Sätze × 3 Wdh mit 60 s Pause.'],
  ['If you completed 8-9 reps on the MR10 set, perform 8 sets of 3 reps per set, with 60 seconds rest between sets.',
    '8–9 Wdh im MR10-Satz → 8 Sätze × 3 Wdh mit 60 s Pause.'],
  ['If you completed 7 reps on the MR 10 set, perform 5 sets of 3 reps per set, with 60 seconds rest between sets.',
    '7 Wdh im MR10-Satz → 5 Sätze × 3 Wdh mit 60 s Pause.'],
  ['If you completed less than 7 reps, skip back off sets entirely and reduce your entered 1 rep max by at least 2.5% for following weeks.',
    'Weniger als 7 Wdh → Back-offs ganz weglassen und das eingegebene 1RM für die folgenden Wochen um mindestens 2,5 % senken.'],
  ['On week 4 the prescribed rep range is 15-20 for just 1 set.  The goal here is a true 20 rep max if possible, but 15 is acceptable as a no break minimum since predicting with accuracy will be difficult.',
    'In Woche 4: 1 Satz mit 15–20 Wdh. Ziel ist möglichst ein echtes 20er-Max; 15 ohne Pause reichen, weil es sich schwer genau vorhersagen lässt.'],
  ['After getting at least 15 reps, then you can rack the weight to just rest as little as possible before squeezing out the rest.  No matter what 20 total reps should be completed.',
    'Nach mindestens 15 Wdh darf die Stange kurz abgelegt werden – so kurz wie möglich, dann den Rest. Insgesamt auf jeden Fall 20 Wdh.'],
  ["Due to the fatigue from the bench press sets, optimal performance on these accessory peak sets is not expected.  So don't be dissapointed if you have to use lighter weight than you anticipated.",
    'Nach den Banksätzen ist bei diesen Zubehör-Spitzensätzen keine Bestleistung zu erwarten – nicht enttäuscht sein, wenn weniger Gewicht geht als gedacht.'],
  ["I'd rather have you choose the maximum weight and hit just 5 sets than the minumum", 'Lieber das höchste Gewicht und nur 5 Sätze als das niedrigste'],
  ['weight for 10 sets.  So pick the heaviest weight if possible then do as many sets as you can.  If you do', 'für 10 Sätze. Also möglichst das schwerste Gewicht wählen, dann so viele Sätze wie möglich. Schaffst du'],
  ['manage to hit both the max weight and max amount of sets (10), and feel no nagging pain from overuse,', 'Höchstgewicht und 10 Sätze ohne Überlastungsschmerz,'],
  ['then add 5 backoff sets x 3 reps with 80% of your goal max for extended pauses (3 seconds) on each rep.', 'dann 5 Back-off-Sätze × 3 Wdh mit 80 % vom Zielmax anhängen, jede Wdh mit 3 s Pause.'],
  ['Note, it should be highly unlikely to get any more than 4 reps here - achieving 2-4 reps should be considered very good. The option to go beyond this is for those incidents where',
    'Hinweis: Mehr als 4 Wdh sind hier sehr unwahrscheinlich – 2–4 Wdh sind sehr gut. Mehr ist nur vorgesehen, falls'],
  ['knee sleeves or a belt were introduced during this program (or form was changed which allowed for some serious freakish strength gains to be made).',
    'im Block Kniebandagen oder Gürtel dazukamen (oder eine Technikänderung für einen großen Kraftsprung gesorgt hat).'],
  ['Note - Set 1 above is an estimated opener ~ RPE8 / 92%', 'Hinweis: Satz 1 oben ist ein geschätzter Opener, etwa RPE 8 / 92 %.'],
]);

/** Programmhinweis in der App-Sprache (auf Deutsch übersetzt, auf Englisch unverändert – den Rest macht ui/en.js). */
export function programmText(text) {
  if (!text || sprache() === 'en') return text;
  const t = text.trim();
  if (DE.has(t)) return DE.get(t);
  const [kopf, ...rest] = t.split(/\s+—\s+/);
  const muster = KOPF.find(([re]) => re.test(kopf));
  if (!muster) return text;
  const satz = rest.join(' — ');
  return `${kopf.replace(muster[0], muster[1])}${satz ? ` – ${DE.get(satz) ?? satz}` : ''}`;
}
